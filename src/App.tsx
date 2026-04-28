import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO, subMinutes } from "date-fns";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { DiaryTaskList } from "./components/DiaryTaskList";
import { NotesPanel } from "./components/NotesPanel";
import { SchedulingPanel } from "./components/SchedulingPanel";
import { TaskComposer } from "./components/TaskComposer";
import { TimeWheel } from "./components/TimeWheel";
import {
  getDiaryHeading,
  getTodayKey,
  to12HourTime,
  toHHMM,
  toMinutes
} from "./lib/productivity";
import { loadAppData, saveAppData } from "./lib/storage";
import type { AppData, CompletionResponse } from "./types/appData";
import type { DiaryTask, ReminderLead } from "./types/task";

const reminderLeadMinutes: Record<ReminderLead, number> = {
  none: 0,
  "5m": 5,
  "10m": 10,
  "15m": 15,
  "30m": 30,
  "1h": 60
};

const premiumColors = ["#F2EFE7", "#9EB9D8", "#4B8A74", "#B89B5A", "#B64A5A", "#8C79B8", "#2E8C8A"];

const pickTaskColor = (existingColors: string[]): string => {
  const normalized = new Set(existingColors.filter(Boolean).map((c) => c.toUpperCase()));
  const unused = premiumColors.find((color) => !normalized.has(color.toUpperCase()));
  if (unused) return unused;

  const golden = 137.50776405003785;
  for (let i = 0; i < 48; i += 1) {
    const hue = (i * golden) % 360;
    const color = `hsl(${Math.round(hue)} 44% 58%)`;
    if (!normalized.has(color.toUpperCase())) return color;
  }
  return premiumColors[Math.floor(Math.random() * premiumColors.length)];
};

const assignScheduledTaskColors = (inputTasks: DiaryTask[]): DiaryTask[] => {
  const seenUpper = new Set<string>();
  let changed = false;

  const next = inputTasks.map((task) => {
    if (!task.startTime || !task.endTime) {
      return task;
    }

    const currentColor = task.color?.trim();
    const hasValidUniqueColor = Boolean(currentColor) && !seenUpper.has(currentColor!.toUpperCase());
    if (hasValidUniqueColor) {
      seenUpper.add(currentColor!.toUpperCase());
      return task;
    }

    const color = pickTaskColor([...seenUpper]);
    seenUpper.add(color.toUpperCase());
    changed = true;
    return { ...task, color };
  });

  return changed ? next : inputTasks;
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const isScheduled = (task: DiaryTask) => Boolean(task.startTime && task.endTime);
type SectionTab = "diary" | "notes" | "analytics";
const minScheduleDuration = 10;

const App = () => {
  const [tasks, setTasks] = useState<DiaryTask[]>([]);
  const [notesByDate, setNotesByDate] = useState<AppData["notesByDate"]>({});
  const [completionResponses, setCompletionResponses] = useState<CompletionResponse[]>([]);
  const [storagePath, setStoragePath] = useState("");
  const [initializedAt, setInitializedAt] = useState(() => new Date().toISOString());
  const [pingOnReminder, setPingOnReminder] = useState(true);
  const [pingOnCompletion, setPingOnCompletion] = useState(true);
  const [activeTab, setActiveTab] = useState<SectionTab>("diary");
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState(getTodayKey());
  const [now, setNow] = useState(new Date());
  const [pageFlip, setPageFlip] = useState(false);
  const [duePromptTaskId, setDuePromptTaskId] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [activeScheduleTaskId, setActiveScheduleTaskId] = useState<string | null>(null);
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [scheduleAnchorMinutes, setScheduleAnchorMinutes] = useState<number | null>(null);
  const [scheduleDraftEndMinutes, setScheduleDraftEndMinutes] = useState<number | null>(null);
  const [scheduleReminderLead, setScheduleReminderLead] = useState<ReminderLead>("15m");
  const [noteDraft, setNoteDraft] = useState("");
  const previousDayRef = useRef(selectedDayKey);
  const noteAutosaveTimer = useRef<number | null>(null);
  const persistTimer = useRef<number | null>(null);
  const lastPersistedSnapshot = useRef("");
  const pingAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void (async () => {
      const data = await loadAppData();
      setTasks(assignScheduledTaskColors(data.tasks));
      setNotesByDate(data.notesByDate);
      setCompletionResponses(data.completionResponses ?? []);
      setStoragePath(data.settings.storagePath);
      setInitializedAt(data.settings.initializedAt ?? new Date().toISOString());
      setPingOnReminder(data.settings.pingOnReminder ?? true);
      setPingOnCompletion(data.settings.pingOnCompletion ?? true);
      const pingMeta = await window.desktopWidget.getPingSoundPath();
      if (pingMeta.path) {
        const src = `file:///${pingMeta.path.replace(/\\/g, "/")}`;
        pingAudioRef.current = new Audio(src);
      }
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    setNoteDraft(notesByDate[selectedDayKey]?.content ?? "");
  }, [notesByDate, selectedDayKey]);

  useEffect(() => {
    if (!hydrated) return;
    if (noteAutosaveTimer.current) {
      window.clearTimeout(noteAutosaveTimer.current);
    }
    noteAutosaveTimer.current = window.setTimeout(() => {
      setNotesByDate((prev) => {
        const existing = prev[selectedDayKey];
        if ((existing?.content ?? "") === noteDraft) return prev;
        return {
          ...prev,
          [selectedDayKey]: {
            content: noteDraft,
            updatedAt: new Date().toISOString()
          }
        };
      });
    }, 260);
    return () => {
      if (noteAutosaveTimer.current) {
        window.clearTimeout(noteAutosaveTimer.current);
      }
    };
  }, [hydrated, noteDraft, selectedDayKey]);

  useEffect(() => {
    if (!hydrated) return;
    const payload: AppData = {
      version: 1,
      tasks,
      notesByDate,
      completionResponses,
      settings: {
        storagePath,
        initializedAt,
        pingOnReminder,
        pingOnCompletion
      }
    };
    const snapshot = JSON.stringify(payload);
    if (snapshot === lastPersistedSnapshot.current) return;

    if (persistTimer.current) {
      window.clearTimeout(persistTimer.current);
    }
    persistTimer.current = window.setTimeout(() => {
      lastPersistedSnapshot.current = snapshot;
      void saveAppData(payload);
    }, 180);

    return () => {
      if (persistTimer.current) {
        window.clearTimeout(persistTimer.current);
      }
    };
  }, [completionResponses, hydrated, initializedAt, notesByDate, pingOnCompletion, pingOnReminder, storagePath, tasks]);

  const playPing = () => {
    const audio = pingAudioRef.current;
    if (!audio) {
      void window.desktopWidget.playSystemBeep();
      return;
    }
    audio.currentTime = 0;
    void audio.play().catch(() => {
      void window.desktopWidget.playSystemBeep();
    });
  };

  const syncTasks = (updater: (prev: DiaryTask[]) => DiaryTask[]) =>
    setTasks((prev) => assignScheduledTaskColors(updater(prev)));

  const recordCompletionResponse = (task: DiaryTask, response: "YES" | "NO") => {
    if (!task.startTime || !task.endTime) return;
    setCompletionResponses((prev) => [
      ...prev,
      {
        id: createId(),
        taskId: task.id,
        scheduledDate: task.date,
        scheduledStart: task.startTime,
        scheduledEnd: task.endTime,
        response,
        respondedAt: new Date().toISOString()
      }
    ]);
  };

  const triggerPageFlip = () => {
    setPageFlip(true);
    window.setTimeout(() => setPageFlip(false), 640);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextNow = new Date();
      const nextDay = format(nextNow, "yyyy-MM-dd");
      setNow(nextNow);

      if (nextDay !== previousDayRef.current) {
        previousDayRef.current = nextDay;
        setSelectedDayKey((prev) => (prev === getTodayKey() ? nextDay : prev));
        triggerPageFlip();
      }

      let changed = false;
      setTasks((prev) => {
        const next = prev.map((task) => {
          if (task.date !== nextDay || task.status === "completed" || !task.startTime || !task.endTime) {
            return task;
          }

          const [endH, endM] = task.endTime.split(":").map(Number);

          const endAt = new Date(nextNow);
          endAt.setHours(endH, endM, 0, 0);

          const remindMins =
            task.alertLeadMinutes ??
            (task.reminderLead ? reminderLeadMinutes[task.reminderLead] : 15);
          const remindAt = subMinutes(endAt, remindMins);

          let nextTask = task;

          if (!task.reminderSent && nextNow >= remindAt) {
            if (pingOnReminder) {
              playPing();
            }
            window.desktopWidget.showNotification({
              title: "Diary reminder",
              body: `${task.title} ends at ${to12HourTime(task.endTime)}`,
              silent: !task.alarmEnabled
            });
            nextTask = { ...nextTask, reminderSent: true, updatedAt: nextNow.toISOString() };
          }

          if (!nextTask.dueSent && nextNow >= endAt) {
            if (pingOnCompletion) {
              playPing();
            }
            window.desktopWidget.showNotification({
              title: "Time block ended",
              body: `${task.title} ended at ${to12HourTime(task.endTime)}`
            });
            nextTask = {
              ...nextTask,
              dueSent: true,
              duePromptedAt: nextNow.toISOString(),
              updatedAt: nextNow.toISOString()
            };
            setDuePromptTaskId(task.id);
          }

          if (nextTask !== task) changed = true;
          return nextTask;
        });

        if (changed) {
          return next;
        }
        return prev;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const dayTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.date === selectedDayKey)
        .sort((a, b) => {
          if (!a.startTime && b.startTime) return -1;
          if (a.startTime && !b.startTime) return 1;
          if (!a.startTime || !b.startTime) return a.createdAt.localeCompare(b.createdAt);
          return toMinutes(a.startTime) - toMinutes(b.startTime);
        }),
    [tasks, selectedDayKey]
  );

  const scheduledTasks = useMemo(() => dayTasks.filter((task) => isScheduled(task)), [dayTasks]);
  const unscheduledTasks = useMemo(
    () => dayTasks.filter((task) => !isScheduled(task) && task.status !== "completed"),
    [dayTasks]
  );

  const activeScheduleTask =
    dayTasks.find((task) => task.id === activeScheduleTaskId && task.status !== "completed") ?? null;

  const diaryDate = parseISO(selectedDayKey);
  const duePromptTask = tasks.find((task) => task.id === duePromptTaskId) ?? null;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const schedulingLowerBound = selectedDayKey === getTodayKey() ? nowMinutes : 0;

  const moveDay = (delta: number) => {
    const base = parseISO(selectedDayKey);
    const moved = new Date(base);
    moved.setDate(base.getDate() + delta);
    setSelectedDayKey(format(moved, "yyyy-MM-dd"));
    triggerPageFlip();
  };

  const setTaskAsActiveSchedule = (task: DiaryTask) => {
    const realtimeNow = new Date();
    const lowerBound =
      selectedDayKey === getTodayKey() ? realtimeNow.getHours() * 60 + realtimeNow.getMinutes() : 0;
    const hasSavedRange = Boolean(task.startTime && task.endTime);
    const rawAnchor = hasSavedRange ? toMinutes(task.startTime!) : lowerBound;
    const anchor = Math.max(lowerBound, rawAnchor);
    const rawEnd = hasSavedRange ? toMinutes(task.endTime!) : anchor;
    const draftEnd = hasSavedRange ? Math.max(anchor + minScheduleDuration, rawEnd) : anchor;
    setActiveScheduleTaskId(task.id);
    setScheduleAnchorMinutes(anchor);
    setScheduleDraftEndMinutes(draftEnd);
    setScheduleReminderLead(task.reminderLead ?? "15m");
    setAlarmEnabled(task.alarmEnabled ?? false);
  };

  const openScheduleMode = () => {
    setScheduleMode(true);
    const first = unscheduledTasks[0] ?? null;
    if (first) {
      setTaskAsActiveSchedule(first);
    }
  };

  const saveActiveSchedule = () => {
    if (!activeScheduleTaskId || scheduleAnchorMinutes === null || scheduleDraftEndMinutes === null) return;
    const safeStart = Math.max(schedulingLowerBound, scheduleAnchorMinutes);
    const safeEnd = Math.max(safeStart + minScheduleDuration, scheduleDraftEndMinutes);

    const alertLeadMinutes =
      scheduleReminderLead === "none" ? 0 : reminderLeadMinutes[scheduleReminderLead];

    syncTasks((prev) =>
      prev.map((task) =>
        task.id === activeScheduleTaskId
          ? {
              ...task,
              startTime: toHHMM(safeStart),
              endTime: toHHMM(Math.min(1439, safeEnd)),
              color: task.color ?? pickTaskColor(prev.map((item) => item.color ?? "")),
              reminderLead: scheduleReminderLead,
              alertLeadMinutes,
              alarmEnabled,
              reminderSent: false,
              dueSent: false,
              updatedAt: new Date().toISOString()
            }
          : task
      )
    );

    // After save, return to diary view directly.
    setScheduleMode(false);
    setActiveScheduleTaskId(null);
    setScheduleAnchorMinutes(null);
    setScheduleDraftEndMinutes(null);
  };

  return (
    <main className="widget-shell diary-shell">
      <div className="widget-drag-strip drag-region" />
      <div className="top-nav-shell">
        <div className="top-section-tabs top-section-tabs-header">
        <button
          type="button"
          className={`top-section-tab ${activeTab === "diary" ? "top-section-tab-active" : ""}`}
          onClick={() => setActiveTab("diary")}
        >
          Diary
        </button>
        <button
          type="button"
          className={`top-section-tab ${activeTab === "notes" ? "top-section-tab-active" : ""}`}
          onClick={() => {
            setScheduleMode(false);
            setActiveTab("notes");
          }}
        >
          Notes
        </button>
        <button
          type="button"
          className={`top-section-tab ${activeTab === "analytics" ? "top-section-tab-active" : ""}`}
          onClick={() => {
            setScheduleMode(false);
            setActiveTab("analytics");
          }}
        >
          Analytics
        </button>
        </div>
        <button
          type="button"
          className="top-settings-btn"
          aria-label="Sound settings"
          onClick={() => setShowSoundSettings((prev) => !prev)}
        >
          ⚙
        </button>
        {showSoundSettings && (
          <div className="top-settings-popover">
            <label>
              <input
                type="checkbox"
                checked={pingOnReminder}
                onChange={(event) => setPingOnReminder(event.target.checked)}
              />
              Ping on reminder
            </label>
            <label>
              <input
                type="checkbox"
                checked={pingOnCompletion}
                onChange={(event) => setPingOnCompletion(event.target.checked)}
              />
              Ping on completion
            </label>
          </div>
        )}
      </div>
      <TimeWheel
        now={now}
        tasks={scheduledTasks}
        previewColor={activeScheduleTask?.color}
        scheduleMode={scheduleMode && Boolean(activeScheduleTask)}
        scheduleAnchorMinutes={scheduleAnchorMinutes ?? undefined}
        scheduleDraftEndMinutes={scheduleDraftEndMinutes ?? undefined}
        minScheduleMinutes={schedulingLowerBound}
        onDraftStartChange={(nextStart) =>
          setScheduleAnchorMinutes(Math.max(schedulingLowerBound, nextStart))
        }
        onDraftEndChange={(nextEnd) =>
          setScheduleDraftEndMinutes(() => {
            const anchor = scheduleAnchorMinutes ?? schedulingLowerBound;
            return Math.max(anchor + minScheduleDuration, nextEnd);
          })
        }
        onDraftRangeChange={(startMinutes, endMinutes) => {
          const clampedStart = Math.max(schedulingLowerBound, startMinutes);
          setScheduleAnchorMinutes(clampedStart);
          setScheduleDraftEndMinutes(Math.max(clampedStart + minScheduleDuration, endMinutes));
        }}
      />

      <section className="diary-page">
        <div className={`page-frame ${pageFlip ? "page-flip" : ""}`}>
          <header className="diary-heading">
            <div className="diary-nav-row">
              <button type="button" className="diary-nav-btn" onClick={() => moveDay(-1)}>
                Prev
              </button>
              <h1 className="diary-date-title">{getDiaryHeading(diaryDate)}</h1>
              <button type="button" className="diary-nav-btn" onClick={() => moveDay(1)}>
                Next
              </button>
            </div>
          </header>

          {activeTab === "diary" && scheduleMode ? (
            <SchedulingPanel
              unscheduledTasks={unscheduledTasks}
              activeTask={activeScheduleTask}
              activeTaskId={activeScheduleTaskId}
              startMinutes={scheduleAnchorMinutes}
              endMinutes={scheduleDraftEndMinutes}
              reminderLead={scheduleReminderLead}
              alarmEnabled={alarmEnabled}
              onSelectTask={setTaskAsActiveSchedule}
              onReminderLeadChange={setScheduleReminderLead}
              onAlarmEnabledChange={setAlarmEnabled}
              onSave={saveActiveSchedule}
              onBackToDiary={() => {
                setScheduleMode(false);
                setActiveScheduleTaskId(null);
                setScheduleAnchorMinutes(null);
                setScheduleDraftEndMinutes(null);
              }}
            />
          ) : activeTab === "diary" ? (
            <>
              <TaskComposer
                date={selectedDayKey}
                onCreateTask={(input) => {
                  const timestamp = new Date().toISOString();
                  const newTask: DiaryTask = {
                    id: createId(),
                    createdAt: timestamp,
                    updatedAt: timestamp,
                    status: "pending",
                    reminderLead: "none",
                    alertLeadMinutes: 15,
                    alarmEnabled: false,
                    reminderSent: false,
                    dueSent: false,
                    ...input
                  };
                  syncTasks((prev) => [
                    ...prev,
                    newTask
                  ]);
                }}
              />

              <div className="planner-actions">
                <button
                  type="button"
                  className="primary-cta"
                  onClick={openScheduleMode}
                  disabled={!unscheduledTasks.length}
                >
                  Plan / Schedule Day
                </button>
              </div>

              <div className="task-scroll-wrap">
                <DiaryTaskList
                  tasks={dayTasks}
                  now={now}
                  onUpdate={(taskId) => {
                    const target = dayTasks.find((task) => task.id === taskId);
                    if (!target || target.status === "completed") return;
                    setScheduleMode(true);
                    setTaskAsActiveSchedule(target);
                  }}
                  onDelete={(taskId) => {
                    syncTasks((prev) => prev.filter((task) => task.id !== taskId));
                  }}
                />
              </div>
            </>
          ) : activeTab === "notes" ? (
            <NotesPanel dateLabel={getDiaryHeading(diaryDate)} value={noteDraft} onChange={setNoteDraft} />
          ) : (
            <AnalyticsPanel responses={completionResponses} now={now} />
          )}
          {activeTab === "diary" && (
            <p className="diary-archive-note">Capture first. Enter schedule mode to map tasks onto your day.</p>
          )}
        </div>
      </section>

      {duePromptTask && duePromptTask.status !== "completed" && duePromptTask.endTime && (
        <section className="due-modal-overlay">
          <div className="due-modal">
            <h3>Did you complete this task?</h3>
            <p className="due-modal-task">{duePromptTask.title}</p>
            <div className="due-modal-row">
              <button
                type="button"
                className="due-btn due-btn-primary"
                onClick={() => {
                  syncTasks((prev) =>
                    prev.map((task) =>
                      task.id === duePromptTask.id
                        ? {
                            ...task,
                            status: "completed",
                            completedAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                          }
                        : task
                    )
                  );
                  recordCompletionResponse(duePromptTask, "YES");
                  setDuePromptTaskId(null);
                }}
              >
                Yes, Completed
              </button>
              <button
                type="button"
                className="due-btn"
                onClick={() => {
                  recordCompletionResponse(duePromptTask, "NO");
                  setDuePromptTaskId(null);
                }}
              >
                No
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
};

export default App;
