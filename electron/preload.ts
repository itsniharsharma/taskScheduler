import { contextBridge, ipcRenderer } from "electron";

type Config = {
  pinned: boolean;
  launchOnStartup: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
};

const api = {
  setPinned: (pinned: boolean) => ipcRenderer.invoke("window:set-pinned", pinned),
  getConfig: () => ipcRenderer.invoke("window:get-config") as Promise<Config>,
  setLaunchOnStartup: (enabled: boolean) =>
    ipcRenderer.invoke("window:set-launch-on-startup", enabled),
  showNotification: (payload: { title: string; body: string; silent?: boolean }) =>
    ipcRenderer.send("notifications:show", payload)
};

contextBridge.exposeInMainWorld("desktopWidget", api);
