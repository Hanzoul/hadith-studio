"""Hadith Studio – rendering pipeline: audio + script -> hand-drawn whiteboard MP4 (+ vertical stories)."""
import asyncio, base64, json, os, re, shutil, subprocess, time
from pathlib import Path

import httpx
import numpy as np
import soundfile as sf

BASE = Path(__file__).resolve().parent
KIT = BASE / "kit"
MODELS = Path(os.environ.get("MODELS_DIR", BASE / "models"))
CLAUDE_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")
WORKERS = int(os.environ.get("RENDER_WORKERS", "2"))
FPS = int(os.environ.get("FPS", "25"))
PRESET = os.environ.get("FFMPEG_PRESET", "veryfast")
CRF = os.environ.get("VIDEO_CRF", "28")


def sh(*args):
    subprocess.run(list(args), check=True)


def log(job, msg, progress=None):
    st = job.status
    st["log"].append(f"{time.strftime('%H:%M:%S')} {msg}")
    if progress is not None:
        st["progress"] = progress
    job.save()


# ---------------------------------------------------------------- audio
def prepare_audio(job, req):
    d = job.dir
    fmt = (req.get("audio_format") or "pcm_s16le_24000").lower()
    parts = req.get("audio_b64")
    if parts:
        if isinstance(parts, str):
            parts = [parts]
        if fmt.startswith("pcm"):
            m = re.search(r"(\d{4,6})", fmt)
            rate = m.group(1) if m else "24000"
            raw = b"".join(base64.b64decode(p) for p in parts)
            (d / "audio.pcm").write_bytes(raw)
            sh("ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-f", "s16le", "-ar", rate, "-ac", "1", "-i", str(d / "audio.pcm"), str(d / "audio.wav"))
        else:
            ext = fmt if fmt in ("wav", "mp3", "m4a", "ogg") else "wav"
            lst = []
            for i, p in enumerate(parts):
                f = d / f"part{i}.{ext}"
                f.write_bytes(base64.b64decode(p))
                lst.append(f"file '{f.name}'")
            (d / "parts.txt").write_text("\n".join(lst))
            sh("ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(d / "parts.txt"), "-ar", "24000", "-ac", "1", str(d / "audio.wav"))
    elif (d / "upload").exists():
        sh("ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(d / "upload"), "-ar", "24000", "-ac", "1", str(d / "audio.wav"))
    else:
        raise ValueError("no audio given (audio_b64 or file upload)")
    # small tail of silence so the last drawing can finish
    sh("ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(d / "audio.wav"), "-af", "apad=pad_dur=1.5", str(d / "audio_padded.wav"))
    os.replace(d / "audio_padded.wav", d / "audio.wav")
    info = sf.info(str(d / "audio.wav"))
    return round(info.frames / info.samplerate, 2)


# ---------------------------------------------------------------- transcription (timing only)
_REC = None


def transcribe(job, language="ar"):
    global _REC
    import sherpa_onnx as so
    d = job.dir
    sh("ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(d / "audio.wav"), "-ar", "16000", "-ac", "1", str(d / "a16.wav"))
    M = MODELS / "sherpa-onnx-whisper-small"
    if _REC is None:
        _REC = so.OfflineRecognizer.from_whisper(encoder=str(M / "small-encoder.int8.onnx"), decoder=str(M / "small-decoder.int8.onnx"), tokens=str(M / "small-tokens.txt"), language=language, task="transcribe", num_threads=max(1, os.cpu_count() or 2))
    cfg = so.VadModelConfig()
    cfg.silero_vad.model = str(MODELS / "silero_vad.onnx")
    cfg.silero_vad.min_silence_duration = 0.35
    cfg.silero_vad.max_speech_duration = 15
    cfg.sample_rate = 16000
    vad = so.VoiceActivityDetector(cfg, buffer_size_in_seconds=1800)
    x, sr = sf.read(str(d / "a16.wav"), dtype="float32")
    out = []

    def drain():
        while not vad.empty():
            s = vad.front
            st = s.start / sr
            seg = np.array(s.samples, dtype=np.float32)
            r = _REC.create_stream()
            r.accept_waveform(sr, np.concatenate([seg, np.zeros(int(.4 * sr), dtype=np.float32)]))
            _REC.decode_stream(r)
            out.append({"s": round(st, 2), "e": round(st + len(seg) / sr, 2), "t": r.result.text.strip()})
            vad.pop()

    for i in range(0, len(x), 512):
        vad.accept_waveform(x[i:i + 512])
        drain()
    vad.flush()
    drain()
    txt = "\n".join(f"{o['s']:.2f}-{o['e']:.2f} {o['t']}" for o in out)
    (d / "segments.txt").write_text(txt)
    return txt


# ---------------------------------------------------------------- Claude
def claude(system, messages, max_tokens=32000):
    if not CLAUDE_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    body = {"model": CLAUDE_MODEL, "max_tokens": max_tokens, "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}], "messages": messages, "stream": True}
    headers = {"x-api-key": CLAUDE_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    text = []
    with httpx.stream("POST", "https://api.anthropic.com/v1/messages", json=body, headers=headers, timeout=httpx.Timeout(900, connect=30)) as r:
        if r.status_code != 200:
            raise RuntimeError(f"Claude API {r.status_code}: {r.read()[:500]!r}")
        for line in r.iter_lines():
            if not line.startswith("data:"):
                continue
            ev = json.loads(line[5:].strip() or "{}")
            if ev.get("type") == "content_block_delta" and ev["delta"].get("type") == "text_delta":
                text.append(ev["delta"]["text"])
            elif ev.get("type") == "error":
                raise RuntimeError(f"Claude API error: {ev}")
    return "".join(text)


def extract_js(s):
    m = re.search(r"```(?:js|javascript)?\s*\n(.*?)```", s, re.S)
    return (m.group(1) if m else s).strip()


def scenes_system():
    return (BASE / "prompts" / "scenes_system.md").read_text() + "\n```js\n" + (KIT / "scenes_example.js").read_text() + "\n```\n"


def write_scenes(job, req, segments, duration):
    user = (f"Title: {req.get('title','')}\nAudio duration: {duration} s (last scene must end at {duration}).\n\n"
            f"## Script (exact wording)\n{req.get('script','')}\n\n## Timed transcript (timing only)\n{segments}\n\n"
            "Write scenes.js now.")
    msgs = [{"role": "user", "content": user}]
    out = claude(scenes_system(), msgs)
    js = extract_js(out)
    (job.dir / "scenes.js").write_text(js)
    return js, msgs + [{"role": "assistant", "content": out}]


# ---------------------------------------------------------------- page build + browser checks
def build_page(job):
    eng = "\n".join((KIT / f).read_text() for f in ["engine.js", "hand.js", "assets.js", "helpers.js"])
    scenes = (job.dir / "scenes.js").read_text()
    ff = "".join(f'@font-face{{font-family:"{fam}";font-weight:{w};src:url(file://{KIT}/fonts/{f})}}' for fam, w, f in [
        ("Amiri", 400, "Amiri-Regular.ttf"), ("Amiri", 700, "Amiri-Bold.ttf"), ("Aref Ruqaa", 400, "ArefRuqaa-Regular.ttf"), ("Aref Ruqaa", 700, "ArefRuqaa-Bold.ttf")])
    html = f"""<!doctype html><html><head><meta charset="utf-8"><style>{ff}html,body{{margin:0;background:#f3ead6}}</style></head>
<body><canvas id="cv" width="1920" height="1080"></canvas>
<script>{eng}</script><script>{scenes}</script>
<script>(async()=>{{const L=['700 64px "Aref Ruqaa"','400 64px "Aref Ruqaa"','700 64px "Amiri"','400 64px "Amiri"'].map(f=>document.fonts.load(f,'استر').catch(()=>{{}}));
await Promise.race([Promise.all(L),new Promise(r=>setTimeout(r,8000))]);
try{{buildFilm();initRenderer(document.getElementById('cv'));window.renderAt=t=>render(CX,t);window.__ready=true}}catch(e){{window.__error=String(e&&e.stack||e)}}}})();</script></body></html>"""
    (job.dir / "render.html").write_text(html)


CHECK_JS = """()=>{const T=FILM.tasks,o=[];for(let i=1;i<T.length;i++)for(let j=i-1;j>=Math.max(0,i-6);j--)if(T[i].t0<T[j].t1-0.02){const sc=x=>x.it?x.it.sc.id:x.e.sc.id;o.push(sc(T[i])+': item at '+T[i].t0.toFixed(2)+' starts before previous task ends ('+T[j].t0.toFixed(2)+'-'+T[j].t1.toFixed(2)+')')}
const S=FILM.scenes.map(s=>({id:s.id,t0:s.t0,t1:s.t1,title:s.title,desc:s.desc}));return {overlaps:o,scenes:S}}"""


async def _open(pw, job):
    b = await pw.chromium.launch(args=["--disable-gpu", "--allow-file-access-from-files"])
    pg = await b.new_page(viewport={"width": 1280, "height": 800})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    await pg.goto(f"file://{job.dir}/render.html")
    try:
        await pg.wait_for_function("window.__ready===true || !!window.__error", timeout=120000)
    except Exception:
        pass
    err = await pg.evaluate("window.__error || null")
    if err:
        errs.append(err)
    return b, pg, errs


async def check_page(job):
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        b, pg, errs = await _open(pw, job)
        res = {"errors": errs, "overlaps": [], "scenes": []}
        if not errs:
            res.update(await pg.evaluate(CHECK_JS))
        await b.close()
        return res


async def render_range(job, out, t0, t1, prog):
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        b, pg, errs = await _open(pw, job)
        if errs:
            raise RuntimeError("page error: " + errs[0][:400])
        ff = subprocess.Popen(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                               "-c:v", "libx264", "-preset", PRESET, "-crf", CRF, "-tune", "animation", "-pix_fmt", "yuv420p", str(out)], stdin=subprocess.PIPE)
        n0, n1 = int(t0 * FPS), int(t1 * FPS)
        for i in range(n0, n1):
            d = await pg.evaluate(f'(()=>{{renderAt({i / FPS});return document.getElementById("cv").toDataURL("image/jpeg",.88)}})()')
            ff.stdin.write(base64.b64decode(d[23:]))
            prog[out.name] = (i - n0 + 1) / max(1, n1 - n0)
        ff.stdin.close()
        ff.wait()
        await b.close()


def render_video(job, duration):
    d = job.dir
    cuts = [round(duration * k / WORKERS, 2) for k in range(WORKERS + 1)]
    outs = [d / f"chunk{k}.mp4" for k in range(WORKERS)]
    prog = {}

    async def run():
        async def ticker():
            while True:
                await asyncio.sleep(20)
                p = sum(prog.values()) / WORKERS
                job.status["progress"] = round(0.2 + 0.65 * p, 3)
                job.save()
        t = asyncio.create_task(ticker())
        await asyncio.gather(*[render_range(job, outs[k], cuts[k], cuts[k + 1], prog) for k in range(WORKERS)])
        t.cancel()

    asyncio.run(run())
    (d / "chunks.txt").write_text("\n".join(f"file '{o.name}'" for o in outs))
    sh("ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(d / "chunks.txt"), "-i", str(d / "audio.wav"),
       "-map", "0:v", "-map", "1:a", "-c:v", "copy",
       "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", str(d / "video.mp4"))
    for o in outs:
        o.unlink(missing_ok=True)


# ---------------------------------------------------------------- vertical stories
STORY_HTML = """<html><head><meta charset="utf-8"><style>
@font-face{font-family:"Amiri";font-weight:700;src:url(file://KIT/fonts/Amiri-Bold.ttf)}
@font-face{font-family:"Aref Ruqaa";font-weight:700;src:url(file://KIT/fonts/ArefRuqaa-Bold.ttf)}
html,body{margin:0;width:1080px;height:1920px}
.pg{position:absolute;inset:0;background:#f3ead6;direction:rtl;font-family:"Aref Ruqaa",serif;color:#1f1d1a}
.pg:after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(90,70,40,0) 55%,rgba(90,70,40,.18) 100%)}
.num{position:absolute;top:170px;right:90px;left:90px;display:flex;justify-content:space-between;font-family:"Amiri",serif;font-size:34px;color:#2e5a46}
.ttl{position:absolute;top:250px;right:70px;left:70px;text-align:center;font-size:92px;line-height:1.25;font-weight:700}
.frame{position:absolute;left:-6px;top:634px;width:1092px;height:620px;border-top:5px solid #1f1d1a;border-bottom:5px solid #1f1d1a;box-sizing:border-box}
.take{position:absolute;top:1340px;right:80px;left:80px;text-align:center;font-size:56px;line-height:1.5;color:#2e5a46;font-weight:700}
.ft{position:absolute;bottom:150px;right:0;left:0;text-align:center;font-size:40px;color:#5f5a50}
</style></head><body><div class="pg"><div class="num"><span>NUM</span><span>SERIES</span></div><div class="ttl">TITLE</div>
<div class="frame"></div><div class="take">TAKE</div><div class="ft">شارِكها مع من تحب</div></div></body></html>"""


def group_stories(scenes, duration, lo=25, hi=58):
    groups, cur = [], None
    for s in [s for s in scenes if s["t0"] < duration - 3]:
        t1 = min(s["t1"], duration)
        if cur and (t1 - cur["t0"] <= hi):
            cur["t1"] = t1
            cur["scenes"].append(s)
            if t1 - cur["t0"] >= lo:
                groups.append(cur)
                cur = None
            continue
        if cur:
            groups.append(cur)
        cur = {"t0": s["t0"], "t1": t1, "scenes": [s]}
    if cur:
        if groups and cur["t1"] - cur["t0"] < 12 and cur["t1"] - groups[-1]["t0"] <= 75:
            groups[-1]["t1"] = cur["t1"]
            groups[-1]["scenes"] += cur["scenes"]
        else:
            groups.append(cur)
    return groups


def make_stories(job, scenes, duration, series):
    from playwright.sync_api import sync_playwright
    d = job.dir / "stories"
    d.mkdir(exist_ok=True)
    groups = group_stories(scenes, duration)
    meta = []
    esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;")
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--allow-file-access-from-files"])
        pg = b.new_page(viewport={"width": 1080, "height": 1920})
        for k, g in enumerate(groups, 1):
            title = g["scenes"][0]["title"]
            take = g["scenes"][-1]["title"] if len(g["scenes"]) > 1 else ""
            html = STORY_HTML.replace("KIT", str(KIT)).replace("NUM", f"ستوري {k} من {len(groups)}").replace("SERIES", esc(series)).replace("TITLE", esc(title)).replace("TAKE", esc(take))
            (d / "_bg.html").write_text(html)
            pg.goto(f"file://{d}/_bg.html")
            pg.evaluate("document.fonts.ready")
            pg.wait_for_timeout(150)
            pg.screenshot(path=str(d / f"bg_{k:02d}.png"))
            meta.append({"n": k, "t0": g["t0"], "t1": g["t1"], "title": title})
        b.close()
    for m in meta:
        k, a, z = m["n"], m["t0"], m["t1"]
        dur = round(z - a, 2)
        fo = max(0, round(dur - .45, 2))
        sh("ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-i", str(d / f"bg_{k:02d}.png"),
           "-ss", str(a), "-t", str(dur), "-i", str(job.dir / "video.mp4"), "-ss", str(a), "-t", str(dur), "-i", str(job.dir / "audio.wav"),
           "-filter_complex", f"[1:v]scale=1080:608,fade=t=in:st=0:d=0.5:color=0xf3ead6,fade=t=out:st={fo}:d=0.45:color=0xf3ead6[v];[0:v][v]overlay=0:640:shortest=1,format=yuv420p[o];[2:a]afade=t=in:d=0.15,afade=t=out:st={fo}:d=0.45[a]",
           "-map", "[o]", "-map", "[a]", "-t", str(dur), "-c:v", "libx264", "-preset", PRESET, "-crf", "24", "-tune", "animation", "-r", str(FPS),
           "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(d / f"story_{k:02d}.mp4"))
        (d / f"bg_{k:02d}.png").unlink(missing_ok=True)
    (d / "_bg.html").unlink(missing_ok=True)
    return meta


def make_vertical(job, title, series, duration):
    """Full film as 9:16 (Reels / TikTok): title on top, film in the middle, series name below."""
    from playwright.sync_api import sync_playwright
    d = job.dir
    esc = lambda s: s.replace("&", "&amp;").replace("<", "&lt;")
    html = STORY_HTML.replace("KIT", str(KIT)).replace("NUM", "").replace("SERIES", "").replace("TITLE", esc(title)).replace("TAKE", esc(series))
    (d / "_v.html").write_text(html)
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=["--allow-file-access-from-files"])
        pg = b.new_page(viewport={"width": 1080, "height": 1920})
        pg.goto(f"file://{d}/_v.html"); pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(150)
        pg.screenshot(path=str(d / "_v.png")); b.close()
    sh("ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-i", str(d / "_v.png"), "-i", str(d / "video.mp4"),
       "-filter_complex", "[1:v]scale=1080:608[v];[0:v][v]overlay=0:640:shortest=1,format=yuv420p[o]", "-map", "[o]", "-map", "1:a",
       "-c:v", "libx264", "-preset", PRESET, "-crf", CRF, "-tune", "animation", "-r", str(FPS), "-c:a", "copy", "-movflags", "+faststart", str(d / "video_vertical.mp4"))
    (d / "_v.png").unlink(missing_ok=True); (d / "_v.html").unlink(missing_ok=True)


# ---------------------------------------------------------------- publishing texts (title, description, chapters, captions, hashtags)
SOCIAL_PROMPT = """You write social-media publishing texts for the Moroccan Islamic channel «حديث بالقلم» (@hadith.bilqalam): hand-drawn whiteboard videos explaining hadiths in Moroccan Darija.
Return ONLY one JSON object with these keys:
 "youtube_titles": 3 strings ≤ 95 chars each, curiosity-driven question in Darija + ' | حديث بالقلم' on at least one,
 "youtube_intro": 2–3 short Darija lines that open the description (hook + what the video explains),
 "hadith_block": the hadith/verses exactly as quoted in the script with their source exactly as given (never add sources, numbers or gradings that are not in the script),
 "call_to_action": 2–3 short lines (share, subscribe, bell),
 "tags": 12–18 YouTube tags (Arabic, comma-free strings),
 "hashtags": 5–7 Arabic hashtags starting with # (always include #حديث_بالقلم),
 "instagram_caption": ≤ 2000 chars: hook question line, the core hadith line, one Darija takeaway, a share line, then the hashtags,
 "tiktok_caption": ≤ 300 chars incl. 4–5 hashtags,
 "facebook_caption": 3–6 lines + hashtags,
 "pinned_comment": one engaging Darija question/comment to pin under the video.
Use Darija, warm and respectful. No emojis overload (max 4 per text). Never invent religious text."""


def chapters_from(scenes, duration, min_len=10):
    out = []
    for s in scenes:
        t0 = max(0.0, s["t0"])
        if t0 >= duration - 3:
            break
        if out and t0 - out[-1][0] < min_len:
            continue
        out.append((0.0 if not out else t0, s["title"]))
    fmt = lambda t: f"{int(t // 60)}:{int(t % 60):02d}"
    return "\n".join(f"{fmt(t)} {title}" for t, title in out)


def social_pack(job, req, scenes, duration):
    chapters = chapters_from(scenes, duration)
    data = {}
    try:
        out = claude(SOCIAL_PROMPT, [{"role": "user", "content": f"Title: {req.get('title','')}\n\nScript:\n{req.get('script','')}"}], max_tokens=4000)
        m = re.search(r"\{.*\}", out, re.S)
        data = json.loads(m.group(0)) if m else {}
    except Exception as e:
        data = {"error": str(e)[:300]}
    tags = " ".join(data.get("hashtags", []) or ["#حديث_بالقلم"])
    desc = "\n".join(filter(None, [data.get("youtube_intro", ""), "", "📖 " + data.get("hadith_block", "") if data.get("hadith_block") else "", "", "⏱️ الفصول:", chapters, "",
                                   data.get("call_to_action", ""), "", "✍️ حديث بالقلم: أحاديث النبي ﷺ بالدارجة، مرسومة باليد.",
                                   "📌 كنحرصو نذكرو مصدر كل حديث. إلا لاحظتي شي خطأ كتب لينا فالتعليقات، وجزاك الله خيراً.", "", tags]))
    data["chapters"] = chapters
    data["youtube_description"] = desc
    (job.dir / "social.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
    md = [f"# {req.get('title','')}", "", "## عناوين يوتيوب", *[f"{i+1}. {t}" for i, t in enumerate(data.get("youtube_titles", []))],
          "", "## وصف يوتيوب", "```", desc, "```", "", "## التاغات", "```", ", ".join(data.get("tags", [])), "```",
          "", "## التعليق المثبت", data.get("pinned_comment", ""), "", "## إنستغرام", "```", data.get("instagram_caption", ""), "```",
          "", "## تيكتوك", "```", data.get("tiktok_caption", ""), "```", "", "## فيسبوك", "```", data.get("facebook_caption", ""), "```"]
    (job.dir / "social.md").write_text("\n".join(md))
    return data


# ---------------------------------------------------------------- main job
def run_job(job):
    req = job.request
    st = job.status
    st["state"] = "running"
    log(job, "Audio vorbereiten", 0.01)
    duration = prepare_audio(job, req)
    st["duration"] = duration
    if req.get("scenes_js"):
        (job.dir / "scenes.js").write_text(req["scenes_js"])
        convo = None
        log(job, "scenes.js übernommen", 0.1)
    else:
        log(job, "Transkription (Timing)", 0.03)
        segs = transcribe(job, req.get("language", "ar"))
        log(job, f"Szenen schreiben mit {CLAUDE_MODEL}", 0.08)
        _, convo = write_scenes(job, req, segs, duration)
    build_page(job)
    res = asyncio.run(check_page(job))
    tries = 0
    while convo and (res["errors"] or res["overlaps"]) and tries < 2:
        tries += 1
        problems = "\n".join(res["errors"][:5] + res["overlaps"][:40])
        log(job, f"Korrekturrunde {tries}: {len(res['errors'])} Fehler, {len(res['overlaps'])} Überschneidungen", 0.15)
        convo.append({"role": "user", "content": f"The engine reported these problems:\n{problems}\n\nReturn the complete corrected scenes.js (same rules)."})
        out = claude(scenes_system(), convo)
        convo.append({"role": "assistant", "content": out})
        (job.dir / "scenes.js").write_text(extract_js(out))
        build_page(job)
        res = asyncio.run(check_page(job))
    if res["errors"]:
        raise RuntimeError("scenes.js fehlerhaft: " + res["errors"][0][:300])
    st["warnings"] = res["overlaps"][:20]
    st["scenes"] = res["scenes"]
    (job.dir / "storyboard.json").write_text(json.dumps(res["scenes"], ensure_ascii=False, indent=1))
    log(job, f"Rendern ({len(res['scenes'])} Szenen, {WORKERS} Prozesse)", 0.2)
    render_video(job, duration)
    files = ["video.mp4", "storyboard.json", "scenes.js"]
    log(job, "Texte für YouTube/Instagram/TikTok/Facebook", 0.84)
    social_pack(job, req, res["scenes"], duration)
    files += ["social.json", "social.md"]
    if req.get("vertical", True):
        log(job, "Hochformat-Version (Reels/TikTok)", 0.86)
        make_vertical(job, req.get("title", ""), req.get("series") or "", duration)
        files.append("video_vertical.mp4")
    if req.get("stories", True):
        log(job, "Stories schneiden", 0.88)
        meta = make_stories(job, res["scenes"], duration, req.get("series") or req.get("title", ""))
        st["stories"] = meta
        files += [f"stories/story_{m['n']:02d}.mp4" for m in meta]
    for f in ["a16.wav", "audio.pcm", "render.html"]:
        (job.dir / f).unlink(missing_ok=True)
    st["files"] = files
    st["state"] = "done"
    log(job, "Fertig", 1.0)
