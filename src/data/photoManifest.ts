/**
 * GEGENEREERD BESTAND. Niet met de hand aanpassen.
 *
 * Gemaakt door `pnpm photos` (scripts/generate-photos.mjs) uit de bronfoto's in
 * photos/. De sleutel is het pad zoals content/trip.json het noemt ("/ella.webp");
 * de varianten zijn de daadwerkelijk uitgeleverde bestanden in public/photos/.
 *
 * `hash` is een vingerafdruk van het bronbestand. `pnpm validate` vergelijkt
 * hem, zodat een aangepaste foto zonder regenereren de build tegenhoudt in plaats
 * van stilletjes de oude versie te blijven tonen.
 */

export interface PhotoVariant {
  width: number;
  url: string;
}

export interface PhotoEntry {
  /** Intrinsieke breedte van de bronfoto, voor de aspect-ratio en het voorkomen van layout shift. */
  width: number;
  /** Intrinsieke hoogte van de bronfoto. */
  height: number;
  /** sha256-prefix van het bronbestand in photos/. */
  hash: string;
  /** Oplopend gesorteerd op breedte; de laatste is de grootste. */
  variants: PhotoVariant[];
}

export const photoManifest: Record<string, PhotoEntry> = {
  "/anuradhapura-ceylonima-home-stay.png": {
    width: 1024,
    height: 768,
    hash: "ccac1867a2b8",
    variants: [
      { width: 320, url: "/photos/anuradhapura-ceylonima-home-stay-320.webp" },
      { width: 640, url: "/photos/anuradhapura-ceylonima-home-stay-640.webp" },
      { width: 1024, url: "/photos/anuradhapura-ceylonima-home-stay-1024.webp" },
    ],
  },
  "/anuradhapura.jpg": {
    width: 1600,
    height: 1066,
    hash: "d3abc68b2700",
    variants: [
      { width: 320, url: "/photos/anuradhapura-320.webp" },
      { width: 640, url: "/photos/anuradhapura-640.webp" },
      { width: 1280, url: "/photos/anuradhapura-1280.webp" },
    ],
  },
  "/ella-ravana-pool-club.png": {
    width: 1000,
    height: 700,
    hash: "0297b4b61076",
    variants: [
      { width: 320, url: "/photos/ella-ravana-pool-club-320.webp" },
      { width: 640, url: "/photos/ella-ravana-pool-club-640.webp" },
      { width: 1000, url: "/photos/ella-ravana-pool-club-1000.webp" },
    ],
  },
  "/ella.webp": {
    width: 1600,
    height: 1067,
    hash: "d551e97de6e1",
    variants: [
      { width: 320, url: "/photos/ella-320.webp" },
      { width: 640, url: "/photos/ella-640.webp" },
      { width: 1280, url: "/photos/ella-1280.webp" },
    ],
  },
  "/hikkaduwa.webp": {
    width: 1600,
    height: 1200,
    hash: "9fad2c9618b0",
    variants: [
      { width: 320, url: "/photos/hikkaduwa-320.webp" },
      { width: 640, url: "/photos/hikkaduwa-640.webp" },
      { width: 1280, url: "/photos/hikkaduwa-1280.webp" },
    ],
  },
  "/hiriketiya.jpeg": {
    width: 900,
    height: 601,
    hash: "5baeed9fe2ae",
    variants: [
      { width: 320, url: "/photos/hiriketiya-320.webp" },
      { width: 640, url: "/photos/hiriketiya-640.webp" },
      { width: 900, url: "/photos/hiriketiya-900.webp" },
    ],
  },
  "/kandy.jpeg": {
    width: 554,
    height: 554,
    hash: "37cc6e09f7fc",
    variants: [
      { width: 320, url: "/photos/kandy-320.webp" },
      { width: 554, url: "/photos/kandy-554.webp" },
    ],
  },
  "/mirissa.jpg": {
    width: 745,
    height: 515,
    hash: "d8634b6c8aca",
    variants: [
      { width: 320, url: "/photos/mirissa-320.webp" },
      { width: 640, url: "/photos/mirissa-640.webp" },
      { width: 745, url: "/photos/mirissa-745.webp" },
    ],
  },
  "/negombo-arrival.webp": {
    width: 1050,
    height: 749,
    hash: "60134ea336e2",
    variants: [
      { width: 320, url: "/photos/negombo-arrival-320.webp" },
      { width: 640, url: "/photos/negombo-arrival-640.webp" },
      { width: 1050, url: "/photos/negombo-arrival-1050.webp" },
    ],
  },
  "/negombo-departure.jpeg": {
    width: 678,
    height: 452,
    hash: "84efea4161d2",
    variants: [
      { width: 320, url: "/photos/negombo-departure-320.webp" },
      { width: 640, url: "/photos/negombo-departure-640.webp" },
      { width: 678, url: "/photos/negombo-departure-678.webp" },
    ],
  },
  "/negombo-the-beach-apartments.jpg": {
    width: 1024,
    height: 683,
    hash: "829c8fe2ce11",
    variants: [
      { width: 320, url: "/photos/negombo-the-beach-apartments-320.webp" },
      { width: 640, url: "/photos/negombo-the-beach-apartments-640.webp" },
      { width: 1024, url: "/photos/negombo-the-beach-apartments-1024.webp" },
    ],
  },
  "/sigiriya-nelu-villa.png": {
    width: 1024,
    height: 768,
    hash: "6a48d2f841d6",
    variants: [
      { width: 320, url: "/photos/sigiriya-nelu-villa-320.webp" },
      { width: 640, url: "/photos/sigiriya-nelu-villa-640.webp" },
      { width: 1024, url: "/photos/sigiriya-nelu-villa-1024.webp" },
    ],
  },
  "/sigiriya.jpg": {
    width: 700,
    height: 466,
    hash: "544f64e652f2",
    variants: [
      { width: 320, url: "/photos/sigiriya-320.webp" },
      { width: 640, url: "/photos/sigiriya-640.webp" },
      { width: 700, url: "/photos/sigiriya-700.webp" },
    ],
  },
  "/yala.jpg": {
    width: 669,
    height: 446,
    hash: "8a8448dec4a9",
    variants: [
      { width: 320, url: "/photos/yala-320.webp" },
      { width: 640, url: "/photos/yala-640.webp" },
      { width: 669, url: "/photos/yala-669.webp" },
    ],
  },
};
