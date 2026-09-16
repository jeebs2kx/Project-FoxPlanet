(function(){
'use strict';

let tries=0;
const timer=setInterval(function(){
  const C=window.__pfpSfaMapRendererClassV6;
  if(C&&C.prototype){
    C.prototype.addSkyRenderInsts=function(e,t,n,s){
      this._pfpLegacySkyModelFetcher&&this.sky&&this.sky.addSkyRenderInsts(e,t,n,s);
    };
    clearInterval(timer);
  }else if(++tries>240)clearInterval(timer);
},50);
})();
