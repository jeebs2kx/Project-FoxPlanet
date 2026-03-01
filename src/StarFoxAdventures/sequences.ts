import * as Viewer from '../viewer.js';
import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import { SceneContext } from '../SceneBase.js';
import { SFAAnimationController, AnimCollection, AmapCollection, ModanimCollection, AnimFile, applyAnimationToModel, Anim } from './animation.js';
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
import * as UI from '../ui.js';
import { computeModelMatrixSRT } from '../MathHelpers.js';

const CHAN_RZ = 6;
const CHAN_RY = 7;
const CHAN_RX = 8;
const CHAN_Z  = 11;
const CHAN_Y  = 12;
const CHAN_X  = 13;
const CHAN_SCALE = 5;

const EV_PLAY_ANIM = 0x02;

// Converts Dinosaur Planet 16-bit binary angles (0-65535) into Radians
const BIN_TO_RAD = Math.PI / 32768.0;

export interface ActorCurve {
    channels: Map<number, { time: number; value: number }[]>;
    animEvents: { type: number; time: number; params: number }[];
}

interface SequenceActor {
    inst: ModelInstance | null;
    matrix: mat4;
    curve: ActorCurve;
    modanim: DataView | null;
    currentAnimIdx: number;
    currentAnim: Anim | null;
}

function sampleCurve(curve: ActorCurve, channelId: number, time: number): number {
    const keys = curve.channels.get(channelId);
    if (!keys || keys.length === 0) return (channelId === CHAN_SCALE) ? 1.0 : 0.0;
    if (time <= keys[0].time) return keys[0].value;
    if (time >= keys[keys.length - 1].time) return keys[keys.length - 1].value;
    for (let i = 0; i < keys.length - 1; i++) {
        if (time >= keys[i].time && time <= keys[i + 1].time) {
            const t = (time - keys[i].time) / (keys[i + 1].time - keys[i].time);
            return keys[i].value + t * (keys[i + 1].value - keys[i].value);
        }
    }
    return 0;
}

// EXACT Python-Decoded Mapping
// Update these numbers as you hunt down the rest in your model viewer!
const DP_ACTOR_MAP: Record<number, number> = {
    0x001F: 1,   // Krystal
    0x0012: 68,  // General Scales
    0x00BC: 188, // KytesMum
    0x0025: 37,  // Kyte
    0x00BF: 191, // AnimSharpy
    0x00B4: 180, // RobotAnimPatrol
    0x0120: 638, // Kyte Cage
    0x0121: 642  // Cage Kyte
};

// Replicates your Python `zlib.decompress(chunk, -15)` directly in the browser!
async function decompressDPModel(modelId: number, tabView: DataView, binArray: Uint8Array): Promise<DataView | null> {
    const offset = tabView.getUint32(modelId * 4);
    if (offset === 0xFFFFFFFF || offset === 0) return null;

    let nextOffset = binArray.length;
    for (let j = modelId + 1; j < tabView.byteLength / 4; j++) {
        const candidate = tabView.getUint32(j * 4);
        if (candidate !== 0xFFFFFFFF && candidate !== 0) {
            nextOffset = candidate;
            break;
        }
    }

    const compressedSize = nextOffset - (offset + 13);
    if (compressedSize <= 0) return null;

    // Slice out the compressed chunk (skipping the 13 byte header exactly like your python script)
    let compressedChunk = binArray.subarray(offset + 13, nextOffset);

    // Strip trailing 0x00 padding bytes from the ROM alignment so JS DecompressionStream doesn't crash
    let end = compressedChunk.length;
    while (end > 0 && compressedChunk[end - 1] === 0) {
        end--;
    }
    
    // FIX: Copy into a fresh Uint8Array to satisfy TypeScript's strict BufferSource DOM typings
    const safeChunk = new Uint8Array(compressedChunk.subarray(0, end));

    try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        
        // Cast to 'any' to completely bypass TS type conflicts on BufferSource
        writer.write(safeChunk as any).catch(()=>{});
        writer.close().catch(()=>{});

        const reader = ds.readable.getReader();
        const chunks: Uint8Array[] = [];
        let totalLength = 0;
        
        // Safely read the stream. If we hit remaining junk, we catch it 
        // exactly like your Python script does and KEEP the valid decompressed data!
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    chunks.push(value);
                    totalLength += value.length;
                }
            }
        } catch (e) {
            console.warn(`[SEQ] Model ${modelId} trailing padding safely bypassed.`);
        }

        if (totalLength === 0) return null;

        const out = new Uint8Array(totalLength);
        let ptr = 0;
        for (const c of chunks) {
            out.set(c, ptr);
            ptr += c.length;
        }
        
        return new DataView(out.buffer);
    } catch (e) {
        console.error(`Failed to raw-deflate model ${modelId}`, e);
        return null;
    }
}

export class SequenceRenderer extends SFARenderer {
    private actors: SequenceActor[] = [];
    private currentTime: number = 0;
    private uiSlider: UI.Slider | null = null;
    private isUserAdjusting: boolean = false;
    private animFile: AnimFile | null = null;

    constructor(public context: SceneContext, animController: SFAAnimationController, materialFactory: MaterialFactory) {
        super(context, animController, materialFactory);
    }

    public async create(sequenceId: number, gameInfo: GameInfo, dataFetcher: DataFetcher): Promise<Viewer.SceneGfx> {
        const pathBase = gameInfo.pathBase;
        
        const texFetcher = await SFATextureFetcher.create(gameInfo, dataFetcher, false);
        texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);

        const amapColl = await AmapCollection.create(gameInfo, dataFetcher);
        const modanimColl = await ModanimCollection.create(gameInfo, dataFetcher);
        
        try { this.animFile = await AnimFile.create(dataFetcher, `${pathBase}/ANIM`); } catch (e) { console.warn("ANIM.BIN load failed"); }

        // Fetching the native compressed DP files!
        const [tabBuf, binBuf, o2cBuf, cTabBuf, cBinBuf, modTabBuf, modBinBuf] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/OBJSEQ.tab`),
            dataFetcher.fetchData(`${pathBase}/OBJSEQ.bin`),
            dataFetcher.fetchData(`${pathBase}/OBJSEQ2CURVE.tab`),
            dataFetcher.fetchData(`${pathBase}/ANIMCURVES.tab`),
            dataFetcher.fetchData(`${pathBase}/ANIMCURVES.bin`),
            dataFetcher.fetchData(`${pathBase}/MODELS.tab`),
            dataFetcher.fetchData(`${pathBase}/MODELS.bin`)
        ]);

        const tab = tabBuf.createDataView();
        const bin = binBuf.createDataView();
        const curveBaseIdx = o2cBuf.createDataView().getUint16(sequenceId * 2);
        const startOffs = tab.getUint16(sequenceId * 2) * 8;
        const endOffs = tab.getUint16((sequenceId + 1) * 2) * 8;

        const cTabView = cTabBuf.createDataView();
        const cBinView = cBinBuf.createDataView();

        const modTab = modTabBuf.createDataView();
        const modBin = new Uint8Array(modBinBuf.arrayBuffer);

        let actorIdx = 0;
        for (let offset = startOffs; offset < endOffs; offset += 8) {
            const seqObjId = bin.getUint16(offset + 0x6);
            const actorCurve: ActorCurve = { channels: new Map(), animEvents: [] };
            
            const cTabOffs = (curveBaseIdx + actorIdx) * 8;
            const cBinOffs = cTabView.getInt32(cTabOffs + 0x4);
            const cSize = cTabView.getInt16(cTabOffs + 0x0);
            const cEvCount = cTabView.getInt16(cTabOffs + 0x2);

            let runningTime = 0;

            for (let e = 0; e < cEvCount; e++) {
                const evOffs = cBinOffs + (e * 4);
                const type = cBinView.getUint8(evOffs + 0x0);
                const delay = cBinView.getUint8(evOffs + 0x1);
                const params = cBinView.getUint16(evOffs + 0x2);
                runningTime += delay;
                actorCurve.animEvents.push({ type, time: runningTime, params });
            }

            for (let k = cBinOffs + (cEvCount * 4); k < cBinOffs + cSize; k += 8) {
                const val = cBinView.getFloat32(k + 0x0);
                const chan = cBinView.getInt8(k + 0x5);
                const time = cBinView.getInt16(k + 0x6);
                if (!actorCurve.channels.has(chan)) actorCurve.channels.set(chan, []);
                actorCurve.channels.get(chan)!.push({ time, value: val });
            }

            let inst: ModelInstance | null = null;
            let modanim: DataView | null = null;

            if (seqObjId !== 0xFFFF && seqObjId !== 0xFFFE) {
                const modelId = DP_ACTOR_MAP[seqObjId];
                if (modelId !== undefined) {
                    try {
                        // Decompress dynamically from native MODELS.bin!
                        const modelData = await decompressDPModel(modelId, modTab, modBin);
                        if (modelData) {
                            const model = loadModel(modelData, texFetcher, this.materialFactory, ModelVersion.DinosaurPlanet);
                            inst = new ModelInstance(model);

                            inst.setAmap(amapColl.getAmap(modelId));
                            modanim = modanimColl.getModanim(modelId);
                            
                            console.log(`[SEQ] Actor ${actorIdx} (SeqID 0x${seqObjId.toString(16)}) -> dynamically inflated Model ${modelId}`);
                        }
                    } catch (e) { console.error(`[SEQ] Actor ${actorIdx} failed:`, e); }
                } else {
                    console.warn(`[SEQ] Actor ${actorIdx} (SeqID 0x${seqObjId.toString(16)}) not in DP_ACTOR_MAP.`);
                }
            }

            this.actors.push({ inst, matrix: mat4.create(), curve: actorCurve, modanim, currentAnimIdx: -1, currentAnim: null });
            actorIdx++;
        }
        return this;
    }

    public createPanels(): UI.Panel[] {
        const panel = new UI.Panel();
        panel.setTitle(UI.SAND_CLOCK_ICON, 'Sequence Timeline');
        this.uiSlider = new UI.Slider();
        this.uiSlider.setLabel('Frame');
        this.uiSlider.setRange(0, 5000, 1);
        this.uiSlider.onvalue = (v) => { this.currentTime = v; this.isUserAdjusting = true; setTimeout(() => this.isUserAdjusting = false, 500); };
        panel.contents.appendChild(this.uiSlider.elem);
        return [panel];
    }

    protected override update(viewerInput: Viewer.ViewerRenderInput) {
        super.update(viewerInput);
        if (!this.isUserAdjusting) {
            this.currentTime = (this.currentTime + (viewerInput.deltaTime / 1000) * 30) % 5000;
            if (this.uiSlider) this.uiSlider.setValue(this.currentTime);
        }

        for (const actor of this.actors) {
            if (!actor.inst) continue;

            const x = sampleCurve(actor.curve, CHAN_X, this.currentTime);
            const y = sampleCurve(actor.curve, CHAN_Y, this.currentTime);
            const z = sampleCurve(actor.curve, CHAN_Z, this.currentTime);
            
            const rx = sampleCurve(actor.curve, CHAN_RX, this.currentTime) * BIN_TO_RAD;
            const ry = sampleCurve(actor.curve, CHAN_RY, this.currentTime) * BIN_TO_RAD;
            const rz = sampleCurve(actor.curve, CHAN_RZ, this.currentTime) * BIN_TO_RAD;
            const s = sampleCurve(actor.curve, CHAN_SCALE, this.currentTime);

            computeModelMatrixSRT(actor.matrix, s, s, s, rx, ry, rz, x, y, z);

            if (actor.modanim && this.animFile) {
                let activeAnimParam = -1;
                let animStartTime = 0;
                
                for (const ev of actor.curve.animEvents) {
                    if (ev.type === EV_PLAY_ANIM && ev.time <= this.currentTime) {
                        activeAnimParam = ev.params;
                        animStartTime = ev.time;
                    }
                }

                if (activeAnimParam !== -1) {
                    if (actor.currentAnimIdx !== activeAnimParam) {
                        actor.currentAnimIdx = activeAnimParam;
                        try {
                            const realAnimId = actor.modanim.getUint16(activeAnimParam * 2) & 0x7FFF;
                            actor.currentAnim = this.animFile.getAnim(realAnimId);
                        } catch (e) { actor.currentAnim = null; }
                    }

                    if (actor.currentAnim) {
                        const elapsedFrames = this.currentTime - animStartTime;
                        applyAnimationToModel(elapsedFrames, actor.inst, actor.currentAnim, activeAnimParam);
                    } else {
                        actor.inst.resetPose();
                    }
                } else {
                    actor.inst.resetPose();
                }
            }
        }
    }

    protected override addWorldRenderInsts(device: GfxDevice, renderInstManager: GfxRenderInstManager, renderLists: SFARenderLists, sceneCtx: SceneRenderContext) {
        const template = renderInstManager.pushTemplateRenderInst();
        fillSceneParamsDataOnTemplate(template, sceneCtx.viewerInput);
        
        const ambientColor = colorNewFromRGBA(1, 1, 1, 1);
        colorCopy(ambientColor, White);

        const modelCtx: ModelRenderContext = { 
            sceneCtx, 
            showDevGeometry: false, 
            ambienceIdx: 0, 
            showMeshes: true, 
            outdoorAmbientColor: ambientColor, 
            setupLights: () => {}, 
            cullByAabb: false 
        };
        
        for (const actor of this.actors) {
            if (actor.inst) {
                actor.inst.addRenderInsts(device, renderInstManager, modelCtx, renderLists, actor.matrix);
            }
        }
        
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