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
  const t = getTimeOfDay(date);
  if (t === "morning") return "Good morning";
  if (t === "afternoon") return "Good afternoon";
  if (t === "evening") return "Good evening";
  return "Hey there";
}

/** Weighted motivational line for dashboard, completion, or reminders. */
export function generateMotivationMessage(context: MotivationContext): string {
  const messages: string[] = [];
  const s = context.session;

  if (s) {
    const durMin = (s.duration_seconds ?? 0) / 60;
    const focus = s.focus_score;

    if (focus != null && focus >= 95) {
      messages.push("Perfect focus! You're in the zone.");
      messages.push("That's producer mode — keep this energy.");
    } else if (focus != null && focus >= 85) {
      messages.push("Excellent session! You're building something special.");
    } else if (focus != null && focus < 60) {
      messages.push("Every session counts — tomorrow you'll crush it.");
      messages.push("Progress over perfection. You showed up.");
    }

    if (durMin >= 120) {
      messages.push("2+ hours — that's dedication.");
    } else if (durMin >= 60) {
      messages.push("Full hour — that's how you build.");
    }

    if (s.session_type.toLowerCase().includes("mix")) {
      messages.push("Polish makes perfect.");
    } else if (s.session_type.toLowerCase().includes("sound")) {
      messages.push("Sound design moves the whole track.");
    } else {
      messages.push("Another beat in the bag.");
    }

    if (context.todayCount >= 3) {
      messages.push("Third session today — you're on fire.");
    } else if (context.todayCount >= 2) {
      messages.push("Session #2 today — building momentum.");
    }
  } else {
    if (context.timeOfDay === "morning") {
      messages.push("Morning session — clear mind, big moves.");
    } else if (context.timeOfDay === "evening") {
      messages.push("Evening energy — time to create.");
    } else if (context.timeOfDay === "night") {
      messages.push("Night owl mode — your studio, your rules.");
    }

    if (context.streak === 0) {
      messages.push("Start your streak today — day 1 begins now.");
    } else if (context.streak >= 7) {
      messages.push(`${context.streak} days — don't break the chain.`);
    } else if (context.streak >= 3) {
      messages.push(`${context.streak} days strong — keep building.`);
    }

    if (context.friends.activeNow > 0) {
      messages.push(`${context.friends.activeNow} friends on the board recently — join the wave.`);
    }
    if (context.friends.topThisWeek && context.friends.topThisWeek.userId > 0) {
      messages.push(
        `${context.friends.topThisWeek.name} is leading this week — match that energy.`,
      );
    }

    if (context.lastSessionFocus != null && context.lastSessionFocus >= 90) {
      messages.push("Last session was strong — run it back.");
    }

    const dow = new Date().getDay();
    if (context.weekCount === 0 && dow >= 3 && dow <= 6) {
      messages.push("No sessions this week yet — change that today.");
    } else if (context.weekCount >= 5) {
      messages.push(`${context.weekCount} sessions this week — on pace.`);
    }

    if (context.todayCount === 0 && isEvening()) {
      messages.push("Evening session? Some of your best ideas show up now.");
    } else if (context.todayCount >= 2) {
      messages.push(`${context.todayCount} sessions today — unstoppable.`);
    }
  }

  if (messages.length === 0) {
    messages.push("Let's create something amazing.");
  }

  return pick(messages);
}

/** Shorter lines for the glass card on the dashboard. */
export function generateDashboardMotivationLine(ctx: MotivationContext): string {
  return generateMotivationMessage(ctx);
}
