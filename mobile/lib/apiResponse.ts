import { ApiError, formatApiErrorDetail } from "./apiErrors";

export async function readResponsePayload(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function apiErrorFromResponse(response: Response, payload: unknown): ApiError {
  return new ApiError(
    response.status,
    responseErrorMessage(response.status, payload),
    payload,
    responseErrorCode(payload),
  );
}

function responseErrorCode(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const error = "error" in payload ? payload.error : null;
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    if (typeof code === "string" && code.trim()) return code.trim();
  }
  return null;
}

function responseErrorMessage(status: number, payload: unknown): string {
  if (typeof payload === "string" && payload) return payload;
  if (typeof payload !== "object" || payload === null) return `HTTP ${status}`;

  const error = "error" in payload ? payload.error : null;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string") return message;
  }
  if ("detail" in payload) return formatApiErrorDetail(payload.detail);
  return `HTTP ${status}`;
}
