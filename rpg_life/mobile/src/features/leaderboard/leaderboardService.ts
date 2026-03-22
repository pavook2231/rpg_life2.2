import {
  fetchFriendsLeaderboardPage,
  fetchLeaderboard,
  fetchLeaderboardMe,
  type LeaderboardMeResponse,
  type LeaderboardResponse,
  type LeaderboardScope,
} from "../../api/game";
import { LEADERBOARD_METRIC, LEADERBOARD_PAGE_SIZE } from "./utils";

type RequestOptions = {
  forceRefresh?: boolean;
};

export type { LeaderboardMeResponse, LeaderboardResponse, LeaderboardScope };

export function loadLeaderboardPage(
  scope: LeaderboardScope,
  page = 1,
  options: RequestOptions = {},
) {
  const { forceRefresh = false } = options;
  if (scope === "friends") {
    return fetchFriendsLeaderboardPage(LEADERBOARD_METRIC, page, LEADERBOARD_PAGE_SIZE, "all_time", { forceRefresh });
  }

  return fetchLeaderboard(LEADERBOARD_METRIC, "global", page, LEADERBOARD_PAGE_SIZE, "all_time", { forceRefresh });
}

export function loadLeaderboardMe(scope: LeaderboardScope, options: RequestOptions = {}) {
  return fetchLeaderboardMe(scope, LEADERBOARD_METRIC, "all_time", options) as Promise<LeaderboardMeResponse>;
}
