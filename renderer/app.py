"""Hadith Studio – HTTP API for n8n.

Auth: header  X-API-Key: <RENDER_TOKEN>   (file downloads also accept ?token=<RENDER_TOKEN>)
POST /jobs                 JSON {title, script, audio_b64 (str|list), audio_format, language, series, stories, scenes_js?}
POST /jobs/upload          multipart: file=<audio>, title, script, ...
GET  /jobs/{id}            status + file URLs
GET  /files/{id}/{path}    download (video.mp4, stories/story_01.mp4, storyboard.json ...)
POST /topics/import        multipart: file=<pdf>  -> background import (Claude reads the PDF pages)
GET  /topics/import/status  progress
GET  /topics/next          next unused topic (marks it 'used')
GET  /topics               list
"""
import json, os, queue, re, shutil, sqlite3, threading, time, traceback, uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

import pipeline

DATA = Path(os.environ.get("DATA_DIR", "/data"))
JOBS = DATA / "jobs"
JOBS.mkdir(parents=True, exist_ok=True)
TOKEN = os.environ.get("RENDER_TOKEN", "")
PUBLIC_URL = os.environ.get("PUBLIC_URL", "").rstrip("/")
KEEP_DAYS = float(os.environ.get("KEEP_DAYS", "7"))

app = FastAPI(title="Hadith Studio Renderer")
Q = queue.Queue()


def auth(key):
    if not TOKEN or key != TOKEN:
        raise HTTPException(401, "invalid X-API-Key")


class Job:
    def __init__(self, jid):
        self.id = jid
        self.dir = JOBS / jid
        self.status = json.loads((self.dir / "status.json").read_text()) if (self.dir / "status.json").exists() else {}
        self.request = json.loads((self.dir / "request.json").read_text()) if (self.dir / "request.json").exists() else {}

    def save(self):
        tmp = self.dir / "status.tmp"
        tmp.write_text(json.dumps(self.status, ensure_ascii=False))
        os.replace(tmp, self.dir / "status.json")


def new_job(req):
    jid = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
    d = JOBS / jid
    d.mkdir(parents=True)
    (d / "request.json").write_text(json.dumps(req, ensure_ascii=False))
    j = Job(jid)
    j.status = {"id": jid, "state": "queued", "progress": 0, "log": [], "title": req.get("title", ""), "created": time.time()}
    j.save()
    return j


def worker():
    while True:
        jid = Q.get()
        j = Job(jid)
        try:
            pipeline.run_job(j)
        except Exception as e:
            j.status["state"] = "error"
            j.status["error"] = str(e)[:2000]
            j.status["log"].append(traceback.format_exc()[-3000:])
            j.save()
        finally:
            for f in ["request.json"]:
                pass
            cleanup()


def cleanup():
    lim = time.time() - KEEP_DAYS * 86400
    for d in JOBS.iterdir():
        try:
            if d.is_dir() and d.stat().st_mtime < lim:
                shutil.rmtree(d)
        except Exception:
            pass


@app.on_event("startup")
def _start():
    for d in sorted(JOBS.iterdir()):  # re-queue unfinished jobs after a restart
        j = Job(d.name)
        if j.status.get("state") in ("queued", "running"):
            j.status["state"] = "queued"
            j.save()
            Q.put(j.id)
    threading.Thread(target=worker, daemon=True).start()


def view(j, request):
    st = dict(j.status)
    base = PUBLIC_URL or str(request.base_url).rstrip("/")
    st["urls"] = {f: f"{base}/files/{j.id}/{f}?token={TOKEN}" for f in st.get("files", [])}
    st["queue_position"] = list(Q.queue).index(j.id) + 1 if j.id in list(Q.queue) else 0
    return st


@app.get("/health")
def health():
    return {"ok": True, "queue": Q.qsize()}


@app.post("/jobs")
async def create_job(request: Request, x_api_key: str = Header(None)):
    auth(x_api_key)
    req = await request.json()
    if not req.get("audio_b64"):
        raise HTTPException(400, "audio_b64 missing")
    j = new_job(req)
    Q.put(j.id)
    return view(j, request)


@app.post("/jobs/upload")
async def create_job_upload(request: Request, file: UploadFile = File(...), title: str = Form(""), script: str = Form(""),
                            language: str = Form("ar"), series: str = Form(""), stories: bool = Form(True), x_api_key: str = Header(None)):
    auth(x_api_key)
    j = new_job({"title": title, "script": script, "language": language, "series": series, "stories": stories})
    with open(j.dir / "upload", "wb") as f:
        shutil.copyfileobj(file.file, f)
    Q.put(j.id)
    return view(j, request)


@app.get("/jobs/{jid}")
def get_job(jid: str, request: Request, x_api_key: str = Header(None)):
    auth(x_api_key)
    if not re.fullmatch(r"[\w-]+", jid) or not (JOBS / jid).exists():
        raise HTTPException(404, "job not found")
    return view(Job(jid), request)


@app.get("/files/{jid}/{path:path}")
def get_file(jid: str, path: str, token: str = Query(None), x_api_key: str = Header(None)):
    if not TOKEN or (token != TOKEN and x_api_key != TOKEN):
        raise HTTPException(401, "invalid token")
    p = (JOBS / jid / path).resolve()
    if not str(p).startswith(str(JOBS.resolve())) or not p.is_file():
        raise HTTPException(404, "file not found")
    return FileResponse(p, filename=p.name)


# ---------------------------------------------------------------- topics from a PDF
DB = DATA / "topics.sqlite"


def db():
    c = sqlite3.connect(DB)
    c.execute("create table if not exists topics(id integer primary key, title text, text text, source text, note text, state text default 'new', used_at real)")
    return c


TOPIC_PROMPT = """You extract hadiths from PDF pages. Return ONLY a JSON array. Each element:
{"num": the hadith number printed in the source or null, "title": short Arabic title (3-6 words), "text": the hadith text exactly as written in the source (keep tashkeel if present), "source": the takhrij exactly as written in the source (e.g. رواه البخاري ومسلم) or "" if none is written, "note": grading/remarks exactly as in the source or ""}
Rules: copy text verbatim, never correct, complete or invent hadith wording, sources or gradings. Skip tables of contents and commentary-only paragraphs. If nothing is found return []."""

IMPORT = {"running": False, "done": 0, "total": 0, "imported": 0, "error": ""}
PAGES_PER_CALL = 4


def _import_worker(path):
    import base64, io
    from pypdf import PdfReader, PdfWriter
    try:
        reader = PdfReader(str(path))
        n = len(reader.pages)
        IMPORT.update(total=(n + PAGES_PER_CALL - 1) // PAGES_PER_CALL, done=0, imported=0, error="")
        seen = set()
        c = db()
        for r in c.execute("select text from topics"):
            seen.add(re.sub(r"\s+", "", r[0] or ""))
        for a in range(0, n, PAGES_PER_CALL):
            w = PdfWriter()
            for i in range(a, min(a + PAGES_PER_CALL, n)):
                w.add_page(reader.pages[i])
            buf = io.BytesIO(); w.write(buf)
            msg = [{"role": "user", "content": [
                {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": base64.b64encode(buf.getvalue()).decode()}},
                {"type": "text", "text": "Extract every hadith on these pages as the JSON array."}]}]
            found = []
            for attempt in range(3):
                try:
                    out = pipeline.claude(TOPIC_PROMPT, msg, max_tokens=16000)
                    m = re.search(r"\[.*\]", out, re.S)
                    found = json.loads(m.group(0)) if m else []
                    break
                except Exception as e:
                    if attempt == 2:
                        raise
                    time.sleep(10)
            for h in found:
                key = re.sub(r"\s+", "", h.get("text") or "")
                if not key or key in seen:
                    continue
                seen.add(key)
                c.execute("insert into topics(title,text,source,note) values(?,?,?,?)", (h.get("title", ""), h.get("text", ""), h.get("source", ""), h.get("note", "")))
                IMPORT["imported"] += 1
            c.commit()
            IMPORT["done"] += 1
    except Exception as e:
        traceback.print_exc()
        IMPORT["error"] = str(e)[:300]
    finally:
        path.unlink(missing_ok=True)
        IMPORT["running"] = False


@app.post("/topics/import")
async def import_pdf(file: UploadFile = File(...), x_api_key: str = Header(None)):
    auth(x_api_key)
    if IMPORT["running"]:
        raise HTTPException(409, "Es läuft schon ein Import. Bitte warten.")
    tmp = DATA / f"import-{uuid.uuid4().hex}.pdf"
    with open(tmp, "wb") as f:
        shutil.copyfileobj(file.file, f)
    IMPORT.update(running=True, done=0, total=0, imported=0, error="")
    threading.Thread(target=_import_worker, args=(tmp,), daemon=True).start()
    return {"started": True}


@app.get("/topics/import/status")
def import_status(x_api_key: str = Header(None)):
    auth(x_api_key)
    n = db().execute("select count(*) from topics where state='new'").fetchone()[0]
    return {**IMPORT, "open_topics": n}


@app.get("/topics/next")
def next_topic(x_api_key: str = Header(None)):
    auth(x_api_key)
    c = db()
    r = c.execute("select id,title,text,source,note from topics where state='new' order by id limit 1").fetchone()
    if not r:
        return JSONResponse({"empty": True}, status_code=200)
    c.execute("update topics set state='used', used_at=? where id=?", (time.time(), r[0]))
    c.commit()
    return {"empty": False, "id": r[0], "title": r[1], "text": r[2], "source": r[3], "note": r[4]}


@app.post("/topics/{tid}/reset")
def reset_topic(tid: int, x_api_key: str = Header(None)):
    auth(x_api_key)
    c = db()
    c.execute("update topics set state='new' where id=?", (tid,))
    c.commit()
    return {"ok": True}


@app.get("/topics")
def list_topics(x_api_key: str = Header(None)):
    auth(x_api_key)
    c = db()
    return [dict(zip(["id", "title", "source", "state"], r)) for r in c.execute("select id,title,source,state from topics order by id")]


UI = """<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hadith Studio – Themen</title><style>
body{font-family:system-ui,sans-serif;background:#f3ead6;color:#1f1d1a;max-width:760px;margin:0 auto;padding:24px 16px}
h1{font-size:26px;margin:0 0 4px}p{color:#5f5a50}label{display:block;margin:14px 0 4px;font-weight:600}
input{font:inherit;padding:8px;width:100%;box-sizing:border-box;border:1px solid #cfc6b3;border-radius:8px;background:#fff}
button{margin-top:14px;font:inherit;font-weight:600;padding:10px 18px;border:0;border-radius:8px;background:#2e5a46;color:#fff;cursor:pointer}
table{width:100%;border-collapse:collapse;margin-top:20px;font-size:14px}td,th{border-bottom:1px solid #cfc6b3;padding:6px;text-align:right}
#msg{margin-top:12px;font-weight:600;color:#2e5a46}</style></head><body dir="ltr">
<h1>Hadith Studio – Themenliste</h1><p>PDF hochladen: Die Hadithe werden ausgelesen und der Reihe nach alle 2 Stunden verfilmt.</p>
<label for="tk">Zugangsschlüssel (RENDER_TOKEN)</label><input id="tk" type="password">
<label for="f">PDF-Datei</label><input id="f" type="file" accept="application/pdf">
<button id="go">Hochladen und auslesen</button> <button id="ls">Liste anzeigen</button><div id="msg"></div><table id="t"></table>
<script>
const $=id=>document.getElementById(id);try{$('tk').value=localStorage.getItem('tk')||''}catch(e){}
const H=()=>{try{localStorage.setItem('tk',$('tk').value)}catch(e){};return {'X-API-Key':$('tk').value}};
$('go').onclick=async()=>{const f=$('f').files[0];if(!f){$('msg').textContent='Bitte eine PDF wählen.';return}
$('msg').textContent='Wird hochgeladen…';const fd=new FormData();fd.append('file',f);
const r=await fetch('/topics/import',{method:'POST',headers:H(),body:fd});const j=await r.json();
if(!r.ok){$('msg').textContent='Fehler: '+(j.detail||r.status);return}poll()};
async function poll(){const r=await fetch('/topics/import/status',{headers:H()});const j=await r.json();
if(j.running){$('msg').textContent=`Wird ausgelesen… Teil ${j.done} von ${j.total||'?'} – bisher ${j.imported} Hadithe`;setTimeout(poll,5000);return}
$('msg').textContent=j.error?('Fehler: '+j.error+` (bisher ${j.imported} übernommen)`):`Fertig: ${j.imported} Hadithe übernommen – offen: ${j.open_topics}`;list()}
async function list(){const r=await fetch('/topics',{headers:H()});if(!r.ok){$('msg').textContent='Schlüssel falsch?';return}
const L=await r.json();const e=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));$('t').innerHTML='<tr><th>#</th><th>Titel</th><th>Quelle</th><th>Status</th></tr>'+L.map(x=>`<tr><td>${x.id}</td><td dir="rtl">${e(x.title)}</td><td dir="rtl">${e(x.source)}</td><td>${x.state==='new'?'offen':'verwendet'}</td></tr>`).join('')}
$('ls').onclick=list;</script></body></html>"""


@app.get("/topics/ui")
def topics_ui():
    from fastapi.responses import HTMLResponse
    return HTMLResponse(UI)
