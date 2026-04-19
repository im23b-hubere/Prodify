import type { TFunction } from "i18next";

/** Response shape from `GET /motivational-messages/random`. */
export type MotivationalMessageDto = {
  message?: string;
  message_key: string;
  variant?: string;
};

export function parseMotivationalMessage(raw: unknown): MotivationalMessageDto | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.message_key !== "string" || !o.message_key.trim()) return null;
  return {
    message_key: o.message_key.trim(),
    message: typeof o.message === "string" ? o.message : undefined,
    variant: typeof o.variant === "string" ? o.variant : undefined,
  };
}

export function translateMotivationalMessage(dto: MotivationalMessageDto, t: TFunction): string {
  return t(`motivationApi.${dto.message_key}`, {
    defaultValue: dto.message?.trim() ? dto.message : dto.message_key,
  });
}
