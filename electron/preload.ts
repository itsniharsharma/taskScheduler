import { contextBridge, ipcRenderer } from "electron";

type Config = {
  pinned: boolean;
  launchOnStartup: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
};

type AppData = {
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
  analyticsEvents?: unknown[];
  settings: {
    storagePath: string;
    initializedAt: string;
  };
};

const api = {
  setPinned: (pinned: boolean) => ipcRenderer.invoke("window:set-pinned", pinned),
  getConfig: () => ipcRenderer.invoke("window:get-config") as Promise<Config>,
  setLaunchOnStartup: (enabled: boolean) =>
    ipcRenderer.invoke("window:set-launch-on-startup", enabled),
  showNotification: (payload: { title: string; body: string; silent?: boolean }) =>
    ipcRenderer.send("notifications:show", payload),
  loadAppData: () => ipcRenderer.invoke("data:load") as Promise<AppData>,
  saveAppData: (data: AppData) => ipcRenderer.invoke("data:save", data),
  getStorageInfo: () => ipcRenderer.invoke("data:get-storage-info") as Promise<{ storagePath: string }>
};

contextBridge.exposeInMainWorld("desktopWidget", api);
