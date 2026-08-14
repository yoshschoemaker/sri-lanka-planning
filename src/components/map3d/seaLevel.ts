/**
 * Where the sea sits, and how far it swings.
 *
 * Pulled out of Water.tsx into its own module because six other things have to
 * agree with it — the island's beach shelf, the wave-crest decals, the turtle,
 * the whale, the fish school and the sea sparkles — and they used to agree by
 * each hard-coding a number a few hundredths apart from the plane's. That was
 * survivable while the sea was a backdrop. It stopped being survivable once the
 * island grew a beach: the shelf's top has to clear the highest swell by a
 * knowable margin, and its underside has to clear the lowest.
 *
 * No "three" import on purpose, so anything can read these without pulling in
 * geometry it doesn't need.
 */

/**
 * Mean sea level. Deliberately high in the island's own vertical range rather
 * than near zero: the island reads as a solid block of land whose *exposed*
 * side wall is short. Sinking the land instead would have worked too, but every
 * prop on it — palms, temples, boulders, the markers — is sized in world units
 * against the old surface height, so dropping the land turns a coconut palm
 * into a landmark taller than the hill country.
 */
export const SEA_LEVEL_Y = 0.41;

/** Water.tsx's vertex shader displaces the plane by height() * 0.09, and height() peaks at 1.25. */
export const WAVE_AMPLITUDE = 0.1125;

/** The highest a swell ever reaches. Anything meant to stay dry has to sit above this, not above SEA_LEVEL_Y. */
export const WATER_CREST_Y = SEA_LEVEL_Y + WAVE_AMPLITUDE;

/** The lowest a trough ever dips. Anything meant to stay hidden underwater has to sit below this. */
export const WATER_TROUGH_Y = SEA_LEVEL_Y - WAVE_AMPLITUDE;
