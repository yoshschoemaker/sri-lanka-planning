/**
 * De geparkeerde tuktuk op de 3D-kaart opent de mini-game. De kaart is een
 * losse, lui geladen chunk; met een window-event in plaats van een callback
 * hoeft er geen prop door TripMapScene, TripMap3D en DecorLayer heen.
 */
export const TUKTUK_EASTER_EGG_EVENT = "srilanka-trip:tuktuk-easter-egg";

export function openTuktukEasterEgg(): void {
  window.dispatchEvent(new Event(TUKTUK_EASTER_EGG_EVENT));
}
