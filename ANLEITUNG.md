# Hadith Studio – automatische Whiteboard-Videos mit n8n

**Ablauf alle 2 Stunden:**
1. n8n holt den nächsten Hadith aus deiner PDF-Liste.
2. OpenAI schreibt ein 4–5-Minuten-Skript auf Darija und setzt danach die Harakat.
3. Gemini TTS (Stimme Enzo) spricht das Skript.
4. Der Renderer zeichnet daraus das Whiteboard-Video: 16:9, 9:16 und Stories.
5. Du bekommst das Video per **Telegram zur Prüfung**.
6. Nach deinem ✅ wird es auf YouTube, Facebook, Instagram und TikTok gepostet.

```
Zeitplan → Thema → Skript (OpenAI) → Audio (Gemini) → Renderer → Telegram-Freigabe → YouTube · Facebook · Instagram · TikTok
```

---

## 1. Renderer auf dem Hostinger-VPS installieren

Per SSH auf den VPS einloggen (Hostinger-Panel → VPS → „SSH-Zugang“), dann:

```bash
# Docker vorhanden? (bei der n8n-Vorlage von Hostinger meist schon installiert)
docker --version || curl -fsSL https://get.docker.com | sh

# Paket hochladen (z. B. mit scp oder dem Dateimanager) und entpacken
cd /root && unzip hadith-studio.zip && cd hadith-studio

# Einstellungen
cp .env.example .env
nano .env        # RENDER_TOKEN (langer Zufallsschlüssel), ANTHROPIC_API_KEY, PUBLIC_URL, RENDER_WORKERS eintragen

# Bauen und starten (erstes Mal ca. 5–10 Minuten)
docker compose up -d --build

# Test
curl http://localhost:8080/health      # → {"ok":true,"queue":0}
```

**RENDER_WORKERS** = Anzahl CPU-Kerne (KVM 2 → `2`, KVM 4 → `4`).
Ein zufälliger Schlüssel geht z. B. so: `openssl rand -hex 24`.

### n8n und Renderer verbinden
- **n8n läuft auch in Docker auf demselben VPS (Hostinger-Vorlage):** Renderer ins gleiche Docker-Netz hängen:
  ```bash
  docker network ls                                   # Netz von n8n finden, z. B. root_default
  docker network connect root_default hadith-renderer
  ```
  Dann im Workflow `renderer_url = http://hadith-renderer:8080` lassen.
- **Sonst:** `renderer_url = http://<VPS-IP>:8080`.

### Öffentliche HTTPS-Adresse (nötig für Instagram, Facebook, TikTok)
Diese Plattformen holen das Video selbst über einen Link ab. Der Link muss per **HTTPS** erreichbar sein.
- Lege eine Subdomain an, z. B. `render.deine-domain.de` → IP deines VPS.
- Leite sie auf Port 8080 weiter. Bei der Hostinger-n8n-Vorlage läuft meist schon **Traefik** oder **Caddy**: dort einen zweiten Host eintragen.
- Diese Adresse kommt in `.env` als `PUBLIC_URL`.

Die Download-Links enthalten den Schlüssel (`?token=…`). Gib sie nicht öffentlich weiter.

---

## 2. Hadith-Liste aus einer PDF
Im Browser öffnen: `https://render.deine-domain.de/topics/ui` (oder `http://<VPS-IP>:8080/topics/ui`).
1. Schlüssel (`RENDER_TOKEN`) eingeben.
2. PDF wählen und hochladen.

Claude liest die Hadithe **wörtlich** mit Quelle aus, ohne etwas zu ergänzen. Mit „Liste anzeigen“ siehst du, was offen und was verwendet ist.
Die PDF muss **echten Text** enthalten. Gescannte Bilder gehen nicht.

---

## 3. Workflow in n8n importieren
1. In n8n: **Workflows → Import from File** → `n8n/hadith_video_workflow.json`.
2. **Zugangsdaten (Credentials) anlegen.** Danach in jedem Knoten mit ⚠️ auswählen:

| Name im Workflow | Typ in n8n | Inhalt |
|---|---|---|
| Hadith Renderer (X-API-Key) | Header Auth | Name `X-API-Key`, Wert = dein `RENDER_TOKEN` |
| OpenAI (Authorization: Bearer …) | Header Auth | Name `Authorization`, Wert `Bearer sk-…` (Schlüssel von platform.openai.com) |
| Gemini (x-goog-api-key) | Header Auth | Name `x-goog-api-key`, Wert = Schlüssel aus Google AI Studio (Billing aktivieren!) |
| Telegram Bot | Telegram API | Bot-Token von @BotFather |
| YouTube account | YouTube OAuth2 | Google-Cloud-Projekt mit YouTube Data API v3 |
| Facebook/Instagram Token (access_token) | Query Auth | Name `access_token`, Wert = langlebiges **Page Access Token** |
| TikTok (Authorization: Bearer …) | Header Auth | Name `Authorization`, Wert `Bearer <token>` |

3. Im Knoten **„Einstellungen“** eintragen:
   - Telegram-Chat-ID (bekommst du z. B. über @userinfobot);
   - Facebook-Page-ID und Instagram-Business-User-ID;
   - Serienname und Hashtags;
4. Zuerst **einmal manuell ausführen** und jeden Schritt ansehen. Erst dann den Workflow aktivieren.

### Freigabe
Du bekommst in Telegram:
- die Links zum Video;
- **„✅ Freigeben“**: postet überall;
- **„❌ Verwerfen“**: der Hadith kann über `/topics/<id>/reset` später erneut verwendet werden.

Ohne Antwort innerhalb von 24 Stunden wird nichts gepostet.
Bitte vor jeder Freigabe **Hadith-Text, Quelle und Aussagen prüfen**. Eine KI kann Fehler machen, und bei religiösen Inhalten ist das wichtig.

---

## 4. Plattform-Hinweise
- **YouTube:** Upload über den eingebauten YouTube-Knoten (16:9-Video). Neue Google-Projekte sind auf wenige Uploads pro Tag begrenzt; bei Bedarf beim Google-Support eine höhere Quote beantragen.
- **Facebook:** Video auf deiner **Seite**, nicht im Profil. Das Token braucht die Rechte `pages_manage_posts` und `pages_read_engagement`.
- **Instagram:** Nur **Business- oder Creator-Konto**, verbunden mit der Facebook-Seite. Gepostet wird das Hochformat-Video als Reel. Ist das Video nach 3 Minuten noch nicht verarbeitet, die Wartezeit im Knoten erhöhen.
- **TikTok:** Der Knoten ist **deaktiviert**. TikTok verlangt:
  - eine eigene Entwickler-App mit „Content Posting API“;
  - eine verifizierte Domain für `PUBLIC_URL`;
  - eine App-Prüfung durch TikTok. Bis dahin ist nur privates Posten möglich.

  Einfache Alternative: Stories und Hochformat-Video aus Telegram herunterladen und in der TikTok-App posten.

---

## 5. Was der Renderer liefert (pro Video)
- `video.mp4`: 1920×1080 mit Original-Audio;
- `video_vertical.mp4`: 1080×1920 für Reels und TikTok (Titel oben, Film in der Mitte);
- `stories/story_XX.mp4`: 25–58 Sekunden lange Hochformat-Clips;
- `storyboard.json` und `scenes.js`: zur Kontrolle oder Nachbearbeitung.
- `social.md` / `social.json`: 3 YouTube-Titel, fertige YouTube-Beschreibung mit Hadith, Quelle und **Kapiteln (Zeitmarken)**, Tags, angepinnter Kommentar und Captions mit Hashtags für Instagram, TikTok und Facebook. n8n nutzt sie automatisch beim Posten; den Link zu `social.md` bekommst du auch in der Telegram-Nachricht.

Dateien werden nach `KEEP_DAYS` Tagen gelöscht (Standard 7).

**Dauer:** Ein 5-Minuten-Video braucht auf KVM 2 grob 20–25 Minuten, auf KVM 4 etwa 10–15 Minuten. Es wird immer nur ein Video gleichzeitig gerendert; weitere warten in der Warteschlange.

## 5b. Mehrere Sprachen (ein Renderer für alle)
Der Renderer kann jede Sprache. Im Auftrag (`POST /jobs`) steuert das Feld **`language`** alles:
- `ar` (Standard): Arabisch/Darija, Schrift von rechts nach links (Aref Ruqaa / Amiri);
- `de`, `fr`, `en`, `es`, `it`, `nl`, `tr`, `id`, `ms`, `pt`, `bs`, `sq`: Schrift von links nach rechts in Handschrift (Kalam), Hadith-Zitat in Amiri.

Sprache des Transkripts, Bildschirmtexte, Storyboard, Hochformat, Stories, Social-Texte und Kapitel richten sich automatisch danach.
In n8n: im Kästchen „Audio zusammenfügen“ `language: 'ar'` durch z. B. `language: 'de'` ersetzen (am besten eine Kopie des Workflows pro Sprache).

## 6. Kosten (grob)
Pro Video ein Skript-Aufruf und ein Szenen-Aufruf an Claude, plus Gemini TTS (nach Verbrauch). Bitte in der Anthropic-Konsole ein **Ausgabenlimit** setzen.

## 7. Probleme
- `docker logs -f hadith-renderer`: Protokoll des Renderers.
- `curl -H "X-API-Key: <TOKEN>" http://localhost:8080/jobs/<id>`: Status und Fehlermeldung eines Jobs.
- **Zu wenig Arbeitsspeicher:** `RENDER_WORKERS` verkleinern.
- **Szenen fehlerhaft:** Der Renderer lässt Claude automatisch zweimal korrigieren. Bleibt ein Fehler, meldet Telegram ihn.

Das Video kann ohne Claude-Szenen nicht gebaut werden. Aber du kannst eigene `scenes_js` im Job mitschicken, z. B. eine Datei, die ich dir im Chat geschrieben habe.
