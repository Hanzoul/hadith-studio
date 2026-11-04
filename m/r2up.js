window.r2up=async(key,day)=>{
const sl=ms=>new Promise(s=>setTimeout(s,ms));
const base='https://raw.githubusercontent.com/Hanzoul/hadith-studio/media-upload/m/';
const meta=(await (await fetch(base+'r2.json')).json())[key];
for(let i=0;i<20 && !document.querySelector('ytcp-uploads-file-picker input[type=file]');i++) await sl(500);
const inp=document.querySelector('ytcp-uploads-file-picker input[type=file]');
const b=await (await fetch(base+key+'.mp4')).blob();
const dt=new DataTransfer(); dt.items.add(new File([b],key+'.mp4',{type:'video/mp4'})); inp.files=dt.files; inp.dispatchEvent(new Event('change',{bubbles:true}));
for(let i=0;i<40 && document.querySelectorAll('ytcp-uploads-dialog #textbox').length<2;i++) await sl(500);
let bx=[...document.querySelectorAll('ytcp-uploads-dialog #textbox')];
for(let i=0;i<20 && !bx[0].innerText.trim();i++) await sl(500);
await sl(1500);
const setBox=async(el,t)=>{el.click(); el.focus(); await sl(300); const r=document.createRange(); r.selectNodeContents(el); const s=getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('insertText',false,t); el.dispatchEvent(new Event('input',{bubbles:true})); await sl(300);};
await setBox(bx[0],meta.title); await setBox(bx[1],meta.desc);
document.querySelector('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').click(); await sl(500);
const titleOk=bx[0].innerText.trim()===meta.title;
if(!titleOk) return ['TITLE FAIL', bx[0].innerText];
for(let i=0;i<3;i++){document.querySelector('ytcp-uploads-dialog #next-button').click();await sl(1500);}
document.querySelector('ytcp-uploads-dialog #second-container-expand-button').click(); await sl(1200);
const trig=document.querySelector('ytcp-uploads-dialog #datepicker-trigger'); trig.click(); await sl(1200);
const cell=[...document.querySelectorAll('*')].find(e=>e.offsetParent && e.children.length===0 && e.innerText && e.innerText.trim()===String(day) && e.getBoundingClientRect().top>150 && !e.closest('ytcp-uploads-dialog #second-container'));
if(cell){cell.click(); await sl(1000);}
const t=document.querySelector('ytcp-uploads-dialog #time-of-day-container input'); t.click(); await sl(800);
const it=[...document.querySelectorAll('[role=option], tp-yt-paper-item')].filter(e=>e.innerText.replace(/\s/g,'')==='6:00PM'); if(it[0]){it[0].scrollIntoView({block:'center'}); it[0].click();} await sl(800);
const dv=trig.innerText.trim();
if(dv!==`Nov ${day}, 2026` || t.value!=='6:00 PM') return ['DATE FAIL',dv,t.value];
document.querySelector('ytcp-uploads-dialog #done-button').click(); await sl(3000);
const d=[...document.querySelectorAll('tp-yt-paper-dialog, ytcp-dialog')].find(d=>d.offsetParent && /still checking/.test(d.innerText));
if(d){ [...d.querySelectorAll('button')].find(b=>/Got it/.test(b.innerText))?.click(); await sl(3500);}
const s=document.querySelector('ytcp-video-share-dialog');
return s? s.innerText.slice(0,140):'kein share';
};'loaded'
