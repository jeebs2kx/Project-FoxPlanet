import * as Viewer from '../viewer.js';
import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import { SceneContext } from '../SceneBase.js';
import { SFAAnimationController, AmapCollection, ModanimCollection, AnimFile, applyAnimationToModel, Anim } from './animation.js';
import { MaterialFactory } from './materials.js';
import { SFARenderer, SceneRenderContext, SFARenderLists } from './render.js';
import { GameInfo } from './scenes.js';
import { GfxRenderInstManager } from "../gfx/render/GfxRenderInstManager.js";
import { fillSceneParamsDataOnTemplate } from '../gx/gx_render.js';
import { colorNewFromRGBA, White, colorCopy } from '../Color.js';
import { DataFetcher } from '../DataFetcher.js';
import { ModelInstance, ModelRenderContext } from './models.js';
import { mat4, vec3, quat } from 'gl-matrix';
import { SFATextureFetcher } from './textures.js';
import { loadModel, ModelVersion } from './modelloader.js';
import { computeModelMatrixSRT } from '../MathHelpers.js';

const BIN_TO_RAD = Math.PI / 32768.0;
const EV_PLAY_ANIM = 0x02;

// Replicates your Python logic: zlib.decompress(chunk, -15) with 13-byte skip
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
    private actors: any[] = [];
    private currentTime: number = 0;
    private animFile: AnimFile | null = null;

    constructor(public context: SceneContext, animController: SFAAnimationController, materialFactory: MaterialFactory) {
        super(context, animController, materialFactory);
    }

    public async create(sequenceId: number, gameInfo: GameInfo, dataFetcher: DataFetcher): Promise<Viewer.SceneGfx> {
        const pathBase = gameInfo.pathBase;
        const texFetcher = await SFATextureFetcher.create(gameInfo, dataFetcher, false);
        texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);

        const [amapColl, modanimColl, tabBuf, binBuf, o2cBuf, cTabBuf, cBinBuf, modTabBuf, modBinBuf, objIdxBuf, objTabBuf, objBinBuf, modelIndBuf] = await Promise.all([
            AmapCollection.create(gameInfo, dataFetcher),
            ModanimCollection.create(gameInfo, dataFetcher),
            dataFetcher.fetchData(`${pathBase}/OBJSEQ.tab`),
            dataFetcher.fetchData(`${pathBase}/OBJSEQ.bin`),
            dataFetcher.fetchData(`${pathBase}/OBJSEQ2CURVE.tab`),
            dataFetcher.fetchData(`${pathBase}/ANIMCURVES.tab`),
            dataFetcher.fetchData(`${pathBase}/ANIMCURVES.bin`),
            dataFetcher.fetchData(`${pathBase}/MODELS.tab`),
            dataFetcher.fetchData(`${pathBase}/MODELS.bin`),
            dataFetcher.fetchData(`${pathBase}/OBJINDEX.bin`), // AS REQUESTED
            dataFetcher.fetchData(`${pathBase}/OBJECTS.tab`),
            dataFetcher.fetchData(`${pathBase}/OBJECTS.bin`),
            dataFetcher.fetchData(`${pathBase}/MODELIND.bin`)
        ]);

        try { this.animFile = await AnimFile.create(dataFetcher, `${pathBase}/ANIM`); } catch (e) {}

        const seqBin = binBuf.createDataView();
        const curveBaseIdx = o2cBuf.createDataView().getUint16(sequenceId * 2);
        const startOffs = tabBuf.createDataView().getUint16(sequenceId * 2) * 8;
        const endOffs = tabBuf.createDataView().getUint16((sequenceId + 1) * 2) * 8;
        const cTabView = cTabBuf.createDataView();
        const cBinView = cBinBuf.createDataView();
        const modTab = modTabBuf.createDataView();
        const modBin = new Uint8Array(modBinBuf.arrayBuffer);
        const objIdx = objIdxBuf.createDataView();
        const objTab = objTabBuf.createDataView();
        const objBin = objBinBuf.createDataView();
        const modelInd = modelIndBuf.createDataView();

        let actorIdx = 0;
        for (let offset = startOffs; offset < endOffs; offset += 8) {
            const seqId = seqBin.getUint16(offset + 0x6);
            const actorCurve = { channels: new Map(), animEvents: [] as any[] };
            const cTabOffs = (curveBaseIdx + actorIdx) * 8;
            const cBinOffs = cTabView.getInt32(cTabOffs + 0x4);
            const cSize = cTabView.getInt16(cTabOffs + 0x0);
            const cEvCount = cTabView.getInt16(cTabOffs + 0x2);

            let runningTime = 0;
            for (let e = 0; e < cEvCount; e++) {
                const evOffs = cBinOffs + (e * 4);
                const delay = cBinView.getUint8(evOffs + 0x1);
                runningTime += delay;
                actorCurve.animEvents.push({ type: cBinView.getUint8(evOffs + 0x0), time: runningTime, params: cBinView.getUint16(evOffs + 0x2) });
            }

            for (let k = cBinOffs + (cEvCount * 4); k < cBinOffs + cSize; k += 8) {
                const chan = cBinView.getInt8(k + 0x5);
                if (!actorCurve.channels.has(chan)) actorCurve.channels.set(chan, []);
                actorCurve.channels.get(chan).push({ time: cBinView.getInt16(k + 0x6), value: cBinView.getFloat32(k + 0x0) });
            }

            let inst: ModelInstance | null = null;
            let modanim: DataView | null = null;

            if (seqId !== 0xFFFF && seqId !== 0xFFFE) {
                try {
                    const objectIndex = objIdx.getUint16(seqId * 2);
                    const objOffs = objTab.getUint32(objectIndex * 4);
                    const nextObjOffs = (objectIndex + 1 < objTab.byteLength / 4) ? objTab.getUint32((objectIndex + 1) * 4) : objBin.byteLength;

                    // THE PATTERN SCAN: FF FF FF FF FF FF FF FF FF FF FF FF
                    let foundModelId = -1;
                    for (let i = objOffs; i < nextObjOffs - 16; i++) {
                        let match = true;
                        for (let j = 0; j < 12; j++) { if (objBin.getUint8(i + j) !== 0xFF) { match = false; break; } }
                        if (match) {
                            // Found the 12 FFs! Read the 4 bytes immediately after
                            const localId = objBin.getUint32(i + 12);
                            foundModelId = modelInd.getUint16(localId * 2);
                            break;
                        }
                    }

                    if (foundModelId !== -1) {
                        const modelData = await decompressDPModel(foundModelId, modTab, modBin);
                        if (modelData) {
                            inst = new ModelInstance(loadModel(modelData, texFetcher, this.materialFactory, ModelVersion.DinosaurPlanet));
                            inst.setAmap(amapColl.getAmap(foundModelId));
                            modanim = modanimColl.getModanim(foundModelId);
                            console.log(`[SEQ] Actor ${actorIdx} (Obj ${objectIndex}) -> Scanned Model ID ${foundModelId}`);
                        }
                    }
                } catch (e) { console.error(e); }
            }

            this.actors.push({ inst, matrix: mat4.create(), curve: actorCurve, modanim, currentAnimIdx: -1, currentAnim: null });
            actorIdx++;
        }
        return this;
    }

    protected override update(viewerInput: Viewer.ViewerRenderInput) {
        super.update(viewerInput);
        this.currentTime = (this.currentTime + (viewerInput.deltaTime / 1000) * 30) % 5000;
        for (const actor of this.actors) {
            if (!actor.inst) continue;
            const x = this.sample(actor.curve, 13, this.currentTime);
            const y = this.sample(actor.curve, 12, this.currentTime);
            const z = this.sample(actor.curve, 11, this.currentTime);
            const rx = this.sample(actor.curve, 8, this.currentTime) * BIN_TO_RAD;
            const ry = this.sample(actor.curve, 7, this.currentTime) * BIN_TO_RAD;
            const rz = this.sample(actor.curve, 6, this.currentTime) * BIN_TO_RAD;
            const s = this.sample(actor.curve, 5, this.currentTime);
            computeModelMatrixSRT(actor.matrix, s, s, s, rx, ry, rz, x, y, z);

            if (actor.modanim && this.animFile) {
                let activeParam = -1, startTime = 0;
                for (const ev of actor.curve.animEvents) if (ev.type === EV_PLAY_ANIM && ev.time <= this.currentTime) { activeParam = ev.params; startTime = ev.time; }
                if (activeParam !== -1) {
                    if (actor.currentAnimIdx !== activeParam) {
                        actor.currentAnimIdx = activeParam;
                        try { actor.currentAnim = this.animFile.getAnim(actor.modanim.getUint16(activeParam * 2) & 0x7FFF); } catch (e) { actor.currentAnim = null; }
                    }
                    if (actor.currentAnim) applyAnimationToModel(this.currentTime - startTime, actor.inst, actor.currentAnim, activeParam);
                }
            }
        }
    }

    private sample(curve: any, chan: number, time: number): number {
        const keys = curve.channels.get(chan);
        if (!keys || keys.length === 0) return (chan === 5) ? 1.0 : 0.0;
        if (time <= keys[0].time) return keys[0].value;
        if (time >= keys[keys.length - 1].time) return keys[keys.length - 1].value;
        for (let i = 0; i < keys.length - 1; i++) if (time >= keys[i].time && time <= keys[i + 1].time) {
            const t = (time - keys[i].time) / (keys[i + 1].time - keys[i].time);
            return keys[i].value + t * (keys[i + 1].value - keys[i].value);
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