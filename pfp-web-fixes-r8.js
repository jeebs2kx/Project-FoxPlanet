(function(){
  'use strict';
  if(window.__PFP_WEB_FIXES_R8)return;
  window.__PFP_WEB_FIXES_R8=true;

  function patch(){
    var C=window.__pfpSfaWorldRendererClassV6;
    if(!C||!C.prototype||C.prototype.__pfpR8SequenceFetcherBridge)return false;
    C.prototype.__pfpR8SequenceFetcherBridge=true;
    var old=C.prototype.update;
    if(typeof old!=='function')return false;
    C.prototype.update=function(viewerInput){
      try{
        var mainFetcher=window.main&&window.main.dataFetcher;
        if(mainFetcher&&window.__PFP_LOCAL_MOUNT_ACTIVE&&this.world&&this.world.context){
          this.world.context.dataFetcher=mainFetcher;
          var rt=this.__pfpMapSequenceRuntime;
          if(rt&&rt.fetcher!==mainFetcher)rt.fetcher=mainFetcher;
          if(rt&&rt.dirTables&&rt.dirTables.size===0&&!rt.__pfpR8Retrying&&typeof rt.init==='function'){
            rt.__pfpR8Retrying=true;
            Promise.resolve(rt.init()).catch(function(e){console.warn('[FoxPlanet R8] sequence retry',e);}).finally(function(){rt.__pfpR8Retrying=false;});
          }
        }
      }catch(e){console.warn('[FoxPlanet R8] sequence fetcher bridge',e);}
      return old.call(this,viewerInput);
    };
    return true;
  }

  patch();
  var n=0,t=setInterval(function(){if(patch()||++n>200)clearInterval(t);},50);
})();