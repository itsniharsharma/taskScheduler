import { app, BrowserWindow, dialog, ipcMain, Notification, screen, shell } from "electron";
import path from "node:path";
import fs from "node:fs";

type WindowBounds = { x: number; y: number; width: number; height: number };
const FIXED_WIDGET_SIZE = { width: 399, height: 725 } as const;

type AppConfig = {
  pinned: boolean;
  launchOnStartup: boolean;
  bounds?: WindowBounds;
  dataDirectory?: string;
};

type StoredAppData = {
  version: 1;
  tasks: unknown[];
  notesByDate: Record<string, { content: string; updatedAt: string }>;
  completionResponses: Array<{
    id: string;
    taskId: string;
    scheduledDate: string;
    scheduledStart: string;
    scheduledEnd: string;
    response: "YES" | "NO";
    respondedAt: string;
  }>;
  settings: {
    storagePath: string;
    initializedAt: string;
    pingOnReminder: boolean;
    pingOnCompletion: boolean;
  };
};

const isDev = process.env.NODE_ENV === "development";
const configPath = path.join(app.getPath("userData"), "widget-config.json");
let mainWindow: BrowserWindow | null = null;
const gotSingleInstanceLock = isDev ? true : app.requestSingleInstanceLock();

if (!gotSingleInstanceLock && !isDev) {
  app.quit();
}

app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disable-http-cache");
app.disableHardwareAcceleration();

const ensureSessionDataPath = () => {
  const sessionDataPath = path.join(app.getPath("userData"), "session-data");
  try {
    fs.mkdirSync(sessionDataPath, { recursive: true });
    app.setPath("sessionData", sessionDataPath);
  } catch {
    // Fall back to Electron defaults if this path cannot be created.
  }
};

const defaultConfig: AppConfig = {
  pinned: true,
  launchOnStartup: true
};

const defaultStoredData = (storagePath: string): StoredAppData => ({
  version: 1,
  tasks: [],
  notesByDate: {},
  completionResponses: [],
  settings: {
    storagePath,
    initializedAt: new Date().toISOString(),
    pingOnReminder: true,
    pingOnCompletion: true
  }
});

const resolvePingSoundPath = (): string | null => {
  const candidates = [
    path.join(process.cwd(), "sound", "sound.mp3"),
    path.join(app.getAppPath(), "sound", "sound.mp3"),
    path.join(path.dirname(app.getPath("exe")), "sound", "sound.mp3")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const readConfig = (): AppConfig => {
  try {
    if (!fs.existsSync(configPath)) {
      return defaultConfig;
    }
    const raw = fs.readFileSync(configPath, "utf8");
    return { ...defaultConfig, ...JSON.parse(raw) } as AppConfig;
  } catch {
    return defaultConfig;
  }
};

const writeConfig = (nextConfig: AppConfig): void => {
  fs.writeFileSync(configPath, JSON.stringify(nextConfig, null, 2), "utf8");
};

const resolveStorageDirectory = async (): Promise<string> => {
  const cfg = readConfig();
  if (cfg.dataDirectory && fs.existsSync(cfg.dataDirectory)) {
    return cfg.dataDirectory;
  }

  const suggested = path.join(app.getPath("appData"), "DesktopPlanWidgetData");
  const selection = await dialog.showOpenDialog({
    title: "Select storage folder for Desktop Plan Widget data",
    defaultPath: suggested,
    properties: ["openDirectory", "createDirectory"]
  });

  const selectedPath = selection.canceled ? suggested : selection.filePaths[0] ?? suggested;
  fs.mkdirSync(selectedPath, { recursive: true });
  writeConfig({ ...cfg, dataDirectory: selectedPath });
  return selectedPath;
};

const getDataFilePath = async () => {
  const dataDir = await resolveStorageDirectory();
  return path.join(dataDir, "app-data.json");
};

const readStoredAppData = async (): Promise<StoredAppData> => {
  const filePath = await getDataFilePath();
  const cfg = readConfig();
  const storagePath = cfg.dataDirectory ?? path.dirname(filePath);
  const fallback = defaultStoredData(storagePath);
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf8");
      return fallback;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoredAppData> & { analyticsEvents?: unknown[] };
    const migratedResponses =
      parsed.completionResponses ??
      (Array.isArray(parsed.analyticsEvents)
        ? []
        : []);
    return {
      ...fallback,
      ...parsed,
      completionResponses: Array.isArray(migratedResponses) ? migratedResponses : [],
      settings: { ...fallback.settings, ...parsed.settings, storagePath }
    };
  } catch {
    return fallback;
  }
};

const writeStoredAppData = async (nextData: StoredAppData): Promise<void> => {
  const filePath = await getDataFilePath();
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(nextData, null, 2), "utf8");
  fs.renameSync(tempPath, filePath);
};

const getDefaultWidgetBounds = (): WindowBounds => {
  const fallback: WindowBounds = { width: FIXED_WIDGET_SIZE.width, height: FIXED_WIDGET_SIZE.height, x: 0, y: 0 };
  const primary = screen.getPrimaryDisplay().workArea;
  const width = Math.min(fallback.width, primary.width);
  const height = Math.min(fallback.height, primary.height);
  return {
    width,
    height,
    // Default to top-right corner for desktop widget behavior.
    x: primary.x + Math.max(0, primary.width - width - 24),
    y: primary.y + 24
  };
};

const createMainWindow = (): void => {
  const cfg = readConfig();
  const defaults = getDefaultWidgetBounds();
  const bounds: WindowBounds = {
    width: FIXED_WIDGET_SIZE.width,
    height: FIXED_WIDGET_SIZE.height,
    x: cfg.bounds?.x ?? defaults.x,
    y: cfg.bounds?.y ?? defaults.y
  };
  mainWindow = new BrowserWindow({
    ...bounds,
    show: true,
    minWidth: FIXED_WIDGET_SIZE.width,
    minHeight: FIXED_WIDGET_SIZE.height,
    width: FIXED_WIDGET_SIZE.width,
    height: FIXED_WIDGET_SIZE.height,
    maxWidth: FIXED_WIDGET_SIZE.width,
    maxHeight: FIXED_WIDGET_SIZE.height,
    frame: false,
    transparent: true,
    title: "Desktop Plan Widget",
    autoHideMenuBar: true,
    backgroundColor: "#00000000",
    roundedCorners: true,
    hasShadow: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: cfg.pinned,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow) return;
    mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.once("did-finish-load", () => {
    if (!mainWindow) return;
    mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.on("did-fail-load", () => {
    if (!mainWindow) return;
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  const persistPosition = () => {
    if (!mainWindow) return;
    const cfg = readConfig();
    const position = mainWindow.getPosition();
    writeConfig({
      ...cfg,
      bounds: {
        width: FIXED_WIDGET_SIZE.width,
        height: FIXED_WIDGET_SIZE.height,
        x: position[0],
        y: position[1]
      }
    });
  };

  mainWindow.on("move", persistPosition);

  if (cfg.pinned) {
    mainWindow.setAlwaysOnTop(true, "screen-saver");
  }
};

const setupIpc = (): void => {
  ipcMain.handle("window:set-pinned", (_event, pinned: boolean) => {
    if (!mainWindow) return;
    mainWindow.setAlwaysOnTop(pinned, "screen-saver");

    const cfg = readConfig();
    writeConfig({ ...cfg, pinned });
  });

  ipcMain.handle("window:get-config", () => readConfig());

  ipcMain.handle("window:set-launch-on-startup", (_event, launchOnStartup: boolean) => {
    app.setLoginItemSettings({ openAtLogin: launchOnStartup });
    const cfg = readConfig();
    writeConfig({ ...cfg, launchOnStartup });
  });

  ipcMain.on(
    "notifications:show",
    (_event, payload: { title: string; body: string; silent?: boolean }) => {
      if (!Notification.isSupported()) {
        return;
      }

      const notice = new Notification({
        title: payload.title,
        body: payload.body,
        silent: payload.silent ?? false
      });
      notice.show();

      notice.on("click", () => {
        if (!mainWindow) return;
        mainWindow.show();
        mainWindow.focus();
      });
    }
  );

  ipcMain.handle("data:load", async () => readStoredAppData());
  ipcMain.handle("data:save", async (_event, payload: StoredAppData) => {
    await writeStoredAppData(payload);
  });
  ipcMain.handle("data:get-storage-info", async () => {
    const storagePath = await resolveStorageDirectory();
    return { storagePath };
  });
  ipcMain.handle("sound:get-ping-path", () => ({ path: resolvePingSoundPath() }));
  ipcMain.handle("sound:play-system-beep", () => {
    shell.beep();
  });
};

app.whenReady().then(async () => {
  ensureSessionDataPath();
  await resolveStorageDirectory();
  await readStoredAppData();
  const cfg = readConfig();

  app.setLoginItemSettings({
    openAtLogin: cfg.launchOnStartup
  });

  createMainWindow();
  setupIpc();

  if (cfg.pinned && mainWindow) {
    mainWindow.setAlwaysOnTop(true, "screen-saver");
  }
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
