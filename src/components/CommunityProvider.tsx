import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  applyPending,
  EMPTY_SNAPSHOT,
  enqueue,
  groupReactions,
  type CommunitySnapshot,
  type PendingOp,
} from "../utils/community";
import { fetchSnapshot, joinGroup, NetworkError, renameMember, sendOp, supabase } from "../utils/communityApi";
import { CommunityContext, type CommunityValue, type SyncState } from "../utils/communityContext";

/**
 * Laatst opgehaalde stand, zodat voorstellen en duimpjes ook zonder bereik
 * zichtbaar blijven. De wachtrij staat apart: die mag nooit verloren gaan,
 * ook niet als de cache onleesbaar blijkt.
 */
const CACHE_KEY = "srilanka-trip:community-cache";
const QUEUE_KEY = "srilanka-trip:community-queue";

const OFFLINE_MESSAGE = "Geen verbinding. Probeer het opnieuw zodra je online bent.";

function readJson<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Vol of geblokkeerd: dan geldt het alleen voor deze sessie.
  }
}

function isSnapshot(value: unknown): value is CommunitySnapshot {
  const v = value as Partial<CommunitySnapshot> | null;
  return Boolean(v && Array.isArray(v.suggestions) && Array.isArray(v.reactions) && v.usernames && typeof v.usernames === "object");
}

function isQueue(value: unknown): value is PendingOp[] {
  return Array.isArray(value);
}

function errorMessage(error: unknown): string {
  if (error instanceof NetworkError) return OFFLINE_MESSAGE;
  return error instanceof Error ? error.message : "Er ging iets mis.";
}

/**
 * Houdt de gedeelde activiteiten bij voor de hele app: ophalen, de wachtrij
 * versturen zodra er verbinding is, en lid worden met de groepscode.
 *
 * Er is geen live-verbinding: de stand wordt opgehaald bij het openen, bij
 * terugkeren naar de app, bij weer online komen en na elke eigen handeling.
 * Voor een handvol reisgenoten is dat ruim genoeg, en het kost onderweg geen
 * batterij.
 */
export function CommunityProvider({ children }: { children: ReactNode }) {
  const [serverSnapshot, setServerSnapshot] = useState<CommunitySnapshot>(
    () => readJson(CACHE_KEY, isSnapshot) ?? EMPTY_SNAPSHOT,
  );
  const [queue, setQueue] = useState<PendingOp[]>(() => readJson(QUEUE_KEY, isQueue) ?? []);
  const [userId, setUserId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);

  // De sync loopt over meerdere awaits heen en moet dan de actuele wachtrij en
  // gebruiker zien, niet die van de render waarin hij begon.
  const queueRef = useRef(queue);
  const userIdRef = useRef(userId);
  const syncingRef = useRef(false);
  const rerunRef = useRef(false);

  const updateQueue = useCallback((next: PendingOp[]) => {
    queueRef.current = next;
    setQueue(next);
    writeJson(QUEUE_KEY, next);
  }, []);

  const updateSnapshot = useCallback((next: CommunitySnapshot) => {
    setServerSnapshot(next);
    writeJson(CACHE_KEY, next);
  }, []);

  /**
   * Eerst de wachtrij versturen, dan de stand ophalen. Er loopt er hooguit één
   * tegelijk; een verzoek tijdens een lopende sync laat hem na afloop nog een
   * keer draaien, zodat een handeling van halverwege niet blijft liggen.
   */
  const sync = useCallback(async () => {
    const client = supabase;
    if (!client) return;
    if (syncingRef.current) {
      rerunRef.current = true;
      return;
    }
    syncingRef.current = true;
    try {
      do {
        rerunRef.current = false;
        if (!navigator.onLine) {
          setSyncState("offline");
          return;
        }
        setSyncState("syncing");
        try {
          const uid = userIdRef.current;
          while (uid && queueRef.current.length > 0) {
            const op = queueRef.current[0];
            try {
              await sendOp(client, op, uid);
            } catch (error) {
              if (error instanceof NetworkError) throw error;
              // Geweigerd door de server: opnieuw proberen helpt niet, dus
              // weggooien en melden in plaats van de wachtrij te blokkeren.
              setSyncError(errorMessage(error));
            }
            // Op identiteit, niet op positie: tijdens het versturen kan de
            // wachtrij veranderd zijn.
            updateQueue(queueRef.current.filter((q) => q !== op));
          }
          updateSnapshot(await fetchSnapshot(client));
          setSyncState("idle");
        } catch (error) {
          setSyncState(error instanceof NetworkError ? "offline" : "error");
          if (!(error instanceof NetworkError)) setSyncError(errorMessage(error));
          return;
        }
      } while (rerunRef.current);
    } finally {
      syncingRef.current = false;
    }
  }, [updateQueue, updateSnapshot]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;

    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      const id = data.session?.user.id ?? null;
      userIdRef.current = id;
      setUserId(id);
      void sync();
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      userIdRef.current = id;
      setUserId(id);
    });

    function handleVisibility() {
      if (document.visibilityState === "visible") void sync();
    }
    function handleOnline() {
      void sync();
    }
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [sync]);

  const mutate = useCallback(
    (op: PendingOp) => {
      setSyncError(null);
      updateQueue(enqueue(queueRef.current, op));
      void sync();
    },
    [sync, updateQueue],
  );

  const join = useCallback(
    async (code: string, username: string) => {
      const client = supabase;
      if (!client) return "Gedeelde activiteiten staan niet aan in deze versie.";
      try {
        const id = await joinGroup(client, code.trim(), username.trim());
        userIdRef.current = id;
        setUserId(id);
        // Meteen tonen, niet pas na de volgende ophaalronde.
        setServerSnapshot((previous) => ({ ...previous, usernames: { ...previous.usernames, [id]: username.trim() } }));
        void sync();
        return null;
      } catch (error) {
        return errorMessage(error);
      }
    },
    [sync],
  );

  const rename = useCallback(
    async (username: string) => {
      const client = supabase;
      const id = userIdRef.current;
      if (!client || !id) return "Je bent nog geen lid van de groep.";
      try {
        await renameMember(client, id, username.trim());
        setServerSnapshot((previous) => ({ ...previous, usernames: { ...previous.usernames, [id]: username.trim() } }));
        void sync();
        return null;
      } catch (error) {
        return errorMessage(error);
      }
    },
    [sync],
  );

  // Stabiel, want ActivitiesView ververst ermee in een effect: een nieuwe
  // functie per render zou na elke sync weer een sync starten.
  const refresh = useCallback(() => void sync(), [sync]);

  const value = useMemo<CommunityValue>(() => {
    const snapshot = applyPending(serverSnapshot, queue, userId);
    return {
      enabled: supabase !== null,
      snapshot,
      reactionsByKey: groupReactions(snapshot.reactions),
      userId,
      username: userId ? (snapshot.usernames[userId] ?? null) : null,
      pendingCount: queue.length,
      syncState,
      syncError,
      refresh,
      join,
      rename,
      setReaction: (activityKey, next) => mutate({ kind: "reaction", activityKey, ...next }),
      addSuggestion: (suggestion) =>
        mutate({
          kind: "add-suggestion",
          suggestion: { ...suggestion, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
        }),
      deleteSuggestion: (id) => mutate({ kind: "delete-suggestion", id }),
    };
  }, [serverSnapshot, queue, userId, syncState, syncError, refresh, join, rename, mutate]);

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}
