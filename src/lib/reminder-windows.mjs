export function appointmentReminderWindows(minutesUntil) {
  if (!Number.isFinite(minutesUntil) || minutesUntil <= 0) return [];
  const windows = [];
  if (minutesUntil <= 48 * 60 && minutesUntil > 24 * 60) windows.push('48h');
  if (minutesUntil <= 60) windows.push('1h');
  return windows;
}
