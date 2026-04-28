import { format, parseISO, startOfMonth, startOfWeek, startOfYear, subDays, subMonths } from "date-fns";
import type { CompletionResponse } from "../types/appData";

export type AnalyticsRange = "day" | "week" | "month" | "3months" | "year";

export type TrendPoint = {
  label: string;
  value: number;
};

export const getRangeStart = (range: AnalyticsRange, now: Date) => {
  if (range === "day") return subDays(now, 1);
  if (range === "week") return startOfWeek(now, { weekStartsOn: 1 });
  if (range === "month") return startOfMonth(now);
  if (range === "3months") return subMonths(now, 3);
  return startOfYear(now);
};

export const filterResponsesByRange = (responses: CompletionResponse[], range: AnalyticsRange, now: Date) => {
  const start = getRangeStart(range, now).getTime();
  const end = now.getTime();
  return responses.filter((response) => {
    const ts = parseISO(response.respondedAt).getTime();
    return ts >= start && ts <= end;
  });
};

export const computeCompletionBreakdown = (responses: CompletionResponse[]) => {
  const completed = responses.filter((response) => response.response === "YES").length;
  const missed = responses.filter((response) => response.response === "NO").length;
  const incomplete = 0;
  const total = completed + missed;
  if (total === 0) {
    return {
      completed,
      missed,
      incomplete,
      completedPct: 0,
      missedPct: 0,
      incompletePct: 0
    };
  }
  return {
    completed,
    missed,
    incomplete,
    completedPct: Math.round((completed / total) * 100),
    missedPct: Math.round((missed / total) * 100),
    incompletePct: 0
  };
};

export const computeProductivityDelta = (
  currentRangeResponses: CompletionResponse[],
  baselineResponses: CompletionResponse[]
) => {
  const currentTotal = currentRangeResponses.length;
  const baselineTotal = baselineResponses.length;
  if (!currentTotal || !baselineTotal) return 0;
  const currentYesRate =
    currentRangeResponses.filter((response) => response.response === "YES").length / currentTotal;
  const baselineYesRate =
    baselineResponses.filter((response) => response.response === "YES").length / baselineTotal;
  return Math.round((currentYesRate - baselineYesRate) * 100);
};

export const buildTrend = (responses: CompletionResponse[], range: AnalyticsRange): TrendPoint[] => {
  const bucketMap = new Map<string, { yes: number; total: number }>();
  const pattern = range === "year" ? "MMM" : "MM/dd";
  for (const response of responses) {
    const key = format(parseISO(response.respondedAt), pattern);
    const current = bucketMap.get(key) ?? { yes: 0, total: 0 };
    bucketMap.set(key, {
      yes: current.yes + (response.response === "YES" ? 1 : 0),
      total: current.total + 1
    });
  }
  return [...bucketMap.entries()].map(([label, value]) => ({
    label,
    value: value.total ? Math.round((value.yes / value.total) * 100) : 0
  }));
};
