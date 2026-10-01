# Dailies auf wexplore.at

Dieses Repo bleibt die Quelle der Dailies-Seite. Das Skript `sync.mjs` baut daraus einen
Block für Storyblok, und wexplore.at zeigt ihn unter **https://www.wexplore.at/leistungen/dailies**.
GitHub Pages (https://wexalex.github.io/dailies/) bleibt die Arbeitsfassung.

Es ist derselbe Weg wie bei der Projektkomm-Seite: eine Story vom Typ `page` mit Meta-Daten
und genau einem Block „Custom Code (HTML)“ (`section-custom-html-inline`). Laravel rendert
den Block direkt ins DOM. Oben steht die eigene Dailies-Kopfleiste mit CTA, die Navigation der
Website ist auf dieser Seite ausgeblendet. Der Footer kommt von der Website.

## Ablauf

```bash
node tools/storyblok/sync.mjs pruefen      # Klassen gegen das CSS von wexplore.at prüfen
node tools/storyblok/sync.mjs assets       # neue oder geänderte Bilder, Videos, Schriften hochladen
node tools/storyblok/sync.mjs build        # Block bauen: dist/storyblok/block.html
node tools/storyblok/sync.mjs vorschau     # Block in die echte Hülle von wexplore.at setzen
node tools/storyblok/sync.mjs entwurf      # Story in Storyblok aktualisieren, nichts geht live
node tools/storyblok/sync.mjs live --ja    # veröffentlichen, geht sofort live
```

Die Vorschau liegt danach in `dist/storyblok/vorschau/`. Ansehen mit
`python3 -m http.server 4174 --directory dist/storyblok/vorschau` und http://localhost:4174/.
Sie nutzt CSS, JavaScript und Schriften von wexplore.at, ohne Google Tag Manager und reCAPTCHA.
`build --lokal` baut mit lokalen Asset-Pfaden, um vor dem Upload zu prüfen.

## Was der Build macht

- Bereiche zwischen `<!-- storyblok:weglassen -->` und `<!-- /storyblok:weglassen -->` in
  `index.html` fallen weg. Das ist nur noch der eigene Footer.
- Alles liegt in `<div class="wx-dailies">`. Jede CSS-Regel bekommt `.wx-dailies` davor.
- Ein Schutz-CSS setzt innerhalb von `.wx-dailies` alles auf Browser-Standard zurück
  (`all: revert`). Die Seite wurde gegen die Browser-Standards gebaut, das CSS von
  wexplore.at (Bootstrap und eigene Regeln für p, h1, ul, a, img) wirkt so nicht hinein.
- Klassen, die es auch auf wexplore.at gibt, werden umbenannt (`btn`, `nav`, `active`, `h2`,
  Liste in `config.json`). `pruefen` meldet neue Überschneidungen.
- Schriften heißen im Block „WX Dailies Kurrent“ und „WX Dailies Plakat“. Regular, Bold und
  Plakat kommen aus `/fonts/` von wexplore.at, das sind dieselben Dateien. Light und Semibold
  hat die Website nicht, sie liegen in Storyblok.
- `assets/config.js` steht als erstes Skript im Block, `window.DAILIES` ist also von Anfang an da.
- Asset-Pfade zeigen auf Storyblok (`tools/storyblok/assets.json`), Adressen von GitHub Pages
  in den strukturierten Daten auf wexplore.at.
- Titel, Beschreibung und OG-Bild aus dem `<head>` landen im Meta-Block der Story.
- Links auf weitere Seiten des Repos (`referenzen.html`, `projekte/...`) zeigen auf GitHub Pages,
  solange es diese Seiten auf wexplore.at nicht gibt. Der Build listet sie auf.
- Elemente mit `hidden`, die noch Platzhalter `[[...]]` enthalten, fallen weg. Das sind
  vorbereitete Komponenten. Ohne `hidden` und mit echten Inhalten kommen sie automatisch mit.

Anpassungen nur für wexplore.at stehen in `wexplore.css`: Die Navigation der Website ist auf
dieser Seite ausgeblendet (`#main-nav`), das Overlay liegt sicherheitshalber über ihr (z-index).
Die Regel steht im Block und damit im `<body>`. Auf langsamen Verbindungen zeigt der Browser die
Navigation darum eventuell einen Moment lang. Sauber wäre ein Schalter im Seitentyp, den Laravel
im Layout auswertet.

## Regeln

- Den Block nie in Storyblok bearbeiten. Der nächste Abgleich ersetzt ihn. `entwurf` bricht
  ab, wenn der Block in Storyblok seit dem letzten Abgleich geändert wurde.
- `live` verweigert, solange Platzhalter `[[...]]` im Text stehen oder der Entwurf in Storyblok
  nicht dem letzten Build entspricht.
- Bilder und Videos neu oder geändert: zuerst `assets`, sonst bricht `build` ab.

## Token

Das Skript braucht einen Personal Access Token von Storyblok (Management API). Es liest ihn
aus der Umgebungsvariable `STORYBLOK_TOKEN` oder aus dem macOS-Schlüsselbund:

```bash
security add-generic-password -U -a "$USER" -s storyblok-mapi -w
```

Der Befehl fragt den Token ab, ohne dass er in der Shell-Historie landet. Der Token gehört nie
ins Repo und nie in eine Datei im Projekt.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `sync.mjs` | das Skript, ohne Abhängigkeiten, Node 20 oder neuer |
| `config.json` | Space, Ziel-Adresse, Story, Umbenennungen, Schriften |
| `wexplore.css` | Anpassungen nur für wexplore.at |
| `assets.json` | welche Datei aus `assets/` unter welcher Storyblok-Adresse liegt |
| `stand.json` | Story-ID, Asset-Ordner, letzter Abgleich |
