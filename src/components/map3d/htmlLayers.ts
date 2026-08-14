/**
 * Stapelvolgorde voor de DOM-overlays (`<Html>`) op de 3D-kaart.
 *
 * drei's <Html> portalt naast de canvas in dezelfde wrapper als de
 * kaartknoppen van TripMap3D en zet standaard `zIndexRange={[16777271, 0]}`.
 * Dat legt élke marker boven die knoppen (die op z-10 staan), waardoor een
 * badge over de zoom- of rondleidingsknop heen valt. Daarom krijgt elke
 * overlay hier een bereik onder de 10: binnen de kaart bepaalt de afstand tot
 * de camera nog de onderlinge orde, maar de UI-chrome wint altijd.
 *
 * Ondergrens blijft >= 1 zodat de overlays boven de canvas zelf blijven.
 */

/** Stopbadges: de primaire laag, boven dagtrips en dieren. */
export const STOP_HTML_Z: [number, number] = [9, 5];

/** Dagtripstippen: secundair, mogen nooit een stopbadge overlappen. */
export const DAYTRIP_HTML_Z: [number, number] = [4, 3];

/** Reactiebubbels van de dieren: decoratief, dus onderaan. */
export const CRITTER_HTML_Z: [number, number] = [2, 1];
