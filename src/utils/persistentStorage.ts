/**
 * Vraagt het besturingssysteem om de opslag van deze app niet weg te gooien.
 *
 * Zonder deze vlag is de precache "best effort": bij schijfdruk mag het systeem
 * hem opruimen. Dat is precies het scenario dat deze app moet overleven, want de
 * planning wordt maanden na het installeren offline geopend.
 *
 * Er komt geen dialoog aan te pas: Chromium kent het stilzwijgend toe op basis
 * van installatie en gebruik, WebKit doet hetzelfde voor apps op het
 * beginscherm. Een weigering is dus niet definitief, en omdat dit bij elke start
 * opnieuw draait krijgt de app vanzelf een volgende kans zodra ze wél
 * kwalificeert.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    // Storage kan geblokkeerd zijn (private browsing); de app werkt dan gewoon
    // door, alleen zonder garantie op de cache.
    return false;
  }
}
