(function(){
  'use strict';
  if(window.__PFP_WEB_PREFLIGHT_R9)return;
  window.__PFP_WEB_PREFLIGHT_R9=true;

  // R7 copied the whole GameData tree into IndexedDB. Drop that cache, plus the
  // older remembered-directory handle, so the web build goes back to session-only data.
  try{indexedDB.deleteDatabase('project-foxplanet-gamedata-cache-r7');}catch(_){}
  try{indexedDB.deleteDatabase('project-foxplanet-local-files');}catch(_){}

  var nativeSetInterval=window.setInterval.bind(window);
  var nativeAddEventListener=window.addEventListener.bind(window);
  var NativeMO=window.MutationObserver;

  function isFoxPlanetMaintenance(fn){
    if(typeof fn!=='function')return false;
    var s='';try{s=Function.prototype.toString.call(fn);}catch(_){}
    return (s.indexOf('compactGamePicker')>=0&&s.indexOf('rawGameTextTick')>=0) ||
           (s.indexOf('compactLanding')>=0&&s.indexOf('keepMountAlive')>=0);
  }

  window.setInterval=function(fn,delay){
    var args=Array.prototype.slice.call(arguments,2),src='';
    try{src=typeof fn==='function'?Function.prototype.toString.call(fn):'';}catch(_){}
    if(src.indexOf('rawGameTextTick')>=0&&src.indexOf('compactGamePicker')>=0&&Number(delay)<5000)delay=5000;
    else if(src.indexOf('keepMountAlive')>=0&&src.indexOf('compactLanding')>=0&&Number(delay)<900)delay=1000;
    return nativeSetInterval.apply(window,[fn,delay].concat(args));
  };

  // Do not parse every raw GameText file merely because the GameData folder was
  // mounted. The R9 GameText wrapper requests that work only when subtitles are used.
  window.addEventListener=function(type,listener,options){
    var src='';try{src=typeof listener==='function'?Function.prototype.toString.call(listener):'';}catch(_){}
    if(type==='pfp-local-data-mounted'&&src.indexOf('rawGameTextTick')>=0){
      var original=listener;
      listener=function(ev){
        try{
          var gt=window.__pfpSfaGameText;
          if(!(gt&&gt.state&&gt.state.visible))return;
        }catch(_){return;}
        return original.call(this,ev);
      };
    }
    return nativeAddEventListener(type,listener,options);
  };

  if(typeof NativeMO==='function'){
    function PfpMutationObserver(callback){
      if(!isFoxPlanetMaintenance(callback))return new NativeMO(callback);
      var pending=false,lastRecords=null,lastObserver=null;
      return new NativeMO(function(records,observer){
        lastRecords=records;lastObserver=observer;
        if(pending)return;
        pending=true;
        window.setTimeout(function(){
          pending=false;
          var r=lastRecords,o=lastObserver;lastRecords=null;lastObserver=null;
          try{callback(r,o);}catch(e){window.setTimeout(function(){throw e;},0);}
        },250);
      });
    }
    PfpMutationObserver.prototype=NativeMO.prototype;
    try{Object.setPrototypeOf(PfpMutationObserver,NativeMO);}catch(_){}
    window.MutationObserver=PfpMutationObserver;
  }

  function restoreGlobals(){
    window.setInterval=nativeSetInterval;
    window.addEventListener=nativeAddEventListener;
    if(typeof NativeMO==='function')window.MutationObserver=NativeMO;
  }
  window.addEventListener('DOMContentLoaded',restoreGlobals,{once:true});
})();
