import { apiJson } from "../../lib/client";
import type { FriendsProgressionDto } from "../../types/friends";

export async function fetchFriendsProgression(token: string): Promise<FriendsProgressionDto> {
  return apiJson<FriendsProgressionDto>("/friends/progression", { token });
}
