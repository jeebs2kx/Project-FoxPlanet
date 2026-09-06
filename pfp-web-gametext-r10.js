(function(){
  'use strict';
  if(window.__PFP_WEB_GAMETEXT_R10)return;
  window.__PFP_WEB_GAMETEXT_R10=true;

  function apply(){
    try{
      var gt=window.__pfpSfaGameText,st=gt&&gt.state,data=st&&st.data;
      if(!data||!data.__r9RealFont||data.__r10GlyphMaskFixed||!Array.isArray(data.glyphs))return false;
      for(var i=0;i<data.glyphs.length;i++)if(data.glyphs[i])data.glyphs[i].mono=true;
      data.__r10GlyphMaskFixed=true;
      if(st.tintCache&&st.tintCache.clear)st.tintCache.clear();
      console.info('[FoxPlanet R10] lazy GameText tint fix applied:',data.glyphs.length);
      return true;
    }catch(_){return false;}
  }

  document.addEventListener('change',function(){
    window.setTimeout(apply,80);
    window.setTimeout(apply,450);
    window.setTimeout(apply,1200);
  },true);
  window.addEventListener('pfp-local-data-mounted',function(){window.setTimeout(apply,500);});
  window.addEventListener('hashchange',function(){window.setTimeout(apply,300);},true);
  window.setInterval(apply,1500);
  apply();
})();
