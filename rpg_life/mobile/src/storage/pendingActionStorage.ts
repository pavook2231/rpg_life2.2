import AsyncStorage from "@react-native-async-storage/async-storage";

export type PendingAction =
  | {
      id: string;
      type: "complete_quest";
      payload: { questId: number };
      createdAt: string;
    }
  | {
      id: string;
      type: "claim_daily_bonus";
      payload: Record<string, never>;
      createdAt: string;
    }
  | {
      id: string;
      type: "claim_weekly_reward";
      payload: Record<string, never>;
      createdAt: string;
    }
  | {
      id: string;
      type: "claim_seasonal_reward";
      payload: Record<string, never>;
      createdAt: string;
    }
  | {
      id: string;
      type: "open_chest";
      payload: { inventory_id?: number | null; chest_id?: number | null; chest_name?: string | null };
      createdAt: string;
    };

const STORAGE_KEY = "@rpg_life/pending_actions";

export async function getPendingActions() {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return [] as PendingAction[];
  }

  try {
    return JSON.parse(rawValue) as PendingAction[];
  } catch {
    return [] as PendingAction[];
  }
}

export async function savePendingActions(actions: PendingAction[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
}

export async function addPendingAction(action: PendingAction) {
  const actions = await getPendingActions();
  actions.push(action);
  await savePendingActions(actions);
}

export async function removePendingAction(actionId: string) {
  const actions = await getPendingActions();
  await savePendingActions(actions.filter((action) => action.id !== actionId));
}
