import { getEffectiveHoursSince, getNextDueDate } from '@/lib/intervalCalculations';

export function getLastControlDate(point, latestPerformedAt) {
  const latest = latestPerformedAt ? new Date(latestPerformedAt) : null;
  const first = point.first_confirmation_date ? new Date(point.first_confirmation_date) : null;
  if (!latest) return first;
  return first && first > latest ? first : latest;
}

export function getControlPointStatus(point, latestPerformedAt, company, excludedDays, now = new Date()) {
  const visualization = company?.overdue_visualization_type || 'two_colors';
  const lastPerformed = getLastControlDate(point, latestPerformedAt);
  if (!lastPerformed) return visualization === 'traffic_light' ? 'critical' : 'warning';
  const interval = point.interval_hours || 0;
  const elapsed = getEffectiveHoursSince(lastPerformed, now, excludedDays);
  if (elapsed <= interval) return 'ok';
  if (visualization === 'two_colors') return 'warning';
  const tolerance = company?.overdue_tolerance_percent ?? 4;
  const yellowHours = Math.max(interval * tolerance / 100, (company?.min_yellow_window_minutes || 0) / 60);
  return elapsed - interval <= yellowHours ? 'warning' : 'critical';
}

export function getControlPointDueDate(point, latestPerformedAt, excludedDays) {
  const lastPerformed = getLastControlDate(point, latestPerformedAt);
  if (!lastPerformed || !point.interval_hours) return null;
  return getNextDueDate(lastPerformed, point.interval_hours, excludedDays);
}