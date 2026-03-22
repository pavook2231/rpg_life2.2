import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";

import { fetchSocialProfile } from "./socialProfileService";
import type { SocialProfilePayload } from "./types";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

type UseSocialProfileStateArgs = {
  userId: number | null;
  loadErrorMessage: string;
};

export function useSocialProfileState({ userId, loadErrorMessage }: UseSocialProfileStateArgs) {
  const requestVersionRef = useRef(0);
  const hasFocusedOnceRef = useRef(false);

  const [profile, setProfile] = useState<SocialProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(
    async (forceRefresh = false, refreshOnly = false) => {
      const requestVersion = ++requestVersionRef.current;

      if (!userId) {
        setProfile(null);
        setLoading(false);
        setRefreshing(false);
        setError(loadErrorMessage);
        return;
      }

      if (refreshOnly) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      if (!refreshOnly) {
        setError(null);
      }

      try {
        const payload = await fetchSocialProfile(userId, { forceRefresh });
        if (requestVersion !== requestVersionRef.current) {
          return;
        }
        setProfile(payload);
        setError(null);
      } catch (error) {
        if (requestVersion !== requestVersionRef.current) {
          return;
        }
        if (!refreshOnly) {
          setProfile(null);
        }
        setError(getErrorMessage(error, loadErrorMessage));
      } finally {
        if (requestVersion !== requestVersionRef.current) {
          return;
        }
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadErrorMessage, userId],
  );

  useEffect(() => {
    void loadProfile(false, false);
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }
      void loadProfile(true, true);
    }, [loadProfile]),
  );

  return {
    profile,
    loading,
    refreshing,
    error,
    refreshScreen: () => loadProfile(true, true),
    reload: () => loadProfile(true, false),
  };
}
