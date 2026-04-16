import { API_BASE_URL } from "../constants/api";

export type ApiOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
};

export async function apiJson<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    if (typeof data === "object" && data !== null && "detail" in data) {
      const d = (data as { detail: unknown }).detail;
      if (typeof d === "string") msg = d;
      else if (Array.isArray(d)) msg = d.map((e) => JSON.stringify(e)).join(", ");
    }
    throw new Error(msg);
  }
  return data as T;
}
