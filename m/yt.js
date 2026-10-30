window.__ytShort = async function(key){
 const sl=ms=>new Promise(s=>setTimeout(s,ms));
 const base='https://raw.githubusercontent.com/Hanzoul/hadith-studio/media-upload/m/';
 const meta=(await (await fetch(base+'shorts.json?'+Date.now())).json())[key];
 for(let i=0;i<20 && !document.querySelector('ytcp-uploads-file-picker input[type=file]');i++) await sl(500);
 const inp=document.querySelector('ytcp-uploads-file-picker input[type=file]');
 const b=await (await fetch(base+key+'.mp4')).blob();
 const dt=new DataTransfer(); dt.items.add(new File([b],key+'.mp4',{type:'video/mp4'})); inp.files=dt.files; inp.dispatchEvent(new Event('change',{bubbles:true}));
 for(let i=0;i<40 && document.querySelectorAll('ytcp-uploads-dialog #textbox').length<2;i++) await sl(500);
 await sl(1500);
 const setBox=(el,t)=>{el.focus();document.execCommand('selectAll',false,null);document.execCommand('insertText',false,t);el.dispatchEvent(new Event('input',{bubbles:true}));};
 const bx=[...document.querySelectorAll('ytcp-uploads-dialog #textbox')];
 setBox(bx[0],meta.title); setBox(bx[1],meta.desc);
 document.querySelector('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').click(); await sl(500);
 for(let i=0;i<3;i++){document.querySelector('ytcp-uploads-dialog #next-button').click();await sl(1500);}
 document.querySelector('ytcp-uploads-dialog tp-yt-paper-radio-button[name="PUBLIC"]').click(); await sl(600);
 return [bx[0].innerText, document.querySelector('ytcp-video-upload-progress')?.innerText];
};
'ok'
