import { format } from "date-fns";

const quotes = [
  "Clarity first, velocity next.",
  "Small wins stack into big momentum.",
  "Plan sharply. Execute gently. Repeat daily.",
  "Discipline is a kindness to your future self.",
  "You do not need more time, just fewer distractions."
];

export const getQuote = () => {
  const index = new Date().getDate() % quotes.length;
  return quotes[index];
};

export const getTodayKey = () => format(new Date(), "yyyy-MM-dd");

export const getDiaryHeading = (date: Date) => format(date, "EEEE, MMM d");

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const toHHMM = (minutes: number) => {
  const value = Math.max(0, Math.min(1439, Math.round(minutes)));
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const to12HourTime = (hhmm: string) => {
  const minutes = toMinutes(hhmm);
  const clamped = Math.max(0, Math.min(1439, minutes));
  const h24 = Math.floor(clamped / 60);
  const m = clamped % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
};

export const minutesTo12HourTime = (minutes: number) => to12HourTime(toHHMM(minutes));
