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
export function recurringDatesMultiple(weekdays: number[], time: string, startsAt: Date, endsOn: string | null, count = 12) {
  const selected = [...new Set(weekdays)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
  const end = endsOn ? new Date(`${endsOn}T23:59:59`) : null;
  const [hours, minutes] = time.split(":").map(Number);
  const dates: Date[] = [];
  const cursor = new Date(startsAt);
  cursor.setHours(hours ?? 19, minutes ?? 0, 0, 0);
  for (let week = 0; dates.length < count; week += 1) {
    for (const weekday of selected) {
      const occurrence = new Date(cursor);
      const delta = ((weekday - cursor.getDay() + 7) % 7) + week * 7;
      occurrence.setDate(cursor.getDate() + delta);
      if (occurrence < startsAt) continue;
      if (end && occurrence > end) return dates;
      dates.push(occurrence);
      if (dates.length >= count) break;
    }
  }
  return dates.sort((a, b) => a.getTime() - b.getTime());
}
