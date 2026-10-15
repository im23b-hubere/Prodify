export type NotificationCategory = "streak" | "achievement" | "social" | "tips";
export type NotificationPriority = "low" | "normal" | "high" | "critical";

export type InboxItem = {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  createdAt: number;
  expiresAt?: number;
  read: boolean;
  actionLabel?: string;
  actionRoute?: string;
};

export type NotificationSettings = {
  streak: boolean;
  achievements: boolean;
  social: boolean;
  tips: boolean;
  /** Local minutes since midnight; equal start and end mean no quiet window. */
  quietStartMinute: number;
  quietEndMinute: number;
  frequency: "all" | "important" | "off";
};
