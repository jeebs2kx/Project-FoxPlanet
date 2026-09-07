(function(){
'use strict';
if(window.__PFP_WEB_AMUSE_CACHE_V1)return;
window.__PFP_WEB_AMUSE_CACHE_V1=true;

const STATIC_WEB=location.protocol==='https:'||(location.protocol==='http:'&&!/^(localhost|127\.0\.0\.1)$/i.test(location.hostname));
if(!STATIC_WEB)return;
const ROOT=location.pathname.includes('/Project-FoxPlanet/')?'/Project-FoxPlanet/':'/';
const DB_NAME='project-foxplanet-saved-gamedata';
const DB_STORE='state';
const HANDLE_KEY='folder-handle';
const CACHE_REL='audio/amuse_v37_hq/cache-index.json';
const clean=p=>String(p||'').replace(/\\/g,'/').replace(/^\/+/, '').replace(/\/+/g,'/');
const lower=p=>clean(p).toLowerCase();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let savedRootPromise=null;
const indexCache=new Map();
let assignmentsPromise=null;

function mainFetcher(){return window.main&&window.main.dataFetcher||null;}
function sliceBuffer(s){
  if(!s)return null;
  try{if(typeof s.copyToBuffer==='function')return s.copyToBuffer(0,s.byteLength);}catch(_){}
  try{
    if(s.arrayBuffer instanceof ArrayBuffer){
      const off=Number(s.byteOffset||0),len=Number(s.byteLength===undefined?s.arrayBuffer.byteLength-off:s.byteLength);
      return s.arrayBuffer.slice(off,off+len);
    }
  }catch(_){}
  try{
    if(typeof s.createDataView==='function'){
      const v=s.createDataView();return v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength);
    }
  }catch(_){}
  return null;
}
function blobType(path){return /\.wav$/i.test(path)?'audio/wav':/\.ogg$/i.test(path)?'audio/ogg':/\.mp3$/i.test(path)?'audio/mpeg':'application/octet-stream';}

async function mountedBlob(path){
  const f=mainFetcher();
  if(!f||!Array.isArray(f.mounts))return null;
  for(const mount of f.mounts){
    if(!mount||typeof mount.fetchData!=='function')continue;
    try{
      const s=await mount.fetchData(clean(path),{allow404:true});
      const ab=sliceBuffer(s);
      if(ab)return new Blob([ab],{type:blobType(path)});
    }catch(_){}
  }
  return null;
}

function openDb(){
  return new Promise(resolve=>{
    if(!window.indexedDB){resolve(null);return;}
    try{
      const q=indexedDB.open(DB_NAME,1);
      q.onsuccess=()=>resolve(q.result);q.onerror=()=>resolve(null);
      q.onupgradeneeded=()=>{try{if(!q.result.objectStoreNames.contains(DB_STORE))q.result.createObjectStore(DB_STORE);}catch(_){}};
    }catch(_){resolve(null);}
  });
}
async function savedRoot(){
  if(savedRootPromise)return savedRootPromise;
  savedRootPromise=(async()=>{
    const db=await openDb();if(!db)return null;
    return new Promise(resolve=>{
      try{
        const tx=db.transaction(DB_STORE,'readonly'),q=tx.objectStore(DB_STORE).get(HANDLE_KEY);
        q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>resolve(null);
      }catch(_){resolve(null);}
    });
  })();
  return savedRootPromise;
}
async function handleFile(path){
  const root=await savedRoot();if(!root)return null;
  const parts=clean(path).split('/').filter(Boolean);if(!parts.length)return null;
  let dir=root;
  try{
    for(let i=0;i<parts.length-1;i++)dir=await dir.getDirectoryHandle(parts[i]);
    const fh=await dir.getFileHandle(parts[parts.length-1]);
    return await fh.getFile();
  }catch(_){return null;}
}
async function localBlob(path){return await mountedBlob(path)||await handleFile(path);}
async function localJson(path){
  const b=await localBlob(path);if(!b)return null;
  try{return JSON.parse(await b.text());}catch(_){return null;}
}

async function listVoiceStreams(pathBase){
  const prefix=lower(pathBase+'/streams/');
  const set=new Set();
  const f=mainFetcher();
  if(f&&Array.isArray(f.mounts))for(const mount of f.mounts){
    const entries=mount&&mount.entries;
    if(!(entries instanceof Map))continue;
    for(const key of entries.keys()){
      const k=lower(key);if(k.startsWith(prefix)&&/\.adp$/i.test(k))set.add(clean(k.slice(prefix.length)));
    }
  }
  try{
    const root=await savedRoot();
    if(root){
      let dir=root;
      for(const part of clean(pathBase+'/streams').split('/').filter(Boolean))dir=await dir.getDirectoryHandle(part);
      for await(const [name,h] of dir.entries())if(h.kind==='file'&&/\.adp$/i.test(name))set.add(name);
    }
  }catch(_){}
  return Array.from(set).sort((a,b)=>a.localeCompare(b)).map(path=>({path}));
}

async function cacheIndex(pathBase,force){
  const key=String(pathBase||'');
  if(!force&&indexCache.has(key))return indexCache.get(key);
  const j=await localJson(key+'/'+CACHE_REL);
  const good=j&&Array.isArray(j.entries)?j:null;
  if(good)indexCache.set(key,good);else indexCache.delete(key);
  return good;
}
function renderedEntries(j,kind){
  if(!j||!Array.isArray(j.entries))return [];
  return j.entries.filter(e=>e&&e.playable!==false&&String(e.kind||'music')===kind&&String(e.renderedPath||e.path||''));
}

async function assignments(){
  if(!assignmentsPromise)assignmentsPromise=fetch(ROOT+'audio-map-assignments.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
  return assignmentsPromise;
}
function mapTitle(){return String(document.title||'').replace(/\s*-\s*Star Fox Adventures\s*-\s*noclip\s*$/i,'').replace(/\s*-\s*noclip\s*$/i,'').trim();}
function currentPathBaseHint(){
  try{const p=window.__pfpSfaAudioState&&window.__pfpSfaAudioState.pathBase;if(p)return String(p);}catch(_){}
  return '';
}
async function currentAssignment(){
  const j=await assignments();if(!j||!j.maps)return null;
  const title=mapTitle();if(!title)return null;
  const vals=Object.values(j.maps).filter(a=>a&&String(a.mapTitle||'').trim().toLowerCase()===title.toLowerCase()&&a.entryId&&a.pathBase);
  if(!vals.length)return null;
  const hint=currentPathBaseHint();
  return (hint&&vals.find(a=>String(a.pathBase)===hint))||vals[0];
}

function installHubPatch(){
  const hub=window.__pfpAudioHub;if(!hub||hub.__pfpWebAmuseCacheV1)return false;
  hub.__pfpWebAmuseCacheV1=true;
  const oldLoadGcCore=hub.loadGcCore.bind(hub);
  const oldPlayGcMusyx=hub.playGcMusyx.bind(hub);
  const oldOpen=hub.open.bind(hub);
  const oldClose=hub.close.bind(hub);

  hub.loadGcCore=async function(game){
    if(!STATIC_WEB)return oldLoadGcCore(game);
    const pathBase=game==='kiosk'?'StarFoxAdventuresDemo':'StarFoxAdventures';
    const [idx,voices]=await Promise.all([cacheIndex(pathBase,false),listVoiceStreams(pathBase)]);
    const music=renderedEntries(idx,'music'),sfx=renderedEntries(idx,'sfx');
    if(this.category!=='voice'&&!music.length&&!sfx.length)
      throw new Error('No desktop Amuse cache found in this GameData yet. Play/cache a track once in the WEB AUDIO CACHE TEST desktop build, then reconnect GameData here.');
    const gc={pathBase,voices,music,sfx};
    this.caches[game].gc=gc;
    return gc;
  };

  hub.playGcMusyx=async function(item){
    if(!STATIC_WEB)return oldPlayGcMusyx(item);
    const e=item&&item.entry||{};
    const rel=String(e.renderedPath||e.path||'');
    if(!rel)throw new Error('This track is not cached by desktop FoxPlanet yet.');
    let blob=await localBlob(item.pathBase+'/'+rel);
    if(!blob)throw new Error('Cached Amuse WAV is missing from the connected GameData. Reconnect the GameData folder and try again.');
    blob=await this.normalizePcm16WavBlob(item.uid,blob);
    const url=URL.createObjectURL(blob);
    this.replaceTempUrl(url);
    this.audio.src=url;
    this.setPlainMediaVolume(item);
    this.audio.loop=!!this.loop.checked;
    this.audio.currentTime=0;
    await this.audio.play();
  };

  hub.open=async function(){
    if(mapAudio&&!mapAudio.paused){mapResumeAfterHub=true;try{mapAudio.pause();}catch(_){}}
    return oldOpen.apply(this,arguments);
  };
  hub.close=function(){
    const r=oldClose.apply(this,arguments);
    if(mapResumeAfterHub){mapResumeAfterHub=false;setTimeout(()=>syncMapAudio(true),30);}
    return r;
  };
  return true;
}

const mapAudio=new Audio();
mapAudio.preload='auto';mapAudio.loop=true;mapAudio.volume=.7;
window.__PFP_WEB_AMUSE_MAP_AUDIO=mapAudio;
let mapKey='';let mapUrl='';let mapResumeAfterHub=false;let syncSerial=0;let lastMapSyncAt=0;
function stopMapAudio(){
  mapKey='';try{mapAudio.pause();mapAudio.currentTime=0;}catch(_){}
  if(mapUrl){try{URL.revokeObjectURL(mapUrl);}catch(_){}mapUrl='';}
  try{mapAudio.removeAttribute('src');mapAudio.load();}catch(_){}
}
function mapVolume(){
  try{const v=Number(window.__pfpSfaAudioState&&window.__pfpSfaAudioState.vol&&window.__pfpSfaAudioState.vol.value);if(Number.isFinite(v))return Math.max(0,Math.min(1,v));}catch(_){}
  return .7;
}
async function syncMapAudio(force){
  const serial=++syncSerial;
  if(window.__pfpAudioHubOpen)return;
  const a=await currentAssignment();
  if(serial!==syncSerial)return;
  if(!a){stopMapAudio();return;}
  const key=String(a.pathBase)+'|'+String(a.entryId)+'|'+mapTitle();
  if(!force&&key===mapKey&&!mapAudio.paused)return;
  const idx=await cacheIndex(a.pathBase,!!force);
  if(serial!==syncSerial)return;
  const e=idx&&idx.entries&&idx.entries.find(x=>x&&String(x.id)===String(a.entryId));
  const rel=e&&String(e.renderedPath||e.path||'');
  if(!rel){if(key!==mapKey)stopMapAudio();return;}
  const blob=await localBlob(String(a.pathBase)+'/'+rel);
  if(serial!==syncSerial||!blob)return;
  stopMapAudio();
  mapKey=key;mapUrl=URL.createObjectURL(blob);mapAudio.src=mapUrl;mapAudio.loop=true;mapAudio.volume=mapVolume();
  try{
    const old=window.musicState&&window.musicState.audio;if(old&&old!==mapAudio)old.pause();
  }catch(_){}
  try{
    const old=window.__pfpSfaAudioState&&window.__pfpSfaAudioState.audio;if(old&&old!==mapAudio)old.pause();
  }catch(_){}
  try{await mapAudio.play();}catch(_){/* Browser may require the next user gesture. */}
}
function queueMapSync(force){
  const now=Date.now();if(!force&&now-lastMapSyncAt<80)return;lastMapSyncAt=now;
  setTimeout(()=>syncMapAudio(!!force).catch(()=>{}),0);
}

window.addEventListener('hashchange',()=>{indexCache.clear();queueMapSync(true);},true);
window.addEventListener('pfp-local-data-mounted',()=>{
  indexCache.clear();savedRootPromise=null;
  const hub=window.__pfpAudioHub;if(hub&&hub.caches){try{hub.caches.final.gc=null;hub.caches.kiosk.gc=null;}catch(_){} }
  queueMapSync(true);
});
window.addEventListener('pfp-r14-data-ready',()=>{indexCache.clear();queueMapSync(true);});
for(const ev of ['pointerdown','keydown','touchstart'])document.addEventListener(ev,()=>{
  if(mapKey&&mapAudio.paused&&!window.__pfpAudioHubOpen)mapAudio.play().catch(()=>{});
},{capture:true,passive:true});

const obs=new MutationObserver(()=>queueMapSync(false));
obs.observe(document.documentElement,{subtree:true,childList:true});
let tries=0;
const timer=setInterval(()=>{
  installHubPatch();queueMapSync(false);
  if(window.__pfpAudioHub&&++tries>120)clearInterval(timer);
},100);
installHubPatch();queueMapSync(true);
})();
