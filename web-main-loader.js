(function(){
'use strict';

const MAIN='main-6b7e7ae7257abae7800d-095-dpeye2.js';
const DATA_PARTS=[
  'assets/web-data/part-00','assets/web-data/part-01','assets/web-data/part-02',
  'assets/web-data/part-03','assets/web-data/part-04','assets/web-data/part-05',
  'assets/web-data/part-06','assets/web-data/part-07','assets/web-data/part-08',
  'assets/web-data/part-09a','assets/web-data/part-09b','assets/web-data/part-10a0',
  'assets/web-data/part-10a1','assets/web-data/part-10a200','assets/web-data/part-10a201',
  'assets/web-data/part-10a202','assets/web-data/part-10a203','assets/web-data/part-10a21',
  'assets/web-data/part-10a22','assets/web-data/part-10b','assets/web-data/part-11'
];
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
const CHECKS=['pfpDPVertexGroups','PFP_DP_SKY_PRESETS','__pfpDPCurrentMapId','3249 === n'];

function decoder(){return new TextDecoder('utf-8');}
async function text(url){
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error('could not load '+url+' ('+r.status+')');
  return await r.text();
}
function b64(data){
  const bin=atob(data.replace(/\s+/g,'')),out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
}
async function gunzip(bytes){
  if(typeof DecompressionStream!=='function')throw new Error('gzip is not available in this browser');
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
function untar(bytes){
  const out=new Map(),dec=decoder();
  const str=(off,len)=>{let end=off;while(end<off+len&&bytes[end]!==0)end++;return dec.decode(bytes.subarray(off,end));};
  let off=0;
  while(off+512<=bytes.length){
    let name=str(off,100);if(!name)break;
    const prefix=str(off+345,155);if(prefix)name=prefix+'/'+name;
    const size=parseInt(str(off+124,12).trim().replace(/\0/g,'')||'0',8)||0;
    const type=bytes[off+156],dataOff=off+512;
    name=name.replace(/^\.\//,'');
    if(type===0||type===48)out.set(name,dec.decode(bytes.subarray(dataOff,dataOff+size)));
    off=dataOff+Math.ceil(size/512)*512;
  }
  return out;
}
async function loadData(){
  const parts=await Promise.all(DATA_PARTS.map(p=>text(p+'?v=20260917c')));
  return untar(await gunzip(b64(parts.join(''))));
}
function hunks(patch){
  const lines=patch.replace(/\r\n/g,'\n').split('\n'),out=[];
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
    out.push(h);
  }
  return out;
}
function block(h,lead,tail){
  let first=0,last=h.lines.length;
  while(lead>0&&first<last&&h.lines[first][0]===' '){first++;lead--;}
  while(tail>0&&last>first&&h.lines[last-1][0]===' '){last--;tail--;}
  const x=h.lines.slice(first,last);
  return {old:x.filter(v=>v[0]!=='+').map(v=>v.slice(1)),neu:x.filter(v=>v[0]!=='-').map(v=>v.slice(1))};
}
function match(src,at,b){
  if(at<0||at+b.length>src.length)return false;
  for(let i=0;i<b.length;i++)if(src[at+i]!==b[i])return false;
  return true;
}
function find(src,b,expected){
  if(!b.length)return Math.max(0,Math.min(src.length,expected));
  const lo=Math.max(0,expected-1800),hi=Math.min(src.length-b.length,expected+1800);
  for(let d=0;d<=1800;d++){
    const a=expected-d,c=expected+d;
    if(a>=lo&&match(src,a,b))return a;
    if(d&&c<=hi&&match(src,c,b))return c;
  }
  for(let i=0;i<=src.length-b.length;i++)if(src[i]===b[0]&&match(src,i,b))return i;
  return -1;
}
function applyPatch(source,patch){
  const src=source.replace(/\r\n/g,'\n').split('\n'),list=hunks(patch);
  let delta=0,applied=0,already=0,skipped=0;
  for(const h of list){
    const expected=Math.max(0,h.oldStart-1+delta);
    let done=false;
    for(let fuzz=0;fuzz<=2&&!done;fuzz++){
      for(let lead=0;lead<=fuzz;lead++){
        const b=block(h,lead,fuzz-lead);
        if(!b.old.length&&!b.neu.length)continue;
        let at=find(src,b.old,expected);
        if(at>=0){src.splice(at,b.old.length,...b.neu);delta+=b.neu.length-b.old.length;applied++;done=true;break;}
        at=find(src,b.neu,expected);
        if(at>=0){delta+=b.neu.length-b.old.length;already++;done=true;break;}
      }
    }
    if(!done)skipped++;
  }
  return {text:src.join('\n'),total:list.length,applied,already,skipped};
}
function script(src){
  return new Promise((ok,fail)=>{
    const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>fail(new Error('could not load '+src));document.head.appendChild(s);
  });
}
function run(code,name){(0,eval)(code+'\n//# sourceURL='+name);}
function kioskPanel(){
  const api=window.PfpKioskCurrent;
  if(!api||typeof api.installKioskIsoPatcherPanel!=='function')return;
  const old=document.getElementById('kiosk-iso-sequence-patcher-panel');
  if(!old||old.dataset.pfpCurrentPatcher==='1')return;
  old.remove();
  const panel=api.installKioskIsoPatcherPanel(document.body);
  if(panel)panel.dataset.pfpCurrentPatcher='1';
}
async function boot(){
  const [data,original,mapPatch,dpPatch,dpRecentPacked]=await Promise.all([
    loadData(),
    text(MAIN+'?web=20260917c'),
    text('assets/web-data/sfa-maps.patch?v=20260917c'),
    text('assets/web-data/dp-envfx-clouds.patch?v=20260919a'),
    text('assets/web-data/dp-recent-updates.patch.gz.b64?v=20260919b')
  ]);
  const patch=data.get('stable-main.patch');
  if(!patch)throw new Error('missing web data');
  const merged=applyPatch(original,patch);
  const good=CHECKS.filter(x=>merged.text.includes(x)).length;
  if(merged.applied+merged.already<55||good<3){
    run(original,MAIN);
  }else{
    const maps=applyPatch(merged.text,mapPatch);
    const mapGood=
      maps.text.includes('__pfpSfaFenceEdgeFixActive')&&
      maps.text.includes('await nn(o, i, this.gameInfo, t.dataFetcher, l, "swaphol")')&&
      maps.text.includes('await nn(r, s, v.Ij, t.dataFetcher, o, "swaphol")')&&
      maps.text.includes('sfaMapAlphaCutoutFix');
    let runtime=mapGood?maps.text:merged.text;
    const dp=applyPatch(runtime,dpPatch);
    const dpGood=
      dp.applied+dp.already===dp.total&&
      dp.text.includes('dp-minic-clouds')&&
      dp.text.includes('"dp_19":{time:2,atmosphere:79,skyscape:78,env:79 }')&&
      dp.text.includes('"dp_23":{time:5,atmosphere:97,skyscape:95,env:94 }')&&
      dp.text.includes('"dp_35":{time:5,atmosphere:97,skyscape:95,env:100 }');
    if(dpGood){
      runtime=dp.text;
      const dpRecentPatch=decoder().decode(await gunzip(b64(dpRecentPacked)));
      const recent=applyPatch(runtime,dpRecentPatch);
      const recentGood=
        recent.applied+recent.already===recent.total&&
        recent.text.includes('dpHorizonDdraws = Array.from({ length: 16 }')&&
        recent.text.includes('const rows = Math.abs(roll) < 0.0001 ? 44 : 72;')&&
        recent.text.includes('const PFP_DP_NATIVE_ENVFX = Object.freeze({')&&
        recent.text.includes('"dp_6":{time:4,atmosphere:97,skyscape:95,env:94 }')&&
        recent.text.includes('"dp_18":{time:1,atmosphere:43,skyscape:36,env:43 }')&&
        recent.text.includes('if (!o.open) { o.raf = null; return; }');
      if(recentGood)runtime=recent.text;
      else console.warn('[FoxPlanet] recent DP update did not apply cleanly');
    }else console.warn('[FoxPlanet] DP ENVFX update did not apply cleanly');
    if(typeof window.__pfpApplyFinalParity==='function')runtime=window.__pfpApplyFinalParity(runtime);
    run(runtime,'Project-FoxPlanet-web.js');
  }
  for(const src of AFTER)await script(src);

  const dpSeq=data.get('pfp-dp-map-sequences.js');
  const dpJson=data.get('sequence-data/dp/dp-sequences.json');
  if(dpSeq&&dpJson){
    const url=URL.createObjectURL(new Blob([dpJson],{type:'application/json'}));
    run(dpSeq.split('sequence-data/dp/dp-sequences.json').join(url),'pfp-dp-map-sequences.js');
  }

  const kiosk=data.get('pfp-kiosk-current.js');
  if(kiosk){
    run(kiosk,'pfp-kiosk-current.js');
    new MutationObserver(kioskPanel).observe(document.documentElement,{childList:true,subtree:true});
    kioskPanel();
  }
}
boot().catch(e=>{
  console.error('[FoxPlanet]',e);
  const box=document.createElement('pre');
  box.textContent='FoxPlanet could not start. Try a hard refresh.\n\n'+String(e&&e.message||e);
  box.style.cssText='position:fixed;inset:20px;z-index:99999;background:#111;color:#eee;padding:16px;white-space:pre-wrap';
  document.body.appendChild(box);
});
})();
