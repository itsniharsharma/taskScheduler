import type { AppData } from "../types/appData";
import type { DiaryTask } from "../types/task";

const LEGACY_TASKS_KEY = "desktop-plan-widget::tasks";

const defaultAppData = (storagePath = ""): AppData => ({
  version: 1,
  tasks: [],
  notesByDate: {},
  completionResponses: [],
  settings: {
    storagePath,
    initializedAt: new Date().toISOString()
  }
});

const loadLegacyTasks = (): DiaryTask[] => {
  try {
    const raw = window.localStorage.getItem(LEGACY_TASKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DiaryTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const loadAppData = async (): Promise<AppData> => {
  try {
    const storageInfo = await window.desktopWidget.getStorageInfo();
    const loaded = await window.desktopWidget.loadAppData();
    const normalized: AppData = {
      ...defaultAppData(storageInfo.storagePath),
      ...loaded,
      settings: {
        ...defaultAppData(storageInfo.storagePath).settings,
        ...loaded.settings,
        storagePath: storageInfo.storagePath
      }
    };
    if (!normalized.tasks.length) {
      const legacy = loadLegacyTasks();
      if (legacy.length) {
        normalized.tasks = legacy;
      }
    }
    return normalized;
  } catch {
    return defaultAppData("");
  }
};

export const saveAppData = async (data: AppData): Promise<void> => {
  await window.desktopWidget.saveAppData(data);
};
