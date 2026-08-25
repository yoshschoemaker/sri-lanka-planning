# De reis bewerken

Alles wat de reis is, staat in deze map. Je hoeft er geen code voor aan te raken.

| Bestand | Waarvoor |
| --- | --- |
| `trip.json` | De hele reis: vluchten, stops, activiteiten, dagtrips, foto's, notities, to-do's |
| `decor.json` | Wat er los op de 3D-kaart staat: landmarks, dieren, bomen |
| `schema/` | Zorgt dat je editor meedenkt. Zelf nooit bewerken |

Na een wijziging:

```sh
pnpm validate   # controleert de content
pnpm dev        # bekijken
```

`pnpm build` draait de controle zelf ook, dus een fout houdt de deploy tegen in plaats van een lege pagina op te leveren.

## Datums vul je niet in

Dit is het belangrijkste om te weten. In `trip.json` staan precies twee echte datums, bij de vluchten:

```json
"departAt": "2027-01-25T11:45",
"arriveAt": "2027-01-26T06:10"
```

Alle andere datums worden daaruit berekend. De aankomst van de heenvlucht is dag 1 op het eiland en dus de check-in van de eerste stop. Vanaf daar telt de app per stop het aantal `nights` op, en dat is meteen de check-in van de volgende stop.

Gevolg: **verplaats je een stop of verander je één nacht, dan schuift de rest vanzelf mee.** De regels "wo 27 tot vr 29 jan" onder elke stop, de balk bovenaan en de aftelteller komen allemaal hiervandaan. Zet er dus zelf geen `dates` in, de controle geeft daar een foutmelding op.

De vliegduur (`duration`) is wel handwerk. Vertrek en aankomst staan in verschillende tijdzones, en die uitrekenen zou betekenen dat de app tijdzones en zomertijd moet bijhouden voor een getal dat gewoon op je ticket staat.

De controle rekent na of het totaal klopt: plannen je stops 24 nachten terwijl er 23 tussen aankomst en terugvlucht zitten, dan zegt hij dat, met het verschil erbij.

## Een stop toevoegen

Zet een blok in `stops`, op de plek in de route waar hij hoort. De volgorde in de lijst is de volgorde op de kaart en in het overzicht.

```json
{
  "id": "polonnaruwa",
  "name": "Polonnaruwa",
  "region": "cultural-triangle",
  "nights": 2,
  "booked": false,
  "lat": 7.94,
  "lon": 81.0,
  "transportTo": { "mode": "car", "label": "Auto / taxi / bus", "duration": "± 1 u" },
  "note": "",
  "photos": ["/polonnaruwa.jpg"],
  "activities": [
    { "id": "koninklijk-paleis", "name": "Koninklijk paleis", "dist": "± 2 km", "priority": "must" }
  ]
}
```

Let op:

- **`id`** is een slug (kleine letters, cijfers, koppeltekens) en moet uniek zijn. Verander een bestaande id nooit en hergebruik hem niet: er hangen posities, selecties en ankers aan.
- **`nights: 0`** maakt er een doortocht van: je stopt onderweg, doet iets en rijdt dezelfde dag door. Hij staat wel op de kaart en in de route, maar telt niet mee in de boekingen. Yala is er zo een.
- **`transportTo`** beschrijft hoe je hier vanaf de vórige stop komt. Bij de eerste stop: vanaf het vliegveld.
- **`region`** verwijst naar een id uit `regions` bovenaan het bestand, en zet de stop onder dat kopje in de routelijst. Weglaten mag; dan valt de stop buiten de kopjes, zoals de twee Negombo's.
- **`nights` aanpassen elders**: haal je hier 2 nachten vandaan, dan moet je ze ergens anders weghalen of de vluchten verzetten, anders klaagt de controle.

## Foto's

Zet het bestand in `public/` en verwijs ernaar met een pad dat met `/` begint:

```json
"photos": ["/polonnaruwa.jpg", "/polonnaruwa-2.webp"]
```

Een volledige `https://`-URL mag ook. De controle kijkt of elk lokaal bestand echt bestaat, dus een typefout in de naam merk je meteen in plaats van als een gebroken plaatje.

Foto's kunnen op drie plekken: bij de stop, bij een activiteit, en bij de accommodatie.

## Dagtrips

Een activiteit met `daytrip: true` krijgt een eigen stip op de kaart, met een lijntje naar de stop waar hij bij hoort. Dan zijn `lat` en `lon` verplicht:

```json
{
  "id": "galle-fort",
  "name": "Dagtrip: Galle Fort (UNESCO)",
  "dist": "± 30 min",
  "daytrip": true,
  "lat": 6.03,
  "lon": 80.22,
  "priority": "must"
}
```

## Vervoerssoorten

`transportModes` bepaalt welke soorten er bestaan, met hun kleur op de kaart en icoon in de legenda. Een soort toevoegen is een sleutel erbij:

```json
"boot": { "label": "Boot", "icon": "⛴", "color": "#2f6f8f", "style": "dashed" }
```

Daarna kan elke stop `"mode": "boot"` gebruiken. De legenda, de filterknoppen en de vervoersbalk bij de statistieken bouwen zichzelf uit deze lijst.

Twee soorten zijn extra uitgewerkt in de 3D-kaart: `train` krijgt een locomotief, `car` en `tuktuk` een wegvoertuig. Een nieuwe soort krijgt gewoon een lijn zonder voertuig, dat werkt prima.

## De kaart bijsturen

Meestal hoeft dit niet: de marker en het naamlabel volgen `lat`/`lon`. Alleen als twee dingen elkaar overlappen zet je een `map`-blok op de stop:

```json
"map": {
  "nudge2d": { "dx": 20, "dy": 22 },
  "label2d": { "dx": 0, "dy": 22, "anchor": "middle" },
  "nudge3d": { "dx": 0.32, "dz": 0.3 },
  "label3d": "left"
}
```

- `nudge2d` verschuift de marker op de platte kaart, in pixels.
- `label2d` zet het naamlabel neer; standaard staat het rechts van de marker. `anchor` is waar de tekst zich op uitlijnt.
- `nudge3d` verschuift de marker op de 3D-kaart, in wereldeenheden (x = oost, z = zuid).
- `label3d` bepaalt naar welke kant het label openklapt. Zelden nodig: in 3D is er maar één label tegelijk zichtbaar.

De twee Negombo's hebben dit nodig omdat ze exact dezelfde coördinaten hebben. Hiriketiya en Mirissa omdat de zuidkust vol staat.

Een dagtrip kan hetzelfde doen met `"map": { "labelOffset3d": -40 }` (negatief is naar links).

## decor.json

Alles wat met de hand op het 3D-eiland is neergezet. De coördinaten zijn géén lat/lon maar wereldeenheden van de scène (x = oost, z = zuid), want deze dingen zijn op het oog geplaatst tegen het terrein: een fort moet vrij van de kustrand staan, een waterval heeft een echte steilrand nodig.

Verplaatsen, verwijderen of nog eentje neerzetten is een JSON-bewerking:

```json
{ "type": "temple", "x": -0.38, "z": 0.1, "note": "Dambulla Cave Temple" }
```

Beschikbare types: `palmTree`, `stupa`, `temple`, `sigiriyaRock`, `nineArches`, `galleFort`, `waterfall`, `leopard`, `elephant`, `peacock`, `fishSchool`, `turtle`, `whale`, `monkeyGrove`.

- `rotation` (radialen) werkt bij `nineArches` en `waterfall`.
- `fireflies: true` werkt bij `temple`.
- `monkeyGrove` heeft geen `x`/`z` maar een lijst `trees`: de bomen in de volgorde waarin de aap ze bezoekt.
- `note` is alleen voor jezelf en wordt nergens getoond.

`clearance` bovenaan zegt hoeveel ruimte elk soort object voor zichzelf opeist. De procedurele begroeiing groeit daar niet doorheen, dus zonder die ruimte staat er een boom dwars door je stupa. Ruimer maken mag altijd; krapper zetten vraagt om even kijken of het nog klopt.

**Dit is de enige grens.** Een nieuw *soort* object (een vuurtoren, een tweede diersoort) is echt nieuwe code: een 3D-component plus een regel in `src/components/map3d/DecorLayer.tsx`, een nieuw type in `DECOR_TYPES` in `src/data/mapDecor.ts` en in `schema/decor.schema.json`. Meer van iets dat er al is, is altijd JSON.

## Wat er niét in staat

Het eiland zelf: de kustlijn, de hoogtekaart, de klimaatzones en welke planten waar groeien. Dat is Sri Lanka, niet je reis, en het staat in `src/data/`. Dat verander je alleen als de reis naar een ander land gaat.

## Als er iets misgaat

`pnpm validate` noemt het probleem met de stop of het decorobject erbij. Tijdens `pnpm dev` verschijnen dezelfde soort meldingen in de console van de browser, met `[content]` of `[decor]` ervoor.
