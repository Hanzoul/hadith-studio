"""Generates hadith_video_workflow.json for n8n import."""
import json, uuid

SCRIPT_PROMPT = r"""أنت كاتب محتوى دعوي مغربي. اكتب نص تعليق صوتي بالدارجة المغربية الواضحة (مع بعض الفصحى عند الاقتباس) لفيديو توعوي مدته حوالي 4 إلى 5 دقائق (بين 550 و700 كلمة).
القواعد:
- ابدأ بمدخل قصير يشد الانتباه، ثم اذكر نص الحديث كما هو مكتوب في المعطيات حرفياً، ثم مصدره كما هو مكتوب (لا تغيّر ولا تضف درجة أو مصدراً غير موجود).
- اشرح المعنى بأمثلة من الحياة اليومية، وقصص قصيرة واقعية، وأسئلة يطرحها المشاهد على نفسه.
- لا تنسب للنبي ﷺ ولا للصحابة أي كلام غير الحديث المعطى. لا تذكر أحاديث أخرى. يمكنك ذكر آية قرآنية فقط إذا كنت متأكداً تماماً من نصها، مع اسم السورة ورقم الآية.
- لا تصف شكل النبي ﷺ أو أي نبي أو ملَك.
- التشكيل: اكتب نص الحديث والآيات بالتشكيل الكامل (أضف الحركات فقط ولا تغيّر أي حرف أو كلمة). وفي باقي النص شكّل الكلمات الفصحى وكل كلمة قد تُقرأ خطأً، حتى ينطقها القارئ الآلي نطقاً صحيحاً.
- اختم بخلاصة عملية ودعاء قصير.
- الترقيم مهم لأن النص سيُقرأ بصوت آلي: جمل قصيرة، فاصلة عند كل وقفة خفيفة، نقطة في آخر كل جملة، و«…» قبل الأفكار المهمة لوقفة أطول، وسطر فارغ بين الفقرات.
- اكتب فقرات قصيرة (2–4 جمل)، بدون عناوين، بدون رموز Markdown، بدون تعليمات إخراج. النص فقط كما سيُقرأ."""

TASHKEEL_PROMPT = """أنت مُشكِّل نصوص عربية دقيق. ستتلقى نصاً بالدارجة المغربية مع اقتباسات بالفصحى (حديث نبوي وربما آية).
أعد النص نفسه حرفاً بحرف، وأضف التشكيل الكامل على كل كلمة: الفتحة والضمة والكسرة والسكون والشدة والتنوين.
- الفصحى (الحديث والآيات): تشكيل صحيح وفق قواعد العربية.
- الدارجة المغربية: شكّلها كما تُنطق في المغرب (مثلاً: كَيْدِيرْ، دْيَالْ، بْزَّافْ، هَادْ الشِّي).
- ممنوع منعاً باتاً تغيير أو حذف أو إضافة أي حرف أو كلمة أو علامة ترقيم أو سطر.
- لا تكتب أي شرح أو مقدمة، أعد النص المشكول فقط."""

TTS_STYLE = "Read the following Moroccan Darija text aloud as a warm, calm storyteller with an authentic Moroccan accent. Pronounce it exactly as vocalised (with the harakat). Pause naturally at commas and full stops, longer at «…» and between paragraphs. Do not read this instruction aloud.\n\n"


def node(name, typ, ver, params, pos, **kw):
    n = {"parameters": params, "id": str(uuid.uuid4()), "name": name, "type": typ, "typeVersion": ver, "position": pos}
    n.update(kw)
    return n


HDR_RENDER = {"authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth"}
CRED_RENDER = {"httpHeaderAuth": {"id": "", "name": "Hadith Renderer (X-API-Key)"}}
CRED_CLAUDE = {"httpHeaderAuth": {"id": "", "name": "Anthropic (x-api-key)"}}
CRED_GEMINI = {"httpHeaderAuth": {"id": "", "name": "Gemini (x-goog-api-key)"}}
CRED_FB = {"httpQueryAuth": {"id": "", "name": "Facebook/Instagram Token (access_token)"}}
CRED_TT = {"httpHeaderAuth": {"id": "", "name": "TikTok (Authorization: Bearer …)"}}
CRED_TG = {"telegramApi": {"id": "", "name": "Telegram Bot"}}
CRED_YT = {"youTubeOAuth2Api": {"id": "", "name": "YouTube account"}}

S = "$('Einstellungen').first().json"

nodes = [
    node("Alle 2 Stunden", "n8n-nodes-base.scheduleTrigger", 1.2, {"rule": {"interval": [{"field": "hours", "hoursInterval": 2}]}}, [0, 300]),
    node("Einstellungen", "n8n-nodes-base.set", 3.4, {"assignments": {"assignments": [
        {"id": "a1", "name": "renderer_url", "value": "https://hadith.lehrer-anzoul.de", "type": "string"},
        {"id": "a2", "name": "series", "value": "حديث بالقلم", "type": "string"},
        {"id": "a3", "name": "claude_model", "value": "claude-sonnet-5-5", "type": "string"},
        {"id": "a6", "name": "telegram_chat_id", "value": "DEINE_CHAT_ID", "type": "string"},
        {"id": "a7", "name": "facebook_page_id", "value": "DEINE_PAGE_ID", "type": "string"},
        {"id": "a8", "name": "instagram_user_id", "value": "DEINE_IG_USER_ID", "type": "string"},
        {"id": "a9", "name": "hashtags", "value": "#حديث_بالقلم #أحاديث_نبوية #السنة_النبوية #بالدارجة #تذكير", "type": "string"}]}, "options": {}}, [220, 300]),
    node("Nächstes Thema", "n8n-nodes-base.httpRequest", 4.2, {"url": "={{ $json.renderer_url }}/topics/next", **HDR_RENDER, "options": {}}, [440, 300], credentials=CRED_RENDER),
    node("Thema vorhanden?", "n8n-nodes-base.if", 2.2, {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
        "conditions": [{"id": "c1", "leftValue": "={{ $json.empty }}", "rightValue": "", "operator": {"type": "boolean", "operation": "false", "singleValue": True}}], "combinator": "and"}, "options": {}}, [660, 300]),
    node("Liste leer melden", "n8n-nodes-base.telegram", 1.2, {"chatId": f"={{{{ {S}.telegram_chat_id }}}}", "text": "📭 Hadith Studio: Die Themenliste ist leer. Bitte eine neue PDF hochladen (…/topics/ui).", "additionalFields": {}}, [880, 480], credentials=CRED_TG),
    node("Skript schreiben (Claude)", "n8n-nodes-base.httpRequest", 4.2, {"method": "POST", "url": "https://api.anthropic.com/v1/messages", **HDR_RENDER,
        "sendHeaders": True, "headerParameters": {"parameters": [{"name": "anthropic-version", "value": "2023-06-01"}]},
        "sendBody": True, "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ model: " + S + ".claude_model, max_tokens: 8000, system: " + json.dumps(SCRIPT_PROMPT, ensure_ascii=False) + ", messages: [{ role: 'user', content: 'العنوان: ' + $json.title + '\\nنص الحديث: ' + $json.text + '\\nالمصدر: ' + ($json.source || 'غير مذكور') + '\\nملاحظة: ' + ($json.note || '') }] }) }}",
        "options": {"timeout": 300000}}, [880, 280], credentials=CRED_CLAUDE),
    node("Tashkeel (Claude)", "n8n-nodes-base.httpRequest", 4.2, {"method": "POST", "url": "https://api.anthropic.com/v1/messages", **HDR_RENDER,
        "sendHeaders": True, "headerParameters": {"parameters": [{"name": "anthropic-version", "value": "2023-06-01"}]},
        "sendBody": True, "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ model: " + S + ".claude_model, max_tokens: 16000, system: " + json.dumps(TASHKEEL_PROMPT, ensure_ascii=False) + ", messages: [{ role: 'user', content: $json.content.map(c => c.text || '').join('').trim() }] }) }}",
        "options": {"timeout": 300000}}, [990, 280], credentials=CRED_CLAUDE),
    node("Skript in Abschnitte", "n8n-nodes-base.code", 2, {"jsCode": r"""const txt = j => (j.content || []).map(c => c.text || '').join('').trim();
let orig = ''; try { orig = txt($('Skript schreiben (Claude)').first().json); } catch (e) {}
const voc = txt($input.first().json);
// Kontrolle: Buchstaben (ohne Harakat) müssen gleich bleiben
const norm = s => s.replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/[^ء-ي]/g, '');
function sim(a, b) {
  if (a === b) return 1;
  const n = a.length, m = b.length; if (!n || !m) return 0;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) { const cur = [i];
    for (let j = 1; j <= m; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur; }
  return 1 - prev[m] / Math.max(n, m);
}
const score = orig ? sim(norm(orig), norm(voc)) : 1;
const ok = voc && score >= 0.985;
const t = ok ? voc : (orig || voc);
const topic = $('Nächstes Thema').first().json;
// TTS (Gemini): Abschnitte von max. ~3000 Zeichen (an Absatzgrenzen) (an Absatzgrenzen)
const paras = t.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
const chunks = []; let cur = '';
for (const p of paras) { if ((cur + '\n\n' + p).length > 3000 && cur) { chunks.push(cur); cur = p; } else cur = cur ? cur + '\n\n' + p : p; }
if (cur) chunks.push(cur);
return chunks.map((c, i) => ({ json: { idx: i, chunk: c, script: t, title: topic.title, topic_id: topic.id, source: topic.source,
  tashkeel: ok ? 'ok' : 'FEHLER – Text ohne Harakat (Abweichung ' + Math.round((1 - score) * 1000) / 10 + ' %)' } }));"""}, [1150, 280]),
    node("Sprechen (Gemini TTS)", "n8n-nodes-base.httpRequest", 4.2, {"method": "POST",
        "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent", **HDR_RENDER,
        "sendBody": True, "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ contents: [{ parts: [{ text: " + json.dumps(TTS_STYLE, ensure_ascii=False) + " + $json.chunk }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Enzo' } } } } }) }}",
        "options": {"timeout": 600000, "batching": {"batch": {"batchSize": 1, "batchInterval": 3000}}}}, [1320, 280],
        credentials=CRED_GEMINI, retryOnFail=True, maxTries=3, waitBetweenTries=15000),
    node("Audio zusammenfügen", "n8n-nodes-base.code", 2, {"jsCode": r"""const parts = $input.all().map(i => i.json.candidates[0].content.parts.find(p => p.inlineData).inlineData);
const first = $('Skript in Abschnitte').first().json;
const fmt = (parts[0].mimeType || '').match(/rate=(\d+)/);
return [{ json: { title: first.title, script: first.script, topic_id: first.topic_id, source: first.source,
  series: $('Einstellungen').first().json.series, audio_b64: parts.map(p => p.data),
  audio_format: 'pcm_s16le_' + (fmt ? fmt[1] : '24000'), language: 'ar', stories: true, vertical: true } }];"""}, [1540, 280]),
    node("Video bestellen", "n8n-nodes-base.httpRequest", 4.2, {"method": "POST", "url": f"={{{{ {S}.renderer_url }}}}/jobs", **HDR_RENDER,
        "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json) }}", "options": {"timeout": 120000}}, [1760, 280], credentials=CRED_RENDER),
    node("5 Minuten warten", "n8n-nodes-base.wait", 1.1, {"amount": 5, "unit": "minutes"}, [1980, 280], webhookId=str(uuid.uuid4())),
    node("Status abfragen", "n8n-nodes-base.httpRequest", 4.2, {"url": f"={{{{ {S}.renderer_url }}}}/jobs/{{{{ $('Video bestellen').first().json.id }}}}", **HDR_RENDER, "options": {}}, [2200, 280], credentials=CRED_RENDER),
    node("Fertig?", "n8n-nodes-base.switch", 3.2, {"rules": {"values": [
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2}, "conditions": [{"leftValue": "={{ $json.state }}", "rightValue": "done", "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"}, "renameOutput": True, "outputKey": "fertig"},
        {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2}, "conditions": [{"leftValue": "={{ $json.state }}", "rightValue": "error", "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"}, "renameOutput": True, "outputKey": "fehler"}]},
        "options": {"fallbackOutput": "extra", "renameFallbackOutput": "läuft noch"}}, [2420, 280]),
    node("Fehler melden", "n8n-nodes-base.telegram", 1.2, {"chatId": f"={{{{ {S}.telegram_chat_id }}}}", "text": "=⚠️ Video-Fehler bei «{{ $json.title }}»:\n{{ $json.error }}", "additionalFields": {}}, [2640, 460], credentials=CRED_TG),
    node("Zur Freigabe senden", "n8n-nodes-base.telegram", 1.2, {"chatId": f"={{{{ {S}.telegram_chat_id }}}}",
        "text": "=🎬 Neues Video: {{ $json.title }} ({{ Math.round($json.duration/60) }} Min.)\n\nAnsehen: {{ $json.urls['video.mp4'] }}\nHochformat: {{ $json.urls['video_vertical.mp4'] }}\nTexte & Hashtags: {{ $json.urls['social.md'] }}\n\nBitte Hadith-Text, Quelle und Aussagen prüfen.\n\n✅ Freigeben und posten:\n{{ $execution.resumeUrl }}?ok=1\n\n❌ Verwerfen:\n{{ $execution.resumeUrl }}?ok=0",
        "additionalFields": {"disable_web_page_preview": True}}, [2640, 120], credentials=CRED_TG),
    node("Auf Freigabe warten", "n8n-nodes-base.wait", 1.1, {"resume": "webhook", "options": {}, "limitWaitTime": True, "limitType": "afterTimeInterval", "resumeAmount": 24, "resumeUnit": "hours"}, [2860, 120], webhookId=str(uuid.uuid4())),
    node("Freigegeben?", "n8n-nodes-base.if", 2.2, {"conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "loose", "version": 2},
        "conditions": [{"id": "c2", "leftValue": "={{ $json.query && $json.query.ok }}", "rightValue": "1", "operator": {"type": "string", "operation": "equals"}}], "combinator": "and"}, "options": {}}, [3080, 120]),
    node("Social-Texte laden", "n8n-nodes-base.httpRequest", 4.2, {"url": "={{ $('Status abfragen').last().json.urls['social.json'] }}", "options": {}}, [3300, -140]),
    node("Text für Posts", "n8n-nodes-base.code", 2, {"jsCode": r"""const st = $('Status abfragen').last().json;
const s = $input.first().json;
const cfg = $('Einstellungen').first().json;
const tags = (s.hashtags || []).join(' ') || cfg.hashtags;
return [{ json: {
  title: (s.youtube_titles && s.youtube_titles[0]) || st.title,
  yt_description: s.youtube_description || st.title,
  yt_tags: (s.tags || []).join(','),
  caption_ig: s.instagram_caption || (st.title + '\n\n' + tags),
  caption_tt: s.tiktok_caption || (st.title + ' ' + tags),
  caption_fb: s.facebook_caption || (st.title + '\n\n' + tags),
  pinned_comment: s.pinned_comment || '',
  video_url: st.urls['video.mp4'], vertical_url: st.urls['video_vertical.mp4'] } }];"""}, [3300, 40]),
    node("Video laden (YouTube)", "n8n-nodes-base.httpRequest", 4.2, {"url": "={{ $json.video_url }}", "options": {"response": {"response": {"responseFormat": "file"}}}}, [3520, -200]),
    node("YouTube hochladen", "n8n-nodes-base.youTube", 1, {"resource": "video", "operation": "upload", "title": "={{ $('Text für Posts').first().json.title }}", "regionCode": "MA", "categoryId": "27", "binaryProperty": "data",
        "options": {"description": "={{ $('Text für Posts').first().json.yt_description }}", "tags": "={{ $('Text für Posts').first().json.yt_tags }}", "privacyStatus": "public", "defaultLanguage": "ar"}}, [3740, -200], credentials=CRED_YT),
    node("Facebook-Seite posten", "n8n-nodes-base.httpRequest", 4.2, {"method": "POST", "url": f"=https://graph.facebook.com/v21.0/{{{{ {S}.facebook_page_id }}}}/videos",
        "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth", "sendQuery": True, "queryParameters": {"parameters": [
            {"name": "file_url", "value": "={{ $json.video_url }}"}, {"name": "title", "value": "={{ $json.title }}"}, {"name": "description", "value": "={{ $json.caption_fb }}"}]}, "options": {"timeout": 300000}}, [3520, -20], credentials=CRED_FB),
    node("Instagram Reel anlegen", "n8n-nodes-base.httpRequest", 4.2, {"method": "POST", "url": f"=https://graph.facebook.com/v21.0/{{{{ {S}.instagram_user_id }}}}/media",
        "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth", "sendQuery": True, "queryParameters": {"parameters": [
            {"name": "media_type", "value": "REELS"}, {"name": "video_url", "value": "={{ $json.vertical_url }}"}, {"name": "caption", "value": "={{ $json.caption_ig }}"}, {"name": "share_to_feed", "value": "true"}]}, "options": {}}, [3520, 160], credentials=CRED_FB),
    node("IG: 3 Min. verarbeiten lassen", "n8n-nodes-base.wait", 1.1, {"amount": 3, "unit": "minutes"}, [3740, 160], webhookId=str(uuid.uuid4())),
    node("Instagram veröffentlichen", "n8n-nodes-base.httpRequest", 4.2, {"method": "POST", "url": f"=https://graph.facebook.com/v21.0/{{{{ {S}.instagram_user_id }}}}/media_publish",
        "authentication": "genericCredentialType", "genericAuthType": "httpQueryAuth", "sendQuery": True, "queryParameters": {"parameters": [{"name": "creation_id", "value": "={{ $('Instagram Reel anlegen').first().json.id }}"}]},
        "options": {}}, [3960, 160], credentials=CRED_FB),
    node("TikTok posten", "n8n-nodes-base.httpRequest", 4.2, {"method": "POST", "url": "https://open.tiktokapis.com/v2/post/publish/video/init/", **HDR_RENDER,
        "sendBody": True, "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ post_info: { title: $json.caption_tt.slice(0, 2000), privacy_level: 'SELF_ONLY', disable_comment: false }, source_info: { source: 'PULL_FROM_URL', video_url: $json.vertical_url } }) }}",
        "options": {}}, [3520, 340], credentials=CRED_TT, disabled=True,
        notes="Erst aktivieren, wenn deine TikTok-App für die Content Posting API freigegeben und die Renderer-Domain bei TikTok verifiziert ist. Ohne App-Prüfung erlaubt TikTok nur privates Posten (SELF_ONLY)."),
    node("Verworfen melden", "n8n-nodes-base.telegram", 1.2, {"chatId": f"={{{{ {S}.telegram_chat_id }}}}", "text": "=🗑️ Verworfen: {{ $('Status abfragen').last().json.title }}. Das Thema kann über /topics/{{ $('Nächstes Thema').first().json.id }}/reset wieder freigegeben werden.", "additionalFields": {}}, [3300, 260], credentials=CRED_TG),
]

C = {}
def link(a, b, out=0):
    C.setdefault(a, {"main": []})
    while len(C[a]["main"]) <= out:
        C[a]["main"].append([])
    C[a]["main"][out].append({"node": b, "type": "main", "index": 0})

link("Alle 2 Stunden", "Einstellungen")
link("Einstellungen", "Nächstes Thema")
link("Nächstes Thema", "Thema vorhanden?")
link("Thema vorhanden?", "Skript schreiben (Claude)", 0)
link("Thema vorhanden?", "Liste leer melden", 1)
link("Skript schreiben (Claude)", "Tashkeel (Claude)")
link("Tashkeel (Claude)", "Skript in Abschnitte")
link("Skript in Abschnitte", "Sprechen (Gemini TTS)")
link("Sprechen (Gemini TTS)", "Audio zusammenfügen")
link("Audio zusammenfügen", "Video bestellen")
link("Video bestellen", "5 Minuten warten")
link("5 Minuten warten", "Status abfragen")
link("Status abfragen", "Fertig?")
link("Fertig?", "Zur Freigabe senden", 0)
link("Fertig?", "Fehler melden", 1)
link("Fertig?", "5 Minuten warten", 2)
link("Zur Freigabe senden", "Auf Freigabe warten")
link("Auf Freigabe warten", "Freigegeben?")
link("Freigegeben?", "Social-Texte laden", 0)
link("Social-Texte laden", "Text für Posts")
link("Freigegeben?", "Verworfen melden", 1)
for b in ["Video laden (YouTube)", "Facebook-Seite posten", "Instagram Reel anlegen", "TikTok posten"]:
    link("Text für Posts", b)
link("Video laden (YouTube)", "YouTube hochladen")
link("Instagram Reel anlegen", "IG: 3 Min. verarbeiten lassen")
link("IG: 3 Min. verarbeiten lassen", "Instagram veröffentlichen")

wf = {"name": "Hadith Studio – Video alle 2 Stunden", "nodes": nodes, "connections": C, "active": False,
      "settings": {"executionOrder": "v1", "saveManualExecutions": True, "timezone": "Europe/Berlin"}, "pinData": {}}
json.dump(wf, open("hadith_video_workflow.json", "w"), ensure_ascii=False, indent=1)
print(len(nodes), "nodes")
