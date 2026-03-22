import type {
  LeaderboardEntry,
  LeaderboardMeResponse,
  LeaderboardResponse,
  LeaderboardScope,
} from "../../api/game";

export type {
  LeaderboardEntry,
  LeaderboardMeResponse,
  LeaderboardResponse,
  LeaderboardScope,
};

export type LeaderboardRouteParams = {
  initialScope?: LeaderboardScope;
  requestedAt?: number;
};
