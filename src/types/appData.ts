import type { DiaryTask } from "./task";

export type CompletionResponse = {
  id: string;
  taskId: string;
  scheduledDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  response: "YES" | "NO";
  respondedAt: string;
};

export type DayNote = {
  content: string;
  updatedAt: string;
};

export type AppData = {
  version: 1;
  tasks: DiaryTask[];
  notesByDate: Record<string, DayNote>;
  completionResponses: CompletionResponse[];
  settings: {
    storagePath: string;
    initializedAt: string;
    pingOnReminder: boolean;
    pingOnCompletion: boolean;
  };
};
