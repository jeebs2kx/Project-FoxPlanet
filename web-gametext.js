(function(){
'use strict';
if(window.__PFP_WEB_GAMETEXT)return;
window.__PFP_WEB_GAMETEXT=true;

const ROOT=location.pathname.includes('/Project-FoxPlanet/')?'/Project-FoxPlanet/':'/';

async function text(path){
  const r=await fetch(ROOT+path,{cache:'no-store'});
  if(!r.ok)throw new Error('Missing '+path);
  return r.text();
}

function run(name,src){
  (0,eval)(src+'\n//# sourceURL='+ROOT+name);
}

window.__PFP_GAMETEXT_READY=(async()=>{
  try{
    let gt=await text('sfa-gametext.js');
    const blocked='if(!state.pathBase||STATIC_WEB)return [];';
    if(gt.includes(blocked))gt=gt.replace(blocked,'if(!state.pathBase)return [];');
    run('sfa-gametext-web.js',gt);

    let raw=await text('web-gametext-bridge.js');
    raw=raw.replace('function installLayoutFix(){','function installLayoutFix(){return;');
    raw=raw.replace('function compactGamePicker(){','function compactGamePicker(){return;');
    raw=raw.replace('function patchDataModal(){','function patchDataModal(){return;');
    raw=raw.replace('async function restoreSavedFolder(){','async function restoreSavedFolder(){return;');
    raw=raw.replace(
      "else if(r===0xBF&&o+7<bytes.length){var col=[];for(var ci=0;ci<8;ci++)col.push(bytes[o++]);cmd('color',col);}",
      "else if(r===0xBF&&o+7<bytes.length){var col=[];for(var ci=0;ci<4;ci++){col.push(readU16(bytes,o));o+=2;}cmd('color',col);}"
    );
    raw=raw.replace(
      "setInterval(function(){compactGamePicker();patchDataModal();wrapLocalApi();wrapGameTextApi();rawGameTextTick();},120);",
      "setInterval(function(){wrapLocalApi();wrapGameTextApi();rawGameTextTick();},500);"
    );
    run('web-gametext-bridge-runtime.js',raw);

    window.__PFP_GAMETEXT_WEB=true;
    window.dispatchEvent(new CustomEvent('pfp-runtime-r14-ready'));
    window.dispatchEvent(new CustomEvent('pfp-gametext-ready'));
    console.info('[FoxPlanet] GameText subtitles and voice binding ready');
    return true;
  }catch(e){
    console.error('[FoxPlanet] GameText runtime load failed',e);
    throw e;
  }
})();
})();
