export const formatDateTimeLocal = (timestamp: number) => {
  const date = new Date(timestamp);
  const tzOffsetMinutes = date.getTimezoneOffset();
  const local = new Date(timestamp - tzOffsetMinutes * 60_000);
  return local.toISOString().slice(0, 16);
};

export const parseDateTimeLocal = (value: string): number | null => {
  if (!value) return null;
  const parsed = new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? null : time;
};
