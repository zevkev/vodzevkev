# Deployment-Anleitung — vod.zevkev.me (Repo: zevkev/vodzevkev)

Statische Multi-Page-Site + stündlicher VOD-Feed per GitHub Action. Kein Build nötig.

## Dateien-Check vor Upload

```
CNAME  index.html  impressum.html  404.html
robots.txt  sitemap.xml  .nojekyll  .gitignore  favicon.png
components/  assets/css/  assets/js/  assets/img/  assets/data/
scripts/fetch-feed.mjs  .github/workflows/feed.yml
```

`CNAME` enthält exakt eine Zeile: `vod.zevkev.me` (ohne `https://`, ohne Leerzeichen).

## Teil 1 — GitHub Pages (+ Feed-Action)

Lokal ist alles vorbereitet (Git-Repo initialisiert + erster Commit).
Noch nötig (einmalig, ca. 5 Min, im Browser):

1. Auf github.com als **zevkev** einloggen → **New repository** → Name `vodzevkev` → **Public** → **ohne** README/License erstellen.
2. Lokal pushen (PowerShell, Zugangsdaten von GitHub eingeben):
   ```powershell
   Set-Location "I:\AI\vodzevkevme"
   git remote add origin https://github.com/zevkev/vodzevkev.git
   git branch -M main
   git push -u origin main
   ```
3. Repo → **Settings → Pages**: Source `Deploy from a branch`, Branch `main` / `/ (root)` → Save.
4. Danach unter Pages die **Custom domain** `vod.zevkev.me` eintragen → bestätigt die `CNAME`-Datei. Warten bis DNS-Check grün, dann **Enforce HTTPS** aktivieren.
5. **Action einschalten**: Repo → **Actions** → „I understand my workflows, go ahead and enable them" (falls gefragt) → Workflow **„VOD-Feed aktualisieren"** → **Run workflow** → einmal manuell starten. Danach läuft er **stündlich von allein** und committet `assets/data/videos.json` bei neuen Videos.
   - Falls der Push der Action scheitert („permission denied"): **Settings → Actions → General** → Workflow permissions → **Read and write permissions** → Save.
6. Testen:
   - `https://zevkev.github.io/vodzevkev/` muss laden (Fallback-URL).
   - `https://vod.zevkev.me/` nach DNS-Umstellung.
   - `https://vod.zevkev.me/assets/data/videos.json` zeigt die 2+ Videos.
   - 404-Test: `https://vod.zevkev.me/xyz123` → eigene 404-Seite.
   - Diagnose: `https://vod.zevkev.me/?debug=yt` → Quelle des Feeds in der Zähler-Zeile.
7. Wichtig für Twitch-Embed: In `assets/js/config.js` stehen als `parents` bereits `vod.zevkev.me`, `localhost`, `127.0.0.1`. Falls du zusätzlich über die `github.io`-URL testest, dort temporär die Host-Domain in `parents` ergänzen oder gleich die Custom-Domain nutzen.

## Teil 2 — Namecheap DNS

1. Namecheap → Domain `zevkev.me` → **Advanced DNS**.
2. Eintrag anlegen:
   - Type: `CNAME Record`, Host: `vod`, Value: `zevkev.github.io.` (mit Punkt am Ende), TTL: `Automatic`.
   - Falls ein alter `vod`-Eintrag existiert: erst löschen.
3. Apex (`zevkev.me` selbst) bleibt unverändert; nur `vod` zeigt auf GitHub.
4. Warten: meist 5–30 Min, max. 24–48 h. Prüfen mit:
   ```powershell
   nslookup vod.zevkev.me
   ```
   Erwartet: `zevkev.github.io` bzw. GitHub-IPs.
5. Danach in GitHub Pages **Enforce HTTPS** aktivieren (Zertifikat kommt von Let's Encrypt, dauert ggf. 1 h).

## Betrieb (wichtig zu wissen)

- **YouTube (einzige Quelle: VOD-Kanal @ZevKevPlus):** Die Action schreibt stündlich `assets/data/videos.json` — die Seite lädt in Millisekunden, ganz ohne Proxy. Fällt die Action mal aus, greift automatisch die Client-Kaskade (direkt → allorigins → rss2json). Feed manuell auffrischen: `node scripts/fetch-feed.mjs` im Ordner ausführen + committen/pushen.
- **Twitch (keine offizielle API):** Status per Doppel-Check (Preview-Thumbnail + Kanal-Seite, `twitch-status.js`). LIVE → Twitch-Player **+ Live-Chat** (einklappbar), OFFLINE → neuestes Video vom VOD-Kanal `@ZevKevPlus`. Live gilt nur bei doppelter Bestätigung (kein False-Live); Gesamt-Budget 16 s, danach gilt Offline. Der Player selbst zeigt bei Fehlstatus zusätzlich den Twitch-Offline-Screen — robust, kein Hängen.
- **Lokal testen:** `fetch()` für Partials braucht `http(s)://`, nicht `file://`. Nutze z. B. `npx serve "I:\AI\vodzevkevme"` oder VS-Code Live Server.

## Updates

Neue Videos erscheinen automatisch (Action, kein manueller Aufwand). Nur bei Bedarf anfassen: `assets/js/config.js` (IDs/Links), `components/*` (Header/Footer), `DEPLOY.md` hier.
