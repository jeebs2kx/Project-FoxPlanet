import * as Viewer from '../viewer.js';
import * as UI from '../ui.js';
import { Sky } from './Sky.js';
import { ObjectManager, ObjectInstance } from './objects.js';import { GfxrGraphBuilder, GfxrRenderTargetID, GfxrRenderTargetDescription } from '../gfx/render/GfxRenderGraph.js';
import { getSubdir } from './resource.js';
import { DataFetcher } from '../DataFetcher.js';
import { GfxRenderInstManager } from "../gfx/render/GfxRenderInstManager.js";
import { fillSceneParamsDataOnTemplate } from '../gx/gx_render.js';
import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import { SceneContext } from '../SceneBase.js';
import { mat4, vec3 } from 'gl-matrix';
import { nArray } from '../util.js';
import { dataSubarray } from './util.js';import { White, colorCopy, colorNewFromRGBA } from '../Color.js';
import { ModelVersion, loadModel } from "./modelloader.js";import { SFARenderer, SceneRenderContext, SFARenderLists } from './render.js';
import { BlockFetcher, SFABlockFetcher, SwapcircleBlockFetcher, AncientBlockFetcher, EARLYDFPT, EARLYFEAR, EARLYDUPBLOCKFETCHER, EARLY1BLOCKFETCHER, EARLY2BLOCKFETCHER, EARLY3BLOCKFETCHER, EARLY4BLOCKFETCHER, DPBlockFetcher  } from './blocks.js';
import { SFA_GAME_INFO, SFADEMO_GAME_INFO, DP_GAME_INFO, GameInfo } from './scenes.js';
import { MaterialFactory } from './materials.js';
import { SFAAnimationController, ModanimCollection, AmapCollection, AnimCollection } from './animation.js';import { SFATextureFetcher, FakeTextureFetcher, TextureFetcher } from './textures.js';import { Model, ModelRenderContext, ModelInstance, ModelFetcher, ModelShapes } from './models.js';import { World } from './world.js';
import { EnvfxManager } from './envfx.js';

import { AABB } from '../Geometry.js';
import { LightType, WorldLights } from './WorldLights.js';
import { computeViewMatrix } from '../Camera.js';
import { drawWorldSpacePoint, getDebugOverlayCanvas2D } from '../DebugJunk.js';

const MAP_MUSIC: Record<string, string> = {
    2: 'dragrock.mp3',
    4: 'volcano.mp3',
    7: 'swaphol.mp3',
    8: 'swapholbot.mp3',
    10: 'snowhorn.mp3',
    11: 'kp.mp3',
    12: 'crf.mp3',
    14: 'lightfoot.mp3',
    16: 'dungeon.mp3',
    18: 'mmpass.mp3',
    19: 'darkicemines.mp3',
    21: 'ofp.mp3',
    27: 'darkicemines2.mp3',
    29: 'capeclaw.mp3',
    28: 'bossgaldon.mp3',
    31: 'kraztest.mp3',
    32: 'kraztest.mp3',
    33: 'kraztest.mp3',
    34: 'kraztest.mp3',
    39: 'kraztest.mp3',
    40: 'kraztest.mp3',
    50: 'ofp.mp3',
    51: 'shop.mp3',
    54: 'magcave.mp3',

    'Early_kraz_test': 'oldfear.mp3',

    'ancient_5': 'warlock.mp3',
    [-997]: 'oldfear.mp3',
    [-998]: 'dfpt.mp3',
    [-999]: 'swapcircle.mp3',

    // --- Dinosaur Planet Specific Tracks ---
    'dp_2':  'dp_dragrock.mp3',     
    'dp_3':  'dp_krazoapalace.mp3',
    'dp_4':  'dp_vfp.mp3',
    'dp_5': 'dp_rolling.mp3',
    'dp_6': 'dp_discovery.mp3',
    'dp_7': 'dp_swaphollow.mp3',
    'dp_8': 'dp_swaphollow.mp3',
    'dp_9': 'dp_gplains.mp3',
    'dp_10': 'dp_snowhorn.mp3',
    'dp_11': 'dp_warlock.mp3',
    'dp_12': 'dp_crfort.mp3',
    'dp_13': 'dp_walled.mp3',
    'dp_14': 'dp_swaphollow.mp3', 
    'dp_15': 'dp_crfort2.mp3', 
    'dp_16': 'dp_crfdungeon.mp3',
    'dp_18': 'dp_mmpass.mp3',
    'dp_19': 'dp_wastes.mp3',
    'dp_20': 'oldfear.mp3',
    'dp_21': 'dp_dfpt.mp3',
    'dp_22': 'oldfear.mp3',
    'dp_23': 'dp_snowhorn.mp3',
    'dp_24': 'dp_icemt.mp3',
    'dp_25': 'dp_icemt.mp3',
    'dp_27': 'dp_dim2.mp3',
    'dp_28': 'dp_dim3.mp3',
    'dp_29': 'dp_cclaw.mp3',
    'dp_30': 'dp_crfort2.mp3',
    'dp_31': 'oldfear.mp3',
    'dp_32': 'oldfear.mp3',
    'dp_33': 'oldfear.mp3',
    'dp_34': 'oldfear.mp3',
    'dp_35': 'dp_dbay.mp3',
    'dp_36': 'dp_walled.mp3',
    'dp_39': 'oldfear.mp3',
    'dp_40': 'oldfear.mp3',
    'dp_41': 'oldfear.mp3',
    'dp_42': 'oldfear.mp3',
    'dp_43': 'dp_crfrace.mp3',
    'dp_48': 'dp_rex.mp3',
    'dp_50': 'dp_dfpt.mp3',
    'dp_51': 'dp_shop.mp3',
    'dp_52': 'dp_dragrock.mp3',


};

if (!(window as any).musicState) {
    (window as any).musicState = {
        muted: false,
        audio: null as HTMLAudioElement | null
    };
}
const DP_DEV_TYPE_NUMS = new Set<number>([

]);

const DP_DEV_NAME_KEYWORDS = [
  'dummy', 'arrow', 'grnd', 'ground', 'anim',
  'trigger', 'checkpoint', 'curve', 'spline',
  'path', 'waypoint', 'marker',

  // DP huge helpers
  'background', 'backgroun',
];

const DP_ENV_DEFAULT = { timeOfDay: 6, envfxIndex: 95 };
const DP_LABEL_NAME_OVERRIDES: Record<number, string> = {
    0x001C: 'Fishingnet', 0x05B4: 'KPspellstone',0x05B5: 'KPlift',0x05B9: 'IceBlastspell',
   
};
export interface BlockInfo {
    mod: number;
    sub: number;
}
// ===================== DP SCALE OVERRIDES (DP ONLY) =====================
const DP_SCALE_MULT_BY_TYPE: Record<number, number> = {
     0x03FA: 0.15, 0x0071: 0.05, 0x036A: 0.15, 0x008A: 0.10, 0x03A4: 0.50,
     0x0178: 0.10, 0x0524: 0.30, 0x0523: 0.30, 0x020D: 0.30, 0x0076: 0.10,
     0x0358: 0.30, 0x0488: 10,0x0414: 1.5,
};

const DP_SCALE_MULT_BY_MODEL: Record<number, number> = {
    // modelId (first model in objType.modelNums)
    0x0195: 0.25, 
};

function dpClampScale(s: number): number {
    if (!Number.isFinite(s)) return 1.0;
    if (s < 0.0001) return 0.0001;
    if (s > 50.0) return 50.0;
    return s;
}

function dpGetScaleMultiplier(typeNum: number, ot: any): number {
    const byType = DP_SCALE_MULT_BY_TYPE[typeNum & 0xFFFF];
    if (byType !== undefined) return byType;

    const m0 = (ot?.modelNums?.[0] ?? -1) | 0;
    const byModel = DP_SCALE_MULT_BY_MODEL[m0];
    if (byModel !== undefined) return byModel;

    return 1.0;
}
export interface MapInfo {
    mapsBin: DataView;
    locationNum: number;
    infoOffset: number;
    blockTableOffset: number;
    blockCols: number;
    blockRows: number;
    originX: number;
    originZ: number;
    objectsOffset?: number;
    objectsSize?: number;
}

export function getBlockInfo(mapsBin: DataView, mapInfo: MapInfo, x: number, y: number): BlockInfo | null {
    const blockIndex = y * mapInfo.blockCols + x;
    const blockInfo = mapsBin.getUint32(mapInfo.blockTableOffset + 4 * blockIndex);
    const sub = (blockInfo >>> 17) & 0x3F;
    const mod = (blockInfo >>> 23);
    if (mod == 0xff)
        return null;
    return {mod, sub};
}

function getMapInfo(mapsTab: DataView, mapsBin: DataView, locationNum: number): MapInfo {
    const offs = locationNum * 0x1c;
    const infoOffset = mapsTab.getUint32(offs + 0x0);
    const blockTableOffset = mapsTab.getUint32(offs + 0x4);

    // Dinosaur Planet objects are located at offset 0x10 in the MAPS.tab entry
    let objectsOffset = 0;
    let objectsSize = 0;
    if (offs + 0x14 <= mapsTab.byteLength) {
        objectsOffset = mapsTab.getUint32(offs + 0x10);
        objectsSize = mapsTab.getUint32(offs + 0x14) - objectsOffset;
    }

    const blockCols = mapsBin.getUint16(infoOffset + 0x0);
    const blockRows = mapsBin.getUint16(infoOffset + 0x2);

    return {
        mapsBin, locationNum, infoOffset, blockTableOffset, blockCols, blockRows,
        originX: mapsBin.getInt16(infoOffset + 0x4),
        originZ: mapsBin.getInt16(infoOffset + 0x6),
        objectsOffset,
        objectsSize,
    };
}

function getBlockTable(mapInfo: MapInfo): (BlockInfo | null)[][] {
    const blockTable: (BlockInfo | null)[][] = [];
    for (let y = 0; y < mapInfo.blockRows; y++) {
        const row: (BlockInfo | null)[] = [];
        blockTable.push(row);
        for (let x = 0; x < mapInfo.blockCols; x++) {
            const blockInfo = getBlockInfo(mapInfo.mapsBin, mapInfo, x, y);
            row.push(blockInfo);
        }
    }
    return blockTable;
}

type BlockCell = BlockInfo | null;

async function buildEarly1WalledCityRemap(
  gameInfo: GameInfo,
  dataFetcher: DataFetcher,
  mapNum: number,
  makeLayout: (pick: (x: number, y: number) => BlockCell) => BlockCell[][]
): Promise<MapSceneInfo> {
  const pathBase = gameInfo.pathBase;
  const [tabBuf, binBuf] = await Promise.all([
    dataFetcher.fetchData(`${pathBase}/MAPS.tab`),
    dataFetcher.fetchData(`${pathBase}/MAPS.bin`),
  ]);

  const mapsTab = tabBuf.createDataView();
  const mapsBin = binBuf.createDataView();
  const info    = getMapInfo(mapsTab, mapsBin, mapNum);
  const src     = getBlockTable(info); 

  const pick = (x: number, y: number): BlockCell => (src[y]?.[x] ?? null);

  const layout = makeLayout(pick);
  const rows   = layout.length;
  const cols   = rows ? layout[0].length : 0;

  return {
    getNumCols() { return cols; },
    getNumRows() { return rows; },
    getBlockInfoAt(col: number, row: number) { return layout[row][col]; },
    getOrigin() { return [0, 0]; }, 
  };
}

const M = (mod: number, sub: number): BlockInfo => ({ mod, sub });


interface MapSceneInfo {
    getNumCols(): number;
    getNumRows(): number;
    getBlockInfoAt(col: number, row: number): BlockInfo | null;
    getOrigin(): number[];
    getObjectsData?(): DataView | null;
}
interface MapInstanceOptions {
    objectManager?: ObjectManager;
    worldOffsetX?: number;
    worldOffsetZ?: number;
    apply135Rotation?: boolean;

    globalOffsetX?: number;
    globalOffsetZ?: number;
    dpMapScene?: boolean; 
}

function buildRomToScnMap(objIdx: DataView): Map<number, number[]> {
    const romToScn = new Map<number, number[]>();

    const count = (objIdx.byteLength / 2) | 0;
    for (let scn = 0; scn < count; scn++) {
        const rom = objIdx.getUint16(scn * 2);
        if (rom === 0xFFFF) continue;
        let arr = romToScn.get(rom);
        if (!arr) romToScn.set(rom, arr = []);
        arr.push(scn);
    }

    for (const arr of romToScn.values())
        arr.sort((a, b) => a - b);

    return romToScn;
}

function dpExtractModelNums(objBin: DataView, startOffs: number, defSize: number): number[] {
    const defData = new Uint8Array(objBin.buffer, objBin.byteOffset + startOffs, defSize);

    let ffEnd = -1;
    let run = 0;
    for (let i = 0; i < defSize; i++) {
        if (defData[i] === 0xFF) {
            run++;
        } else {
            if (run >= 4) { ffEnd = i; break; }
            run = 0;
        }
    }
    if (ffEnd < 0) return [];

    const out: number[] = [];

    for (let o = ffEnd; o + 4 <= defSize; o += 4) {
        const v = objBin.getUint32(startOffs + o);

        if (v === 0 || v === 0xFFFFFFFF) continue; 
        if (v >= 0x4000) break; 

        out.push(v | 0);
        if (out.length >= 32) break; 
    }

    const uniq: number[] = [];
    for (const v of out) if (!uniq.includes(v)) uniq.push(v);

    return uniq;

}
const DP_WHITE_MUSHROOM_MODEL_ID = 0x00B3;
type DPPositionVariantOverride = {
    x: number;
    y: number;
    z: number;
    eps?: number;
    modelId: number;
};

const DP_POSITION_VARIANT_OVERRIDES: DPPositionVariantOverride[] = [
    // CBeacon exact model IDs from your OBJECTS.bin dump
    { x: -8850.365, y: -793.250, z: -6652.035, modelId: 0x03B1 }, // sun
    { x: -7150.133, y: -793.250, z: -8068.040, modelId: 0x03B2 }, // moon

    // White mushrooms only
    { x: -7321.163, y:  -718.000, z: -3094.313, modelId: DP_WHITE_MUSHROOM_MODEL_ID },
    { x: -6529.629, y:  -809.000, z: -2214.204, modelId: DP_WHITE_MUSHROOM_MODEL_ID },
    { x: -6787.717, y:  -707.172, z: -2438.862, modelId: DP_WHITE_MUSHROOM_MODEL_ID },
    { x: -7501.500, y:  -740.788, z: -2434.564, modelId: DP_WHITE_MUSHROOM_MODEL_ID },
    { x: -7456.400, y:  -741.999, z: -2442.471, modelId: DP_WHITE_MUSHROOM_MODEL_ID },
    { x: -7453.182, y:  -753.676, z: -2518.711, modelId: DP_WHITE_MUSHROOM_MODEL_ID },
    { x: -7534.696, y:  -749.640, z: -2492.357, modelId: DP_WHITE_MUSHROOM_MODEL_ID },
    { x: -8127.444, y: -1088.787, z: -2391.379, modelId: DP_WHITE_MUSHROOM_MODEL_ID },
    { x: -7887.835, y: -1078.943, z: -1482.126, modelId: DP_WHITE_MUSHROOM_MODEL_ID },
    { x: -7956.994, y: -1075.692, z: -1652.777, modelId: DP_WHITE_MUSHROOM_MODEL_ID },
];

function dpPosNear(a: number, b: number, eps: number = 2.0): boolean {
    return Math.abs(a - b) <= eps;
}

function dpFindPositionVariantOverrideXYZ(x: number, y: number, z: number): DPPositionVariantOverride | null {
    for (const o of DP_POSITION_VARIANT_OVERRIDES) {
        const eps = o.eps ?? 2.0;
        if (
            dpPosNear(x, o.x, eps) &&
            dpPosNear(y, o.y, eps) &&
            dpPosNear(z, o.z, eps)
        ) {
            return o;
        }
    }

    return null;
}



function dpExtractModelNumsByPtrCount(objBin: DataView, startOffs: number, defSize: number): number[] {
    // DP format:
    if (defSize < 0x58) return [];

    const count = objBin.getUint8(startOffs + 0x54);
    if (count === 0 || count > 32) return [];

    const listOffs = objBin.getUint32(startOffs + 0x08);
    if (listOffs === 0xFFFFFFFF || listOffs >= defSize) return [];

    const out: number[] = [];
    const base = startOffs + listOffs;

    for (let i = 0; i < count; i++) {
        const o = base + i * 4;
        if (o + 4 > startOffs + defSize) break;

        const v = objBin.getUint32(o);
        if (v === 0 || v === 0xFFFFFFFF) break;

        if (v < 0x4000) out.push(v | 0);
    }

    const uniq: number[] = [];
    for (const v of out) if (!uniq.includes(v)) uniq.push(v);
    return uniq;
}
function applyDPObjectManagerPatch(objectManager: ObjectManager, objTab: DataView, objBin: DataView, objIdx: DataView, modelInd: DataView | null) {
    const origGetObjectType = objectManager.getObjectType.bind(objectManager);
      const romToScn = buildRomToScnMap(objIdx);
const dpMaxRomType = (() => {
    const count = (objTab.byteLength / 4) | 0;
    for (let i = 0; i < count; i++) {
        if (objTab.getUint32(i * 4) === 0xFFFFFFFF)
            return i - 1;
    }
    return count - 1;
})();
    (objectManager as any)._dpRomToScn = romToScn;
    objectManager.getObjectType = function (typeNum: number, skipObjindex: boolean = false) {
        
let realType = typeNum;

if (!skipObjindex) {
    if (typeNum * 2 + 2 <= objIdx.byteLength) {
        const translated = objIdx.getUint16(typeNum * 2);

        if (translated !== 0xFFFF && translated <= dpMaxRomType) {
            realType = translated;
        } else {
            if (typeNum > dpMaxRomType)
                realType = 0;
        }
    } else {
        // Out of OBJINDEX range entirely
        if (typeNum > dpMaxRomType)
            realType = 0;
    }
}

        const objType = origGetObjectType(realType, true);
                (objType as any)._dpRomId = realType;
        // --- DP DEV OBJECT TAGGING ---
const DEV_TYPE_IDS = new Set<number>([
    0x004C, 0x00EC, 0x024F, 0x0157, 0x00D4, 0x01CA, 0x0006, 0x0008, 0x000D, 0x000E,0x000F,
    0x0014, 0x0015, 0x001E, 0x0026, 0x002C,0x0037, 0x003E, 0x003F, 0x0046,
     0x0053, 0x0058, 0x0060, 0x0066, 0x0070, 0x0075, 0x007B, 0x00A0,0x00A7, 0x00DD,
     0x0130, 0x0133, 0x0160, 0x019B, 0x01A0, 0x01B3, 0x01F1, 0x0222, 0x022C, 0x024F,
     0x0263, 0x0265, 0x027E, 0x02C3, 0x02E3, 0x02F0, 0x032F, 0x0331, 0x0349, 0x0354, 0x035E,
     0x0377, 0x0384, 0x0386, 0x039E, 0x03B6, 0x03F0, 0x0432, 0x0437, 0x047A, 0x04A8,
     0x04BD, 0x04C0, 0x04C6, 0x04E7, 0x054F, 0x0572,  0x058D, 0x059A, 0x054E, 0x55D, 0x01F3,
     0x0264, 0x0174, 0x017A, 0x0177, 0x0142,0x0435,0x0436, 0x04D2, 0x04E9, 0x0044, 0x046D, 0x0471,
     0x0368, 0x02C3, 0x03E9, 0x0540,0x055A,0x055C, 0x045B,0x280, 0x00A3, 0x179,0x577, 0x578, 0x518,
     0x336, 0x517, 0x048D, 0x0499, 0x01C7, 0x1CD,0x1CDF,0x1D8, 0x1D9, 0x05AC,0x36B,0x01CE,0x030,
     0x03EE, 0x036F, 0x0402, 0x38B, 0x04D6,0x02E,0x079, 0x07A,0x07F,0x061,0x062,0x032,0x026C,
     0x03C,0x000C,0x0258,0x0296,0x0A6,0x029,0x2AD,0x084, 
]);

const DEV_MODEL_IDS = new Set<number>([

]);

const scnId = typeNum & 0xFFFF;

if (DEV_TYPE_IDS.has(scnId))
    (objType as any).isDevObject = true;

                for (const m of objType.modelNums) {
                    if (DEV_MODEL_IDS.has(m | 0)) {
                        (objType as any).isDevObject = true;
                        break;
                    }
                }
        if (!(objType as any)._dpTranslated) {
            if (realType * 4 + 8 <= objTab.byteLength) {
const startOffs = objTab.getUint32(realType * 4);

let nextOffs = 0xFFFFFFFF;
if ((realType + 1) * 4 + 4 <= objTab.byteLength)
    nextOffs = objTab.getUint32((realType + 1) * 4);

let defSize = 0;

if (startOffs === 0xFFFFFFFF || startOffs >= objBin.byteLength) {
    objType.scale = 1.0;
    objType.modelNums = [];
if (!(objType as any)._dpNameFixed) {
    let nm = '';
    const base = startOffs + 0x60;
    if (base < objBin.byteLength) {
        for (let o = base; o < objBin.byteLength; o++) {
            const c = objBin.getUint8(o);
            if (c === 0) break;
            if (c >= 0x20 && c <= 0x7E)
                nm += String.fromCharCode(c);
        }
    }

    if (nm.length) {
        objType.name = nm;

        const lo = nm.toLowerCase();
        if (lo.includes('background') || lo.includes('backgroun'))
            (objType as any).isDevObject = true;
    }

    (objType as any)._dpNameFixed = true;
}
    nextOffs = startOffs; 
} else {
    if (nextOffs === 0xFFFFFFFF || nextOffs > objBin.byteLength || nextOffs < startOffs)
        nextOffs = objBin.byteLength;

    defSize = nextOffs - startOffs;

    const rawScale = objBin.getFloat32(startOffs + 0x04);
    objType.scale = (Number.isFinite(rawScale) && rawScale > 0.0 && rawScale <= 10.0) ? rawScale : 1.0;

    objType.modelNums = [];
}
                
                let dll_id = objBin.getUint16(startOffs + 0x58), objClass = dll_id;
                if (dll_id >= 0x8000) objClass = (dll_id - 0x8000) + 209;
                else if (dll_id >= 0x2000) objClass = (dll_id - 0x2000) + 186;
                else if (dll_id >= 0x1000) objClass = (dll_id - 0x1000) + 104;
                objType.objClass = objClass;

objType.modelNums = [];

let models = dpExtractModelNumsByPtrCount(objBin, startOffs, defSize);
if (models.length === 0)
    models = dpExtractModelNums(objBin, startOffs, defSize);

for (const m of models)
    objType.modelNums.push(m);

                if (objType.modelNums.length === 0) {
                    for (let i = 2; i <= 12; i += 2) {
                        const val = objBin.getUint16(nextOffs - i);
                        if (val >= 3 && val < 0x4000 && val !== 0xFFFF) {
                            objType.modelNums.push(val);
                            break;
                        }
                    }
                }
            }
            (objType as any)._dpTranslated = true;
        }
        return objType;
    };

const origCreate = (objectManager as any).createObjectInstance?.bind(objectManager);
if (origCreate) {
    (objectManager as any).createObjectInstance = function(typeNum: number, objParams: DataView, pos: any, mountNow: boolean) {
        const ot = (this as any).getObjectType(typeNum, false);
        const models: number[] = (ot as any).modelNums ?? [];


const rId = ((ot as any)._dpRomId ?? -1) & 0xFFFF;

        const romId: number | undefined = (ot as any)._dpRomId;
        const romToScn: Map<number, number[]> | undefined = (this as any)._dpRomToScn;
        if (romId !== undefined && romToScn && models.length > 1) {
            const scnList = romToScn.get(romId);
            if (scnList) {
                const idx = scnList.indexOf(typeNum);
                if (idx >= 0 && idx < models.length && idx !== 0) {
                    const tmp = models[0];
                    models[0] = models[idx];
                    models[idx] = tmp;
                    try {
                        return origCreate(typeNum, objParams, pos, mountNow);
                    } catch(e) {
                    } finally {
                        models[idx] = models[0];
                        models[0] = tmp;
                    }
                }
            }
        }

        try {
            return origCreate(typeNum, objParams, pos, mountNow);
        } catch (e) {
            const mf = (this as any).world?.resColl?.modelFetcher;
            const modelId = (models[0] ?? 0) | 0;
            const modelInst = mf?.createModelInstance ? mf.createModelInstance(modelId) : undefined;
            return {
                objType: ot,
                modelInst,
                position: vec3.create(),
                yaw: 0,
                mount() {},
                destroy() {},
            } as any;
        }    
    };
}

}
export class PreloadingDPModelFetcher {
    private cache = new Map<number, Model>();
    private modelInd: DataView | null = null;
    private dummyModelInst: ModelInstance;

public constructor(private gameInfo: GameInfo, private dataFetcher: DataFetcher, private texFetcher: TextureFetcher, private materialFactory: MaterialFactory) {
        const dummyModel = new Model(ModelVersion.DinosaurPlanet);
        dummyModel.hasFineSkinning = false;
        dummyModel.sharedModelShapes = new ModelShapes(dummyModel, new DataView(new ArrayBuffer(0)));
        this.dummyModelInst = new ModelInstance(dummyModel);
        
        (this.dummyModelInst as any).setAmap = () => { };
        (this.dummyModelInst as any).getAmap = () => null;
    }

    public async init() {
        try {
            const buffer = await this.dataFetcher.fetchData(`${this.gameInfo.pathBase}/MODELIND.bin`, { allow404: true });
            this.modelInd = buffer.createDataView();
        } catch (e) { }
    }

private getRealModelId(rawIndex: number): number {
        let index = rawIndex | 0; if (index < 0) index = -index;
        return index; 
    
     
    }

    public async preloadModels(modelIndices: number[]) {
        const promises = modelIndices.map(async rawIndex => {
            if (rawIndex === undefined || rawIndex === 0 || rawIndex === 0xFFFF || rawIndex === -1) return;
            const realId = this.getRealModelId(rawIndex);
            if (this.cache.has(realId)) return;
            try {
                const buffer = await this.dataFetcher.fetchData(`${this.gameInfo.pathBase}/uncompressed_models/${realId}.bin`, { allow404: true });
                if (buffer.byteLength > 0) {
                    this.cache.set(realId, loadModel(buffer.createDataView(), this.texFetcher, this.materialFactory, ModelVersion.DinosaurPlanet));
                }
            } catch (e) { }
        });
        await Promise.all(promises);
    }

public createModelInstance(rawIndex: number): ModelInstance {
        const realId = this.getRealModelId(rawIndex);
        const model = this.cache.get(realId);
        
        const inst = model ? new ModelInstance(model) : new ModelInstance(this.dummyModelInst.model);
        
        if (!(inst as any).amap) {
            (inst as any).amap = new DataView(new ArrayBuffer(0));
        }
        
        if (typeof (inst as any).setAmap !== 'function') (inst as any).setAmap = () => { };
        if (typeof (inst as any).getAmap !== 'function') (inst as any).getAmap = () => new DataView(new ArrayBuffer(64));
        
        return inst;
    }
}
interface BlockIter {
    x: number;
    z: number;
    block: ModelInstance;
}

const scratchMtx0 = mat4.create();
const scratchObjMtx0 = mat4.create();
const scratchVec3a = vec3.create();

function dpHex(v: number, width: number = 4): string {
    return (v >>> 0).toString(16).padStart(width, '0');
}
async function loadDPExternalObjectNames(
    dataFetcher: DataFetcher,
    gameInfo: GameInfo,
): Promise<Map<number, string>> {
    const out = new Map<number, string>();

    try {
        const buf = await dataFetcher.fetchData(`${gameInfo.pathBase}/DPObjects2.txt`, { allow404: true });
        const text = new TextDecoder('utf-8').decode(buf.arrayBuffer as ArrayBuffer);

        const lines = text.split(/\r?\n/);
        for (const line of lines) {
            const s = line.trim();
            if (!s) continue;

            const parts = s.split(/\s+/);
            if (parts.length < 3) continue;

            const idHex = parts[0];
            const id = Number.parseInt(idHex, 16);
            if (!Number.isFinite(id)) continue;
            if (out.has(id)) continue; // keep first entry only

            const name = parts.slice(2).join(' ').trim();
            if (!name) continue;

            out.set(id & 0xFFFF, name);
        }
    } catch (e) {
        console.warn('Failed to load DPObjects2.txt', e);
    }

    return out;
}
function getModelDebugMaterials(modelInst: ModelInstance | undefined): any[] {
    return (((modelInst as any)?.model as any)?.debugMaterialInfo ?? []) as any[];
}

function getFirstDebugTexId(modelInst: ModelInstance | undefined): number | null {
    const mats = getModelDebugMaterials(modelInst);
    for (const m of mats) {
        const ids: number[] = Array.isArray(m?.texIds)
            ? m.texIds
            : (typeof m?.texId === 'number' ? [m.texId] : []);
        for (const id of ids) {
            if (typeof id === 'number' && id >= 0)
                return id | 0;
        }
    }
    return null;
}
function getModelDebugTriangleCount(modelInst: ModelInstance | undefined): number | null {
    const mats = getModelDebugMaterials(modelInst);
    let total = 0;
    let found = false;

    for (const m of mats) {
        if (typeof m?.triCount === 'number' && Number.isFinite(m.triCount)) {
            total += (m.triCount | 0);
            found = true;
        }
    }

    return found ? total : null;
}
function getClipFromWorldMatrix(viewerInput: Viewer.ViewerRenderInput): mat4 | null {
    const cam: any = viewerInput.camera;
    if (cam?.clipFromWorldMatrix)
        return cam.clipFromWorldMatrix as mat4;
    if (cam?.viewProjectionMatrix)
        return cam.viewProjectionMatrix as mat4;
    return null;
}

function projectWorldToCanvas(
    clipFromWorld: mat4,
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
    z: number,
): { x: number; y: number; depth: number } | null {
    const cx = clipFromWorld[0] * x + clipFromWorld[4] * y + clipFromWorld[8]  * z + clipFromWorld[12];
    const cy = clipFromWorld[1] * x + clipFromWorld[5] * y + clipFromWorld[9]  * z + clipFromWorld[13];
    const cz = clipFromWorld[2] * x + clipFromWorld[6] * y + clipFromWorld[10] * z + clipFromWorld[14];
    const cw = clipFromWorld[3] * x + clipFromWorld[7] * y + clipFromWorld[11] * z + clipFromWorld[15];

    if (cw <= 0.0001)
        return null;

    const ndcX = cx / cw;
    const ndcY = cy / cw;
    const ndcZ = cz / cw;

    if (ndcX < -1.2 || ndcX > 1.2 || ndcY < -1.2 || ndcY > 1.2 || ndcZ < -1.2 || ndcZ > 1.2)
        return null;

    return {
        x: (ndcX * 0.5 + 0.5) * canvas.width,
        y: (-ndcY * 0.5 + 0.5) * canvas.height,
        depth: ndcZ,
    };
}
export class MapInstance {
    public setBlockFetcher(blockFetcher: BlockFetcher) {
        this.blockFetcher = blockFetcher;
    }
    private matrix: mat4 = mat4.create(); // map-to-world
    private invMatrix: mat4 = mat4.create(); // world-to-map
    private numRows: number;
    private numCols: number;
    private blockInfoTable: (BlockInfo | null)[][] = []; // Addressed by blockInfoTable[z][x]
    private blocks: (ModelInstance | null)[][] = []; // Addressed by blocks[z][x]
    public objects: ObjectInstance[] = []; // NEW: Array to store character and prop models

    constructor(public info: MapSceneInfo, private blockFetcher: BlockFetcher, public mapOpts?: MapInstanceOptions, public world?: World) {
        this.numRows = info.getNumRows();
        this.numCols = info.getNumCols();

        for (let y = 0; y < this.numRows; y++) {
            const row: (BlockInfo | null)[] = [];
            for (let x = 0; x < this.numCols; x++) {
                row.push(info.getBlockInfoAt(x, y));
            }
            this.blockInfoTable.push(row);
        }

        // --- Dinosaur Planet Object Spawner ---
        if (this.mapOpts?.objectManager && this.info.getObjectsData) {
            const objData = this.info.getObjectsData();
            if (objData) {
                const globalOffsetX = (this.mapOpts as any).globalOffsetX || 0;
                const globalOffsetZ = (this.mapOpts as any).globalOffsetZ || 0;

                const [ox, oz] = this.info.getOrigin();

                let offset = 0;
                while (offset < objData.byteLength) {
                    const size = objData.getUint8(offset + 2) * 4;
                    if (size === 0) break;

const objParams = dataSubarray(objData, offset, size);
                    try {
                        const typeNum = objParams.getUint16(0);
                        const objInst = this.mapOpts.objectManager.createObjectInstance(typeNum, objParams, [0, 0, 0], false);
                        
                        (objInst as any)._dpTypeNum = typeNum;
                        (objInst as any)._dpRawParams = objParams;
                        const trueX = objParams.byteLength >= 0x0C ? objParams.getFloat32(0x08) : 0;
                        const trueY = objParams.byteLength >= 0x10 ? objParams.getFloat32(0x0C) : 0;
                        const trueZ = objParams.byteLength >= 0x14 ? objParams.getFloat32(0x10) : 0;
const otDbg = this.mapOpts.objectManager.getObjectType(typeNum, false);
const rIdDbg = ((otDbg as any)._dpRomId ?? -1) & 0xFFFF;

const extNameMap: Map<number, string> | undefined =
    (this.mapOpts.objectManager as any)._dpExternalNameMap;

const extName = extNameMap?.get(typeNum & 0xFFFF) ?? '';
const fallbackName = String((otDbg as any).name ?? (otDbg as any).objName ?? '');
const nameDbg = extName || fallbackName;

const cleanNameDbg = (nameDbg && nameDbg !== 'NULL') ? nameDbg : '';
const forcedName = DP_LABEL_NAME_OVERRIDES[typeNum & 0xFFFF];
(objInst as any)._dpLabelName = forcedName ?? cleanNameDbg;
const modelDbg = ((otDbg as any).modelNums ?? []).map((n: number) => `0x${n.toString(16)}`).join(', ');
const dbgCount = ((window as any).__dpDbgCount ?? 0);

if (dbgCount < 300) {
    (window as any).__dpDbgCount = dbgCount + 1;

    const u16_00 = objParams.byteLength >= 0x02 ? objParams.getUint16(0x00) : 0;
    const u16_02 = objParams.byteLength >= 0x04 ? objParams.getUint16(0x02) : 0;
    const u16_04 = objParams.byteLength >= 0x06 ? objParams.getUint16(0x04) : 0;
    const u16_06 = objParams.byteLength >= 0x08 ? objParams.getUint16(0x06) : 0;
    const u16_18 = objParams.byteLength >= 0x1A ? objParams.getUint16(0x18) : 0;
    const u16_1A = objParams.byteLength >= 0x1C ? objParams.getUint16(0x1A) : 0;

    console.warn(
       // `[DP OBJ] off=0x${offset.toString(16)} scn=0x${typeNum.toString(16)} rom=0x${rIdDbg.toString(16)} name=${nameDbg} raw=(${trueX.toFixed(3)}, ${trueY.toFixed(3)}, ${trueZ.toFixed(3)}) world=(${(trueX + ox * 640).toFixed(3)}, ${trueY.toFixed(3)}, ${(trueZ + oz * 640).toFixed(3)}) u00=0x${u16_00.toString(16)} u02=0x${u16_02.toString(16)} u04=0x${u16_04.toString(16)} u06=0x${u16_06.toString(16)} u18=0x${u16_18.toString(16)} u1A=0x${u16_1A.toString(16)} models=[${modelDbg}]`
    );
}
                        objInst.position[0] = trueX + (ox * 640) - globalOffsetX;
                        objInst.position[1] = trueY;
                        objInst.position[2] = trueZ + (oz * 640) - globalOffsetZ;
                        const otForDev = this.mapOpts.objectManager.getObjectType(typeNum, false);
const devName = String(otForDev?.name ?? '').toLowerCase();
                        (objInst as any)._isDevDP = 
                            !!otForDev?.isDevObject || 
                            (typeNum !== undefined && DP_DEV_TYPE_NUMS.has(typeNum)) || 
                            DP_DEV_NAME_KEYWORDS.some((k) => devName.includes(k));
{

}
                        // --- DP ROTATION FIX ---
                        let yawU = objParams.byteLength >= 0x08 ? objParams.getUint16(0x06) : 0;

                        if (objParams.byteLength >= 0x1A) {
                            const flags = objParams.getUint16(0x04);
                            const altYaw18 = objParams.getUint16(0x18);
                            const altYaw1A = objParams.byteLength >= 0x1C ? objParams.getUint16(0x1A) : 0;
                            const altYaw1C = objParams.byteLength >= 0x1E ? objParams.getUint16(0x1C) : 0;
                            const altYaw28 = objParams.byteLength >= 0x14 ? objParams.getUint16(0x12) : 0;
                            const altYaw10 = objParams.byteLength >= 0x14 ? objParams.getUint16(0x10) : 0;

                            const TYPES_YAW_28 = new Set([0x0251, 0x03AF,0x0281, 0x007E, 0x04D9, 0x0011,0x0292, 0x0527,0x050C]);
                            const TYPES_YAW_10 = new Set([0x0409,]);
                            const TYPES_YAW_1C = new Set([0x01D3,0x0089, 0x057E,]);
                            const TYPES_YAW_1A = new Set([0x01CC, 0x0439,0x00D0,0x050D,0x0520,0x051F,]);
                            const TYPES_YAW_18 = new Set([
                                0x04F9, 0x0501, 0x04De, 0x042e, 0x0450, 0x0497, 0x0178, 
                                0x04F8, 0x0513, 0x046D, 0x0472, 0x0489, 0x048A, 0x046B, 
                                0x04B0, 0x0181, 0x0349, 0x0485, 0x0426, 0x0160, 0x04A8, 
                                0x04E9, 0x0435, 0x0436, 0x0486, 0x0475, 0x0490, 0x042D,0x04E6,
                                0x04E0, 0x04BF, 0x04B5, 0x0144, 0x0275,0x015D, 0x037A, 0x00E6,
                                0x00B7, 0x0575, 0x00CE, 0x0051, 0x00A5, 0x0529, 0x0528, 0x050E,
                                0x0515, 0x0131, 0x048C, 0x0487,
                            ]);

                            if (TYPES_YAW_28.has(typeNum)) {
                                yawU = altYaw28;
                            } else if (TYPES_YAW_1C.has(typeNum)) {
                                yawU = altYaw1C;
                            } else if (TYPES_YAW_1A.has(typeNum)) {
                                yawU = altYaw1A;
                            } else if (TYPES_YAW_18.has(typeNum)) {
                                yawU = altYaw18;
                            } else if (TYPES_YAW_10.has(typeNum)) {
                                yawU = altYaw10;
                            } else {
                                const hi = yawU >> 8;
                                const lo = yawU & 0xFF;
                                const isDummyYaw = (hi === lo && hi !== 0) || 
                                                   (hi === 0x64 || hi === 0x5A || hi === 0x2A) ||
                                                   (yawU === 0x06CD || yawU === 0x0632);
                                                   
                                if (isDummyYaw || ((flags & 0x1000) !== 0 && altYaw18 !== 0 && altYaw18 !== 0xFFFF && yawU < 0x1000)) {
                                    yawU = altYaw18;
                                }
                            }
                        }

                        objInst.yaw = (yawU === 0xFFFF) ? 0 : (yawU / 0x10000) * (Math.PI * 2);
                        
                        // --- DP SCALE FIX ---
                        const ot = this.mapOpts.objectManager.getObjectType(typeNum, false);
                        const baseS = (ot as any).scale ?? 1.0;
                        const mult  = dpGetScaleMultiplier(typeNum, ot);
                        const s     = dpClampScale(baseS * mult);

(objInst as any)._dpScale = s;

objInst.mount();
{function dpNear(a: number, b: number, eps: number = 2.0): boolean {
    return Math.abs(a - b) <= eps;
}
  {
    const mf = (this.mapOpts.objectManager as any).world?.resColl?.modelFetcher;
    const romId = ((ot as any)._dpRomId ?? -1) & 0xFFFF;

if (mf?.createModelInstance) {
    // Mushrooms: default BLUE
    if (romId === 0x0238) {
        const u1A = objParams.byteLength >= 0x1C ? objParams.getUint16(0x1A) : 0;

        const WHITE_SHROOM_U1A = new Set<number>([
            0x0464, 0x0462, 0x0463, 0x0460, 0x0013, 0x0461, 0x00F5, 0x015C, 0x0177, 0x00F4,
        ]);

        const modelId = WHITE_SHROOM_U1A.has(u1A) ? 0x00B3 : 0x00B2;
        (objInst as any).modelInst = mf.createModelInstance(modelId);
    }

    if (romId === 0x0109) {
        const u18 = objParams.byteLength >= 0x1A ? objParams.getUint16(0x18) : 0;
        const modelId = (u18 === 0x7F01) ? 0x03B6 : 0x03B5;
        (objInst as any).modelInst = mf.createModelInstance(modelId);
    }

    if (romId === 0x0111) {
        const u1A = objParams.byteLength >= 0x1C ? objParams.getUint16(0x1A) : 0;
        const modelId = (u1A === 0x0500) ? 0x03BC : 0x03BB;
        (objInst as any).modelInst = mf.createModelInstance(modelId);
    }

    if (romId === 0x0108) {
        const u18 = objParams.byteLength >= 0x1A ? objParams.getUint16(0x18) : 0;
        const modelId = (u18 === 0x0000) ? 0x03B1 : 0x03B2;
        (objInst as any).modelInst = mf.createModelInstance(modelId);
    }

if (romId === 0x0118) { // WCPushBlock
    const u06 = objParams.byteLength >= 0x08 ? objParams.getUint16(0x06) : 0;
    const modelId = (u06 === 0x0364) ? 0x03B7 : 0x03B8;
    (objInst as any).modelInst = mf.createModelInstance(modelId);

    }
    if (romId === 0x011F) { // WCTempleDial
    const u06 = objParams.byteLength >= 0x08 ? objParams.getUint16(0x06) : 0;
    const modelId = (u06 === 0x0896) ? 0x03C6 : 0x03C7;

    (objInst as any).modelInst = mf.createModelInstance(modelId);
}
if (romId === 0x0119) { // WCTile
    const u06 = objParams.byteLength >= 0x08 ? objParams.getUint16(0x06) : 0;
    const modelId = (u06 === 0x0364) ? 0x03BA : 0x03B9;
    (objInst as any).modelInst = mf.createModelInstance(modelId);

}

}


        
    }
}
{
    const posOverride = dpFindPositionVariantOverrideXYZ(
        objInst.position[0],
        objInst.position[1],
        objInst.position[2],
    );

    if (posOverride) {
        const mf = (this.mapOpts.objectManager as any).world?.resColl?.modelFetcher;
        if (mf?.createModelInstance) {
            (objInst as any).modelInst = mf.createModelInstance(posOverride.modelId);
            console.log(
              //  `[DP OVERRIDE] ${objInst.position[0].toFixed(3)}, ${objInst.position[1].toFixed(3)}, ${objInst.position[2].toFixed(3)} -> model 0x${posOverride.modelId.toString(16)}`
            );
        }
    }
}

this.objects.push(objInst);
                        
                    } catch (e) {
                      //  console.error(`Failed to place DP object at offset ${offset}:`, e);
                    }
                    offset += size;
                }
            }
        }
    }
    
    public clearBlocks() {
        this.blocks = [];
    }

    public setMatrix(matrix: mat4) {
        mat4.copy(this.matrix, matrix);
        mat4.invert(this.invMatrix, matrix);
    }

    public getNumDrawSteps(): number {
        return 3;
    }

    public* iterateBlocks(): Generator<BlockIter, void> {
        for (let z = 0; z < this.blocks.length; z++) {
            const row = this.blocks[z];
            for (let x = 0; x < row.length; x++) {
                if (row[x] !== null) {
                    yield { x, z, block: row[x]! };
                }
            }
        }
    }

    public getBlockAtPosition(x: number, z: number): ModelInstance | null {
        const bx = Math.floor(x / 640);
        const bz = Math.floor(z / 640);
        const block = this.blocks[bz][bx];
        return block === undefined ? null : block;
    }
public getObjectWorldPosition(obj: ObjectInstance, dst: vec3 = vec3.create()): vec3 {
    const x = obj.position[0];
    const y = obj.position[1];
    const z = obj.position[2];

    dst[0] = this.matrix[0] * x + this.matrix[4] * y + this.matrix[8]  * z + this.matrix[12];
    dst[1] = this.matrix[1] * x + this.matrix[5] * y + this.matrix[9]  * z + this.matrix[13];
    dst[2] = this.matrix[2] * x + this.matrix[6] * y + this.matrix[10] * z + this.matrix[14];
    return dst;
}
    public addRenderInsts(
        device: GfxDevice,
        renderInstManager: GfxRenderInstManager,
        renderLists: SFARenderLists,
        modelCtx: ModelRenderContext,
        lodStride: number = 1,
    ) {
        const prevCull = modelCtx.cullByAabb;
        if (prevCull === undefined)
            modelCtx.cullByAabb = false;

        for (let b of this.iterateBlocks()) {
            if (lodStride > 1 && ((b.x % lodStride) !== 0 || (b.z % lodStride) !== 0))
                continue;

            mat4.fromTranslation(scratchMtx0, [640 * b.x, 0, 640 * b.z]);
            mat4.mul(scratchMtx0, this.matrix, scratchMtx0);
            b.block.addRenderInsts(device, renderInstManager, modelCtx, renderLists, scratchMtx0);
        }

        const showAllObjects = (modelCtx as any).showAllObjects !== false;
        if (showAllObjects) {
for (let obj of this.objects) {
                // Use the pre-calculated flag to save CPU cycles
                if ((obj as any)._isDevDP && !(modelCtx as any).showDevObjects)
                    continue;

                const mi = (obj as any).modelInst as ModelInstance | undefined;
                if (!mi) {
                    obj.addRenderInsts(device, renderInstManager, renderLists, modelCtx as any);
                    continue;
                }

                const s = (obj as any)._dpScale ?? 1.0;

                mat4.fromTranslation(scratchObjMtx0, obj.position);
                mat4.rotateY(scratchObjMtx0, scratchObjMtx0, obj.yaw);
                if (s !== 1.0) mat4.scale(scratchObjMtx0, scratchObjMtx0, [s, s, s]);

                mat4.mul(scratchObjMtx0, this.matrix, scratchObjMtx0);

                mi.addRenderInsts(device, renderInstManager, modelCtx as any, renderLists, scratchObjMtx0);
            }
        }

        modelCtx.cullByAabb = prevCull;
    }

    public update(viewerInput: Viewer.ViewerRenderInput) {
    }

    public async reloadBlocks(dataFetcher: DataFetcher) {
        this.clearBlocks();
        for (let z = 0; z < this.numRows; z++) {
            this.blocks[z] = new Array(this.numCols).fill(null);
        }

        const tasks: Promise<void>[] = [];
        for (let z = 0; z < this.numRows; z++) {
            for (let x = 0; x < this.numCols; x++) {
                const blockInfo = this.blockInfoTable[z][x];
                if (!blockInfo) continue;

                tasks.push(this.blockFetcher.fetchBlock(blockInfo.mod, blockInfo.sub, dataFetcher)
                    .then(model => {
                        this.blocks[z][x] = model ? new ModelInstance(model) : null;
                    })
                    .catch(() => {
                        this.blocks[z][x] = null;
                    }));
            }
        }
        await Promise.all(tasks);
    }

    public destroy(device: GfxDevice) {
        for (let row of this.blocks) {
            for (let model of row)
                model?.destroy(device);
        }
        for (let obj of this.objects) {
            obj.destroy(device);
        }
    }
}

export async function loadMap(gameInfo: GameInfo, dataFetcher: DataFetcher, mapNum: number): Promise<MapSceneInfo> {
    const pathBase = gameInfo.pathBase;
    const [mapsTab, mapsBin] = await Promise.all([
        dataFetcher.fetchData(`${pathBase}/MAPS.tab`),
        dataFetcher.fetchData(`${pathBase}/MAPS.bin`),
    ]);

    const mapInfo = getMapInfo(mapsTab.createDataView(), mapsBin.createDataView(), mapNum);
    const blockTable = getBlockTable(mapInfo);
return {
        getNumCols() { return mapInfo.blockCols; },
        getNumRows() { return mapInfo.blockRows; },
        getBlockInfoAt(col: number, row: number): BlockInfo | null {
            return blockTable[row][col];
        },
        getOrigin(): number[] {
            return [mapInfo.originX, mapInfo.originZ];
        },
        // ADD THIS BLOCK
        getObjectsData(): DataView | null {
            if (mapInfo.objectsOffset !== undefined && mapInfo.objectsSize !== undefined && mapInfo.objectsSize > 0) {
                return dataSubarray(mapInfo.mapsBin, mapInfo.objectsOffset, mapInfo.objectsSize);
            }
            return null;
        }
    };
}
function resolveMusicKey(mapNum: string | number): string {
    const key = String(mapNum);
if (key.startsWith('early1_') || key.startsWith('dup_')) {
        const num = Number(key.split('_')[1]);
        if ([31,32,33,34,39,40].includes(num))
            return 'Early_kraz_test';

        return String(num);
    }

    return key;
}

class MapSceneRenderer extends SFARenderer {
    public showDevObjects = false;
    public showAllObjects = true;
    public isDPMapScene = false;
    public mapNum: string | number = -1;
public textureHolder: UI.TextureListHolder = { viewerTextures: [], onnewtextures: null };
    private blockFetcherFactory?: () => Promise<BlockFetcher>;
    private map: MapInstance;
    private dataFetcher!: DataFetcher;
private currentGameInfo!: GameInfo;
private currentTexFetcher: any;
private pendingSkyRebuild = false;
private rebuildSky(texFetcher: any, gameInfo: GameInfo): void {
    if (!this.envfxMan) return;

    if (this.sky) {
        this.sky.destroy(this.context.device);
(this as any).sky = null;    }

    const fakeWorldForSky = {
        renderCache: (this.materialFactory as any).cache ?? (this.materialFactory as any).getCache?.(),
        gameInfo,
        envfxMan: this.envfxMan,
        worldLights: this.worldLights,
        resColl: { texFetcher },
        objectMan: { createObjectInstance: () => ({ destroy: () => {} }) },
    } as any;

    this.sky = new Sky(fakeWorldForSky);
}
    public envfxMan: EnvfxManager | null = null;
    public worldLights: WorldLights = new WorldLights();
    private timeSelect?: UI.Slider;
    private envSelect?: UI.Slider;
    private sky: Sky | null = null;
        public showObjectLabels = false;
    private selectedObject: ObjectInstance | null = null;
private projectedObjectLabels: Array<{
    obj: ObjectInstance;
    x: number;
    y: number;
    label: string;
    lines: string[];
    w: number;
    h: number;
}> = [];    private debugOverlayCanvas: HTMLCanvasElement | null = null;

    public clearSelectedDebugObject(): void {
        this.selectedObject = null;
    }

private debugMouseDownX = 0;
private debugMouseDownY = 0;
private debugMouseDownActive = false;

private pickDebugObjectAtClientPos(clientX: number, clientY: number): ObjectInstance | null {
    if (!this.showObjectLabels || this.projectedObjectLabels.length === 0)
        return null;

    const canvas = this.debugOverlayCanvas;
    if (!canvas)
        return null;

    const rect = canvas.getBoundingClientRect();
    const mx = (clientX - rect.left) * (canvas.width / rect.width);
    const my = (clientY - rect.top) * (canvas.height / rect.height);

    let best: { obj: ObjectInstance; score: number } | null = null;

    for (const e of this.projectedObjectLabels) {
        const dx = e.x - mx;
        const dy = e.y - my;
        const markerD2 = dx * dx + dy * dy;
        const hitMarker = markerD2 <= (18 * 18);

        const textX0 = e.x + 6;
        const textY0 = e.y - (e.h * 0.5) - 4;
        const textX1 = textX0 + e.w + 8;
        const textY1 = textY0 + e.h + 8;
        const hitText = mx >= textX0 && mx <= textX1 && my >= textY0 && my <= textY1;

        if (!hitMarker && !hitText)
            continue;

        const score = hitMarker ? markerD2 : 0;
        if (!best || score < best.score)
            best = { obj: e.obj, score };
    }

    return best ? best.obj : null;
}

private readonly onDebugOverlayMouseDown = (ev: MouseEvent) => {
    if (ev.button !== 0)
        return;

    this.debugMouseDownX = ev.clientX;
    this.debugMouseDownY = ev.clientY;
    this.debugMouseDownActive = true;
};

private readonly onDebugOverlayMouseUp = (ev: MouseEvent) => {
    if (ev.button !== 0)
        return;
    if (!this.debugMouseDownActive)
        return;

    this.debugMouseDownActive = false;

    const dx = ev.clientX - this.debugMouseDownX;
    const dy = ev.clientY - this.debugMouseDownY;
    if ((dx * dx + dy * dy) > (5 * 5))
        return;

    this.selectedObject = this.pickDebugObjectAtClientPos(ev.clientX, ev.clientY);
};

    private readonly onDebugOverlayContextMenu = (ev: MouseEvent) => {
        if (!this.selectedObject)
            return;
        ev.preventDefault();
        this.selectedObject = null;
    };

private installObjectDebugPicking(): void {
    if (this.debugOverlayCanvas)
        return;

    const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
    if (!ctx)
        return;

    this.debugOverlayCanvas = ctx.canvas;

    window.addEventListener('mousedown', this.onDebugOverlayMouseDown, true);
    window.addEventListener('mouseup', this.onDebugOverlayMouseUp, true);
    window.addEventListener('contextmenu', this.onDebugOverlayContextMenu, true);
}

private buildObjectDebugLines(obj: ObjectInstance): string[] {
    const typeNum = ((((obj as any)._dpTypeNum ?? -1) as number) & 0xFFFF);
    const ot = this.map.mapOpts?.objectManager?.getObjectType?.(typeNum, false);
    const romId = ((((ot as any)?._dpRomId ?? -1) as number) & 0xFFFF);

    const objName =
        String((obj as any)._dpLabelName ?? '').trim() ||
        String((ot as any)?.name ?? '').trim();

    const title =
        objName !== ''
            ? `Object 0x${dpHex(typeNum).toUpperCase()} ${objName}`
            : `Object 0x${dpHex(typeNum).toUpperCase()}`;

    const modelNums: number[] = Array.isArray((ot as any)?.modelNums) ? (ot as any).modelNums : [];
    const modelText = modelNums.length
        ? modelNums.slice(0, 6).map((n: number) => `0x${dpHex(n)}`).join(', ')
        : 'none';

    const mi = (obj as any).modelInst as ModelInstance | undefined;
    const mats = getModelDebugMaterials(mi);
    const triCount = getModelDebugTriangleCount(mi);
const activeModelId =
    (((mi as any)?.model as any)?.modelId ?? modelNums[0] ?? -1) as number;

const objClass =
    (((ot as any)?.objClass ?? -1) as number);

const scale =
    ((((obj as any)._dpScale ?? 1.0) as number));

const yawDeg =
    ((obj.yaw * 180 / Math.PI) % 360 + 360) % 360;

const rawParams =
    ((obj as any)._dpRawParams as DataView | undefined);
    const texIds: number[] = [];
    for (const m of mats) {
        const ids: number[] = Array.isArray(m?.texIds)
            ? m.texIds
            : (typeof m?.texId === 'number' ? [m.texId] : []);
        for (const id of ids) {
            if (typeof id === 'number' && id >= 0 && texIds.indexOf(id) < 0)
                texIds.push(id);
            if (texIds.length >= 8)
                break;
        }
        if (texIds.length >= 8)
            break;
    }

const lines: string[] = [
    title,
    `scn=0x${dpHex(typeNum).toUpperCase()} rom=0x${dpHex(romId).toUpperCase()} class=${objClass >= 0 ? objClass : 'n/a'}`,
    `activeModel=${activeModelId >= 0 ? `0x${dpHex(activeModelId).toUpperCase()}` : 'none'}`,
    `models=${modelText}`,
    `materials=${mats.length} scale=${scale.toFixed(3)} yaw=${yawDeg.toFixed(1)}°`,
    `textures=${texIds.length ? texIds.map((n) => `0x${dpHex(n).toUpperCase()}`).join(', ') : 'none'}`,
    `pos=(${obj.position[0].toFixed(1)}, ${obj.position[1].toFixed(1)}, ${obj.position[2].toFixed(1)})`,
];

    if (triCount !== null)
        lines.splice(4, 0, `tris=${triCount}`);
if (rawParams && rawParams.byteLength >= 0x1C) {
    lines.push(
        `u04=0x${rawParams.getUint16(0x04).toString(16)} u06=0x${rawParams.getUint16(0x06).toString(16)} u18=0x${rawParams.getUint16(0x18).toString(16)} u1A=0x${rawParams.getUint16(0x1A).toString(16)}`
    );
}
    for (let i = 0; i < Math.min(4, mats.length); i++) {
        const m = mats[i];
        const ids: number[] = Array.isArray(m?.texIds)
            ? m.texIds
            : (typeof m?.texId === 'number' ? [m.texId] : []);
        const flags = (((m?.flags ?? m?.renderFlags ?? 0) as number) >>> 0);
        lines.push(`mat${i}: tex=${ids.length ? ids.map((n) => `0x${dpHex(n)}`).join('/') : 'none'} flags=0x${flags.toString(16)}`);
    }

    return lines;
}

    private drawObjectDebugOverlay(viewerInput: Viewer.ViewerRenderInput): void {
        const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
        if (!ctx)
            return;

        const canvas = ctx.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.projectedObjectLabels = [];
        ctx.save();
        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        if (!this.isDPMapScene)
            return;
        if (!this.showObjectLabels && !this.selectedObject)
            return;

        const clipFromWorld = getClipFromWorldMatrix(viewerInput);
        if (!clipFromWorld)
            return;

        for (const obj of this.map.objects) {
            if ((obj as any)._isDevDP && !this.showDevObjects)
                continue;

            const mi = (obj as any).modelInst as ModelInstance | undefined;
            const firstTexId = getFirstDebugTexId(mi);
            const lines = this.buildObjectDebugLines(obj);
            const label = firstTexId !== null ? `${lines[0]} [tex 0x${dpHex(firstTexId)}]` : lines[0];

            const worldPos = this.map.getObjectWorldPosition(obj, scratchVec3a);
            const screen = projectWorldToCanvas(clipFromWorld, canvas, worldPos[0], worldPos[1] + 20, worldPos[2]);
            if (!screen)
                continue;

this.projectedObjectLabels.push({
    obj,
    x: screen.x,
    y: screen.y,
    label,
    lines,
    w: Math.ceil(ctx.measureText(label).width),
    h: 16,
});
        }

        if (this.showObjectLabels) {
            for (const e of this.projectedObjectLabels) {
                const selected = e.obj === this.selectedObject;

                ctx.beginPath();
                ctx.fillStyle = selected ? '#ffeb3b' : 'rgba(255,255,255,0.9)';
                ctx.arc(e.x, e.y, selected ? 4 : 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(0,0,0,0.85)';
                ctx.strokeText(e.label, e.x + 8, e.y);

                ctx.fillStyle = selected ? '#ffeb3b' : '#ffffff';
                ctx.fillText(e.label, e.x + 8, e.y);
            }
        }

        if (this.selectedObject) {
            const selectedEntry =
                this.projectedObjectLabels.find((e) => e.obj === this.selectedObject) ??
                { obj: this.selectedObject, x: 0, y: 0, label: '', lines: this.buildObjectDebugLines(this.selectedObject) };

            const lines = selectedEntry.lines;
            const lineH = 16;
            let boxW = 220;
            for (const line of lines)
                boxW = Math.max(boxW, Math.ceil(ctx.measureText(line).width) + 16);

            const boxH = 10 + lines.length * lineH + 8;
            const boxX = 8;
            const boxY = canvas.height - boxH - 8;

            ctx.fillStyle = 'rgba(0,0,0,0.78)';
            ctx.fillRect(boxX, boxY, boxW, boxH);

            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.strokeRect(boxX, boxY, boxW, boxH);

            for (let i = 0; i < lines.length; i++) {
                ctx.fillStyle = (i === 0) ? '#ffeb3b' : '#ffffff';
                ctx.fillText(lines[i], boxX + 8, boxY + 12 + i * lineH);
            }
        }

        ctx.restore();
    }
    private playMusic(mapNum: number) {
        const musicState = (window as any).musicState;
        if (musicState.audio) {
            musicState.audio.pause();
            musicState.audio.currentTime = 0;
            musicState.audio = null;
        }
        const resolvedKey = resolveMusicKey(mapNum);
        const track = MAP_MUSIC[resolvedKey];

        const FADE_TIME = 1000;
        const TARGET_VOLUME = 0.2;

        function fadeOut(audio: HTMLAudioElement, duration: number) {
            const step = 50;
            const delta = audio.volume / (duration / step);

            const interval = setInterval(() => {
                audio.volume = Math.max(0, audio.volume - delta);
                if (audio.volume <= 0) {
                    clearInterval(interval);
                    audio.pause();
                    audio.currentTime = 0;
                }
            }, step);
        }

        function fadeIn(audio: HTMLAudioElement, targetVolume: number, duration: number) {
            audio.volume = 0;
            const step = 50;
            const delta = targetVolume / (duration / step);

            const interval = setInterval(() => {
                audio.volume = Math.min(targetVolume, audio.volume + delta);
                if (audio.volume >= targetVolume)
                    clearInterval(interval);
            }, step);
        }

        if (!track) {
            if (musicState.audio)
                fadeOut(musicState.audio, FADE_TIME);
            return;
        }

        const newSrc = `data/audio/${track}`;

        if (!musicState.audio || !musicState.audio.src.includes(track)) {

            if (musicState.audio)
                fadeOut(musicState.audio, FADE_TIME);

            const newAudio = new Audio(newSrc);
            newAudio.loop = true;
            musicState.audio = newAudio;

            if (!musicState.muted) {
                newAudio.play().then(() => {
                    fadeIn(newAudio, TARGET_VOLUME, FADE_TIME);
                }).catch(() => {});
            }
        }
    }

    public setBlockFetcherFactory(factory: () => Promise<BlockFetcher>) {
        this.blockFetcherFactory = factory;
    }

    constructor(public context: SceneContext, animController: SFAAnimationController, materialFactory: MaterialFactory) {
        super(context, animController, materialFactory);
    }

    public async reloadForTextureToggle(): Promise<void> {
        if (!this.dataFetcher) return;
        if (this.blockFetcherFactory) {
            const fresh = await this.blockFetcherFactory();
            this.map.setBlockFetcher(fresh);
        }
        await this.map.reloadBlocks(this.dataFetcher);
    }

public async create(info: MapSceneInfo, gameInfo: GameInfo, dataFetcher: DataFetcher, blockFetcher: BlockFetcher, mapOpts?: MapInstanceOptions): Promise<Viewer.SceneGfx> {
    this.dataFetcher = dataFetcher; 
    this.isDPMapScene = !!mapOpts?.dpMapScene;
    this.map = new MapInstance(info, blockFetcher, mapOpts);

    if (this.isDPMapScene)
        this.installObjectDebugPicking();
        await this.map.reloadBlocks(dataFetcher);

        const texFetcher = (blockFetcher as any).texFetcher;
        this.currentGameInfo = gameInfo;
        this.currentTexFetcher = texFetcher;
        if (texFetcher?.textureHolder)
            this.textureHolder = texFetcher.textureHolder;

        if (this.envfxMan && !this.sky) {
            const fakeWorldForSky = {
                renderCache: (this.materialFactory as any).cache ?? (this.materialFactory as any).getCache?.(),
                gameInfo,
                envfxMan: this.envfxMan,
                worldLights: this.worldLights,
                resColl: { texFetcher },
                objectMan: { createObjectInstance: () => ({ destroy: () => {} }) },
            } as any;

            this.sky = new Sky(fakeWorldForSky);
        }
        if (this.envfxMan) {
            this.envfxMan.setTimeOfDay(DP_ENV_DEFAULT.timeOfDay);
            const r = (this.envfxMan as any).loadEnvfx(DP_ENV_DEFAULT.envfxIndex);
            if (r && typeof r.then === 'function') await r;
            this.rebuildSky(this.currentTexFetcher, this.currentGameInfo);
        }
        if ((this as any).mapNum !== undefined)
            this.playMusic((this as any).mapNum as number);

        return this;
    }



public createPanels(): UI.Panel[] {
    const panels: UI.Panel[] = [];



    if (this.envfxMan) {
        const envPanel = new UI.Panel();
        envPanel.setTitle(UI.TIME_OF_DAY_ICON, 'Environment');

this.timeSelect = new UI.Slider();
this.timeSelect.setLabel('Time of Day');
this.timeSelect.setRange(0, 7, 1);
this.timeSelect.setValue(DP_ENV_DEFAULT.timeOfDay);
this.timeSelect.onvalue = async (val) => {
  if (!this.envfxMan) return;
  this.envfxMan.setTimeOfDay(val);
  this.rebuildSky(this.currentTexFetcher, this.currentGameInfo);
};
envPanel.contents.append(this.timeSelect.elem);

this.envSelect = new UI.Slider();
this.envSelect.setLabel('EnvFx Index');
this.envSelect.setRange(0, 100, 1);
this.envSelect.setValue(DP_ENV_DEFAULT.envfxIndex);
this.envSelect.onvalue = async (val) => {
  if (!this.envfxMan) return;
  try {
    const r = (this.envfxMan as any).loadEnvfx(val);
    if (r && typeof r.then === 'function') await r;
  } catch (e) {
   // console.warn(`EnvFx load failed for index ${val}`, e);
  }
  this.rebuildSky(this.currentTexFetcher, this.currentGameInfo);
};
envPanel.contents.append(this.envSelect.elem);

        panels.push(envPanel);
    }

    return panels;
}

    public setMatrix(matrix: mat4) {
        this.map.setMatrix(matrix);
    }

protected override update(viewerInput: Viewer.ViewerRenderInput) {
    super.update(viewerInput);
    this.materialFactory.update(this.animController);

    if (this.envfxMan) {
        this.envfxMan.update(this.context.device, { viewerInput });
    }

    this.drawObjectDebugOverlay(viewerInput);
}


protected override addSkyRenderPasses(
    device: GfxDevice,
    builder: GfxrGraphBuilder,
    renderInstManager: GfxRenderInstManager,
    renderLists: SFARenderLists,
    mainColorTargetID: GfxrRenderTargetID,
    sceneCtx: SceneRenderContext
) {
    if (this.sky)
        this.sky.addSkyRenderPasses(
            device,
            this.renderHelper,
            builder,
            renderInstManager,
            renderLists,
            mainColorTargetID,
            this.mainDepthDesc,
            sceneCtx
        );
}
    protected override addWorldRenderInsts(device: GfxDevice, renderInstManager: GfxRenderInstManager, renderLists: SFARenderLists, sceneCtx: SceneRenderContext) {
        const template = renderInstManager.pushTemplateRenderInst();
        fillSceneParamsDataOnTemplate(template, sceneCtx.viewerInput);

        const scratchColor0 = colorNewFromRGBA(1, 1, 1, 1);
        if (this.envfxMan) {
            this.envfxMan.getAmbientColor(scratchColor0, 0);
        } else {
            colorCopy(scratchColor0, White);
        }

const forceHideDPObjectsInVR = this.isDPMapScene && !!sceneCtx.viewerInput.isVR;

const modelCtx = {
    sceneCtx,
    showDevGeometry: false,
    ambienceIdx: 0,
    showMeshes: true,
    outdoorAmbientColor: scratchColor0,
    setupLights: () => {},
    animController: this.animController,
    showDevObjects: this.showDevObjects,
    showAllObjects: this.showAllObjects && !forceHideDPObjectsInVR,
};

        this.map.addRenderInsts(device, renderInstManager, renderLists, modelCtx as any);
        renderInstManager.popTemplateRenderInst();
    }

public override destroy(device: GfxDevice) {
    if (this.isDPMapScene)
        cleanupDPUI();

    if (this.debugOverlayCanvas) {
        window.removeEventListener('mousedown', this.onDebugOverlayMouseDown, true);
        window.removeEventListener('mouseup', this.onDebugOverlayMouseUp, true);
        window.removeEventListener('contextmenu', this.onDebugOverlayContextMenu, true);
        this.debugOverlayCanvas = null;
    }

    super.destroy(device);
    if (this.sky) { this.sky.destroy(device); this.sky = null; }
    if (this.envfxMan) this.envfxMan.destroy(device);
    this.map.destroy(device);
}
}
function cleanupDPUI(): void {
    stopDPMPEGVoicePreview();

    document.getElementById('dp-mpeg-voice-ui')?.remove();
    document.getElementById('dp-mpeg-voice-toggle')?.remove();
    document.getElementById('dp-top-toggle-bar')?.remove();

    (window as any).__dpObjectsToggle = undefined;
    (window as any).__dpDevObjectsToggle = undefined;
    (window as any).__dpObjectLabelsToggle = undefined;
}
function cleanupTextureToggleUI(): void {
    const state = (window as any).__sfaTextureToggle as {
        wrap?: HTMLDivElement;
        cb?: HTMLInputElement;
        handler?: ((e: Event) => void) | null;
    } | undefined;

    if (state?.handler && state?.cb)
        state.cb.removeEventListener('change', state.handler);

    state?.wrap?.remove();
    (window as any).__sfaTextureToggle = undefined;
}

function getDPTopToggleBar(): HTMLDivElement {
    let bar = document.getElementById('dp-top-toggle-bar') as HTMLDivElement | null;

    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'dp-top-toggle-bar';
        bar.style.position = 'fixed';
        bar.style.top = '2px';
        bar.style.right = '2px';
        bar.style.zIndex = '10000';
        bar.style.display = 'flex';
        bar.style.alignItems = 'center';
        bar.style.gap = '4px';
        document.body.appendChild(bar);
    }

    return bar;
}


function ensureDPObjectsUI(
  onChange: (enabled: boolean) => void | Promise<void>,
  initial?: boolean
): void {
  type ToggleState = {
    wrap: HTMLDivElement;
    cb: HTMLInputElement;
    handler: ((e: Event) => void) | null;
    last?: boolean;
  };

  let state = (window as any).__dpObjectsToggle as ToggleState | undefined;

  if (!state) {
    const wrap = document.createElement('div');
 
    wrap.style.padding = '1px 3px';
    wrap.style.background = 'rgba(0,0,0,0.5)';
    wrap.style.color = '#fff';
    wrap.style.font = '11px sans-serif';
    wrap.style.borderRadius = '2px';
wrap.style.display = 'flex';
wrap.style.alignItems = 'center';
wrap.style.height = '20px';
wrap.style.boxSizing = 'border-box';
wrap.style.order = '2';
    const label = document.createElement('label');
    label.style.cursor = 'pointer';
label.style.display = 'flex';
label.style.alignItems = 'center';
label.style.lineHeight = '1';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.marginRight = '1px';

    label.appendChild(cb);
    label.appendChild(document.createTextNode('Objects'));
    wrap.appendChild(label);
getDPTopToggleBar().appendChild(wrap);
    state = { wrap, cb, handler: null, last: true };
    (window as any).__dpObjectsToggle = state;
  }

  if (state.handler) state.cb.removeEventListener('change', state.handler);

  const desired = (typeof initial === 'boolean') ? initial : (state.last ?? true);
  state.cb.checked = desired;

  state.handler = async () => {
    state!.last = state!.cb.checked;
    await onChange(state!.cb.checked);
  };

  state.cb.addEventListener('change', state.handler);
}

function ensureDPDevObjectsUI(
  onChange: (enabled: boolean) => void | Promise<void>,
  initial?: boolean
): void {
  type ToggleState = {
    wrap: HTMLDivElement;
    cb: HTMLInputElement;
    handler: ((e: Event) => void) | null;
    last?: boolean;
  };

  let state = (window as any).__dpDevObjectsToggle as ToggleState | undefined;

  if (!state) {
    const wrap = document.createElement('div');
    wrap.style.padding = '1px 3px';
    wrap.style.background = 'rgba(0,0,0,0.5)';
    wrap.style.color = '#fff';
    wrap.style.font = '11px sans-serif';
    wrap.style.borderRadius = '2px';
wrap.style.display = 'flex';
wrap.style.alignItems = 'center';
wrap.style.height = '20px';
wrap.style.boxSizing = 'border-box';
wrap.style.order = '3';
    const label = document.createElement('label');
    label.style.cursor = 'pointer';
label.style.display = 'flex';
label.style.alignItems = 'center';
label.style.lineHeight = '1';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.marginRight = '1px';

    label.appendChild(cb);
    label.appendChild(document.createTextNode('Dev objects'));
    wrap.appendChild(label);
getDPTopToggleBar().appendChild(wrap);
    state = { wrap, cb, handler: null, last: false };
    (window as any).__dpDevObjectsToggle = state;
  }

  if (state.handler) state.cb.removeEventListener('change', state.handler);

  const desired = (typeof initial === 'boolean') ? initial : (state.last ?? false);
  state.cb.checked = desired;

  state.handler = async () => {
    state!.last = state!.cb.checked;
    await onChange(state!.cb.checked);
  };

  state.cb.addEventListener('change', state.handler);
}

function ensureDPObjectLabelsUI(
  onChange: (enabled: boolean) => void | Promise<void>,
  initial?: boolean
): void {
  type ToggleState = {
    wrap: HTMLDivElement;
    cb: HTMLInputElement;
    handler: ((e: Event) => void) | null;
    last?: boolean;
  };

  let state = (window as any).__dpObjectLabelsToggle as ToggleState | undefined;

  if (!state) {
    const wrap = document.createElement('div');
    wrap.style.padding = '1px 3px';
    wrap.style.background = 'rgba(0,0,0,0.5)';
    wrap.style.color = '#fff';
    wrap.style.font = '11px sans-serif';
    wrap.style.borderRadius = '2px';
wrap.style.display = 'flex';
wrap.style.alignItems = 'center';
wrap.style.height = '20px';
wrap.style.boxSizing = 'border-box';
wrap.style.order = '4';
    const label = document.createElement('label');
    label.style.cursor = 'pointer';
label.style.display = 'flex';
label.style.alignItems = 'center';
label.style.lineHeight = '1';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.marginRight = '1px';

    label.appendChild(cb);
    label.appendChild(document.createTextNode('Object labels'));
    wrap.appendChild(label);
getDPTopToggleBar().appendChild(wrap);
    state = { wrap, cb, handler: null, last: false };
    (window as any).__dpObjectLabelsToggle = state;
  }

  if (state.handler)
    state.cb.removeEventListener('change', state.handler);

  const desired = (typeof initial === 'boolean') ? initial : (state.last ?? false);
  state.cb.checked = desired;

  state.handler = async () => {
    state!.last = state!.cb.checked;
    await onChange(state!.cb.checked);
  };

  state.cb.addEventListener('change', state.handler);
}
function ensureTextureToggleUI(
  onChange: (enabled: boolean) => void | Promise<void>,
  initial?: boolean
): void {
  type ToggleState = {
    wrap: HTMLDivElement;
    cb: HTMLInputElement;
    handler: ((e: Event) => void) | null;
    last?: boolean;
  };

  let state = (window as any).__sfaTextureToggle as ToggleState | undefined;

  if (!state) {
    const wrap = document.createElement('div');
    wrap.style.position = 'fixed';
    wrap.style.top = '2px';
    wrap.style.right = '2px';
    wrap.style.zIndex = '10000';
    wrap.style.padding = '2px 4px';
    wrap.style.background = 'rgba(0,0,0,0.5)';
    wrap.style.color = '#fff';
    wrap.style.font = '12px sans-serif';
    wrap.style.borderRadius = '2px';

    const label = document.createElement('label');
    label.style.cursor = 'pointer';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.marginRight = '2px';

    label.appendChild(cb);
    label.appendChild(document.createTextNode('Textures'));
    wrap.appendChild(label);
    document.body.appendChild(wrap);

    state = { wrap, cb, handler: null, last: true };
    (window as any).__sfaTextureToggle = state;
  }

  if (state.handler) state.cb.removeEventListener('change', state.handler);

  const desired = (typeof initial === 'boolean') ? initial : (state.last ?? true);
  state.cb.checked = desired;

  state.handler = async () => {
    try {
      state!.last = state!.cb.checked;
      await onChange(state!.cb.checked);
    } catch (e) {
    //  console.error('Texture toggle handler error:', e);
    }
  };
  state.cb.addEventListener('change', state.handler);
}


export class SFAMapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
    }

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
      const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

        console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);
        (window as any).__dpDbgCount = 0;
        const mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);

        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = this.mapNum;
        const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
        
        const blockFetcher = await SFABlockFetcher.create(this.gameInfo,context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher));
        await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
    
}


export class SwapcircleSceneDesc implements Viewer.SceneDesc {
  constructor(
    public mapNum: number,
    public id: string,
    public name: string,
    private gameInfo: GameInfo = SFADEMO_GAME_INFO
  ) {}

  public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
    const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

    console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

    const animController = new SFAAnimationController();
    const materialFactory = new MaterialFactory(device);

    const COLS = 4;
    const ROWS = 3;

    const allowedSubs = [19, 7, 8, 20, 0, 12, 13, 0, 0, 17, 18, 0];
    

    const mapSceneInfo: MapSceneInfo = {
      getNumCols() { return COLS; },
      getNumRows() { return ROWS; },
getBlockInfoAt(col: number, row: number): BlockInfo | null {
  const idx = (row * COLS + col) % allowedSubs.length;
  const sub = allowedSubs[idx];

  if (sub === 0)
    return null;

  return { mod: 22, sub };
},
      getOrigin(): number[] { return [0, 0]; },
    };

    const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
    mapRenderer.mapNum = -999; 
    const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, true);
    await texFetcher.loadSubdirs(['swapcircle'], context.dataFetcher);

    const blockFetcher = await SwapcircleBlockFetcher.create(
      this.gameInfo, context.dataFetcher, materialFactory, texFetcher
    );
    await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

    return mapRenderer;
  }
}

const ANCIENT_TEXTURE_FOLDERS: Record<string, string[]> = {
  "0": ["willow"],
  "2": ["icemountain"],
"3": ["swaphol", "gpshrine",],
  "5": ["warlock", "shop"],
  "6": ["shop"],
  "7": ["crfort", "swaphol", "gpshrine"],
  "8": ["icemountain"],
  "9": ["capeclaw"],
  "10": ["icemountain"],
  "11": ["icemountain"],
  "4": ["nwastes"],
  "14": ["cloudrace"],
  
};

export class AncientMapSceneDesc implements Viewer.SceneDesc {
    constructor(public id: string, public name: string, private gameInfo: GameInfo, private mapKey: any) {
    }
    
    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
      const musicState = (window as any).musicState;
console.log("Ancient mapKey:", this.mapKey);

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

        console.log(`Creating scene for ${this.name} ...`);

        const pathBase = this.gameInfo.pathBase;
        const dataFetcher = context.dataFetcher;
        const mapsJsonBuffer = await dataFetcher.fetchData(`${pathBase}/AncientMaps.json`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);

        const mapsJsonString = new TextDecoder('utf-8').decode(mapsJsonBuffer.arrayBuffer as ArrayBuffer);
        const mapsJson = JSON.parse(mapsJsonString);
        const map = mapsJson[this.mapKey];

        const numRows = map.blocks.length;
        const numCols = map.blocks[0].length;
        const blockTable: (BlockInfo | null)[][] = nArray(numRows, () => nArray(numCols, () => null));

        for (let row = 0; row < numRows; row++) {
            for (let col = 0; col < numCols; col++) {
                const b = map.blocks[row][col];
                if (b == null) {
                    blockTable[row][col] = null;
                } else {
                    const newValue = b.split('.', 2);
                    const newMod = Number.parseInt(newValue[0]);
                    const newSub = Number.parseInt(newValue[1]);
                    blockTable[row][col] = {mod: newMod, sub: newSub};
                }
            }
        }

        const mapSceneInfo: MapSceneInfo = {
            getNumCols() { return numCols; },
            getNumRows() { return numRows; },
            getBlockInfoAt(col: number, row: number): BlockInfo | null {
                return blockTable[row][col];
            },
            getOrigin(): number[] {
                return [0, 0];
            }
        };

const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
mapRenderer.mapNum = `ancient_${this.mapKey}`;


const texFetcher = await SFATextureFetcher.create(this.gameInfo, dataFetcher, false);
texFetcher.setModelVersion(ModelVersion.AncientMap);

const folders = ANCIENT_TEXTURE_FOLDERS[String(this.mapKey)] ?? [];
if (Number(this.mapKey) !== 0) {
    await texFetcher.loadSubdirs(folders, dataFetcher);
}
if (Number(this.mapKey) === 5) {
 texFetcher.setPngOverride(4100, 'textures/ribbon.png');
texFetcher.setPngOverride(618, 'textures/walls.png');
texFetcher.setPngOverride(617, 'textures/floor1.png');
texFetcher.setPngOverride(616, 'textures/pillar.png');
texFetcher.setPngOverride(615, 'textures/transwall.png');
texFetcher.setPngOverride(614, 'textures/support.png');
texFetcher.setPngOverride(613, 'textures/chain.png');
texFetcher.setPngOverride(612, 'textures/head.png');
texFetcher.setPngOverride(611, 'textures/krazfloor.png');
texFetcher.setPngOverride(610, 'textures/decor1.png');
texFetcher.setPngOverride(609, 'textures/floor2.png');
texFetcher.setPngOverride(608, 'textures/ceiling1.png');
texFetcher.setPngOverride(607, 'textures/walls2.png');
texFetcher.setPngOverride(606, 'textures/pillar2.png');
texFetcher.setPngOverride(605, 'textures/wood.png');
texFetcher.setPngOverride(604, 'textures/button.png');
texFetcher.setPngOverride(603, 'textures/sash.png');
texFetcher.setPngOverride(602, 'textures/floor3.png');
texFetcher.setPngOverride(601, 'textures/vines.png');
texFetcher.setPngOverride(600, 'textures/walls3.png');
texFetcher.setPngOverride(599, 'textures/block.png');
texFetcher.setPngOverride(598, 'textures/innerdoor.png');
texFetcher.setPngOverride(597, 'textures/stained.png');
texFetcher.setPngOverride(596, 'textures/spire.png');
texFetcher.setPngOverride(595, 'textures/crates.png');
texFetcher.setPngOverride(591, 'textures/sabrestart.png');
texFetcher.setPngOverride(590, 'textures/walls4.png');
texFetcher.setPngOverride(589, 'textures/floor4.png');
texFetcher.setPngOverride(588, 'textures/floor5.png');
texFetcher.setPngOverride(587, 'textures/walls5.png');
texFetcher.setPngOverride(586, 'textures/kraz.png');
texFetcher.setPngOverride(585, 'textures/black.png');
texFetcher.setPngOverride(584, 'textures/transring.png');
texFetcher.setPngOverride(583, 'textures/spire2.png');
texFetcher.setPngOverride(582, 'textures/kraz2.png');
texFetcher.setPngOverride(581, 'textures/kraz3.png');
texFetcher.setPngOverride(580, 'textures/port.png');
texFetcher.setPngOverride(579, 'textures/floor6.png');
}
if (Number(this.mapKey) === 6) {
texFetcher.setPngOverride(3001, 'textures/shoppurple.png'); 
texFetcher.setPngOverride(3002, 'textures/shopwood.png'); 
texFetcher.setPngOverride(3003, 'textures/shoppurple2.png'); 
texFetcher.setPngOverride(3004, 'textures/shoppurple3.png'); 
texFetcher.setPngOverride(3005, 'textures/shoppurple4.png'); 
texFetcher.setPngOverride(3006, 'textures/shoppurple5.png'); 
}

if (Number(this.mapKey) === 0) {
texFetcher.setPngOverride(2037, 'textures/wgfloor1.png');
texFetcher.setPngOverride(2036, 'textures/wgfloor2.png');
texFetcher.setPngOverride(2035, 'textures/wgfloor3.png');
texFetcher.setPngOverride(2034, 'textures/wgwall1.png');
texFetcher.setPngOverride(2033, 'textures/wgwall2.png');
texFetcher.setPngOverride(2032, 'textures/wgwall3.png');
texFetcher.setPngOverride(2031, 'textures/wgwall4.png');
texFetcher.setPngOverride(2030, 'textures/wgfloor4.png');
texFetcher.setPngOverride(2029, 'textures/wgwall5.png');
texFetcher.setPngOverride(2028, 'textures/wgfloor5.png');
texFetcher.setPngOverride(2027, 'textures/wgdirt.png');
texFetcher.setPngOverride(2026, 'textures/wgfloor6.png');
texFetcher.setPngOverride(2025, 'textures/wgwall6.png');
texFetcher.setPngOverride(2024, 'textures/wgwall7.png');
texFetcher.setPngOverride(2023, 'textures/wgwall8.png');
texFetcher.setPngOverride(2022, 'textures/wgwall9.png');
texFetcher.setPngOverride(2021, 'textures/wgrock.png');
texFetcher.setPngOverride(2020, 'textures/wgwall10.png');
texFetcher.setPngOverride(2019, 'textures/wgwall11.png');
texFetcher.setPngOverride(2018, 'textures/wgfloor7.png');
texFetcher.setPngOverride(2017, 'textures/wgwall12.png');
texFetcher.setPngOverride(2016, 'textures/wgwall13.png');
texFetcher.setPngOverride(2015, 'textures/wgvines.png');
texFetcher.setPngOverride(2014, 'textures/wgwall14.png');
texFetcher.setPngOverride(2013, 'textures/wgwall15.png');
texFetcher.setPngOverride(2012, 'textures/wgwall16.png');
texFetcher.setPngOverride(2011, 'textures/wgwall17.png');
texFetcher.setPngOverride(2010, 'textures/wgwall18.png');
texFetcher.setPngOverride(2009, 'textures/wgwall19.png');
texFetcher.setPngOverride(2008, 'textures/wgwall20.png');
texFetcher.setPngOverride(2007, 'textures/wgwall21.png');
texFetcher.setPngOverride(2006, 'textures/wgwall22.png');
texFetcher.setPngOverride(2005, 'textures/wgwall23.png');
texFetcher.setPngOverride(2004, 'textures/wgrim.png');
texFetcher.setPngOverride(2003, 'textures/wghead.png');
texFetcher.setPngOverride(2002, 'textures/wghead2.png');
texFetcher.setPngOverride(2001, 'textures/wghead3.png');
texFetcher.setPngOverride(2000, 'textures/wghead4.png');
}
await texFetcher.preloadPngOverrides((materialFactory as any).cache ?? (materialFactory as any).getCache?.(), dataFetcher);

const blockFetcher = await AncientBlockFetcher.create(
  this.gameInfo, dataFetcher, materialFactory, Promise.resolve(texFetcher)
);
mapRenderer.setBlockFetcherFactory(() => AncientBlockFetcher.create(
  this.gameInfo, dataFetcher, materialFactory, Promise.resolve(texFetcher)
));


await mapRenderer.create(mapSceneInfo, this.gameInfo, dataFetcher, blockFetcher);
ensureTextureToggleUI(async (enabled: boolean) => {
  texFetcher.setTexturesEnabled(enabled);
  (materialFactory as any).texturesEnabled = enabled;
  await mapRenderer.reloadForTextureToggle();
}, texFetcher.getTexturesEnabled?.() ?? true);

        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}

export class EarlyfearMapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
    }

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
      const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

        console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);
        const mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);

        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = -997;

        const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
  texFetcher.setModelVersion(ModelVersion.fear);
await texFetcher.loadSubdirs([ 'mmshrine'],  context.dataFetcher);
        const blockFetcher = await EARLYFEAR.create(this.gameInfo,context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher));
        await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}

export class EarlyDFPMapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
    }

public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
  const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

  console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

  const animController = new SFAAnimationController();
  const materialFactory = new MaterialFactory(device);
  const mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);
  const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
mapRenderer.mapNum = -998;
  const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
  texFetcher.setModelVersion(ModelVersion.dfpt);
await texFetcher.loadSubdirs([''], context.dataFetcher);

  texFetcher.setPngOverride(4000, 'textures/dfprim.png');
  texFetcher.setPngOverride(4001, 'textures/dfpwall.png');
  texFetcher.setPngOverride(4002, 'textures/dfpwall2.png');
  texFetcher.setPngOverride(4003, 'textures/dfpfloor.png');
  texFetcher.setPngOverride(4004, 'textures/dfpwall3.png');
  texFetcher.setPngOverride(4005, 'textures/dfpdecor.png');
  texFetcher.setPngOverride(4006, 'textures/dfpwall4.png');
  texFetcher.setPngOverride(4007, 'textures/dfppillar.png');
  texFetcher.setPngOverride(4008, 'textures/dfpkraz.png');
  texFetcher.setPngOverride(4009, 'textures/dfpkraz2.png');
  texFetcher.setPngOverride(4010, 'textures/dfppost.png');
  texFetcher.setPngOverride(4011, 'textures/dfpstatue.png');
  texFetcher.setPngOverride(4012, 'textures/dfpstatue2.png');
  texFetcher.setPngOverride(4013, 'textures/dfpbuttons.png');
     await texFetcher.preloadPngOverrides(
      (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
      context.dataFetcher
    );

  const blockFetcher = await EARLYDFPT.create(
    this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
  );

  await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

  const matrix = mat4.create();
  mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
  mapRenderer.setMatrix(matrix);

  return mapRenderer;
}
    
}

export class EarlydupMapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
    }

public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
  const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

  console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

  const animController = new SFAAnimationController();
  const materialFactory = new MaterialFactory(device);

  const REMAP_FEAR_SHRINE = 32;   
  const REMAP_KNOWLEDGE    = 34; 
  const REMAP_STRENGTH    = 39;   

  let mapSceneInfo: MapSceneInfo;

  switch (this.mapNum) {
    case REMAP_FEAR_SHRINE: {
      mapSceneInfo = {
        getNumCols() { return 2; },
        getNumRows() { return 4; },
        getBlockInfoAt(col, row) {
          const L: (BlockCell)[][] = [
            [ M(40,0), M(40,1) ],
            [ M(40,2), M(40,3) ],
            [ M(40,4), M(40,5) ],
            [ M(40,6), M(40,7) ],
          ];
          return L[row][col];
        },
        getOrigin() { return [0, 0]; },
      };
      break;
    }

    case REMAP_KNOWLEDGE: {
      mapSceneInfo = {
        getNumCols() { return 2; },
        getNumRows() { return 4; },
        getBlockInfoAt(col, row) {
          const L: (BlockCell)[][] = [
            [ M(42,0), M(42,1) ],
            [ M(42,2), M(42,3) ],
            [ M(42,4), M(42,5) ],
            [ M(42,6), M(42,7) ],
          ];
          return L[row][col];
        },
        getOrigin() { return [0, 0]; },
      };
      break;
    }
    case REMAP_STRENGTH: {
      mapSceneInfo = {
        getNumCols() { return 2; },
        getNumRows() { return 4; },
        getBlockInfoAt(col, row) {
          const L: (BlockCell)[][] = [
            [ M(43,0), M(43,1) ],
            [ M(43,2), M(43,3) ],
            [ M(43,4), M(43,5) ],
            [ M(43,6), M(43,7) ],
          ];
          return L[row][col];
        },
        getOrigin() { return [0, 0]; },
      };
      break;
    }

    default:
      mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);
      break;
  }

    const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
    
mapRenderer.mapNum = `dup_${this.mapNum}`;

    const texFetcher  = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);

    texFetcher.setModelVersion(ModelVersion.dup);
    texFetcher.setCurrentModelID(this.mapNum);  
let firstMod: number | null = null;

for (let row = 0; row < mapSceneInfo.getNumRows(); row++) {
  for (let col = 0; col < mapSceneInfo.getNumCols(); col++) {
    const b = mapSceneInfo.getBlockInfoAt(col, row);
    if (b) {
      firstMod = b.mod;
      break;
    }
  }
  if (firstMod !== null) break;
}
if (firstMod !== null) {
    const subdir = getSubdir(firstMod, this.gameInfo);
    if (this.mapNum === 32 || subdir === 'mmshrine') {
              await texFetcher.loadSubdirs([subdir], context.dataFetcher);
    } else {
        await texFetcher.loadSubdirs([subdir, 'Copy of swaphol'], context.dataFetcher);
    }
    if (subdir === 'gpshrine') {
        await texFetcher.loadSubdirs(['dragrock'], context.dataFetcher);
    } else if (subdir === 'mmshrine') {
        await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);
            } else if (subdir === 'dbshrine') {
        await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);
    }
} else {
}

     await texFetcher.preloadPngOverrides(
      (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
      context.dataFetcher
    );
  const blockFetcher = await EARLYDUPBLOCKFETCHER.create(
    this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
  );
  mapRenderer.setBlockFetcherFactory(() =>
    EARLYDUPBLOCKFETCHER.create(
      this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
    )
  );

  await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

  ensureTextureToggleUI(async (enabled: boolean) => {
    texFetcher.setTexturesEnabled(enabled);
    (materialFactory as any).texturesEnabled = enabled;
    await mapRenderer.reloadForTextureToggle();
  }, texFetcher.getTexturesEnabled?.() ?? true);

  const matrix = mat4.create();
  mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
  mapRenderer.setMatrix(matrix);

  return mapRenderer;
}
}


export class Early1MapSceneDesc implements Viewer.SceneDesc {
  constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {}

  public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
    const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

    console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

    const animController  = new SFAAnimationController();
    const materialFactory = new MaterialFactory(device);

    const REMAP_WALLED_CITY = 13;
    const REMAP_COMBAT      = 31;
    const REMAP_SAMPLE      = 29; 

    let mapSceneInfo: MapSceneInfo;

    switch (this.mapNum) {
      case REMAP_WALLED_CITY: {
        mapSceneInfo = {
          getNumCols() { return 9; },
          getNumRows() { return 9; },
          getBlockInfoAt(col, row) {
            const L: (BlockCell)[][] = [
              [ M(20,1),  M(20,4),  null,     null,     M(20,19), null,     null,     null,     null ],
              [ M(20,0),  M(20,3),  null,     M(20,12), M(20,18), M(20,25), null,     null,     null ],
              [ M(20,32), M(20,2),  M(20,5),  M(20,11), M(20,17), M(20,24), M(20,26), M(20,29), M(20,33) ],
              [ null,     null,     null,     M(20,10), M(20,16), M(20,23), null,     M(20,28), M(20,31) ],
              [ null,     null,     null,     M(20,9),  M(20,15), M(20,22), null,     M(20,27), M(20,30) ],
              [ null,     null,     null,     M(20,8),  M(20,14), M(20,21), null,     null,     null ],
              [ null,     null,     null,     M(20,7),  M(20,13), M(20,20), null,     null,     null ],
              [ null,     null,     null,     M(20,6),  null,     null,     null,     null,     null ],
              [ null,     null,     null,     null,     null,     null,     null,     null,     null ],
            ];
            return L[row][col];
          },
          getOrigin() { return [0, 0]; },
        };
        break;
      }

    case REMAP_COMBAT: {
      mapSceneInfo = {
        getNumCols() { return 2; },
        getNumRows() { return 4; },
        getBlockInfoAt(col, row) {
          const L: (BlockCell)[][] = [
            [ M(39,0), M(39,1) ],
            [ M(39,2), M(39,3) ],
            [ M(39,4), M(39,5) ],
            [ M(39,6), M(39,7) ],
          ];
          return L[row][col];
        },
        getOrigin() { return [0, 0]; },
      };
      break;
      }

      default: {
        mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);
        break;
      }
    }

    const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
mapRenderer.mapNum = `early1_${this.mapNum}`;

    const texFetcher  = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);

    texFetcher.setModelVersion(ModelVersion.Early1);
    texFetcher.setCurrentModelID(this.mapNum);  
let firstMod: number | null = null;

for (let row = 0; row < mapSceneInfo.getNumRows(); row++) {
  for (let col = 0; col < mapSceneInfo.getNumCols(); col++) {
    const b = mapSceneInfo.getBlockInfoAt(col, row);
    if (b) {
      firstMod = b.mod;
      break;
    }
  }

if (firstMod !== null) {
    const subdir = getSubdir(firstMod, this.gameInfo);
    
    if (this.mapNum === 15) {
        await texFetcher.loadSubdirs([subdir, 'cloudtreasure'], context.dataFetcher);
    } else {
        await texFetcher.loadSubdirs([subdir], context.dataFetcher);
    }

    if (subdir === 'clouddungeon' || subdir === 'cloudrace') {
        await texFetcher.loadSubdirs(['crfort'], context.dataFetcher);
    } else if (subdir === 'icemountain') {
        await texFetcher.loadSubdirs(['nwastes'], context.dataFetcher);
    } else if (subdir === 'desert') {
        await texFetcher.loadSubdirs(['dfptop', 'volcano'], context.dataFetcher);
    } else if (subdir === 'crfort') {
        await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);
    } else if (subdir === 'linkb' || subdir === 'linkf') {
        await texFetcher.loadSubdirs(['volcano'], context.dataFetcher);
    } else if (subdir === 'shipbattle') {
        await texFetcher.loadSubdirs([''], context.dataFetcher);
    } else if (subdir === 'linkc') {
        await texFetcher.loadSubdirs(['nwastes'], context.dataFetcher);
    } else if (subdir === 'mmpass') {
        await texFetcher.loadSubdirs(['shop', 'warlock'], context.dataFetcher);
    } else if (subdir === 'swaphol') {
        await texFetcher.loadSubdirs(['Copy of swaphol', 'nwastes', 'mmpass'], context.dataFetcher);
    } else if (subdir === 'swapholbot' || subdir === 'shop') {
        await texFetcher.loadSubdirs(['Copy of swaphol', 'swaphol', 'ecshrine'], context.dataFetcher);
    } else if (subdir === 'wallcity') {
        await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);
    } else if (subdir === 'darkicemines') {
        await texFetcher.loadSubdirs(['shop', 'nwastes'], context.dataFetcher);
    } else if (subdir === 'bossgaldon') {
        await texFetcher.loadSubdirs(['dragrock'], context.dataFetcher);
    } else if (subdir === 'nwastes') {
        await texFetcher.loadSubdirs(['icemountain'], context.dataFetcher);
    }
}
const SWAPHOL_EARLY1_MAPNUM = 7;
const SWAPHOLBOT_EARLY1_MAPNUM = 8;
const KRAZOA_PALACE_EARLY1_MAPNUM = 11;
const CLOUD_RACE_EARLY1_MAPNUM = 43;      
const CLOUD_TREASURE_EARLY1_MAPNUM = 15;
const CLOUD_DUNGEON_EARLY1_MAPNUM = 16;   
const CAPE_CLAW_EARLY1_MAPNUM = 29;
const LINK_LEVEL_EARLY1_MAPNUM = 64;
const DRAGON_ROCK_BOTTOM_EARLY1_MAPNUM = 52; 

if (this.mapNum === DRAGON_ROCK_BOTTOM_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['dragrockbot'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([DRAGON_ROCK_BOTTOM_EARLY1_MAPNUM]);
}

if (this.mapNum === SWAPHOL_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['swaphol'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([SWAPHOL_EARLY1_MAPNUM]);
}

if (this.mapNum === SWAPHOLBOT_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['swapholbot'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([SWAPHOLBOT_EARLY1_MAPNUM]);
}

if (this.mapNum === KRAZOA_PALACE_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['warlock'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([KRAZOA_PALACE_EARLY1_MAPNUM]);
}

if (this.mapNum === CLOUD_RACE_EARLY1_MAPNUM || this.mapNum === CLOUD_DUNGEON_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['crfort'], context.dataFetcher); 
    texFetcher.preferCopyOfSwapholForModelIDs([this.mapNum as number]);
}

if (this.mapNum === CLOUD_TREASURE_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['cloudtreasure'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([CLOUD_TREASURE_EARLY1_MAPNUM]);
}

if (this.mapNum === CAPE_CLAW_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['capeclaw'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([CAPE_CLAW_EARLY1_MAPNUM]);
}

if (this.mapNum === LINK_LEVEL_EARLY1_MAPNUM) {
    await texFetcher.loadSubdirs(['linklevel'], context.dataFetcher);
    texFetcher.preferCopyOfSwapholForModelIDs([LINK_LEVEL_EARLY1_MAPNUM]);
}
}
    texFetcher.setPngOverride(3000, 'textures/wcblue.png');
    texFetcher.setPngOverride(3500, 'textures/wcfloor.png');
        texFetcher.setPngOverride(3501, 'textures/wcredrims.png');
           texFetcher.setPngOverride(3611, 'textures/wcrims.png');
           texFetcher.setPngOverride(3612, 'textures/DIMladder.png');
           texFetcher.setPngOverride(3613, 'textures/DIMwall.png');
texFetcher.setPngOverride(3614, 'textures/MMSHfloor.png');

     await texFetcher.preloadPngOverrides(
      (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
      context.dataFetcher
    );

    const blockFetcher = await EARLY1BLOCKFETCHER.create(
      this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
    );
mapRenderer.setBlockFetcherFactory(() => EARLY1BLOCKFETCHER.create(
  this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
));

    await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

ensureTextureToggleUI(async (enabled: boolean) => {
  texFetcher.setTexturesEnabled(enabled);
  (materialFactory as any).texturesEnabled = enabled; 
  await mapRenderer.reloadForTextureToggle();
}, texFetcher.getTexturesEnabled?.() ?? true);

    const matrix = mat4.create();
    mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
    mapRenderer.setMatrix(matrix);

    return mapRenderer;
  }
}



export class Early2MapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
    }

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
      const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

        console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);
    const earyl2DRB =  52;

    let mapSceneInfo: MapSceneInfo;
    if (this.mapNum === earyl2DRB) {

       mapSceneInfo = {
         getNumCols() { return 5; },
         getNumRows() { return 5; },
         getBlockInfoAt(col, row) {
           const L: (BlockCell)[][] = [
             [ null, M(10,0), M(10,1), null ],
             [  M(10,14), M(10,2), M(10,3), M(10,15), ],
              [  M(10,4), M(10,5), M(10,6), M(10,12), ],
               [  M(10,10), M(10,7), M(10,8), M(10,13), ],
               [  null, M(10,9), M(10,11),null ],
           ];
           return L[row][col];
         },
         getOrigin() { return [0, 0]; },
       };

    } else {
      mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);
    }
        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = this.mapNum;

        const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
       texFetcher.setModelVersion(ModelVersion.Early2);
let firstMod: number | null = null;

for (let row = 0; row < mapSceneInfo.getNumRows(); row++) {
  for (let col = 0; col < mapSceneInfo.getNumCols(); col++) {
    const b = mapSceneInfo.getBlockInfoAt(col, row);
    if (b) {
      firstMod = b.mod;
      break;
    }
  }
  if (firstMod !== null) break;
}

if (firstMod !== null) {
  const subdir = getSubdir(firstMod, this.gameInfo);
  await texFetcher.loadSubdirs([subdir], context.dataFetcher);

  if (subdir === 'clouddungeon') {
    await texFetcher.loadSubdirs(['crfort'], context.dataFetcher);
    }
  if (subdir === 'crfort') {
    await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);

  }
}    
        const blockFetcher = await EARLY2BLOCKFETCHER.create(this.gameInfo,context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher));
        await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}
export class Early3MapSceneDesc implements Viewer.SceneDesc {
  constructor(
    public mapNum: number,
    public id: string,
    public name: string,
    private gameInfo: GameInfo = SFA_GAME_INFO
  ) {}

  public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
    const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

    console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

    const animController = new SFAAnimationController();
    const materialFactory = new MaterialFactory(device);

    const REMAP_LINK_C     = 67; 

    let mapSceneInfo: MapSceneInfo;

    switch (this.mapNum) {
      case REMAP_LINK_C: {
        mapSceneInfo = {
          getNumCols() { return 1; },
          getNumRows() { return 3; },
          getBlockInfoAt(col, row) {
            const L: (BlockCell)[][] = [
              [ M(65,0), ],
              [ M(65,1), ],
              [ M(65,2), ],
            ];
            return L[row][col];
          },
          getOrigin() { return [0, 0]; },
        };
        break;
      }
      default: {
        mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);
        break;
      }
    }

    const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
mapRenderer.mapNum = this.mapNum;

const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
texFetcher.setModelVersion(ModelVersion.Early3);
await texFetcher.loadSubdirs([''], context.dataFetcher);

let firstMod: number | null = null;

for (let row = 0; row < mapSceneInfo.getNumRows(); row++) {
  for (let col = 0; col < mapSceneInfo.getNumCols(); col++) {
    const b = mapSceneInfo.getBlockInfoAt(col, row);
    if (b) {
      firstMod = b.mod;
      break;
    }
  }
  if (firstMod !== null)
    break;
}

if (firstMod !== null) {
  const subdir = getSubdir(firstMod, this.gameInfo);

  await texFetcher.loadSubdirs([subdir], context.dataFetcher);

  if (subdir === 'swapholbot' || subdir === 'shop') {
    await texFetcher.loadSubdirs(['Copy of swaphol', 'swaphol', 'ecshrine'], context.dataFetcher);
  }
}

texFetcher.setPngOverride(3600, 'textures/dim2wall.png');
texFetcher.setPngOverride(3500, 'textures/wcfloor.png');
     await texFetcher.preloadPngOverrides(
      (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
      context.dataFetcher
    );

    const blockFetcher = await EARLY3BLOCKFETCHER.create(
      this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
    );

    mapRenderer.setBlockFetcherFactory(() =>
      EARLY3BLOCKFETCHER.create(
        this.gameInfo, context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher)
      )
    );

    await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

    ensureTextureToggleUI(async (enabled: boolean) => {
      texFetcher.setTexturesEnabled(enabled);
      (materialFactory as any).texturesEnabled = enabled;
      await mapRenderer.reloadForTextureToggle();
    }, texFetcher.getTexturesEnabled?.() ?? true);

    const matrix = mat4.create();
    mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
    mapRenderer.setMatrix(matrix);

    return mapRenderer;
  }
}

export class Early4MapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo: GameInfo = SFA_GAME_INFO) {
    }

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
      const musicState = (window as any).musicState;

if (musicState.audio) {
    musicState.audio.pause();
    musicState.audio.currentTime = 0;
    musicState.audio = null;
}

        console.log(`Creating scene for ${this.name} (map #${this.mapNum}) ...`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);
        const mapSceneInfo = await loadMap(this.gameInfo, context.dataFetcher, this.mapNum);

        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = this.mapNum;

const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
texFetcher.setModelVersion(ModelVersion.Early4);
await texFetcher.loadSubdirs([''], context.dataFetcher);
texFetcher.setCurrentModelID(this.mapNum);

let firstMod: number | null = null;

for (let row = 0; row < mapSceneInfo.getNumRows(); row++) {
  for (let col = 0; col < mapSceneInfo.getNumCols(); col++) {
    const b = mapSceneInfo.getBlockInfoAt(col, row);
    if (b) {
      firstMod = b.mod;
      break;
    }
  }
  if (firstMod !== null)
    break;
}

if (firstMod !== null) {
  const subdir = getSubdir(firstMod, this.gameInfo);

  await texFetcher.loadSubdirs([subdir], context.dataFetcher);

  if (subdir === 'swapholbot' || subdir === 'shop') {
    await texFetcher.loadSubdirs(['Copy of swaphol', 'swaphol', 'ecshrine'], context.dataFetcher);
  }
}

texFetcher.setPngOverride(3610, 'textures/wcbluehead.png');
   texFetcher.setPngOverride(3611, 'textures/wcrims.png');
   texFetcher.setPngOverride(3612, 'textures/wcmoon1.png');
   texFetcher.setPngOverride(3613, 'textures/wcmoon2.png');
    texFetcher.setPngOverride(3614, 'textures/wcmoon3.png');

     await texFetcher.preloadPngOverrides(
      (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
      context.dataFetcher
    );

        const blockFetcher = await EARLY4BLOCKFETCHER.create(this.gameInfo,context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher));
        await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

       const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}

const ZERO_ENVFX_MAPS = [2, 3, 11, 15, 16, 21, 27, 28, 30, 31, 32, 33, 34, 39, 40, 41, 42, 48, 50, 51, 52, 53, 54];
type DPMPEGClipInfo = {
    index: number;
    start: number;
    end: number;
    size: number;
};

type DPMPEGLoadResult = {
    bin: DataView;
    clips: DPMPEGClipInfo[];
    mode: string;
};

function dpBuildMPEGClipsFromOffsets(tab: DataView, binSize: number, littleEndian: boolean): DPMPEGClipInfo[] {
    const clips: DPMPEGClipInfo[] = [];

    for (let i = 0, index = 0; i + 4 <= tab.byteLength; i += 4, index++) {
        const start = tab.getUint32(i, littleEndian);
        if (start >= binSize)
            continue;

        let end = binSize;
        for (let j = i + 4; j + 4 <= tab.byteLength; j += 4) {
            const next = tab.getUint32(j, littleEndian);
            if (next > start && next <= binSize) {
                end = next;
                break;
            }
        }

        if (end > start) {
            clips.push({
                index,
                start,
                end,
                size: end - start,
            });
        }
    }

    return clips.filter((c) => c.size > 0);
}

async function loadDPMPEGVoiceData(dataFetcher: DataFetcher, pathBase: string): Promise<DPMPEGLoadResult> {
    const cached = (window as any).__dpMpegVoiceCache as { pathBase: string; result: DPMPEGLoadResult } | undefined;
    if (cached && cached.pathBase === pathBase)
        return cached.result;

    const [tabBuf, binBuf] = await Promise.all([
        dataFetcher.fetchData(`${pathBase}/MPEG.tab`),
        dataFetcher.fetchData(`${pathBase}/MPEG.bin`),
    ]);

    const tab = tabBuf.createDataView();
    const bin = binBuf.createDataView();
    const binSize = bin.byteLength;

    const be = dpBuildMPEGClipsFromOffsets(tab, binSize, false);
    const le = dpBuildMPEGClipsFromOffsets(tab, binSize, true);

    const result: DPMPEGLoadResult = (be.length >= le.length)
        ? { bin, clips: be, mode: 'u32 offsets BE' }
        : { bin, clips: le, mode: 'u32 offsets LE' };

    (window as any).__dpMpegVoiceCache = { pathBase, result };
   // console.log(`[DP MPEG] mode=${result.mode} clips=${result.clips.length} binSize=${binSize}`);

    return result;
}

function stopDPMPEGVoicePreview(): void {
    const state = ((window as any).__dpMpegVoicePreview ??= {
        audio: null as HTMLAudioElement | null,
        url: null as string | null,
    });

    if (state.audio) {
        state.audio.pause();
        state.audio.currentTime = 0;
        state.audio = null;
    }

    if (state.url) {
        URL.revokeObjectURL(state.url);
        state.url = null;
    }
}

async function ensureDPMPEGVoiceUI(dataFetcher: DataFetcher, gameInfo: GameInfo): Promise<void> {
    stopDPMPEGVoicePreview();

    document.getElementById('dp-mpeg-voice-toggle')?.remove();
    document.getElementById('dp-mpeg-voice-ui')?.remove();

    const uiState = ((window as any).__dpMpegVoiceUIState ??= {
        open: false,
    });

    // Top checkbox/toggle
    const toggleWrap = document.createElement('div');
    toggleWrap.id = 'dp-mpeg-voice-toggle';
    toggleWrap.style.height = '20px';
toggleWrap.style.boxSizing = 'border-box';
toggleWrap.style.order = '5';
    toggleWrap.style.padding = '1px 3px';
    toggleWrap.style.background = 'rgba(0,0,0,0.5)';
    toggleWrap.style.color = '#fff';
    toggleWrap.style.font = '11px sans-serif';
    toggleWrap.style.borderRadius = '2px';
    toggleWrap.style.display = 'flex';
    toggleWrap.style.alignItems = 'center';

    const toggleLabel = document.createElement('label');
    toggleLabel.style.cursor = 'pointer';
    toggleLabel.style.display = 'flex';
    toggleLabel.style.alignItems = 'center';

    const toggleCb = document.createElement('input');
    toggleCb.type = 'checkbox';
    toggleCb.style.marginRight = '1px';
    toggleCb.checked = !!uiState.open;

    toggleLabel.appendChild(toggleCb);
    toggleLabel.appendChild(document.createTextNode('Voice'));
    toggleWrap.appendChild(toggleLabel);
getDPTopToggleBar().appendChild(toggleWrap);
    // Drawer panel
    const wrap = document.createElement('div');
    wrap.id = 'dp-mpeg-voice-ui';
    wrap.style.position = 'fixed';
    wrap.style.right = '8px';
    wrap.style.top = '28px';
    wrap.style.width = '340px';
    wrap.style.zIndex = '10000';
    wrap.style.background = 'rgba(0,0,0,0.88)';
    wrap.style.color = '#fff';
    wrap.style.font = '12px monospace';
    wrap.style.padding = '8px';
    wrap.style.border = '1px solid rgba(255,255,255,0.18)';
    wrap.style.borderRadius = '8px';
    wrap.style.display = uiState.open ? 'grid' : 'none';
    wrap.style.gap = '8px';

    const title = document.createElement('div');
    title.textContent = 'DP MPEG Voice Player';
    title.style.fontWeight = 'bold';
    wrap.appendChild(title);

    const status = document.createElement('div');
    status.textContent = 'Loading MPEG.tab / MPEG.bin...';
    status.style.color = '#aaa';
    wrap.appendChild(status);

    const row1 = document.createElement('div');
    row1.style.display = 'grid';
    row1.style.gridTemplateColumns = '80px 1fr';
    row1.style.alignItems = 'center';
    row1.style.gap = '6px';
    wrap.appendChild(row1);

    const lineLabel = document.createElement('div');
    lineLabel.textContent = 'Line #';
    row1.appendChild(lineLabel);

    const lineInput = document.createElement('input');
    lineInput.type = 'number';
    lineInput.value = '0';
    lineInput.min = '0';
    lineInput.step = '1';
    lineInput.style.width = '100%';
    lineInput.style.boxSizing = 'border-box';
    row1.appendChild(lineInput);

    const row2 = document.createElement('div');
    row2.style.display = 'grid';
    row2.style.gridTemplateColumns = '1fr 1fr 1fr 1fr';
    row2.style.gap = '6px';
    wrap.appendChild(row2);

    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Prev';
    row2.appendChild(prevBtn);

    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    row2.appendChild(playBtn);

    const stopBtn = document.createElement('button');
    stopBtn.textContent = 'Stop';
    row2.appendChild(stopBtn);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next';
    row2.appendChild(nextBtn);
const row3 = document.createElement('div');
row3.style.display = 'grid';
row3.style.gridTemplateColumns = '42px 1fr 42px';
row3.style.alignItems = 'center';
row3.style.gap = '6px';
wrap.appendChild(row3);

const timeNow = document.createElement('div');
timeNow.textContent = '0:00';
timeNow.style.color = '#ddd';
timeNow.style.textAlign = 'right';
row3.appendChild(timeNow);

const progress = document.createElement('input');
progress.type = 'range';
progress.min = '0';
progress.max = '1';
progress.step = 'any';
progress.value = '0';
progress.style.width = '100%';
progress.style.margin = '0';
row3.appendChild(progress);

const timeEnd = document.createElement('div');
timeEnd.textContent = '0:00';
timeEnd.style.color = '#ddd';
timeEnd.style.textAlign = 'left';
row3.appendChild(timeEnd);
    const info = document.createElement('div');
    info.style.whiteSpace = 'pre-wrap';
    info.style.color = '#ddd';
    wrap.appendChild(info);

    document.body.appendChild(wrap);

    const applyOpenState = () => {
        uiState.open = toggleCb.checked;
        wrap.style.display = uiState.open ? 'grid' : 'none';
    };

    toggleCb.onchange = () => {
        applyOpenState();

        if (!toggleCb.checked) {
            stopProgressRAF();
            stopDPMPEGVoicePreview();

            const musicState = (window as any).musicState;
            const bgm = musicState?.audio as HTMLAudioElement | null;

            if (bgm && !musicState?.muted) {
                bgm.play().catch(() => {});
            }

            status.textContent = 'Closed';
            resetProgress();
        }
    };

    let result: DPMPEGLoadResult;
    try {
        result = await loadDPMPEGVoiceData(dataFetcher, gameInfo.pathBase);
    } catch (e) {
        status.textContent = 'Failed to load MPEG.tab / MPEG.bin';
        info.textContent = String(e);
        return;
    }

    if (result.clips.length === 0) {
        status.textContent = `Loaded MPEG files, but found no clips (${result.mode})`;
        info.textContent = 'Try checking MPEG.tab parsing.';
        return;
    }

    lineInput.max = String(result.clips.length - 1);
const formatTime = (secs: number): string => {
    if (!Number.isFinite(secs) || secs < 0)
        return '0:00';

    const s = Math.floor(secs);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
};

const resetProgress = () => {
    progress.max = '1';
    progress.value = '0';
    timeNow.textContent = '0:00';
    timeEnd.textContent = '0:00';
};

const updateProgressFromAudio = (audio: HTMLAudioElement | null) => {
    if (!audio) {
        resetProgress();
        return;
    }

    const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const cur = Number.isFinite(audio.currentTime) && audio.currentTime > 0 ? audio.currentTime : 0;

    progress.max = String(dur > 0 ? dur : 1);
    progress.value = String(Math.min(cur, dur > 0 ? dur : 1));
    timeNow.textContent = formatTime(cur);
    timeEnd.textContent = formatTime(dur);
};
let scrubActive = false;

progress.oninput = () => {
    const t = Number(progress.value) || 0;
    scrubActive = true;
    timeNow.textContent = formatTime(t);
};

progress.onchange = () => {
    const state = (window as any).__dpMpegVoicePreview;
    const audio = state?.audio as HTMLAudioElement | null;
    if (!audio) return;

    const t = Number(progress.value) || 0;
    try {
        audio.currentTime = t;
    } catch (e) {
    }

    scrubActive = false;
    updateProgressFromAudio(audio);
};
let progressRAF = 0;

const stopProgressRAF = () => {
    if (progressRAF !== 0) {
        cancelAnimationFrame(progressRAF);
        progressRAF = 0;
    }
};

const tickProgress = () => {
    const state = (window as any).__dpMpegVoicePreview;
    const audio = state?.audio as HTMLAudioElement | null;

    if (!audio) {
        progressRAF = 0;
        return;
    }

    if (!scrubActive)
        updateProgressFromAudio(audio);

    if (!audio.paused && !audio.ended) {
        progressRAF = requestAnimationFrame(tickProgress);
    } else {
        progressRAF = 0;
    }
};

const startProgressRAF = () => {
    stopProgressRAF();
    progressRAF = requestAnimationFrame(tickProgress);
};
    const clampIndex = (): number => {
        let i = Number(lineInput.value) | 0;
        if (!Number.isFinite(i)) i = 0;
        if (i < 0) i = 0;
        if (i >= result.clips.length) i = result.clips.length - 1;
        lineInput.value = String(i);
        return i;
    };

    const syncInfo = () => {
        const i = clampIndex();
        const clip = result.clips[i];
        if (!clip) {
            info.textContent = `clip ${i}\ninvalid`;
            return;
        }

        info.textContent =
            `clip ${clip.index} / ${result.clips.length - 1}\n` +
            `start: 0x${clip.start.toString(16)}\n` +
            `end:   0x${clip.end.toString(16)}\n` +
            `size:  ${clip.size} bytes`;
    };

    const playIndex = (requestedIndex: number) => {
        let i = requestedIndex | 0;
        if (i < 0) i = 0;
        if (i >= result.clips.length) i = result.clips.length - 1;
        lineInput.value = String(i);

        const clip = result.clips[i];
if (!clip || clip.size <= 0) {
    resetProgress();
    status.textContent = `Clip ${i} is empty`;
    syncInfo();
    return;
}

        stopProgressRAF();
        stopDPMPEGVoicePreview();
        const musicState = (window as any).musicState;
        if (musicState?.audio)
            musicState.audio.pause();

        const src = new Uint8Array(result.bin.buffer, result.bin.byteOffset + clip.start, clip.size);
        const copy = new Uint8Array(clip.size);
        copy.set(src);

        const blob = new Blob([copy], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
audio.volume = 0.75;
        const state = ((window as any).__dpMpegVoicePreview ??= {
            audio: null as HTMLAudioElement | null,
            url: null as string | null,
        });

        state.audio = audio;
        state.url = url;
resetProgress();

audio.addEventListener('loadedmetadata', () => {
    updateProgressFromAudio(audio);
});

audio.addEventListener('durationchange', () => {
    updateProgressFromAudio(audio);
});

audio.addEventListener('play', () => {
    startProgressRAF();
});

audio.addEventListener('pause', () => {
    stopProgressRAF();
    if (!scrubActive)
        updateProgressFromAudio(audio);
});

audio.addEventListener('ended', () => {
    scrubActive = false;
    stopProgressRAF();
    updateProgressFromAudio(audio);
});
        audio.onended = () => {
            if (state.audio === audio)
                state.audio = null;
            if (state.url === url) {
                URL.revokeObjectURL(url);
                state.url = null;
            }
        };

        audio.onerror = () => {
            status.textContent = `Playback failed for clip ${clip.index}`;
        };

        audio.play().then(() => {
            status.textContent = `Playing clip ${clip.index}`;
            startProgressRAF();
        }).catch((e) => {
            status.textContent = `Playback failed for clip ${clip.index}`;
            console.error(e);
        });

        syncInfo();
    };

    prevBtn.onclick = () => {
        playIndex(clampIndex() - 1);
    };

    playBtn.onclick = () => {
        playIndex(clampIndex());
    };

stopBtn.onclick = () => {
    stopProgressRAF();
    stopDPMPEGVoicePreview();
    resetProgress();
    status.textContent = 'Stopped';
};

    nextBtn.onclick = () => {
        playIndex(clampIndex() + 1);
    };

    lineInput.oninput = () => {
        syncInfo();
    };

    lineInput.onchange = () => {
        syncInfo();
    };

    status.textContent = `Loaded ${result.clips.length} clips (${result.mode})`;
    syncInfo();
    applyOpenState();

}
export class DPMapSceneDesc implements Viewer.SceneDesc {
    constructor(public mapNum: number, public id: string, public name: string, private gameInfo?: GameInfo) {}

public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
    cleanupTextureToggleUI();
    const gInfo = this.gameInfo ?? DP_GAME_INFO;
        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);
        const mapSceneInfo = await loadMap(gInfo, context.dataFetcher, this.mapNum);
        
        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);  
        (mapRenderer as any).mapNum = `dp_${this.mapNum}`;      
        const texFetcher = await SFATextureFetcher.create(gInfo, context.dataFetcher, false);
        texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);

        const dpModelFetcher = new PreloadingDPModelFetcher(gInfo, context.dataFetcher, texFetcher, materialFactory);
        await dpModelFetcher.init();

const fakeWorld: any = {
            renderCache: (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
            gameInfo: gInfo,
            worldLights: mapRenderer.worldLights,
            resColl: { 
                texFetcher: texFetcher,
                modelFetcher: dpModelFetcher,
                amapCollection: { getAmap: () => null } as any, 
                animCollection: { getAnim: () => null } as any,
                modanimCollection: { getModanim: () => null } as any,
            },
            animController: { animController: animController, enableFineSkinAnims: false },
            objectMan: null,
            
            mapInstance: {
                getBlockAtPosition: () => null,
                getWaterElevation: () => 0,
                getTerrainElevation: () => 0
            }
        };

        const objectManager = await ObjectManager.create(fakeWorld as World, context.dataFetcher, false);
        fakeWorld.objectMan = objectManager;

        const objTab = (await context.dataFetcher.fetchData(`${gInfo.pathBase}/OBJECTS.tab`)).createDataView();
        const objBin = (await context.dataFetcher.fetchData(`${gInfo.pathBase}/OBJECTS.bin`)).createDataView();
        const objIdx = (await context.dataFetcher.fetchData(`${gInfo.pathBase}/OBJINDEX.bin`)).createDataView();
       const dpExternalNameMap = await loadDPExternalObjectNames(context.dataFetcher, gInfo);
        let modelInd: DataView | null = null; 
        try { modelInd = (await context.dataFetcher.fetchData(`${gInfo.pathBase}/MODELIND.bin`)).createDataView(); } catch(e) {}
        
        applyDPObjectManagerPatch(objectManager, objTab, objBin, objIdx, modelInd);
(objectManager as any)._dpExternalNameMap = dpExternalNameMap;

        const objData = mapSceneInfo.getObjectsData?.();
        if (objData) {
            const requiredModels = new Set<number>();
            
requiredModels.add(335);
requiredModels.add(336);
requiredModels.add(0x03B1);
requiredModels.add(0x03B2);
requiredModels.add(0x03F3);
requiredModels.add(0x00B2);
requiredModels.add(0x00B3);
requiredModels.add(0x03FC);
requiredModels.add(0x03E4);
requiredModels.add(0x03FE);
requiredModels.add(0x03EB);
            
            let offset = 0;
            while (offset < objData.byteLength) {
                const size = objData.getUint8(offset + 2) * 4;
                if (size === 0) break;
                try {
                    const ot = objectManager.getObjectType(objData.getUint16(offset), false);
                    ot.modelNums.forEach(m => requiredModels.add(m));
                } catch(e) {}
                offset += size;
            }
            await dpModelFetcher.preloadModels(Array.from(requiredModels));
        }

  
        if (!texFetcher.textureHolder) texFetcher.textureHolder = { viewerTextures: [], onnewtextures: null };
        let pointSampler: any = null;
        const shownTextures = new Set<any>(); 
const origGetTexture = (texFetcher as any).getTexture.bind(texFetcher);
(window as any).__dpTexReqCount = 0;

(texFetcher as any).getTexture = function(cache: any, id: number, useTex1: boolean) {
    if ((window as any).__dpTexReqCount < 300) {
      //  console.warn(`[DP TEX REQ] id=${id} bank=${useTex1 ? 'TEX1' : 'TEX0'}`);
        (window as any).__dpTexReqCount++;
    }

    const res = origGetTexture(cache, id, useTex1);

    if (res && res.viewerTexture) {
        const vt = res.viewerTexture;
        if (!shownTextures.has(vt)) {
            shownTextures.add(vt);
            this.textureHolder.viewerTextures.push(vt);
            if (this.textureHolder.onnewtextures) this.textureHolder.onnewtextures();
        }

        const cutoutTextures = [0];
        if (cutoutTextures.includes(id)) {
            if (!pointSampler) pointSampler = cache.device.createSampler({
                wrapS: 1, wrapT: 1, minFilter: 0, magFilter: 0, mipFilter: 0, minLOD: 0, maxLOD: 100,
            });
            res.gfxSampler = pointSampler;
        }
    }

    return res;
};

        const ZERO_ENVFX_MAPS = [2,  11, 15, 16, 21, 27, 28, 30, 31, 32, 33, 34, 39, 40, 41, 42, 48, 50, 51, 52, 53, 54];
        const isZeroEnvMap = ZERO_ENVFX_MAPS.includes(this.mapNum as number);
        const startingEnvFx = isZeroEnvMap ? 0 : DP_ENV_DEFAULT.envfxIndex;

        try {
            mapRenderer.envfxMan = await EnvfxManager.create(fakeWorld as World, context.dataFetcher);
            fakeWorld.envfxMan = mapRenderer.envfxMan; 
            mapRenderer.envfxMan.loadEnvfx(startingEnvFx); 
        } catch (e) {}
        
        (texFetcher as any).dataFetcherRef = context.dataFetcher;
const blockFetcher = await DPBlockFetcher.create(gInfo, context.dataFetcher, materialFactory, Promise.resolve(texFetcher));
       
if (texFetcher.textureHolder) mapRenderer.textureHolder = texFetcher.textureHolder;

await mapRenderer.create(mapSceneInfo, gInfo, context.dataFetcher, blockFetcher, { 
    objectManager,
    dpMapScene: true,
    
});
await ensureDPMPEGVoiceUI(context.dataFetcher, gInfo);
//ensureTextureToggleUI(async (enabled: boolean) => {
    //texFetcher.setTexturesEnabled(enabled);
    //(materialFactory as any).texturesEnabled = enabled;
  //  await mapRenderer.reloadForTextureToggle();
//}, texFetcher.getTexturesEnabled?.() ?? true);
// Default OFF
mapRenderer.showDevObjects = false;

ensureDPDevObjectsUI(async (enabled: boolean) => {
    mapRenderer.showDevObjects = enabled;
}, false);

mapRenderer.showAllObjects = true;
ensureDPObjectsUI(async (enabled: boolean) => {
    mapRenderer.showAllObjects = enabled;
}, true);

mapRenderer.showObjectLabels = false;
ensureDPObjectLabelsUI(async (enabled: boolean) => {
    mapRenderer.showObjectLabels = enabled;
    if (!enabled)
        mapRenderer.clearSelectedDebugObject();
}, false);
setTimeout(async () => {
            const mr = mapRenderer as any;
            if (mr.envSelect && mr.envfxMan) {
                const sequence = isZeroEnvMap ? [0] : [95, 96, 97, 98, 99, 100];
                for (const val of sequence) {
                    mr.envSelect.setValue(val);
                    mr.envfxMan.loadEnvfx(val); 
                    await new Promise(resolve => setTimeout(resolve, 32)); 
                }
                mr.rebuildSky(mr.currentTexFetcher, mr.currentGameInfo);
            }
        }, 100);

        const matrix = mat4.create();
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}

type DPGlobalMapEntry = {
    CoordX: number;
    CoordZ: number;
    Unk0: number;
    MapIndex: number;
    Unk1: number;
    Unk2: number;
};

type DPPlacedMap = {
    key: number;           
    mapIndex: number;
    gx: number;            
    gz: number;
    wx: number;            
    wz: number;           
};

class DPFullWorldRenderer extends SFARenderer {
    private placed: DPPlacedMap[] = [];
    private loaded = new Map<number, MapInstance>();
    private loading = new Map<number, Promise<void>>();
    private placedByKey = new Map<number, DPPlacedMap>();
    private camGX = 0;
    private camGZ = 0;

    public envfxMan: EnvfxManager | null = null;
    public worldLights: WorldLights = new WorldLights();

    constructor(
        private device: GfxDevice,
        context: SceneContext,
        animController: SFAAnimationController,
        materialFactory: MaterialFactory,
        private gameInfo: GameInfo,
        private dataFetcher: DataFetcher,
        private blockFetcher: BlockFetcher,
        placed: DPPlacedMap[],
    ) {
        super(context, animController, materialFactory);
        this.placed = placed;
        for (const p of placed) this.placedByKey.set(p.key, p);
    }

    private static readonly STEP = 640 ; 

    private ensureLoaded(p: DPPlacedMap): Promise<void> {
        if (this.loaded.has(p.key))
            return Promise.resolve();

        const existing = this.loading.get(p.key);
        if (existing)
            return existing;

        const prom = (async () => {
            try {
                const info = await loadMap(this.gameInfo, this.dataFetcher, p.mapIndex);
                const inst = new MapInstance(info, this.blockFetcher);

                const [ox, oz] = info.getOrigin();     
                const anchorX = p.wx - ox * 640;
                const anchorZ = p.wz - oz * 640;

                const m = mat4.create();
                mat4.fromTranslation(m, [anchorX, 0, anchorZ]);
                inst.setMatrix(m);

                await inst.reloadBlocks(this.dataFetcher);
                this.loaded.set(p.key, inst);
            } catch (e) {
                console.warn(`DPFullWorld: failed to load map ${p.mapIndex} @ (${p.gx},${p.gz})`, e);
            } finally {
                this.loading.delete(p.key);
            }
        })();

        this.loading.set(p.key, prom);
        return prom;
    }

    public async loadAllMaps(concurrency: number = 12): Promise<void> {
        const queue = this.placed.slice();
        let idx = 0;

        const worker = async () => {
            while (true) {
                const i = idx++;
                if (i >= queue.length) return;
                await this.ensureLoaded(queue[i]);
            }
        };

        const workers: Promise<void>[] = [];
        for (let i = 0; i < concurrency; i++)
            workers.push(worker());

        await Promise.all(workers);
    }

    private unload(key: number): void {
        const inst = this.loaded.get(key);
        if (inst) {
            inst.destroy(this.device);
            this.loaded.delete(key);
        }
    }

    protected override update(viewerInput: Viewer.ViewerRenderInput) {
        super.update(viewerInput);

        const camWorld = viewerInput.camera.worldMatrix;
        const camX = camWorld[12];
        const camZ = camWorld[14];

        const step = DPFullWorldRenderer['STEP'] ?? (640 * 16);
        this.camGX = Math.round(camX / step);
        this.camGZ = Math.round(camZ / step);

        if (this.envfxMan) {
            this.envfxMan.update(this.device, { viewerInput });
        }
    }

    protected override addWorldRenderInsts(
        device: GfxDevice,
        renderInstManager: GfxRenderInstManager,
        renderLists: SFARenderLists,
        sceneCtx: SceneRenderContext
    ) {
        const template = renderInstManager.pushTemplateRenderInst();
        fillSceneParamsDataOnTemplate(template, sceneCtx.viewerInput);

        const scratchColor0 = colorNewFromRGBA(1, 1, 1, 1);
        if (this.envfxMan) {
            this.envfxMan.getAmbientColor(scratchColor0, 0);
        } else {
            colorCopy(scratchColor0, White);
        }

        const modelCtx: ModelRenderContext = {
            sceneCtx,
            showDevGeometry: false,
            ambienceIdx: 0,
            showMeshes: true,
            outdoorAmbientColor: scratchColor0,
            setupLights: () => {},
            cullByAabb: false,
        };

        for (const [key, inst] of this.loaded) {
            const p = this.placedByKey.get(key);
            if (!p) continue;

            const dx = Math.abs(p.gx - this.camGX);
            const dz = Math.abs(p.gz - this.camGZ);
            const d = Math.max(dx, dz);

            const stride =
                (d <= 2)  ? 1 :   
                (d <= 8)  ? 1 :  
                (d <= 20) ? 1 :  
                          1;    

            inst.addRenderInsts(device, renderInstManager, renderLists, modelCtx, stride);
        }

        renderInstManager.popTemplateRenderInst();
    }

    public override destroy(device: GfxDevice): void {
        for (const inst of this.loaded.values())
            inst.destroy(device);
        this.loaded.clear();
        if (this.envfxMan) this.envfxMan.destroy(device);
        super.destroy(device);
    }
}

export class DPFullWorldSceneDesc implements Viewer.SceneDesc {
    constructor(public id: string, public name: string, private gameInfo: GameInfo = DP_GAME_INFO) {}

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
       cleanupTextureToggleUI();
        const gInfo = this.gameInfo;
        const dataFetcher = context.dataFetcher;

        const buf = await dataFetcher.fetchData(`${gInfo.pathBase}/globalmap.json`);
        const txt = new TextDecoder('utf-8').decode(buf.arrayBuffer as ArrayBuffer);
        const entries: DPGlobalMapEntry[] = JSON.parse(txt);

        const step = DPFullWorldRenderer['STEP'] ?? (640 * 16);

        const valid = entries.filter((e) => e.MapIndex !== -1);

        let minX = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxZ = -Infinity;

        for (const e of valid) {
          minX = Math.min(minX, e.CoordX);
          maxX = Math.max(maxX, e.CoordX);
          minZ = Math.min(minZ, e.CoordZ);
          maxZ = Math.max(maxZ, e.CoordZ);
        }

      //  console.log('DP globalmap bounds:', { minX, maxX, minZ, maxZ, count: valid.length });

        const placed: DPPlacedMap[] = valid.map((e) => {
          const gx = e.CoordX - minX;
          const gz = e.CoordZ - minZ;

          return {
            key: (e.MapIndex << 16) ^ ((gx & 0xff) << 8) ^ (gz & 0xff), 
            mapIndex: e.MapIndex,
            gx, gz,
            wx: gx * step,
            wz: gz * step,
          };
        });

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);
const texFetcher = await SFATextureFetcher.create(gInfo, dataFetcher, false);
texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);

        const blockFetcher = await DPBlockFetcher.create(
            gInfo, dataFetcher, materialFactory, Promise.resolve(texFetcher)
        );

        const renderer = new DPFullWorldRenderer(device, context, animController, materialFactory, gInfo, dataFetcher, blockFetcher, placed);

        const fakeWorld = {
            renderCache: (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
            gameInfo: gInfo,
            worldLights: renderer.worldLights,
            resColl: { texFetcher: texFetcher },
            objectMan: { createObjectInstance: () => ({ destroy: () => {} }) }
        } as unknown as World;

        try {
            renderer.envfxMan = await EnvfxManager.create(fakeWorld, dataFetcher);
            renderer.envfxMan.loadEnvfx(0); 
        } catch (e) {
            console.warn("Failed to load ENVFXACT.bin for DP Full World", e);
        }

        await renderer.loadAllMaps(8); 
        return renderer;
    }
}
export class CombinedOldIceMtSceneDesc implements Viewer.SceneDesc {
    constructor(
        public id: string, 
        public name: string, 
        private gameInfo: GameInfo = DP_GAME_INFO
    ) {}

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
       cleanupTextureToggleUI();
        const musicState = (window as any).musicState;
        if (musicState.audio) {
            musicState.audio.pause();
            musicState.audio.currentTime = 0;
            musicState.audio = null;
        }

       // console.log(`Creating scene for ${this.name} using combined bins with Sky/EnvFx...`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);

        const map23 = await loadMap(this.gameInfo, context.dataFetcher, 23); 
        const map24 = await loadMap(this.gameInfo, context.dataFetcher, 24); 
        const map25 = await loadMap(this.gameInfo, context.dataFetcher, 25); 

        const c1 = map23.getNumCols(), r1 = map23.getNumRows();
        const c2 = map24.getNumCols(), r2 = map24.getNumRows();
        const c3 = map25.getNumCols(), r3 = map25.getNumRows();

        const fetchSafe = async (name: string) => {
            try { 
                return await context.dataFetcher.fetchData(`${this.gameInfo.pathBase}/${name}`); 
            } catch { 
             //   console.warn(`Could not load ${name}. Rendering blank space.`);
                return { createDataView: () => new DataView(new ArrayBuffer(0)) }; 
            }
        };

        const bin1 = (await fetchSafe('0162 00A2 OldIceMt1 - block_ids.bin')).createDataView();
        const bin2 = (await fetchSafe('0169 00A9 OldIceMt2 - block_ids.bin')).createDataView();
        const bin3 = (await fetchSafe('0176 00B0 OldIceMt3 - block_ids.bin')).createDataView();

        const GAP = 2;
        const start1 = 0;
        const start2 = c1 + GAP;
        const start3 = start2 + c2 + GAP;
        
        const totalCols = start3 + c3;
        const totalRows = Math.max(r1, r2, r3); 

        const mapSceneInfo: MapSceneInfo = {
            getNumCols: () => totalCols,
            getNumRows: () => totalRows,
            getBlockInfoAt: (col: number, row: number): BlockInfo | null => {
                let offset = -1;
                let view: DataView | null = null;

                if (col >= start1 && col < start1 + c1 && row < r1) {
                    offset = (row * c1 + (col - start1)) * 4;
                    view = bin1;
                } else if (col >= start2 && col < start2 + c2 && row < r2) {
                    offset = (row * c2 + (col - start2)) * 4;
                    view = bin2;
                } else if (col >= start3 && col < start3 + c3 && row < r3) {
                    offset = (row * c3 + (col - start3)) * 4;
                    view = bin3;
                }

                if (!view || offset < 0 || offset >= view.byteLength) return null;

                const blockInfo = view.getUint32(offset);
                const sub = (blockInfo >>> 17) & 0x3F;
                const mod = (blockInfo >>> 23);

                if (mod === 0xff) return null;
                return { mod, sub };
            },
            getOrigin: () => [0, 0]
        };

        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = 'oldicemt_combined'; 

        const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
        texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);

        const fakeWorld: any = {
            renderCache: (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
            gameInfo: this.gameInfo,
            worldLights: mapRenderer.worldLights,
            resColl: { texFetcher: texFetcher },
            objectMan: { createObjectInstance: () => ({ destroy: () => {}, addRenderInsts: () => {} }) }
        };

        try {
            mapRenderer.envfxMan = await EnvfxManager.create(fakeWorld as World, context.dataFetcher);
            fakeWorld.envfxMan = mapRenderer.envfxMan; 
            mapRenderer.envfxMan.loadEnvfx(95); 
        } catch (e) {
            console.warn("Failed to load ENVFXACT.bin for Combined Map", e);
        }

        const blockFetcher = await DPBlockFetcher.create(
            this.gameInfo, context.dataFetcher, materialFactory, Promise.resolve(texFetcher)
        );

        await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

        setTimeout(async () => {
            const mr = mapRenderer as any;
            if (mr.envSelect) {
                const sequence = [95, 96, 97, 98, 99, 100];
                for (const val of sequence) {
                    mr.envSelect.setValue(val);
                    if (mr.envSelect.onvalue) {
                        await mr.envSelect.onvalue(val);
                    }
                    await new Promise(resolve => setTimeout(resolve, 16)); 
                }
            }
        }, 10);

        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}

export class YetiSceneDesc implements Viewer.SceneDesc {
    constructor(
        public id: string, 
        public name: string, 
        private gameInfo: GameInfo = DP_GAME_INFO
    ) {}

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
       cleanupTextureToggleUI();
        const musicState = (window as any).musicState;
        if (musicState.audio) { musicState.audio.pause(); musicState.audio.currentTime = 0; musicState.audio = null; }

        console.log(`Creating manual grid scene for ${this.name}...`);

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);

        const B = (absoluteId: number): BlockInfo => {
            return {
                mod: Math.floor(absoluteId / 64), 
                sub: absoluteId % 64              
            };
        };

        const LAYOUT: (BlockInfo | null)[][] = [
     [B(0x01e2),B(0x01e3),null,null,null,null,null,null,null,null,],        
    [null,B(0x01e4),null,null,null,null,null,null,null,null,],         
   [null,B(0x01e5),B(0x01e6), B(0x01e7),B(0x01e8),null,null,null,null,null,],          
  [null,null,B(0x01e9), B(0x01ea),B(0x01eb),null,null,null,null,null,],           
 [null,null,null, null,B(0x01ec),B(0x01ed),B(0x01ee),null,B(0x01Ef),null,],
 [ null,null,null, null,null,null,B(0x01F0),B(0x01F1), B(0x01F2),null,],
 [ null,null,null, null,B(0x01F3),B(0x01F4),B(0x01F5),B(0x01F6), B(0x01F7),null,],
 [null,null,null, null,B(0x01F9),B(0x01Fa), B(0x01Fb), B(0x01Fc), ], 
 [null,null,null, null,null,B(0x01Fd), B(0x01Fe),],
        ];

        const numRows = LAYOUT.length;
        const numCols = LAYOUT[0].length;

        const mapSceneInfo: MapSceneInfo = {
            getNumCols: () => numCols,
            getNumRows: () => numRows,
            getBlockInfoAt: (col: number, row: number): BlockInfo | null => {
                if (row >= numRows || col >= numCols) return null;
                return LAYOUT[row][col] || null;
            },
            getOrigin: () => [0, 0]
        };

        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = this.id; 

        const texFetcher = await SFATextureFetcher.create(this.gameInfo, context.dataFetcher, false);
        texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);


        const fakeWorld: any = {
            renderCache: (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
            gameInfo: this.gameInfo,
            worldLights: mapRenderer.worldLights,
            resColl: { texFetcher: texFetcher },
            objectMan: { createObjectInstance: () => ({ destroy: () => {}, addRenderInsts: () => {} }) }
        };

        try {
            mapRenderer.envfxMan = await EnvfxManager.create(fakeWorld as World, context.dataFetcher);
            fakeWorld.envfxMan = mapRenderer.envfxMan; 
            mapRenderer.envfxMan.loadEnvfx(95); 
        } catch (e) { console.warn("Failed to load ENVFXACT.bin", e); }

        const blockFetcher = await DPBlockFetcher.create(this.gameInfo, context.dataFetcher, materialFactory, Promise.resolve(texFetcher));
        await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

        setTimeout(async () => {
            const mr = mapRenderer as any;
            if (mr.envSelect) {
                for (const val of [95, 96, 97, 98, 99, 100]) {
                    mr.envSelect.setValue(val);
                    if (mr.envSelect.onvalue) await mr.envSelect.onvalue(val);
                    await new Promise(resolve => setTimeout(resolve, 16)); 
                }
            }
        }, 10);

        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}
