import type { FriendActivityDto } from "../../../types/friends";

export const ACTIVITY_PREVIEW_SIZE = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ActivityKind = "session" | "streak_broken" | "commitment";

export type ActivityDay = {
  key: string;
  /** Calendar days before today: 0 is today, 1 yesterday. */
  daysAgo: number;
  date: Date;
  items: FriendActivityDto[];
};

export function activityKind(item: FriendActivityDto): ActivityKind {
  if (item.status === "streak_broken") return "streak_broken";
  if (item.status === "commitment_published") return "commitment";
  return "session";
}

export function isOpenableSession(item: FriendActivityDto) {
  return item.session_id > 0 && (item.status === "live" || item.status === "completed");
}

/** Friends with a running session, one entry per friend (the feed is newest first). */
export function liveFriends(activity: FriendActivityDto[]): FriendActivityDto[] {
  const seen = new Set<number>();
  return activity.filter((item) => {
    if (item.status !== "live" || item.session_id <= 0 || seen.has(item.user_id)) return false;
    seen.add(item.user_id);
    return true;
  });
}

/** Everything that already happened; running sessions live in the live strip instead. */
export function pastActivity(activity: FriendActivityDto[]): FriendActivityDto[] {
  return activity.filter((item) => item.status !== "live");
}

export function previewActivity(
  activity: FriendActivityDto[],
  expanded: boolean,
): { items: FriendActivityDto[]; hiddenCount: number } {
  if (expanded || activity.length <= ACTIVITY_PREVIEW_SIZE) {
    return { items: activity, hiddenCount: 0 };
  }
  return {
    items: activity.slice(0, ACTIVITY_PREVIEW_SIZE),
    hiddenCount: activity.length - ACTIVITY_PREVIEW_SIZE,
  };
}

/** Groups by local calendar day, keeping the incoming order; undated items are dropped. */
export function groupActivityByDay(activity: FriendActivityDto[], now: number): ActivityDay[] {
  const today = startOfLocalDay(new Date(now));
  const days = new Map<string, ActivityDay>();
  for (const item of activity) {
    const date = new Date(item.activity_at);
    if (!Number.isFinite(date.getTime())) continue;
    const day = startOfLocalDay(date);
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
    const existing = days.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    days.set(key, {
      key,
      daysAgo: Math.round((today.getTime() - day.getTime()) / DAY_MS),
      date: day,
      items: [item],
    });
  }
  return [...days.values()];
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
