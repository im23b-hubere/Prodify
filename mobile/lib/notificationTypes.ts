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
  quietStartHour: number;
  quietEndHour: number;
  frequency: "all" | "important" | "off";
};
