import * as Viewer from '../viewer.js';
import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import { SceneContext } from '../SceneBase.js';
import { SFAAnimationController, AmapCollection, ModanimCollection, AnimFile, applyAnimationToModel } from './animation.js';
import { MaterialFactory } from './materials.js';
import { SFARenderer, SceneRenderContext, SFARenderLists } from './render.js';
import { GameInfo } from './scenes.js';
import { GfxRenderInstManager } from "../gfx/render/GfxRenderInstManager.js";
import { fillSceneParamsDataOnTemplate } from '../gx/gx_render.js';
import { White } from '../Color.js';
import { DataFetcher } from '../DataFetcher.js';
import { ModelInstance, ModelRenderContext } from './models.js';
import { mat4, vec3 } from 'gl-matrix';
import { SFATextureFetcher } from './textures.js';
import { loadModel, ModelVersion } from './modelloader.js';
import { computeModelMatrixSRT } from '../MathHelpers.js';

const BIN_TO_RAD = Math.PI / 32768.0;
const EV_PLAY_ANIM = 0x02;
const EV_SETOBJ = 0x03; // NEW: Seen in your logs
const EV_TIMING_SYNC = 0x01; 
const EV_SUBEVENT = 0x0B; // Special split event

interface Keyframe {
    time: number;
    value: number;
    interp: number;
}

interface Actor {
    inst: ModelInstance | null;
    matrix: mat4;
    curve: { channels: Map<number, Keyframe[]>, animEvents: any[] };
    modanim: DataView | null;
    currentAnimIdx: number;
    isCamera: boolean;
}

function dpExtractModelNums(objBin: DataView, startOffs: number, defSize: number): number[] {
    if (defSize < 0x58) return [];
    const count = objBin.getUint8(startOffs + 0x54); 
    const listOffs = objBin.getUint32(startOffs + 0x08); 
    if (listOffs === 0xFFFFFFFF || listOffs >= defSize) return [];
    const out: number[] = [];
    const base = startOffs + listOffs;
    for (let i = 0; i < count; i++) {
        const v = objBin.getUint32(base + i * 4);
        if (v < 0x4000) out.push(v | 0);
    }
    return out;
}

async function decompressDPModel(modelId: number, tabView: DataView, binArray: Uint8Array): Promise<DataView | null> {
    const offset = tabView.getUint32(modelId * 4);
    if (offset === 0xFFFFFFFF || offset === 0) return null;
    let nextOffset = binArray.length;
    for (let j = modelId + 1; j < tabView.byteLength / 4; j++) {
        const candidate = tabView.getUint32(j * 4);
        if (candidate !== 0xFFFFFFFF && candidate !== 0) { nextOffset = candidate; break; }
    }
    const compressedChunk = binArray.subarray(offset + 13, nextOffset);
    let end = compressedChunk.length;
    while (end > 0 && compressedChunk[end - 1] === 0) end--;
    const safeChunk = new Uint8Array(compressedChunk.subarray(0, end));
    try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(safeChunk as any).catch(()=>{}); writer.close().catch(()=>{});
        const reader = ds.readable.getReader();
        const chunks: Uint8Array[] = [];
        let totalLength = 0;
        try { while (true) { const { value, done } = await reader.read(); if (done) break; if (value) { chunks.push(value); totalLength += value.length; } } } catch (e) {}
        if (totalLength === 0) return null;
        const out = new Uint8Array(totalLength);
        let ptr = 0; for (const c of chunks) { out.set(c, ptr); ptr += c.length; }
        return new DataView(out.buffer);
    } catch (e) { return null; }
}

export class SequenceRenderer extends SFARenderer {
    private actors: Actor[] = [];
    private currentTime: number = 0;
    private animFile: AnimFile | null = null;

    public async create(sequenceId: number, gameInfo: GameInfo, dataFetcher: DataFetcher): Promise<Viewer.SceneGfx> {
        const pathBase = gameInfo.pathBase;
        const texFetcher = await SFATextureFetcher.create(gameInfo, dataFetcher, false);
        texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);

        const [amapColl, modanimColl, tabBuf, binBuf, o2cBuf, cTabBuf, cBinBuf, modTabBuf, modBinBuf, objIdxBuf, objTabBuf, objBinBuf] = await Promise.all([
            AmapCollection.create(gameInfo, dataFetcher),
            ModanimCollection.create(gameInfo, dataFetcher),
            dataFetcher.fetchData(`${pathBase}/OBJSEQ.tab`),
            dataFetcher.fetchData(`${pathBase}/OBJSEQ.bin`),
            dataFetcher.fetchData(`${pathBase}/OBJSEQ2CURVE.tab`),
            dataFetcher.fetchData(`${pathBase}/ANIMCURVES.tab`),
            dataFetcher.fetchData(`${pathBase}/ANIMCURVES.bin`),
            dataFetcher.fetchData(`${pathBase}/MODELS.tab`),
            dataFetcher.fetchData(`${pathBase}/MODELS.bin`),
            dataFetcher.fetchData(`${pathBase}/OBJINDEX.bin`),
            dataFetcher.fetchData(`${pathBase}/OBJECTS.tab`),
            dataFetcher.fetchData(`${pathBase}/OBJECTS.bin`),
        ]);

        try { this.animFile = await AnimFile.create(dataFetcher, `${pathBase}/ANIM`); } catch (e) {}

        const seqTab = tabBuf.createDataView();
        const seqBin = binBuf.createDataView();
        const startOffs = seqTab.getUint16(sequenceId * 2) * 8;
        const endOffs = seqTab.getUint16((sequenceId + 1) * 2) * 8;
        
        const curveBaseIdx = o2cBuf.createDataView().getUint16(sequenceId * 2);
        const cTabView = cTabBuf.createDataView();
        const cBinView = cBinBuf.createDataView();
        const modTab = modTabBuf.createDataView();
        const modBin = new Uint8Array(modBinBuf.arrayBuffer);
        const objIdx = objIdxBuf.createDataView();
        const objTab = objTabBuf.createDataView();
        const objBin = objBinBuf.createDataView();

        let actorIdx = 0;
        for (let offset = startOffs; offset < endOffs; offset += 8) {
            const scnId = seqBin.getUint16(offset + 0x6);
            const actorCurve = { channels: new Map<number, Keyframe[]>(), animEvents: [] as any[] };
            const cTabOffs = (curveBaseIdx + actorIdx) * 8;
            
            let lastTimingSync = 0;
            if (cTabOffs + 8 <= cTabView.byteLength) {
                const cSize = cTabView.getUint16(cTabOffs + 0x0);
                const cEvCount = cTabView.getUint16(cTabOffs + 0x2);
                const cBinOffs = cTabView.getUint32(cTabOffs + 0x4);

                let runningTime = 0;
                for (let e = 0; e < cEvCount; e++) {
                    const evOffs = cBinOffs + (e * 4);
                    const type = cBinView.getUint8(evOffs + 0x0);
                    const delay = cBinView.getUint8(evOffs + 0x1);
                    if (type === EV_TIMING_SYNC) lastTimingSync = runningTime;
                    
                    actorCurve.animEvents.push({ type, time: runningTime, params: cBinView.getUint16(evOffs + 0x2) });
                    runningTime += delay;
                }

                const kfStart = cBinOffs + (cEvCount * 4);
                for (let k = kfStart; k < cBinOffs + cSize; k += 8) {
                    const chan = cBinView.getUint8(k + 0x5);
                    const timeOffset = cBinView.getInt16(k + 0x6);
                    if (!actorCurve.channels.has(chan)) actorCurve.channels.set(chan, []);
                    actorCurve.channels.get(chan)!.push({ 
                        time: lastTimingSync + timeOffset, 
                        value: cBinView.getFloat32(k + 0x0), 
                        interp: cBinView.getUint8(k + 0x4) & 0x03 
                    });
                }
            }

            const actorObj: Actor = { 
                inst: null, matrix: mat4.create(), curve: actorCurve, 
                modanim: null, currentAnimIdx: -1, isCamera: (scnId === 0xFFFE) 
            };

            if (!actorObj.isCamera && scnId !== 0xFFFF) {
                try {
                    const romId = objIdx.getUint16(scnId * 2);
                    const oOffs = objTab.getUint32(romId * 4);
                    const nextO = (romId + 1 < objTab.byteLength / 4) ? objTab.getUint32((romId + 1) * 4) : objBin.byteLength;
                    const models = dpExtractModelNums(objBin, oOffs, nextO - oOffs);
                    if (models.length > 0) {
                        const mId = models[0];
                        const mData = await decompressDPModel(mId, modTab, modBin);
                        if (mData) {
                            actorObj.inst = new ModelInstance(loadModel(mData, texFetcher, this.materialFactory, ModelVersion.DinosaurPlanet));
                            actorObj.inst.setAmap(amapColl.getAmap(mId));
                            actorObj.modanim = modanimColl.getModanim(mId);
                        }
                    }
                } catch (e) {}
            }
            this.actors.push(actorObj);
            actorIdx++;
        }
        return this;
    }

    protected override update(viewerInput: Viewer.ViewerRenderInput) {
        super.update(viewerInput);
        this.currentTime = (this.currentTime + (viewerInput.deltaTime / 1000) * 60) % 30000;

        for (const actor of this.actors) {
            // Sample documentation channels
            const x = this.sample(actor.curve, 13, this.currentTime);
            const y = this.sample(actor.curve, 12, this.currentTime);
            const z = this.sample(actor.curve, 11, this.currentTime);
            const rx = this.sample(actor.curve, 8, this.currentTime) * BIN_TO_RAD;
            const ry = this.sample(actor.curve, 7, this.currentTime) * BIN_TO_RAD;
            const rz = this.sample(actor.curve, 6, this.currentTime) * BIN_TO_RAD;

            // MANUAL CAMERA ENABLED: Logic for 0xFFFE actor is bypassed here
            if (actor.inst) {
                let s = this.sample(actor.curve, 5, this.currentTime);
                if (s <= 0) s = 1.0; 
                computeModelMatrixSRT(actor.matrix, s, s, s, rx, ry, rz, x, y, z);
                
                if (actor.modanim && this.animFile) {
                    let activeParam = -1, startTime = 0;
                    for (const ev of actor.curve.animEvents) {
                        // Trigger on standard Play, SetObj, or SubEvent
                        if ((ev.type === EV_PLAY_ANIM || ev.type === EV_SETOBJ || ev.type === EV_SUBEVENT) && ev.time <= this.currentTime) {
                            activeParam = ev.params; startTime = ev.time;
                        }
                    }

                    if (activeParam !== -1) {
                        const mOffs = activeParam * 2;
                        if (mOffs + 2 <= actor.modanim.byteLength) {
                            const aId = actor.modanim.getUint16(mOffs) & 0x7FFF;
                            const total = (this.animFile as any).tabData ? (this.animFile as any).tabData.byteLength / 8 : 0;
                            if (aId > 0 && aId < total) {
                                try {
                                    const anim = this.animFile.getAnim(aId);
                                    if (anim) applyAnimationToModel((this.currentTime - startTime), actor.inst, anim, activeParam);
                                } catch (e) {}
                            }
                        }
                    }
                }
            }
        }
    }

    private sample(curve: any, chan: number, time: number): number {
        const keys: Keyframe[] = curve.channels.get(chan);
        if (!keys || keys.length === 0) return (chan === 5) ? 1.0 : 0.0;
        if (time <= keys[0].time) return keys[0].value;
        if (time >= keys[keys.length - 1].time) return keys[keys.length - 1].value;
        for (let i = 0; i < keys.length - 1; i++) {
            const k0 = keys[i], k1 = keys[i + 1];
            if (time >= k0.time && time <= k1.time) {
                const t = (time - k0.time) / (k1.time - k0.time);
                if (k0.interp === 2) return k1.value; // Stepped holds end value
                if (k0.interp === 0) return k0.value + (t * t * (3 - 2 * t)) * (k1.value - k0.value); 
                return k0.value + t * (k1.value - k0.value); 
            }
        }
        return 0;
    }

    protected override addWorldRenderInsts(device: GfxDevice, renderInstManager: GfxRenderInstManager, renderLists: SFARenderLists, sceneCtx: SceneRenderContext) {
        const template = renderInstManager.pushTemplateRenderInst();
        fillSceneParamsDataOnTemplate(template, sceneCtx.viewerInput);
        const modelCtx: ModelRenderContext = { sceneCtx, showDevGeometry: false, ambienceIdx: 0, showMeshes: true, outdoorAmbientColor: White, setupLights: () => {}, cullByAabb: false };
        for (const actor of this.actors) if (actor.inst) actor.inst.addRenderInsts(device, renderInstManager, modelCtx, renderLists, actor.matrix);
        renderInstManager.popTemplateRenderInst();
    }
}

export class DPSequenceSceneDesc implements Viewer.SceneDesc {
    constructor(public sequenceId: number, public id: string, public name: string, private gameInfo: GameInfo) {}
    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        const renderer = new SequenceRenderer(context, new SFAAnimationController(), new MaterialFactory(device));
        await renderer.create(this.sequenceId, this.gameInfo, context.dataFetcher);
        return renderer;
    }
}