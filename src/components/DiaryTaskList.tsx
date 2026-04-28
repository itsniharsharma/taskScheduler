import { useMemo } from "react";
import { toMinutes } from "../lib/productivity";
import type { DiaryTask } from "../types/task";

type DiaryTaskListProps = {
  tasks: DiaryTask[];
  now: Date;
  onDelete: (taskId: string) => void;
  onUpdate: (taskId: string) => void;
};

const isScheduled = (task: DiaryTask) => Boolean(task.startTime && task.endTime);

export const DiaryTaskList = ({ tasks, now, onDelete, onUpdate }: DiaryTaskListProps) => {
  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (!a.startTime && b.startTime) return -1;
        if (a.startTime && !b.startTime) return 1;
        if (!a.startTime || !b.startTime) return a.createdAt.localeCompare(b.createdAt);
        return toMinutes(a.startTime) - toMinutes(b.startTime);
      }),
    [tasks]
  );
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <ul className="diary-task-list">
      {sorted.map((task) => {
        const urgent =
          isScheduled(task) &&
          task.endTime &&
          nowMinutes > toMinutes(task.endTime) - 20 &&
          nowMinutes < toMinutes(task.endTime);
        const active =
          isScheduled(task) &&
          task.startTime &&
          task.endTime &&
          nowMinutes >= toMinutes(task.startTime) &&
          nowMinutes <= toMinutes(task.endTime);

        return (
          <li
            key={task.id}
            className={`diary-task-item ${task.status === "completed" ? "diary-task-item-completed" : ""} ${active ? "diary-task-item-active" : ""} ${urgent ? "diary-task-item-urgent" : ""}`}
          >
            <div className="diary-task-main">
              <p className="diary-task-title">{task.title}</p>
            </div>

            <div className="diary-task-controls">
              <button type="button" onClick={() => onUpdate(task.id)} className="diary-update">
                Update
              </button>
              <button type="button" onClick={() => onDelete(task.id)} className="diary-delete">
                Delete
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
