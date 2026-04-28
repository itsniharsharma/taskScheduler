import type { DiaryTask } from "../types/task";

const STORAGE_KEY = "desktop-plan-widget::tasks";

export const loadTasks = (): DiaryTask[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DiaryTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveTasks = (tasks: DiaryTask[]): void => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
};
