import i18n from "./i18n";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

export type FriendMotivationStats = {
  activeNow: number;
  topThisWeek: { userId: number; name: string } | null;
};

export type MotivationSession = {
  duration_seconds: number;
  focus_score?: number | null;
  session_type: string;
};

export type MotivationContext = {
  session?: MotivationSession;
  streak: number;
  todayCount: number;
  weekCount: number;
  friends: FriendMotivationStats;
  timeOfDay: TimeOfDay;
  lastSessionFocus?: number | null;
};

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function getTimeOfDay(date = new Date()): TimeOfDay {
  const h = date.getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "night";
}

function isEvening(date = new Date()): boolean {
  const h = date.getHours();
  return h >= 17 && h < 24;
}

export function getTimeBasedGreeting(date = new Date()): string {
  return i18n.t(`dashboard.greeting.${getTimeOfDay(date)}`);
}

/** Weighted motivational line for dashboard, completion, or reminders. */
export function generateMotivationMessage(context: MotivationContext): string {
  const messages: string[] = [];
  const s = context.session;
  const m = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts ?? {});

  if (s) {
    const durMin = (s.duration_seconds ?? 0) / 60;
    const focus = s.focus_score;

    if (focus != null && focus >= 95) {
      messages.push(m("motivation.perfectFocus"));
      messages.push(m("motivation.producerMode"));
    } else if (focus != null && focus >= 85) {
      messages.push(m("motivation.excellentSession"));
    } else if (focus != null && focus < 60) {
      messages.push(m("motivation.everySessionCounts"));
      messages.push(m("motivation.progressOverPerf"));
    }

    if (durMin >= 120) {
      messages.push(m("motivation.twoHoursPlus"));
    } else if (durMin >= 60) {
      messages.push(m("motivation.fullHour"));
    }

    const st = s.session_type.toLowerCase();
    if (
      st.includes("mix") ||
      st === "mastering" ||
      st === "recording" ||
      st === "vocal_production"
    ) {
      messages.push(m("motivation.polishMakesPerfect"));
    } else if (st.includes("sound") || st === "sound_design") {
      messages.push(m("motivation.soundDesignMoves"));
    } else {
      messages.push(m("motivation.anotherBeat"));
    }

    if (context.todayCount >= 3) {
      messages.push(m("motivation.thirdToday"));
    } else if (context.todayCount >= 2) {
      messages.push(m("motivation.secondToday"));
    }
  } else {
    if (context.timeOfDay === "morning") {
      messages.push(m("motivation.morningClear"));
    } else if (context.timeOfDay === "evening") {
      messages.push(m("motivation.eveningEnergy"));
    } else if (context.timeOfDay === "night") {
      messages.push(m("motivation.nightOwl"));
    }

    if (context.streak === 0) {
      messages.push(m("motivation.startStreak"));
    } else if (context.streak >= 7) {
      messages.push(m("motivation.streakHigh", { days: context.streak }));
    } else if (context.streak >= 3) {
      messages.push(m("motivation.streakMid", { days: context.streak }));
    }

    if (context.friends.activeNow > 0) {
      messages.push(m("motivation.friendsActive", { count: context.friends.activeNow }));
    }
    if (context.friends.topThisWeek && context.friends.topThisWeek.userId > 0) {
      messages.push(m("motivation.leaderWeek", { name: context.friends.topThisWeek.name }));
    }

    if (context.lastSessionFocus != null && context.lastSessionFocus >= 90) {
      messages.push(m("motivation.lastSessionStrong"));
    }

    const dow = new Date().getDay();
    if (context.weekCount === 0 && dow >= 3 && dow <= 6) {
      messages.push(m("motivation.noSessionsWeek"));
    } else if (context.weekCount >= 5) {
      messages.push(m("motivation.weekPace", { count: context.weekCount }));
    }

    if (context.todayCount === 0 && isEvening()) {
      messages.push(m("motivation.eveningQuestion"));
    } else if (context.todayCount >= 2) {
      messages.push(m("motivation.todayUnstoppable", { count: context.todayCount }));
    }
  }

  if (messages.length === 0) {
    messages.push(m("motivation.fallback"));
  }

  return pick(messages);
}

/** Shorter lines for the glass card on the dashboard. */
export function generateDashboardMotivationLine(ctx: MotivationContext): string {
  return generateMotivationMessage(ctx);
}
