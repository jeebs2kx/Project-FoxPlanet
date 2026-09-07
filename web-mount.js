(function(){
'use strict';
if(window.__PFP_WEB_MOUNT_R14)return;window.__PFP_WEB_MOUNT_R14=true;
let sessionMount=null,rendererPatched=false,lastObservedMount=null;
const clean=p=>String(p||'').replace(/\\/g,'/').replace(/^\/+/, '').replace(/\/+/g,'/');
function fetcher(){return window.main&&window.main.dataFetcher;}
function localMount(){const f=fetcher();if(!f||!Array.isArray(f.mounts))return null;return f.mounts.find(m=>m&&m.entries instanceof Map&&/Local GameData| ISO|Dinosaur Planet/i.test(String(m.label||'')))||f.mounts.find(m=>m&&m.entries instanceof Map)||null;}
function alias(m){
  if(!m||!(m.entries instanceof Map)||m.__pfpAliasesReady)return;
  for(const [k0,e] of [...m.entries.entries()]){
    const k=clean(k0).toLowerCase();let x=k.match(/^(starfoxadventuresdemo|starfoxadventures)\/files\/(.+)$/i);
    if(x&&!m.entries.has((x[1]+'/'+x[2]).toLowerCase()))m.entries.set((x[1]+'/'+x[2]).toLowerCase(),e);
    x=k.match(/(?:^|\/)gamedata\/(starfoxadventuresdemo|starfoxadventures|dinosaurplanet|dinosaurplanet_vanilla|sequence-data)\/(.+)$/i);
    if(x&&!m.entries.has((x[1]+'/'+x[2]).toLowerCase()))m.entries.set((x[1]+'/'+x[2]).toLowerCase(),e);
  }
  m.__pfpAliasesReady=true;
}
function remember(){const f=fetcher(),m=localMount();if(!f||!m)return false;alias(m);sessionMount=m;lastObservedMount=m;window.__PFP_SESSION_MOUNT=m;window.__PFP_LOCAL_MOUNT_ACTIVE=true;try{f.completedCache&&f.completedCache.clear();}catch(_){}try{window.dispatchEvent(new CustomEvent('pfp-r14-data-ready'));}catch(_){}return true;}
function reattach(){const f=fetcher(),m=sessionMount||window.__PFP_SESSION_MOUNT;if(!f||!m||!Array.isArray(f.mounts))return false;if(!f.mounts.includes(m)){f.mounts.unshift(m);try{f.completedCache&&f.completedCache.clear();}catch(_){}}window.__PFP_LOCAL_MOUNT_ACTIVE=true;return true;}
function wrapLocal(){const api=window.__PFP_WEB_LOCAL_DATA;if(!api||api.__r14Wrapped)return !!api;api.__r14Wrapped=true;for(const n of ['mountFolderFiles','mountSfaIso','mountKioskIso','mountDpRom']){if(typeof api[n]!=='function')continue;const old=api[n];api[n]=async function(){const r=await old.apply(api,arguments);remember();return r;};}return true;}
function patchRenderer(){const C=window.__pfpSfaWorldRendererClassV6;if(!C||!C.prototype||rendererPatched)return rendererPatched;const old=C.prototype.update;if(typeof old!=='function')return false;rendererPatched=true;C.prototype.update=function(input){const f=fetcher();if(f&&window.__PFP_LOCAL_MOUNT_ACTIVE&&this.world&&this.world.context)this.world.context.dataFetcher=f;const out=old.call(this,input);try{const rt=this.__pfpMapSequenceRuntime;if(rt&&f&&rt.fetcher!==f)rt.fetcher=f;}catch(_){}return out;};return true;}
function install(){wrapLocal();reattach();patchRenderer();}
function route(){reattach();setTimeout(reattach,25);setTimeout(install,120);}
function watch(){const m=localMount();if(m&&m!==lastObservedMount)remember();else if(sessionMount)reattach();patchRenderer();}
install();window.addEventListener('load',()=>{install();setTimeout(install,250);});window.addEventListener('hashchange',route,true);window.addEventListener('popstate',route,true);window.addEventListener('pfp-local-data-mounted',()=>{remember();setTimeout(install,30);});setInterval(watch,1000);
let tries=0;(function boot(){const a=wrapLocal(),b=patchRenderer();if((a&&b)||++tries>160)return;setTimeout(boot,50);})();
})();
