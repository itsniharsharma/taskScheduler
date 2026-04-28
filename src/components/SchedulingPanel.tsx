import { minutesTo12HourTime } from "../lib/productivity";
import type { DiaryTask, ReminderLead } from "../types/task";

type SchedulingPanelProps = {
  unscheduledTasks: DiaryTask[];
  activeTask: DiaryTask | null;
  activeTaskId: string | null;
  startMinutes: number | null;
  endMinutes: number | null;
  reminderLead: ReminderLead;
  alarmEnabled: boolean;
  onSelectTask: (task: DiaryTask) => void;
  onReminderLeadChange: (lead: ReminderLead) => void;
  onAlarmEnabledChange: (enabled: boolean) => void;
  onSave: () => void;
  onBackToDiary: () => void;
};

export const SchedulingPanel = ({
  unscheduledTasks,
  activeTask,
  activeTaskId,
  startMinutes,
  endMinutes,
  reminderLead,
  alarmEnabled,
  onSelectTask,
  onReminderLeadChange,
  onAlarmEnabledChange,
  onSave,
  onBackToDiary
}: SchedulingPanelProps) => {
  const hasActiveRange = activeTask && startMinutes !== null && endMinutes !== null;

  return (
    <section className="schedule-panel">
      <header className="schedule-panel-header">
        <h3>Schedule Day</h3>
        <button type="button" className="diary-nav-btn" onClick={onBackToDiary}>
          Back to Diary
        </button>
      </header>

      <div className="schedule-panel-split">
        <aside className="schedule-pane-left">
          <p className="schedule-pane-title">Unscheduled tasks</p>
          <div className="schedule-task-list-scroll">
            {unscheduledTasks.length ? (
              unscheduledTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className={`schedule-task-row ${task.id === activeTaskId ? "schedule-task-row-active" : ""}`}
                  onClick={() => onSelectTask(task)}
                  title={task.title}
                >
                  {task.title}
                </button>
              ))
            ) : (
              <p className="schedule-pane-empty">All tasks are scheduled for this day.</p>
            )}
          </div>
        </aside>

        <section className="schedule-pane-right">
          {hasActiveRange ? (
            <>
              <div className="schedule-right-main">
                <p className="schedule-active-title">{activeTask.title}</p>
                <p className="schedule-preview-line">
                  Start: {minutesTo12HourTime(startMinutes)} - End: {minutesTo12HourTime(endMinutes)}
                </p>
                <div className="schedule-control-row">
                  <label className="schedule-control-group">
                    Reminder Lead
                    <select
                      value={reminderLead}
                      onChange={(event) => onReminderLeadChange(event.target.value as ReminderLead)}
                    >
                      <option value="5m">5 min before</option>
                      <option value="10m">10 min before</option>
                      <option value="15m">15 min before</option>
                      <option value="30m">30 min before</option>
                    </select>
                  </label>
                  <label className="schedule-alarm-toggle">
                    <input
                      type="checkbox"
                      checked={alarmEnabled}
                      onChange={(event) => onAlarmEnabledChange(event.target.checked)}
                    />
                    Alarm
                  </label>
                </div>
              </div>
              <div className="schedule-right-actions">
                <button type="button" className="primary-cta schedule-save-btn" onClick={onSave}>
                  Save Schedule
                </button>
              </div>
            </>
          ) : (
            <p className="schedule-pane-empty">Select an unscheduled task to begin planning.</p>
          )}
        </section>
      </div>
    </section>
  );
};
