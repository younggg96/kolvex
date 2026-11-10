import { ApiError, apiRequest } from "./http";
import {
  runKey,
  runsKey,
  type ActivityRun,
  type RunList,
} from "./optionsActivity";
// Report data comes from a feed licensed per signed-in user: always send the session.
const path = (key: string) => key.replace(/^\/api/, "");
export const activityRuns = (
  date: string | null,
  user: string,
  signal: AbortSignal,
) =>
  apiRequest<RunList>(path(runsKey(date)), {
    signal,
    authenticated: true,
    expectedUser: user,
    timeout: 25_000,
  });
/** Resolves to null when no report has been produced yet. */
export async function activityRun(
  id: string | null,
  user: string,
  signal: AbortSignal,
): Promise<ActivityRun | null> {
  try {
    return await apiRequest<ActivityRun>(path(runKey(id)), {
      signal,
      authenticated: true,
      expectedUser: user,
      timeout: 25_000,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
