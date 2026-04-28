import { format } from "date-fns";
import { useMemo, useRef, useState } from "react";
import { minutesTo12HourTime, toMinutes } from "../lib/productivity";
import type { DiaryTask } from "../types/task";

type TimeWheelProps = {
  now: Date;
  tasks: DiaryTask[];
  previewColor?: string;
  scheduleMode?: boolean;
  scheduleAnchorMinutes?: number;
  scheduleDraftEndMinutes?: number;
  onDraftStartChange?: (startMinutes: number) => void;
  onDraftEndChange?: (endMinutes: number) => void;
  onDraftRangeChange?: (startMinutes: number, endMinutes: number) => void;
};

type DragMode = "start" | "end" | "move" | null;

const size = 250;
const center = size / 2;
const dialRadius = 86;
const bezelInner = 102;
const bezelOuter = 112;
const fallbackColor = "#F2EFE7";

const polar = (angleDeg: number, r: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: center + r * Math.cos(rad), y: center + r * Math.sin(rad) };
};

const arcPath = (startDeg: number, endDeg: number, r: number) => {
  const start = polar(startDeg, r);
  const end = polar(endDeg, r);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const angleToMinutes12 = (angle: number) => {
  const normalized = (angle + 360) % 360;
  return Math.round((normalized / 360) * 720);
};

const normalizeDelta = (next: number, prev: number) => {
  let delta = next - prev;
  if (delta > 720) delta -= 1440;
  if (delta < -720) delta += 1440;
  return delta;
};

const minutes24ToAngle = (minutes: number) => ((minutes % 720) / 720) * 360;

const chooseClosestHalfDay = (target12: number, reference24: number) => {
  const optionA = target12;
  const optionB = target12 + 720;
  const distanceA = Math.abs(optionA - reference24);
  const distanceB = Math.abs(optionB - reference24);
  return distanceA <= distanceB ? optionA : optionB;
};

const arcAnglesFromDayMinutes = (startMinutes24: number, endMinutes24: number) => {
  const start = minutes24ToAngle(startMinutes24);
  let end = minutes24ToAngle(endMinutes24);
  if (end <= start) end += 360;
  return { start, end };
};

type ScheduledArc = {
  id: string;
  startMinutes: number;
  endMinutes: number;
  color: string;
};

const toScheduledArc = (task: DiaryTask): ScheduledArc | null => {
  if (!task.startTime || !task.endTime) return null;
  return {
    id: task.id,
    startMinutes: toMinutes(task.startTime),
    endMinutes: toMinutes(task.endTime),
    color: task.color ?? fallbackColor
  };
};

export const TimeWheel = ({
  now,
  tasks,
  previewColor,
  scheduleMode = false,
  scheduleAnchorMinutes,
  scheduleDraftEndMinutes,
  onDraftStartChange,
  onDraftEndChange,
  onDraftRangeChange
}: TimeWheelProps) => {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [lastPointerMinutes, setLastPointerMinutes] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const nowLabel = format(now, "hh:mm:ss");

  const scheduledArcs = useMemo(() => {
    return tasks
      .map(toScheduledArc)
      .filter((arc): arc is ScheduledArc => Boolean(arc))
      .sort((a, b) => {
        // Draw later deadlines first; earliest deadline is rendered last (on top).
        if (a.endMinutes !== b.endMinutes) return b.endMinutes - a.endMinutes;
        if (a.startMinutes !== b.startMinutes) return b.startMinutes - a.startMinutes;
        return a.id.localeCompare(b.id);
      });
  }, [tasks]);

  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const hourAngle = (hours + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  const handPath = (angle: number, length: number) => {
    const tip = polar(angle, length);
    return `M ${center} ${center} L ${tip.x} ${tip.y}`;
  };

  const previewEnabled =
    scheduleMode &&
    typeof scheduleAnchorMinutes === "number" &&
    typeof scheduleDraftEndMinutes === "number";

  const previewStart = previewEnabled ? scheduleAnchorMinutes : 0;
  const previewEnd = previewEnabled ? scheduleDraftEndMinutes : 0;

  const previewAngles = previewEnabled ? arcAnglesFromDayMinutes(previewStart, previewEnd) : null;
  const previewStartDeg = previewAngles?.start ?? 0;
  const previewEndDeg = previewAngles?.end ?? 0;
  const previewStartPoint = previewEnabled ? polar(previewStartDeg, bezelOuter - 10) : null;
  const previewEndPoint = previewEnabled ? polar(previewEndDeg, bezelOuter - 10) : null;

  const getPointerMinutes = (event: React.PointerEvent<SVGElement>, referenceMinutes24: number) => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const bounds = svg.getBoundingClientRect();
    const x = event.clientX - bounds.left - bounds.width / 2;
    const y = event.clientY - bounds.top - bounds.height / 2;
    const deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
    const target12 = angleToMinutes12(deg);
    return clamp(chooseClosestHalfDay(target12, referenceMinutes24), 0, 1439);
  };

  const endPointerInteraction = (event: React.PointerEvent<SVGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragMode(null);
    setLastPointerMinutes(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section className="timewheel-shell" aria-label="Executive analog planner clock">
      <svg ref={svgRef} viewBox={`0 0 ${size} ${size}`} className="timewheel-svg">
        <circle cx={center} cy={center} r={bezelOuter} className="watch-bezel" />
        <circle cx={center} cy={center} r={bezelInner} className="watch-bezel-inner" />
        <circle cx={center} cy={center} r={dialRadius} className="watch-dial" />

        {Array.from({ length: 60 }).map((_, i) => {
          const angle = i * 6;
          const outer = polar(angle, dialRadius - 2);
          const inner = polar(angle, i % 5 === 0 ? dialRadius - 11 : dialRadius - 7);
          return (
            <line
              key={i}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              className={i % 5 === 0 ? "watch-tick watch-tick-hour" : "watch-tick"}
            />
          );
        })}

        {scheduledArcs.map((arc) => {
          const { start: startDeg, end: endDeg } = arcAnglesFromDayMinutes(arc.startMinutes, arc.endMinutes);
          const angularSpan = endDeg - startDeg;
          const gapHalf = angularSpan > 2.2 ? 0.65 : 0;
          const adjustedStart = startDeg + gapHalf;
          const adjustedEnd = endDeg - gapHalf;

          return (
            <path
              key={arc.id}
              d={arcPath(adjustedStart, Math.max(adjustedStart + 1.25, adjustedEnd), bezelOuter - 4)}
              className="watch-task-arc"
              stroke={arc.color}
            />
          );
        })}

        {previewEnabled && (
          <>
            <path
              d={arcPath(previewStartDeg, Math.max(previewStartDeg + 2.5, previewEndDeg), bezelOuter - 10)}
              className={`watch-draft-arc ${dragMode ? "watch-draft-arc-dragging" : ""}`}
              stroke={previewColor ?? fallbackColor}
            />

            <path
              d={arcPath(previewStartDeg, Math.max(previewStartDeg + 2.5, previewEndDeg), bezelOuter - 10)}
              className="watch-drag-hit-arc"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const proposed = getPointerMinutes(event, previewStart);
                setDragMode("move");
                setLastPointerMinutes(proposed);
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (dragMode !== "move" || lastPointerMinutes === null) return;
                event.preventDefault();
                event.stopPropagation();
                const proposed = getPointerMinutes(event, lastPointerMinutes);
                const delta = normalizeDelta(proposed, lastPointerMinutes);
                const duration = previewEnd - previewStart;
                const nextStart = clamp(previewStart + delta, 0, 1439 - duration);
                const nextEnd = nextStart + duration;
                onDraftRangeChange?.(nextStart, nextEnd);
                setLastPointerMinutes(proposed);
              }}
              onPointerUp={endPointerInteraction}
              onPointerCancel={endPointerInteraction}
            />

            <circle
              cx={previewStartPoint!.x}
              cy={previewStartPoint!.y}
              r={5.2}
              className={`watch-handle ${dragMode === "start" ? "watch-handle-active" : ""}`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDragMode("start");
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (dragMode !== "start") return;
                event.preventDefault();
                event.stopPropagation();
                const proposed = getPointerMinutes(event, previewStart);
                onDraftStartChange?.(Math.min(proposed, previewEnd - 10));
              }}
              onPointerUp={endPointerInteraction}
              onPointerCancel={endPointerInteraction}
            />

            <circle
              cx={previewEndPoint!.x}
              cy={previewEndPoint!.y}
              r={5.2}
              className={`watch-handle ${dragMode === "end" ? "watch-handle-active" : ""}`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDragMode("end");
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (dragMode !== "end") return;
                event.preventDefault();
                event.stopPropagation();
                const proposed = getPointerMinutes(event, previewEnd);
                onDraftEndChange?.(Math.max(previewStart + 10, proposed));
              }}
              onPointerUp={endPointerInteraction}
              onPointerCancel={endPointerInteraction}
            />

            <text x={previewStartPoint!.x - 38} y={previewStartPoint!.y - 10} className="watch-preview-time">
              {minutesTo12HourTime(previewStart)}
            </text>
            <text x={previewEndPoint!.x + 9} y={previewEndPoint!.y - 8} className="watch-preview-time">
              {minutesTo12HourTime(previewEnd)}
            </text>
          </>
        )}

        <path d={handPath(hourAngle, 44)} className="watch-hand watch-hour-hand" />
        <path d={handPath(minuteAngle, 62)} className="watch-hand watch-minute-hand" />
        <path d={handPath(secondAngle, 74)} className="watch-hand watch-second-hand" />
        <circle cx={center} cy={center} r={4.5} className="watch-center" />
      </svg>

      <div className="timewheel-readout">
        <p className="timewheel-time">{nowLabel}</p>
        <p className="timewheel-title">{format(now, "EEEE, MMM d")}</p>
      </div>
    </section>
  );
};
