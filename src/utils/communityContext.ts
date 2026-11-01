import { createContext, useContext } from "react";
import type { ActivityPriority } from "../types/trip";
import type { CommunitySnapshot, Reaction } from "./community";

/**
 * - `idle`: alles is verstuurd en de laatste stand is opgehaald.
 * - `offline`: geen verbinding; wat je doet wacht in de wachtrij.
 * - `error`: de server weigerde iets (zie syncError).
 */
export type SyncState = "idle" | "syncing" | "offline" | "error";

export interface NewSuggestion {
  stopId: string;
  title: string;
  description: string | null;
  url: string | null;
}

export interface NewScore {
  score: number;
  distance: number;
  reachedStop: string | null;
}

export interface CommunityValue {
  /** False zonder Supabase-configuratie: dan toont de app geen gedeelde functies. */
  enabled: boolean;
  /** Serverstand met je eigen nog niet verstuurde handelingen erbovenop. */
  snapshot: CommunitySnapshot;
  reactionsByKey: Map<string, Reaction[]>;
  userId: string | null;
  /** Gezet zodra dit toestel lid is van de groep. Zonder naam kun je alleen kijken. */
  username: string | null;
  /** Handelingen die nog op verbinding wachten. */
  pendingCount: number;
  syncState: SyncState;
  syncError: string | null;
  refresh: () => void;
  /** Geeft een foutmelding terug, of null als het gelukt is. */
  join: (code: string, username: string) => Promise<string | null>;
  rename: (username: string) => Promise<string | null>;
  setReaction: (activityKey: string, next: { thumbsUp: boolean; priority: ActivityPriority | null }) => void;
  addSuggestion: (suggestion: NewSuggestion) => void;
  deleteSuggestion: (id: string) => void;
  /** Zet een rit op het scorebord. Doet niets als je geen lid bent. */
  submitScore: (score: NewScore) => void;
}

export const CommunityContext = createContext<CommunityValue | null>(null);

export function useCommunity(): CommunityValue {
  const value = useContext(CommunityContext);
  if (!value) throw new Error("useCommunity vereist een CommunityProvider");
  return value;
}
