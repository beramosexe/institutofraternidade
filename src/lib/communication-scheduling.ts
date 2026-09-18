export type RecurringWork = {
  starts_at: string;
  recurrence: string;
  recurrence_weekday: number | null;
  recurrence_time: string | null;
};

export function nextWorkOccurrence(work: RecurringWork, from = new Date()) {
  const startsAt = new Date(work.starts_at);
  if (work.recurrence !== "weekly" || work.recurrence_weekday == null) return startsAt;
  const next = new Date(from);
  const days = (work.recurrence_weekday - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + days);
  const [hours, minutes] = (work.recurrence_time ?? "19:00").split(":").map(Number);
  next.setHours(hours ?? 19, minutes ?? 0, 0, 0);
  if (next < startsAt) return startsAt;
  if (next <= from) next.setDate(next.getDate() + 7);
  return next;
}

export function offsetMilliseconds(value: number, unit: "minutes" | "hours" | "days" | "weeks") {
  const minuteFactors = { minutes: 1, hours: 60, days: 1440, weeks: 10080 } as const;
  return value * minuteFactors[unit] * 60_000;
}

export function renderWorkCommunication(
  template: string,
  work: { name: string; location: string | null },
  occurrence: Date,
) {
  return template
    .replaceAll("{{work_name}}", work.name)
    .replaceAll("{{date}}", occurrence.toLocaleDateString("pt-BR"))
    .replaceAll("{{time}}", occurrence.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))
    .replaceAll("{{location}}", work.location ?? "");
}

export function recurringDates(weekday: number, time: string, startsAt: Date, endsOn: string | null, count = 12) {
  const first = new Date(startsAt);
  const [hours, minutes] = time.split(":").map(Number);
  first.setHours(hours ?? 19, minutes ?? 0, 0, 0);
  const days = (weekday - first.getDay() + 7) % 7;
  first.setDate(first.getDate() + days);
  const end = endsOn ? new Date(`${endsOn}T23:59:59`) : null;
  const dates: Date[] = [];
  for (let index = 0; index < count; index += 1) {
    const occurrence = new Date(first);
    occurrence.setDate(first.getDate() + index * 7);
    if (end && occurrence > end) break;
    dates.push(occurrence);
  }
  return dates;
}