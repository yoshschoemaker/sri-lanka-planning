import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ActivityPriority } from "../types/trip";
import type { CommunitySnapshot, PendingOp } from "./community";

/**
 * Het netwerkdeel van de gedeelde activiteiten. Alle rechten zitten in de
 * database (supabase/schema.sql); de publishable key mag daarom gewoon in de
 * bundel staan.
 *
 * Zonder de env-variabelen (lokaal zonder .env.local, en in de tests) is er
 * geen client en blijven de gedeelde functies uit beeld. De rest van de app
 * werkt dan precies als voorheen.
 */

const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const key: string | undefined = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          // Eigen sleutel naast de andere srilanka-trip:-sleutels in localStorage.
          storageKey: "srilanka-trip:supabase-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

/** Een mislukte verbinding, als tegenhanger van een weigering door de server. */
export class NetworkError extends Error {}

/**
 * Een fout uit supabase-js zonder code komt niet van de database maar van fetch
 * zelf: geen bereik. Die handeling hoort in de wachtrij te blijven. Met een
 * code heeft de server hem bekeken en geweigerd, en opnieuw proberen helpt niet.
 */
function raise(error: { message: string; code?: string } | null): void {
  if (!error) return;
  if (!error.code) throw new NetworkError(error.message);
  throw new Error(error.message);
}

interface SuggestionRow {
  id: string;
  stop_id: string;
  title: string;
  description: string | null;
  url: string | null;
  user_id: string;
  created_at: string;
}

interface ReactionRow {
  activity_key: string;
  user_id: string;
  thumbs_up: boolean;
  priority: ActivityPriority | null;
}

interface ProfileRow {
  user_id: string;
  username: string;
}

/** Alles in één keer: voor een groep reisgenoten zijn dit hooguit een paar honderd rijen. */
export async function fetchSnapshot(client: SupabaseClient): Promise<CommunitySnapshot> {
  const [suggestions, reactions, profiles] = await Promise.all([
    client.from("suggestions").select("id, stop_id, title, description, url, user_id, created_at"),
    client.from("reactions").select("activity_key, user_id, thumbs_up, priority"),
    client.from("profiles").select("user_id, username"),
  ]);
  raise(suggestions.error);
  raise(reactions.error);
  raise(profiles.error);

  return {
    suggestions: ((suggestions.data ?? []) as SuggestionRow[]).map((row) => ({
      id: row.id,
      stopId: row.stop_id,
      title: row.title,
      description: row.description,
      url: row.url,
      userId: row.user_id,
      createdAt: row.created_at,
    })),
    reactions: ((reactions.data ?? []) as ReactionRow[]).map((row) => ({
      activityKey: row.activity_key,
      userId: row.user_id,
      thumbsUp: row.thumbs_up,
      priority: row.priority,
    })),
    usernames: Object.fromEntries(((profiles.data ?? []) as ProfileRow[]).map((row) => [row.user_id, row.username])),
  };
}

/**
 * Verstuurt één handeling uit de wachtrij. Elke variant is herhaalbaar: gaat de
 * verbinding weg nadat de server iets al verwerkt had, dan doet een tweede
 * poging geen kwaad.
 */
export async function sendOp(client: SupabaseClient, op: PendingOp, userId: string): Promise<void> {
  if (op.kind === "add-suggestion") {
    const { suggestion } = op;
    const { error } = await client.from("suggestions").upsert(
      {
        id: suggestion.id,
        stop_id: suggestion.stopId,
        title: suggestion.title,
        description: suggestion.description,
        url: suggestion.url,
        user_id: userId,
        created_at: suggestion.createdAt,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    raise(error);
  } else if (op.kind === "delete-suggestion") {
    const { error } = await client.from("suggestions").delete().eq("id", op.id);
    raise(error);
  } else if (!op.thumbsUp && !op.priority) {
    const { error } = await client
      .from("reactions")
      .delete()
      .eq("activity_key", op.activityKey)
      .eq("user_id", userId);
    raise(error);
  } else {
    const { error } = await client.from("reactions").upsert(
      {
        activity_key: op.activityKey,
        user_id: userId,
        thumbs_up: op.thumbsUp,
        priority: op.priority,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "activity_key,user_id" },
    );
    raise(error);
  }
}

/**
 * Lid worden, of als je dat al bent je naam wijzigen. Logt anoniem in als dit
 * toestel nog geen sessie heeft: een e-mailadres is voor een groep vrienden
 * niet nodig, de groepscode is de drempel.
 */
export async function joinGroup(client: SupabaseClient, code: string, username: string): Promise<string> {
  const { data: sessionData } = await client.auth.getSession();
  let userId = sessionData.session?.user.id;
  if (!userId) {
    const { data, error } = await client.auth.signInAnonymously();
    if (error) {
      if (!error.status) throw new NetworkError(error.message);
      // Staat uit in Authentication → Sign In / Providers in Supabase.
      if (error.code === "anonymous_provider_disabled") throw new Error("Meedoen staat nog niet aan op de server.");
      throw new Error(error.message);
    }
    userId = data.user?.id;
    if (!userId) throw new Error("Inloggen mislukt");
  }

  const { error } = await client.rpc("join_group", { p_code: code, p_username: username });
  raise(error);
  return userId;
}

export async function renameMember(client: SupabaseClient, userId: string, username: string): Promise<void> {
  const { error } = await client.from("profiles").update({ username }).eq("user_id", userId);
  raise(error);
}
