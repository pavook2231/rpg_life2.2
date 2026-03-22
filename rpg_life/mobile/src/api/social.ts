import { apiRequest } from "./client";
import type { LeaderboardPeriod, LeaderboardResponse } from "./game";

export type FriendItem = {
  id: number;
  name: string;
  username?: string | null;
  friend_id?: string | null;
  friends_since: string;
  stats: {
    level?: number;
    quests_completed?: number;
    steps?: number;
    challenge_wins?: number;
  };
};

export type CoopQuest = {
  id: number;
  title: string;
  description: string;
  objective_type: string;
  goal: number;
  progress: number;
  status: string;
  reward: {
    xp: number;
    crystals: number;
  };
  participants: Array<{
    user_id: number;
    name: string;
    contribution: number;
    is_current_user: boolean;
  }>;
  start_time: string;
  end_time: string;
};

export type ChallengeInvitation = {
  id: number;
  sender_id: number;
  receiver_id: number;
  challenge_type: "pvp" | "coop";
  title: string;
  description: string;
  objective_type: "steps" | "workouts" | "quests_completed";
  goal: number;
  reward_xp: number;
  reward_crystals: number;
  status: "pending" | "accepted" | "declined" | "expired";
  created_at: string;
  responded_at?: string | null;
};

export type FriendRequestItem = {
  id: number;
  status: "pending" | "accepted" | "declined";
  direction: "incoming" | "outgoing";
  created_at?: string | null;
  responded_at?: string | null;
  user: {
    id: number;
    name: string;
    username?: string | null;
    friend_id?: string | null;
  };
};

export function fetchFriends(page = 1, pageSize = 30) {
  return apiRequest<{
    items: FriendItem[];
    pagination: {
      page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
    };
  }>(`/social/friends/list?page=${page}&page_size=${pageSize}`);
}

export function fetchCoopQuests(page = 1, pageSize = 20, status?: string) {
  const suffix = status ? `&status=${encodeURIComponent(status)}` : "";
  return apiRequest<{
    items: CoopQuest[];
    pagination: {
      page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
    };
  }>(`/social/coop-quests/list?page=${page}&page_size=${pageSize}${suffix}`);
}

export function createCoopQuest(payload: {
  title: string;
  description: string;
  objective_type: "steps" | "workouts" | "quests_completed";
  goal: number;
  duration_hours: number;
  reward_xp: number;
  reward_crystals: number;
  participant_ids: number[];
}) {
  return apiRequest<{ ok: boolean; coop_quest: CoopQuest }>(`/social/coop-quests/create`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type UserSearchResult = {
  id: number;
  name: string;
  username?: string | null;
  friend_id?: string | null;
  status: "none" | "outgoing_pending" | "incoming_pending";
  request_id?: number;
};

export function searchUsers(query: string, page = 1, pageSize = 20) {
  return apiRequest<{
    items: UserSearchResult[];
    pagination: {
      page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
    };
  }>(`/social/friends/search?q=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`);
}

export function sendFriendRequest(receiverId: number) {
  return apiRequest<{
    ok: boolean;
    request: {
      id: number;
      status: string;
      receiver: { id: number; name: string; username?: string | null; friend_id?: string | null };
      created_at: string;
    };
  }>(`/social/friends/request`, {
    method: "POST",
    body: JSON.stringify({ receiver_id: receiverId }),
  });
}

export function fetchFriendRequests(status = "pending") {
  return apiRequest<{ items: FriendRequestItem[] }>(`/social/friends/requests?status=${encodeURIComponent(status)}`);
}

export function respondToFriendRequest(requestId: number, action: "accept" | "decline") {
  return apiRequest<{ ok: boolean; request_id: number; status: string }>(`/social/friends/accept`, {
    method: "POST",
    body: JSON.stringify({
      request_id: requestId,
      action,
    }),
  });
}

export function fetchFriendsLeaderboard(
  metric: string = "level",
  page = 1,
  pageSize = 20,
  period: LeaderboardPeriod = "all_time",
) {
  return apiRequest<LeaderboardResponse>(
    `/social/leaderboard/friends?metric=${encodeURIComponent(metric)}&period=${encodeURIComponent(period)}&page=${page}&page_size=${pageSize}`
  );
}

export function fetchGlobalLeaderboard(
  metric: string = "level",
  page = 1,
  pageSize = 20,
  period: LeaderboardPeriod = "all_time",
) {
  return apiRequest<LeaderboardResponse>(
    `/social/leaderboard/global?metric=${encodeURIComponent(metric)}&period=${encodeURIComponent(period)}&page=${page}&page_size=${pageSize}`
  );
}

export function fetchChallengeInvitations(status?: ChallengeInvitation["status"]) {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<{ invitations: ChallengeInvitation[] }>(`/social/challenges/invitations${suffix}`);
}

export function respondToChallengeInvitation(invitationId: number, action: "accept" | "decline") {
  return apiRequest<{ message: string; challenge_id?: number; coop_quest_id?: number }>(`/social/challenges/invitations/respond`, {
    method: "POST",
    body: JSON.stringify({
      invitation_id: invitationId,
      action,
    }),
  });
}
