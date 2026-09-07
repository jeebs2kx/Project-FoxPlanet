(function(){
'use strict';
if(window.__PFP_SAVED_GAMEDATA)return;
window.__PFP_SAVED_GAMEDATA=true;

const DB_NAME='project-foxplanet-saved-gamedata';
const STORE='state';
const HANDLE_KEY='folder-handle';
const MANIFEST_KEY='folder-manifest-v1';
const ROOTS=new Set(['starfoxadventures','starfoxadventuresdemo','dinosaurplanet','dinosaurplanet_vanilla','sequence-data']);
let savedHandle=null;
let savedManifest=null;
let stateLoaded=false;
let reconnecting=false;
let activeMount=null;

const clean=p=>String(p||'').replace(/\\/g,'/').replace(/^\/+/, '').replace(/\/+/g,'/');
const lower=p=>clean(p).toLowerCase();
const yieldUi=()=>new Promise(r=>setTimeout(r,0));

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
    const start=Math.max(0,Number(opts.rangeStart||0));
    const size=opts.rangeSize===undefined?this.file.size-start:Math.max(0,Number(opts.rangeSize));
    if(start>this.file.size)return null;
    const end=Math.min(this.file.size,start+size);
    return new LocalSlice(await this.file.slice(start,end).arrayBuffer(),path||this.path);
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
async function waitForFetcher(){for(let i=0;i<120;i++){const f=fetcher();if(f&&Array.isArray(f.mounts))return f;await new Promise(r=>setTimeout(r,50));}throw new Error('FoxPlanet data loader is not ready yet.');}

function aliasesFor(path){
  path=clean(path);const parts=path.split('/').filter(Boolean),lp=parts.map(p=>p.toLowerCase()),out=new Set([path]);
  const gd=lp.lastIndexOf('gamedata');if(gd>=0&&gd+1<parts.length)out.add(parts.slice(gd+1).join('/'));
  for(let i=0;i<parts.length;i++)if(ROOTS.has(lp[i])){out.add(parts.slice(i).join('/'));break;}
  return out;
}

async function makeMount(root,manifest){
  const entries=new Map();
  for(let i=0;i<manifest.length;i++){
    const rel=clean(manifest[i]);if(!rel)continue;
    const entry=new SavedFileEntry(root,rel);
    for(const a of aliasesFor(rel))entries.set(lower(a),entry);
    if((i%1000)===999)await yieldUi();
  }
  return {label:'Local GameData (remembered)',__pfpAliasesReady:true,entries,async fetchData(path,opts){const e=entries.get(lower(path));return e?e.read(clean(path),opts||{}):null;}};
}

async function attachMount(root,manifest){
  const f=await waitForFetcher();
  if(activeMount){const i=f.mounts.indexOf(activeMount);if(i>=0)f.mounts.splice(i,1);}
  const mount=await makeMount(root,manifest);
  f.mounts.unshift(mount);activeMount=mount;
  window.__PFP_LOCAL_MOUNT_ACTIVE=true;
  window.__PFP_SESSION_MOUNT=mount;
  window.__PFP_SAVED_GAMEDATA_ACTIVE=true;
  try{f.completedCache&&f.completedCache.clear();}catch(_){}
  try{window.dispatchEvent(new CustomEvent('pfp-local-data-mounted',{detail:{kind:'saved-folder'}}));}catch(_){}
  try{window.dispatchEvent(new CustomEvent('pfp-r14-data-ready'));}catch(_){}
  return mount;
}

async function buildManifest(root){
  const out=[];
  async function walk(dir,rel){
    for await(const [name,child] of dir.entries()){
      const path=rel?rel+'/'+name:name;
      if(child.kind==='directory')await walk(child,path);
      else if(child.kind==='file'){
        out.push(path);
        if((out.length%500)===0){status('Reading GameData... '+out.length+' files');await yieldUi();}
      }
    }
  }
  await walk(root,'');
  return out;
}

async function loadSavedState(){
  if(stateLoaded)return;
  stateLoaded=true;
  try{savedHandle=await dbGet(HANDLE_KEY);savedManifest=await dbGet(MANIFEST_KEY);}catch(e){console.warn('[FoxPlanet] saved GameData state',e);}
}

async function permission(handle,request){
  if(!handle)return 'denied';
  try{
    if(typeof handle.queryPermission==='function'){
      const p=await handle.queryPermission({mode:'read'});
      if(p==='granted'||!request)return p;
    }
    if(request&&typeof handle.requestPermission==='function')return await handle.requestPermission({mode:'read'});
  }catch(_){}
  return 'denied';
}

async function remember(handle){
  if(!handle||handle.kind!=='directory')throw new Error('Drop the GameData folder itself.');
  status('Reading GameData folder...');
  const manifest=await buildManifest(handle);
  if(!manifest.length)throw new Error('No files were found in that folder.');
  savedHandle=handle;savedManifest=manifest;
  await dbPut(HANDLE_KEY,handle);await dbPut(MANIFEST_KEY,manifest);
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist();}catch(_){}
  status('Connecting remembered GameData...');
  await attachMount(handle,manifest);
  status('GameData remembered - '+manifest.length+' files. Next visit, open LOAD GAME FILES and click RECONNECT SAVED GAMEDATA.');
  renderBox();
}

async function reconnect(){
  if(reconnecting||!savedHandle)return;reconnecting=true;
  try{
    status('Reconnecting saved GameData...');
    const p=await permission(savedHandle,true);
    if(p!=='granted')throw new Error('Chrome did not grant access to the saved folder.');
    if(!savedManifest||!savedManifest.length){savedManifest=await buildManifest(savedHandle);await dbPut(MANIFEST_KEY,savedManifest);}
    await attachMount(savedHandle,savedManifest);
    status('Saved GameData connected - '+savedManifest.length+' files.');
    renderBox();
  }finally{reconnecting=false;}
}

async function forget(){
  await dbDelete(HANDLE_KEY);await dbDelete(MANIFEST_KEY);
  savedHandle=null;savedManifest=null;stateLoaded=true;
  status('Saved GameData forgotten.');
  renderBox();
}

function installStyle(){
  if(document.getElementById('pfp-saved-gamedata-style'))return;
  const s=document.createElement('style');s.id='pfp-saved-gamedata-style';s.textContent=`
#pfp-saved-gamedata{margin:10px 0 0;padding:10px 12px;border:1px dashed rgba(227,181,54,.58);border-radius:8px;background:rgba(12,26,38,.72);color:#d7dde5;font:12px monospace;text-align:center}
#pfp-saved-gamedata strong{display:block;color:#e2b737;margin-bottom:4px;letter-spacing:.4px}
#pfp-saved-gamedata small{display:block;opacity:.8;line-height:1.35}
#pfp-saved-gamedata .pfp-saved-action{display:inline-block;margin-top:7px;padding:5px 9px;border:1px solid rgba(227,181,54,.55);border-radius:5px;color:#e2b737;cursor:pointer}
#pfp-saved-gamedata .pfp-saved-forget{display:block;margin:6px auto 0;border:0;background:none;color:#9fb5c7;font:11px monospace;text-decoration:underline;cursor:pointer}
#pfp-saved-gamedata.pfp-drag{background:rgba(51,79,92,.92);border-style:solid}
`;(document.head||document.documentElement).appendChild(s);
}

function renderBox(){
  const box=document.getElementById('pfp-saved-gamedata');if(!box)return;
  box.replaceChildren();
  const title=document.createElement('strong'),note=document.createElement('small'),action=document.createElement('span');
  if(window.__PFP_SAVED_GAMEDATA_ACTIVE){
    title.textContent='GAMEDATA REMEMBERED';note.textContent='Connected for this visit and saved for later.';
  }else if(savedHandle){
    title.textContent='SAVED GAMEDATA FOUND';note.textContent='Reconnect it without choosing the folder again.';action.className='pfp-saved-action';action.textContent='RECONNECT SAVED GAMEDATA';action.onclick=()=>reconnect().catch(e=>status('Could not reconnect GameData. '+(e&&e.message?e.message:String(e))));
  }else{
    title.textContent='REMEMBER GAMEDATA';note.textContent='Chrome/Edge: drag your GameData folder onto this box once to remember it between visits.';
  }
  box.append(title,note);if(action.textContent)box.append(action);
  if(savedHandle){const forgetBtn=document.createElement('button');forgetBtn.className='pfp-saved-forget';forgetBtn.type='button';forgetBtn.textContent='Forget saved folder';forgetBtn.onclick=e=>{e.preventDefault();e.stopPropagation();forget().catch(()=>{});};box.append(forgetBtn);}
}

async function setupModal(){
  const card=document.getElementById('pfp-web-data-card');if(!card)return;
  installStyle();
  let box=document.getElementById('pfp-saved-gamedata');
  if(!box){
    box=document.createElement('div');box.id='pfp-saved-gamedata';
    const statusEl=document.getElementById('pfp-web-data-status');card.insertBefore(box,statusEl||null);
    box.addEventListener('dragover',e=>{e.preventDefault();box.classList.add('pfp-drag');});
    box.addEventListener('dragleave',()=>box.classList.remove('pfp-drag'));
    box.addEventListener('drop',e=>{
      e.preventDefault();e.stopPropagation();box.classList.remove('pfp-drag');
      const items=Array.from(e.dataTransfer&&e.dataTransfer.items||[]).filter(x=>x.kind==='file');
      Promise.all(items.map(x=>typeof x.getAsFileSystemHandle==='function'?x.getAsFileSystemHandle():Promise.resolve(null))).then(handles=>{
        const h=handles.find(x=>x&&x.kind==='directory');
        if(!h){status('This browser cannot remember that dropped folder. Chrome or Edge works best.');return;}
        remember(h).catch(err=>status('Could not remember GameData. '+(err&&err.message?err.message:String(err))));
      });
    });
  }
  await loadSavedState();
  renderBox();
}

// Nothing runs at page startup. Only prepare the remembered-folder UI after the user opens LOAD GAME FILES.
document.addEventListener('click',e=>{
  const b=e.target&&e.target.closest&&e.target.closest('#pfp-web-open-data');
  if(!b)return;
  setTimeout(()=>setupModal().catch(err=>console.warn('[FoxPlanet] saved GameData UI',err)),0);
},true);
})();
