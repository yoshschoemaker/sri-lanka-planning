import type { Trip, TransportMode, TransportModeKey, Stop } from "../types/trip";

export const trip: Trip = {
  title: "Sri Lanka rondreis",
  start: "2027-01-25",
  end: "2027-02-18",
  totalNights: 23,
  flights: {
    outbound: {
      airline: "Turkish Airlines",
      via: "Istanbul (IST)",
      date: "ma 25 jan",
      from: "AMS",
      depart: "11:45",
      to: "CMB",
      arrive: "26 jan 06:10",
      duration: "13u55",
      booked: true,
    },
    return: {
      airline: "Turkish Airlines",
      via: "Istanbul (IST)",
      date: "do 18 feb",
      from: "CMB",
      depart: "07:40",
      to: "AMS",
      arrive: "18 feb 17:20",
      duration: "14u10",
      booked: true,
    },
  },
  bookingSummary: {
    booked: "vluchten + Negombo (The Beach Apartments)",
    toBook: "8 verblijven",
  },
};

export const transportModes: Record<TransportModeKey, TransportMode> = {
  car: { label: "Auto / taxi / bus", icon: "🚗", color: "#215761", style: "solid" },
  train: { label: "Trein", icon: "🚂", color: "#6b3fa8", style: "solid" },
  tuktuk: { label: "Tuk-tuk", icon: "🛺", color: "#cf7411", style: "dashed" },
};

export const stops: Stop[] = [
  {
    id: "negombo-arrival",
    name: "Negombo",
    dates: "di 26 tot wo 27 jan",
    nights: 1,
    booked: true,
    lat: 7.21,
    lon: 79.84,
    transportTo: { mode: "car", label: "Taxi vanaf luchthaven (CMB)", duration: "15-25 min" },
    note: "Aankomst 06:10",
    accommodation: {
      name: "The Beach Apartments",
      note: "Geboekt · 1 nacht",
      photos: ["/negombo-the-beach-apartments.jpg"],
    },
    photos: ["/negombo-arrival.webp"],
    activities: [
      { id: "nederlands-fort", name: "Nederlands fort", dist: "in stad", photos: [], priority: "nice" },
      { id: "muthurajawela-moeras", name: "Muthurajawela moeras", dist: "± 15 min", photos: [], priority: "nice" },
      { id: "vismarkt-lagune", name: "Vismarkt & lagune", dist: "in stad", photos: [], priority: "nice" },
    ],
  },
  {
    id: "anuradhapura",
    name: "Anuradhapura",
    dates: "wo 27 tot vr 29 jan",
    nights: 2,
    booked: false,
    lat: 8.31,
    lon: 80.41,
    transportTo: { mode: "car", label: "Auto / taxi / bus", duration: "± 3,5 u" },
    note: "Culturele driehoek · Wilpattu als dagtrip",
    photos: ["/anuradhapura.jpg"],
    activities: [
      {
        id: "witte-tempel-heilige-stad",
        name: "Witte tempel / heilige stad",
        dist: "± 4 km",
        photos: ["/anuradhapura.jpg"],
        priority: "must",
      },
      { id: "sri-maha-bodhi", name: "Sri Maha Bodhi (heilige boom)", dist: "± 4 km", photos: [], priority: "must" },
      { id: "mihintale", name: "Mihintale", dist: "± 13 km", photos: [], priority: "nice" },
      {
        id: "wilpattu-jeep-safari",
        name: "Dagtrip: jeep-safari Wilpattu NP",
        dist: "± 1 u",
        daytrip: true,
        lat: 8.45,
        lon: 80.02,
        photos: [],
        priority: "nice",
      },
    ],
  },
  {
    id: "sigiriya",
    name: "Sigiriya",
    dates: "vr 29 jan tot ma 1 feb",
    nights: 3,
    booked: false,
    lat: 7.95,
    lon: 80.75,
    transportTo: { mode: "car", label: "Auto / taxi / bus", duration: "± 1,5 u" },
    note: "",
    photos: ["/sigiriya.jpg"],
    activities: [
      {
        id: "leeuwenrots",
        name: "Leeuwenrots (Sigiriya)",
        dist: "in de buurt",
        photos: ["/sigiriya.jpg"],
        priority: "must",
      },
      { id: "pidurangala-rock", name: "Pidurangala Rock", dist: "± 2 km", photos: [], priority: "nice" },
      {
        id: "dambulla-cave-temple",
        name: "Dagtrip: Dambulla Cave Temple",
        dist: "± 20 km",
        daytrip: true,
        lat: 7.86,
        lon: 80.65,
        photos: [],
        priority: "must",
      },
    ],
  },
  {
    id: "kandy",
    name: "Kandy",
    dates: "ma 1 tot wo 3 feb",
    nights: 2,
    booked: false,
    lat: 7.29,
    lon: 80.63,
    transportTo: { mode: "car", label: "Auto / taxi / bus", duration: "± 2,5 u" },
    note: "",
    photos: ["/kandy.jpeg"],
    activities: [
      { id: "tempel-van-de-tand", name: "Tempel van de Tand", dist: "in centrum", photos: [], priority: "must" },
      { id: "botanische-tuin-peradeniya", name: "Botanische tuin Peradeniya", dist: "± 6 km", photos: [], priority: "nice" },
      { id: "kandy-lake", name: "Kandy Lake", dist: "in centrum", photos: [], priority: "maybe" },
    ],
  },
  {
    id: "ella",
    name: "Ella",
    dates: "wo 3 tot zo 7 feb",
    nights: 4,
    booked: false,
    lat: 6.87,
    lon: 81.05,
    transportTo: { mode: "train", label: "Scenische trein Kandy → Ella", duration: "± 6-7 u" },
    note: "Reserveer de trein vooraf",
    photos: ["/ella.webp"],
    activities: [
      { id: "little-adams-peak", name: "Little Adam's Peak", dist: "± 2 km", photos: [], priority: "must" },
      {
        id: "nine-arches-bridge",
        name: "Nine Arches Bridge",
        dist: "± 3 km",
        photos: ["/ella.webp"],
        priority: "must",
      },
      { id: "ravana-falls", name: "Ravana Falls", dist: "± 6 km", photos: [], priority: "nice" },
      { id: "theeplantages", name: "Theeplantages", dist: "rondom", photos: [], priority: "nice" },
    ],
  },
  {
    id: "yala",
    name: "Yala",
    dates: "zo 7 feb",
    nights: 0,
    booked: false,
    lat: 6.37,
    lon: 81.52,
    transportTo: { mode: "tuktuk", label: "Tuk-tuk", duration: "± 3 u" },
    note: "Tussenstop op de doortocht Ella → Hiriketiya: safari in het park, daarna dezelfde dag door naar de kust",
    photos: ["/yala.jpg"],
    activities: [
      { id: "jeep-safari-yala-np", name: "Jeep-safari Yala NP", dist: "bij het park", photos: [], priority: "must" },
      { id: "luipaarden-spotten", name: "Luipaarden spotten", dist: "in het park", photos: [], priority: "nice" },
    ],
  },
  {
    id: "hiriketiya",
    name: "Hiriketiya",
    dates: "zo 7 tot do 11 feb",
    nights: 4,
    booked: false,
    lat: 5.96,
    lon: 80.71,
    transportTo: { mode: "tuktuk", label: "Tuk-tuk", duration: "± 2,5 u" },
    note: "Rustige zuidkust · aankomst na de safari in Yala",
    photos: ["/hiriketiya.jpeg"],
    activities: [
      { id: "hiriketiya-bay", name: "Hiriketiya Bay (surf/zwemmen)", dist: "aan de baai", photos: [], priority: "must" },
      { id: "rustige-stranden", name: "Stranden Dikwella & Tangalle", dist: "± 10-20 min", photos: [], priority: "nice" },
      { id: "rekawa-schildpaddenstrand", name: "Rekawa schildpaddenstrand", dist: "± 25 min", photos: [], priority: "must" },
      { id: "mulkirigala-rotstempel", name: "Mulkirigala rotstempel", dist: "± 30 min", photos: [], priority: "maybe" },
    ],
  },
  {
    id: "mirissa",
    name: "Mirissa",
    dates: "do 11 tot zo 14 feb",
    nights: 3,
    booked: false,
    lat: 5.95,
    lon: 80.46,
    transportTo: { mode: "tuktuk", label: "Tuk-tuk", duration: "± 1 u" },
    note: "Zuidkust",
    photos: ["/mirissa.jpg"],
    activities: [
      { id: "walvistocht", name: "Walvistocht (blauwe vinvis)", dist: "vanaf haven", photos: [], priority: "must" },
      { id: "coconut-tree-hill", name: "Coconut Tree Hill", dist: "± 1 km", photos: [], priority: "must" },
      { id: "strand-uitrusten", name: "Strand / uitrusten", dist: "in de buurt", photos: [], priority: "nice" },
    ],
  },
  {
    id: "hikkaduwa",
    name: "Hikkaduwa",
    dates: "zo 14 tot wo 17 feb",
    nights: 3,
    booked: false,
    lat: 6.14,
    lon: 80.1,
    transportTo: { mode: "tuktuk", label: "Tuk-tuk", duration: "± 1,5 u" },
    note: "Zuidwestkust · Galle als dagtrip",
    photos: ["/hikkaduwa.webp"],
    activities: [
      { id: "coral-sanctuary", name: "Coral Sanctuary (snorkelen)", dist: "aan het strand", photos: [], priority: "must" },
      { id: "zeeschildpadden-spotten", name: "Zeeschildpadden spotten", dist: "aan het strand", photos: [], priority: "nice" },
      {
        id: "galle-fort",
        name: "Dagtrip: Galle Fort (UNESCO)",
        dist: "± 30 min",
        daytrip: true,
        lat: 6.03,
        lon: 80.22,
        photos: [],
        priority: "must",
      },
    ],
  },
  {
    id: "negombo-departure",
    name: "Negombo",
    dates: "wo 17 tot do 18 feb",
    nights: 1,
    booked: false,
    lat: 7.21,
    lon: 79.84,
    transportTo: {
      mode: "car",
      label: "Auto / bus (snelweg)",
      duration: "± 2,5 u",
      warn: "tuk-tuk mag niet op de snelweg",
    },
    note: "Overnachten bij vliegveld (± 10 min van CMB) i.v.m. vlucht 7.40",
    photos: ["/negombo-departure.jpeg"],
    activities: [{ id: "vlucht-terug", name: "Vlucht do 18 feb", dist: "07:40", photos: [] }],
  },
];

if (import.meta.env.DEV) {
  const seenStopIds = new Set<string>();
  const seenActivityIds = new Set<string>();
  for (const stop of stops) {
    if (seenStopIds.has(stop.id)) console.warn(`[data] Duplicate stop id: "${stop.id}"`);
    seenStopIds.add(stop.id);
    for (const activity of stop.activities) {
      if (seenActivityIds.has(activity.id)) console.warn(`[data] Duplicate activity id: "${activity.id}"`);
      seenActivityIds.add(activity.id);
      if (activity.daytrip && (activity.lat == null || activity.lon == null)) {
        console.warn(`[data] Daytrip activity "${activity.id}" is missing lat/lon`);
      }
    }
  }
}

export const notes: string[] = [
  "Nachtenverdeling is een voorstel; alleen de vluchten en Negombo (The Beach Apartments) zijn geboekt.",
  "Luchthaven is CMB (Bandaranaike), ~10 min van Negombo.",
  "Totaal moet uitkomen op 23 nachten (26 jan t/m 17 feb).",
  "Yala is een tussenstop zonder overnachting: safari op de doortocht van Ella naar Hiriketiya (zo 7 feb).",
];

export const openQuestions: string[] = [];

export const todos: string[] = ["Visum regelen"];
