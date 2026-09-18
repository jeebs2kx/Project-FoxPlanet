(function(){
'use strict';

const LEGACY_SHAPE=`                    if (fpLegacyActivatedSpellstone) {
                      const fpLegacyVcd = (0, d.y5)(h.cg.MAX + 1, () => ({
                          type: h.WP.NONE,
                        })),
                        fpLegacyVat = (0, d.y5)(8, () =>
                          (0, d.y5)(h.cg.MAX + 1, () => ({
                            compType: h.aL.U8,
                            compShift: 0,
                            compCnt: 0,
                          })),
                        ),
                        fpLegacyAttrs = [];
                      ((fpLegacyVcd[h.cg.POS].type = h.WP.INDEX16),
                        (fpLegacyVcd[h.cg.CLR0].type = h.WP.INDEX16),
                        (fpLegacyVcd[h.cg.TEX0].type = h.WP.INDEX16),
                        (fpLegacyVat[0][h.cg.POS] = {
                          compType: h.aL.S16,
                          compShift: 0,
                          compCnt: h.xA.POS_XYZ,
                        }),
                        (fpLegacyVat[0][h.cg.CLR0] = {
                          compType: h.aL.RGBA8,
                          compShift: 0,
                          compCnt: h.xA.CLR_RGBA,
                        }),
                        (fpLegacyVat[0][h.cg.TEX0] = {
                          compType: h.aL.S16,
                          compShift: 10,
                          compCnt: h.xA.TEX_ST,
                        }),
                        (fpLegacyAttrs[h.cg.POS] = {
                          buffer: l.A.fromView(qe),
                          offs: 0,
                          stride: 6,
                        }),
                        (fpLegacyAttrs[h.cg.CLR0] = {
                          buffer: l.A.fromView(Qe),
                          offs: 0,
                          stride: 4,
                        }),
                        (fpLegacyAttrs[h.cg.TEX0] = {
                          buffer: l.A.fromView(Je),
                          offs: 0,
                          stride: 4,
                        }));
                      const fpLegacyShapes = new B.Cu(b, qe, void 0);
                      ((fpLegacyShapes.shapes[0] = []),
                        (fpLegacyShapes.shapes[1] = []),
                        (fpLegacyShapes.shapes[2] = []));
                      for (const fpFace of he) {
                        if (0 === fpFace.tris.length || S.has(fpFace.texId))
                          continue;
                        let fpFlags = 0;
                        128 & fpFace.renderFlags &&
                          (fpFlags |= p.JL.AlphaCompare);
                        const fpShader = {
                            layers: [
                              {
                                texId: fpFace.texId,
                                tevMode: 1,
                                enableScroll: 0,
                              },
                            ],
                            attrFlags: p.Y2.CLR | p.Y2.TEX0,
                            flags: fpFlags,
                            hasHemisphericProbe: !1,
                            hasReflectiveProbe: !1,
                            reflectiveProbeMaskTexId: null,
                            reflectiveProbeIdx: 0,
                            reflectiveAmbFactor: 0,
                            hasNBTTexture: !1,
                            nbtTexId: null,
                            nbtParams: 0,
                            furRegionsTexId: null,
                            color: { r: 1, g: 1, b: 1, a: 1 },
                            normalFlags:
                              p.H5.HasVertexColor | p.H5.HasVertexAlpha,
                            lightFlags: p.U_.OverrideLighting,
                            texMtxCount: 0,
                          },
                          fpMaterial = n.buildObjectMaterial(fpShader, t, !1),
                          fpIndexCount = 3 * fpFace.tris.length,
                          fpDl = new Uint8Array(3 + 6 * fpIndexCount);
                        let fpDlPos = 0;
                        ((fpDl[fpDlPos++] = 144),
                          (fpDl[fpDlPos++] = (fpIndexCount >>> 8) & 255),
                          (fpDl[fpDlPos++] = fpIndexCount & 255));
                        for (const fpTri of fpFace.tris)
                          for (const fpIndex of [
                            fpTri.i0,
                            fpTri.i1,
                            fpTri.i2,
                          ])
                            ((fpDl[fpDlPos++] = (fpIndex >>> 8) & 255),
                              (fpDl[fpDlPos++] = fpIndex & 255),
                              (fpDl[fpDlPos++] = (fpIndex >>> 8) & 255),
                              (fpDl[fpDlPos++] = fpIndex & 255),
                              (fpDl[fpDlPos++] = (fpIndex >>> 8) & 255),
                              (fpDl[fpDlPos++] = fpIndex & 255));
                        const fpLoader = new K(
                            fpLegacyAttrs,
                            fpLegacyVcd,
                            fpLegacyVat,
                            new DataView(fpDl.buffer),
                            !1,
                          ),
                          fpPn = (0, d.y5)(10, () => 0);
                        (fpLoader.setPnMatrixMap(fpPn, !1, !1),
                          fpLegacyShapes.shapes[0].push(
                            new Z(fpLoader, new j(fpMaterial), !1),
                          ));
                      }
                      if (N > 0) {
                        const fpBaseAdd = fpLegacyShapes.addRenderInsts.bind(
                          fpLegacyShapes,
                        );
                        fpLegacyShapes.addRenderInsts = (
                          fpA,
                          fpB,
                          fpC,
                          fpD,
                          fpModelMtx,
                          fpJoints,
                          fpG,
                          fpH,
                        ) => {
                          if (fpJoints && fpJoints.length > 0) {
                            for (let fpV = 0; fpV < je; fpV++) {
                              const fpX = et[3 * fpV + 0],
                                fpY = et[3 * fpV + 1],
                                fpZ = et[3 * fpV + 2],
                                fpJoint = fpJoints[me[fpV] || 0];
                              if (fpJoint) {
                                const fpTX =
                                    fpJoint[0] * fpX +
                                    fpJoint[4] * fpY +
                                    fpJoint[8] * fpZ +
                                    fpJoint[12],
                                  fpTY =
                                    fpJoint[1] * fpX +
                                    fpJoint[5] * fpY +
                                    fpJoint[9] * fpZ +
                                    fpJoint[13],
                                  fpTZ =
                                    fpJoint[2] * fpX +
                                    fpJoint[6] * fpY +
                                    fpJoint[10] * fpZ +
                                    fpJoint[14];
                                (qe.setInt16(6 * fpV + 0, fpTX, !1),
                                  qe.setInt16(6 * fpV + 2, fpTY, !1),
                                  qe.setInt16(6 * fpV + 4, fpTZ, !1));
                              }
                            }
                            fpLegacyShapes.reloadVertices();
                          }
                          fpBaseAdd(
                            fpA,
                            fpB,
                            fpC,
                            fpD,
                            fpModelMtx,
                            fpJoints,
                            fpG,
                            fpH,
                          );
                        };
                      }
                      return fpLegacyShapes;
                    }

`;

function patchSection(text,start,end,fn){
  const a=text.indexOf(start);
  if(a<0)return text;
  const b=text.indexOf(end,a+start.length);
  if(b<0)return text;
  return text.slice(0,a)+fn(text.slice(a,b))+text.slice(b);
}

function patchSkies(text){
  if(!text.includes('await nn(o, i, this.gameInfo, t.dataFetcher, l, "swaphol")')){
    text=text.replace(
      '            o.mapNum = -999;\n            const l = await S.JU.create(this.gameInfo, t.dataFetcher, !0);',
      '            (window.__pfpSfaFenceEdgeFixActive = !0), (o.mapNum = -999);\n            const l = await S.JU.create(this.gameInfo, t.dataFetcher, !0);'
    );
    text=text.replace(
      '            return (await o.create(r, this.gameInfo, t.dataFetcher, c), o);',
      '            return (\n              await nn(o, i, this.gameInfo, t.dataFetcher, l, "swaphol"),\n              await o.create(r, this.gameInfo, t.dataFetcher, c),\n              o\n            );'
    );
  }

  text=patchSection(text,'        class xn {','        class bn {',section=>{
    if(section.includes('await nn(r, s, v.Ij, t.dataFetcher, o, "swaphol")'))return section;
    section=section.replace(
      '            r.mapNum = this.id;\n            const o = await S.JU.create(v.Dx, t.dataFetcher, !1);',
      '            (window.__pfpSfaFenceEdgeFixActive = !0), (r.mapNum = this.id);\n            const o = await S.JU.create(v.Dx, t.dataFetcher, !1);'
    );
    section=section.replace(
      '            await r.create(a, this.gameInfo, t.dataFetcher, c);',
      '            await nn(r, s, v.Ij, t.dataFetcher, o, "swaphol");\n            await r.create(a, this.gameInfo, t.dataFetcher, c);'
    );
    return section;
  });

  return text;
}

function patchSpellstone(text){
  if(!text.includes('const fpLegacyActivatedSpellstone =')){
    const marker='                ((b.joints = []),';
    const detector='                const fpLegacyActivatedSpellstone =\n                  V === 2 &&\n                  oe.length >= 2 &&\n                  (oe[0].texId === 0x0CE1 || oe[0].texId === 0x0CE2) &&\n                  oe[1].texId === 0x04B5 &&\n                  oe[1].texW === 16 &&\n                  oe[1].texH === 32;\n';
    if(text.includes(marker))text=text.replace(marker,detector+marker);
  }

  if(text.includes('const fpLegacyActivatedSpellstone =')&&!text.includes('const fpLegacyLit = re(')){
    const marker='                          ((ln = (de.length / 3) | 0),';
    const baked='                          if (fpLegacyActivatedSpellstone && Ee) {\n                            const fpLegacyLit = re(\n                              Cn ? ye.tintR : 255,\n                              Cn ? ye.tintG : 255,\n                              Cn ? ye.tintB : 255,\n                              fn,\n                              gn,\n                              xn,\n                            );\n                            ((vn = fpLegacyLit.r),\n                              (yn = fpLegacyLit.g),\n                              (Tn = fpLegacyLit.b));\n                          }\n';
    if(text.includes(marker))text=text.replace(marker,baked+marker);
  }

  if(text.includes('const fpLegacyActivatedSpellstone =')){
    text=text.replace(
      '                          Math.round(Qn * (32 / Zn.texW)),',
      '                          fpLegacyActivatedSpellstone\n                            ? Math.round(Qn * (32 / Zn.texW))\n                            : Qn,'
    );
    text=text.replace(
      '                            Math.round(Jn * (32 / Zn.texH)),',
      '                            fpLegacyActivatedSpellstone\n                              ? Math.round(Jn * (32 / Zn.texH))\n                              : Jn,'
    );
  }

  if(
    text.includes('const fpLegacyActivatedSpellstone =') &&
    !text.includes('const fpLegacyVcd =') &&
    text.includes('                    const fpPosView =')
  ){
    text=text.replace(
      '                  (b.createModelShapes = () => {\n                    const fpPosView =',
      '                  (b.createModelShapes = () => {\n'+LEGACY_SHAPE+'                    const fpPosView ='
    );
  }

  return text;
}

window.__pfpApplyFinalParity=function(text){
  text=patchSkies(text);
  text=patchSpellstone(text);
  window.__pfpFinalParityStatus={
    swapcircle:text.includes('await nn(o, i, this.gameInfo, t.dataFetcher, l, "swaphol")'),
    diamondBay:text.includes('await nn(r, s, v.Ij, t.dataFetcher, o, "swaphol")'),
    spellstone:text.includes('const fpLegacyActivatedSpellstone =')
  };
  return text;
};
})();