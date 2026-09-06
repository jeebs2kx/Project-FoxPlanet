(function(){
'use strict';
if(window.__PFP_WEB_SEQPACK_R11)return;
window.__PFP_WEB_SEQPACK_R11=true;
const nativeFetch=window.fetch.bind(window),ROOT=location.pathname.includes('/Project-FoxPlanet/')?'/Project-FoxPlanet/':'/';
let packPromise=null;
const norm=s=>String(s||'').replace(/\\/g,'/').replace(/^\/+/, '').toLowerCase();
function b64bytes(s){const bin=atob(s.replace(/\s+/g,'')),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;}
async function gunzip(u){if(typeof DecompressionStream!=='function')throw new Error('Chrome/Edge gzip support is required.');return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());}
async function gzip(u){if(typeof CompressionStream!=='function')return null;return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());}
function toB64(u){let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode(...u.subarray(i,Math.min(u.length,i+0x8000)));return btoa(s);}
async function loadPack(){if(packPromise)return packPromise;packPromise=(async()=>{let text='';for(let i=0;i<13;i++){const p=ROOT+'pfp-seqdata-r11/pack/part'+String(i).padStart(2,'0')+'.b64';const r=await nativeFetch(p,{cache:'force-cache'});if(!r.ok)throw new Error('Missing sequence pack part '+i);text+=await r.text();}const raw=await gunzip(b64bytes(text)),dv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength),ml=dv.getUint32(0,false),meta=JSON.parse(new TextDecoder().decode(raw.subarray(4,4+ml))),base=4+ml,map=new Map();for(const row of meta){map.set(norm(row[0]),raw.slice(base+row[1],base+row[1]+row[2]));}console.info('[FoxPlanet R11] desktop sequence pack ready:',map.size,'files');return map;})();return packPromise;}
window.fetch=async function(input,init){let u;try{u=input instanceof Request?new URL(input.url,location.href):new URL(String(input),location.href);}catch(_){return nativeFetch(input,init);}const m=u.pathname.match(/\/Project-FoxPlanet\/pfp-seqdata-r11\/(.+)\.gz\.b64$/i);if(m){try{const map=await loadPack(),raw=map.get(norm(decodeURIComponent(m[1])));if(!raw)return new Response('',{status:404});const gz=await gzip(raw);if(!gz)return new Response('',{status:500});return new Response(toB64(gz),{status:200,headers:{'Content-Type':'text/plain','Cache-Control':'public, max-age=31536000'}});}catch(e){console.warn('[FoxPlanet R11] sequence pack',e);return new Response('',{status:404});}}return nativeFetch(input,init);};
})();
