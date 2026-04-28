import { useState } from "react";
import type { DiaryTask } from "../types/task";

type ComposerInput = Pick<DiaryTask, "date" | "title">;

type TaskComposerProps = {
  date: string;
  onCreateTask: (input: ComposerInput) => void;
};

export const TaskComposer = ({ date, onCreateTask }: TaskComposerProps) => {
  const [title, setTitle] = useState("");

  return (
    <form
      className="composer-shell"
      onSubmit={(event) => {
        event.preventDefault();
        const clean = title.trim();
        if (!clean) return;
        onCreateTask({ date, title: clean });
        setTitle("");
      }}
    >
      <div className="composer-row composer-title-row">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="composer-input"
          placeholder="Capture a task for this day"
        />
        <button type="submit" className="composer-save">
          Add Task
        </button>
      </div>
    </form>
  );
};
