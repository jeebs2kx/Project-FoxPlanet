(function(){
'use strict';

const PARTS=Array.from({length:61},(_,i)=>'assets/web-v144/part-'+String(i).padStart(2,'0'));
const AFTER=[
  'web-gametext.js?v=7',
  'web-local-data.js',
  'web-saved-gamedata.js?v=6',
  'web-mount.js',
  'web-layout.js?v=3',
  'web-ui.js?v=2',
  'web-dp-audio.js',
  'web-dp-sequence-fixes.js?v=3'
];

const dec=new TextDecoder('utf-8');
async function text(url){
  const r=await fetch(url,{cache:'no-store'});
  if(!r.ok)throw new Error('could not load '+url+' ('+r.status+')');
  return r.text();
}
function b64(s){
  const bin=atob(s.replace(/\s+/g,'')),out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
}
async function gunzip(bytes){
  if(typeof DecompressionStream!=='function')throw new Error('gzip is not available in this browser');
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}
function untar(bytes){
  const out=new Map();
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
function run(src,name){
  (0,eval)(src+'\n//# sourceURL='+name);
}
function script(src){
  return new Promise((ok,fail)=>{
    const s=document.createElement('script');
    s.src=src;s.onload=ok;s.onerror=()=>fail(new Error('could not load '+src));
    document.head.appendChild(s);
  });
}
function addStyle(css){
  const old=document.getElementById('pfp-section-headings-v6-css');
  if(old)old.remove();
  const s=document.createElement('style');
  s.id='pfp-section-headings-v6-css';
  s.textContent=css;
  document.head.appendChild(s);
}
function kioskPanel(){
  const old=document.getElementById('kiosk-iso-sequence-patcher-panel');
  if(!old||old.dataset.pfpCurrentPatcher==='1')return;
  old.remove();
  const panel=window.PfpKioskCurrent&&window.PfpKioskCurrent.installKioskIsoPatcherPanel?window.PfpKioskCurrent.installKioskIsoPatcherPanel(document.body):null;
  if(panel)panel.dataset.pfpCurrentPatcher='1';
}
async function boot(){
  const joined=(await Promise.all(PARTS.map(p=>text(p+'?v=20260930a')))).join('');
  const data=untar(await gunzip(b64(joined)));
  const early=data.get('pfp-updated-early-converter.js');
  const main=data.get('main-6b7e7ae7257abae7800d-095-dpeye2.js');
  if(!early||!main)throw new Error('V144 runtime data is incomplete');
  run(early,'pfp-updated-early-converter.js');
  run(main,'main-6b7e7ae7257abae7800d-095-dpeye2.js');

  const gameText=data.get('pfp-sfa-gametext.js');
  const sfaSeq=data.get('pfp-sfa-map-sequences.js');
  const dpSeq=data.get('pfp-dp-map-sequences.js');
  const dpJson=data.get('dp-sequences.json');
  const audio=data.get('pfp-audio-hub.js');
  const css=data.get('pfp-section-headings-v6.css');
  const headings=data.get('pfp-section-headings-v6.js');
  const kiosk=data.get('pfp-kiosk-current.js');

  if(gameText)run(gameText,'pfp-sfa-gametext.js');
  if(sfaSeq)run(sfaSeq,'pfp-sfa-map-sequences.js');
  if(dpSeq&&dpJson){
    const url=URL.createObjectURL(new Blob([dpJson],{type:'application/json'}));
    run(dpSeq.split('sequence-data/dp/dp-sequences.json').join(url),'pfp-dp-map-sequences.js');
  }else if(dpSeq)run(dpSeq,'pfp-dp-map-sequences.js');
  if(audio)run(audio,'pfp-audio-hub.js');
  if(css)addStyle(css);
  if(headings)run(headings,'pfp-section-headings-v6.js');

  for(const src of AFTER)await script(src);

  if(kiosk){
    run(kiosk,'pfp-kiosk-current.js');
    new MutationObserver(kioskPanel).observe(document.documentElement,{childList:true,subtree:true});
    kioskPanel();
  }
  window.__PFP_WEB_RUNTIME='V144';
  window.dispatchEvent(new CustomEvent('pfp-runtime-v144-ready'));
}
boot().catch(e=>{
  console.error('[FoxPlanet]',e);
  const box=document.createElement('pre');
  box.textContent='FoxPlanet could not start. Try a hard refresh.\n\n'+String(e&&e.message||e);
  box.style.cssText='position:fixed;inset:20px;z-index:99999;background:#111;color:#eee;padding:16px;white-space:pre-wrap';
  document.body.appendChild(box);
});
})();