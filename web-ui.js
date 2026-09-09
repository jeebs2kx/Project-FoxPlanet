(function(){
'use strict';
if(window.__PFP_WEB_POLISH_R20)return;window.__PFP_WEB_POLISH_R20=true;

// same DP map music choices as the desktop one
const DESKTOP_DP_MAP_MUSIC={
  2:{sequenceId:19,actionId:0},3:{sequenceId:34,actionId:0},4:{sequenceId:15,actionId:0},5:{sequenceId:94,actionId:0},
  6:{sequenceId:63,actionId:13},7:{sequenceId:17,actionId:18},8:{sequenceId:17,actionId:236},9:{sequenceId:28,actionId:272},
  10:{sequenceId:58,actionId:151},11:{sequenceId:22,actionId:0},12:{sequenceId:11,actionId:0},13:{sequenceId:68,actionId:128},
  14:{sequenceId:17,actionId:18},15:{sequenceId:80,actionId:0},16:{sequenceId:7,actionId:0},18:{sequenceId:132,actionId:0},
  19:{sequenceId:73,actionId:96},20:{sequenceId:43,actionId:0},21:{sequenceId:55,actionId:237},23:{sequenceId:58,actionId:0},
  24:{sequenceId:36,actionId:0},25:{sequenceId:36,actionId:0},27:{sequenceId:65,actionId:0},28:{sequenceId:67,actionId:0},
  29:{sequenceId:2,actionId:0},30:{sequenceId:80,actionId:0},31:{sequenceId:43,actionId:0},32:{sequenceId:43,actionId:0},
  33:{sequenceId:43,actionId:0},34:{sequenceId:43,actionId:0},35:{sequenceId:102,actionId:0},36:{sequenceId:68,actionId:128},
  39:{sequenceId:43,actionId:0},40:{sequenceId:51,actionId:0},41:{sequenceId:43,actionId:0},42:{sequenceId:43,actionId:0},
  43:{sequenceId:79,actionId:0},44:{sequenceId:109,actionId:0},48:{sequenceId:16,actionId:0},50:{sequenceId:55,actionId:237},
  51:{sequenceId:103,actionId:0},52:{sequenceId:129,actionId:132},53:{sequenceId:108,actionId:0},54:{sequenceId:133,actionId:0}
};
const DP_MAP_STORAGE='projectFoxPlanet.dpNativeMusicMapOverrides.v1';
const DP_MAP_MIGRATION='projectFoxPlanet.webDesktopDpMusicMapR20';

function installDesktopDpMapMappings(){
  try{
    if(localStorage.getItem(DP_MAP_MIGRATION)==='1')return true;
    const exact={};
    for(const [mapNum,pref] of Object.entries(DESKTOP_DP_MAP_MUSIC))
      exact['dp_'+mapNum]={sequenceId:Number(pref.sequenceId),actionId:Number(pref.actionId)||0};
    localStorage.setItem(DP_MAP_STORAGE,JSON.stringify(exact));
    localStorage.setItem(DP_MAP_MIGRATION,'1');
    console.info('[FoxPlanet R20] exact desktop DP map music mappings installed');
    return true;
  }catch(e){console.warn('[FoxPlanet R20] DP music mapping install',e);return false;}
}

function currentScene(){try{return window.main&&window.main.viewer&&window.main.viewer.scene||null;}catch(_){return null;}}
function routeKey(){return String(location.hash||'').split(';',1)[0];}
function routeDpMapNum(){
  const m=routeKey().match(/#\/dp\/dp([0-9a-f]{2})(?:_|$)/i);
  return m?parseInt(m[1],16):null;
}
function stopSceneDpMusic(scene){
  try{
    if(scene&&scene.isDPMapScene&&scene.dpNativeMusic&&typeof scene.dpNativeMusic.stop==='function')scene.dpNativeMusic.stop();
  }catch(e){console.warn('[FoxPlanet R20] DP music transition stop',e);}
}

// the web scheduler used to mess with a few layered tracks, so leave it alone here
function ensureDesktopScheduler(){
  const C=window.__pfpDPNativeMusicClass,p=C&&C.prototype;
  if(!p)return false;
  // just a little flag so I can tell this bit has run
  p.__pfpWebDesktopSchedulerR20=true;
  return true;
}

function syncCurrentDpMusic(){
  const scene=currentScene();
  if(!scene||!scene.isDPMapScene)return false;
  const mapNum=Number(scene.mapNum),routeMap=routeDpMapNum();
  // don't poke the old map while the new one is loading
  if(routeMap!==null&&routeMap!==mapNum)return false;
  const pref=DESKTOP_DP_MAP_MUSIC[mapNum];
  if(!pref)return true;
  const key=mapNum+':'+pref.sequenceId+':'+pref.actionId;
  if(scene.__pfpDesktopDpMusicR20===key)return true;
  scene.__pfpDesktopDpMusicR20=key;
  try{
    const ui=document.getElementById('dp-native-music-ui'),selects=ui?Array.from(ui.querySelectorAll('select')):[];
    const track=selects[0],action=selects[1];
    if(track&&String(track.value)!==String(pref.sequenceId)){
      track.value=String(pref.sequenceId);
      track.dispatchEvent(new Event('change',{bubbles:true}));
    }
    if(action&&Array.from(action.options||[]).some(o=>Number(o.value)===Number(pref.actionId)))
      action.value=String(pref.actionId);
  }catch(e){console.warn('[FoxPlanet R20] DP music UI sync',e);}
  try{
    const player=scene.dpNativeMusic;
    if(player&&typeof player.playSequenceId==='function'){
      const active=player.currentLogicalTrack!=null||(Array.isArray(player.activeSources)&&player.activeSources.length>0);
      const curSeq=typeof player.getCurrentSequenceId==='function'?player.getCurrentSequenceId():null;
      const info=typeof player.getCurrentActionInfo==='function'?player.getCurrentActionInfo():null;
      const curAction=info&&Number.isInteger(Number(info.actionId))?Number(info.actionId):0;
      if(active&&(curSeq!==Number(pref.sequenceId)||curAction!==Number(pref.actionId)))
        Promise.resolve(player.playSequenceId(Number(pref.sequenceId),Number(pref.actionId))).catch(e=>console.warn('[FoxPlanet R20] DP map music correction',e));
    }
  }catch(e){console.warn('[FoxPlanet R20] DP map music correction',e);}
  return true;
}

// stop the old map's music before swapping maps or Chrome can get a bit grumpy
function patchSceneTransitions(){
  const app=window.main;
  if(!app||typeof app._loadSceneDesc!=='function')return false;
  if(app.__pfpDpTransitionR20)return true;
  app.__pfpDpTransitionR20=true;
  const old=app._loadSceneDesc;
  app._loadSceneDesc=function(group,desc,state,force){
    try{
      if(this.currentSceneDesc!==desc||force)stopSceneDpMusic(this.viewer&&this.viewer.scene);
    }catch(_){ }
    return old.apply(this,arguments);
  };
  console.info('[FoxPlanet R20] DP scene-transition audio cleanup installed');
  return true;
}

function isModelRoute(){return /(?:^|[\/;])modelexhibit(?:[;]|$)/i.test(String(location.hash||''));}
function fixModelExport(){
  const st=window.__pfpSfaExportTopState||window.__pfpSfaExportToggle;
  if(!st)return;
  const hide=isModelRoute();
  for(const el of [st.wrap,st.panel])if(el&&el.classList)el.classList.toggle('pfp-r20-model-hide',hide);
}
const style=document.createElement('style');
style.id='pfp-web-polish-r20-style';
style.textContent='.pfp-r20-model-hide{display:none!important}';
(document.head||document.documentElement).appendChild(style);

let lastRoute=routeKey();
function onRouteChange(){
  const next=routeKey();
  if(next!==lastRoute)stopSceneDpMusic(currentScene());
  lastRoute=next;
  setTimeout(tick,0);
}
function tick(){fixModelExport();ensureDesktopScheduler();patchSceneTransitions();syncCurrentDpMusic();}

installDesktopDpMapMappings();
window.addEventListener('hashchange',onRouteChange,true);
window.addEventListener('pfp-runtime-r14-ready',()=>setTimeout(tick,0));
const obs=new MutationObserver(()=>{fixModelExport();syncCurrentDpMusic();});
obs.observe(document.documentElement,{childList:true,subtree:true});
tick();
let tries=0;
const timer=setInterval(()=>{
  tick();
  if((ensureDesktopScheduler()&&patchSceneTransitions())||++tries>160)clearInterval(timer);
},100);
})();
