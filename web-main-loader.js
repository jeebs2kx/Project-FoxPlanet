(function(){
'use strict';

const MAIN='main-6b7e7ae7257abae7800d-095-dpeye2.js';
const AFTER=[
  'web-gametext.js',
  'sfa-map-sequences.js',
  'audio-hub.js',
  'web-local-data.js',
  'web-saved-gamedata.js?v=5',
  'web-mount.js',
  'web-layout.js?v=3',
  'web-ui.js?v=2',
  'web-dp-audio.js',
  'section-headings.js'
];

// Bit of a bodge, but it keeps the online one matching the desktop build without another giant JS file.
const NEW_OLD_MAP_SKY="        async function nn(e, t, n, s, i, a, z = 577) {\n          var o, l, c, h;\n          const mapDirs = {\n              2: \"dragrock\",\n              4: \"volcano\",\n              7: \"swaphol\",\n              8: \"swaphol\",\n              10: \"nwastes\",\n              11: \"warlock\",\n              12: \"crfort\",\n              13: \"wallcity\",\n              14: \"lightfoot\",\n              15: \"crfort\",\n              16: \"crfort\",\n              18: \"mmpass\",\n              19: \"darkicemines\",\n              23: \"icemountain\",\n              27: \"darkicemines\",\n              29: \"capeclaw\",\n              43: \"crfort\",\n              50: \"dfptop\",\n              52: \"dragrock\",\n            },\n            groups = {\n              capeclaw: [575, 576, 577],\n              nwastes: [180, 181, 182, 183],\n              icemountain: [180, 181, 182, 183],\n              swaphol: [434, 435, 436],\n              mmpass: [314, 312, 313],\n              lightfoot: [79, 80, 581],\n              darkicemines: [352, 346, 348, 351],\n              crfort: [86, 13, 17, 14],\n              warlock: [60],\n              wallcity: [507, 511, 508, 509],\n              dfptop: [86, 13, 17, 14],\n              dragrock: [507, 511, 508, 509],\n              volcano: [507, 511, 508, 509],\n            },\n            numMatch = String(e.mapNum).match(/(\\d+)$/),\n            mapNo = numMatch ? Number(numMatch[1]) : -1,\n            skyDir = mapDirs[mapNo] || (groups[a] ? a : \"\");\n          if (!skyDir || !groups[skyDir]) return;\n          const cache =\n              null !== (o = t.cache) && void 0 !== o\n                ? o\n                : null === (c = (l = t).getCache) || void 0 === c\n                  ? void 0\n                  : c.call(l),\n            skyTex = await S.JU.create(n, s, !1);\n          skyTex.setModelVersion(g.o.Final);\n          i && i.textureHolder && (skyTex.textureHolder = i.textureHolder);\n          try {\n            await skyTex.loadSubdirs([skyDir], s);\n          } catch (_) {\n            return;\n          }\n          try {\n            await skyTex.loadSubdirs([\"\"], s);\n          } catch (_) {}\n          \"function\" == typeof skyTex.setPreferredSubdir &&\n            skyTex.setPreferredSubdir(skyDir);\n          const modelFetcher = await w.Ju.create(\n            n,\n            Promise.resolve(skyTex),\n            t,\n            e.animController,\n            g.o.Final,\n          );\n          await modelFetcher.loadSubdirs([skyDir, \"\"], s);\n          const world = {\n            context: e.context,\n            renderCache: cache,\n            gameInfo: n,\n            subdirs: [skyDir],\n            worldLights: e.worldLights,\n            resColl: {\n              texFetcher: skyTex,\n              modelFetcher,\n              animColl: null,\n              amapColl: null,\n              modanimColl: null,\n            },\n            animController: e.animController,\n            objectMan: null,\n            envfxMan: null,\n            mapInstance: null,\n          };\n          try {\n            world.objectMan = await r.rl.create(world, s, !1, !0);\n            world.envfxMan = await C.R.create(world, s);\n            e.envfxMan = world.envfxMan;\n            e._pfpLegacySkyModelFetcher = modelFetcher;\n            e._pfpLegacySkyTexFetcher = skyTex;\n            e.envfxMan.setTimeOfDay(\n              null !== (h = Qt[skyDir]) && void 0 !== h ? h : 4,\n            );\n            for (const idx of groups[skyDir]) e.envfxMan.loadEnvfx(idx);\n          } catch (_) {}\n        }\n";
const NEW_SKYSCAPE="            } else if (i.type === s.Skyscape) {\n              for (const e of this.skyscape.objects)\n                try {\n                  e.destroy(this.world.context.device);\n                } catch (e) {}\n              this.skyscape.objects = [];\n              this.cloudActionObjects = [];\n              const e = [0, 1576, 1890, 2147],\n                t = [0, 1578, 2140, 2145, 2147],\n                s = [0, 1575, 1577, 1886, 1525],\n                i = n.getUint8(93),\n                r = n.getUint8(91),\n                o = n.getUint8(90),\n                l = (e) => {\n                  if (!e) return;\n                  try {\n                    const t = this.world.objectMan.createObjectInstance(\n                      e,\n                      new DataView(new ArrayBuffer(128)),\n                      a.vt(),\n                    );\n                    t &&\n                      ((t.cullRadius = 999999),\n                      this.skyscape.objects.push(t));\n                  } catch (e) {}\n                };\n              (l(s[i] || 0), l(e[r] || 0), l(t[o] || 0));\n            }\n";

function swapSection(text,start,end,replacement,name){
  const a=text.indexOf(start);
  if(a<0)throw new Error('could not find '+name+' start');
  const b=text.indexOf(end,a+start.length);
  if(b<0)throw new Error('could not find '+name+' end');
  return text.slice(0,a)+replacement+text.slice(b);
}

function patchMain(text){
  const oldSkyType='            (e[(e.Skyscape = 4)] = "Skyscape"));';
  if(!text.includes(oldSkyType))throw new Error('could not find skyscape type');
  text=text.replace(oldSkyType,'            (e[(e.Skyscape = 6)] = "Skyscape"));');

  const oldMapStart='        async function nn(e, t, n, s, i, a, r = 577) {';
  const oldMapEnd='        function pfpParseVoxDataView(e) {';
  text=swapSection(text,oldMapStart,oldMapEnd,NEW_OLD_MAP_SKY, 'old map sky stuff');

  const forceStart='          forceKioskTextureOnlySky() {';
  const forceEnd='          loadEnvfx(e) {';
  const fa=text.indexOf(forceStart);
  const fb=fa<0?-1:text.indexOf(forceEnd,fa);
  if(fa<0||fb<0)throw new Error('could not find kiosk sky bit');
  let force=text.slice(fa,fb);
  const clear='            this.skyscape.objects = [];\n';
  if(!force.includes(clear))throw new Error('kiosk sky clear line has moved');
  force=force.replace(clear,'');
  text=text.slice(0,fa)+force+text.slice(fb);

  const skyStart='            } else if (i.type === s.Skyscape) {';
  const skyEnd='            return (\n              "StarFoxAdventuresDemo" === this.world.gameInfo.pathBase &&';
  text=swapSection(text,skyStart,skyEnd,NEW_SKYSCAPE,'skyscape');

  const oldX='              tn(x) && (await nn(p, h, this.gameInfo, t.dataFetcher, m, x)),';
  const newX='              await nn(p, h, this.gameInfo, t.dataFetcher, m, x),';
  if(text.split(oldX).length-1!==3)throw new Error('old map sky calls have moved');
  text=text.split(oldX).join(newX);

  const oldH='            (tn(h) && (await nn(r, i, this.gameInfo, t.dataFetcher, l, h)),';
  const newH='            (await nn(r, i, this.gameInfo, t.dataFetcher, l, h),';
  if(!text.includes(oldH))throw new Error('early2 sky call has moved');
  text=text.replace(oldH,newH);

  const oldM='            (tn(m) && (await nn(h, l, this.gameInfo, t.dataFetcher, d, m)),';
  const newM='            (await nn(h, l, this.gameInfo, t.dataFetcher, d, m),';
  if(!text.includes(oldM))throw new Error('early4 sky call has moved');
  text=text.replace(oldM,newM);
  return text;
}

function loadScript(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src;
    s.onload=resolve;
    s.onerror=()=>reject(new Error('could not load '+src));
    document.head.appendChild(s);
  });
}

async function boot(){
  const r=await fetch(MAIN+'?envfx=20260909b',{cache:'no-store'});
  if(!r.ok)throw new Error('could not load the main FoxPlanet file ('+r.status+')');
  const original=await r.text();
  const patched=patchMain(original);
  (0,eval)(patched+'\n//# sourceURL='+MAIN);
  for(const src of AFTER)await loadScript(src);
}

boot().catch((e)=>{
  console.error('[FoxPlanet] web startup failed',e);
  const box=document.createElement('pre');
  box.textContent='FoxPlanet could not start. Try a hard refresh.\n\n'+String(e&&e.message||e);
  box.style.cssText='position:fixed;inset:20px;z-index:99999;background:#111;color:#eee;padding:16px;white-space:pre-wrap';
  document.body.appendChild(box);
});
})();
