import type { SessionActivity, SessionData } from './types';

export const sampleSession: SessionData = {
  id: 'demo-session', producerName: 'erix', dateLabel: '07 OCT 2026',
  durationSeconds: 107 * 60, streakDays: 8,
  activities: [
    { label: 'Beat Making', durationSeconds: 58 * 60 },
    { label: 'Arrangement', durationSeconds: 31 * 60 },
    { label: 'Mixing', durationSeconds: 18 * 60 },
  ],
};

export function safeSeconds(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error('Session duration must be finite and non-negative.');
  return Math.floor(value);
}
export function durationLabel(value: number): string {
  const seconds = safeSeconds(value);
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
export function truncate(value: string, length: number): string {
  const points = Array.from(value.trim());
  return points.length > length ? points.slice(0, length - 1).join('') + '…' : points.join('');
}
export function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' }[char]!));
}
/** Aggregate allocation only. This does NOT claim chronological order. */
export function activityRows(session: SessionData): SessionActivity[] {
  const total = safeSeconds(session.durationSeconds);
  const rows = session.activities.map(a => ({ label: a.label.trim() || 'Production', durationSeconds: safeSeconds(a.durationSeconds) })).filter(a => a.durationSeconds > 0);
  const allocated = rows.reduce((sum, a) => sum + a.durationSeconds, 0);
  if (allocated > total) throw new Error('Activity durations exceed active session time. Map non-overlapping activity data before sharing.');
  if (allocated < total) rows.push({ label: rows.length ? 'Other' : 'Production', durationSeconds: total - allocated });
  if (rows.length <= 3) return rows;
  return [...rows.slice(0, 2), { label: 'Other', durationSeconds: rows.slice(2).reduce((sum, a) => sum + a.durationSeconds, 0) }];
}
