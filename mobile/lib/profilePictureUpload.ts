import { File } from "expo-file-system";

import { apiMultipart } from "./client";
import type { AuthenticatedUser } from "./authSessionService";

export type ProfilePictureAsset = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function resolveProfilePictureMime(asset: ProfilePictureAsset): string {
  const declared = asset.mimeType?.trim().toLowerCase();
  if (declared && declared.startsWith("image/")) {
    return declared === "image/jpg" ? "image/jpeg" : declared;
  }
  const fromName = asset.fileName?.split(".").pop()?.toLowerCase();
  if (fromName === "png") return "image/png";
  if (fromName === "webp") return "image/webp";
  return "image/jpeg";
}

export function resolveProfilePictureFileName(asset: ProfilePictureAsset, mimeType: string): string {
  const provided = asset.fileName?.trim();
  if (provided) return provided;
  const extension = MIME_TO_EXTENSION[mimeType] ?? "jpg";
  return `profile.${extension}`;
}

/**
 * Build multipart body using Expo's File blob.
 *
 * Expo SDK 54+ / `expo/fetch` rejects React Native's legacy `{ uri, name, type }`
 * FormData parts with "Unsupported FormDataPart implementation".
 */
export function buildProfilePictureFormData(asset: ProfilePictureAsset): FormData {
  const mimeType = resolveProfilePictureMime(asset);
  const fileName = resolveProfilePictureFileName(asset, mimeType);
  const formData = new FormData();
  const file = new File(asset.uri);
  formData.append("file", file, fileName);
  return formData;
}

export async function uploadProfilePicture(
  token: string,
  asset: ProfilePictureAsset,
): Promise<AuthenticatedUser> {
  return apiMultipart<AuthenticatedUser>("/users/me/profile-picture", {
    method: "POST",
    token,
    formData: buildProfilePictureFormData(asset),
    timeoutMs: 60_000,
  });
}
