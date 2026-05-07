import * as Viewer from '../viewer.js';
import * as UI from '../ui.js';
import { Sky } from './Sky.js';
import { DPGameTextRenderer } from './gametext.js';
import { ObjectManager, ObjectInstance } from './objects.js';import { GfxrGraphBuilder, GfxrRenderTargetID, GfxrRenderTargetDescription } from '../gfx/render/GfxRenderGraph.js';
import { getSubdir } from './resource.js';
import { DataFetcher } from '../DataFetcher.js';
import { exportPlacedModelInstancesToGLB } from './gltf_export.js';
import { GfxRenderInstManager } from "../gfx/render/GfxRenderInstManager.js";
import { fillSceneParamsDataOnTemplate } from '../gx/gx_render.js';
import { GfxDevice, GfxWrapMode, GfxTexFilterMode, GfxMipFilterMode } from '../gfx/platform/GfxPlatform.js';
import { SceneContext } from '../SceneBase.js';
import { mat4, vec3 } from 'gl-matrix';
import { nArray } from '../util.js';
import { dataSubarray } from './util.js';import { White, colorCopy, colorNewFromRGBA } from '../Color.js';
import { ModelVersion, loadModel } from "./modelloader.js";import { SFARenderer, SceneRenderContext, SFARenderLists } from './render.js';
import { BlockFetcher, SFABlockFetcher, SwapcircleBlockFetcher, AncientBlockFetcher, EARLYDFPT, EARLYFEAR, EARLYDUPBLOCKFETCHER, EARLY1BLOCKFETCHER, EARLY2BLOCKFETCHER, EARLY3BLOCKFETCHER, EARLY4BLOCKFETCHER, DPBlockFetcher  } from './blocks.js';
import { SFA_GAME_INFO, SFADEMO_GAME_INFO, DP_GAME_INFO, GameInfo } from './scenes.js';
import { MaterialFactory } from './materials.js';
import { SFAAnimationController, ModanimCollection, AmapCollection, AnimCollection, applyAnimationToModel } from './animation.js';
import { SFATextureFetcher, FakeTextureFetcher, TextureFetcher } from './textures.js';import { Model, ModelRenderContext, ModelInstance, ModelFetcher, ModelShapes } from './models.js';
import { World } from './world.js';
import { EnvfxManager } from './envfx.js';
import { drawDPMinimap } from './dp_minimap.js';
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
const DP_VANILLA_COMPARE_INFO: GameInfo | null = {
    pathBase: 'dinosaurplanet_vanilla',
    subdirs: {},
};

export interface BlockInfo {
    mod: number;
    sub: number;
}
type SFAUnusedBlockEntry = {
    mod: number;
    sub: number;
    modelInst: ModelInstance;
};

type HitFootprintSnapshot = {
    gameLabel: string;
    mapNum: number;
    cols: number;
    rows: number;
    blocks: (BlockInfo | null)[][];
    hitLines: DPHitLineLocal[];

    displayName?: string;
    subtitle?: string;
    subtitleLines?: string[];

};

const SFA_MAP_NAMES: Record<number, string> = {
    0x00: 'Ship Battle',
    0x01: 'ZNot Used - Front End2',
    0x02: 'Dragon Rock - Top',
    0x03: 'ZNot Used - Krazoa Palace',
    0x04: 'Volcano Force Point',
    0x05: 'Rolling Demo - Just In Case',
    0x06: 'ZNot Used - Discovery Falls',
    0x07: 'ThornTail Hollow',
    0x08: 'ThornTail Hollow - Undergro',
    0x09: 'MazeTest',
    0x0A: 'SnowHorn Wastes',
    0x0B: 'Krazoa Palace',
    0x0C: 'CloudRunner Fortress',
    0x0D: 'Walled City',
    0x0E: 'LightFoot Village',
    0x0F: 'ZNot Used - CloudRunner - T',
    0x10: 'CloudRunner - Dungeon',
    0x11: 'ZNot Used - CloudRunner - T',
    0x12: 'Moon Mountain Pass',
    0x13: 'DarkIce Mines - Top',
    0x14: 'ZNot Used - Krazoa Shrine',
    0x15: 'Ocean Force Point - Bottom',
    0x16: 'krazchamber',
    0x17: 'Ice Mountain',
    0x18: 'ZNot Used - Ice Mountain 2',
    0x19: 'ZNot Used - Ice Mountain 3',
    0x1A: 'Animtest',
    0x1B: 'DarkIce Mines - Bottom',
    0x1C: 'BOSS DarkIce',
    0x1D: 'Cape Claw',
    0x1E: 'ZNot Used - Inside Galleon',
    0x1F: 'Test Of Combat',
    0x20: 'Test Of Fear',
    0x21: 'Test Of Skill',
    0x22: 'Test Of Knowledge',
    0x23: 'ZNot Used - Diamond Bay',
    0x24: 'ZNot Used - EarthWalker Tem',
    0x25: 'ZNot Used - Willow Grove',
    0x26: 'ArWing Level - Andross',
    0x27: 'Test Of Strength',
    0x28: 'BOSS Scales',
    0x29: 'World Map',
    0x2A: 'ZNot Used - WGShrine',
    0x2B: 'CloudRunner - Race',
    0x2C: 'BOSS Drakor',
    0x2D: 'ZNot Used - WMinsert',
    0x2E: 'ZNot Used - DarkIce Mines -',
    0x2F: 'ZNot Used - DarkIce Mines -',
    0x30: 'BOSS TRex',
    0x31: 'ZNot Used - MikesLava',
    0x32: 'Ocean Force Point - Top',
    0x33: 'Shop',
    0x34: 'Dragon Rock - Bottom',
    0x35: 'ZNot Used - BOSS Kamerian D',
    0x36: 'Magic Cave - Small\\Big',
    0x37: 'ZNot Used - Duster Cave',
    0x38: 'LinkB - Ice2Wastes',
    0x39: 'ZNot Used - CloudRunner2Rac',
    0x3A: 'Arwing to Planet',
    0x3B: 'Arwing Darkice',
    0x3C: 'Arwing Cloud',
    0x3D: 'Arwing City',
    0x3E: 'Arwing Dragon',
    0x3F: 'Game Front',
    0x40: 'LinkK - Nik Test',
    0x41: 'Great Fox',
    0x42: 'LinkA - Warpstone to Others',
    0x43: 'LinkC - Wastes to Hollow',
    0x44: 'LinkD - Darkmines top 2 bot',
    0x45: 'LinkE - hollow to moon pass',
    0x46: 'LinkF - moonpass to volcano',
    0x47: 'LinkG - hollow to lightfoot',
    0x48: 'LinkH - lightfoot to capecl',
    0x49: 'LinkJ - capeclaw 2 ocean fo',
    0x4A: 'LinkI - CloudRunner2Race',
    0x4B: 'dfpodium',
    0x4C: 'dfcradle',
    0x4D: 'dfcavehatch1',
    0x4E: 'dfcavehatch2',
    0x4F: 'scstatue',
    0x50: 'galleonship',
    0x51: 'cfgalleon',
    0x52: 'cfgangplank',
    0x53: 'nwtreebridge',
    0x54: 'cfdungeonblock',
    0x55: 'cloudrunnermap',
    0x56: 'ccBridge',
    0x57: 'cfcolumn',
    0x58: 'nwboulder',
    0x59: 'cfprisondoor',
    0x5A: 'cfprisoncage',
    0x5B: 'nwtreebridge2',
    0x5C: 'dim2 ice block1',
    0x5D: 'dimpushblock',
    0x5E: 'dim2 ice block2',
    0x5F: 'dimhornplinth',
    0x60: 'nwshcolpush',
    0x61: 'dim2lift',
    0x62: 'dim2icefloe',
    0x63: 'dim2icefloe1',
    0x64: 'dim2icefloe2',
    0x65: 'cfliftplat',
    0x66: 'imspacecraft',
    0x67: 'dimbossgut',
    0x68: 'wmcolrise',
    0x69: 'vfpslide1',
    0x6A: 'vfpslide2',
    0x6B: 'drpushcart',
    0x6C: 'drliftplat',
    0x6D: 'dim2stonepillar',
    0x6E: 'bossdrakorrock',
    0x6F: 'wcbouncycrate',
    0x70: 'wcpushblock',
    0x71: 'wctemplelift',
    0x72: 'kameriancolumn',
    0x73: 'dbstepstone',
    0x74: 'vfppushblock',
};

const DP_MAP_NAMES: Record<number, string> = {
    0: 'Front End',
    1: 'Front End2',
    2: 'Dragon Rock - Top',
    3: 'Krazoa Palace',
    4: 'Volcano Force Point',
    5: 'Rolling Demo',
    6: 'Discovery Falls',
    7: 'SwapStone Hollow',
    8: 'SwapStone Hollow 2',
    9: 'Golden Plains',
    10: 'Northern Wastes',
    11: 'Warlock Mountain',
    12: 'CloudRunner Fortress',
    13: 'Walled City',
    14: 'SwapStone Circle',
    15: 'CloudRunner - Treasure',
    16: 'CloudRunner - Dungeon',
    17: 'CloudRunner - TrapRooms',
    18: 'Moon Mountain Pass',
    19: 'DarkIce Mines Level 1',
    20: 'Krazoa Shrine',
    21: 'Desert Force Point Bottom',
    22: 'krazchamber',
    23: 'NewIceMt1',
    24: 'NewIceMt2',
    25: 'NewIceMt3',
    26: 'Animtest',
    27: 'DarkIce Mines Level 2',
    28: 'BOSS Galdon DIM3',
    29: 'CapeClaw',
    30: 'InsideGalleon',
    31: 'DFShrine',
    32: 'MMShrine',
    33: 'ECShrine',
    34: 'GPShrine',
    35: 'Diamond Bay',
    36: 'EarthWalker Temple',
    37: 'Willow Grove',
    38: 'BlackWater Canyon',
    39: 'DBShrine',
    40: 'NWShrine',
    41: 'CCShrine',
    42: 'WGShrine',
    43: 'CloudRunner - Race',
    44: 'BOSS Drakor',
    45: 'WMinsert',
    46: 'DarkIce Mines - Caves',
    47: 'DarkIce Mines - Lava',
    48: 'BOSS TRex',
    49: 'MikesLava',
    50: 'Desert Force Point Top',
    51: 'Swap Store',
    52: 'Dragon Rock - Bottom',
    53: 'BOSS Kamerian Dragon',
    54: 'Magic Cave - Small',
    55: 'dfpodium',
    56: 'dfcradle',
    57: 'dfcavehatch1',
    58: 'dfcavehatch2',
    59: 'scstatue',
    60: 'galleonship',
    61: 'cfgalleon',
    62: 'cfgangplank',
    63: 'nwtreebridge',
    64: 'cfdungeonblock',
    65: 'cloudrunnermap',
    66: 'cfledge',
    67: 'cfcolumn',
    68: 'nwboulder',
    69: 'cfprisondoor',
    70: 'cfprisoncage',
    71: 'nwtreebridge2',
    72: 'dimcannon',
    73: 'dimpushblock',
    74: 'dimcannonbase',
    75: 'dimhornplinth',
    76: 'nwshcolpush',
    77: 'dim2lift',
    78: 'dim2icefloe',
    79: 'dim2icefloe1',
    80: 'dim2icefloe2',
    81: 'cfliftplat',
    82: 'imspacecraft',
    83: 'dimbossgut',
    84: 'shlily',
    85: 'vfpslide1',
    86: 'vfpslide2',
    87: 'drpushcart',
    88: 'drliftplat',
    89: 'drhighplat',
    90: 'dim2stonepillar',
    91: 'bossdrakorrock',
    92: 'wcbouncycrate',
    93: 'wcpushblock',
    94: 'wctemplelift',
    95: 'kameriancolumn',
    96: 'dbstepstone',
    97: 'vfppushblock',
};

function getHitFootprintMapName(gameLabel: string, mapNum: number): string {
    const table = gameLabel === 'DP' ? DP_MAP_NAMES : SFA_MAP_NAMES;
    return table[mapNum] ?? 'Unknown map';
}

// ===================== DP SCALE OVERRIDES (DP ONLY) =====================
const DP_SCALE_MULT_BY_TYPE: Record<number, number> = {
     0x03FA: 0.15, 0x0071: 0.05, 0x036A: 0.15, 0x008A: 0.10, 0x03A4: 0.50,
     0x0178: 0.10, 0x0524: 0.30, 0x0523: 0.30, 0x020D: 0.30, 0x0076: 0.10,
     0x0358: 0.30, 0x0488: 10,0x0414: 1.5,
};

const DP_SCALE_MULT_BY_MODEL: Record<number, number> = {
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
interface DPHitsDB {
    tab: DataView;
    bin: DataView;
    trkblk: DataView;
}

interface DPHitLineLocal {
    x0: number;
    y0: number;
    z0: number;
    x1: number;
    y1: number;
    z1: number;
    blockId: number;
    rawTypeSettings: number;
}

function dpGetAbsoluteBlockNum(trkblk: DataView, blockInfo: BlockInfo): number | null {
    const mod = blockInfo.mod | 0;
    const sub = blockInfo.sub | 0;

    const offs = mod * 2;
    if (offs < 0 || offs + 2 > trkblk.byteLength)
        return null;

    const blockBase = trkblk.getUint16(offs, false);
    return blockBase + sub;
}

function dpGetHitsRangeForBlock(
    hitsTab: DataView,
    hitsBin: DataView,
    blockNum: number,
): { start: number; end: number } | null {
    const entryCount = hitsTab.byteLength >>> 2;

    if (blockNum < 0 || blockNum + 1 >= entryCount)
        return null;

    const start = hitsTab.getUint32(blockNum * 4, false);
    const end   = hitsTab.getUint32((blockNum + 1) * 4, false);

    if (start === 0xFFFFFFFF || end === 0xFFFFFFFF)
        return null;

    if (start > hitsBin.byteLength || end > hitsBin.byteLength || end < start)
        return null;

    return { start, end };
}

function dpParseHitLinesForBlock(
    hitsTab: DataView,
    hitsBin: DataView,
    blockNum: number,
    blockBaseX: number,
    blockBaseZ: number,
): DPHitLineLocal[] {
    const range = dpGetHitsRangeForBlock(hitsTab, hitsBin, blockNum);
    if (!range)
        return [];

    const out: DPHitLineLocal[] = [];
    const LINE_SIZE = 0x14;

    for (let offs = range.start; offs + LINE_SIZE <= range.end; offs += LINE_SIZE) {
        const ax = hitsBin.getInt16(offs + 0x00, false);
        const bx = hitsBin.getInt16(offs + 0x02, false);
        const ay = hitsBin.getInt16(offs + 0x04, false);
        const by = hitsBin.getInt16(offs + 0x06, false);
        const az = hitsBin.getInt16(offs + 0x08, false);
        const bz = hitsBin.getInt16(offs + 0x0A, false);

        const settingsA = hitsBin.getUint8(offs + 0x0E);
        let settingsB   = hitsBin.getUint8(offs + 0x0F);

        if (ax < 0 || bx < 0 || ax > 640 || bx > 640)
            settingsB = 0x40;
        if (az < 0 || bz < 0 || az > 640 || bz > 640)
            settingsB = 0x40;

        if (settingsB === 0x40)
            continue;

        out.push({
            x0: blockBaseX + ax,
            y0: ay,
            z0: blockBaseZ + az,
            x1: blockBaseX + bx,
            y1: by,
            z1: blockBaseZ + bz,
            blockId: blockNum,
            rawTypeSettings: (settingsA << 8) | settingsB,
        });
    }

    return out;
}
interface DPHitLineRawLocal {
    ax: number;
    ay: number;
    az: number;
    bx: number;
    by: number;
    bz: number;
    rawTypeSettings: number;
}

function dpReadRawHitLinesForRange(
    hitsBin: DataView,
    start: number,
    end: number,
): DPHitLineRawLocal[] {
    const out: DPHitLineRawLocal[] = [];
    const LINE_SIZE = 0x14;

    for (let offs = start; offs + LINE_SIZE <= end; offs += LINE_SIZE) {
        let allZero = true;
        for (let i = 0; i < LINE_SIZE; i++) {
            if (hitsBin.getUint8(offs + i) !== 0) {
                allZero = false;
                break;
            }
        }
        if (allZero)
            continue;

        out.push({
            ax: hitsBin.getInt16(offs + 0x00, false),
            bx: hitsBin.getInt16(offs + 0x02, false),
            ay: hitsBin.getInt16(offs + 0x04, false),
            by: hitsBin.getInt16(offs + 0x06, false),
            az: hitsBin.getInt16(offs + 0x08, false),
            bz: hitsBin.getInt16(offs + 0x0A, false),
            rawTypeSettings: hitsBin.getUint16(offs + 0x0E, false),
        });
    }

    return out;
}

function dpOverflow1D(v: number, min: number, max: number): number {
    if (v < min) return min - v;
    if (v > max) return v - max;
    return 0;
}

function dpGetBlockLocalXZBounds(inst: ModelInstance | null): { minX: number; maxX: number; minZ: number; maxZ: number } | null {
    if (!inst)
        return null;

    const model: any = (inst as any).model;
    const bbox: any = model?.bbox ?? model?.aabb ?? model?.modelBounds ?? null;
    if (!bbox)
        return null;

    if (
        typeof bbox.minX === 'number' &&
        typeof bbox.maxX === 'number' &&
        typeof bbox.minZ === 'number' &&
        typeof bbox.maxZ === 'number'
    ) {
        return {
            minX: bbox.minX,
            maxX: bbox.maxX,
            minZ: bbox.minZ,
            maxZ: bbox.maxZ,
        };
    }

    return null;
}

function dpGetBlockLocalXYZBounds(inst: ModelInstance | null): {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
} | null {
    if (!inst)
        return null;

    const model: any = (inst as any).model;
    const bbox: any = model?.bbox ?? model?.aabb ?? model?.modelBounds ?? null;
    if (!bbox)
        return null;

    if (
        typeof bbox.minX === 'number' &&
        typeof bbox.maxX === 'number' &&
        typeof bbox.minY === 'number' &&
        typeof bbox.maxY === 'number' &&
        typeof bbox.minZ === 'number' &&
        typeof bbox.maxZ === 'number'
    ) {
        return {
            minX: bbox.minX,
            maxX: bbox.maxX,
            minY: bbox.minY,
            maxY: bbox.maxY,
            minZ: bbox.minZ,
            maxZ: bbox.maxZ,
        };
    }

    if (bbox.min && bbox.max) {
        return {
            minX: bbox.min[0],
            maxX: bbox.max[0],
            minY: bbox.min[1],
            maxY: bbox.max[1],
            minZ: bbox.min[2],
            maxZ: bbox.max[2],
        };
    }

    return null;
}

function dpScoreSharedHitsAgainstBlock(
    rawLines: DPHitLineRawLocal[],
    inst: ModelInstance | null,
): number {
    const bounds = dpGetBlockLocalXZBounds(inst);
    if (!bounds)
        return Number.POSITIVE_INFINITY;

    const PAD = 4;

    const minX = bounds.minX - PAD;
    const maxX = bounds.maxX + PAD;
    const minZ = bounds.minZ - PAD;
    const maxZ = bounds.maxZ + PAD;

    let overflow = 0;

    let lineMinX = Number.POSITIVE_INFINITY;
    let lineMaxX = Number.NEGATIVE_INFINITY;
    let lineMinZ = Number.POSITIVE_INFINITY;
    let lineMaxZ = Number.NEGATIVE_INFINITY;

    for (const l of rawLines) {
        overflow += dpOverflow1D(l.ax, minX, maxX);
        overflow += dpOverflow1D(l.az, minZ, maxZ);
        overflow += dpOverflow1D(l.bx, minX, maxX);
        overflow += dpOverflow1D(l.bz, minZ, maxZ);

        if (l.ax < lineMinX) lineMinX = l.ax;
        if (l.bx < lineMinX) lineMinX = l.bx;
        if (l.ax > lineMaxX) lineMaxX = l.ax;
        if (l.bx > lineMaxX) lineMaxX = l.bx;

        if (l.az < lineMinZ) lineMinZ = l.az;
        if (l.bz < lineMinZ) lineMinZ = l.bz;
        if (l.az > lineMaxZ) lineMaxZ = l.az;
        if (l.bz > lineMaxZ) lineMaxZ = l.bz;
    }

    const boundsW = Math.max(0, maxX - minX);
    const boundsD = Math.max(0, maxZ - minZ);
    const linesW  = Math.max(0, lineMaxX - lineMinX);
    const linesD  = Math.max(0, lineMaxZ - lineMinZ);

  
    const slackX = Math.max(0, boundsW - linesW);
    const slackZ = Math.max(0, boundsD - linesD);

    const lineCenterX = (lineMinX + lineMaxX) * 0.5;
    const lineCenterZ = (lineMinZ + lineMaxZ) * 0.5;
    const blockCenterX = (minX + maxX) * 0.5;
    const blockCenterZ = (minZ + maxZ) * 0.5;

    const centerDist =
        Math.abs(lineCenterX - blockCenterX) +
        Math.abs(lineCenterZ - blockCenterZ);

    const boundsArea = boundsW * boundsD;


    return (
        overflow * 1000000 +
        (slackX + slackZ) * 64 +
        centerDist * 4 +
        boundsArea * 0.001
    );
}
function dpScoreHitLinesForCellLocal(lines: DPHitLineLocal[]): number {
    let score = 0;

    for (const l of lines) {
        const pts: [number, number][] = [
            [l.x0, l.z0],
            [l.x1, l.z1],
        ];

        for (const [x, z] of pts) {
            const overX = x < 0 ? -x : (x > 640 ? x - 640 : 0);
            const overZ = z < 0 ? -z : (z > 640 ? z - 640 : 0);
            score -= (overX + overZ) * 16;
            if (overX === 0) score += 4;
            if (overZ === 0) score += 4;
        }
    }

    return score;
}
function transformMapPoint(m: mat4, x: number, y: number, z: number): vec3 {
    return vec3.fromValues(
        m[0] * x + m[4] * y + m[8]  * z + m[12],
        m[1] * x + m[5] * y + m[9]  * z + m[13],
        m[2] * x + m[6] * y + m[10] * z + m[14],
    );
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
    getDPHitsDB?(): DPHitsDB | null;
}

function buildHitLinesForMapSceneInfo(info: MapSceneInfo): DPHitLineLocal[] {
    const db = info.getDPHitsDB?.() ?? null;
    if (!db)
        return [];

    const out: DPHitLineLocal[] = [];

    for (let row = 0; row < info.getNumRows(); row++) {
        for (let col = 0; col < info.getNumCols(); col++) {
            const blockInfo = info.getBlockInfoAt(col, row);
            if (!blockInfo)
                continue;

            const blockNum = dpGetAbsoluteBlockNum(db.trkblk, blockInfo);
            if (blockNum === null)
                continue;

            out.push(...dpParseHitLinesForBlock(
                db.tab,
                db.bin,
                blockNum,
                col * 640,
                row * 640,
            ));
        }
    }

    return out;
}
function buildHitFootprintSnapshot(
    gameLabel: string,
    mapNum: number,
    info: MapSceneInfo,
): HitFootprintSnapshot {
    const blocks: (BlockInfo | null)[][] = [];

    for (let row = 0; row < info.getNumRows(); row++) {
        const line: (BlockInfo | null)[] = [];
        for (let col = 0; col < info.getNumCols(); col++)
            line.push(info.getBlockInfoAt(col, row));
        blocks.push(line);
    }

    return {
        gameLabel,
        mapNum,
        cols: info.getNumCols(),
        rows: info.getNumRows(),
        blocks,
        hitLines: buildHitLinesForMapSceneInfo(info),
    };
}

type HitFootprintMapUsageIndex = {
    modToMaps: Map<number, Map<number, number>>;
    pairToMaps: Map<string, Map<number, number>>;
};

type HitFootprintUsageScan = {
    usedAbsBlocks: Set<number>;
    modToMaps: Map<number, Map<number, number>>;
    pairToMaps: Map<string, Map<number, number>>;
};

type HitFootprintUsageDB = {
    gameLabel: string;
    gameInfo: GameInfo;
    db: DPHitsDB;
    usedAbsBlocks: Set<number>;
    unusedAbsBlocks: number[];
    mapUsage: HitFootprintMapUsageIndex;
};

function getHitsTRKBLKFilenameForGameInfo(gameInfo: GameInfo): string {
    return gameInfo.pathBase.toLowerCase().includes('dinosaurplanet')
        ? 'TRKBLK.bin'
        : 'TRKBLK.tab';
}

function getAbsBlockAliasesFromTRKBLK(trkblk: DataView, absBlock: number): string[] {
    const out: string[] = [];
    const modCount = trkblk.byteLength >>> 1;

    for (let mod = 0; mod < modCount; mod++) {
        const base = trkblk.getUint16(mod * 2, false);
        if (base === 0xFFFF)
            continue;

        const sub = absBlock - base;
        if (sub >= 0 && sub < 64)
            out.push(`${mod}.${sub}`);
    }

    return out;
}

function getFirstBlockInfoAliasFromTRKBLK(trkblk: DataView, absBlock: number): BlockInfo | null {
    const aliases = getAbsBlockAliasesFromTRKBLK(trkblk, absBlock);
    if (aliases.length === 0)
        return null;

    const parts = aliases[0].split('.', 2);
    const mod = Number(parts[0]);
    const sub = Number(parts[1]);

    if (!Number.isFinite(mod) || !Number.isFinite(sub))
        return null;

    return { mod, sub };
}

function parseHitFootprintAlias(alias: string): BlockInfo | null {
    const parts = alias.split('.', 2);
    if (parts.length !== 2)
        return null;

    const mod = Number(parts[0]);
    const sub = Number(parts[1]);

    if (!Number.isFinite(mod) || !Number.isFinite(sub))
        return null;

    return {
        mod: mod | 0,
        sub: sub | 0,
    };
}

function mergeHitFootprintMapCounts(
    dst: Map<number, number>,
    src: Map<number, number> | undefined,
): void {
    if (!src)
        return;

    for (const [mapNum, count] of src)
        dst.set(mapNum, (dst.get(mapNum) ?? 0) + count);
}

function formatHitFootprintMapCountsShort(
    usage: HitFootprintUsageDB,
    counts: Map<number, number> | undefined,
    emptyText: string,
    maxItems: number = 5,
): string {
    if (!counts || counts.size === 0)
        return emptyText;

    const items = Array.from(counts.entries())
        .sort((a, b) => {
            if (b[1] !== a[1])
                return b[1] - a[1];
            return a[0] - b[0];
        });

    const shown = items.slice(0, maxItems).map(([mapNum, cellCount]) => {
        const mapName = getHitFootprintMapName(usage.gameLabel, mapNum);
        return `map ${mapNum} ${mapName} (${cellCount} cell${cellCount === 1 ? '' : 's'})`;
    });

    const remaining = items.length - shown.length;
    if (remaining > 0)
        shown.push(`+${remaining} more`);

    return shown.join('; ');
}

function buildAbsHitFootprintSubtitleLines(
    usage: HitFootprintUsageDB,
    absBlock: number,
    hitLineCount: number,
): string[] {
    const aliases = getAbsBlockAliasesFromTRKBLK(usage.db.trkblk, absBlock);
    const candidateCounts = new Map<number, number>();
    const aliasLines: string[] = [];

    for (const alias of aliases) {
        const blockInfo = parseHitFootprintAlias(alias);
        if (!blockInfo)
            continue;

        const candidateMaps = usage.mapUsage.modToMaps.get(blockInfo.mod);
        mergeHitFootprintMapCounts(candidateCounts, candidateMaps);

        if (aliasLines.length < 4) {
            aliasLines.push(
                `${alias} -> ` +
                formatHitFootprintMapCountsShort(
                    usage,
                    candidateMaps,
                    'no same-mod map found',
                    3,
                ),
            );
        }
    }

    const out: string[] = [];

    out.push(`UNUSED HITS | ${hitLineCount} line${hitLineCount === 1 ? '' : 's'}`);
    out.push(`aliases: ${aliases.length > 0 ? aliases.slice(0, 8).join(', ') : 'no TRKBLK alias'}`);
    out.push(
        `candidate maps: ` +
        formatHitFootprintMapCountsShort(
            usage,
            candidateCounts,
            'none',
            5,
        ),
    );

    for (const line of aliasLines)
        out.push(line);

    return out;
}

function bumpHitFootprintMapUsage<K>(
    dst: Map<K, Map<number, number>>,
    key: K,
    mapNum: number,
): void {
    let byMap = dst.get(key);
    if (!byMap) {
        byMap = new Map<number, number>();
        dst.set(key, byMap);
    }

    byMap.set(mapNum, (byMap.get(mapNum) ?? 0) + 1);
}

async function collectUsedAbsHitBlocksForGame(
    gameInfo: GameInfo,
    dataFetcher: DataFetcher,
    trkblk: DataView,
): Promise<HitFootprintUsageScan> {
    const usedAbsBlocks = new Set<number>();
    const modToMaps = new Map<number, Map<number, number>>();
    const pairToMaps = new Map<string, Map<number, number>>();

    const [mapsTabBuf, mapsBinBuf] = await Promise.all([
        dataFetcher.fetchData(`${gameInfo.pathBase}/MAPS.tab`, { allow404: true }),
        dataFetcher.fetchData(`${gameInfo.pathBase}/MAPS.bin`, { allow404: true }),
    ]);

    if (mapsTabBuf.byteLength === 0 || mapsBinBuf.byteLength === 0) {
        return {
            usedAbsBlocks,
            modToMaps,
            pairToMaps,
        };
    }

    const mapsTab = mapsTabBuf.createDataView();
    const mapsBin = mapsBinBuf.createDataView();
    const mapCount = Math.floor(mapsTab.byteLength / 0x1C);

    for (let mapNum = 0; mapNum < mapCount; mapNum++) {
        try {
            const entryOffs = mapNum * 0x1C;
            if (entryOffs + 0x08 > mapsTab.byteLength)
                continue;

            const infoOffset = mapsTab.getUint32(entryOffs + 0x00, false);
            const blockTableOffset = mapsTab.getUint32(entryOffs + 0x04, false);

            if (infoOffset === 0xFFFFFFFF || blockTableOffset === 0xFFFFFFFF)
                continue;
            if (infoOffset + 0x08 > mapsBin.byteLength)
                continue;

            const blockCols = mapsBin.getUint16(infoOffset + 0x00, false);
            const blockRows = mapsBin.getUint16(infoOffset + 0x02, false);

            if (blockCols <= 0 || blockRows <= 0 || blockCols > 256 || blockRows > 256)
                continue;

            const tableSize = blockCols * blockRows * 4;
            if (blockTableOffset + tableSize > mapsBin.byteLength)
                continue;

            const mapInfo = getMapInfo(mapsTab, mapsBin, mapNum);

            for (let row = 0; row < mapInfo.blockRows; row++) {
                for (let col = 0; col < mapInfo.blockCols; col++) {
                    const blockInfo = getBlockInfo(mapsBin, mapInfo, col, row);
                    if (!blockInfo)
                        continue;

                    bumpHitFootprintMapUsage(modToMaps, blockInfo.mod, mapNum);
                    bumpHitFootprintMapUsage(pairToMaps, `${blockInfo.mod}:${blockInfo.sub}`, mapNum);

                    const absBlock = dpGetAbsoluteBlockNum(trkblk, blockInfo);
                    if (absBlock !== null)
                        usedAbsBlocks.add(absBlock);
                }
            }
        } catch {
        }
    }

    return {
        usedAbsBlocks,
        modToMaps,
        pairToMaps,
    };
}

function collectUnusedAbsHitBlocks(db: DPHitsDB, usedAbsBlocks: Set<number>): number[] {
    const out: number[] = [];
    const entryCount = db.tab.byteLength >>> 2;

    for (let absBlock = 0; absBlock + 1 < entryCount; absBlock++) {
        if (usedAbsBlocks.has(absBlock))
            continue;

        const lines = dpParseHitLinesForBlock(
            db.tab,
            db.bin,
            absBlock,
            0,
            0,
        );

        if (lines.length > 0)
            out.push(absBlock);
    }

    return out;
}

async function loadHitFootprintUsageDB(
    gameLabel: string,
    gameInfo: GameInfo,
    dataFetcher: DataFetcher,
): Promise<HitFootprintUsageDB> {
    const trkblkName = getHitsTRKBLKFilenameForGameInfo(gameInfo);

    const [hitsTabBuf, hitsBinBuf, trkblkBuf] = await Promise.all([
        dataFetcher.fetchData(`${gameInfo.pathBase}/HITS.tab`, { allow404: true }),
        dataFetcher.fetchData(`${gameInfo.pathBase}/HITS.bin`, { allow404: true }),
        dataFetcher.fetchData(`${gameInfo.pathBase}/${trkblkName}`, { allow404: true }),
    ]);

    const db: DPHitsDB = {
        tab: hitsTabBuf.createDataView(),
        bin: hitsBinBuf.createDataView(),
        trkblk: trkblkBuf.createDataView(),
    };

    const usageScan = await collectUsedAbsHitBlocksForGame(
        gameInfo,
        dataFetcher,
        db.trkblk,
    );

    const usedAbsBlocks = usageScan.usedAbsBlocks;
    const unusedAbsBlocks = collectUnusedAbsHitBlocks(db, usedAbsBlocks);

    return {
        gameLabel,
        gameInfo,
        db,
        usedAbsBlocks,
        unusedAbsBlocks,
        mapUsage: {
            modToMaps: usageScan.modToMaps,
            pairToMaps: usageScan.pairToMaps,
        },
    };
}

function buildAbsHitFootprintSnapshot(
    usage: HitFootprintUsageDB,
    absBlock: number,
): HitFootprintSnapshot {
    const firstBlockInfo = getFirstBlockInfoAliasFromTRKBLK(usage.db.trkblk, absBlock);

    const hitLines = dpParseHitLinesForBlock(
        usage.db.tab,
        usage.db.bin,
        absBlock,
        0,
        0,
    );

    return {
        gameLabel: usage.gameLabel,
        mapNum: absBlock,
        cols: 1,
        rows: 1,
        blocks: [[firstBlockInfo]],
        hitLines,
        displayName: `absolute HITS block ${absBlock} / 0x${absBlock.toString(16).toUpperCase().padStart(4, '0')}`,
        subtitleLines: buildAbsHitFootprintSubtitleLines(usage, absBlock, hitLines.length),
    };
}

interface MapInstanceOptions {
    objectManager?: ObjectManager;
    galleryCenterBlock?: boolean;
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
    { x: -8850.365, y: -793.250, z: -6652.035, modelId: 0x03B1 }, // sun
    { x: -7150.133, y: -793.250, z: -8068.040, modelId: 0x03B2 }, // moon

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
     0x03C,0x000C,0x0258,0x0296,0x0A6,0x029,0x2AD,0x084, 0x03E0,0x03E3, 0x03E8, 0x043A, 0x043F,
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
    (objType as any)._dpHitFlags = 0;
    (objType as any)._dpHitRadius = 0;
    (objType as any)._dpHitTop = 0;
    (objType as any)._dpHitBottom = 0;

    if (defSize >= 0x98) {
        (objType as any)._dpHitFlags = objBin.getUint8(startOffs + 0x93);
        (objType as any)._dpHitTop = objBin.getInt16(startOffs + 0x94);
        (objType as any)._dpHitBottom = objBin.getInt16(startOffs + 0x96);
    }

    if (defSize >= 0xB8) {
        (objType as any)._dpHitRadius = objBin.getInt16(startOffs + 0xB6);
    }
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
function logUniqueTextureRequest(tag: string, mapId: string | number, id: number, useTex1: boolean): void {
    const w = window as any;
    const root = (w.__sfaTexReqLog ??= {});

    const bucketKey = `${tag}:${String(mapId)}`;
    let bucket = root[bucketKey] as {
        tag: string;
        mapId: string | number;
        seen: Set<string>;
        requests: Array<{ id: number; hex: string; bank: 'TEX0' | 'TEX1' }>;
    } | undefined;

    if (!bucket) {
        bucket = root[bucketKey] = {
            tag,
            mapId,
            seen: new Set<string>(),
            requests: [],
        };
    }

    const texId = id >>> 0;
    const bank: 'TEX0' | 'TEX1' = useTex1 ? 'TEX1' : 'TEX0';
    const dedupeKey = `${bank}:${texId}`;

    if (bucket.seen.has(dedupeKey))
        return;

    bucket.seen.add(dedupeKey);
    bucket.requests.push({
        id: texId,
        hex: `0x${texId.toString(16).toUpperCase()}`,
        bank,
    });

    console.warn(
       // `[${tag} TEX REQ] map=${mapId} id=${texId} hex=0x${texId.toString(16).toUpperCase()} bank=${bank}`
    );
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
            if (out.has(id)) continue; 

            const name = parts.slice(2).join(' ').trim();
            if (!name) continue;

            out.set(id & 0xFFFF, name);
        }
    } catch (e) {
        console.warn('Failed to load DPObjects2.txt', e);
    }

    return out;
}

type DPObjectEntry = {
    index: number;
    offset: number;
    typeNum: number;
    x: number;
    y: number;
    z: number;
    size: number;
    rawHex: string;
    noPosHex: string;
};

type DPObjectDiff = {
    available: boolean;
    message: string;
    added: DPObjectEntry[];
    removed: DPObjectEntry[];
    moved: Array<{ from: DPObjectEntry; to: DPObjectEntry }>;
    changed: Array<{ base: DPObjectEntry; current: DPObjectEntry }>;
};

function dpBytesHex(view: DataView, start: number, size: number, zeroPos: boolean = false): string {
    let s = '';
    for (let i = 0; i < size; i++) {
        const absolute = start + i;
        const inXYZ = absolute >= 0x08 && absolute < 0x14;
        const b = zeroPos && inXYZ ? 0 : view.getUint8(start + i);
        s += b.toString(16).padStart(2, '0');
    }
    return s;
}

async function loadDPObjectEntriesForMap(
    dataFetcher: DataFetcher,
    gameInfo: GameInfo,
    mapNum: number,
): Promise<DPObjectEntry[]> {
    const [tabBuf, binBuf] = await Promise.all([
        dataFetcher.fetchData(`${gameInfo.pathBase}/MAPS.tab`, { allow404: true }),
        dataFetcher.fetchData(`${gameInfo.pathBase}/MAPS.bin`, { allow404: true }),
    ]);

    if (tabBuf.byteLength === 0 || binBuf.byteLength === 0)
        throw new Error(`Missing MAPS.tab/bin in ${gameInfo.pathBase}`);

    const mapsTab = tabBuf.createDataView();
    const mapsBin = binBuf.createDataView();
    const info = getMapInfo(mapsTab, mapsBin, mapNum);

    if (!info.objectsOffset || !info.objectsSize || info.objectsSize <= 0)
        return [];

    const objData = dataSubarray(info.mapsBin, info.objectsOffset, info.objectsSize);
    const out: DPObjectEntry[] = [];

    let offset = 0;
    let index = 0;

    while (offset + 4 <= objData.byteLength) {
        const size = objData.getUint8(offset + 2) * 4;
        if (size <= 0 || offset + size > objData.byteLength)
            break;

        const typeNum = objData.getUint16(offset + 0x00);
        const x = size >= 0x0C ? objData.getFloat32(offset + 0x08) : 0;
        const y = size >= 0x10 ? objData.getFloat32(offset + 0x0C) : 0;
        const z = size >= 0x14 ? objData.getFloat32(offset + 0x10) : 0;

        out.push({
            index,
            offset,
            typeNum,
            x, y, z,
            size,
            rawHex: dpBytesHex(objData, offset, size, false),
            noPosHex: dpBytesHex(objData, offset, size, true),
        });

        offset += size;
        index++;
    }

    return out;
}

function dpObjDistSq(a: DPObjectEntry, b: DPObjectEntry): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
}

async function loadDPObjectDiff(
    dataFetcher: DataFetcher,
    currentInfo: GameInfo,
    baseInfo: GameInfo | null,
    mapNum: number,
): Promise<DPObjectDiff> {
    if (!baseInfo) {
        return {
            available: false,
            message: 'No vanilla compare folder configured.',
            added: [],
            removed: [],
            moved: [],
            changed: [],
        };
    }

    let base: DPObjectEntry[] = [];
    let current: DPObjectEntry[] = [];

    try {
        [base, current] = await Promise.all([
            loadDPObjectEntriesForMap(dataFetcher, baseInfo, mapNum),
            loadDPObjectEntriesForMap(dataFetcher, currentInfo, mapNum),
        ]);
    } catch (e) {
        return {
            available: false,
            message: String(e),
            added: [],
            removed: [],
            moved: [],
            changed: [],
        };
    }

    const matchedBase = new Set<number>();
    const matchedCurrent = new Set<number>();
    const changed: Array<{ base: DPObjectEntry; current: DPObjectEntry }> = [];
    const moved: Array<{ from: DPObjectEntry; to: DPObjectEntry }> = [];
    const added: DPObjectEntry[] = [];
    const removed: DPObjectEntry[] = [];

    const EPS_SQ = 2.0 * 2.0;

    for (let ci = 0; ci < current.length; ci++) {
        const c = current[ci];

        let bestBI = -1;
        let bestD = Infinity;

        for (let bi = 0; bi < base.length; bi++) {
            if (matchedBase.has(bi))
                continue;

            const b = base[bi];
            if (b.typeNum !== c.typeNum)
                continue;

            const d = dpObjDistSq(b, c);
            if (d < bestD) {
                bestD = d;
                bestBI = bi;
            }
        }

        if (bestBI >= 0 && bestD <= EPS_SQ) {
            matchedBase.add(bestBI);
            matchedCurrent.add(ci);

            const b = base[bestBI];
            if (b.rawHex !== c.rawHex)
                changed.push({ base: b, current: c });
        }
    }

    for (let ci = 0; ci < current.length; ci++) {
        if (matchedCurrent.has(ci))
            continue;

        const c = current[ci];

        let movedBI = -1;
        for (let bi = 0; bi < base.length; bi++) {
            if (matchedBase.has(bi))
                continue;

            const b = base[bi];
            if (b.typeNum === c.typeNum && b.noPosHex === c.noPosHex) {
                movedBI = bi;
                break;
            }
        }

        if (movedBI >= 0) {
            matchedBase.add(movedBI);
            matchedCurrent.add(ci);
            moved.push({ from: base[movedBI], to: c });
        }
    }

    for (let ci = 0; ci < current.length; ci++) {
        if (!matchedCurrent.has(ci))
            added.push(current[ci]);
    }

    for (let bi = 0; bi < base.length; bi++) {
        if (!matchedBase.has(bi))
            removed.push(base[bi]);
    }

    return {
        available: true,
        message: `Compared Dinosaur Planet Vanilla -> 2025_01_26 patched version     `,
        added,
        removed,
        moved,
        changed,
    };
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

async function collectDPDiamondBayTextureIds(
    dataFetcher: DataFetcher,
    materialFactory: MaterialFactory,
    texFetcher: TextureFetcher,
): Promise<number[]> {
    const DP_DIAMOND_BAY_MAP = 35;

    const mapInfo = await loadMap(DP_GAME_INFO, dataFetcher, DP_DIAMOND_BAY_MAP);

    const dpBlockFetcher = await DPBlockFetcher.create(
        DP_GAME_INFO,
        dataFetcher,
        materialFactory,
        Promise.resolve(texFetcher),
    );

    const seen = new Set<number>();

    for (let row = 0; row < mapInfo.getNumRows(); row++) {
        for (let col = 0; col < mapInfo.getNumCols(); col++) {
            const b = mapInfo.getBlockInfoAt(col, row);
            if (!b)
                continue;

            try {
                const model = await dpBlockFetcher.fetchBlock(b.mod, b.sub, dataFetcher);
                const mats = (((model as any)?.debugMaterialInfo ?? []) as any[]);

                for (const m of mats) {
                    const ids: number[] = Array.isArray(m?.texIds)
                        ? m.texIds
                        : typeof m?.texId === 'number'
                            ? [m.texId]
                            : [];

                    for (const id of ids) {
                        if (typeof id === 'number' && id >= 0)
                            seen.add(id | 0);
                    }
                }
            } catch (e) {
              //  console.warn(`[MOD49 DP TEX COLLECT] failed block mod=${b.mod} sub=${b.sub}`, e);
            }
        }
    }

    const ids = Array.from(seen.values()).sort((a, b) => a - b);

  //  console.warn(`[MOD49 DP TEX COLLECT] Diamond Bay texture IDs:`, ids);

    return ids;
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

function projectWorldToCanvasUnclamped(
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

    return {
        x: (ndcX * 0.5 + 0.5) * canvas.width,
        y: (-ndcY * 0.5 + 0.5) * canvas.height,
        depth: ndcZ,
    };
}

type MissingTextureLayerRef = {
    texId: number;
    useTex1: boolean | null;
};

type DebugLocalAABB = {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
};

type MissingTextureShapeHit = {
    shape: any;
    center: vec3;
    aabb: DebugLocalAABB | null;
    refs: MissingTextureLayerRef[];
};

const missingTextureProbeCache = new WeakMap<object, { tex0?: any; tex1?: any }>();
const missingTextureShapeHitCache = new WeakMap<object, MissingTextureShapeHit[]>();

function safeGetTextureForMissingDebug(
    texFetcher: any,
    cache: any,
    texId: number,
    useTex1: boolean,
): any {
    try {
        if (!texFetcher || typeof texFetcher.getTexture !== 'function')
            return null;

        return texFetcher.getTexture(cache, texId, useTex1);
    } catch {
        return null;
    }
}

function getMissingTextureProbe(
    texFetcher: any,
    cache: any,
    useTex1: boolean,
): any {
    if (!texFetcher || typeof texFetcher !== 'object')
        return null;

    let entry = missingTextureProbeCache.get(texFetcher);
    if (!entry) {
        entry = {};
        missingTextureProbeCache.set(texFetcher, entry);
    }

    if (useTex1) {
        if (entry.tex1 === undefined)
            entry.tex1 = safeGetTextureForMissingDebug(texFetcher, cache, 0x7FFE, true);
        return entry.tex1;
    } else {
        if (entry.tex0 === undefined)
            entry.tex0 = safeGetTextureForMissingDebug(texFetcher, cache, 0x7FFD, false);
        return entry.tex0;
    }
}

function debugTextureSameObject(a: any, b: any): boolean {
    if (!a || !b)
        return false;

    if (a === b)
        return true;

    if (a.viewerTexture && b.viewerTexture && a.viewerTexture === b.viewerTexture)
        return true;

    if (a.gfxTexture && b.gfxTexture && a.gfxTexture === b.gfxTexture)
        return true;

    if (a.texture && b.texture && a.texture === b.texture)
        return true;

    return false;
}

function debugTextureNameText(tex: any): string {
    const names = [
        tex?.name,
        tex?.debugName,
        tex?.viewerTexture?.name,
        tex?.viewerTexture?.debugName,
        tex?.viewerTexture?.extraInfo?.name,
        tex?.gfxTexture?.name,
        tex?.gfxTexture?.debugName,
    ];

    return names
        .filter((v) => typeof v === 'string')
        .join(' ')
        .toLowerCase();
}

function debugTextureResultLooksMissing(
    texFetcher: any,
    cache: any,
    tex: any,
    requestedTexId: number,
    useTex1: boolean,
): boolean {
    if (tex === null || tex === undefined)
        return true;

    if (
        tex.missing === true ||
        tex.isMissing === true ||
        tex.__missing === true ||
        tex.__isMissing === true ||
        tex.fallback === true ||
        tex.isFallback === true ||
        tex.__fallback === true ||
        tex.__isFallback === true
    )
        return true;

    const nameText = debugTextureNameText(tex);
    if (
        nameText.includes('missing') ||
        nameText.includes('checker') ||
        nameText.includes('checkboard') ||
        nameText.includes('placeholder') ||
        nameText.includes('fallback') ||
        nameText.includes('dummy') ||
        nameText.includes('invalid') ||
        nameText.includes('fake')
    )
        return true;

    const probe = getMissingTextureProbe(texFetcher, cache, useTex1);
    if (probe) {
        if (debugTextureSameObject(tex, probe))
            return true;

        const texW = Number(tex?.width ?? tex?.viewerTexture?.width ?? 0);
        const texH = Number(tex?.height ?? tex?.viewerTexture?.height ?? 0);
        const probeW = Number(probe?.width ?? probe?.viewerTexture?.width ?? 0);
        const probeH = Number(probe?.height ?? probe?.viewerTexture?.height ?? 0);

        const texName = debugTextureNameText(tex);
        const probeName = debugTextureNameText(probe);

        // Some fetchers return a new checker texture object per missing ID.
        // Object identity then fails, so compare the tiny generated fallback texture shape too.
        if (
            texW > 0 && texH > 0 &&
            texW === probeW &&
            texH === probeH &&
            (
                (texName !== '' && texName === probeName) ||
                (texW <= 32 && texH <= 32)
            )
        ) {
            return true;
        }
    }

    const actualId =
        tex.id ??
        tex.texId ??
        tex.textureId ??
        tex.sourceTexId ??
        tex.originalTexId;

    if (typeof actualId === 'number' && (actualId | 0) !== (requestedTexId | 0))
        return true;

    return false;
}

function getDebugLayerUseTex1(layer: any, fallback: boolean | null = null): boolean | null {
    if (typeof layer?.useTex1 === 'boolean')
        return layer.useTex1;

    if (typeof layer?.tex1 === 'boolean')
        return layer.tex1;

    if (typeof layer?.useTexture1 === 'boolean')
        return layer.useTexture1;

    if (typeof layer?.textureBank === 'number')
        return layer.textureBank === 1;

    if (typeof layer?.texBank === 'number')
        return layer.texBank === 1;

    if (typeof layer?.bank === 'number')
        return layer.bank === 1;

    return fallback;
}

function addDebugTextureRef(
    out: MissingTextureLayerRef[],
    texIdRaw: unknown,
    useTex1: boolean | null,
): void {
    if (typeof texIdRaw !== 'number')
        return;

    if (!Number.isFinite(texIdRaw) || texIdRaw < 0)
        return;

    const texId = texIdRaw | 0;

    if (out.some((r) => r.texId === texId && r.useTex1 === useTex1))
        return;

    out.push({ texId, useTex1 });
}

function collectDebugMaterialTextureRefs(material: any): MissingTextureLayerRef[] {
    const out: MissingTextureLayerRef[] = [];

    const realMaterial =
        typeof material?.getExportMaterial === 'function'
            ? material.getExportMaterial()
            : material;

    const shader =
        realMaterial?.shader ??
        realMaterial?.sfaShader ??
        realMaterial?.materialShader ??
        null;

    const scanLayer = (layer: any, fallbackUseTex1: boolean | null): void => {
        const useTex1 = getDebugLayerUseTex1(layer, fallbackUseTex1);

        addDebugTextureRef(out, layer?.texId, useTex1);
        addDebugTextureRef(out, layer?.textureId, useTex1);
        addDebugTextureRef(out, layer?.id, useTex1);

        if (Array.isArray(layer?.texIds)) {
            for (const id of layer.texIds)
                addDebugTextureRef(out, id, useTex1);
        }

        if (Array.isArray(layer?.textureIds)) {
            for (const id of layer.textureIds)
                addDebugTextureRef(out, id, useTex1);
        }
    };

    // SFA map materials actually request shader layer textures from TEX1.
    // This is why the first patch found nothing.
    const shaderLayerLists = [
        shader?.layers,
        shader?.textureLayers,
    ];

    for (const list of shaderLayerLists) {
        if (!Array.isArray(list))
            continue;

        for (const layer of list)
            scanLayer(layer, true);
    }

    const materialLayerLists = [
        realMaterial?.layers,
        realMaterial?.textureLayers,
    ];

    for (const list of materialLayerLists) {
        if (!Array.isArray(list))
            continue;

        for (const layer of list)
            scanLayer(layer, null);
    }

    addDebugTextureRef(out, shader?.reflectiveProbeMaskTexId, true);
    addDebugTextureRef(out, shader?.nbtTexId, true);
    addDebugTextureRef(out, shader?.furRegionsTexId, true);

    if (Array.isArray(realMaterial?.texIds)) {
        for (const id of realMaterial.texIds)
            addDebugTextureRef(out, id, null);
    }

    if (typeof realMaterial?.texId === 'number')
        addDebugTextureRef(out, realMaterial.texId, null);

    return out;
}

function debugTextureRefIsMissing(
    material: any,
    fallbackTexFetcher: any,
    fallbackCache: any,
    ref: MissingTextureLayerRef,
): boolean {
    const realMaterial =
        typeof material?.getExportMaterial === 'function'
            ? material.getExportMaterial()
            : material;

    const texFetcher =
        realMaterial?.texFetcher ??
        realMaterial?.textureFetcher ??
        realMaterial?.shader?.texFetcher ??
        fallbackTexFetcher;

    const cache =
        realMaterial?.cache ??
        realMaterial?.renderCache ??
        fallbackCache;

    if (!texFetcher || typeof texFetcher.getTexture !== 'function')
        return false;

    const testBank = (useTex1: boolean): boolean => {
        const tex = safeGetTextureForMissingDebug(texFetcher, cache, ref.texId, useTex1);
        return debugTextureResultLooksMissing(texFetcher, cache, tex, ref.texId, useTex1);
    };

    if (ref.useTex1 !== null)
        return testBank(ref.useTex1);

    // Unknown bank. Only mark missing if neither bank can provide it.
    // This avoids false positives when the same ID exists in TEX0 but not TEX1, or vice versa.
    return testBank(false) && testBank(true);
}

function getDebugShapeLocalAABB(shape: any): DebugLocalAABB | null {
    const candidates = [
        shape?.geom?.aabb,
        shape?.geom?.bbox,
        shape?.geom?.bounds,
        shape?.aabb,
        shape?.bbox,
        shape?.bounds,
    ];

    for (const aabb of candidates) {
        if (!aabb)
            continue;

        if (aabb.min && aabb.max) {
            return {
                minX: aabb.min[0],
                maxX: aabb.max[0],
                minY: aabb.min[1],
                maxY: aabb.max[1],
                minZ: aabb.min[2],
                maxZ: aabb.max[2],
            };
        }

        if (
            typeof aabb.minX === 'number' &&
            typeof aabb.maxX === 'number' &&
            typeof aabb.minY === 'number' &&
            typeof aabb.maxY === 'number' &&
            typeof aabb.minZ === 'number' &&
            typeof aabb.maxZ === 'number'
        ) {
            return {
                minX: aabb.minX,
                maxX: aabb.maxX,
                minY: aabb.minY,
                maxY: aabb.maxY,
                minZ: aabb.minZ,
                maxZ: aabb.maxZ,
            };
        }

        if (aabb.center) {
            const cx = aabb.center[0];
            const cy = aabb.center[1];
            const cz = aabb.center[2];

            return {
                minX: cx, maxX: cx,
                minY: cy, maxY: cy,
                minZ: cz, maxZ: cz,
            };
        }
    }

    return null;
}

function getDebugShapeLocalCenter(shape: any, dst: vec3 = vec3.create()): vec3 | null {
    const aabb = getDebugShapeLocalAABB(shape);
    if (!aabb)
        return null;

    dst[0] = (aabb.minX + aabb.maxX) * 0.5;
    dst[1] = (aabb.minY + aabb.maxY) * 0.5;
    dst[2] = (aabb.minZ + aabb.maxZ) * 0.5;
    return dst;
}

function collectMissingTextureShapeHits(
    modelInst: ModelInstance,
    fallbackTexFetcher: any,
    fallbackCache: any,
): MissingTextureShapeHit[] {
    const cached = missingTextureShapeHitCache.get(modelInst as any);
    if (cached)
        return cached;

    const hits: MissingTextureShapeHit[] = [];
    const modelShapes = (modelInst as any).getModelShapes?.();

    const scanShape = (shape: any): void => {
        if (!shape)
            return;

        const shapeMaterial = shape.material ?? shape.shapeMaterial ?? shape.drawMaterial;
        if (!shapeMaterial)
            return;

        const material =
            typeof shapeMaterial?.getExportMaterial === 'function'
                ? shapeMaterial.getExportMaterial()
                : shapeMaterial;

        if (!material)
            return;

        const refs = collectDebugMaterialTextureRefs(material);
        if (refs.length === 0)
            return;

        const missingRefs: MissingTextureLayerRef[] = [];

        for (const ref of refs) {
            if (debugTextureRefIsMissing(material, fallbackTexFetcher, fallbackCache, ref))
                missingRefs.push(ref);
        }

        if (missingRefs.length === 0)
            return;

        const center = getDebugShapeLocalCenter(shape);
        if (!center)
            return;

        hits.push({
            shape,
            center: vec3.clone(center),
            aabb: getDebugShapeLocalAABB(shape),
            refs: missingRefs,
        });
    };

    const shapeLists = Array.isArray(modelShapes?.shapes) ? modelShapes.shapes : [];
    for (const shapeList of shapeLists) {
        if (Array.isArray(shapeList)) {
            for (const shape of shapeList)
                scanShape(shape);
        } else {
            scanShape(shapeList);
        }
    }

    const waters = Array.isArray(modelShapes?.waters) ? modelShapes.waters : [];
    for (const water of waters)
        scanShape(water);

    const furs = Array.isArray(modelShapes?.furs) ? modelShapes.furs : [];
    for (const fur of furs)
        scanShape(fur?.shape ?? fur);

    missingTextureShapeHitCache.set(modelInst as any, hits);
    return hits;
}

function buildDebugBlockPlacementMatrix(map: any, b: BlockIter, dst: mat4): mat4 {
    if (map?.mapOpts?.galleryCenterBlock) {
        const bounds = dpGetBlockLocalXYZBounds(b.block);

        if (bounds) {
            const cx = (bounds.minX + bounds.maxX) * 0.5;
            const cy = (bounds.minY + bounds.maxY) * 0.5;
            const cz = (bounds.minZ + bounds.maxZ) * 0.5;

            const sx = Math.max(1, bounds.maxX - bounds.minX);
            const sy = Math.max(1, bounds.maxY - bounds.minY);
            const sz = Math.max(1, bounds.maxZ - bounds.minZ);
            const longest = Math.max(sx, sy, sz);

            const scale = Math.min(2.5, Math.max(0.15, 720 / longest));

            mat4.fromScaling(dst, [scale, scale, scale]);
            dst[12] = (-cx * scale) + 900;
            dst[13] = (-cy * scale) - 100;
            dst[14] = (-cz * scale) + 1200;
        } else {
            mat4.fromTranslation(dst, [-320, -120, -320]);
        }
    } else {
        mat4.fromTranslation(dst, [640 * b.x, 0, 640 * b.z]);
    }

    mat4.mul(dst, map.getMapMatrix(), dst);
    return dst;
}

function getViewerTexturePanelName(vt: any): string {
    return String(
        vt?.name ??
        vt?.debugName ??
        vt?.extraInfo?.name ??
        vt?.viewerTexture?.name ??
        vt?.viewerTexture?.debugName ??
        ''
    );
}

function shortenTexturePanelName(name: string): string {
    const parts = name.split(/[\\/]/g).filter((s) => s.length > 0);

    // StarFoxAdventuresDemo/warlock/TEX1.bin #1005 -> warlock/TEX1.bin #1005
    if (parts.length >= 2)
        return parts.slice(-2).join('/');

    return name;
}

function inferTexturePanelNameForRef(
    ref: MissingTextureLayerRef,
    textureHolder: UI.TextureListHolder | null | undefined,
): string | null {
    const viewerTextures = ((textureHolder as any)?.viewerTextures ?? []) as any[];
    const bankName =
        ref.useTex1 === true ? 'TEX1.bin' :
        ref.useTex1 === false ? 'TEX0.bin' :
        null;

    if (!bankName)
        return null;

    for (const vt of viewerTextures) {
        const name = getViewerTexturePanelName(vt);
        if (!name.includes(bankName))
            continue;

        const hash = name.lastIndexOf('#');
        if (hash < 0)
            continue;

        return `${name.slice(0, hash + 1)}${ref.texId >>> 0}`;
    }

    return null;
}

function formatMissingTextureRef(
    ref: MissingTextureLayerRef,
    textureHolder?: UI.TextureListHolder | null,
): string {
    const hex = `0x${dpHex(ref.texId).toUpperCase()}`;
    const dec = `${ref.texId >>> 0}`;

    const inferred = inferTexturePanelNameForRef(ref, textureHolder);
    if (inferred)
        return `${shortenTexturePanelName(inferred)} (${hex})`;

    const bank =
        ref.useTex1 === true ? 'TEX1.bin ' :
        ref.useTex1 === false ? 'TEX0.bin ' :
        'TEX?.bin ';

    return `${bank}#${dec} (${hex})`;
}

function getDebugAABBCandidatePoints(aabb: DebugLocalAABB): Array<[number, number, number]> {
    const cx = (aabb.minX + aabb.maxX) * 0.5;
    const cy = (aabb.minY + aabb.maxY) * 0.5;
    const cz = (aabb.minZ + aabb.maxZ) * 0.5;

    return [
        [cx, cy, cz],

        [aabb.minX, aabb.minY, aabb.minZ],
        [aabb.maxX, aabb.minY, aabb.minZ],
        [aabb.minX, aabb.maxY, aabb.minZ],
        [aabb.maxX, aabb.maxY, aabb.minZ],
        [aabb.minX, aabb.minY, aabb.maxZ],
        [aabb.maxX, aabb.minY, aabb.maxZ],
        [aabb.minX, aabb.maxY, aabb.maxZ],
        [aabb.maxX, aabb.maxY, aabb.maxZ],

        [cx, aabb.minY, cz],
        [cx, aabb.maxY, cz],
        [aabb.minX, cy, cz],
        [aabb.maxX, cy, cz],
        [cx, cy, aabb.minZ],
        [cx, cy, aabb.maxZ],
    ];
}

function getProjectedDebugAABBLabelPoint(
    clipFromWorld: mat4,
    canvas: HTMLCanvasElement,
    placement: mat4,
    aabb: DebugLocalAABB,
    modelTranslate: any,
): { x: number; y: number; depth: number } | null {
    let best: { x: number; y: number; depth: number } | null = null;

    for (const [lx, ly, lz] of getDebugAABBCandidatePoints(aabb)) {
        const world = transformMapPoint(
            placement,
            lx + (modelTranslate[0] ?? 0),
            ly + (modelTranslate[1] ?? 0),
            lz + (modelTranslate[2] ?? 0),
        );

        const p = projectWorldToCanvas(
            clipFromWorld,
            canvas,
            world[0],
            world[1],
            world[2],
        );

        if (!p)
            continue;

        // Lower NDC depth is usually nearer. This puts the text on a visible edge/face,
        // not in the empty middle of a huge shape bounds.
        if (!best || p.depth < best.depth)
            best = p;
    }

    return best;
}

function drawProjectedDebugAABB(
    ctx: CanvasRenderingContext2D,
    clipFromWorld: mat4,
    canvas: HTMLCanvasElement,
    placement: mat4,
    aabb: DebugLocalAABB,
    modelTranslate: any,
): void {
    const corners: Array<[number, number, number]> = [
        [aabb.minX, aabb.minY, aabb.minZ],
        [aabb.maxX, aabb.minY, aabb.minZ],
        [aabb.maxX, aabb.maxY, aabb.minZ],
        [aabb.minX, aabb.maxY, aabb.minZ],

        [aabb.minX, aabb.minY, aabb.maxZ],
        [aabb.maxX, aabb.minY, aabb.maxZ],
        [aabb.maxX, aabb.maxY, aabb.maxZ],
        [aabb.minX, aabb.maxY, aabb.maxZ],
    ];

    const projected = corners.map(([lx, ly, lz]) => {
        const world = transformMapPoint(
            placement,
            lx + (modelTranslate[0] ?? 0),
            ly + (modelTranslate[1] ?? 0),
            lz + (modelTranslate[2] ?? 0),
        );

        return projectWorldToCanvasUnclamped(
            clipFromWorld,
            canvas,
            world[0],
            world[1],
            world[2],
        );
    });

    const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
    ];

    ctx.save();
    ctx.strokeStyle = 'rgba(255,32,32,0.95)';
    ctx.lineWidth = 2;

    for (const [a, b] of edges) {
        const p0 = projected[a];
        const p1 = projected[b];

        if (!p0 || !p1)
            continue;

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
    }

    ctx.restore();
}

// ===================== DP CURVES / ROUTE + FBFX + OBJ HIT DEBUG =====================

type DPCurveNode = {
    uid: number;
    curveType: number;
    pos: vec3;
    links: number[];
    name: string;
};

type DPCurveDB = {
    nodes: DPCurveNode[];
    byUid: Map<number, DPCurveNode>;
};

type DPCurveRouteResult = {
    uidPath: number[];
    distanceSq: number;
};

type DPFbfxSeed = {
    x: number;
    y: number;
    r: number;
    grow: number;
};

const DP_FBFX_OPTIONS: Array<{ id: number; label: string }> = [
    { id: 0,  label: '0 None' },
    { id: 1,  label: '1 Sine Waves' },
    { id: 2,  label: '2 Fade Out / Fade In' },
    { id: 3,  label: '3 Lerp' },
    { id: 4,  label: '4 Slide' },
    { id: 5,  label: '5 No-op' },
    { id: 6,  label: '6 Burn Paper Random' },
    { id: 7,  label: '7 Burn Paper Center' },
    { id: 8,  label: '8 Burn Paper Right' },
    { id: 9,  label: '9 Burn Paper Corners' },
    { id: 10, label: '10 Motion Blur' },
    { id: 11, label: '11 Fade Right / In' },
    { id: 12, label: '12 Fade Left / In' },
    { id: 13, label: '13 Fade Down / In' },
    { id: 14, label: '14 Fade Up / In' },
    { id: 15, label: '15 Fade Out' },
];

function dpNum(v: any, fallback: number = 0): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function dpCurveSqDist(a: vec3, b: vec3): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return dx * dx + dy * dy + dz * dz;
}

function dpNormalizeCurveNode(raw: any, fallbackUid: number): DPCurveNode | null {
    const uid = (raw?.uid ?? raw?.uID ?? raw?.id ?? fallbackUid) | 0;

    const x = dpNum(raw?.x ?? raw?.pos?.[0] ?? raw?.pos?.x, 0);
    const y = dpNum(raw?.y ?? raw?.pos?.[1] ?? raw?.pos?.y, 0);
    const z = dpNum(raw?.z ?? raw?.pos?.[2] ?? raw?.pos?.z, 0);

    const linksSrc = Array.isArray(raw?.links) ? raw.links : [];
    const links = [
        (linksSrc[0] ?? -1) | 0,
        (linksSrc[1] ?? -1) | 0,
        (linksSrc[2] ?? -1) | 0,
        (linksSrc[3] ?? -1) | 0,
    ];

    return {
        uid,
        curveType: (raw?.curveType ?? raw?.type ?? 0) | 0,
        pos: vec3.fromValues(x, y, z),
        links,
        name: String(raw?.name ?? ''),
    };
}

async function loadDPCurveDB(
    dataFetcher: DataFetcher,
    gameInfo: GameInfo,
    mapNum: number,
): Promise<DPCurveDB | null> {
    const tryPaths = [
        `${gameInfo.pathBase}/curves/${mapNum}.json`,
        `${gameInfo.pathBase}/curves/map_${mapNum}.json`,
        `${gameInfo.pathBase}/dp_curves/${mapNum}.json`,
    ];

    for (const path of tryPaths) {
        try {
            const buf = await dataFetcher.fetchData(path, { allow404: true });
            if (!buf || buf.byteLength === 0)
                continue;

            const text = new TextDecoder('utf-8').decode(buf.arrayBuffer as ArrayBuffer);
            const root = JSON.parse(text);
            const src = Array.isArray(root) ? root : (Array.isArray(root?.nodes) ? root.nodes : []);

            const nodes: DPCurveNode[] = [];
            const byUid = new Map<number, DPCurveNode>();

            for (let i = 0; i < src.length; i++) {
                const n = dpNormalizeCurveNode(src[i], i);
                if (!n)
                    continue;
                nodes.push(n);
                byUid.set(n.uid, n);
            }

            if (nodes.length > 0)
                return { nodes, byUid };
        } catch (e) {
        }
    }

    return null;
}

function dpSolveCurveRoute(
    curveDB: DPCurveDB,
    startUid: number,
    goalUid: number,
    maxIterations: number = 4096,
): DPCurveRouteResult | null {
    const start = curveDB.byUid.get(startUid);
    const goal  = curveDB.byUid.get(goalUid);

    if (!start || !goal)
        return null;

    type RoutePoint = {
        uid: number;
        goalDist: number;
        netDist: number;
        prevUid: number;
        visited: boolean;
    };

    const points = new Map<number, RoutePoint>();

    points.set(start.uid, {
        uid: start.uid,
        goalDist: dpCurveSqDist(start.pos, goal.pos),
        netDist: 0,
        prevUid: -1,
        visited: false,
    });

    let lastUid = -1;

    for (let iter = 0; iter < maxIterations; iter++) {
        let current: RoutePoint | null = null;

        for (const p of points.values()) {
            if (p.visited)
                continue;
            if (!current || (p.goalDist + p.netDist) < (current.goalDist + current.netDist))
                current = p;
        }

        if (!current)
            return null;

        lastUid = current.uid;

        if (current.uid === goal.uid)
            break;

        current.visited = true;

        const base = curveDB.byUid.get(current.uid);
        if (!base)
            continue;

        for (let i = 0; i < 4; i++) {
            const neighborUid = base.links[i] | 0;
            if (neighborUid < 0)
                continue;

            const neighbor = curveDB.byUid.get(neighborUid);
            if (!neighbor)
                continue;

            const dist = current.netDist + dpCurveSqDist(base.pos, neighbor.pos);
            const old = points.get(neighbor.uid);

            if (!old) {
                points.set(neighbor.uid, {
                    uid: neighbor.uid,
                    goalDist: dpCurveSqDist(neighbor.pos, goal.pos),
                    netDist: dist,
                    prevUid: current.uid,
                    visited: false,
                });
            } else if (!old.visited && dist < old.netDist) {
                old.netDist = dist;
                old.prevUid = current.uid;
            }
        }
    }

    if (lastUid !== goal.uid)
        return null;

    const goalPoint = points.get(goal.uid);
    if (!goalPoint)
        return null;

    const uidPath: number[] = [];
    let curUid = goal.uid;

    while (curUid >= 0) {
        uidPath.push(curUid);
        const p = points.get(curUid);
        if (!p)
            break;
        curUid = p.prevUid;
    }

    uidPath.reverse();

    return {
        uidPath,
        distanceSq: goalPoint.netDist,
    };
}

function dpDrawProjectedRing(
    ctx: CanvasRenderingContext2D,
    clipFromWorld: mat4,
    canvas: HTMLCanvasElement,
    cx: number,
    cy: number,
    cz: number,
    radius: number,
    segments: number = 20,
): void {
    let first = true;

    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const wx = cx + Math.cos(a) * radius;
        const wz = cz + Math.sin(a) * radius;
        const p = projectWorldToCanvas(clipFromWorld, canvas, wx, cy, wz);
        if (!p)
            continue;

        if (first) {
            ctx.moveTo(p.x, p.y);
            first = false;
        } else {
            ctx.lineTo(p.x, p.y);
        }
    }
    if (!first)
        ctx.stroke();
}

function dpDrawProjectedSegment(
    ctx: CanvasRenderingContext2D,
    clipFromWorld: mat4,
    canvas: HTMLCanvasElement,
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
): void {
    const p0 = projectWorldToCanvas(clipFromWorld, canvas, ax, ay, az);
    const p1 = projectWorldToCanvas(clipFromWorld, canvas, bx, by, bz);
    if (!p0 || !p1)
        return;

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
}

function dpBuildFbfxSeeds(effectId: number, width: number, height: number): DPFbfxSeed[] {
    const seeds: DPFbfxSeed[] = [];

    const push = (x: number, y: number, r: number, grow: number) => {
        seeds.push({ x, y, r, grow });
    };

    switch (effectId) {
    case 6: { // random
        for (let i = 0; i < 10; i++)
            push(Math.random() * width, Math.random() * height, 8 + Math.random() * 14, 90 + Math.random() * 110);
        break;
    }
    case 7: // center
        push(width * 0.5, height * 0.5, 12, Math.max(width, height) * 0.8);
        break;
    case 8: // right
        for (let i = 0; i < 4; i++)
            push(width - 10, (height * (i + 1)) / 5, 10, Math.max(width, height) * 0.75);
        break;
    case 9: // corners
        push(0, 0, 12, Math.max(width, height) * 0.75);
        push(width, 0, 12, Math.max(width, height) * 0.75);
        push(0, height, 12, Math.max(width, height) * 0.75);
        push(width, height, 12, Math.max(width, height) * 0.75);
        break;
    default:
        break;
    }

    return seeds;
}

export class MapInstance {
    public setBlockFetcher(blockFetcher: BlockFetcher) {
        this.blockFetcher = blockFetcher;
    }
    private matrix: mat4 = mat4.create(); 
    private invMatrix: mat4 = mat4.create();
    private numRows: number;
    private numCols: number;
    private blockInfoTable: (BlockInfo | null)[][] = []; 
    private blocks: (ModelInstance | null)[][] = []; 
    public objects: ObjectInstance[] = []; 
    public hitLines: DPHitLineLocal[] = [];
    private dpHitsDB: DPHitsDB | null = null;
    constructor(public info: MapSceneInfo, private blockFetcher: BlockFetcher, public mapOpts?: MapInstanceOptions, public world?: World) {
        this.numRows = info.getNumRows();
        this.numCols = info.getNumCols();
        this.dpHitsDB = info.getDPHitsDB?.() ?? null;
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

if (objParams.byteLength >= 0x20) {
    const flags = objParams.getUint16(0x04);
    const altYaw18 = objParams.getUint16(0x18);
    const altYaw1A = objParams.byteLength >= 0x1C ? objParams.getUint16(0x1A) : 0;
    const altYaw1C = objParams.byteLength >= 0x1E ? objParams.getUint16(0x1C) : 0;
    const altYaw28 = objParams.byteLength >= 0x14 ? objParams.getUint16(0x12) : 0;
    const altYaw10 = objParams.byteLength >= 0x14 ? objParams.getUint16(0x10) : 0;

    if (typeNum === 0x0527) {
        const yawByte = objParams.getUint8(0x1F); 

        if (yawByte === 0x3F) yawU = 0x4000;      
        else if (yawByte === 0xC0) yawU = 0xC000; 
        else yawU = yawByte << 8;
    } else {
        const TYPES_YAW_28 = new Set([0x0251, 0x03AF,0x0281, 0x007E, 0x04D9, 0x0011,0x0292,0x050C,]);
        const TYPES_YAW_10 = new Set([0x0409, 0x04F4,]);
        const TYPES_YAW_1C = new Set([0x01D3,0x0089, 0x057E,]);
        const TYPES_YAW_1A = new Set([0x01CC, 0x0439,0x00D0,0x050D,0x0520,0x051F,]);
        const TYPES_YAW_18 = new Set([
          0x0416,  0x04F9, 0x0501, 0x04De, 0x042e, 0x0450, 0x0497, 0x0178,0x03C2,
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
}

                        objInst.yaw = (yawU === 0xFFFF) ? 0 : (yawU / 0x10000) * (Math.PI * 2);
                        if (typeNum === 0x01D3 && objParams.byteLength >= 0x20) {
    const sideByte = objParams.getUint8(0x1F); // low byte of u1E
    if (sideByte >= 0x80) {
        objInst.yaw += Math.PI;
    }
}
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
    public getMapMatrix(): mat4 {
        return this.matrix;
    }

public setGalleryBlockInfo(blockInfo: BlockInfo): void {
    this.blockInfoTable = [[blockInfo]];
    this.blocks = [];
    this.hitLines = [];
}

public setDPGalleryBlockInfo(blockInfo: BlockInfo): void {
    this.setGalleryBlockInfo(blockInfo);
}

    public worldToMapPoint(x: number, y: number, z: number, dst: vec3 = vec3.create()): vec3 {
    dst[0] = this.invMatrix[0] * x + this.invMatrix[4] * y + this.invMatrix[8]  * z + this.invMatrix[12];
    dst[1] = this.invMatrix[1] * x + this.invMatrix[5] * y + this.invMatrix[9]  * z + this.invMatrix[13];
    dst[2] = this.invMatrix[2] * x + this.invMatrix[6] * y + this.invMatrix[10] * z + this.invMatrix[14];
    return dst;
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

if (this.mapOpts?.galleryCenterBlock) {
    const bounds = dpGetBlockLocalXYZBounds(b.block);

    if (bounds) {
        const cx = (bounds.minX + bounds.maxX) * 0.5;
        const cy = (bounds.minY + bounds.maxY) * 0.5;
        const cz = (bounds.minZ + bounds.maxZ) * 0.5;

        const sx = Math.max(1, bounds.maxX - bounds.minX);
        const sy = Math.max(1, bounds.maxY - bounds.minY);
        const sz = Math.max(1, bounds.maxZ - bounds.minZ);
        const longest = Math.max(sx, sy, sz);

        const scale = Math.min(2.5, Math.max(0.15, 720 / longest));

mat4.fromScaling(scratchMtx0, [scale, scale, scale]);
scratchMtx0[12] = (-cx * scale) + 900
scratchMtx0[13] = (-cy * scale) - 100;
scratchMtx0[14] = (-cz * scale) + 1200;
    } else {
        mat4.fromTranslation(scratchMtx0, [-320, -120, -320]);
    }
} else {
    mat4.fromTranslation(scratchMtx0, [640 * b.x, 0, 640 * b.z]);
}
            mat4.mul(scratchMtx0, this.matrix, scratchMtx0);
            b.block.addRenderInsts(device, renderInstManager, modelCtx, renderLists, scratchMtx0);
        }

const showAllObjects = (modelCtx as any).showAllObjects === true;
if (showAllObjects) {
for (let obj of this.objects) {
                if ((obj as any)._isDevDP && !(modelCtx as any).showDevObjects)
                    continue;

                const mi = (obj as any).modelInst as ModelInstance | undefined;
                if (!mi) {
                    obj.addRenderInsts(device, renderInstManager, renderLists, modelCtx as any);
                    continue;
                }

                const s = (obj as any)._dpScale ?? 1.0;
                const typeNum = ((((obj as any)._dpTypeNum ?? -1) as number) & 0xFFFF);

                mat4.fromTranslation(scratchObjMtx0, obj.position);
                mat4.rotateY(scratchObjMtx0, scratchObjMtx0, obj.yaw);

                if (typeNum === 0x01D3) {
                    mat4.rotateX(scratchObjMtx0, scratchObjMtx0, Math.PI * 0.5);
                }

                if (s !== 1.0)
                    mat4.scale(scratchObjMtx0, scratchObjMtx0, [s, s, s]);

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
                this.hitLines = [];
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
if (this.dpHitsDB) {
    this.hitLines = [];

    for (let z = 0; z < this.numRows; z++) {
        for (let x = 0; x < this.numCols; x++) {
            const blockInfo = this.blockInfoTable[z][x];
            if (!blockInfo)
                continue;

            const blockNum = dpGetAbsoluteBlockNum(this.dpHitsDB.trkblk, blockInfo);
            if (blockNum === null)
                continue;

            const blockBaseX = x * 640;
            const blockBaseZ = z * 640;

            const lines = dpParseHitLinesForBlock(
                this.dpHitsDB.tab,
                this.dpHitsDB.bin,
                blockNum,
                blockBaseX,
                blockBaseZ,
            );

            if (lines.length > 0) {
                console.warn(
                  //  `[DP HITS] cell=(${x},${z}) mod=${blockInfo.mod} sub=${blockInfo.sub} ` +
                 //   `blockNum=${blockNum} lines=${lines.length}`
                );
            }

            this.hitLines.push(...lines);
        }
    }

  //  console.warn(`[DP HITS] parsed ${this.hitLines.length} line segments for current map`);
}
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
    let dpHitsDB: DPHitsDB | null = null;
    const isDPPath = pathBase.toLowerCase().includes('dinosaurplanet');

    try {
        const trkblkName = isDPPath ? 'TRKBLK.bin' : 'TRKBLK.tab';

        const [hitsTabBuf, hitsBinBuf, trkblkBuf] = await Promise.all([
            dataFetcher.fetchData(`${pathBase}/HITS.tab`, { allow404: true }),
            dataFetcher.fetchData(`${pathBase}/HITS.bin`, { allow404: true }),
            dataFetcher.fetchData(`${pathBase}/${trkblkName}`, { allow404: true }),
        ]);

        const hitsTab = hitsTabBuf.createDataView();
        const hitsBin = hitsBinBuf.createDataView();
        const trkblk  = trkblkBuf.createDataView();

        if (hitsTab.byteLength > 0 && hitsBin.byteLength > 0 && trkblk.byteLength > 0) {
            dpHitsDB = {
                tab: hitsTab,
                bin: hitsBin,
                trkblk,
            };

          //  console.warn(`[MAP HITS] enabled for ${pathBase} map ${mapNum} using ${trkblkName}`);
        }
    } catch (e) {
        console.warn(`Failed to load map HITS for ${pathBase} map ${mapNum}`, e);
    
    }
return {
        getNumCols() { return mapInfo.blockCols; },
        getNumRows() { return mapInfo.blockRows; },
        getBlockInfoAt(col: number, row: number): BlockInfo | null {
            return blockTable[row][col];
        },
        getOrigin(): number[] {
            return [mapInfo.originX, mapInfo.originZ];
        },
        getObjectsData(): DataView | null {
            if (mapInfo.objectsOffset !== undefined && mapInfo.objectsSize !== undefined && mapInfo.objectsSize > 0) {
                return dataSubarray(mapInfo.mapsBin, mapInfo.objectsOffset, mapInfo.objectsSize);
            }
            return null;
        },
        getDPHitsDB(): DPHitsDB | null {
            return dpHitsDB;
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
const SFA_TEXTURE_ONLY_DEFAULT_TIME_BY_SUBDIR: Record<string, number> = {
    swaphol: 3,
    capeclaw: 3,
    darkicemines: 3,
    icemountain: 3,
    lightfoot: 4,
    mmpass: 4,
    nwastes: 3,
    volcano: 2,
    warlock: 0,
    wallcity: 2,
    dfptop: 3,
    dragrock: 1,
    crfort: 1,
    arwingdragon: 0,
};

const SFA_STYLE_SKY_SUBDIR_ALLOWLIST = new Set<string>([
    'swaphol',
    'capeclaw',
    'darkicemines',
    'icemountain',
    'lightfoot',
    'mmpass',
    'nwastes',
    'volcano',
    'warlock',
    'wallcity',
    'dfptop',
    'dragrock',
    'crfort',
]);

const ANCIENT_STYLE_SKY_MAPKEY_ALLOWLIST = new Set<string>([
    '3',
    '4',

    '7', //to edit CRF ancient
]);

function shouldUseSFAStyleSkyForSubdir(subdir: string): boolean {
    return subdir !== '' && SFA_STYLE_SKY_SUBDIR_ALLOWLIST.has(subdir);
}

function shouldUseAncientStyleSky(mapKey: string | number, primarySubdir: string): boolean {
    return primarySubdir !== '' && ANCIENT_STYLE_SKY_MAPKEY_ALLOWLIST.has(String(mapKey));
}

async function initSFAStyleMapEnv(
    mapRenderer: MapSceneRenderer,
    materialFactory: MaterialFactory,
    gameInfo: GameInfo,
    dataFetcher: DataFetcher,
    texFetcher: TextureFetcher,
    primarySubdir: string,
    envfxIndex: number = 0x241,
): Promise<void> {
    const fakeWorld = {
        renderCache: (materialFactory as any).cache ?? (materialFactory as any).getCache?.(),
        gameInfo,
        subdirs: [primarySubdir],
        worldLights: mapRenderer.worldLights,
        resColl: { texFetcher },
        objectMan: { createObjectInstance: () => ({ destroy: () => {} }) },
    } as any as World;

    mapRenderer.envfxMan = await EnvfxManager.create(fakeWorld, dataFetcher);
    (fakeWorld as any).envfxMan = mapRenderer.envfxMan;

    mapRenderer.envfxMan.setTimeOfDay(
        SFA_TEXTURE_ONLY_DEFAULT_TIME_BY_SUBDIR[primarySubdir] ?? 4
    );

    mapRenderer.envfxMan.loadEnvfx(envfxIndex);

    if ((mapRenderer.envfxMan as any).shouldForceTextureOnlySky?.())
        (mapRenderer.envfxMan as any).forceKioskTextureOnlySky();
}
class MapSceneRenderer extends SFARenderer {
    public showDevObjects = false;
    public showAllObjects = true;
    public isDPMapScene = false;
    public mapNum: string | number = -1;
    public dpMinimapMapId: number = -1;
public showMinimap = true;
public textureHolder: UI.TextureListHolder = { viewerTextures: [], onnewtextures: null };
private blockFetcherFactory?: () => Promise<BlockFetcher>;
private map!: MapInstance;
private dataFetcher!: DataFetcher;
private currentGameInfo!: GameInfo;
private currentTexFetcher: any;
private currentBlockFetcher: BlockFetcher | null = null;
private dpOverlayUIHidden = false;

private sfaUnusedBlocks: SFAUnusedBlockEntry[] = [];
private sfaUnusedBlocksBusy = false;
private sfaUnusedBlocksEnabled = false;
private sfaUnusedBlocksInfoPre: HTMLPreElement | null = null;
private sfaUnusedBlocksStatus = 'Not scanned.';






private drawHitFootprintSnapshotPanel(
    ctx: CanvasRenderingContext2D,
    snap: HitFootprintSnapshot | null,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    hitColor: string,
): void {
    ctx.fillStyle = 'rgba(0,0,0,0.84)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';

    if (!snap) {
        ctx.fillStyle = '#ffffff';
        ctx.fillText('not loaded', boxX + 10, boxY + 10);
        return;
    }

    const pad = 12;
    const headerH = 46;

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${snap.gameLabel} map ${snap.mapNum}`, boxX + 10, boxY + 8);

    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(
        `grid ${snap.cols}x${snap.rows} | HITS ${snap.hitLines.length}`,
        boxX + 10,
        boxY + 26,
    );

    const worldW = Math.max(1, snap.cols * 640);
    const worldH = Math.max(1, snap.rows * 640);

    const areaW = Math.max(1, boxW - pad * 2);
    const areaH = Math.max(1, boxH - headerH - pad * 2);

    const scale = Math.min(
        areaW / worldW,
        areaH / worldH,
    );

    const mapW = worldW * scale;
    const mapH = worldH * scale;

    const mapX = boxX + Math.floor((boxW - mapW) * 0.5);
    const mapY = boxY + headerH + pad + Math.floor((areaH - mapH) * 0.5);

    const sx = (x: number) => mapX + x * scale;
    const sy = (z: number) => mapY + z * scale;

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;

    for (let col = 0; col <= snap.cols; col++) {
        ctx.beginPath();
        ctx.moveTo(sx(col * 640), sy(0));
        ctx.lineTo(sx(col * 640), sy(worldH));
        ctx.stroke();
    }

    for (let row = 0; row <= snap.rows; row++) {
        ctx.beginPath();
        ctx.moveTo(sx(0), sy(row * 640));
        ctx.lineTo(sx(worldW), sy(row * 640));
        ctx.stroke();
    }

    if (scale * 640 >= 34) {
        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.82)';

        for (let row = 0; row < snap.rows; row++) {
            for (let col = 0; col < snap.cols; col++) {
                const b = snap.blocks[row]?.[col] ?? null;
                if (!b)
                    continue;

                ctx.fillText(
                    `${b.mod}.${b.sub}`,
                    sx(col * 640) + 3,
                    sy(row * 640) + 3,
                );
            }
        }
    }

    ctx.strokeStyle = hitColor;
    ctx.lineWidth = 1.6;

    for (const l of snap.hitLines) {
        ctx.beginPath();
        ctx.moveTo(sx(l.x0), sy(l.z0));
        ctx.lineTo(sx(l.x1), sy(l.z1));
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(mapX, mapY, mapW, mapH);
}

private drawMissingTextureLabelOverlay(viewerInput: Viewer.ViewerRenderInput): void {
    if (this.isDPMapScene)
        return;

    if (!this.showMissingTextureLabels)
        return;

    if (this.currentTexFetcher?.getTexturesEnabled?.() === false)
        return;

    const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
    if (!ctx)
        return;

    const canvas = ctx.canvas;

    const drawStatus = (msg: string): void => {
        ctx.save();
        ctx.font = '13px monospace';
        ctx.textBaseline = 'top';

        const w = Math.ceil(ctx.measureText(msg).width) + 12;
        const x = Math.max(8, canvas.width - w - 12);
        const y = 38;

        ctx.fillStyle = 'rgba(0,0,0,0.86)';
        ctx.fillRect(x, y, w, 22);

        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.strokeRect(x, y, w, 22);

        ctx.fillStyle = '#ffeb3b';
        ctx.fillText(msg, x + 6, y + 4);
        ctx.restore();
    };

    const clipFromWorld = getClipFromWorldMatrix(viewerInput);
    if (!clipFromWorld) {
        drawStatus('missing texture label: no clipFromWorld matrix');
        return;
    }

    const texFetcher = this.currentTexFetcher;
    const cache =
        (this.materialFactory as any).cache ??
        (this.materialFactory as any).getCache?.();

    if (!texFetcher) {
        drawStatus('missing texture label: no texFetcher');
        return;
    }

    if (!cache) {
        drawStatus('missing texture label: no material cache');
        return;
    }

    const placement = mat4.create();
    let totalMissingHits = 0;

    ctx.save();
    ctx.font = '13px monospace';
    ctx.textBaseline = 'top';

    for (const b of this.map.iterateBlocks()) {
        const hits = collectMissingTextureShapeHits(b.block, texFetcher, cache);
        totalMissingHits += hits.length;

        if (hits.length === 0)
            continue;

        buildDebugBlockPlacementMatrix(this.map, b, placement);

        for (const hit of hits) {
            const modelTranslate =
                (((b.block as any).model as any)?.modelTranslate ?? [0, 0, 0]) as any;

            if (hit.aabb) {
                drawProjectedDebugAABB(
                    ctx,
                    clipFromWorld,
                    canvas,
                    placement,
                    hit.aabb,
                    modelTranslate,
                );
            }

            let p = hit.aabb
                ? getProjectedDebugAABBLabelPoint(
                    clipFromWorld,
                    canvas,
                    placement,
                    hit.aabb,
                    modelTranslate,
                )
                : null;

            if (!p) {
                const world = transformMapPoint(
                    placement,
                    hit.center[0] + (modelTranslate[0] ?? 0),
                    hit.center[1] + (modelTranslate[1] ?? 0),
                    hit.center[2] + (modelTranslate[2] ?? 0),
                );

                p = projectWorldToCanvas(
                    clipFromWorld,
                    canvas,
                    world[0],
                    world[1],
                    world[2],
                );
            }

            if (!p)
                continue;

            const refs = hit.refs
                .slice(0, 2)
                .map((ref) => formatMissingTextureRef(ref, this.textureHolder))
                .join(' | ');

            const extra = hit.refs.length > 2 ? ` +${hit.refs.length - 2}` : '';

            const blockInfo = this.map.info.getBlockInfoAt(b.x, b.z);
            const blockText = blockInfo
                ? ` block ${blockInfo.mod}.${blockInfo.sub}`
                : ` cell ${b.x},${b.z}`;

            const label = `MISSING ${refs}${extra}${blockText}`;

            const textW = Math.ceil(ctx.measureText(label).width);
            const boxX = p.x + 10;
            const boxY = p.y - 11;
            const boxW = textW + 10;
            const boxH = 20;

            ctx.fillStyle = '#ff2020';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255,32,32,0.95)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x - 9, p.y);
            ctx.lineTo(p.x + 9, p.y);
            ctx.moveTo(p.x, p.y - 9);
            ctx.lineTo(p.x, p.y + 9);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255,32,32,0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x + 6, p.y);
            ctx.lineTo(boxX, boxY + 10);
            ctx.stroke();

            ctx.fillStyle = 'rgba(0,0,0,0.90)';
            ctx.fillRect(boxX, boxY, boxW, boxH);

            ctx.strokeStyle = 'rgba(255,32,32,0.95)';
            ctx.strokeRect(boxX, boxY, boxW, boxH);

            ctx.fillStyle = '#ff4040';
            ctx.fillText(label, boxX + 5, boxY + 3);
        }
    }

    if (totalMissingHits === 0) {
        drawStatus('missing texture label scanner active: 0 missing shape refs found');
    }

    ctx.restore();
}

private drawDPObjectDiffOverlay(viewerInput: Viewer.ViewerRenderInput): void {
    this.projectedDiffLabels = [];

    if (this.dpOverlayUIHidden)
        return;
    if (!this.isDPMapScene)
        return;
    if (!this.showObjectDiff)
        return;

    const diff = this.dpObjectDiff;
    if (!diff?.available)
        return;

    const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
    if (!ctx)
        return;

    const canvas = ctx.canvas;
    const clipFromWorld = getClipFromWorldMatrix(viewerInput);
    if (!clipFromWorld)
        return;

    const mapMtx = this.map.getMapMatrix();
    const [ox, oz] = this.map.info.getOrigin();

    ctx.save();
    ctx.font = '12px monospace';
    ctx.textBaseline = 'middle';

    const drawPoint = (
        e: DPObjectEntry,
        label: string,
        fill: string,
        lines: string[],
    ) => {
        const localX = e.x + ox * 640;
        const localY = e.y;
        const localZ = e.z + oz * 640;

        const world = transformMapPoint(mapMtx, localX, localY, localZ);
        const p = projectWorldToCanvas(clipFromWorld, canvas, world[0], world[1] + 25, world[2]);
        if (!p)
            return;

        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0,0,0,0.95)';
        ctx.lineWidth = 3;
        ctx.strokeText(label, p.x + 8, p.y);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, p.x + 8, p.y);

        this.projectedDiffLabels.push({
            x: p.x,
            y: p.y,
            w: Math.ceil(ctx.measureText(label).width),
            h: 16,
            lines,
        });
    };

    const diffLabel = (tag: string, typeNum: number): string => {
        const hex = `0x${dpHex(typeNum).toUpperCase()}`;
        const name = this.getDPObjectNameForType(typeNum);
        return name ? `${tag} ${hex} ${name}` : `${tag} ${hex}`;
    };

    for (const e of diff.added.slice(0, 150))
        drawPoint(e, diffLabel('ADD', e.typeNum), '#00ff55', this.buildDPDiffLines('ADD', e));

    for (const e of diff.removed.slice(0, 150))
        drawPoint(e, diffLabel('DEL', e.typeNum), '#ff3333', this.buildDPDiffLines('DEL', e));

    for (const e of diff.changed.slice(0, 150))
        drawPoint(e.current, diffLabel('CHG', e.current.typeNum), '#ffe100', this.buildDPDiffLines('CHG', e.current, e.base));

    for (const e of diff.moved.slice(0, 150))
        drawPoint(e.to, diffLabel('MOV', e.to.typeNum), '#55aaff', this.buildDPDiffLines('MOV', e.to, e.from));

    if (this.selectedDiffLines) {
ctx.font = '14px monospace';
const lineH = 18;
let boxW = 380;
        for (const line of this.selectedDiffLines)
            boxW = Math.max(boxW, Math.ceil(ctx.measureText(line).width) + 16);

        const boxH = 10 + this.selectedDiffLines.length * lineH + 8;
const boxX = (this.isDPMapScene && this.showMinimap) ? 400 : 8;
const boxY = canvas.height - boxH - 8;

        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(boxX, boxY, boxW, boxH);

        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        for (let i = 0; i < this.selectedDiffLines.length; i++) {
            ctx.fillStyle = i === 0 ? '#ffeb3b' : '#ffffff';
            ctx.fillText(this.selectedDiffLines[i], boxX + 8, boxY + 12 + i * lineH);
        }
    }

    ctx.restore();
}
private readonly onDPOverlayHideHotkey = (ev: KeyboardEvent) => {
    if (!this.isDPMapScene)
        return;

    if (ev.repeat)
        return;

    const tag = (ev.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
        return;

    if (ev.key === 'z' || ev.key === 'Z') {
        this.dpOverlayUIHidden = !this.dpOverlayUIHidden;

        const topBar = document.getElementById('dp-top-toggle-bar') as HTMLDivElement | null;
        if (topBar)
            topBar.style.display = this.dpOverlayUIHidden ? 'none' : 'flex';

        if (this.dpOverlayUIHidden)
            this.clearSelectedDebugObject();

        this.dpGameTextRenderer?.setUIVisible(this.showGameText && !this.dpOverlayUIHidden);
    }
};
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
public showHits = false;
public showHitVolumes = false;
public showMapWireframe = false;
public showMissingTextureLabels = false;
public showGameText = false;
public showObjectDiff = false;
private dpGameTextRenderer: DPGameTextRenderer | null = null;
private dpObjectDiff: DPObjectDiff | null = null;
private dpCurrentObjects: ObjectInstance[] | null = null;
private dpVanillaObjectMap: MapInstance | null = null;
private dpUsingVanillaObjects = false;
public setDPObjectDiff(diff: DPObjectDiff | null): void {
    this.dpObjectDiff = diff;
}

public setDPVanillaObjectMap(vanillaMap: MapInstance | null): void {
    this.dpVanillaObjectMap = vanillaMap;
}

public setDPUseVanillaObjects(enabled: boolean): void {
    if (!this.isDPMapScene)
        return;

    if (!this.dpCurrentObjects)
        this.dpCurrentObjects = this.map.objects;

    const useVanilla = enabled && this.dpVanillaObjectMap !== null;

    this.dpUsingVanillaObjects = useVanilla;
    this.map.objects = useVanilla
        ? this.dpVanillaObjectMap!.objects
        : this.dpCurrentObjects;

    this.clearSelectedDebugObject();
}

public showCurves = false;
public showCurveLabels = true;

private dpCurveDB: DPCurveDB | null = null;
private dpCurveStartUid = -1;
private dpCurveGoalUid = -1;
private dpCurvePathSet = new Set<number>();
private dpCurvePathOrder = new Map<number, number>();
private dpCurveDistanceSq = 0;

private dpFbfxCanvas: HTMLCanvasElement | null = null;
private dpFbfxCtx: CanvasRenderingContext2D | null = null;
private dpFbfxState = {
    active: false,
    effectId: 0,
    durationMs: 1200,
    startMs: 0,
    seeds: [] as DPFbfxSeed[],
    lastCamX: 0,
    lastCamZ: 0,
};
private selectedObject: ObjectInstance | null = null;
private selectedDiffLines: string[] | null = null;
private projectedDiffLabels: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    lines: string[];
}> = [];
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
    this.selectedDiffLines = null;
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

private pickDPDiffAtClientPos(clientX: number, clientY: number): string[] | null {
    if (!this.showObjectDiff || this.projectedDiffLabels.length === 0)
        return null;

    const canvas = this.debugOverlayCanvas;
    if (!canvas)
        return null;

    const rect = canvas.getBoundingClientRect();
    const mx = (clientX - rect.left) * (canvas.width / rect.width);
    const my = (clientY - rect.top) * (canvas.height / rect.height);

    for (const e of this.projectedDiffLabels) {
        const dx = e.x - mx;
        const dy = e.y - my;

        const hitMarker = (dx * dx + dy * dy) <= 18 * 18;
        const hitText =
            mx >= e.x + 6 &&
            mx <= e.x + 6 + e.w + 8 &&
            my >= e.y - 12 &&
            my <= e.y + 12;

        if (hitMarker || hitText)
            return e.lines;
    }

    return null;
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

const diffLines = this.pickDPDiffAtClientPos(ev.clientX, ev.clientY);
if (diffLines) {
    this.selectedDiffLines = diffLines;
    this.selectedObject = null;
    return;
}

this.selectedDiffLines = null;
this.selectedObject = this.pickDebugObjectAtClientPos(ev.clientX, ev.clientY);
};

private readonly onDebugOverlayContextMenu = (ev: MouseEvent) => {
    if (!this.selectedObject && !this.selectedDiffLines)
        return;

    ev.preventDefault();
    this.selectedObject = null;
    this.selectedDiffLines = null;
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

private buildDPDiffLines(kind: string, entry: DPObjectEntry, other?: DPObjectEntry): string[] {
    const name = this.getDPObjectNameForType(entry.typeNum);
    const title = `${kind} 0x${dpHex(entry.typeNum).toUpperCase()}${name ? ` ${name}` : ''}`;

    const lines = [
        title,
        `index=${entry.index} off=0x${entry.offset.toString(16)} size=0x${entry.size.toString(16)}`,
        `pos=(${entry.x.toFixed(2)}, ${entry.y.toFixed(2)}, ${entry.z.toFixed(2)})`,
    ];

    if (other && kind === 'MOV') {
        lines.push(
            `from=(${other.x.toFixed(2)}, ${other.y.toFixed(2)}, ${other.z.toFixed(2)})`,
            `to=(${entry.x.toFixed(2)}, ${entry.y.toFixed(2)}, ${entry.z.toFixed(2)})`,
        );
    }

    if (other && kind === 'CHG') {
        let count = 0;
        const maxBytes = Math.min(other.rawHex.length, entry.rawHex.length) >>> 1;

        for (let i = 0; i < maxBytes && count < 16; i++) {
            const a = other.rawHex.slice(i * 2, i * 2 + 2);
            const b = entry.rawHex.slice(i * 2, i * 2 + 2);
            if (a !== b) {
                lines.push(`+0x${i.toString(16).padStart(2, '0')}: ${a} -> ${b}`);
                count++;
            }
        }

        if (count === 16)
            lines.push('...more byte changes');
    }

    return lines;
}

private getDPObjectNameForType(typeNum: number): string {
    const scnId = typeNum & 0xFFFF;

    const extNameMap: Map<number, string> | undefined =
        (this.map.mapOpts?.objectManager as any)?._dpExternalNameMap;

    const extName = extNameMap?.get(scnId);
    if (extName && extName !== 'NULL')
        return extName;

    try {
        const ot = this.map.mapOpts?.objectManager?.getObjectType?.(scnId, false);
        const name = String((ot as any)?.name ?? (ot as any)?.objName ?? '').trim();

        if (name && name !== 'NULL')
            return name;
    } catch (e) {
    }

    return '';
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
        (() => {
        const hitFlags = ((((ot as any)?._dpHitFlags ?? 0) as number) & 0xFF);
        const hitRadius = ((((ot as any)?._dpHitRadius ?? 0) as number) * scale);
        const hitTop = ((((ot as any)?._dpHitTop ?? 0) as number) * scale);
        const hitBottom = ((((ot as any)?._dpHitBottom ?? 0) as number) * scale);
        return `hit=flags:0x${hitFlags.toString(16)} r=${hitRadius.toFixed(1)} top=${hitTop.toFixed(1)} bottom=${hitBottom.toFixed(1)}`;
    })(),
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
private drawDPHitOverlay(viewerInput: Viewer.ViewerRenderInput): void {
    if (this.dpOverlayUIHidden)
        return;
    if (!this.isDPMapScene)
        return;
    if (!this.showHits)
        return;
    if (!this.map.hitLines || this.map.hitLines.length === 0)
        return;

    const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
    if (!ctx)
        return;

    const canvas = ctx.canvas;
    const clipFromWorld = getClipFromWorldMatrix(viewerInput);
    if (!clipFromWorld)
        return;

    const mapMtx = this.map.getMapMatrix();

    const hitKinds = [
        { color: '#55ccff', name: 'Light blue - Small step up/off?' },
        { color: '#ffe100', name: 'Yellow - Invisible collision' },
        { color: '#ff55ff', name: 'Pink - Hanging ledge / ladder' },
        { color: '#55ff55', name: 'Green - Climbable' },
        { color: '#ff8844', name: 'Orange - Character jumps from' },
        { color: '#004cff', name: 'Dark blue - Fall' },
        { color: '#ffffff', name: 'White - Hop up' },
        { color: '#ff3333', name: 'Red - Step up / step off' },
    ];

const counts = new Map<number, number>();
for (const l of this.map.hitLines) {
    const type = l.rawTypeSettings & 0xFFFF;
    counts.set(type, (counts.get(type) ?? 0) + 1);
}

const labelSeen = new Set<number>();

    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.font = '13px monospace';
    ctx.textBaseline = 'middle';

    for (const l of this.map.hitLines) {
        const a = transformMapPoint(mapMtx, l.x0, l.y0, l.z0);
        const b = transformMapPoint(mapMtx, l.x1, l.y1, l.z1);

        const p0 = projectWorldToCanvasUnclamped(clipFromWorld, canvas, a[0], a[1], a[2]);
        const p1 = projectWorldToCanvasUnclamped(clipFromWorld, canvas, b[0], b[1], b[2]);

        if (!p0 || !p1)
            continue;

        const type = l.rawTypeSettings & 0xFFFF;
        const kind = hitKinds[type % hitKinds.length];

        ctx.strokeStyle = kind.color;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();

if (!labelSeen.has(type)) {
    labelSeen.add(type);

    const mx = Math.max(8, Math.min(canvas.width - 180, (p0.x + p1.x) * 0.5));
    const my = Math.max(16, Math.min(canvas.height - 16, (p0.y + p1.y) * 0.5));
    const label = `0x${type.toString(16).toUpperCase().padStart(4, '0')} ${kind.name.split(' - ')[1]}`;

    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(label, mx + 5, my);
    ctx.fillStyle = kind.color;
    ctx.fillText(label, mx + 5, my);
    ctx.lineWidth = 2.5;
}
    }

    const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const boxX = (this.isDPMapScene && this.showMinimap) ? 400 : 8;
    const boxY = 8;
    const lineH = 16;
    const shown = Math.min(rows.length, 12);
    const legendH = hitKinds.length * lineH;
    const boxW = 360;
    const boxH = 54 + shown * lineH + 10 + legendH;

    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`HITS lines: ${this.map.hitLines.length}`, boxX + 8, boxY + 14);
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`manual colour legend`, boxX + 8, boxY + 30);

    for (let i = 0; i < shown; i++) {
        const [type, count] = rows[i];
        const kind = hitKinds[type % hitKinds.length];
        ctx.fillStyle = kind.color;
        ctx.fillText(
            `0x${type.toString(16).toUpperCase().padStart(4, '0')} : ${count}`,
            boxX + 8,
            boxY + 48 + i * lineH,
        );
    }

    const legendY = boxY + 58 + shown * lineH;
    for (let i = 0; i < hitKinds.length; i++) {
        ctx.fillStyle = hitKinds[i].color;
        ctx.fillText(hitKinds[i].name, boxX + 8, legendY + i * lineH);
    }

    ctx.restore();
}


private drawDPMinimapOverlay(viewerInput: Viewer.ViewerRenderInput): void {
    if (this.dpOverlayUIHidden)
        return;

    if (!this.isDPMapScene)
        return;
    if (!this.showMinimap)
        return;
    if (this.dpMinimapMapId < 0)
        return;

    const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
    if (!ctx)
        return;

    const cache = ((this.materialFactory as any).cache ?? (this.materialFactory as any).getCache?.()) as any;
    if (!cache)
        return;

    const texFetcher = this.currentTexFetcher as any;
    if (!texFetcher || typeof texFetcher.getTextureByTextable !== 'function')
        return;

    drawDPMinimap({
        ctx,
        mapID: this.dpMinimapMapId,
        cameraWorldMatrix: viewerInput.camera.worldMatrix,
        worldToMapPoint: (x: number, y: number, z: number) => this.map.worldToMapPoint(x, y, z),
        origin: this.map.info.getOrigin() as [number, number],
        numCols: this.map.info.getNumCols(),
        numRows: this.map.info.getNumRows(),
        texFetcher,
        cache,
    });
}

public setDPCurveDB(curveDB: DPCurveDB | null): void {
    this.dpCurveDB = curveDB;
    this.dpCurveStartUid = -1;
    this.dpCurveGoalUid = -1;
    this.dpCurveDistanceSq = 0;
    this.dpCurvePathSet.clear();
    this.dpCurvePathOrder.clear();
}

public solveDPCurveRoute(startUid: number, goalUid: number): boolean {
    if (!this.dpCurveDB)
        return false;

    const result = dpSolveCurveRoute(this.dpCurveDB, startUid, goalUid);
    this.dpCurveStartUid = startUid | 0;
    this.dpCurveGoalUid = goalUid | 0;
    this.dpCurveDistanceSq = 0;
    this.dpCurvePathSet.clear();
    this.dpCurvePathOrder.clear();

    if (!result)
        return false;

    this.dpCurveDistanceSq = result.distanceSq;
    for (let i = 0; i < result.uidPath.length; i++) {
        const uid = result.uidPath[i] | 0;
        this.dpCurvePathSet.add(uid);
        this.dpCurvePathOrder.set(uid, i);
    }

    return true;
}

public clearDPCurveRoute(): void {
    this.dpCurveStartUid = -1;
    this.dpCurveGoalUid = -1;
    this.dpCurveDistanceSq = 0;
    this.dpCurvePathSet.clear();
    this.dpCurvePathOrder.clear();
}

public playDPFramebufferFX(effectId: number, durationMs: number = 1200): void {
    if (effectId === 0) {
        this.dpFbfxState.active = false;
        if (this.dpFbfxCtx && this.dpFbfxCanvas)
            this.dpFbfxCtx.clearRect(0, 0, this.dpFbfxCanvas.width, this.dpFbfxCanvas.height);
        return;
    }

    this.ensureDPFramebufferCanvas();

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.dpFbfxState.active = true;
    this.dpFbfxState.effectId = effectId | 0;
    this.dpFbfxState.durationMs = Math.max(100, durationMs | 0);
    this.dpFbfxState.startMs = performance.now();
    this.dpFbfxState.seeds = dpBuildFbfxSeeds(effectId | 0, width, height);
}

private ensureDPFramebufferCanvas(): void {
    if (this.dpFbfxCanvas && this.dpFbfxCtx)
        return;

    const canvas = document.createElement('canvas');
    canvas.id = 'dp-fbfx-overlay';
    canvas.style.position = 'fixed';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9990';

    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx)
        return;

    this.dpFbfxCanvas = canvas;
    this.dpFbfxCtx = ctx;
}

private drawDPFramebufferFXOverlay(viewerInput: Viewer.ViewerRenderInput): void {
    if (!this.dpFbfxCanvas || !this.dpFbfxCtx)
        return;

    const canvas = this.dpFbfxCanvas;
    const ctx = this.dpFbfxCtx;

    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(window.innerWidth));
    const h = Math.max(1, Math.floor(window.innerHeight));

    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!this.dpFbfxState.active)
        return;

    const now = performance.now();
    const t = (now - this.dpFbfxState.startMs) / this.dpFbfxState.durationMs;
    const clamped = Math.max(0, Math.min(1, t));

    if (clamped >= 1) {
        this.dpFbfxState.active = false;
        return;
    }

    const fadePulse = clamped < 0.5 ? (clamped * 2) : ((1 - clamped) * 2);

    ctx.save();

    switch (this.dpFbfxState.effectId) {
    case 1: { // SINE_WAVES
        const spread = (w * 0.5) * clamped;
        const amp = Math.max(12, w * 0.03);
        const centerX = w * 0.5;
        const leftX = centerX - spread;
        const rightX = centerX + spread;

        ctx.fillStyle = `rgba(0,0,0,${0.12 + fadePulse * 0.08})`;
        ctx.fillRect(0, 0, w, h);

        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';

        const drawWave = (baseX: number, sign: number) => {
            ctx.beginPath();
            for (let y = 0; y <= h; y += 8) {
                const x = baseX + Math.sin((y * 0.02) + (clamped * Math.PI * 8.0)) * amp * sign;
                if (y === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        };

        drawWave(leftX, -1);
        drawWave(rightX, 1);
        break;
    }

    case 3: { // LERP
        ctx.fillStyle = `rgba(255,255,255,${0.18 * (1 - clamped)})`;
        ctx.fillRect(0, 0, w, h);
        break;
    }

    case 4: { // SLIDE
        const slideW = Math.floor(w * clamped);
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, Math.max(0, w - slideW), h);
        break;
    }

    case 6:
    case 7:
    case 8:
    case 9: { // burn paper family
        ctx.fillStyle = 'rgba(0,0,0,0.94)';
        ctx.fillRect(0, 0, w, h);

        ctx.globalCompositeOperation = 'destination-out';
        for (const s of this.dpFbfxState.seeds) {
            const r = s.r + s.grow * clamped;
            const grad = ctx.createRadialGradient(s.x, s.y, Math.max(1, r * 0.25), s.x, s.y, r);
            grad.addColorStop(0.0, 'rgba(0,0,0,1)');
            grad.addColorStop(0.65, 'rgba(0,0,0,0.85)');
            grad.addColorStop(1.0, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';

        ctx.strokeStyle = 'rgba(255,180,90,0.55)';
        ctx.lineWidth = 2;
        for (const s of this.dpFbfxState.seeds) {
            const r = s.r + s.grow * clamped;
            ctx.beginPath();
            ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        break;
    }

    case 10: { // MOTION_BLUR 
        const cam = viewerInput.camera.worldMatrix;
        const camX = cam[12];
        const camZ = cam[14];
        const dx = (camX - this.dpFbfxState.lastCamX) * 0.04;
        const dz = (camZ - this.dpFbfxState.lastCamZ) * 0.04;
        this.dpFbfxState.lastCamX = camX;
        this.dpFbfxState.lastCamZ = camZ;

        for (let i = 0; i < 6; i++) {
            ctx.fillStyle = `rgba(255,255,255,${0.03 * (1 - i / 6)})`;
            ctx.fillRect(dx * i * 12, dz * i * 12, w, h);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        ctx.fillRect(0, 0, w, h);
        break;
    }

    case 11:
    case 12:
    case 13:
    case 14:
    case 15:
    case 2: { // fade family
        const alpha = (this.dpFbfxState.effectId === 15) ? clamped : fadePulse;

        ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, alpha))})`;
        ctx.fillRect(0, 0, w, h);

        let x0 = 0, y0 = 0, x1 = w, y1 = 0;
        if (this.dpFbfxState.effectId === 11) { x0 = w; y0 = 0; x1 = 0; y1 = 0; }
        if (this.dpFbfxState.effectId === 12) { x0 = 0; y0 = 0; x1 = w; y1 = 0; }
        if (this.dpFbfxState.effectId === 13) { x0 = 0; y0 = h; x1 = 0; y1 = 0; }
        if (this.dpFbfxState.effectId === 14) { x0 = 0; y0 = 0; x1 = 0; y1 = h; }

        if (this.dpFbfxState.effectId !== 2 && this.dpFbfxState.effectId !== 15) {
            const grad = ctx.createLinearGradient(x0, y0, x1, y1);
            grad.addColorStop(0.0, `rgba(255,255,255,${0.18 * alpha})`);
            grad.addColorStop(1.0, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
        }
        break;
    }

    case 5:
    default:
        break;
    }

    ctx.restore();
}

private drawDPCurveOverlay(viewerInput: Viewer.ViewerRenderInput): void {
    if (this.dpOverlayUIHidden)
        return;
    if (!this.isDPMapScene)
        return;
    if (!this.showCurves)
        return;
    if (!this.dpCurveDB)
        return;

    const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
    if (!ctx)
        return;

    const canvas = ctx.canvas;
    const clipFromWorld = getClipFromWorldMatrix(viewerInput);
    if (!clipFromWorld)
        return;

    const mapMtx = this.map.getMapMatrix();

    ctx.save();
    ctx.lineWidth = 1.5;

    for (const node of this.dpCurveDB.nodes) {
        for (const linkUid of node.links) {
            if (linkUid < 0 || linkUid <= node.uid)
                continue;

            const other = this.dpCurveDB.byUid.get(linkUid);
            if (!other)
                continue;

            const a = transformMapPoint(mapMtx, node.pos[0], node.pos[1], node.pos[2]);
            const b = transformMapPoint(mapMtx, other.pos[0], other.pos[1], other.pos[2]);

            const p0 = projectWorldToCanvas(clipFromWorld, canvas, a[0], a[1], a[2]);
            const p1 = projectWorldToCanvas(clipFromWorld, canvas, b[0], b[1], b[2]);
            if (!p0 || !p1)
                continue;

            const aOrd = this.dpCurvePathOrder.get(node.uid);
            const bOrd = this.dpCurvePathOrder.get(other.uid);
            const onRoute =
                aOrd !== undefined &&
                bOrd !== undefined &&
                Math.abs(aOrd - bOrd) === 1;

            ctx.strokeStyle = onRoute ? 'rgba(255,220,0,0.95)' : 'rgba(0,180,255,0.55)';
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
        }
    }

    ctx.font = '14px monospace';
    ctx.textBaseline = 'middle';

    for (const node of this.dpCurveDB.nodes) {
        const w = transformMapPoint(mapMtx, node.pos[0], node.pos[1], node.pos[2]);
        const p = projectWorldToCanvas(clipFromWorld, canvas, w[0], w[1], w[2]);
        if (!p)
            continue;

        const isStart = node.uid === this.dpCurveStartUid;
        const isGoal  = node.uid === this.dpCurveGoalUid;
        const isPath  = this.dpCurvePathSet.has(node.uid);

        ctx.fillStyle =
            isStart ? '#00ff88' :
            isGoal  ? '#ff5050' :
            isPath  ? '#ffe100' :
                      'rgba(255,255,255,0.85)';

        ctx.beginPath();
        ctx.arc(p.x, p.y, isStart || isGoal ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (this.showCurveLabels) {
            const label = node.name ? `${node.uid} ${node.name}` : `${node.uid}`;
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineWidth = 3;
            ctx.strokeText(label, p.x + 7, p.y);
            ctx.fillText(label, p.x + 7, p.y);
        }
    }

    ctx.restore();
}

private drawDPObjectHitOverlay(viewerInput: Viewer.ViewerRenderInput): void {
    if (this.dpOverlayUIHidden)
        return;
    if (!this.isDPMapScene)
        return;
    if (!this.showHitVolumes)
        return;

    const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
    if (!ctx)
        return;

    const canvas = ctx.canvas;
    const clipFromWorld = getClipFromWorldMatrix(viewerInput);
    if (!clipFromWorld)
        return;

    ctx.save();
    ctx.lineWidth = 1.2;

    for (const obj of this.map.objects) {
        if ((obj as any)._isDevDP && !this.showDevObjects)
            continue;

        const typeNum = ((((obj as any)._dpTypeNum ?? -1) as number) & 0xFFFF);
        const ot = this.map.mapOpts?.objectManager?.getObjectType?.(typeNum, false);
        if (!ot)
            continue;

        const scale = (((obj as any)._dpScale ?? 1.0) as number);
        const hitFlags = ((((ot as any)._dpHitFlags ?? 0) as number) & 0xFF);
        const rawRadius = (((ot as any)._dpHitRadius ?? 0) as number);
        const rawTop = (((ot as any)._dpHitTop ?? 0) as number);
        const rawBottom = (((ot as any)._dpHitBottom ?? 0) as number);

        const radius = Math.abs(rawRadius * scale);
        if (!Number.isFinite(radius) || radius <= 0.0)
            continue;

        const worldPos = this.map.getObjectWorldPosition(obj, scratchVec3a);
        let y0 = worldPos[1] - radius;
        let y1 = worldPos[1] + radius;

        const top = rawTop * scale;
        const bottom = rawBottom * scale;

        if (hitFlags & 0x02) {
            y0 = worldPos[1] + Math.min(top, bottom);
            y1 = worldPos[1] + Math.max(top, bottom);
        } else if (hitFlags & 0x01) {
            y0 = worldPos[1];
            y1 = worldPos[1] + radius;
        }

        const selected = obj === this.selectedObject;
        ctx.strokeStyle =
            selected ? 'rgba(255,255,0,0.98)' :
            ((hitFlags & 0x10) ? 'rgba(255,140,0,0.85)' : 'rgba(0,255,80,0.85)');

        dpDrawProjectedRing(ctx, clipFromWorld, canvas, worldPos[0], y0, worldPos[2], radius, 24);
        dpDrawProjectedRing(ctx, clipFromWorld, canvas, worldPos[0], y1, worldPos[2], radius, 24);

        const midY = (y0 + y1) * 0.5;
        if (Math.abs(y1 - y0) > 2.0)
            dpDrawProjectedRing(ctx, clipFromWorld, canvas, worldPos[0], midY, worldPos[2], radius, 24);

        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const x = worldPos[0] + Math.cos(a) * radius;
            const z = worldPos[2] + Math.sin(a) * radius;
            dpDrawProjectedSegment(ctx, clipFromWorld, canvas, x, y0, z, x, y1, z);
        }
    }

    ctx.restore();
}

private drawObjectDebugOverlay(viewerInput: Viewer.ViewerRenderInput): void {
    const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
    if (!ctx)
        return;

    const canvas = ctx.canvas;

    if (this.dpOverlayUIHidden) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.projectedObjectLabels = [];
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.projectedObjectLabels = [];

    if (!this.isDPMapScene)
        return;

    if (!this.showObjectLabels && !this.selectedObject)
        return;

    const clipFromWorld = getClipFromWorldMatrix(viewerInput);
    if (!clipFromWorld)
        return;

    ctx.save();
    try {

const labelFontPx = 20;
const labelLineH = 24;

const infoFontPx = 16;
const infoLineH = 20;
ctx.textBaseline = 'middle';
ctx.lineWidth = 3;
ctx.font = `${labelFontPx}px sans-serif`;

        for (const obj of this.map.objects) {
            if ((obj as any)._isDevDP && !this.showDevObjects)
                continue;

            const mi = (obj as any).modelInst as ModelInstance | undefined;
const lines = this.buildObjectDebugLines(obj);
const label = lines[0];
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
    h: labelLineH,
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
ctx.font = `${infoFontPx}px monospace`;
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
const boxX = (this.isDPMapScene && this.showMinimap) ? 400 : 8;
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

    } finally {
        ctx.restore();
    }
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
        this.currentBlockFetcher = fresh;
        this.map.setBlockFetcher(fresh);
    }
    await this.map.reloadBlocks(this.dataFetcher);
}

    public async initDPGameText(gameInfo: GameInfo, dataFetcher: DataFetcher): Promise<void> {
        if (this.dpGameTextRenderer !== null)
            return;

        const renderer = new DPGameTextRenderer(
            this.context,
            new SFAAnimationController(),
            new MaterialFactory(this.context.device),
        );

        await renderer.create(gameInfo, dataFetcher);
        renderer.setUIVisible(this.showGameText && !this.dpOverlayUIHidden);
        this.dpGameTextRenderer = renderer;
    }

    public setDPGameTextVisible(enabled: boolean): void {
        this.showGameText = enabled;
        this.dpGameTextRenderer?.setUIVisible(enabled && !this.dpOverlayUIHidden);
    }

public async create(info: MapSceneInfo, gameInfo: GameInfo, dataFetcher: DataFetcher, blockFetcher: BlockFetcher, mapOpts?: MapInstanceOptions): Promise<Viewer.SceneGfx> {
    this.dataFetcher = dataFetcher;
    this.currentBlockFetcher = blockFetcher;
    this.isDPMapScene = !!mapOpts?.dpMapScene;
    this.map = new MapInstance(info, blockFetcher, mapOpts);

    if (this.isDPMapScene) {
        this.installObjectDebugPicking();
        window.addEventListener('keydown', this.onDPOverlayHideHotkey, true);
    }

    await this.map.reloadBlocks(dataFetcher);

    const texFetcher = (blockFetcher as any)['texFetcher'];
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
    if (this.isDPMapScene) {
        this.envfxMan.setTimeOfDay(DP_ENV_DEFAULT.timeOfDay);
        const r = (this.envfxMan as any).loadEnvfx(DP_ENV_DEFAULT.envfxIndex);
        if (r && typeof r.then === 'function')
            await r;
    }

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
            }
            this.rebuildSky(this.currentTexFetcher, this.currentGameInfo);
        };
        envPanel.contents.append(this.envSelect.elem);

        panels.push(envPanel);
    }

    if (!this.isDPMapScene) {
        const renderPanel = new UI.Panel();
        renderPanel.setTitle(UI.RENDER_HACKS_ICON, 'Render');

        const showWireframe = new UI.Checkbox('Show map wireframe', this.showMapWireframe);
        showWireframe.onchanged = () => {
            this.showMapWireframe = showWireframe.checked;
        };
        renderPanel.contents.append(showWireframe.elem);

        const showMissingTextureLabels = new UI.Checkbox('Label missing texture surfaces', this.showMissingTextureLabels);
        showMissingTextureLabels.onchanged = () => {
            this.showMissingTextureLabels = showMissingTextureLabels.checked;
        };
        renderPanel.contents.append(showMissingTextureLabels.elem);


        const unusedSpacer = document.createElement('div');
        unusedSpacer.style.height = '8px';
        renderPanel.contents.appendChild(unusedSpacer);

        const unusedIntro = document.createElement('div');
        unusedIntro.style.whiteSpace = 'pre-wrap';
        unusedIntro.style.marginBottom = '8px';
        unusedIntro.textContent =
            'Unused SFA blocks\n' +
            'Scan for blocks that exist in the same block mod(s)\n' +
            'but are not placed in the current map.';
        renderPanel.contents.appendChild(unusedIntro);

        const showUnused = new UI.Checkbox('Show unused blocks', this.sfaUnusedBlocksEnabled);
        showUnused.onchanged = () => {
            this.sfaUnusedBlocksEnabled = showUnused.checked;
            this.refreshSFAUnusedBlocksText();
        };
        renderPanel.contents.append(showUnused.elem);

        const scanUnusedBtn = document.createElement('button');
        scanUnusedBtn.textContent = 'Scan Unused Blocks';
        scanUnusedBtn.style.display = 'block';
        scanUnusedBtn.style.marginTop = '8px';
        scanUnusedBtn.style.marginBottom = '8px';

        scanUnusedBtn.onclick = async () => {
            scanUnusedBtn.disabled = true;
            try {
                await this.scanSFAUnusedBlocks();
                showUnused.checked = this.sfaUnusedBlocksEnabled;
            } finally {
                scanUnusedBtn.disabled = false;
            }
        };
        renderPanel.contents.appendChild(scanUnusedBtn);

        const unusedInfoPre = document.createElement('pre');
        unusedInfoPre.style.whiteSpace = 'pre-wrap';
        unusedInfoPre.style.maxHeight = '260px';
        unusedInfoPre.style.overflow = 'auto';
        unusedInfoPre.style.margin = '0';
        renderPanel.contents.appendChild(unusedInfoPre);
        this.sfaUnusedBlocksInfoPre = unusedInfoPre;
        this.refreshSFAUnusedBlocksText();

        panels.push(renderPanel);
const exportPanel = new UI.Panel();
exportPanel.setTitle(UI.SAND_CLOCK_ICON, 'Export');

const layerModeLabel = document.createElement('div');
layerModeLabel.textContent = 'Texture Layer Source';
layerModeLabel.style.marginBottom = '4px';
exportPanel.contents.appendChild(layerModeLabel);

const layerModeSelect = document.createElement('select');
layerModeSelect.style.display = 'block';
layerModeSelect.style.width = '100%';
layerModeSelect.style.marginBottom = '8px';

for (const [value, text] of [
    ['auto', 'Auto'],
    ['tex0', 'Prefer TEX0'],
    ['tex1', 'Prefer TEX1'],
    ['last', 'Prefer Last Layer'],
] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    layerModeSelect.appendChild(option);
}

layerModeSelect.value = 'auto';
exportPanel.contents.appendChild(layerModeSelect);

const exportFastButton = document.createElement('button');
exportFastButton.textContent = 'Export Current World Map as GLB (Fast)';
exportFastButton.style.display = 'block';
exportFastButton.style.width = '100%';
exportFastButton.style.marginBottom = '6px';
exportFastButton.onclick = async () => {
    exportFastButton.disabled = true;
    exportTexturedButton.disabled = true;
    try {
        await this.exportCurrentMapGLB(false, layerModeSelect.value as 'auto' | 'tex0' | 'tex1' | 'last');
    } finally {
        exportFastButton.disabled = false;
        exportTexturedButton.disabled = false;
    }
};
exportPanel.contents.appendChild(exportFastButton);

const exportTexturedButton = document.createElement('button');
exportTexturedButton.textContent = 'Export Current World Map as GLB (With Textures)';
exportTexturedButton.style.display = 'block';
exportTexturedButton.style.width = '100%';
exportTexturedButton.style.marginBottom = '6px';
exportTexturedButton.onclick = async () => {
    exportFastButton.disabled = true;
    exportTexturedButton.disabled = true;
    try {
        await this.exportCurrentMapGLB(true, layerModeSelect.value as 'auto' | 'tex0' | 'tex1' | 'last');
    } finally {
        exportFastButton.disabled = false;
        exportTexturedButton.disabled = false;
    }
};
exportPanel.contents.appendChild(exportTexturedButton);

const exportNote = document.createElement('div');
exportNote.textContent = 'Auto usually prefers TEX1/UV1 when present.';
exportNote.style.fontSize = '12px';
exportNote.style.opacity = '0.8';
exportPanel.contents.appendChild(exportNote);

panels.push(exportPanel);
    }

    return panels;
}

private refreshSFAUnusedBlocksText(): void {
    if (this.sfaUnusedBlocksInfoPre === null)
        return;

    const lines: string[] = [
        this.sfaUnusedBlocksStatus,
        '',
        `unused blocks: ${this.sfaUnusedBlocks.length}`,
        `show strip: ${this.sfaUnusedBlocksEnabled ? 'yes' : 'no'}`,
        '',
        'These are blocks that exist in the same block mod(s)',
        'but are not placed in the current map.',
    ];

    if (this.sfaUnusedBlocks.length > 0) {
        lines.push('', 'first unused blocks:');
        for (const e of this.sfaUnusedBlocks.slice(0, 64))
            lines.push(`mod ${e.mod} sub ${e.sub}`);
    }

    this.sfaUnusedBlocksInfoPre.textContent = lines.join('\n');
}

private async scanSFAUnusedBlocks(): Promise<void> {
    if (this.isDPMapScene) {
        this.sfaUnusedBlocks = [];
        this.sfaUnusedBlocksEnabled = false;
        this.sfaUnusedBlocksStatus = 'Unused block scan is only for SFA map scenes.';
        this.refreshSFAUnusedBlocksText();
        return;
    }

    if (!this.currentBlockFetcher) {
        this.sfaUnusedBlocks = [];
        this.sfaUnusedBlocksEnabled = false;
        this.sfaUnusedBlocksStatus = 'Current block fetcher missing.';
        this.refreshSFAUnusedBlocksText();
        return;
    }

    if (this.sfaUnusedBlocksBusy)
        return;

    this.sfaUnusedBlocksBusy = true;
    this.sfaUnusedBlocksStatus = 'Scanning unused blocks...';
    this.refreshSFAUnusedBlocksText();

    for (const e of this.sfaUnusedBlocks)
        e.modelInst.destroy(this.context.device);
    this.sfaUnusedBlocks = [];

    try {
        const usedPairs = new Set<string>();
        const usedMods = new Set<number>();

        for (let row = 0; row < this.map.info.getNumRows(); row++) {
            for (let col = 0; col < this.map.info.getNumCols(); col++) {
                const b = this.map.info.getBlockInfoAt(col, row);
                if (!b)
                    continue;

                usedPairs.add(`${b.mod}:${b.sub}`);
                usedMods.add(b.mod);
            }
        }

        const mods = Array.from(usedMods.values()).sort((a, b) => a - b);
        const results: SFAUnusedBlockEntry[] = [];

        for (const mod of mods) {
            for (let sub = 0; sub < 64; sub++) {
                const key = `${mod}:${sub}`;
                if (usedPairs.has(key))
                    continue;

                let model: Model | null = null;
                try {
                    model = await this.currentBlockFetcher.fetchBlock(mod, sub, this.dataFetcher);
                } catch {
                    model = null;
                }

                if (!model)
                    continue;

                results.push({
                    mod,
                    sub,
                    modelInst: new ModelInstance(model),
                });
            }
        }

        results.sort((a, b) => {
            if (a.mod !== b.mod)
                return a.mod - b.mod;
            return a.sub - b.sub;
        });

        const keepShowEnabled = this.sfaUnusedBlocksEnabled;

        this.sfaUnusedBlocks = results;
        this.sfaUnusedBlocksEnabled = results.length > 0 ? keepShowEnabled : false;
        this.sfaUnusedBlocksStatus =
            results.length > 0
                ? `Found ${results.length} unused block(s) for this map.`
                : 'No unused blocks found for this map.';
    } catch (e) {
        console.error(e);
        this.sfaUnusedBlocks = [];
        this.sfaUnusedBlocksEnabled = false;
        this.sfaUnusedBlocksStatus = `Unused block scan failed: ${String(e)}`;
    } finally {
        this.sfaUnusedBlocksBusy = false;
        this.refreshSFAUnusedBlocksText();
    }
}

    public setMatrix(matrix: mat4) {
        this.map.setMatrix(matrix);
    }

public async exportCurrentMapGLB(
    includeTextures: boolean = true,
    textureLayerMode: 'auto' | 'tex0' | 'tex1' | 'last' = 'auto',
    includeObjects: boolean = false,
): Promise<void> {
    if (!this.currentTexFetcher)
        return;

const entries: Array<{
    name: string;
    modelInst: ModelInstance;
    placementMatrix: mat4;
    extras?: any;
}> = [];
    const mapMatrix = this.map.getMapMatrix();

    for (const b of this.map.iterateBlocks()) {
        const placement = mat4.create();

        if (this.map.mapOpts?.galleryCenterBlock) {
            const bounds = dpGetBlockLocalXYZBounds(b.block);

            if (bounds) {
                const cx = (bounds.minX + bounds.maxX) * 0.5;
                const cy = (bounds.minY + bounds.maxY) * 0.5;
                const cz = (bounds.minZ + bounds.maxZ) * 0.5;

                const sx = Math.max(1, bounds.maxX - bounds.minX);
                const sy = Math.max(1, bounds.maxY - bounds.minY);
                const sz = Math.max(1, bounds.maxZ - bounds.minZ);
                const longest = Math.max(sx, sy, sz);

                const scale = Math.min(2.5, Math.max(0.15, 720 / longest));

                mat4.fromScaling(placement, [scale, scale, scale]);
                placement[12] = (-cx * scale) + 900;
                placement[13] = (-cy * scale) - 100;
                placement[14] = (-cz * scale) + 1200;
            } else {
                mat4.fromTranslation(placement, [-320, -120, -320]);
            }
        } else {
            mat4.fromTranslation(placement, [640 * b.x, 0, 640 * b.z]);
        }

        mat4.mul(placement, mapMatrix, placement);

const blockInfo = this.map.info.getBlockInfoAt(b.x, b.z);
const isAncientMap = String(this.mapNum).startsWith('ancient_');

entries.push({
    name: blockInfo
        ? `block_${b.z}_${b.x}_m${blockInfo.mod}_${blockInfo.sub}`
        : `block_${b.z}_${b.x}`,
    modelInst: b.block,
    placementMatrix: placement,

    extras: blockInfo ? {
        foxplanet: {
            mapKind: isAncientMap ? 'ancient' : 'map',
            modelVersion: isAncientMap ? 'AncientMap' : undefined,
            mapNum: this.mapNum,
            row: b.z,
            col: b.x,
            mod: blockInfo.mod,
            sub: blockInfo.sub,
            blockSize: 640,
        },
    } : undefined,
});
    }

    if (includeObjects && this.isDPMapScene) {
        let exportedObjects = 0;
        let skippedDevObjects = 0;
        let bakedAnimatedObjects = 0;

        for (let i = 0; i < this.map.objects.length; i++) {
            const obj = this.map.objects[i] as any;
            const typeNum = (((obj._dpTypeNum ?? -1) as number) & 0xFFFF);

            let objType: any = null;
            try {
                objType = this.map.mapOpts?.objectManager?.getObjectType?.(typeNum, false) ?? null;
            } catch {
                objType = null;
            }

            const labelNameRaw = String(
                obj._dpLabelName ??
                objType?.name ??
                objType?.objName ??
                `type_${dpHex(typeNum)}`
            );

            const labelNameLower = labelNameRaw.toLowerCase();

            const isDevObject =
                !!obj._isDevDP ||
                !!objType?.isDevObject ||
                DP_DEV_TYPE_NUMS.has(typeNum) ||
                DP_DEV_NAME_KEYWORDS.some((k) => labelNameLower.includes(k));

            if (isDevObject) {
                skippedDevObjects++;
                continue;
            }

            const modelInst = obj.modelInst as ModelInstance | null | undefined;
            if (!modelInst)
                continue;

            const model: any = modelInst.model;

            const hasJoints =
                Array.isArray(model.joints) &&
                model.joints.length > 0;

            const hasCoarseBlends =
                Array.isArray(model.coarseBlends) &&
                model.coarseBlends.length > 0;

            const hasFineSkinning =
                !!model.hasFineSkinning ||
                !!model.hasBetaFineSkinning;

            if (hasJoints || hasCoarseBlends || hasFineSkinning)
                bakedAnimatedObjects++;

            const anim = obj.anim ?? null;
            const modelAnimNum = obj.modelAnimNum ?? null;

            if (
                anim !== null &&
                modelAnimNum !== null &&
                (!modelInst.model.hasFineSkinning || this.animController.enableFineSkinAnims)
            ) {
                applyAnimationToModel(
                    this.animController.animController.getTimeInFrames() * obj.animSpeed,
                    modelInst,
                    anim,
                    modelAnimNum,
                );
            }

            if (typeof (modelInst as any).prepareForExport === 'function')
                (modelInst as any).prepareForExport();

            const placement = mat4.create();

            mat4.fromTranslation(placement, obj.position);
            mat4.rotateY(placement, placement, obj.yaw);

            if (typeNum === 0x01D3)
                mat4.rotateX(placement, placement, Math.PI * 0.5);

            const scale = Number(obj._dpScale ?? 1.0);
            if (Number.isFinite(scale) && scale !== 1.0)
                mat4.scale(placement, placement, [scale, scale, scale]);

            mat4.mul(placement, mapMatrix, placement);

            const safeObjectName = labelNameRaw
                .replace(/[^A-Za-z0-9._-]+/g, '_')
                .replace(/^_+|_+$/g, '') || `type_${dpHex(typeNum)}`;

            entries.push({
                name: `object_${i}_0x${dpHex(typeNum)}_${safeObjectName}`,
                modelInst,
                placementMatrix: placement,
            });

            exportedObjects++;
        }

        console.log(
            `[DP GLB Export] Exported ${exportedObjects} object(s), skipped ${skippedDevObjects} dev object(s), baked ${bakedAnimatedObjects} animated/skinned object(s).`,
        );
    }

    if (entries.length === 0)
        return;

    const safeMapName = String(this.mapNum ?? 'map').replace(/[^A-Za-z0-9._-]+/g, '_');
    const suffix = `${includeObjects ? '_objects' : ''}${includeTextures ? `_textured_${textureLayerMode}` : '_fast'}`;

    await exportPlacedModelInstancesToGLB(
        `map_${safeMapName}${suffix}.glb`,
        entries,
        this.materialFactory,
        this.currentTexFetcher,
                { includeTextures, textureLayerMode, includeWaters: true, bakeSkinning: includeObjects },

    );
}

protected override update(viewerInput: Viewer.ViewerRenderInput) {
    super.update(viewerInput);

    syncTextureToggleUIVisibility();

    this.materialFactory.update(this.animController);

    if (this.envfxMan) {
        this.envfxMan.update(this.context.device, { viewerInput });
    }

    if (this.dpGameTextRenderer !== null)
        this.dpGameTextRenderer.tick(viewerInput);

this.drawObjectDebugOverlay(viewerInput);
this.drawMissingTextureLabelOverlay(viewerInput);
this.drawDPObjectDiffOverlay(viewerInput);
this.drawDPObjectHitOverlay(viewerInput);
this.drawDPHitOverlay(viewerInput);
this.drawDPMinimapOverlay(viewerInput);
this.drawDPFramebufferFXOverlay(viewerInput);
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

    const forceHideDPObjectsInVR = this.isDPMapScene && !!sceneCtx.viewerInput.isVR;
    const modelCtx = {
        sceneCtx,
        showDevGeometry: false,
        ambienceIdx: 0,
        showMeshes: true,
        showMapWireframe: this.showMapWireframe,
        outdoorAmbientColor: scratchColor0,
        setupLights: () => {},
        animController: this.animController,
        showDevObjects: this.showDevObjects,
        showAllObjects: this.showAllObjects && !forceHideDPObjectsInVR,
        cullByAabb: false,
    };

    this.map.addRenderInsts(device, renderInstManager, renderLists, modelCtx as any);

    if (!this.isDPMapScene && this.sfaUnusedBlocksEnabled && this.sfaUnusedBlocks.length > 0) {
        const startRow = this.map.info.getNumRows() + 2;
        const colsPerRow = Math.max(1, Math.min(6, this.map.info.getNumCols()));

        for (let i = 0; i < this.sfaUnusedBlocks.length; i++) {
            const e = this.sfaUnusedBlocks[i];

            const localCol = i % colsPerRow;
            const localRow = startRow + Math.floor(i / colsPerRow);

            const placement = mat4.create();
            mat4.fromTranslation(placement, [640 * localCol, 0, 640 * localRow]);
            mat4.mul(placement, this.map.getMapMatrix(), placement);

            e.modelInst.addRenderInsts(
                device,
                renderInstManager,
                modelCtx as any,
                renderLists,
                placement,
            );
        }
    }

    renderInstManager.popTemplateRenderInst();
}

public override destroy(device: GfxDevice) {
    cleanupDPBlockGalleryUI();
    cleanupTextureToggleUI();

    if (this.dpGameTextRenderer !== null) {
        this.dpGameTextRenderer.destroy(device);
        this.dpGameTextRenderer = null;
    }

    if (this.isDPMapScene)
        cleanupDPUI();
    window.removeEventListener('keydown', this.onDPOverlayHideHotkey, true);
    if (this.debugOverlayCanvas) {
        window.removeEventListener('mousedown', this.onDebugOverlayMouseDown, true);
        window.removeEventListener('mouseup', this.onDebugOverlayMouseUp, true);
        window.removeEventListener('contextmenu', this.onDebugOverlayContextMenu, true);
        this.debugOverlayCanvas = null;
    }
    if (this.dpFbfxCanvas) {
        this.dpFbfxCanvas.remove();
        this.dpFbfxCanvas = null;
        this.dpFbfxCtx = null;
    }
    const vanillaObjectMap = this.dpVanillaObjectMap;

    if (this.dpCurrentObjects)
        this.map.objects = this.dpCurrentObjects;

    this.dpVanillaObjectMap = null;
    this.dpUsingVanillaObjects = false;

    for (const e of this.sfaUnusedBlocks)
        e.modelInst.destroy(device);

    this.sfaUnusedBlocks = [];
    this.sfaUnusedBlocksEnabled = false;
    this.sfaUnusedBlocksBusy = false;
    this.sfaUnusedBlocksInfoPre = null;
    this.sfaUnusedBlocksStatus = 'Not scanned.';

 
    super.destroy(device);
    if (this.sky) { this.sky.destroy(device); this.sky = null; }
    if (this.envfxMan) this.envfxMan.destroy(device);
    this.map.destroy(device);
    if (vanillaObjectMap)
        vanillaObjectMap.destroy(device);
}
}

function cleanupSFADPHitsCompareSceneUI(): void {
    document.getElementById('sfa-dp-hits-compare-scene-ui')?.remove();
    (window as any).__sfaDPHitsCompareSceneUI = undefined;
}

function ensureSFADPHitsCompareSceneUI(
    getMapNum: () => number,
    setMapNum: (mapNum: number) => void | Promise<void>,
): void {
    cleanupSFADPHitsCompareSceneUI();

    const wrap = document.createElement('div');
    wrap.id = 'sfa-dp-hits-compare-scene-ui';
    wrap.style.position = 'fixed';
    wrap.style.right = '8px';
    wrap.style.top = '8px';
    wrap.style.zIndex = '10000';
    wrap.style.width = '260px';
    wrap.style.background = 'rgba(0,0,0,0.86)';
    wrap.style.color = '#fff';
    wrap.style.font = '12px monospace';
    wrap.style.padding = '8px';
    wrap.style.border = '1px solid rgba(255,255,255,0.25)';
    wrap.style.borderRadius = '8px';
    wrap.style.display = 'grid';
    wrap.style.gap = '6px';

    const title = document.createElement('div');
    title.textContent = 'SFA vs DP HITS Footprint';
    title.style.fontWeight = 'bold';
    wrap.appendChild(title);

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.value = String(getMapNum());
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    wrap.appendChild(input);

    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 1fr 1fr';
    row.style.gap = '6px';

    const prev = document.createElement('button');
    prev.textContent = 'Prev';

    const load = document.createElement('button');
    load.textContent = 'Load';

    const next = document.createElement('button');
    next.textContent = 'Next';

    row.appendChild(prev);
    row.appendChild(load);
    row.appendChild(next);
    wrap.appendChild(row);

    const loadInput = async () => {
        let mapNum = Number(input.value);
        if (!Number.isFinite(mapNum))
            mapNum = 0;

        mapNum = Math.max(0, mapNum | 0);
        input.value = String(mapNum);
        await setMapNum(mapNum);
    };

    prev.onclick = async () => {
        const mapNum = Math.max(0, (getMapNum() | 0) - 1);
        input.value = String(mapNum);
        await setMapNum(mapNum);
    };

    next.onclick = async () => {
        const mapNum = (getMapNum() | 0) + 1;
        input.value = String(mapNum);
        await setMapNum(mapNum);
    };

    load.onclick = () => {
        void loadInput();
    };

    input.onchange = () => {
        void loadInput();
    };

    document.body.appendChild(wrap);
}

function cleanupDPUI(): void {
    stopDPMPEGVoicePreview();
document.getElementById('dp-export-toggle')?.remove();
document.getElementById('dp-export-ui')?.remove();
(window as any).__dpExportUIState = undefined;
    document.getElementById('dp-mpeg-voice-ui')?.remove();
    document.getElementById('dp-mpeg-voice-toggle')?.remove();

    document.getElementById('dp-fbfx-ui')?.remove();
    document.getElementById('dp-fbfx-toggle')?.remove();

    document.getElementById('dp-top-toggle-bar')?.remove();
document.getElementById('dp-object-diff-toggle')?.remove();
document.getElementById('dp-object-diff-ui')?.remove();
cleanupDPBlockGalleryUI();
(window as any).__dpObjectDiffToggle = undefined;
    (window as any).__dpObjectsToggle = undefined;
    (window as any).__dpDevObjectsToggle = undefined;
    (window as any).__dpObjectLabelsToggle = undefined;
    (window as any).__dpHitsToggle = undefined;
        (window as any).__dpFootprintToggle = undefined;
    (window as any).__dpHitVolumesToggle = undefined;
    (window as any).__dpWireframeToggle = undefined;
    (window as any).__dpCullToggle = undefined;
    (window as any).__DP_ENABLE_CULL = false;
    (window as any).__dpGameTextToggle = undefined;
    (window as any).__dpFbfxToggle = undefined;
    (window as any).__dpFbfxUIState = undefined;
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

function syncTextureToggleUIVisibility(): void {
    const state = (window as any).__sfaTextureToggle as {
        wrap?: HTMLDivElement;
    } | undefined;

    if (!state?.wrap)
        return;

    const uiVisible = (((window as any).main?.ui?.isVisible) ?? true) !== false;
    state.wrap.style.display = uiVisible ? '' : 'none';
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
        bar.style.gap = '2px';
        bar.style.transformOrigin = 'top right';
        bar.style.transform = 'scale(0.8)';

        document.body.appendChild(bar);
    }

    return bar;
}
function ensureDPWireframeUI(
  onChange: (enabled: boolean) => void | Promise<void>,
  initial?: boolean
): void {
  type ToggleState = {
    wrap: HTMLDivElement;
    cb: HTMLInputElement;
    handler: ((e: Event) => void) | null;
    last?: boolean;
  };

  let state = (window as any).__dpWireframeToggle as ToggleState | undefined;

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
    wrap.style.order = '6';

    const label = document.createElement('label');
    label.style.cursor = 'pointer';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.lineHeight = '1';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.marginRight = '1px';

    label.appendChild(cb);
    label.appendChild(document.createTextNode('Wireframe'));
    wrap.appendChild(label);
    getDPTopToggleBar().appendChild(wrap);

    state = { wrap, cb, handler: null, last: false };
    (window as any).__dpWireframeToggle = state;
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

function ensureDPCullUI(
  onChange: (enabled: boolean) => void | Promise<void>,
  initial?: boolean
): void {
  type ToggleState = {
    wrap: HTMLDivElement;
    cb: HTMLInputElement;
    handler: ((e: Event) => void) | null;
    last?: boolean;
  };

  let state = (window as any).__dpCullToggle as ToggleState | undefined;

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
    wrap.style.order = '6';

    const label = document.createElement('label');
    label.style.cursor = 'pointer';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.lineHeight = '1';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.marginRight = '1px';

    label.appendChild(cb);
    label.appendChild(document.createTextNode('Backface Culling'));
    wrap.appendChild(label);
    getDPTopToggleBar().appendChild(wrap);

    state = { wrap, cb, handler: null, last: false };
    (window as any).__dpCullToggle = state;
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

function ensureDPObjectDiffUI(
    diff: DPObjectDiff | null,
    onChange: (enabled: boolean) => void | Promise<void>,
): void {
    type State = {
        wrap: HTMLDivElement;
        panel: HTMLDivElement;
        cb: HTMLInputElement;
        handler: ((e: Event) => void) | null;
    };

    let state = (window as any).__dpObjectDiffToggle as State | undefined;

    if (!state) {
        const wrap = document.createElement('div');
        wrap.id = 'dp-object-diff-toggle';
        wrap.style.padding = '1px 3px';
        wrap.style.background = 'rgba(0,0,0,0.5)';
        wrap.style.color = '#fff';
        wrap.style.font = '11px sans-serif';
        wrap.style.borderRadius = '2px';
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.height = '20px';
        wrap.style.boxSizing = 'border-box';
        wrap.style.order = '8';

        const label = document.createElement('label');
        label.style.cursor = 'pointer';
        label.style.display = 'flex';
        label.style.alignItems = 'center';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.style.marginRight = '1px';

        label.appendChild(cb);
        label.appendChild(document.createTextNode('VanillaDPdiff'));
        wrap.appendChild(label);
        getDPTopToggleBar().appendChild(wrap);

        const panel = document.createElement('div');
        panel.id = 'dp-object-diff-ui';
        panel.style.position = 'fixed';
panel.style.right = '4px';
panel.style.top = '28px';
        panel.style.width = '360px';
        panel.style.maxHeight = '50vh';
        panel.style.overflow = 'auto';
        panel.style.zIndex = '10000';
        panel.style.background = 'rgba(0,0,0,0.88)';
        panel.style.color = '#fff';
        panel.style.font = '12px monospace';
        panel.style.padding = '8px';
        panel.style.border = '1px solid rgba(255,255,255,0.18)';
        panel.style.borderRadius = '8px';
        panel.style.display = 'none';

        document.body.appendChild(panel);

        state = { wrap, panel, cb, handler: null };
        (window as any).__dpObjectDiffToggle = state;
    }

    const d = diff;
    state.cb.disabled = !d?.available;

    if (!d?.available) {
        state.panel.textContent = `Object diff unavailable:\n${d?.message ?? 'No diff loaded'}`;
    } else {
        state.panel.textContent =
            `DP object diff\n` +
            `${d.message}\n\n` +
            `added:   ${d.added.length}\n` +
            `removed: ${d.removed.length}\n` +
            `moved:   ${d.moved.length}\n` +
            `changed: ${d.changed.length}\n\n` +
            `Overlay colors:\n` +
            `ADD green\nDEL red\nMOV blue\nCHG yellow`;
    }

    if (state.handler)
        state.cb.removeEventListener('change', state.handler);

    state.cb.checked = false;

    state.handler = async () => {
        state!.panel.style.display = state!.cb.checked ? 'block' : 'none';
        await onChange(state!.cb.checked);
    };

    state.cb.addEventListener('change', state.handler);
}

function ensureDPFbfxUI(
  onPlay: (effectId: number) => void | Promise<void>,
  initialOpen: boolean = false
): void {
  type FbfxState = {
    toggleWrap: HTMLDivElement;
    panel: HTMLDivElement;
    cb: HTMLInputElement;
    select: HTMLSelectElement;
    playBtn: HTMLButtonElement;
    handlerToggle: ((e: Event) => void) | null;
    handlerPlay: ((e: Event) => void) | null;
    open: boolean;
  };

  let state = (window as any).__dpFbfxUIState as FbfxState | undefined;

  if (!state) {
    const toggleWrap = document.createElement('div');
    toggleWrap.id = 'dp-fbfx-toggle';
    toggleWrap.style.padding = '1px 3px';
    toggleWrap.style.background = 'rgba(0,0,0,0.5)';
    toggleWrap.style.color = '#fff';
    toggleWrap.style.font = '11px sans-serif';
    toggleWrap.style.borderRadius = '2px';
    toggleWrap.style.display = 'flex';
    toggleWrap.style.alignItems = 'center';
    toggleWrap.style.height = '20px';
    toggleWrap.style.boxSizing = 'border-box';
    toggleWrap.style.order = '7';

    const label = document.createElement('label');
    label.style.cursor = 'pointer';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.lineHeight = '1';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.marginRight = '1px';

    label.appendChild(cb);
    label.appendChild(document.createTextNode('FBFX'));
    toggleWrap.appendChild(label);
    getDPTopToggleBar().appendChild(toggleWrap);

    const panel = document.createElement('div');
    panel.id = 'dp-fbfx-ui';
    panel.style.position = 'fixed';
    panel.style.right = '8px';
    panel.style.top = '28px';
    panel.style.width = '260px';
    panel.style.zIndex = '10000';
    panel.style.background = 'rgba(0,0,0,0.88)';
    panel.style.color = '#fff';
    panel.style.font = '12px sans-serif';
    panel.style.padding = '8px';
    panel.style.border = '1px solid rgba(255,255,255,0.18)';
    panel.style.borderRadius = '8px';
    panel.style.display = 'none';
    panel.style.gap = '8px';

    const title = document.createElement('div');
    title.textContent = 'DP Framebuffer FX';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '6px';
    panel.appendChild(title);

    const select = document.createElement('select');
    select.style.width = '100%';
    select.style.marginBottom = '6px';

    for (const opt of DP_FBFX_OPTIONS) {
      const el = document.createElement('option');
      el.value = String(opt.id);
      el.textContent = opt.label;
      select.appendChild(el);
    }

    panel.appendChild(select);

    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.style.width = '100%';
    panel.appendChild(playBtn);

    document.body.appendChild(panel);

    state = {
      toggleWrap,
      panel,
      cb,
      select,
      playBtn,
      handlerToggle: null,
      handlerPlay: null,
      open: false,
    };

    (window as any).__dpFbfxUIState = state;
  }

  if (state.handlerToggle)
    state.cb.removeEventListener('change', state.handlerToggle);
  if (state.handlerPlay)
    state.playBtn.removeEventListener('click', state.handlerPlay);

  state.open = initialOpen;
  state.cb.checked = initialOpen;
  state.panel.style.display = initialOpen ? 'block' : 'none';

  state.handlerToggle = () => {
    state!.open = state!.cb.checked;
    state!.panel.style.display = state!.open ? 'block' : 'none';
  };

  state.handlerPlay = async () => {
    const effectId = Number(state!.select.value) | 0;
    await onPlay(effectId);
  };

  state.cb.addEventListener('change', state.handlerToggle);
  state.playBtn.addEventListener('click', state.handlerPlay);
}

function ensureDPExportUI(
  onExport: (includeTextures: boolean, textureLayerMode: 'auto' | 'tex0' | 'tex1' | 'last', includeObjects: boolean) => void | Promise<void>,
  initialOpen: boolean = false
): void {

  type ExportUIState = {
    toggleWrap: HTMLDivElement;
    panel: HTMLDivElement;
    cb: HTMLInputElement;
    layerModeSelect: HTMLSelectElement;
    exportFastButton: HTMLButtonElement;
    exportTexturedButton: HTMLButtonElement;
    exportObjectsFastButton: HTMLButtonElement;
    exportObjectsTexturedButton: HTMLButtonElement;
    handlerToggle: ((e: Event) => void) | null;
    handlerFast: ((e: Event) => void) | null;
    handlerTextured: ((e: Event) => void) | null;
    handlerObjectsFast: ((e: Event) => void) | null;
    handlerObjectsTextured: ((e: Event) => void) | null;
    open: boolean;
  };

  let state = (window as any).__dpExportUIState as ExportUIState | undefined;

  if (!state) {
    const toggleWrap = document.createElement('div');
    toggleWrap.id = 'dp-export-toggle';
    toggleWrap.style.padding = '1px 3px';
    toggleWrap.style.background = 'rgba(0,0,0,0.5)';
    toggleWrap.style.color = '#fff';
    toggleWrap.style.font = '11px sans-serif';
    toggleWrap.style.borderRadius = '2px';
    toggleWrap.style.display = 'flex';
    toggleWrap.style.alignItems = 'center';
    toggleWrap.style.height = '20px';
    toggleWrap.style.boxSizing = 'border-box';
    toggleWrap.style.order = '9';

    const label = document.createElement('label');
    label.style.cursor = 'pointer';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.lineHeight = '1';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.marginRight = '1px';

    label.appendChild(cb);
    label.appendChild(document.createTextNode('Export Map'));
    toggleWrap.appendChild(label);
    getDPTopToggleBar().appendChild(toggleWrap);

    const panel = document.createElement('div');
    panel.id = 'dp-export-ui';
    panel.style.position = 'fixed';
    panel.style.right = '8px';
    panel.style.top = '28px';
    panel.style.width = '280px';
    panel.style.zIndex = '10000';
    panel.style.background = 'rgba(0,0,0,0.88)';
    panel.style.color = '#fff';
    panel.style.font = '12px sans-serif';
    panel.style.padding = '8px';
    panel.style.border = '1px solid rgba(255,255,255,0.18)';
    panel.style.borderRadius = '8px';
    panel.style.display = 'none';

    const title = document.createElement('div');
    title.textContent = 'Export Map';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '6px';
    panel.appendChild(title);

    const layerModeLabel = document.createElement('div');
    layerModeLabel.textContent = 'Texture Layer Source';
    layerModeLabel.style.fontSize = '12px';
    layerModeLabel.style.marginBottom = '4px';
    panel.appendChild(layerModeLabel);

    const layerModeSelect = document.createElement('select');
    layerModeSelect.style.display = 'block';
    layerModeSelect.style.width = '100%';
    layerModeSelect.style.marginBottom = '8px';

    for (const [value, text] of [
      ['auto', 'Auto'],
      ['tex0', 'Prefer TEX0'],
      ['tex1', 'Prefer TEX1'],
      ['last', 'Prefer Last Layer'],
    ] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      layerModeSelect.appendChild(option);
    }

    layerModeSelect.value = 'auto';
    panel.appendChild(layerModeSelect);

    const exportFastButton = document.createElement('button');
    exportFastButton.textContent = 'Export Current Map as GLB';
    exportFastButton.style.display = 'block';
    exportFastButton.style.width = '100%';
    exportFastButton.style.marginBottom = '6px';
    panel.appendChild(exportFastButton);

    const exportTexturedButton = document.createElement('button');
    exportTexturedButton.textContent = 'Export Current Map as GLB (With Textures)';
    exportTexturedButton.style.display = 'block';
    exportTexturedButton.style.width = '100%';
    exportTexturedButton.style.marginBottom = '6px';
    panel.appendChild(exportTexturedButton);

    const exportObjectsFastButton = document.createElement('button');
    exportObjectsFastButton.textContent = 'Export Current DP Map + Objects as GLB';
    exportObjectsFastButton.style.display = 'block';
    exportObjectsFastButton.style.width = '100%';
    exportObjectsFastButton.style.marginBottom = '6px';
    panel.appendChild(exportObjectsFastButton);

    const exportObjectsTexturedButton = document.createElement('button');
    exportObjectsTexturedButton.textContent = 'Export Current DP Map + Objects as GLB (With Textures)';
    exportObjectsTexturedButton.style.display = 'block';
    exportObjectsTexturedButton.style.width = '100%';
    exportObjectsTexturedButton.style.marginBottom = '6px';
    panel.appendChild(exportObjectsTexturedButton);

    const exportNote = document.createElement('div');
    exportNote.textContent = 'Object export skips dev objects and bakes animated/skinned objects into their current pose.';
    exportNote.style.fontSize = '12px';
    exportNote.style.opacity = '0.8';
    panel.appendChild(exportNote);

    document.body.appendChild(panel);

    state = {
      toggleWrap,
      panel,
      cb,
      layerModeSelect,
      exportFastButton,
      exportTexturedButton,
      exportObjectsFastButton,
      exportObjectsTexturedButton,
      handlerToggle: null,
      handlerFast: null,
      handlerTextured: null,
      handlerObjectsFast: null,
      handlerObjectsTextured: null,
      open: false,
    };

    (window as any).__dpExportUIState = state;
  }

  if (state.handlerToggle)
    state.cb.removeEventListener('change', state.handlerToggle);
  if (state.handlerFast)
    state.exportFastButton.removeEventListener('click', state.handlerFast);
  if (state.handlerTextured)
    state.exportTexturedButton.removeEventListener('click', state.handlerTextured);
  if (state.handlerObjectsFast)
    state.exportObjectsFastButton.removeEventListener('click', state.handlerObjectsFast);
  if (state.handlerObjectsTextured)
    state.exportObjectsTexturedButton.removeEventListener('click', state.handlerObjectsTextured);

  const setDisabled = (disabled: boolean) => {
    state!.layerModeSelect.disabled = disabled;
    state!.exportFastButton.disabled = disabled;
    state!.exportTexturedButton.disabled = disabled;
    state!.exportObjectsFastButton.disabled = disabled;
    state!.exportObjectsTexturedButton.disabled = disabled;
  };

  state.open = initialOpen;
  state.cb.checked = initialOpen;
  state.panel.style.display = initialOpen ? 'block' : 'none';

  state.handlerToggle = () => {
    state!.open = state!.cb.checked;
    state!.panel.style.display = state!.open ? 'block' : 'none';
  };

  state.handlerFast = async () => {
    setDisabled(true);
    try {
      await onExport(false, state!.layerModeSelect.value as 'auto' | 'tex0' | 'tex1' | 'last', false);
    } finally {
      setDisabled(false);
    }
  };

  state.handlerTextured = async () => {
    setDisabled(true);
    try {
      await onExport(true, state!.layerModeSelect.value as 'auto' | 'tex0' | 'tex1' | 'last', false);
    } finally {
      setDisabled(false);
    }
  };

  state.handlerObjectsFast = async () => {
    setDisabled(true);
    try {
      await onExport(false, state!.layerModeSelect.value as 'auto' | 'tex0' | 'tex1' | 'last', true);
    } finally {
      setDisabled(false);
    }
  };

  state.handlerObjectsTextured = async () => {
    setDisabled(true);
    try {
      await onExport(true, state!.layerModeSelect.value as 'auto' | 'tex0' | 'tex1' | 'last', true);
    } finally {
      setDisabled(false);
    }
  };

  state.cb.addEventListener('change', state.handlerToggle);
  state.exportFastButton.addEventListener('click', state.handlerFast);
  state.exportTexturedButton.addEventListener('click', state.handlerTextured);
  state.exportObjectsFastButton.addEventListener('click', state.handlerObjectsFast);
  state.exportObjectsTexturedButton.addEventListener('click', state.handlerObjectsTextured);
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

function ensureDPHitsUI(
  onChange: (enabled: boolean) => void | Promise<void>,
  initial?: boolean
): void {
  type ToggleState = {
    wrap: HTMLDivElement;
    cb: HTMLInputElement;
    handler: ((e: Event) => void) | null;
    last?: boolean;
  };

  let state = (window as any).__dpHitsToggle as ToggleState | undefined;

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
    wrap.style.order = '5';

    const label = document.createElement('label');
    label.style.cursor = 'pointer';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.lineHeight = '1';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.marginRight = '1px';

    label.appendChild(cb);
    label.appendChild(document.createTextNode('HITS'));
    wrap.appendChild(label);
    getDPTopToggleBar().appendChild(wrap);

    state = { wrap, cb, handler: null, last: false };
    (window as any).__dpHitsToggle = state;
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
function ensureDPFootprintUI(
  onChange: (enabled: boolean) => void | Promise<void>,
  initial?: boolean
): void {
  type ToggleState = {
    wrap: HTMLDivElement;
    cb: HTMLInputElement;
    handler: ((e: Event) => void) | null;
    last?: boolean;
  };

  let state = (window as any).__dpFootprintToggle as ToggleState | undefined;

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
    wrap.style.order = '5';

    const label = document.createElement('label');
    label.style.cursor = 'pointer';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.lineHeight = '1';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.marginRight = '1px';

    label.appendChild(cb);
    label.appendChild(document.createTextNode('Footprint'));
    wrap.appendChild(label);
    getDPTopToggleBar().appendChild(wrap);

    state = { wrap, cb, handler: null, last: false };
    (window as any).__dpFootprintToggle = state;
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
function ensureDPGameTextUI(
  onChange: (enabled: boolean) => void | Promise<void>,
  initial?: boolean
): void {
  type ToggleState = {
    wrap: HTMLDivElement;
    cb: HTMLInputElement;
    handler: ((e: Event) => void) | null;
    last?: boolean;
  };

  let state = (window as any).__dpGameTextToggle as ToggleState | undefined;

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
    wrap.style.order = '7';

    const label = document.createElement('label');
    label.style.cursor = 'pointer';
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.lineHeight = '1';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.marginRight = '1px';

    label.appendChild(cb);
    label.appendChild(document.createTextNode('GameText/Subs'));
    wrap.appendChild(label);
    getDPTopToggleBar().appendChild(wrap);

    state = { wrap, cb, handler: null, last: false };
    (window as any).__dpGameTextToggle = state;
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

    syncTextureToggleUIVisibility();

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

function setWarlockPngOverrides(
    texFetcher: { setPngOverride: (id: number, path: string) => void },
): void {
    texFetcher.setPngOverride(619, 'textures/ribbon.png');

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
texFetcher.setCurrentModelID(Number(this.mapKey));
const ancientLogMapId = `ancient_${String(this.mapKey)}`;
const ancientOrigGetTexture = (texFetcher as any).getTexture.bind(texFetcher);
(texFetcher as any).getTexture = function(cache: any, id: number, useTex1: boolean) {
    logUniqueTextureRequest('ANCIENTMAP', ancientLogMapId, id, useTex1);
    return ancientOrigGetTexture(cache, id, useTex1);
};

const folders = ANCIENT_TEXTURE_FOLDERS[String(this.mapKey)] ?? [];
const primarySubdir = folders[0] ?? '';
if (Number(this.mapKey) !== 0) {
    await texFetcher.loadSubdirs(folders, dataFetcher);
}
if (Number(this.mapKey) === 5) {
    setWarlockPngOverrides(texFetcher);
}
if (Number(this.mapKey) === 6) {
texFetcher.setPngOverride(3001, 'textures/shoppurple.png'); 
texFetcher.setPngOverride(3002, 'textures/shopwood.png'); 
texFetcher.setPngOverride(3003, 'textures/shoppurple2.png'); 
texFetcher.setPngOverride(3004, 'textures/shoppurple3.png'); 
texFetcher.setPngOverride(3005, 'textures/shoppurple4.png'); 
texFetcher.setPngOverride(3006, 'textures/shoppurple5.png'); 
}
if (Number(this.mapKey) === 3) {
texFetcher.setPngOverride(3099, 'textures/lowertree.png'); 
texFetcher.setPngOverride(3098, 'textures/uppertree.png'); 

}


await texFetcher.preloadPngOverrides((materialFactory as any).cache ?? (materialFactory as any).getCache?.(), dataFetcher);

const blockFetcher = await AncientBlockFetcher.create(
  this.gameInfo, dataFetcher, materialFactory, Promise.resolve(texFetcher)
);
mapRenderer.setBlockFetcherFactory(() => AncientBlockFetcher.create(
  this.gameInfo, dataFetcher, materialFactory, Promise.resolve(texFetcher)
));

if (shouldUseAncientStyleSky(this.mapKey, primarySubdir)) {
    await initSFAStyleMapEnv(
        mapRenderer,
        materialFactory,
        this.gameInfo,
        dataFetcher,
        texFetcher,
        primarySubdir,
    );
}
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
let primarySubdir = '';

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
    primarySubdir = getSubdir(firstMod, this.gameInfo);
    if (this.mapNum === 32 || primarySubdir === 'mmshrine') {
        await texFetcher.loadSubdirs([primarySubdir], context.dataFetcher);
    } else {
        await texFetcher.loadSubdirs([primarySubdir, 'Copy of swaphol'], context.dataFetcher);
    }

    if (primarySubdir === 'gpshrine') {
        await texFetcher.loadSubdirs(['dragrock'], context.dataFetcher);
    } else if (primarySubdir === 'mmshrine') {
        await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);
    } else if (primarySubdir === 'dbshrine') {
        await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);
    }
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
if (shouldUseSFAStyleSkyForSubdir(primarySubdir)) {
    await initSFAStyleMapEnv(
        mapRenderer,
        materialFactory,
        this.gameInfo,
        context.dataFetcher,
        texFetcher,
        primarySubdir,
    );
}
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



export class Mod49SceneDesc implements Viewer.SceneDesc {
    constructor(
        public id: string = 'mod49',
        public name: string = 'Unused DBay MOD49',
        private gameInfo: GameInfo = SFA_GAME_INFO,
    ) {}

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);
        const dpDiamondBayInfo = await loadMap(DP_GAME_INFO, context.dataFetcher, 35);
        const mapSceneInfo: MapSceneInfo = {
            getNumCols() {
                return dpDiamondBayInfo.getNumCols();
            },

            getNumRows() {
                return dpDiamondBayInfo.getNumRows();
            },

            getOrigin() {
                return dpDiamondBayInfo.getOrigin();
            },

            getBlockInfoAt(col: number, row: number): BlockInfo | null {
                const block = dpDiamondBayInfo.getBlockInfoAt(col, row);
                if (block === null)
                    return null;

                return {
                    mod: 49,
                    sub: block.sub,
                };
            },
        };

        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = this.id;
        const texFetcher = await SFATextureFetcher.create(DP_GAME_INFO, context.dataFetcher, false);
        texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);

        const dpDBayTexIds = await collectDPDiamondBayTextureIds(
            context.dataFetcher,
            materialFactory,
            texFetcher,
        );

        (globalThis as any).__MOD49_DP_DBAY_TEXIDS = dpDBayTexIds;

        console.warn(
            `[MOD49] using ${dpDBayTexIds.length} Dinosaur Planet Diamond Bay texture IDs`,
            dpDBayTexIds,
        );

        const blockFetcher = await EARLY1BLOCKFETCHER.create(
            this.gameInfo,
            context.dataFetcher,
            device,
            materialFactory,
            animController,
            Promise.resolve(texFetcher),
        );

        await mapRenderer.create(mapSceneInfo, this.gameInfo, context.dataFetcher, blockFetcher);

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

for (let row = 0; row < mapSceneInfo.getNumRows() && firstMod === null; row++) {
    for (let col = 0; col < mapSceneInfo.getNumCols(); col++) {
        const b = mapSceneInfo.getBlockInfoAt(col, row);
        if (b) {
            firstMod = b.mod;
            break;
        }
    }
}

let primarySubdir = '';

if (firstMod !== null) {
    primarySubdir = getSubdir(firstMod, this.gameInfo);

    if (this.mapNum === 15) {
        await texFetcher.loadSubdirs([primarySubdir, 'cloudtreasure'], context.dataFetcher);
    } else {
        await texFetcher.loadSubdirs([primarySubdir], context.dataFetcher);
    }

    if (primarySubdir === 'clouddungeon' || primarySubdir === 'cloudrace') {
        await texFetcher.loadSubdirs(['crfort'], context.dataFetcher);
    } else if (primarySubdir === 'icemountain') {
        await texFetcher.loadSubdirs(['nwastes'], context.dataFetcher);
    } else if (primarySubdir === 'desert') {
        await texFetcher.loadSubdirs(['dfptop', 'volcano'], context.dataFetcher);
    } else if (primarySubdir === 'crfort') {
        await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);
    } else if (primarySubdir === 'linkb' || primarySubdir === 'linkf') {
        await texFetcher.loadSubdirs(['volcano'], context.dataFetcher);
    } else if (primarySubdir === 'shipbattle') {
        await texFetcher.loadSubdirs([''], context.dataFetcher);
    } else if (primarySubdir === 'linkc') {
        await texFetcher.loadSubdirs(['nwastes'], context.dataFetcher);
    } else if (primarySubdir === 'mmpass') {
        await texFetcher.loadSubdirs(['shop', 'warlock'], context.dataFetcher);
    } else if (primarySubdir === 'swaphol') {
        await texFetcher.loadSubdirs(['Copy of swaphol', 'nwastes', 'mmpass'], context.dataFetcher);
    } else if (primarySubdir === 'swapholbot' || primarySubdir === 'shop') {
        await texFetcher.loadSubdirs(['Copy of swaphol', 'swaphol', 'ecshrine'], context.dataFetcher);
    } else if (primarySubdir === 'wallcity') {
        await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);
    } else if (primarySubdir === 'darkicemines') {
        await texFetcher.loadSubdirs(['shop', 'nwastes'], context.dataFetcher);
    } else if (primarySubdir === 'bossgaldon') {
        await texFetcher.loadSubdirs(['dragrock'], context.dataFetcher);
    } else if (primarySubdir === 'nwastes') {
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
if (shouldUseSFAStyleSkyForSubdir(primarySubdir)) {
    await initSFAStyleMapEnv(
        mapRenderer,
        materialFactory,
        this.gameInfo,
        context.dataFetcher,
        texFetcher,
        primarySubdir,
    );
}
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
let primarySubdir = '';

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
  primarySubdir = getSubdir(firstMod, this.gameInfo);
  await texFetcher.loadSubdirs([primarySubdir], context.dataFetcher);

  if (primarySubdir === 'clouddungeon') {
    await texFetcher.loadSubdirs(['crfort'], context.dataFetcher);
  }
  if (primarySubdir === 'crfort') {
    await texFetcher.loadSubdirs(['gpshrine'], context.dataFetcher);
  }

}    
        const blockFetcher = await EARLY2BLOCKFETCHER.create(this.gameInfo,context.dataFetcher, device, materialFactory, animController, Promise.resolve(texFetcher));
        if (shouldUseSFAStyleSkyForSubdir(primarySubdir)) {
    await initSFAStyleMapEnv(
        mapRenderer,
        materialFactory,
        this.gameInfo,
        context.dataFetcher,
        texFetcher,
        primarySubdir,
    );
}
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
let primarySubdir = '';

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
  primarySubdir = getSubdir(firstMod, this.gameInfo);

  await texFetcher.loadSubdirs([primarySubdir], context.dataFetcher);

  if (primarySubdir === 'swapholbot' || primarySubdir === 'shop') {
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
if (shouldUseSFAStyleSkyForSubdir(primarySubdir)) {
    await initSFAStyleMapEnv(
        mapRenderer,
        materialFactory,
        this.gameInfo,
        context.dataFetcher,
        texFetcher,
        primarySubdir,
    );
}
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
let primarySubdir = '';
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
  primarySubdir = getSubdir(firstMod, this.gameInfo);

  await texFetcher.loadSubdirs([primarySubdir], context.dataFetcher);

  if (primarySubdir === 'swapholbot' || primarySubdir === 'shop') {
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
       if (shouldUseSFAStyleSkyForSubdir(primarySubdir)) {
    await initSFAStyleMapEnv(
        mapRenderer,
        materialFactory,
        this.gameInfo,
        context.dataFetcher,
        texFetcher,
        primarySubdir,
    );
}
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
    const toggleWrap = document.createElement('div');
    toggleWrap.id = 'dp-mpeg-voice-toggle';
    toggleWrap.style.height = '20px';
toggleWrap.style.boxSizing = 'border-box';
toggleWrap.style.order = '6';
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

type SFABlockGalleryEntry = {
    index: number;
    mod: number;
    sub: number;
    absBlock: number;
    source: string;
};

function getSFAModFileNum(mod: number): number {
    return mod < 5 ? mod : mod + 1;
}

type DPBlockGalleryEntry = {
    index: number;
    mod: number;
    sub: number;
    absBlock: number;
    source: string;
};

async function loadDPBlockGalleryEntries(
    dataFetcher: DataFetcher,
    gameInfo: GameInfo,
): Promise<DPBlockGalleryEntry[]> {
    const blocksTab = (await dataFetcher.fetchData(`${gameInfo.pathBase}/BLOCKS.tab`)).createDataView();

    let trkblk: DataView | null = null;
    try {
        trkblk = (await dataFetcher.fetchData(`${gameInfo.pathBase}/TRKBLK.bin`, { allow404: true })).createDataView();
    } catch {
        trkblk = null;
    }

    const blockCount = blocksTab.byteLength >>> 2;
    const out: DPBlockGalleryEntry[] = [];
    const seenAbs = new Set<number>();

    const getAbsBlock = (mod: number, sub: number): number | null => {
        if (trkblk && mod * 2 + 2 <= trkblk.byteLength)
            return trkblk.getUint16(mod * 2, false) + sub;

        return mod * 64 + sub;
    };

    const add = (mod: number, sub: number, source: string): void => {
        mod |= 0;
        sub |= 0;

        if (mod < 0 || sub < 0 || sub >= 64)
            return;

        const absBlock = getAbsBlock(mod, sub);
        if (absBlock === null || absBlock < 0 || absBlock >= blockCount)
            return;

        const tabOffs = absBlock * 4;
        if (tabOffs + 4 > blocksTab.byteLength)
            return;

        const blockOffs = blocksTab.getUint32(tabOffs, false);
        if (blockOffs === 0xFFFFFFFF)
            return;

        if (seenAbs.has(absBlock))
            return;

        seenAbs.add(absBlock);
        out.push({
            index: out.length,
            mod,
            sub,
            absBlock,
            source,
        });
    };

    try {
        const [mapsTabBuf, mapsBinBuf] = await Promise.all([
            dataFetcher.fetchData(`${gameInfo.pathBase}/MAPS.tab`, { allow404: true }),
            dataFetcher.fetchData(`${gameInfo.pathBase}/MAPS.bin`, { allow404: true }),
        ]);

        const mapsTab = mapsTabBuf.createDataView();
        const mapsBin = mapsBinBuf.createDataView();
        const mapCount = Math.floor(mapsTab.byteLength / 0x1C);

        for (let mapNum = 0; mapNum < mapCount; mapNum++) {
            try {
                const info = getMapInfo(mapsTab, mapsBin, mapNum);

                if (info.infoOffset < 0 || info.infoOffset + 8 > mapsBin.byteLength)
                    continue;
                if (info.blockTableOffset < 0 || info.blockTableOffset >= mapsBin.byteLength)
                    continue;
                if (info.blockCols <= 0 || info.blockRows <= 0 || info.blockCols > 128 || info.blockRows > 128)
                    continue;

                for (let row = 0; row < info.blockRows; row++) {
                    for (let col = 0; col < info.blockCols; col++) {
                        const blockInfo = getBlockInfo(mapsBin, info, col, row);
                        if (blockInfo)
                            add(blockInfo.mod, blockInfo.sub, `map ${mapNum}`);
                    }
                }
            } catch {
            }
        }
    } catch {
    }
    if (trkblk) {
        const modCount = trkblk.byteLength >>> 1;
        for (let mod = 0; mod < modCount; mod++) {
            for (let sub = 0; sub < 64; sub++)
                add(mod, sub, 'TRKBLK');
        }
    }

    if (out.length === 0) {
        for (let abs = 0; abs < blockCount; abs++)
            add(Math.floor(abs / 64), abs & 63, 'BLOCKS.tab fallback');
    }

    return out;
}

export function cleanupDPBlockGalleryUI(): void {
    document.getElementById('dp-block-gallery-ui')?.remove();
    (window as any).__dpBlockGalleryUI = undefined;
}



async function loadSFABlockGalleryEntries(
    dataFetcher: DataFetcher,
    gameInfo: GameInfo,
): Promise<SFABlockGalleryEntry[]> {
    const trkblk = (await dataFetcher.fetchData(`${gameInfo.pathBase}/TRKBLK.tab`)).createDataView();
    const modCount = trkblk.byteLength >>> 1;

    const out: SFABlockGalleryEntry[] = [];
    const seen = new Set<string>();

    const bases: number[] = [];
    for (let mod = 0; mod < modCount; mod++) {
        const base = trkblk.getUint16(mod * 2);
        if (base !== 0xFFFF)
            bases.push(base);
    }

    const sortedBases = Array.from(new Set(bases)).sort((a, b) => a - b);

    const getNextBase = (base: number): number | null => {
        for (const b of sortedBases) {
            if (b > base)
                return b;
        }
        return null;
    };

    for (let mod = 0; mod < modCount; mod++) {
        const base = trkblk.getUint16(mod * 2);
        if (base === 0xFFFF)
            continue;

        const subdir = gameInfo.subdirs[mod];
if (typeof subdir !== 'string' || subdir.length === 0)
    continue;
        const modNum = getSFAModFileNum(mod);

        const tabPath = `${gameInfo.pathBase}/${subdir}/mod${modNum}.tab`;
        const tabBuf = await dataFetcher.fetchData(tabPath, { allow404: true });
        const tab = tabBuf.createDataView();

        if (tab.byteLength === 0)
            continue;

        const nextBase = getNextBase(base);
        const maxByNextBase = nextBase !== null ? Math.min(nextBase, base + 64) : (base + 64);
        const maxByTab = Math.min(tab.byteLength >>> 2, maxByNextBase);

        for (let absBlock = base; absBlock < maxByTab; absBlock++) {
            const tabOffs = absBlock * 4;
            if (tabOffs + 4 > tab.byteLength)
                break;

            const tabValue = tab.getUint32(tabOffs, false);
            if (!(tabValue & 0x10000000))
                continue;

            const sub = absBlock - base;
            const key = `${mod}:${sub}`;
            if (seen.has(key))
                continue;
            seen.add(key);

            out.push({
                index: out.length,
                mod,
                sub,
                absBlock,
                source: `${subdir}/mod${modNum}`,
            });
        }
    }

    return out;
}

function ensureDPBlockGalleryUI(
    entries: DPBlockGalleryEntry[],
    getIndex: () => number,
    setIndex: (index: number) => void | Promise<void>,
): void {
    cleanupDPBlockGalleryUI();

    const wrap = document.createElement('div');
    wrap.id = 'dp-block-gallery-ui';
    wrap.style.position = 'fixed';
    wrap.style.right = '8px';
    wrap.style.top = '8px';
    wrap.style.zIndex = '10000';
    wrap.style.width = '330px';
    wrap.style.background = 'rgba(0,0,0,0.85)';
    wrap.style.color = '#fff';
    wrap.style.font = '12px monospace';
    wrap.style.padding = '8px';
    wrap.style.border = '1px solid rgba(255,255,255,0.25)';
    wrap.style.borderRadius = '8px';
    wrap.style.display = 'grid';
    wrap.style.gap = '6px';

    const title = document.createElement('div');
    title.textContent = 'DP Block Gallery';
    title.style.fontWeight = 'bold';
    wrap.appendChild(title);

    const status = document.createElement('div');
    status.style.whiteSpace = 'pre-wrap';
    wrap.appendChild(status);

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = String(Math.max(0, entries.length - 1));
    input.step = '1';
    input.style.width = '100%';
    wrap.appendChild(input);

    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 1fr 1fr';
    row.style.gap = '6px';

    const prev = document.createElement('button');
    prev.textContent = 'Prev';

    const load = document.createElement('button');
    load.textContent = 'Load';

    const next = document.createElement('button');
    next.textContent = 'Next';

    row.appendChild(prev);
    row.appendChild(load);
    row.appendChild(next);
    wrap.appendChild(row);

    const clamp = (v: number): number => {
        if (!Number.isFinite(v)) return 0;
        if (v < 0) return 0;
        if (v >= entries.length) return entries.length - 1;
        return v | 0;
    };

    const sync = () => {
        const index = clamp(getIndex());
        const e = entries[index];

        input.value = String(index);

        status.textContent =
            `entry ${index} / ${entries.length - 1}\n` +
            `abs=${e.absBlock} hex=0x${e.absBlock.toString(16).toUpperCase().padStart(4, '0')}\n` +
            `mod=${e.mod} sub=${e.sub}\n` +
            `source=${e.source}`;
    };

    prev.onclick = async () => {
        await setIndex(clamp(getIndex() - 1));
        sync();
    };

    next.onclick = async () => {
        await setIndex(clamp(getIndex() + 1));
        sync();
    };

    load.onclick = async () => {
        await setIndex(clamp(Number(input.value) | 0));
        sync();
    };

    input.onchange = async () => {
        await setIndex(clamp(Number(input.value) | 0));
        sync();
    };

    document.body.appendChild(wrap);
    sync();
}

export class DPBlockGallerySceneDesc implements Viewer.SceneDesc {
    constructor(public id: string, public name: string, private gameInfo: GameInfo = DP_GAME_INFO) {}

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        cleanupTextureToggleUI();
        cleanupDPBlockGalleryUI();

        const gInfo = this.gameInfo;
        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);

        const texFetcher = await SFATextureFetcher.create(gInfo, context.dataFetcher, false);
        texFetcher.setModelVersion(ModelVersion.DinosaurPlanet);

        const blockFetcher = await DPBlockFetcher.create(
            gInfo,
            context.dataFetcher,
            materialFactory,
            Promise.resolve(texFetcher),
        );

const blockEntries = await loadDPBlockGalleryEntries(context.dataFetcher, gInfo);

let currentBlockIndex = Math.min(1, Math.max(0, blockEntries.length - 1));
let currentBlockInfo: BlockInfo = {
mod: blockEntries[currentBlockIndex]?.mod ?? 0,
sub: blockEntries[currentBlockIndex]?.sub ?? 0,
};

const setBlockIndex = async (index: number) => {
    currentBlockIndex = Math.max(0, Math.min(blockEntries.length - 1, index | 0));

    const e = blockEntries[currentBlockIndex];
    currentBlockInfo = {
        mod: e.mod,
        sub: e.sub,
    };

    (mapRenderer as any).map.setDPGalleryBlockInfo(currentBlockInfo);
    await mapRenderer.reloadForTextureToggle();
};

        const mapSceneInfo: MapSceneInfo = {
            getNumCols() { return 1; },
            getNumRows() { return 1; },
            getBlockInfoAt(col: number, row: number): BlockInfo | null {
                return currentBlockInfo;
            },
            getOrigin(): number[] {
                return [0, 0];
            },
        };

        const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
        mapRenderer.mapNum = 'dp_block_gallery';
        mapRenderer.dpMinimapMapId = -1;
        mapRenderer.showMinimap = false;
        mapRenderer.showAllObjects = false;

await mapRenderer.create(mapSceneInfo, gInfo, context.dataFetcher, blockFetcher, {
    dpMapScene: true,
    galleryCenterBlock: true,
});

ensureDPBlockGalleryUI(
    blockEntries,
    () => currentBlockIndex,
    async (index: number) => {
        await setBlockIndex(index);
    },
);

        const matrix = mat4.create();
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}

class SFADPHitsCompareRenderer extends SFARenderer {
    private mapNum = 1;
    private sfaSnapshot: HitFootprintSnapshot | null = null;
    private dpSnapshot: HitFootprintSnapshot | null = null;
    private loading = false;
    private status = 'Loading...';
    private loadSeq = 0;

    constructor(
        public context: SceneContext,
        animController: SFAAnimationController,
        materialFactory: MaterialFactory,
        private dataFetcher: DataFetcher,
    ) {
        super(context, animController, materialFactory);
    }

    public getMapNum(): number {
        return this.mapNum;
    }

    public async setMapNum(mapNum: number): Promise<void> {
        this.mapNum = Math.max(0, mapNum | 0);
        await this.reload();
    }

    public async reload(): Promise<void> {
        const seq = ++this.loadSeq;
        const mapNum = this.mapNum;

        this.loading = true;
        this.status = `Loading SFA map ${mapNum} and DP map ${mapNum}...`;

        try {
            const [sfaInfo, dpInfo] = await Promise.all([
                loadMap(SFA_GAME_INFO, this.dataFetcher, mapNum),
                loadMap(DP_GAME_INFO, this.dataFetcher, mapNum),
            ]);

            if (seq !== this.loadSeq)
                return;

            this.sfaSnapshot = buildHitFootprintSnapshot('SFA', mapNum, sfaInfo);
            this.dpSnapshot = buildHitFootprintSnapshot('DP', mapNum, dpInfo);
            this.status = `Loaded map ${mapNum}.`;
        } catch (e) {
            if (seq !== this.loadSeq)
                return;

            this.sfaSnapshot = null;
            this.dpSnapshot = null;
            this.status = `Load failed for map ${mapNum}: ${String(e)}`;
        } finally {
            if (seq === this.loadSeq)
                this.loading = false;
        }
    }

    private drawHitFootprintSnapshotPanel(
        ctx: CanvasRenderingContext2D,
        snap: HitFootprintSnapshot | null,
        boxX: number,
        boxY: number,
        boxW: number,
        boxH: number,
        hitColor: string,
    ): void {
        ctx.fillStyle = 'rgba(0,0,0,0.84)';
        ctx.fillRect(boxX, boxY, boxW, boxH);

        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        ctx.font = '14px monospace';
        ctx.textBaseline = 'top';

        if (!snap) {
            ctx.fillStyle = '#ffffff';
            ctx.fillText('not loaded', boxX + 10, boxY + 10);
            return;
        }

        const pad = 12;
        const headerH = 66;
        const mapName = getHitFootprintMapName(snap.gameLabel, snap.mapNum);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${snap.gameLabel} map ${snap.mapNum}`, boxX + 10, boxY + 8);

        ctx.fillStyle = '#ffe100';
        ctx.fillText(mapName, boxX + 10, boxY + 26);

        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(
            `grid ${snap.cols}x${snap.rows} | HITS ${snap.hitLines.length}`,
            boxX + 10,
            boxY + 44,
        );

        const worldW = Math.max(1, snap.cols * 640);
        const worldH = Math.max(1, snap.rows * 640);

        const areaW = Math.max(1, boxW - pad * 2);
        const areaH = Math.max(1, boxH - headerH - pad * 2);

        const scale = Math.min(
            areaW / worldW,
            areaH / worldH,
        );

        const mapW = worldW * scale;
        const mapH = worldH * scale;

        const mapX = boxX + Math.floor((boxW - mapW) * 0.5);
        const mapY = boxY + headerH + pad + Math.floor((areaH - mapH) * 0.5);

        const sx = (x: number) => mapX + x * scale;
        const sy = (z: number) => mapY + z * scale;

        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;

        for (let col = 0; col <= snap.cols; col++) {
            ctx.beginPath();
            ctx.moveTo(sx(col * 640), sy(0));
            ctx.lineTo(sx(col * 640), sy(worldH));
            ctx.stroke();
        }

        for (let row = 0; row <= snap.rows; row++) {
            ctx.beginPath();
            ctx.moveTo(sx(0), sy(row * 640));
            ctx.lineTo(sx(worldW), sy(row * 640));
            ctx.stroke();
        }

        if (scale * 640 >= 34) {
            ctx.font = '10px monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.82)';

            for (let row = 0; row < snap.rows; row++) {
                for (let col = 0; col < snap.cols; col++) {
                    const b = snap.blocks[row]?.[col] ?? null;
                    if (!b)
                        continue;

                    ctx.fillText(
                        `${b.mod}.${b.sub}`,
                        sx(col * 640) + 3,
                        sy(row * 640) + 3,
                    );
                }
            }
        }

        ctx.strokeStyle = hitColor;
        ctx.lineWidth = 1.6;

        for (const l of snap.hitLines) {
            ctx.beginPath();
            ctx.moveTo(sx(l.x0), sy(l.z0));
            ctx.lineTo(sx(l.x1), sy(l.z1));
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(mapX, mapY, mapW, mapH);
    }

    private drawCompareOverlay(): void {
        const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
        if (!ctx)
            return;

        const canvas = ctx.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const totalW = Math.min(1240, canvas.width - 48);
        const totalH = Math.min(680, canvas.height - 96);

        if (totalW <= 160 || totalH <= 120)
            return;

        const gap = 18;
        const panelW = Math.floor((totalW - gap) * 0.5);
        const panelH = totalH;

        const startX = Math.floor((canvas.width - totalW) * 0.5);
        const startY = Math.floor((canvas.height - totalH) * 0.5);

        ctx.save();

        this.drawHitFootprintSnapshotPanel(
            ctx,
            this.sfaSnapshot,
            startX,
            startY,
            panelW,
            panelH,
            '#00e5ff',
        );

        this.drawHitFootprintSnapshotPanel(
            ctx,
            this.dpSnapshot,
            startX + panelW + gap,
            startY,
            panelW,
            panelH,
            '#ffe100',
        );

        ctx.font = '14px monospace';
        ctx.textBaseline = 'top';

        ctx.fillStyle = 'rgba(0,0,0,0.86)';
        ctx.fillRect(startX, startY - 30, totalW, 24);

        ctx.fillStyle = this.loading ? '#ffe100' : '#ffffff';
        ctx.fillText(this.status, startX + 8, startY - 26);

        ctx.restore();
    }

    protected override update(viewerInput: Viewer.ViewerRenderInput): void {
        super.update(viewerInput);
        this.drawCompareOverlay();
    }

    protected override addWorldRenderInsts(
        device: GfxDevice,
        renderInstManager: GfxRenderInstManager,
        renderLists: SFARenderLists,
        sceneCtx: SceneRenderContext,
    ): void {
    }

    public override destroy(device: GfxDevice): void {
        cleanupSFADPHitsCompareSceneUI();

        const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
        if (ctx)
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        super.destroy(device);
    }
}

export class SFADPHitsCompareSceneDesc implements Viewer.SceneDesc {
    constructor(
        public id: string = 'sfa_dp_hits_compare',
        public name: string = 'SFA vs DP HITS Footprint',
    ) {
    }

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        cleanupTextureToggleUI();
        cleanupDPBlockGalleryUI();
        cleanupSFADPHitsCompareSceneUI();

        const musicState = (window as any).musicState;
        if (musicState.audio) {
            musicState.audio.pause();
            musicState.audio.currentTime = 0;
            musicState.audio = null;
        }

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);

        const renderer = new SFADPHitsCompareRenderer(
            context,
            animController,
            materialFactory,
            context.dataFetcher,
        );

        await renderer.reload();

        ensureSFADPHitsCompareSceneUI(
            () => renderer.getMapNum(),
            async (mapNum: number) => {
                await renderer.setMapNum(mapNum);
            },
        );

        return renderer;
    }
}

function cleanupSFAUnusedHitsCompareSceneUI(): void {
    document.getElementById('sfa-dp-unused-hits-compare-scene-ui')?.remove();
    (window as any).__sfaDPUnusedHitsCompareSceneUI = undefined;
}

function ensureSFAUnusedHitsCompareSceneUI(
    getAbsBlock: () => number,
    setAbsBlock: (absBlock: number) => void | Promise<void>,
    stepUnused: (dir: number) => void | Promise<void>,
): void {
    cleanupSFAUnusedHitsCompareSceneUI();

    const wrap = document.createElement('div');
    wrap.id = 'sfa-dp-unused-hits-compare-scene-ui';
    wrap.style.position = 'fixed';
    wrap.style.right = '8px';
    wrap.style.top = '8px';
    wrap.style.zIndex = '10000';
    wrap.style.width = '300px';
    wrap.style.background = 'rgba(0,0,0,0.86)';
    wrap.style.color = '#fff';
    wrap.style.font = '12px monospace';
    wrap.style.padding = '8px';
    wrap.style.border = '1px solid rgba(255,255,255,0.25)';
    wrap.style.borderRadius = '8px';
    wrap.style.display = 'grid';
    wrap.style.gap = '6px';

    const title = document.createElement('div');
    title.textContent = 'SFA vs DP UNUSED HITS';
    title.style.fontWeight = 'bold';
    wrap.appendChild(title);

    const note = document.createElement('div');
    note.textContent =
        'Only unused HITS entries are shown.\n' +
        'SFA and DP absolute IDs are separate; same number is not treated as a match.';    note.style.color = '#aaa';
    note.style.whiteSpace = 'pre-wrap';
    wrap.appendChild(note);

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.value = String(getAbsBlock());
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    wrap.appendChild(input);

    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 1fr 1fr';
    row.style.gap = '6px';

    const prev = document.createElement('button');
    prev.textContent = 'Prev unused';

    const load = document.createElement('button');
    load.textContent = 'Load';

    const next = document.createElement('button');
    next.textContent = 'Next unused';

    row.appendChild(prev);
    row.appendChild(load);
    row.appendChild(next);
    wrap.appendChild(row);

    const loadInput = async () => {
        let absBlock = Number(input.value);
        if (!Number.isFinite(absBlock))
            absBlock = 0;

        absBlock = Math.max(0, absBlock | 0);
        input.value = String(absBlock);
        await setAbsBlock(absBlock);
    };

    prev.onclick = async () => {
        await stepUnused(-1);
        input.value = String(getAbsBlock());
    };

    next.onclick = async () => {
        await stepUnused(1);
        input.value = String(getAbsBlock());
    };

    load.onclick = () => {
        void loadInput();
    };

    input.onchange = () => {
        void loadInput();
    };

    document.body.appendChild(wrap);
}

class SFAUnusedHitsCompareRenderer extends SFARenderer {
    private absBlock = 0;

    private sfaUsage: HitFootprintUsageDB | null = null;
    private dpUsage: HitFootprintUsageDB | null = null;

    private sfaSnapshot: HitFootprintSnapshot | null = null;
    private dpSnapshot: HitFootprintSnapshot | null = null;

    private allUnusedAbsBlocks: number[] = [];
    private loading = false;
    private status = 'Loading unused HITS...';

    constructor(
        public context: SceneContext,
        animController: SFAAnimationController,
        materialFactory: MaterialFactory,
        private dataFetcher: DataFetcher,
    ) {
        super(context, animController, materialFactory);
    }

    public getAbsBlock(): number {
        return this.absBlock;
    }

    public async init(): Promise<void> {
        this.loading = true;
        this.status = 'Scanning SFA and DP MAPS/HITS/TRKBLK...';

        try {
            const [sfaUsage, dpUsage] = await Promise.all([
                loadHitFootprintUsageDB('SFA', SFA_GAME_INFO, this.dataFetcher),
                loadHitFootprintUsageDB('DP', DP_GAME_INFO, this.dataFetcher),
            ]);

            this.sfaUsage = sfaUsage;
            this.dpUsage = dpUsage;

            const merged = new Set<number>();
            for (const n of sfaUsage.unusedAbsBlocks)
                merged.add(n);
            for (const n of dpUsage.unusedAbsBlocks)
                merged.add(n);

            this.allUnusedAbsBlocks = Array.from(merged.values()).sort((a, b) => a - b);
            this.absBlock = this.allUnusedAbsBlocks[0] ?? 0;

            this.rebuildSnapshots();
        } catch (e) {
            this.sfaUsage = null;
            this.dpUsage = null;
            this.sfaSnapshot = null;
            this.dpSnapshot = null;
            this.status = `Unused HITS scan failed: ${String(e)}`;
        } finally {
            this.loading = false;
        }
    }

    public async setAbsBlock(absBlock: number): Promise<void> {
        this.absBlock = Math.max(0, absBlock | 0);
        this.rebuildSnapshots();
    }

    public async stepUnused(dir: number): Promise<void> {
        if (this.allUnusedAbsBlocks.length === 0)
            return;

        const current = this.absBlock | 0;
        let next = this.allUnusedAbsBlocks[0];

        if (dir >= 0) {
            next = this.allUnusedAbsBlocks.find((n) => n > current) ?? this.allUnusedAbsBlocks[0];
        } else {
            for (let i = this.allUnusedAbsBlocks.length - 1; i >= 0; i--) {
                if (this.allUnusedAbsBlocks[i] < current) {
                    next = this.allUnusedAbsBlocks[i];
                    break;
                }
            }

            if (next === this.allUnusedAbsBlocks[0] && current <= this.allUnusedAbsBlocks[0])
                next = this.allUnusedAbsBlocks[this.allUnusedAbsBlocks.length - 1];
        }

        await this.setAbsBlock(next);
    }

    private rebuildSnapshots(): void {
        if (!this.sfaUsage || !this.dpUsage) {
            this.sfaSnapshot = null;
            this.dpSnapshot = null;
            return;
        }

        const sfaUnused = this.sfaUsage.unusedAbsBlocks.includes(this.absBlock);
        const dpUnused = this.dpUsage.unusedAbsBlocks.includes(this.absBlock);

        this.sfaSnapshot = sfaUnused
            ? buildAbsHitFootprintSnapshot(this.sfaUsage, this.absBlock)
            : null;

        this.dpSnapshot = dpUnused
            ? buildAbsHitFootprintSnapshot(this.dpUsage, this.absBlock)
            : null;

        const sfaLine = this.sfaSnapshot
            ? `SFA: ${this.sfaSnapshot.hitLines.length} unused line(s)`
            : `SFA: not in SFA unused HITS list`;

        const dpLine = this.dpSnapshot
            ? `DP:  ${this.dpSnapshot.hitLines.length} unused line(s)`
            : `DP:  not in DP unused HITS list`;

        this.status =
            `absolute HITS block ${this.absBlock} / 0x${this.absBlock.toString(16).toUpperCase().padStart(4, '0')}\n` +
            `${sfaLine}\n` +
            `${dpLine}\n` +
            `SFA unused entries: ${this.sfaUsage.unusedAbsBlocks.length} | DP unused entries: ${this.dpUsage.unusedAbsBlocks.length}`;
    }

    private drawHitFootprintSnapshotPanel(
        ctx: CanvasRenderingContext2D,
        snap: HitFootprintSnapshot | null,
        boxX: number,
        boxY: number,
        boxW: number,
        boxH: number,
        hitColor: string,
    ): void {
        ctx.fillStyle = 'rgba(0,0,0,0.84)';
        ctx.fillRect(boxX, boxY, boxW, boxH);

        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        ctx.textBaseline = 'top';

        if (!snap) {
            ctx.font = '16px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('not in this game unused HITS list', boxX + 12, boxY + 12);
            return;
        }

        const pad = 14;
        const subtitleLines = snap.subtitleLines ?? (snap.subtitle ? [snap.subtitle] : []);
        const shownSubtitleLines = subtitleLines.slice(0, 6);
        const headerH = 82 + shownSubtitleLines.length * 16;

        const drawClippedText = (text: string, x: number, y: number, maxW: number): void => {
            let s = text;
            while (s.length > 4 && ctx.measureText(s).width > maxW)
                s = s.slice(0, -2);

            if (s !== text)
                s = `${s.slice(0, -1)}…`;

            ctx.fillText(s, x, y);
        };

        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = '#ffffff';
        drawClippedText(`${snap.gameLabel}`, boxX + 12, boxY + 10, boxW - 24);

        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#ffe100';
        drawClippedText(snap.displayName ?? `map ${snap.mapNum}`, boxX + 12, boxY + 32, boxW - 24);

        ctx.font = '12px monospace';
        ctx.fillStyle = '#aaaaaa';

        let textY = boxY + 52;
        for (const line of shownSubtitleLines) {
            drawClippedText(line, boxX + 12, textY, boxW - 24);
            textY += 16;
        }

        ctx.fillStyle = '#aaaaaa';
        drawClippedText(
            `grid ${snap.cols}x${snap.rows} | HITS ${snap.hitLines.length}`,
            boxX + 12,
            textY + 2,
            boxW - 24,
        );

        const worldW = Math.max(1, snap.cols * 640);
        const worldH = Math.max(1, snap.rows * 640);

        const areaW = Math.max(1, boxW - pad * 2);
        const areaH = Math.max(1, boxH - headerH - pad * 2);

        const scale = Math.min(
            areaW / worldW,
            areaH / worldH,
        );

        const mapW = worldW * scale;
        const mapH = worldH * scale;

        const mapX = boxX + Math.floor((boxW - mapW) * 0.5);
        const mapY = boxY + headerH + pad + Math.floor((areaH - mapH) * 0.5);

        const sx = (x: number) => mapX + x * scale;
        const sy = (z: number) => mapY + z * scale;

        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;

        for (let col = 0; col <= snap.cols; col++) {
            ctx.beginPath();
            ctx.moveTo(sx(col * 640), sy(0));
            ctx.lineTo(sx(col * 640), sy(worldH));
            ctx.stroke();
        }

        for (let row = 0; row <= snap.rows; row++) {
            ctx.beginPath();
            ctx.moveTo(sx(0), sy(row * 640));
            ctx.lineTo(sx(worldW), sy(row * 640));
            ctx.stroke();
        }

        ctx.font = '12px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.82)';

        for (let row = 0; row < snap.rows; row++) {
            for (let col = 0; col < snap.cols; col++) {
                const b = snap.blocks[row]?.[col] ?? null;
                if (!b)
                    continue;

                ctx.fillText(
                    `${b.mod}.${b.sub}`,
                    sx(col * 640) + 5,
                    sy(row * 640) + 5,
                );
            }
        }

        ctx.strokeStyle = hitColor;
        ctx.lineWidth = 2.0;

        for (const l of snap.hitLines) {
            ctx.beginPath();
            ctx.moveTo(sx(l.x0), sy(l.z0));
            ctx.lineTo(sx(l.x1), sy(l.z1));
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2;
        ctx.strokeRect(mapX, mapY, mapW, mapH);
    }

    private drawCompareOverlay(): void {
        const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
        if (!ctx)
            return;

        const canvas = ctx.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const totalW = Math.min(1400, canvas.width - 48);
        const totalH = Math.min(760, canvas.height - 96);

        if (totalW <= 160 || totalH <= 120)
            return;

        const gap = 18;
        const panelW = Math.floor((totalW - gap) * 0.5);
        const panelH = totalH;

        const startX = Math.floor((canvas.width - totalW) * 0.5);
        const startY = Math.floor((canvas.height - totalH) * 0.5);

        ctx.save();

        this.drawHitFootprintSnapshotPanel(
            ctx,
            this.sfaSnapshot,
            startX,
            startY,
            panelW,
            panelH,
            '#00e5ff',
        );

        this.drawHitFootprintSnapshotPanel(
            ctx,
            this.dpSnapshot,
            startX + panelW + gap,
            startY,
            panelW,
            panelH,
            '#ffe100',
        );

        ctx.font = 'bold 14px monospace';
        ctx.textBaseline = 'top';

        const statusLines = this.status.split('\n');
        const statusH = 10 + statusLines.length * 18;

        ctx.fillStyle = 'rgba(0,0,0,0.86)';
        ctx.fillRect(startX, startY - statusH - 6, totalW, statusH);

        for (let i = 0; i < statusLines.length; i++) {
            ctx.fillStyle = this.loading ? '#ffe100' : '#ffffff';
            ctx.fillText(statusLines[i], startX + 8, startY - statusH + 2 + i * 18);
        }

        ctx.restore();
    }

    protected override update(viewerInput: Viewer.ViewerRenderInput): void {
        super.update(viewerInput);
        this.drawCompareOverlay();
    }

    protected override addWorldRenderInsts(
        device: GfxDevice,
        renderInstManager: GfxRenderInstManager,
        renderLists: SFARenderLists,
        sceneCtx: SceneRenderContext,
    ): void {
    }

    public override destroy(device: GfxDevice): void {
        cleanupSFAUnusedHitsCompareSceneUI();

        const ctx = getDebugOverlayCanvas2D() as CanvasRenderingContext2D | null;
        if (ctx)
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        super.destroy(device);
    }
}

export class SFAUnusedHitsCompareSceneDesc implements Viewer.SceneDesc {
    constructor(
        public id: string = 'sfa_dp_unused_hits_compare',
        public name: string = 'SFA vs DP Unused HITS',
    ) {
    }

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        cleanupTextureToggleUI();
        cleanupDPBlockGalleryUI();
        cleanupSFADPHitsCompareSceneUI();
        cleanupSFAUnusedHitsCompareSceneUI();

        const musicState = (window as any).musicState;
        if (musicState.audio) {
            musicState.audio.pause();
            musicState.audio.currentTime = 0;
            musicState.audio = null;
        }

        const animController = new SFAAnimationController();
        const materialFactory = new MaterialFactory(device);

        const renderer = new SFAUnusedHitsCompareRenderer(
            context,
            animController,
            materialFactory,
            context.dataFetcher,
        );

        await renderer.init();

        ensureSFAUnusedHitsCompareSceneUI(
            () => renderer.getAbsBlock(),
            async (absBlock: number) => {
                await renderer.setAbsBlock(absBlock);
            },
            async (dir: number) => {
                await renderer.stepUnused(dir);
            },
        );

        return renderer;
    }
}

export class SFABlockGallerySceneDesc implements Viewer.SceneDesc {
    constructor(
        public id: string,
        public name: string,
        private gameInfo: GameInfo = SFA_GAME_INFO,
    ) {}

public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
    cleanupTextureToggleUI();
    cleanupDPBlockGalleryUI();

    const gInfo = this.gameInfo;
    const animController = new SFAAnimationController();
    const materialFactory = new MaterialFactory(device);

    const texFetcher = await SFATextureFetcher.create(gInfo, context.dataFetcher, false);

    const blockFetcher = await SFABlockFetcher.create(
        gInfo,
        context.dataFetcher,
        device,
        materialFactory,
        animController,
        Promise.resolve(texFetcher),
    );

    const blockEntries = await loadSFABlockGalleryEntries(context.dataFetcher, gInfo);

    if (blockEntries.length === 0)
        throw new Error('No SFA block gallery entries found.');

    let currentBlockIndex = 0;
    let currentBlockInfo: BlockInfo = {
        mod: blockEntries[currentBlockIndex].mod,
        sub: blockEntries[currentBlockIndex].sub,
    };

    const mapSceneInfo: MapSceneInfo = {
        getNumCols() { return 1; },
        getNumRows() { return 1; },
        getBlockInfoAt(col: number, row: number): BlockInfo | null {
            return currentBlockInfo;
        },
        getOrigin(): number[] {
            return [0, 0];
        },
    };

    const mapRenderer = new MapSceneRenderer(context, animController, materialFactory);
    mapRenderer.mapNum = 'sfa_block_gallery';
    mapRenderer.showAllObjects = false;
    mapRenderer.showMinimap = false;

    await mapRenderer.create(mapSceneInfo, gInfo, context.dataFetcher, blockFetcher, {
        galleryCenterBlock: true,
    });

    const setBlockIndex = async (index: number) => {
        currentBlockIndex = Math.max(0, Math.min(blockEntries.length - 1, index | 0));

        const e = blockEntries[currentBlockIndex];
        currentBlockInfo = {
            mod: e.mod,
            sub: e.sub,
        };

        (mapRenderer as any).map.setGalleryBlockInfo(currentBlockInfo);
        await mapRenderer.reloadForTextureToggle();
    };

    ensureDPBlockGalleryUI(
        blockEntries.map((e) => ({
            index: e.index,
            mod: e.mod,
            sub: e.sub,
            absBlock: e.absBlock,
            source: e.source,
        })),
        () => currentBlockIndex,
        async (index: number) => {
            await setBlockIndex(index);
        },
    );

    const matrix = mat4.create();
    mapRenderer.setMatrix(matrix);

    return mapRenderer;
}
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
        mapRenderer.dpMinimapMapId = this.mapNum;   
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

const collectModelsFromObjects = (objData: DataView | null | undefined) => {
    if (!objData)
        return;

    let offset = 0;
    while (offset < objData.byteLength) {
        const size = objData.getUint8(offset + 2) * 4;
        if (size === 0)
            break;

        try {
            const typeNum = objData.getUint16(offset);
            const ot = objectManager.getObjectType(typeNum, false);
            ot.modelNums.forEach((m: number) => requiredModels.add(m));
        } catch (e) {
        }

        offset += size;
    }
};

collectModelsFromObjects(mapSceneInfo.getObjectsData?.());

try {
    if (DP_VANILLA_COMPARE_INFO) {
        const vanillaPreloadInfo = await loadMap(
            DP_VANILLA_COMPARE_INFO,
            context.dataFetcher,
            this.mapNum,
        );

        collectModelsFromObjects(vanillaPreloadInfo.getObjectsData?.());
    }
} catch (e) {
    console.warn(`[DP VANILLA PRELOAD] failed for map ${this.mapNum}`, e);
}

await dpModelFetcher.preloadModels(Array.from(requiredModels));

  
        if (!texFetcher.textureHolder) texFetcher.textureHolder = { viewerTextures: [], onnewtextures: null };
        let pointSampler: any = null;
        const shownTextures = new Set<any>(); 
const origGetTexture = (texFetcher as any).getTexture.bind(texFetcher);
const dpLogMapId = `dp_${this.mapNum}`;

(texFetcher as any).getTexture = function(cache: any, id: number, useTex1: boolean) {
    logUniqueTextureRequest('DP', dpLogMapId, id, useTex1);

    const res = origGetTexture(cache, id, useTex1);

    if (res && res.viewerTexture) {
        const vt = res.viewerTexture;
        if (!shownTextures.has(vt)) {
            shownTextures.add(vt);
            this.textureHolder.viewerTextures.push(vt);
            if (this.textureHolder.onnewtextures)
                this.textureHolder.onnewtextures();
        }

const cutoutTextures = [0];
if (cutoutTextures.includes(id)) {
    if (!pointSampler) {
        pointSampler = cache.device.createSampler({
            wrapS: GfxWrapMode.Repeat,
            wrapT: GfxWrapMode.Repeat,
            minFilter: GfxTexFilterMode.Point,
            magFilter: GfxTexFilterMode.Point,
            mipFilter: GfxMipFilterMode.Nearest,
            minLOD: 0,
            maxLOD: 100,
        });
    }

    res.gfxSampler = pointSampler;
    (res as any).__exportSampler = {
        wrapS: GfxWrapMode.Repeat,
        wrapT: GfxWrapMode.Repeat,
        minFilter: GfxTexFilterMode.Point,
        magFilter: GfxTexFilterMode.Point,
        mipFilter: GfxMipFilterMode.Nearest,
    };
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

try {
    if (DP_VANILLA_COMPARE_INFO) {
        const vanillaMapSceneInfo = await loadMap(
            DP_VANILLA_COMPARE_INFO,
            context.dataFetcher,
            this.mapNum,
        );

        const vanillaObjectMap = new MapInstance(
            vanillaMapSceneInfo,
            blockFetcher,
            {
                objectManager,
                dpMapScene: true,
            },
        );

        mapRenderer.setDPVanillaObjectMap(vanillaObjectMap);
    }
} catch (e) {
    console.warn(`[DP VANILLA OBJECTS] failed for map ${this.mapNum}`, e);
}

await ensureDPMPEGVoiceUI(context.dataFetcher, gInfo);

const dpObjectDiff = await loadDPObjectDiff(
    context.dataFetcher,
    gInfo,
    DP_VANILLA_COMPARE_INFO,
    this.mapNum,
);

mapRenderer.setDPObjectDiff(dpObjectDiff);

ensureDPObjectDiffUI(dpObjectDiff, async (enabled: boolean) => {
    mapRenderer.showObjectDiff = enabled;
    mapRenderer.setDPUseVanillaObjects(enabled);
});

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
mapRenderer.showHits = false;
ensureDPHitsUI(async (enabled: boolean) => {
    mapRenderer.showHits = enabled;
}, false);

await mapRenderer.initDPGameText(gInfo, context.dataFetcher);
mapRenderer.showGameText = false;
ensureDPGameTextUI(async (enabled: boolean) => {
    mapRenderer.setDPGameTextVisible(enabled);
}, false);

mapRenderer.showMapWireframe = false;
ensureDPWireframeUI(async (enabled: boolean) => {
    mapRenderer.showMapWireframe = enabled;
}, false);

(window as any).__DP_DISABLE_CULL = false;
ensureDPCullUI(async (enabled: boolean) => {
    (window as any).__DP_ENABLE_CULL = enabled;
    await mapRenderer.reloadForTextureToggle();
}, false);

ensureDPExportUI(async (includeTextures, textureLayerMode, includeObjects) => {
    await mapRenderer.exportCurrentMapGLB(includeTextures, textureLayerMode, includeObjects);
}, false);

ensureDPFbfxUI(async (effectId: number) => {
    mapRenderer.playDPFramebufferFX(effectId, 1200);
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
        const sequence = [95, 96, 97, 98, 99, 100, 95];
        for (const val of sequence) {
            mr.envSelect.setValue(val);
            if (mr.envSelect.onvalue) {
                await mr.envSelect.onvalue(val);
            }
            await new Promise(resolve => setTimeout(resolve, 16)); 
        }
    }

    if (mr.timeSelect) {
        const t = DP_ENV_DEFAULT.timeOfDay;

        mr.timeSelect.setValue(t - 1);
        if (mr.timeSelect.onvalue)
            await mr.timeSelect.onvalue(t - 1);

        await new Promise(resolve => setTimeout(resolve, 16));

        mr.timeSelect.setValue(t);
        if (mr.timeSelect.onvalue)
            await mr.timeSelect.onvalue(t);
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
        for (const val of [95, 96, 97, 98, 99, 100, 95]) {
            mr.envSelect.setValue(val);
            if (mr.envSelect.onvalue)
                await mr.envSelect.onvalue(val);
            await new Promise(resolve => setTimeout(resolve, 16)); 
        }
    }

    if (mr.timeSelect) {
        const t = DP_ENV_DEFAULT.timeOfDay;

        mr.timeSelect.setValue(t - 1);
        if (mr.timeSelect.onvalue)
            await mr.timeSelect.onvalue(t - 1);

        await new Promise(resolve => setTimeout(resolve, 16));

        mr.timeSelect.setValue(t);
        if (mr.timeSelect.onvalue)
            await mr.timeSelect.onvalue(t);
    }
}, 10);

        const matrix = mat4.create();
        mat4.rotateY(matrix, matrix, Math.PI * 3 / 4);
        mapRenderer.setMatrix(matrix);

        return mapRenderer;
    }
}
