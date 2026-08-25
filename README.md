# Sri Lanka rondreis · 2027

Reisplanning voor de rondreis door Sri Lanka, 25 januari tot 18 februari 2027. Eén pagina met de route, de dagplanning, een 3D-kaart van het eiland en een checklist van wat er nog geregeld moet worden. Draait als PWA, dus je kunt hem op je beginscherm zetten en onderweg zonder bereik gebruiken.

## Aan de slag

Node staat vast op de versie in [`.nvmrc`](.nvmrc); pnpm heeft Node 22 of nieuwer nodig.

```bash
nvm use
pnpm install
pnpm dev
```

| Commando | Wat het doet |
| --- | --- |
| `pnpm dev` | Dev-server met HMR. De service worker staat hier uit, zie hieronder. |
| `pnpm build` | Content valideren, linten, testen, typechecken, bundelen. Faalt de eerste stap, dan komt er geen deploy. |
| `pnpm preview` | De echte build lokaal, inclusief service worker. |
| `pnpm test` | Vitest, eenmalig. `pnpm test:watch` blijft draaien. |
| `pnpm lint` | oxlint, inclusief de type-aware regels. |
| `pnpm audit:a11y` | Loopt de app met axe door. Vraagt een gemaakte build. |
| `pnpm validate` | Alleen de content-controle uit `pnpm build`. |
| `pnpm photos` | Genereert de uitgeleverde foto-varianten. Zie [Foto's](#fotos). |
| `pnpm generate-pwa-assets` | Genereert app-iconen en iOS-launchafbeeldingen uit `public/favicon.svg`. |

## De reis aanpassen

**Alles wat de reis beschrijft staat in [`content/trip.json`](content/trip.json).** Niets in `src/` hoeft aan om een stop toe te voegen, een nacht te verschuiven of een activiteit te wijzigen. Lees [`content/README.md`](content/README.md) voordat je die JSON aanpast: daar staat per veld wat het doet.

Twee dingen zijn daarbij het belangrijkst om te weten:

**Datums zijn afgeleid, niet ingetypt.** De JSON bevat twee vluchttijden en per stop een aantal nachten. Daaruit rekent [`src/data/tripContent.ts`](src/data/tripContent.ts) alle check-in- en check-outdatums, de duur van de reis, het nachtenbudget en de boekingssamenvatting uit. Eén nacht wijzigen herdateert de hele route. Er staan dus nergens datumstrings die uit de pas kunnen gaan lopen.

**Fouten in de content houden de build tegen.** [`scripts/validate-content.mjs`](scripts/validate-content.mjs) draait als eerste stap van `pnpm build` en controleert wat een JSON Schema niet kan: verwijzingen tussen bestanden, dubbele id's, ontbrekende foto's, en of het aantal geplande nachten wel in de vluchten past. Het schema in [`content/schema/`](content/schema/) doet het werk in je editor.

De 3D-decoratie op de kaart (palmen, tempels, olifanten) staat los in [`content/decor.json`](content/decor.json).

## Foto's

Bronfoto's staan in [`photos/`](photos/) en worden **niet** uitgeleverd. `pnpm photos` maakt daar webp-varianten van in `public/photos/` op 320, 640 en 1280 pixels breed, plus [`src/data/photoManifest.ts`](src/data/photoManifest.ts) met de afmetingen en de srcset per foto.

Dat is er om twee redenen zo:

- Een duimnagel van 128px laadde eerst het volledige bestand van 1600px breed. Nu haalt een telefoon de 320-variant van zo'n 25 KB op.
- Alleen de varianten belanden in de offline-precache, niet de veel grotere bronbestanden.

Werkwijze bij een nieuwe of aangepaste foto:

1. Zet het bestand in `photos/`.
2. Verwijs er in `content/trip.json` naar met het pad vanaf die map, dus `/kandy.jpeg`.
3. Draai `pnpm photos` en commit zowel `public/photos/` als het manifest.

Vergeet je stap 3, dan valt de build om: `pnpm validate` vergelijkt een hash van elk bronbestand met het manifest en meldt een verouderde of ontbrekende variant. Gebruik in de UI altijd `<Photo>` of `getPhotoAttrs` uit [`src/utils/photos.ts`](src/utils/photos.ts), nooit een kale `<img src>`, anders mis je de srcset en de afmetingen die layout shift voorkomen.

## Structuur

```
content/          De reis zelf: trip.json, decor.json en hun JSON Schema's
photos/           Bronfoto's (niet uitgeleverd)
scripts/          Content-validatie en de foto-pijplijn
src/components/   UI. map3d/ is de 3D-kaart, los code-split.
src/data/         trip.json omgezet naar wat de app rendert, plus gebakken geometrie
src/utils/        Datumrekenwerk, hooks, projecties
public/           Uitgeleverde assets: iconen, launchafbeeldingen, photos/
```

De 3D-kaart is een aparte chunk van ~300 KB gzip die pas geladen wordt als hij nodig is. Zonder WebGL2, of als de scene crasht, valt [`TripMapScene`](src/components/TripMapScene.tsx) terug op de 2D-SVG-kaart met dezelfde props. Er is dus nooit een lege of gebroken kaart.

## PWA en updates

De service worker staat op `registerType: "prompt"`: een nieuwe versie wisselt pas na een klik, zodat de app niet halverwege het gebruik onder je vandaan wordt vervangen. Alles zit in de precache en er is geen enkele runtime-request, ook niet voor fonts.

In `pnpm dev` staat de service worker uit, want een actieve worker verbergt je HMR-wijzigingen. Test PWA-gedrag dus met `pnpm build && pnpm preview`.

## Tests

Twee projecten, gesplitst op bestandsextensie (zie [`vitest.config.ts`](vitest.config.ts)):

- **`.test.ts`** draait in node en dekt het rekenwerk waar een fout stil doorwerkt: datumafleiding, aftellen, nachtencontrole, checklist, en welke stop "vandaag" is. Geen jsdom, zodat het opvalt als er per ongeluk een browser-API in een rekenfunctie sluipt.
- **`.test.tsx`** draait in jsdom en dekt de dingen die je niet met een pure functie test: de focus-trap en scroll-lock van `useDialog`, de veeg- en pinchgebaren van de lightbox, het afvinken van de checklist, en de srcset die `Photo` opbouwt.

Er zitten ook tests op de echte inhoud van `trip.json` (sluiten de stops aan, zijn de id's uniek), zodat een contentfout niet alleen bij het bouwen maar ook bij het testen opvalt.

De config staat los van de vite-config: die trekt via de PWA-plugin sharp binnen, wat elke testrun twee libvips-versies liet laden.

## Toegankelijkheid

`pnpm audit:a11y` start `vite preview` en loopt zes toestanden met axe door: mobiel en desktop, alles uitgeklapt, de kaart in zijn beeldvullende modal, het instellingenpaneel en de fotoweergave. Zie [`scripts/audit-a11y.mjs`](scripts/audit-a11y.mjs).

Dit staat in CI omdat het precies de fouten vangt die je met het oog niet ziet: een dialoog zonder `role`, een `<ol>` met een `<div>` erin, een tweede `<h1>` op de pagina. Twee dingen om in de gaten te houden bij nieuw werk:

- Elke overlay hoort via [`useDialog`](src/utils/useDialog.ts) te lopen. Die regelt scroll-lock (gestapeld, want ze openen bovenop elkaar), Escape, de focus-trap en het teruggeven van de focus aan wat de dialoog opende.
- Zet geen `aria-label` op een element dat zelf bedieningselementen bevat: dat vervangt de hele inhoud door één regel tekst. Geef de bediening zelf een naam.

## Iconen

Alle iconen staan als inline SVG in [`icons.tsx`](src/components/icons.tsx) en erven `currentColor`. Bewust geen emoji: die renderen per platform anders (🗓 is op iOS een blauwe scheurkalender en op Android een grijze) en volgen het palet niet.

Eén uitzondering: de vervoerssoorten houden hun emoji, want die staan in `content/trip.json` en zijn dus inhoud die je zonder code moet kunnen aanpassen.

## Waar de bundel heen gaat

De 3D-kaart is een chunk van ~1,1 MB (304 KB gzip). Toegewezen via de sourcemap is dat 63% three.js, 16% @react-three/fiber, 13% eigen kaartcode, 5% camera-controls en 1% drei. De barrel-import van drei is dus al volledig tree-shaken; per-module importeren levert niets op. Het enige echte lever is het niet laden van de kaart, en dat gebeurt al: de chunk komt via `React.lazy` en alleen als er WebGL2 is.
