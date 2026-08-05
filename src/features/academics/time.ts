export const ACCRA_TIME_ZONE = "Africa/Accra";

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function parseAccraDate(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Enter a valid date.");
  }
  return date;
}

export function parseAccraDateTime(value?: string | null) {
  if (!value) return undefined;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new Error("Enter a valid date and time.");

  const [, year, month, day, hours, minutes] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes)));
  if (Number.isNaN(date.getTime()) || formatAccraDateTimeInput(date) !== value) {
    throw new Error("Enter a valid date and time.");
  }
  return date;
}

export function formatAccraDateInput(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export function formatAccraDateTimeInput(value: Date | null | undefined) {
  return value ? `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}` : "";
}

export function accraWeekBounds(source = new Date()) {
  const start = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start, end };
}
