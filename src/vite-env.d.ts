import type { AppData } from "./types/appData";

declare global {
  interface Window {
    desktopWidget: {
      setPinned: (pinned: boolean) => Promise<void>;
      getConfig: () => Promise<{
        pinned: boolean;
        launchOnStartup: boolean;
        bounds?: { x: number; y: number; width: number; height: number };
      }>;
      setLaunchOnStartup: (enabled: boolean) => Promise<void>;
      showNotification: (payload: { title: string; body: string; silent?: boolean }) => void;
      loadAppData: () => Promise<AppData>;
      saveAppData: (data: AppData) => Promise<void>;
      getStorageInfo: () => Promise<{ storagePath: string }>;
    };
  }
}

export {};
