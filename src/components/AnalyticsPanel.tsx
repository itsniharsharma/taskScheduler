import { useMemo, useState } from "react";
import {
  buildTrend,
  computeCompletionBreakdown,
  computeProductivityDelta,
  filterResponsesByRange,
  getRangeStart,
  type AnalyticsRange
} from "../lib/analytics";
import type { CompletionResponse } from "../types/appData";

type AnalyticsPanelProps = {
  responses: CompletionResponse[];
  now: Date;
};

const ranges: Array<{ id: AnalyticsRange; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "3months", label: "3 Months" },
  { id: "year", label: "Year" }
];

const pieStyle = (completed: number, missed: number, incomplete: number) =>
  `conic-gradient(#5ba391 0 ${completed}%, #b65a65 ${completed}% ${completed + missed}%, #636a78 ${completed + missed}% ${completed + missed + incomplete}%)`;

export const AnalyticsPanel = ({ responses, now }: AnalyticsPanelProps) => {
  const [range, setRange] = useState<AnalyticsRange>("week");
  const filtered = useMemo(() => filterResponsesByRange(responses, range, now), [responses, range, now]);
  const completion = useMemo(() => computeCompletionBreakdown(filtered), [filtered]);
  const productivityDelta = useMemo(() => {
    const appStart = responses.length
      ? new Date(Math.min(...responses.map((response) => new Date(response.respondedAt).getTime())))
      : now;
    return computeProductivityDelta(filtered, responses.filter((response) => new Date(response.respondedAt) >= appStart));
  }, [filtered, now, responses]);
  const trend = useMemo(() => buildTrend(filtered, range), [filtered, range]);
  const maxMagnitude = Math.max(10, ...trend.map((point) => point.value));
  const weekly = useMemo(() => computeCompletionBreakdown(filterResponsesByRange(responses, "week", now)), [responses, now]);
  const monthly = useMemo(() => computeCompletionBreakdown(filterResponsesByRange(responses, "month", now)), [responses, now]);
  const yearly = useMemo(() => computeCompletionBreakdown(filterResponsesByRange(responses, "year", now)), [responses, now]);

  const periodDelta = useMemo(() => {
    const thisMonthStart = getRangeStart("month", now).getTime();
    const prevMonthStart = getRangeStart("3months", now).getTime();
    const currentMonth = responses.filter((response) => new Date(response.respondedAt).getTime() >= thisMonthStart);
    const previousRange = responses.filter((response) => {
      const ts = new Date(response.respondedAt).getTime();
      return ts >= prevMonthStart && ts < thisMonthStart;
    });
    return computeProductivityDelta(currentMonth, previousRange);
  }, [responses, now]);

  return (
    <section className="analytics-shell">
      <header className="analytics-header">
        <h3>Analytics</h3>
        <div className="analytics-range-row">
          {ranges.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`analytics-range-btn ${range === item.id ? "analytics-range-btn-active" : ""}`}
              onClick={() => setRange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="analytics-grid">
        <article className="analytics-card">
          <p className="analytics-card-title">Completion Pie</p>
          <div className="analytics-pie" style={{ background: pieStyle(completion.completedPct, completion.missedPct, completion.incompletePct) }} />
          <p className="analytics-card-caption">
            Completed {completion.completedPct}% · Missed {completion.missedPct}% · Incomplete {completion.incompletePct}%
          </p>
        </article>

        <article className="analytics-card">
          <p className="analytics-card-title">Productivity Delta</p>
          <p className={`analytics-score ${productivityDelta >= 0 ? "analytics-score-positive" : "analytics-score-negative"}`}>
            {productivityDelta >= 0 ? "+" : ""}
            {productivityDelta}%
          </p>
          <p className="analytics-card-caption">Overall trend since first app use</p>
        </article>

        <article className="analytics-card analytics-card-wide">
          <p className="analytics-card-title">Productivity Trend</p>
          <div className="analytics-line-chart">
            {trend.length ? (
              trend.map((point) => (
                <div key={point.label} className="analytics-line-item">
                  <div
                    className="analytics-line-bar analytics-line-bar-positive"
                    style={{ height: `${Math.max(6, (point.value / maxMagnitude) * 84)}px` }}
                    title={`${point.label}: ${point.value}`}
                  />
                  <span>{point.label}</span>
                </div>
              ))
            ) : (
              <p className="analytics-card-caption">No activity in selected range yet.</p>
            )}
          </div>
        </article>

        <article className="analytics-card analytics-card-wide">
          <p className="analytics-card-title">Weekly / Monthly / Yearly Breakdown</p>
          <p className="analytics-card-caption">
            Week: {weekly.completedPct}% complete · Month: {monthly.completedPct}% complete · Year: {yearly.completedPct}% complete
          </p>
          <p className="analytics-card-caption">
            Trend change: {periodDelta >= 0 ? "+" : ""}
            {periodDelta}% vs previous period
          </p>
        </article>
      </div>
    </section>
  );
};
