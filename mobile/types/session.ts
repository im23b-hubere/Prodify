export type SessionDto = {
  id: number;
  user_id: number;
  started_at: string;
  stopped_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
};
