export function validSessionId(sessionId?: string): number | null {
  if (!sessionId) return null;
  const numericSessionId = Number(sessionId);
  return Number.isFinite(numericSessionId) ? numericSessionId : null;
}
