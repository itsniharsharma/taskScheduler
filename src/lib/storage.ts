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
    initializedAt: new Date().toISOString(),
    pingOnReminder: true,
    pingOnCompletion: true
  }
});

const normalizeTask = (task: DiaryTask): DiaryTask => ({
  ...task,
  reminderLead: task.reminderLead ?? "none",
  status: task.status ?? "pending",
  createdAt: task.createdAt ?? new Date().toISOString(),
  updatedAt: task.updatedAt ?? new Date().toISOString()
});

const normalizeAppData = (input: AppData, storagePath: string): AppData => {
  const safeTasks = Array.isArray(input.tasks) ? input.tasks.map(normalizeTask) : [];
  const safeNotes = input.notesByDate && typeof input.notesByDate === "object" ? input.notesByDate : {};
  const safeResponses = Array.isArray(input.completionResponses) ? input.completionResponses : [];
  return {
    ...defaultAppData(storagePath),
    ...input,
    tasks: safeTasks,
    notesByDate: safeNotes,
    completionResponses: safeResponses,
    settings: {
      ...defaultAppData(storagePath).settings,
      ...input.settings,
      storagePath
    }
  };
};

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
    const normalized = normalizeAppData(loaded, storageInfo.storagePath);
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
  await window.desktopWidget.saveAppData(
    normalizeAppData(data, data.settings?.storagePath ?? "")
  );
};
