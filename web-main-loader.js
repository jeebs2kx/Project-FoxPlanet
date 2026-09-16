(function(){
'use strict';

const MAIN='main-6b7e7ae7257abae7800d-095-dpeye2.js';
const PAYLOAD_PARTS=[...Array.from({length:9},(_,i)=>`web-sync/payload-part-${String(i).padStart(2,'0')}`),'web-sync/payload-part-09a','web-sync/payload-part-09b','web-sync/payload-part-10a0','web-sync/payload-part-10a1','web-sync/payload-part-10a200','web-sync/payload-part-10a201','web-sync/payload-part-10a202','web-sync/payload-part-10a203','web-sync/payload-part-10a21','web-sync/payload-part-10a22','web-sync/payload-part-10b','web-sync/payload-part-11'];
const AFTER=[
  'web-gametext.js',
  'sfa-map-sequences.js',
  'audio-hub.js',
  'web-local-data.js',
  'web-saved-gamedata.js?v=6',
  'web-mount.js',
  'web-layout.js?v=3',
  'web-ui.js?v=2',
  'web-dp-audio.js',
  'section-headings.js'
];
const REQUIRED_MARKERS=[
  'pfpDPVertexGroups',
  'PFP_DP_SKY_PRESETS',
  '__pfpDPCurrentMapId',
  '3249 === n'
];

function textDecoder(){return new TextDecoder('utf-8');}
async function fetchText(url){
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error(`could not load ${url} (${r.status})`);
  return await r.text();
}
function b64Bytes(text){
  const clean=text.replace(/\s+/g,'');
  const bin=atob(clean),out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
}
async function ungzip(bytes){
  if(typeof DecompressionStream!=='function')throw new Error('gzip decompression is unavailable in this browser');
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
function tarTextFiles(bytes){
  const out=new Map(),dec=textDecoder();
  const readString=(off,len)=>{
    let end=off;while(end<off+len&&bytes[end]!==0)end++;
    return dec.decode(bytes.subarray(off,end));
  };
  let off=0;
  while(off+512<=bytes.length){
    let name=readString(off,100);
    if(!name)break;
    const prefix=readString(off+345,155);
    if(prefix)name=prefix+'/'+name;
    const sizeText=readString(off+124,12).trim().replace(/\0/g,'');
    const size=parseInt(sizeText||'0',8)||0;
    const type=bytes[off+156];
    const dataOff=off+512;
    name=name.replace(/^\.\//,'');
    if(type===0||type===48)out.set(name,dec.decode(bytes.subarray(dataOff,dataOff+size)));
    off=dataOff+Math.ceil(size/512)*512;
  }
  return out;
}
async function loadPayload(){
  const parts=await Promise.all(PAYLOAD_PARTS.map(p=>fetchText(p+'?v=20260916b')));
  const packed=b64Bytes(parts.join(''));
  return tarTextFiles(await ungzip(packed));
}
function parsePatch(patch){
  const lines=patch.replace(/\r\n/g,'\n').split('\n'),hunks=[];
  let i=0;
  while(i<lines.length){
    const m=/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[i]);
    if(!m){i++;continue;}
    const h={oldStart:Number(m[1]),newStart:Number(m[3]),lines:[]};
    i++;
    while(i<lines.length&&!lines[i].startsWith('@@ ')&&!lines[i].startsWith('--- ')&&!lines[i].startsWith('+++ ')){
      const line=lines[i];
      if(line.startsWith(' ')||line.startsWith('+')||line.startsWith('-'))h.lines.push(line);
      i++;
    }
    hunks.push(h);
  }
  return hunks;
}
function hunkBlocks(h,leadTrim,tailTrim){
  let first=0,last=h.lines.length;
  while(leadTrim>0&&first<last&&h.lines[first][0]===' '){first++;leadTrim--;}
  while(tailTrim>0&&last>first&&h.lines[last-1][0]===' '){last--;tailTrim--;}
  const slice=h.lines.slice(first,last);
  return {
    old:slice.filter(x=>x[0]!=='+' ).map(x=>x.slice(1)),
    neu:slice.filter(x=>x[0]!=='-' ).map(x=>x.slice(1))
  };
}
function linesMatch(src,at,block){
  if(at<0||at+block.length>src.length)return false;
  for(let i=0;i<block.length;i++)if(src[at+i]!==block[i])return false;
  return true;
}
function findBlock(src,block,expected){
  if(!block.length)return Math.max(0,Math.min(src.length,expected));
  const lo=Math.max(0,expected-1800),hi=Math.min(src.length-block.length,expected+1800);
  for(let d=0;d<=1800;d++){
    const a=expected-d,b=expected+d;
    if(a>=lo&&linesMatch(src,a,block))return a;
    if(d&&b<=hi&&linesMatch(src,b,block))return b;
  }
  const first=block[0];
  for(let i=0;i<=src.length-block.length;i++)if(src[i]===first&&linesMatch(src,i,block))return i;
  return -1;
}
function applyStablePatch(source,patch){
  const src=source.replace(/\r\n/g,'\n').split('\n'),hunks=parsePatch(patch);
  let delta=0,applied=0,already=0,skipped=0;
  const misses=[];
  for(let hi=0;hi<hunks.length;hi++){
    const h=hunks[hi],expected=Math.max(0,h.oldStart-1+delta);
    let done=false;
    for(let fuzz=0;fuzz<=2&&!done;fuzz++){
      const trims=[];
      for(let a=0;a<=fuzz;a++)trims.push([a,fuzz-a]);
      for(const [lead,tail] of trims){
        const b=hunkBlocks(h,lead,tail);
        if(!b.old.length&&!b.neu.length)continue;
        let at=findBlock(src,b.old,expected);
        if(at>=0){
          src.splice(at,b.old.length,...b.neu);
          delta+=b.neu.length-b.old.length;applied++;done=true;break;
        }
        at=findBlock(src,b.neu,expected);
        if(at>=0){delta+=b.neu.length-b.old.length;already++;done=true;break;}
      }
    }
    if(!done){skipped++;misses.push(hi+1);}
  }
  return {text:src.join('\n'),total:hunks.length,applied,already,skipped,misses};
}
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('could not load '+src));document.head.appendChild(s);
  });
}
function evalSource(text,label){(0,eval)(text+`\n//# sourceURL=${label}`);}
function installCurrentKioskPatcher(){
  const upgrade=()=>{
    const api=window.PfpKioskCurrent;
    if(!api||typeof api.installKioskIsoPatcherPanel!=='function')return;
    const oldPanel=document.getElementById('kiosk-iso-sequence-patcher-panel');
    if(!oldPanel||oldPanel.dataset.pfpCurrentPatcher==='1')return;
    oldPanel.remove();
    const panel=api.installKioskIsoPatcherPanel(document.body);
    if(panel)panel.dataset.pfpCurrentPatcher='1';
  };
  new MutationObserver(upgrade).observe(document.documentElement,{childList:true,subtree:true});
  upgrade();
}
async function boot(){
  const [payload,original]=await Promise.all([loadPayload(),fetchText(MAIN+'?web=20260916b')]);
  const patch=payload.get('stable-main.patch');
  if(!patch)throw new Error('web sync payload is missing the desktop patch');
  const merged=applyStablePatch(original,patch);
  const markerCount=REQUIRED_MARKERS.filter(x=>merged.text.includes(x)).length;
  console.info('[FoxPlanet web sync]',merged,'markers',markerCount+'/'+REQUIRED_MARKERS.length);
  if(merged.applied+merged.already<55||markerCount<3){
    console.warn('[FoxPlanet web sync] desktop merge did not validate; keeping previous web bundle');
    evalSource(original,MAIN);
  }else{
    evalSource(merged.text,'Project-FoxPlanet-web-merged.js');
  }
  for(const src of AFTER)await loadScript(src);

  const dpSeq=payload.get('pfp-dp-map-sequences.js');
  const dpJson=payload.get('sequence-data/dp/dp-sequences.json');
  if(dpSeq&&dpJson){
    const url=URL.createObjectURL(new Blob([dpJson],{type:'application/json'}));
    const patched=dpSeq.split('sequence-data/dp/dp-sequences.json').join(url);
    evalSource(patched,'pfp-dp-map-sequences.js');
  }else console.warn('[FoxPlanet] DP sequence payload is missing');

  const kiosk=payload.get('pfp-kiosk-current.js');
  if(kiosk){evalSource(kiosk,'pfp-kiosk-current.js');installCurrentKioskPatcher();}
  else console.warn('[FoxPlanet] current kiosk patcher payload is missing');
}
boot().catch((e)=>{
  console.error('[FoxPlanet] web startup failed',e);
  const box=document.createElement('pre');
  box.textContent='FoxPlanet could not start. Try a hard refresh.\n\n'+String(e&&e.message||e);
  box.style.cssText='position:fixed;inset:20px;z-index:99999;background:#111;color:#eee;padding:16px;white-space:pre-wrap';
  document.body.appendChild(box);
});
})();