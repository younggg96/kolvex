// KOL types and API functions
import { PLATFORM_CONFIG_LOWERCASE, PlatformLowercase } from "./platformConfig";

export type Platform = PlatformLowercase;

export interface KOL {
  id: string;
  name: string;
  username: string;
  platform: Platform;
  followers: number;
  description?: string;
  avatarUrl?: string;
  isTracking: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKOLInput {
  name: string;
  username: string;
  platform: Platform;
  followers: number;
  description?: string;
  avatarUrl?: string;
  isTracking?: boolean;
}

export interface UpdateKOLInput {
  name?: string;
  username?: string;
  followers?: number;
  description?: string;
  avatarUrl?: string;
  isTracking?: boolean;
}

// Platform display names and icons
export const platformConfig = PLATFORM_CONFIG_LOWERCASE;

// Format follower count
export function formatFollowers(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

// API functions
export async function fetchKOLs(): Promise<KOL[]> {
  const response = await fetch("/api/kol");
  if (!response.ok) {
    throw new Error("Failed to fetch KOLs");
  }
  return response.json();
}

export async function createKOL(data: CreateKOLInput): Promise<KOL> {
  const response = await fetch("/api/kol", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to create KOL");
  }
  return response.json();
}

export async function updateKOL(
  id: string,
  data: UpdateKOLInput
): Promise<KOL> {
  const response = await fetch("/api/kol", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, ...data }),
  });
  if (!response.ok) {
    throw new Error("Failed to update KOL");
  }
  return response.json();
}

export async function deleteKOL(id: string): Promise<void> {
  const response = await fetch("/api/kol", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    throw new Error("Failed to delete KOL");
  }
}
