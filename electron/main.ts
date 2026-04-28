import { app, BrowserWindow, ipcMain, Notification, screen } from "electron";
import path from "node:path";
import fs from "node:fs";

type WindowBounds = { x: number; y: number; width: number; height: number };

type AppConfig = {
  pinned: boolean;
  launchOnStartup: boolean;
  bounds?: WindowBounds;
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

const getCenteredBounds = (): WindowBounds => {
  const fallback: WindowBounds = { width: 420, height: 700, x: 0, y: 0 };
  const primary = screen.getPrimaryDisplay().workArea;
  const width = Math.max(360, Math.min(fallback.width, primary.width));
  const height = Math.max(540, Math.min(fallback.height, primary.height));
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
  const bounds = cfg.bounds ?? getCenteredBounds();
  mainWindow = new BrowserWindow({
    ...bounds,
    show: true,
    minWidth: 360,
    minHeight: 540,
    frame: false,
    transparent: true,
    title: "Desktop Plan Widget",
    autoHideMenuBar: true,
    backgroundColor: "#00000000",
    roundedCorners: true,
    hasShadow: true,
    resizable: true,
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

  const persistBounds = () => {
    if (!mainWindow) return;
    const cfg = readConfig();
    writeConfig({ ...cfg, bounds: mainWindow.getBounds() });
  };

  mainWindow.on("move", persistBounds);
  mainWindow.on("resize", persistBounds);

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
};

app.whenReady().then(() => {
  ensureSessionDataPath();
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
