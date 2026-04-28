export type ReminderLead = "none" | "5m" | "10m" | "15m" | "30m" | "1h";

export type DiaryTask = {
  id: string;
  title: string;
  color?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  reminderLead: ReminderLead;
  alertLeadMinutes?: number;
  alarmEnabled?: boolean;
  status?: "pending" | "completed";
  completedAt?: string;
  reminderSent?: boolean;
  dueSent?: boolean;
  duePromptedAt?: string;
  createdAt: string;
  updatedAt: string;
};
