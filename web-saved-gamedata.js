(function(){
'use strict';
if(window.__PFP_SAVED_GAMEDATA)return;
window.__PFP_SAVED_GAMEDATA=true;

const DB_NAME='project-foxplanet-saved-gamedata';
const STORE='state';
const HANDLE_KEY='folder-handle';
const MANIFEST_KEY='folder-manifest-v1';
const MOUNT_LABEL='Local GameData (remembered)';
const ROOTS=new Set(['starfoxadventures','starfoxadventuresdemo','dinosaurplanet','dinosaurplanet_vanilla','sequence-data']);
let savedHandle=null;
let savedManifest=null;
let activeMount=null;
let reconnecting=false;

const clean=p=>String(p||'').replace(/\\/g,'/').replace(/^\/+/, '').replace(/\/+/g,'/');
const key=p=>clean(p).toLowerCase();

class LocalSlice{
  constructor(buffer,name){this.arrayBuffer=buffer;this.byteOffset=0;this.byteLength=buffer.byteLength;this.name=name||'';}
  slice(begin,end){begin=begin||0;const realEnd=end&&end!==0?end:this.byteLength;return new LocalSlice(this.arrayBuffer.slice(begin,realEnd),this.name);}
  subarray(begin,byteLength){begin=begin||0;if(byteLength===undefined)byteLength=this.byteLength-begin;return new LocalSlice(this.arrayBuffer.slice(begin,begin+byteLength),this.name);}
  copyToBuffer(begin,byteLength){begin=begin||0;if(byteLength===undefined)byteLength=this.byteLength-begin;return this.arrayBuffer.slice(begin,begin+byteLength);}
  createDataView(offs,length){offs=offs||0;if(length===undefined)length=this.byteLength-offs;return new DataView(this.arrayBuffer,offs,length);}
  createTypedArray(clazz,offs,count,endianness){
    offs=offs||0;const bytes=clazz.BYTES_PER_ELEMENT||1;if(count===undefined)count=Math.floor((this.byteLength-offs)/bytes);
    const length=count*bytes;let raw=new Uint8Array(this.arrayBuffer.slice(offs,offs+length));
    if(bytes>1&&endianness===1){
      if(bytes===2)for(let i=0;i+1<raw.length;i+=2){const a=raw[i];raw[i]=raw[i+1];raw[i+1]=a;}
      else if(bytes===4)for(let i=0;i+3<raw.length;i+=4){const a0=raw[i],a1=raw[i+1];raw[i]=raw[i+3];raw[i+1]=raw[i+2];raw[i+2]=a1;raw[i+3]=a0;}
    }
    return new clazz(raw.buffer,0,count);
  }
}

class SavedFileEntry{
  constructor(root,path){this.root=root;this.path=clean(path);this.handle=null;this.file=null;}
  async resolve(){
    if(this.handle)return this.handle;
    const parts=this.path.split('/').filter(Boolean);let dir=this.root;
    for(let i=0;i<parts.length-1;i++)dir=await dir.getDirectoryHandle(parts[i]);
    this.handle=await dir.getFileHandle(parts[parts.length-1]);
    return this.handle;
  }
  async read(path,opts){
    opts=opts||{};
    if(!this.file)this.file=await (await this.resolve()).getFile();
    let start=Math.max(0,Number(opts.rangeStart||0));
    let size=opts.rangeSize===undefined?this.file.size-start:Math.max(0,Number(opts.rangeSize));
    if(start>this.file.size)return null;
    const end=Math.min(this.file.size,start+size);
    const buffer=await this.file.slice(start,end).arrayBuffer();
    return new LocalSlice(buffer,path||this.path);
  }
}

function openDb(){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB)return resolve(null);
    const q=indexedDB.open(DB_NAME,1);
    q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains(STORE))q.result.createObjectStore(STORE);};
    q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
  });
}
async function dbGet(k){const db=await openDb();if(!db)return null;return new Promise(resolve=>{const tx=db.transaction(STORE,'readonly'),q=tx.objectStore(STORE).get(k);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>resolve(null);});}
async function dbPut(k,v){const db=await openDb();if(!db)return;return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(v,k);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}
async function dbDelete(k){const db=await openDb();if(!db)return;return new Promise(resolve=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(k);tx.oncomplete=resolve;tx.onerror=resolve;});}

function status(text){const e=document.getElementById('pfp-web-data-status');if(e)e.textContent=text;}
function fetcher(){return window.main&&window.main.dataFetcher;}
async function waitForFetcher(){for(let i=0;i<200;i++){const f=fetcher();if(f&&Array.isArray(f.mounts))return f;await new Promise(r=>setTimeout(r,50));}throw new Error('FoxPlanet data loader is not ready yet.');}

function aliasesFor(path){
  path=clean(path);const parts=path.split('/').filter(Boolean),lower=parts.map(p=>p.toLowerCase()),out=new Set([path]);
  const gd=lower.lastIndexOf('gamedata');if(gd>=0&&gd+1<parts.length)out.add(parts.slice(gd+1).join('/'));
  for(let i=0;i<parts.length;i++)if(ROOTS.has(lower[i])){out.add(parts.slice(i).join('/'));break;}
  return out;
}

function makeMount(root,manifest){
  const entries=new Map();
  for(const rel0 of manifest){
    const rel=clean(rel0);if(!rel)continue;
    const entry=new SavedFileEntry(root,rel);
    for(const a of aliasesFor(rel))entries.set(key(a),entry);
  }
  return {
    label:MOUNT_LABEL,
    __pfpAliasesReady:true,
    entries,
    async fetchData(path,opts){const e=entries.get(key(path));return e?e.read(clean(path),opts||{}):null;}
  };
}

async function attachSavedMount(root,manifest){
  const f=await waitForFetcher();
  if(activeMount&&Array.isArray(f.mounts)){const i=f.mounts.indexOf(activeMount);if(i>=0)f.mounts.splice(i,1);}
  const mount=makeMount(root,manifest);
  f.mounts.unshift(mount);activeMount=mount;
  window.__PFP_LOCAL_MOUNT_ACTIVE=true;
  window.__PFP_SESSION_MOUNT=mount;
  window.__PFP_SAVED_GAMEDATA_ACTIVE=true;
  try{f.completedCache&&f.completedCache.clear();}catch(_){}
  try{window.dispatchEvent(new CustomEvent('pfp-local-data-mounted',{detail:{kind:'saved-folder'}}));}catch(_){}
  try{window.dispatchEvent(new CustomEvent('pfp-r14-data-ready'));}catch(_){}
  updateUi();
  return mount;
}

async function buildManifest(root,onProgress){
  const out=[];
  async function walk(dir,rel){
    for await(const [name,child] of dir.entries()){
      const path=rel?rel+'/'+name:name;
      if(child.kind==='directory')await walk(child,path);
      else if(child.kind==='file'){
        out.push(path);
        if(onProgress&&out.length%500===0)onProgress(out.length);
      }
    }
  }
  await walk(root,'');
  return out;
}

async function rememberHandle(handle){
  if(!handle||handle.kind!=='directory')throw new Error('Drop the GameData folder itself.');
  status('Remembering GameData folder...');
  const manifest=await buildManifest(handle,n=>status('Remembering GameData folder... '+n+' files found'));
  if(!manifest.length)throw new Error('No files were found in that folder.');
  savedHandle=handle;savedManifest=manifest;
  await dbPut(HANDLE_KEY,handle);await dbPut(MANIFEST_KEY,manifest);
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist();}catch(_){}
  await attachSavedMount(handle,manifest);
  status('GameData remembered - '+manifest.length+' files. Next time, use RECONNECT GAMEDATA instead of choosing the folder again.');
  updateUi();
}

async function permission(handle,request){
  if(!handle)return 'denied';
  try{
    if(typeof handle.queryPermission==='function'){
      let p=await handle.queryPermission({mode:'read'});
      if(p==='granted'||!request)return p;
    }
    if(request&&typeof handle.requestPermission==='function')return await handle.requestPermission({mode:'read'});
  }catch(_){}
  return 'denied';
}

async function reconnect(){
  if(reconnecting||!savedHandle)return false;reconnecting=true;
  try{
    status('Reconnecting saved GameData...');
    const p=await permission(savedHandle,true);
    if(p!=='granted'){status('GameData is remembered, but Chrome did not grant access.');return false;}
    if(!savedManifest||!savedManifest.length)savedManifest=await dbGet(MANIFEST_KEY);
    if(!savedManifest||!savedManifest.length){
      savedManifest=await buildManifest(savedHandle,n=>status('Reading saved GameData... '+n+' files found'));
      await dbPut(MANIFEST_KEY,savedManifest);
    }
    await attachSavedMount(savedHandle,savedManifest);
    status('Saved GameData connected - '+savedManifest.length+' files.');
    return true;
  }finally{reconnecting=false;updateUi();}
}

async function forget(){
  await dbDelete(HANDLE_KEY);await dbDelete(MANIFEST_KEY);
  savedHandle=null;savedManifest=null;
  status('Saved GameData forgotten. The currently open session is unchanged.');
  updateUi();
}

function installStyle(){
  if(document.getElementById('pfp-saved-gamedata-style'))return;
  const s=document.createElement('style');s.id='pfp-saved-gamedata-style';s.textContent=`
#pfp-saved-gamedata{margin:10px 0 0;padding:10px 12px;border:1px dashed rgba(227,181,54,.58);border-radius:8px;background:rgba(12,26,38,.72);color:#d7dde5;font:12px monospace;text-align:center;cursor:default;user-select:none}
#pfp-saved-gamedata.pfp-can-reconnect{cursor:pointer;border-style:solid;background:rgba(31,58,72,.78)}
#pfp-saved-gamedata.pfp-drag{border-style:solid;background:rgba(51,79,92,.92)}
#pfp-saved-gamedata strong{display:block;color:#e2b737;font-size:12px;margin-bottom:4px;letter-spacing:.4px}
#pfp-saved-gamedata small{display:block;opacity:.78;line-height:1.35}
#pfp-saved-gamedata button{margin-top:7px;border:0;background:none;color:#9fb5c7;font:11px monospace;text-decoration:underline;cursor:pointer}
`;(document.head||document.documentElement).appendChild(s);
}

function updateLoadButton(){
  const b=document.getElementById('pfp-web-open-data');if(!b)return;
  if(savedHandle&&!window.__PFP_SAVED_GAMEDATA_ACTIVE){b.textContent='RECONNECT GAMEDATA';b.title='Reconnect the GameData folder remembered by this browser.';}
  else{b.textContent='LOAD GAME FILES';b.title='';}
}

function updateUi(){
  updateLoadButton();
  const box=document.getElementById('pfp-saved-gamedata');if(!box)return;
  const title=box.querySelector('strong'),note=box.querySelector('small'),forgetBtn=box.querySelector('button');
  box.classList.toggle('pfp-can-reconnect',!!savedHandle&&!window.__PFP_SAVED_GAMEDATA_ACTIVE);
  if(window.__PFP_SAVED_GAMEDATA_ACTIVE){title.textContent='GAMEDATA REMEMBERED';note.textContent='This folder is connected for this visit and saved for later visits.';}
  else if(savedHandle){title.textContent='RECONNECT SAVED GAMEDATA';note.textContent='Click once to reconnect the folder saved by this browser. No folder picker is needed.';}
  else{title.textContent='REMEMBER GAMEDATA';note.textContent='Chrome/Edge: drag your GameData folder here once to remember it between visits.';}
  forgetBtn.hidden=!savedHandle;
}

function enhanceModal(){
  const card=document.getElementById('pfp-web-data-card');if(!card||document.getElementById('pfp-saved-gamedata')){updateUi();return;}
  installStyle();
  const box=document.createElement('div');box.id='pfp-saved-gamedata';
  const title=document.createElement('strong'),note=document.createElement('small'),forgetBtn=document.createElement('button');
  forgetBtn.type='button';forgetBtn.textContent='Forget saved folder';
  box.append(title,note,forgetBtn);
  const statusEl=document.getElementById('pfp-web-data-status');card.insertBefore(box,statusEl||null);
  box.addEventListener('dragover',e=>{e.preventDefault();box.classList.add('pfp-drag');});
  box.addEventListener('dragleave',()=>box.classList.remove('pfp-drag'));
  box.addEventListener('drop',e=>{
    e.preventDefault();e.stopPropagation();box.classList.remove('pfp-drag');
    const items=Array.from(e.dataTransfer&&e.dataTransfer.items||[]).filter(x=>x.kind==='file');
    Promise.all(items.map(x=>typeof x.getAsFileSystemHandle==='function'?x.getAsFileSystemHandle():Promise.resolve(null))).then(handles=>{
      const h=handles.find(x=>x&&x.kind==='directory');
      if(!h){status('This browser cannot remember that dropped folder. Chrome or Edge works best for this feature.');return;}
      rememberHandle(h).catch(err=>status('Could not remember GameData. '+(err&&err.message?err.message:String(err))));
    });
  });
  box.addEventListener('click',e=>{if(e.target===forgetBtn)return;if(savedHandle&&!window.__PFP_SAVED_GAMEDATA_ACTIVE)reconnect().catch(err=>status('Could not reconnect GameData. '+(err&&err.message?err.message:String(err))));});
  forgetBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();forget().catch(()=>{});});
  updateUi();
}

// Startup is deliberately lightweight. Only read the saved directory handle here.
// The large manifest and mount are restored only after the user clicks RECONNECT GAMEDATA.
async function readSavedState(){
  try{savedHandle=await dbGet(HANDLE_KEY);}catch(e){console.warn('[FoxPlanet] saved GameData state',e);}
  updateUi();
}

document.addEventListener('click',e=>{
  const b=e.target&&e.target.closest&&e.target.closest('#pfp-web-open-data');
  if(!b||!savedHandle||window.__PFP_SAVED_GAMEDATA_ACTIVE)return;
  e.preventDefault();e.stopImmediatePropagation();
  reconnect().catch(err=>{status('Could not reconnect GameData. '+(err&&err.message?err.message:String(err)));try{window.__PFP_WEB_OPEN_DATA&&window.__PFP_WEB_OPEN_DATA();}catch(_){}});
},true);

new MutationObserver(()=>{enhanceModal();updateLoadButton();}).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('load',()=>{setTimeout(enhanceModal,100);setTimeout(updateLoadButton,300);});
setTimeout(readSavedState,500);
})();
