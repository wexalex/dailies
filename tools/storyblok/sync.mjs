#!/usr/bin/env node
/*
 * DAILIES nach wexplore.at (Storyblok)
 *
 *   node tools/storyblok/sync.mjs build            Block bauen: dist/storyblok/block.html und meta.json
 *   node tools/storyblok/sync.mjs build --lokal    dasselbe mit lokalen Asset-Pfaden, nur fuer die Vorschau
 *   node tools/storyblok/sync.mjs assets           Bilder, Video und Schriften nach Storyblok laden (nur neue oder geaenderte)
 *   node tools/storyblok/sync.mjs vorschau         Block in die echte Huelle von wexplore.at setzen: dist/storyblok/vorschau/
 *   node tools/storyblok/sync.mjs entwurf          Story als Entwurf anlegen oder aktualisieren. Nichts geht live.
 *   node tools/storyblok/sync.mjs live --ja        Story veroeffentlichen. Geht sofort auf wexplore.at live.
 *   node tools/storyblok/sync.mjs pruefen          Dailies-Klassen gegen das aktuelle CSS von wexplore.at pruefen
 *
 * Token: Umgebungsvariable STORYBLOK_TOKEN oder macOS-Schluesselbund (Dienst steht in config.json).
 * Das Skript gibt den Token nie aus und schreibt ihn nirgends hin.
 * Keine Abhaengigkeiten, Node 20 oder neuer. Ablauf und Hintergrund: README.md im selben Ordner.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HIER, "..", "..");
const DIST = join(REPO, "dist", "storyblok");
const K = JSON.parse(readFileSync(join(HIER, "config.json"), "utf8"));
const MANIFEST = join(HIER, "assets.json");
const STAND = join(HIER, "stand.json");
const ARGS = process.argv.slice(3);
const hatArg = (a) => ARGS.includes(a);

const lesen = (p) => readFileSync(join(REPO, p), "utf8");
const sha = (x) => createHash("sha256").update(x).digest("hex");
const jsonLesen = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : {});
const jsonSchreiben = (p, o) => schreiben(p, JSON.stringify(o, null, 2) + "\n");
function schreiben(p, inhalt) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, inhalt); }
function abbruch(text) { console.error("Abbruch: " + text); process.exit(1); }
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + " KB";
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const htmlEsc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const htmlDecode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/* ------------------------------------------------------------------ Storyblok */

let tokenCache = null;
function token() {
  if (tokenCache) return tokenCache;
  if (process.env.STORYBLOK_TOKEN) return (tokenCache = process.env.STORYBLOK_TOKEN.trim());
  try {
    tokenCache = execFileSync("security", ["find-generic-password", "-a", process.env.USER || "", "-s", K.schluesselbund, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    abbruch(`Kein Token. STORYBLOK_TOKEN setzen oder im Schluesselbund unter "${K.schluesselbund}" ablegen.`);
  }
  return tokenCache;
}

async function mapi(methode, pfad, body, versuch = 0) {
  const res = await fetch(`${K.api}/spaces/${K.space}/${pfad}`, {
    method: methode,
    headers: { Authorization: token(), "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429 && versuch < 5) {
    await new Promise((r) => setTimeout(r, 1200 * (versuch + 1)));
    return mapi(methode, pfad, body, versuch + 1);
  }
  const text = await res.text();
  if (!res.ok) abbruch(`${methode} ${pfad}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/* ------------------------------------------------------------------ CSS */

// Index der schliessenden Klammer zur oeffnenden an Position i. Strings werden uebersprungen.
function klammerEnde(s, i) {
  let tiefe = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '"' || c === "'") { j = s.indexOf(c, j + 1); if (j < 0) break; continue; }
    if (c === "{") tiefe++;
    else if (c === "}" && --tiefe === 0) return j;
  }
  throw new Error("CSS: Klammer ohne Ende ab Zeichen " + i);
}

// Selektorliste an Kommas auf oberster Ebene trennen, nicht in :is(), :not() oder [..].
function trenneListe(sel) {
  const teile = [];
  let tiefe = 0, start = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === "(" || c === "[") tiefe++;
    else if (c === ")" || c === "]") tiefe--;
    else if (c === "," && tiefe === 0) { teile.push(sel.slice(start, i)); start = i + 1; }
  }
  teile.push(sel.slice(start));
  return teile.map((t) => t.trim()).filter(Boolean);
}

function scopeSelektor(s) {
  const w = "." + K.wrapper;
  if (/^(html|body|:root)$/.test(s)) return w;
  if (/^(html|body|:root)\s+/.test(s)) return s.replace(/^(html|body|:root)\s+(body\s+)?/, w + " ");
  if (/^(html|body)[.#:[]/.test(s)) throw new Error(`CSS-Selektor "${s}" haengt an html oder body der Seite. Bitte von Hand loesen.`);
  if (s === "*") return `${w},${w} *`;
  return `${w} ${s}`;
}

// Jede Regel bekommt den Wrapper davor. @media und @supports werden durchlaufen,
// @keyframes und Co. bleiben unveraendert.
function scopeCss(css) {
  let aus = "";
  let i = 0;
  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i])) i++;
    if (i >= css.length) break;
    if (css[i] === "@") {
      const kopf = /@([\w-]+)([^{;]*)([{;])/y;
      kopf.lastIndex = i;
      const m = kopf.exec(css);
      if (!m) throw new Error("CSS: At-Regel nicht lesbar bei Zeichen " + i);
      if (m[3] === ";") { aus += `@${m[1]} ${m[2].trim()};`; i = kopf.lastIndex; continue; }
      const auf = kopf.lastIndex - 1;
      const zu = klammerEnde(css, auf);
      const innen = css.slice(auf + 1, zu);
      aus += /^(media|supports|container|layer)$/.test(m[1])
        ? `@${m[1]} ${m[2].trim()}{${scopeCss(innen)}}`
        : `@${m[1]} ${m[2].trim()}{${innen.trim()}}`;
      i = zu + 1;
    } else {
      const auf = css.indexOf("{", i);
      if (auf < 0) throw new Error("CSS: Regel ohne Block bei Zeichen " + i);
      const zu = klammerEnde(css, auf);
      aus += trenneListe(css.slice(i, auf)).map(scopeSelektor).join(",") + "{" + css.slice(auf + 1, zu).trim() + "}";
      i = zu + 1;
    }
  }
  return aus;
}

const kompaktCss = (css) => css.replace(/\s+/g, " ").replace(/\s*([{};,>])\s*/g, "$1").replace(/;}/g, "}").trim();

// Innerhalb des Wrappers gelten nur Browser-Standards und Dailies-Regeln. Die Seite wurde
// gegen die Browser-Standards gebaut; das CSS von wexplore.at (Bootstrap und eigene
// Element-Regeln fuer p, h1, ul, a, img ...) soll nicht hineinwirken. Bilder, Videos und SVG
// sind ausgenommen, weil "all: revert" sonst ihre width/height-Attribute aufhebt.
function schutzCss() {
  const w = "." + K.wrapper;
  return [
    `${w}{letter-spacing:normal;word-spacing:normal;line-height:normal;font-size:16px;font-weight:400;font-style:normal;text-align:start;text-transform:none;text-indent:0;white-space:normal;font-variant:normal;font-feature-settings:normal;-webkit-tap-highlight-color:initial}`,
    `${w} :where(:not(svg,svg *,img,video,picture,source,iframe,canvas)){all:revert}`,
    `${w} :where(img,video,svg,svg *,canvas,iframe){vertical-align:baseline;max-width:none;box-sizing:content-box}`,
    `${w} ::before,${w} ::after{box-sizing:content-box}`,
  ].join("\n");
}

function schriftCss(url) {
  return K.schriften.map((s) => {
    const quellen = [];
    if (s.host) quellen.push(`url("${s.host}") format("woff")`);
    quellen.push(`url("${url(s.datei)}") format("woff2")`);
    return `@font-face{font-family:"${K.schriftPrefix} ${s.familie}";src:${quellen.join(",")};font-weight:${s.gewicht};font-style:normal;font-display:swap}`;
  }).join("\n");
}

function schriftPreloads(url) {
  return K.schriften.filter((s) => s.preload).map((s) => {
    const href = s.host || url(s.datei);
    const typ = s.host ? "font/woff" : "font/woff2";
    return `<link rel="preload" as="font" type="${typ}" crossorigin href="${href}">`;
  }).join("\n");
}

/* ------------------------------------------------------------------ Build */

const ASSET_RE = /(?:https:\/\/wexalex\.github\.io\/dailies\/)?\bassets\/([\w./-]+?\.(?:jpe?g|png|webp|avif|gif|svg|mp4|webm|woff2?|pdf|ico))(?:\?v=[\w.-]+)?/g;

function klassenInAttributen(html) {
  return html.replace(/(\bclass\s*=\s*)(\\?["'])([\s\S]*?)\2/g, (m, vor, q, wert) =>
    vor + q + wert.split(/(\s+)/).map((t) => K.umbenennen[t] || t).join("") + q);
}

function klassenInCss(css) {
  const namen = Object.keys(K.umbenennen).map(reEsc).join("|");
  return css.replace(new RegExp(`\\.(${namen})(?![\\w-])`, "g"), (m, n) => "." + K.umbenennen[n]);
}

function klassenInJs(js, bericht) {
  let n = 0;
  for (const name of K.jsLiterale) {
    js = js.replace(new RegExp(`(["'])${reEsc(name)}\\1`, "g"), (m, q) => { n++; return q + K.umbenennen[name] + q; });
  }
  bericht.jsLiterale = n;
  return js;
}

function schriftNamen(s) {
  return s.replace(/(["'])ES Klarheit (Kurrent|Plakat)\1/g, (m, q, f) => `${q}${K.schriftPrefix} ${f}${q}`);
}

function gitStand() {
  try {
    const commit = execFileSync("git", ["-C", REPO, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
    const branch = execFileSync("git", ["-C", REPO, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
    const sauber = execFileSync("git", ["-C", REPO, "status", "--porcelain", "--", "index.html", "assets"], { encoding: "utf8" }).trim() === "";
    return { commit, branch, sauber };
  } catch { return { commit: "unbekannt", branch: "unbekannt", sauber: false }; }
}

// Baut den Block. url(pfad) liefert die Ziel-Adresse eines Assets aus dem Repo.
function bauen(url) {
  const html = lesen("index.html");
  const cfg = lesen("assets/config.js");
  const bericht = {};
  const kopf = html.slice(0, html.indexOf("</head>"));
  const meta = {
    titel: htmlDecode(kopf.match(/<title>([^<]*)<\/title>/)[1]),
    beschreibung: htmlDecode(kopf.match(/<meta name="description" content="([^"]*)"/)[1]),
    ogBild: (kopf.match(/<meta property="og:image" content="([^"]*)"/) || [])[1] || null,
    ogAlt: htmlDecode((kopf.match(/<meta property="og:image:alt" content="([^"]*)"/) || [])[1] || ""),
  };
  if (meta.ogBild) meta.ogBild = meta.ogBild.replace(K.githubUrl, "").replace(/\?.*$/, "");

  const ziel = K.zielUrl.replace(/\/$/, "");
  const urls = (s) => s.replace(ASSET_RE, (m, p) => (p === "config.js" ? m : url("assets/" + p)))
    .replace(new RegExp(reEsc(K.githubUrl), "g"), ziel + "/").replace(new RegExp(reEsc(ziel) + "/(#|\"|')", "g"), ziel + "$1");

  // CSS: eigene @font-face raus, Wrapper davor, Klassen und Schriftnamen umbenennen
  let css = [...kopf.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
  css = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@font-face\s*{[^}]*}/g, "");
  css = urls(schriftNamen(klassenInCss(scopeCss(css))));
  const host = readFileSync(join(HIER, "wexplore.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  css = [schriftCss(url), schutzCss(), kompaktCss(css), kompaktCss(host)].join("\n");

  // Strukturierte Daten bleiben erhalten, Adressen zeigen auf wexplore.at
  const ld = [...kopf.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => `<script type="application/ld+json">${JSON.stringify(JSON.parse(urls(m[1])))}</script>`).join("\n");

  // Body: markierte Bereiche raus, Skripte an Ort und Stelle merken, Kommentare raus
  let body = html.slice(html.indexOf(">", html.indexOf("<body")) + 1, html.lastIndexOf("</body>"));
  body = body.replace(/<!-- storyblok:weglassen -->[\s\S]*?<!-- \/storyblok:weglassen -->/g, "");
  const skripte = [];
  body = body.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (m, attrs, inhalt) => {
    if (/\bsrc\s*=/.test(attrs)) throw new Error("Externes Skript im body wird nicht unterstuetzt: " + attrs);
    skripte.push(inhalt);
    return `\u0000S${skripte.length - 1}\u0000`;
  });
  body = body.replace(/<!--[\s\S]*?-->/g, "");
  if (/<(pre|textarea)\b/.test(body)) bericht.hinweis = "pre/textarea gefunden: Einrueckungen bleiben stehen";
  else body = body.replace(/\n[ \t]+/g, "\n");
  body = body.replace(/\n{2,}/g, "\n").trim();
  body = urls(schriftNamen(klassenInAttributen(body)));

  // Skripte: config.js zuerst, damit window.DAILIES von Anfang an da ist
  const js = (s) => {
    let x = urls(schriftNamen(klassenInJs(klassenInAttributen(s), bericht)));
    if (!x.includes("`") && !/\\\n/.test(x)) x = x.replace(/\n[ \t]+/g, "\n").replace(/^\/\/[^\n]*\n/gm, "").replace(/\n{2,}/g, "\n");
    return x.trim();
  };
  let erstes = true;
  body = body.replace(/\u0000S(\d+)\u0000/g, (m, n) => {
    const tag = `<script>\n${js(skripte[+n])}\n</script>`;
    if (!erstes) return tag;
    erstes = false;
    return `<script>\n${js(cfg)}\n</script>\n${tag}`;
  });
  if (erstes) body += `\n<script>\n${js(cfg)}\n</script>`;

  const stand = gitStand();
  const block = [
    `<!-- DAILIES fuer wexplore.at, gebaut aus wexalex/dailies ${stand.branch} ${stand.commit}${stand.sauber ? "" : " (mit lokalen Aenderungen)"} am ${new Date().toISOString().slice(0, 16).replace("T", " ")}.`,
    `     Nicht in Storyblok bearbeiten: Quelle ist das Repo, der naechste Abgleich ersetzt diesen Block. -->`,
    schriftPreloads(url),
    `<style>\n${css}\n</style>`,
    ld,
    `<div class="${K.wrapper}">\n${body}\n</div>`,
  ].join("\n");

  pruefeBlock(block, bericht);
  return { block, meta, bericht, stand };
}

// Was nach dem Build nicht mehr im Block stehen darf
function pruefeBlock(block, bericht) {
  const fehler = [];
  const markup = block.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
  for (const alt of Object.keys(K.umbenennen)) {
    const re = new RegExp(`class\\s*=\\s*\\\\?["'][^"']*(?<![\\w-])${reEsc(alt)}(?![\\w-])`);
    if (re.test(block)) fehler.push(`Klasse "${alt}" steht noch in einem class-Attribut`);
    const css = (block.match(/<style>([\s\S]*?)<\/style>/) || ["", ""])[1];
    if (new RegExp(`\\.${reEsc(alt)}(?![\\w-])`).test(css)) fehler.push(`Klasse ".${alt}" steht noch im CSS`);
    const jsTeil = [...block.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
    if (new RegExp(`["'][^"'\\n]*\\.${reEsc(alt)}(?![\\w-])[^"'\\n]*["']`).test(jsTeil)) fehler.push(`Selektor ".${alt}" steht in einem JS-String: von Hand pruefen`);
  }
  if (/(["'])ES Klarheit/.test(block)) fehler.push('Schriftname "ES Klarheit" nicht ersetzt');
  if (/github\.io/.test(block)) fehler.push("Verweis auf github.io im Block");
  if (/(?<![\w/])assets\/(?!config\.js)[\w./-]+\.\w{2,5}/.test(markup)) fehler.push("Asset-Pfad nicht aufgeloest");
  if (fehler.length) abbruch("Pruefung des Blocks:\n  - " + fehler.join("\n  - "));
  const platzhalter = [...new Set(markup.match(/\[\[[^\]\n]{1,80}\]\]/g) || [])];
  bericht.platzhalter = platzhalter;
}

function assetZiel(modus) {
  const manifest = jsonLesen(MANIFEST);
  const fehlend = new Set();
  const url = (pfad) => {
    if (modus === "sammeln") { fehlend.add(pfad); return "https://example.invalid/" + pfad; }
    if (modus === "lokal") { fehlend.add(pfad); return "/_dailies/" + pfad; }
    const e = manifest[pfad];
    if (!e) { fehlend.add(pfad); return "FEHLT:" + pfad; }
    if (e.sha !== sha(readFileSync(join(REPO, pfad)))) fehlend.add(pfad);
    return e.url;
  };
  return { url, fehlend, manifest };
}

function build() {
  const lokal = hatArg("--lokal");
  const ziel = assetZiel(lokal ? "lokal" : "storyblok");
  let erg;
  try { erg = bauen(ziel.url); } catch (e) { abbruch(e.message); }
  if (!lokal && ziel.fehlend.size) abbruch(`Diese Dateien fehlen in Storyblok oder haben sich geaendert. Zuerst "assets" ausfuehren:\n  ${[...ziel.fehlend].join("\n  ")}`);
  if (erg.meta.ogBild) ziel.url(erg.meta.ogBild);
  schreiben(join(DIST, "block.html"), erg.block);
  jsonSchreiben(join(DIST, "meta.json"), { ...erg.meta, lokal, stand: erg.stand });
  jsonSchreiben(join(DIST, "assets-liste.json"), [...ziel.fehlend]);
  console.log(`Block: dist/storyblok/block.html (${kb(erg.block)}${lokal ? ", lokale Asset-Pfade" : ""})`);
  console.log(`Titel: ${erg.meta.titel}`);
  console.log(`Quelle: ${erg.stand.branch} ${erg.stand.commit}${erg.stand.sauber ? "" : " mit lokalen Aenderungen"}`);
  if (erg.bericht.hinweis) console.log("Hinweis: " + erg.bericht.hinweis);
  if (erg.bericht.platzhalter.length) console.log(`Platzhalter im Text (${erg.bericht.platzhalter.length}), "live" verweigert so: ${erg.bericht.platzhalter.join(", ")}`);
  return erg;
}

/* ------------------------------------------------------------------ Assets */

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif",
  ".svg": "image/svg+xml", ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2", ".woff": "font/woff", ".pdf": "application/pdf", ".ico": "image/x-icon" };

async function assets() {
  const sammler = assetZiel("sammeln");
  let erg;
  try { erg = bauen(sammler.url); } catch (e) { abbruch(e.message); }
  const liste = new Set([...sammler.fehlend, ...K.schriften.map((s) => s.datei)]);
  if (erg.meta.ogBild) liste.add(erg.meta.ogBild);
  const manifest = jsonLesen(MANIFEST);
  const stand = jsonLesen(STAND);

  if (!stand.assetOrdnerId) {
    const ordner = (await mapi("GET", "asset_folders/")).asset_folders || [];
    const vorhanden = ordner.find((o) => o.name === K.assetOrdner && !o.parent_id);
    stand.assetOrdnerId = vorhanden ? vorhanden.id
      : (await mapi("POST", "asset_folders/", { asset_folder: { name: K.assetOrdner } })).asset_folder.id;
    jsonSchreiben(STAND, stand);
  }

  let neu = 0;
  for (const pfad of [...liste].sort()) {
    const datei = join(REPO, pfad);
    if (!existsSync(datei)) abbruch("Datei fehlt im Repo: " + pfad);
    const buf = readFileSync(datei);
    const h = sha(buf);
    if (manifest[pfad] && manifest[pfad].sha === h) continue;
    const sig = await mapi("POST", "assets/", { filename: basename(pfad), asset_folder_id: stand.assetOrdnerId, validate_upload: 1 });
    const form = new FormData();
    for (const [k, v] of Object.entries(sig.fields || {})) form.append(k, v);
    form.append("file", new Blob([buf], { type: MIME[extname(pfad).toLowerCase()] || "application/octet-stream" }), basename(pfad));
    const up = await fetch(sig.post_url, { method: "POST", body: form });
    if (!up.ok) abbruch(`Upload ${pfad}: HTTP ${up.status} ${(await up.text()).slice(0, 200)}`);
    await mapi("GET", `assets/${sig.id}/finish_upload`);
    const adresse = (sig.pretty_url || "").replace(/^\/\//, "https://");
    if (!/^https:\/\/a\.storyblok\.com\//.test(adresse)) abbruch(`Unerwartete Asset-Adresse fuer ${pfad}: ${adresse}`);
    manifest[pfad] = { sha: h, id: sig.id, url: adresse, bytes: buf.length };
    jsonSchreiben(MANIFEST, Object.fromEntries(Object.entries(manifest).sort()));
    neu++;
    console.log(`hochgeladen: ${pfad} (${(buf.length / 1024).toFixed(0)} KB)`);
  }
  console.log(neu ? `${neu} Datei(en) hochgeladen, Zuordnung in tools/storyblok/assets.json` : "Alle Dateien sind schon aktuell in Storyblok.");
}

/* ------------------------------------------------------------------ Vorschau */

async function holen(adresse, ziel, frisch, text) {
  if (!frisch && existsSync(ziel)) return text ? readFileSync(ziel, "utf8") : null;
  const res = await fetch(adresse, { headers: { "User-Agent": "Mozilla/5.0 (DAILIES Vorschau)" } });
  if (!res.ok) abbruch(`Laden fehlgeschlagen: ${adresse} HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  schreiben(ziel, buf);
  return text ? buf.toString("utf8") : null;
}

async function vorschau() {
  const dir = join(DIST, "vorschau");
  if (!existsSync(join(DIST, "block.html"))) abbruch('Erst "build" ausfuehren.');
  const block = readFileSync(join(DIST, "block.html"), "utf8");
  const meta = jsonLesen(join(DIST, "meta.json"));
  const frisch = hatArg("--frisch");
  const basis = new URL(K.vorschau.huelle).origin;

  let seite = await holen(K.vorschau.huelle, join(dir, "_huelle.html"), frisch, true);
  // Kein Tracking und kein reCAPTCHA in der Vorschau
  seite = seite
    .replace(/<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?googletagmanager(?:(?!<\/script>)[\s\S])*<\/script>/gi, "")
    .replace(/<noscript>(?:(?!<\/noscript>)[\s\S])*?googletagmanager(?:(?!<\/noscript>)[\s\S])*<\/noscript>/gi, "")
    .replace(/<script[^>]*recaptcha[^>]*><\/script>/gi, "");

  // CSS, JS und Schriften der Website spiegeln, damit alles wie auf wexplore.at same-origin laedt
  const re = new RegExp(reEsc(basis) + "/((?:css|js|fonts)/[^\"'?#\\s]+)(\\?[^\"'\\s]*)?", "g");
  for (const p of new Set([...seite.matchAll(re)].map((m) => m[1]))) {
    if (!p.endsWith(".css")) { await holen(`${basis}/${p}`, join(dir, p), frisch, false); continue; }
    let css = await holen(`${basis}/${p}`, join(dir, "_roh", p), frisch, true);
    for (const m of css.matchAll(/url\(["']?\.\.\/(fonts\/[^"')?#]+)/g)) await holen(`${basis}/${m[1]}`, join(dir, m[1]), frisch, false);
    css = css.replace(/url\((["']?)\.\.\/(?!fonts\/)/g, `url($1${basis}/`);
    schreiben(join(dir, p), css);
  }
  seite = seite.replace(new RegExp(reEsc(basis) + "/((?:css|js|fonts)/)", "g"), "/$1");
  for (const s of K.schriften) if (s.host) await holen(basis + s.host, join(dir, s.host), frisch, false);
  if (meta.lokal) for (const p of jsonLesen(join(DIST, "assets-liste.json"))) {
    mkdirSync(dirname(join(dir, "_dailies", p)), { recursive: true });
    copyFileSync(join(REPO, p), join(dir, "_dailies", p));
  }

  const a = seite.indexOf('<div class="page-content" id="content">');
  const e = seite.indexOf('<footer id="main-footer"');
  if (a < 0 || e < 0) abbruch("Die Huelle hat nicht die erwartete Struktur (page-content, main-footer).");
  seite = seite.slice(0, a) + `<div class="page-content" id="content">\n<section class="section-custom-html-inline  ">\n${block}\n</section>\n</div>\n\n` + seite.slice(e);
  seite = seite.replace(/<title>[\s\S]*?<\/title>/, `<title>Vorschau: ${htmlEsc(meta.titel)}</title>`);
  // Die Story-Felder nav_light und hamburger_reverse setzt Laravel als Klassen an Navigation und Hamburger
  seite = seite.replace(/<nav class="main-nav[^"]*" id="main-nav"/, `<nav class="main-nav${K.story.nav_light ? " nav-light" : " "}" id="main-nav"`);
  if (K.story.hamburger_reverse) abbruch("hamburger_reverse wird in der Vorschau noch nicht nachgebildet.");
  schreiben(join(dir, "index.html"), seite);
  console.log(`Vorschau: dist/storyblok/vorschau/index.html (${meta.lokal ? "lokale Assets" : "Assets aus Storyblok"})`);
  console.log(`Ansehen:  python3 -m http.server ${K.vorschau.port} --directory dist/storyblok/vorschau, dann http://localhost:${K.vorschau.port}/`);
}

/* ------------------------------------------------------------------ Story */

function gebauterBlock() {
  if (!existsSync(join(DIST, "block.html"))) abbruch('Erst "build" ausfuehren.');
  const meta = jsonLesen(join(DIST, "meta.json"));
  if (meta.lokal) abbruch('Der letzte Build hat lokale Asset-Pfade. "build" ohne --lokal ausfuehren.');
  return { block: readFileSync(join(DIST, "block.html"), "utf8"), meta };
}

// Story-ID aus stand.json, sonst ueber den vollen Slug suchen, damit nie ein Duplikat entsteht
async function storySuchen(stand) {
  if (stand.storyId) return stand.storyId;
  const r = await mapi("GET", `stories/?with_slug=${encodeURIComponent(K.story.fullSlug)}`);
  return (r.stories || []).find((s) => s.full_slug === K.story.fullSlug)?.id || null;
}

async function entwurf() {
  const { block, meta } = gebauterBlock();
  const manifest = jsonLesen(MANIFEST);
  const stand = jsonLesen(STAND);
  const og = meta.ogBild && manifest[meta.ogBild];
  const content = {
    _uid: randomUUID(),
    component: "page",
    nav_light: K.story.nav_light,
    hamburger_reverse: K.story.hamburger_reverse,
    meta: [{
      _uid: randomUUID(), component: "meta", title: meta.titel, description: meta.beschreibung,
      og_image: og ? { id: og.id, alt: meta.ogAlt, name: "", focus: "", title: "", source: "", filename: og.url, copyright: "", fieldtype: "asset", meta_data: {}, is_external_url: false } : null,
    }],
    body: [{ _uid: randomUUID(), component: "section-custom-html-inline", code: block, css: "", js: "", id: "", pt: "", pb: "" }],
  };

  const id = await storySuchen(stand);
  if (id) {
    const alt = (await mapi("GET", `stories/${id}`)).story;
    const altCode = alt.content?.body?.[0]?.code || "";
    if (stand.letzterHash && sha(altCode) !== stand.letzterHash && !hatArg("--ueberschreiben")) {
      abbruch("Der Block wurde seit dem letzten Abgleich in Storyblok geaendert. Aenderungen erst ins Repo uebernehmen oder mit --ueberschreiben ersetzen.");
    }
    content._uid = alt.content?._uid || content._uid;
    content.meta[0]._uid = alt.content?.meta?.[0]?._uid || content.meta[0]._uid;
    content.body[0]._uid = alt.content?.body?.[0]?._uid || content.body[0]._uid;
    await mapi("PUT", `stories/${id}`, { story: { name: K.story.name, slug: K.story.slug, content }, force_update: 1 });
    stand.storyId = id;
  } else {
    const r = await mapi("POST", "stories/", { story: { name: K.story.name, slug: K.story.slug, parent_id: K.story.parent_id, content } });
    stand.storyId = r.story.id;
  }
  stand.letzterHash = sha(block);
  stand.entwurf = { zeit: new Date().toISOString(), quelle: meta.stand };
  jsonSchreiben(STAND, stand);
  console.log(`Entwurf gespeichert, nicht veroeffentlicht. Story ${stand.storyId}`);
  console.log(`In Storyblok: https://app.storyblok.com/#/me/spaces/${K.space}/stories/0/0/${stand.storyId}`);
}

async function live() {
  if (!hatArg("--ja")) abbruch(`Veroeffentlichen geht sofort live auf ${K.zielUrl}. Mit --ja bestaetigen.`);
  const { block } = gebauterBlock();
  const stand = jsonLesen(STAND);
  if (!stand.storyId) abbruch('Noch kein Entwurf. Erst "entwurf" ausfuehren.');
  const platzhalter = block.replace(/<script[\s\S]*?<\/script>/g, "").match(/\[\[[^\]\n]{1,80}\]\]/g);
  if (platzhalter) abbruch(`Der Block enthaelt noch Platzhalter: ${[...new Set(platzhalter)].join(", ")}`);
  const remote = (await mapi("GET", `stories/${stand.storyId}`)).story;
  if (sha(remote.content?.body?.[0]?.code || "") !== sha(block)) abbruch('Der Entwurf in Storyblok entspricht nicht dem letzten Build. Erst "entwurf" ausfuehren.');
  await mapi("GET", `stories/${stand.storyId}/publish`);
  stand.live = { zeit: new Date().toISOString(), quelle: stand.entwurf?.quelle || null };
  jsonSchreiben(STAND, stand);
  console.log(`Veroeffentlicht: ${K.zielUrl}`);
}

/* ------------------------------------------------------------------ Pruefen */

async function pruefen() {
  const res = await fetch(new URL(K.vorschau.huelle).origin + "/leistungen/projektkomm");
  const seite = await res.text();
  const cssUrls = [...seite.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"/g)].map((m) => m[1]);
  let siteCss = "";
  for (const u of cssUrls) siteCss += await (await fetch(u)).text();
  const siteKlassen = new Set(siteCss.replace(/\/\*[\s\S]*?\*\/|url\([^)]*\)/g, "").match(/\.[a-zA-Z_][\w-]*/g)?.map((k) => k.slice(1)));
  const html = lesen("index.html") + lesen("assets/config.js");
  const dailies = new Set();
  for (const m of html.matchAll(/class\s*=\s*\\?["']([^"'\\]+)/g)) m[1].split(/\s+/).forEach((k) => k && dailies.add(k));
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) (m[1].replace(/url\([^)]*\)|\d*\.\d+/g, "").match(/\.[a-zA-Z_][\w-]*/g) || []).forEach((k) => dailies.add(k.slice(1)));
  const kollision = [...dailies].filter((k) => siteKlassen.has(k)).sort();
  const offen = kollision.filter((k) => !K.umbenennen[k]);
  console.log(`Klassen von Dailies, die es auch auf wexplore.at gibt: ${kollision.join(", ") || "keine"}`);
  if (offen.length) abbruch(`Neu und noch nicht in "umbenennen" (config.json): ${offen.join(", ")}`);
  console.log("Alle Ueberschneidungen werden beim Build umbenannt.");
}

/* ------------------------------------------------------------------ Start */

const BEFEHLE = { build, assets, vorschau, entwurf, live, pruefen };
const befehl = process.argv[2] || "build";
if (!BEFEHLE[befehl]) abbruch(`Unbekannter Befehl "${befehl}". Moeglich: ${Object.keys(BEFEHLE).join(", ")}`);
await BEFEHLE[befehl]();
