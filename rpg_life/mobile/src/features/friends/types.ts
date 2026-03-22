export type PresenceStatus = "online" | "offline";

export type SocialUserPreview = {
  id: number;
  name: string;
  username?: string | null;
  friend_id?: string | null;
  class_name?: string | null;
  class_display_name?: string | null;
  level?: number | null;
  presence_status: PresenceStatus;
  last_active_at?: string | null;
};

export type FriendStats = {
  level?: number;
  quests_completed?: number;
  steps?: number;
  challenge_wins?: number;
};

export type FriendItem = SocialUserPreview & {
  friends_since: string;
  rating_rank?: number | null;
  stats: FriendStats;
};

export type FriendRequestItem = {
  id: number;
  status: "pending" | "accepted" | "declined";
  direction: "incoming" | "outgoing";
  created_at?: string | null;
  responded_at?: string | null;
  user: SocialUserPreview;
};

export type FriendSearchStatus = "none" | "friend" | "outgoing_pending" | "incoming_pending";

export type UserSearchResult = SocialUserPreview & {
  status: FriendSearchStatus;
  request_id?: number | null;
};

export type FriendsTabKey = "friends" | "requests" | "discover";

export type FriendsRouteParams = {
  initialTab?: FriendsTabKey;
  focusSearch?: boolean;
  requestedAt?: number;
};
