(function(){
  'use strict';
  if(window.__PFP_WEB_PREFLIGHT_R10)return;
  window.__PFP_WEB_PREFLIGHT_R10=true;

  var nativeFetch=window.fetch.bind(window);

  function cleanPath(p){return String(p||'').replace(/\\/g,'/').replace(/^\/+/, '').replace(/\/+/g,'/');}
  function isStaticWeb(){return location.protocol==='https:'||(location.protocol==='http:'&&!/^(localhost|127\.0\.0\.1)$/i.test(location.hostname));}

  function sequencePath(input){
    try{
      var u=input instanceof Request?new URL(input.url,location.href):new URL(String(input),location.href);
      var m=u.pathname.match(/\/(sequence-data\/.*)$/i);
      return m?cleanPath(m[1]):'';
    }catch(_){return '';}
  }

  async function sliceBuffer(d){
    if(!d)return null;
    try{
      if(typeof d.copyToBuffer==='function')return d.copyToBuffer(0,d.byteLength);
      if(d.arrayBuffer instanceof ArrayBuffer){
        var start=Number(d.byteOffset||0),len=Number(d.byteLength||d.arrayBuffer.byteLength);
        return d.arrayBuffer.slice(start,start+len);
      }
      if(typeof d.arrayBuffer==='function')return await d.arrayBuffer();
    }catch(_){}
    return null;
  }

  async function mountedSequenceResponse(path){
    var f=window.main&&window.main.dataFetcher;
    if(!f||!Array.isArray(f.mounts))return null;
    var key=cleanPath(path).toLowerCase();
    for(var i=0;i<f.mounts.length;i++){
      var m=f.mounts[i];
      if(!m||!(m.entries instanceof Map))continue;
      var entry=m.entries.get(key);
      if(!entry)continue;
      try{
        var d=null;
        if(typeof entry.read==='function')d=await entry.read(path,{});
        else if(entry.blob instanceof Blob)d={arrayBuffer:await entry.blob.arrayBuffer(),byteOffset:0,byteLength:entry.blob.size};
        var b=await sliceBuffer(d);
        if(b&&b.byteLength)return new Response(b,{status:200,headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store'}});
      }catch(e){console.warn('[FoxPlanet R10] mounted sequence-data read failed',path,e);}
    }
    return null;
  }

  window.fetch=async function(input,init){
    var path=sequencePath(input);
    var method=String((init&&init.method)||(input instanceof Request?input.method:'GET')||'GET').toUpperCase();
    if(path&&method==='GET'){
      var mounted=await mountedSequenceResponse(path);
      if(mounted)return mounted;
      // sequence-data is intentionally not published to GitHub Pages. Returning a
      // quick 404 here avoids a burst of slow network misses every time a map opens.
      if(isStaticWeb())return new Response('',{status:404,statusText:'Not Found'});
    }
    return nativeFetch(input,init);
  };
})();
