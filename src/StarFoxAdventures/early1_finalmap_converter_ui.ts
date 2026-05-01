import { debugResolveEarly1TextureId, debugResolveEarly4TextureId } from './textures.js';
import ArrayBufferSlice from '../ArrayBufferSlice.js';
import { decompress as lzoDecompress } from '../Common/Compression/LZO.js';
import type * as Viewer from '../viewer.js';
import type { SceneContext } from '../SceneBase.js';
import type { GfxDevice } from '../gfx/platform/GfxPlatform.js';
type Tri = [number, number, number, number];
type GroupMode = 'single' | 'nibble0' | 'nibble1' | 'nibble2' | 'nibble3';
type ColorMode = 'zero' | 'pidx' | 'neutral_shade';
type TextureMode = 'mapped' | 'viewer_textureless' | 'pseudo_textureless';
type EarlyMapFormat = 'early1_raw' | 'early4_lzo';
type CollisionYMode = 'none' | 'raw' | 'subtract' | 'subtract_expand8' | 'subtract_expand32';

type EarlyMapSourceInfo = {
    format: EarlyMapFormat;
    dlInfoStride: number;
    shaderStride: number;
    bitsOffsets: [number, number, number];
    bitsByteCounts: [number, number, number];
    shaderMode: 'early1' | 'early4_final';
    forceColorIndex16: boolean;
    expandColorPalette16: boolean;
    textureRemapMode: 'early1' | 'early4' | 'identity';
};

const EARLY1_SOURCE_INFO: EarlyMapSourceInfo = {
    format: 'early1_raw',
    dlInfoStride: 0x34,
    shaderStride: 0x40,
    bitsOffsets: [0x74, 0x7C, 0x84],
    bitsByteCounts: [0x78, 0x80, 0x88],
    shaderMode: 'early1',
    forceColorIndex16: false,
    expandColorPalette16: false,
    textureRemapMode: 'early1',
};

const EARLY4_SOURCE_INFO: EarlyMapSourceInfo = {
    format: 'early4_lzo',
    dlInfoStride: 0x38,
    shaderStride: 0x44,
    bitsOffsets: [0x78, 0x7C, 0x80],
    bitsByteCounts: [0x84, 0x86, 0x88],
    shaderMode: 'early4_final',
    forceColorIndex16: true,
    expandColorPalette16: true,

    textureRemapMode: 'early4',
};

function earlyMapSourceInfo(format: EarlyMapFormat): EarlyMapSourceInfo {
    return format === 'early4_lzo' ? EARLY4_SOURCE_INFO : EARLY1_SOURCE_INFO;
}
type CollisionWinding = 'keep' | 'swap12' | 'swap01' | 'swap02';
function textureModeUsesFlatSample(mode: TextureMode): boolean {
    return mode === 'viewer_textureless' || mode === 'pseudo_textureless';
}
export type Early1FinalMapConvertOptions = {
    modelId: number;
    outBaseName: string;
    earlyMapFormat: EarlyMapFormat;
    groupMode: GroupMode;
    colorMode: ColorMode;
    textureMode: TextureMode;
    flatTextureId: number;
    flatTexS: number;
    flatTexT: number;
    collisionYMode: CollisionYMode;
    collisionWinding: CollisionWinding;
    maxTrisPerDL?: number;

    objectsEnabled?: boolean;
    objectMapId?: number;
    keepObjectTypes?: number[];
    mapsBin?: ArrayBuffer | Uint8Array;
    mapsTab?: ArrayBuffer | Uint8Array;
};

export type Early1FinalMapConvertResult = {
    zlbBin: Uint8Array;
    tab: Uint8Array;
    logs: string[];
    processedResourceIds: number[];

    mapsBin?: Uint8Array;
    mapsTab?: Uint8Array;
};

const TAB_FLAG = 0x10000000;
const FINAL_DLINFO_SIZE = 0x1C;
const SHADER_STRIDE = 0x44;

const OP_SET_SHADER = 1;
const OP_CALL_DL = 2;
const OP_SET_VCD = 3;
const OP_SET_MATRICES = 4;
const OP_END = 5;

type OwnedU8 = Uint8Array<ArrayBuffer>;

function copyU8(src: Uint8Array): OwnedU8 {
    const out = new Uint8Array(src.byteLength);
    out.set(src);
    return out;
}

function toBlobBuffer(src: Uint8Array): ArrayBuffer {
    return copyU8(src).buffer;
}

function asU8(buf: ArrayBuffer | Uint8Array): OwnedU8 {
    if (buf instanceof Uint8Array)
        return copyU8(buf);
    return new Uint8Array(buf);
}

function u8(b: Uint8Array, o: number): number { return b[o] ?? 0; }
function u16(b: Uint8Array, o: number): number { return ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0); }
function s16(b: Uint8Array, o: number): number { const v = u16(b, o); return (v & 0x8000) ? v - 0x10000 : v; }
function u32(b: Uint8Array, o: number): number { return (((b[o] ?? 0) << 24) | ((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0)) >>> 0; }
function p8(b: Uint8Array, o: number, v: number): void { b[o] = v & 0xFF; }
function p16(b: Uint8Array, o: number, v: number): void { b[o] = (v >>> 8) & 0xFF; b[o + 1] = v & 0xFF; }
function ps16(b: Uint8Array, o: number, v: number): void { p16(b, o, Math.max(-32768, Math.min(32767, v | 0)) & 0xFFFF); }
function p32(b: Uint8Array, o: number, v: number): void { b[o] = (v >>> 24) & 0xFF; b[o + 1] = (v >>> 16) & 0xFF; b[o + 2] = (v >>> 8) & 0xFF; b[o + 3] = v & 0xFF; }
function align(v: number, a: number): number { return (v + a - 1) & ~(a - 1); }
function isTexturelessMode(mode: TextureMode): boolean {
    return mode !== 'mapped';
}
function growTo(src: Uint8Array, size: number): OwnedU8 {
    const out = new Uint8Array(Math.max(src.byteLength, size));
    out.set(src);
    return out;
}

function setBytes(dst: Uint8Array, off: number, src: Uint8Array): OwnedU8 {
    const out = growTo(dst, off + src.byteLength);
    out.set(src, off);
    return out;
}

class LowBitWriter {
    public data: number[] = [];
    public bitIndex = 0;

    public put(value: number, bits: number): void {
        for (let i = 0; i < bits; i++) {
            if ((this.bitIndex & 7) === 0)
                this.data.push(0);
            if (((value >>> i) & 1) !== 0)
                this.data[this.data.length - 1] |= 1 << (this.bitIndex & 7);
            this.bitIndex++;
        }
    }

    public bytes(): OwnedU8 { return new Uint8Array(this.data); }
}

type TabMap = Map<number, number | null>;

function parseTab(tab: Uint8Array, includeFF = false): TabMap {
    const out = new Map<number, number | null>();
    for (let i = 0; i + 4 <= tab.byteLength; i += 4) {
        const raw = u32(tab, i);
        if (raw === 0)
            continue;
        if (raw === 0xFFFFFFFF) {
            if (includeFF)
                out.set(i >>> 2, null);
        } else {
            out.set(i >>> 2, raw & 0x0FFFFFFF);
        }
    }
    return out;
}

type ArchiveBlocks = { tab: Uint8Array; blocks: Map<number, Uint8Array>; ids: number[] };

function readRawArchive(bin: Uint8Array, tabIn: Uint8Array): ArchiveBlocks {
    const tab = copyU8(tabIn);
    const t = parseTab(tab);
    const ids = [...t.entries()].filter(([, v]) => v !== null).map(([k]) => k).sort((a, b) => a - b);
    const blocks = new Map<number, Uint8Array>();

    for (let n = 0; n < ids.length; n++) {
        const rid = ids[n];
        const s = t.get(rid)! as number;
        const e = (n + 1 < ids.length) ? (t.get(ids[n + 1])! as number) : bin.byteLength;
        if (e > s)
            blocks.set(rid, copyU8(bin.subarray(s, e)));
    }

    return { tab, blocks, ids: [...blocks.keys()].sort((a, b) => a - b) };
}

function fourCC(b: Uint8Array, o: number): string {
    return String.fromCharCode(
        u8(b, o + 0),
        u8(b, o + 1),
        u8(b, o + 2),
        u8(b, o + 3),
    );
}

function decompressLZOnResource(block: Uint8Array, rid: number): OwnedU8 {
    if (block.byteLength < 4)
        return copyU8(block);

    if (fourCC(block, 0) !== 'LZOn')
        return copyU8(block);

    if (block.byteLength < 0x10)
        throw new Error(`resource ${rid} has truncated LZOn header, len=0x${block.byteLength.toString(16)}`);

    const rawLen = u32(block, 0x08);
    const comp = ArrayBufferSlice.fromView(block.subarray(0x10));
    const raw = lzoDecompress(comp, rawLen);

    return copyU8(new Uint8Array(raw.copyToBuffer()));
}

function readLzoArchive(bin: Uint8Array, tabIn: Uint8Array): ArchiveBlocks {
    const rawArc = readRawArchive(bin, tabIn);
    const blocks = new Map<number, Uint8Array>();

    for (const rid of rawArc.ids) {
        const block = rawArc.blocks.get(rid);
        if (!block)
            continue;

        blocks.set(rid, decompressLZOnResource(block, rid));
    }

    return {
        tab: rawArc.tab,
        blocks,
        ids: [...blocks.keys()].sort((a, b) => a - b),
    };
}

function readEarlyMapSourceArchive(bin: Uint8Array, tabIn: Uint8Array, format: EarlyMapFormat): ArchiveBlocks {
    return format === 'early4_lzo'
        ? readLzoArchive(bin, tabIn)
        : readRawArchive(bin, tabIn);
}

async function streamTransform(kind: 'deflate' | 'inflate', input: Uint8Array): Promise<Uint8Array> {
    const streamCtorName = kind === 'deflate' ? 'CompressionStream' : 'DecompressionStream';
    const StreamCtor = (globalThis as any)[streamCtorName];
    if (!StreamCtor)
        throw new Error(`${streamCtorName} is not available in this browser. Use Chrome/Edge, or wire this to your existing Deflate module.`);

    const format = 'deflate';
    const stream = new Blob([toBlobBuffer(input)]).stream().pipeThrough(new StreamCtor(format));
    const ab = await new Response(stream).arrayBuffer();
    return new Uint8Array(ab);
}

async function decompressZlib(input: Uint8Array): Promise<Uint8Array> {
    return streamTransform('inflate', input);
}

async function compressZlib(input: Uint8Array): Promise<Uint8Array> {
    return streamTransform('deflate', input);
}

async function readZlbArchive(bin: Uint8Array, tabIn: Uint8Array): Promise<ArchiveBlocks> {
    const tab = copyU8(tabIn);
    const t = parseTab(tab, true);
    const ids = [...t.entries()].filter(([, v]) => v !== null).map(([k]) => k).sort((a, b) => a - b);
    const blocks = new Map<number, Uint8Array>();

    for (const rid of ids) {
        const s = t.get(rid)! as number;
        if (String.fromCharCode(bin[s], bin[s + 1], bin[s + 2], bin[s + 3]) !== 'ZLB\0')
            throw new Error(`resource ${rid} is not ZLB at 0x${s.toString(16)}`);

        const rawLen = u32(bin, s + 0x08);
        const compLen = u32(bin, s + 0x0C);
        const raw = await decompressZlib(bin.slice(s + 0x10, s + 0x10 + compLen));
        if (raw.byteLength !== rawLen)
            throw new Error(`resource ${rid} raw length mismatch: got ${raw.byteLength}, expected ${rawLen}`);
        blocks.set(rid, raw);
    }

    return { tab, blocks, ids };
}

async function writeZlb(raw: Uint8Array): Promise<Uint8Array> {
    const comp = await compressZlib(raw);
    const out = new Uint8Array(0x10 + comp.byteLength);
    out[0] = 0x5A; out[1] = 0x4C; out[2] = 0x42; out[3] = 0x00; // ZLB\0
    p32(out, 0x04, 1);
    p32(out, 0x08, raw.byteLength);
    p32(out, 0x0C, comp.byteLength);
    out.set(comp, 0x10);
    return out;
}

function parseMaybeHexInt(text: string, fallback: number): number {
    const s = text.trim();

    if (s.length === 0)
        return fallback;

    const isHex =
        s.startsWith('0x') ||
        s.startsWith('0X') ||
        /[a-fA-F]/.test(s);

    const v = parseInt(isHex ? s.replace(/^0x/i, '') : s, isHex ? 16 : 10);

    return Number.isFinite(v) ? v : fallback;
}

function parseSfaMapId(text: string, fallback: number): number {
    const s = text.trim();

    if (s.length === 0)
        return fallback;

    const clean = s.startsWith('0x') || s.startsWith('0X') ? s.slice(2) : s;

    if (!/^[0-9a-fA-F]+$/.test(clean))
        throw new Error(`bad SFA map ID "${text}"`);

    return parseInt(clean, 16);
}

const SFA_OBJECT_ALWAYS_KEEP_TYPES: number[] = [
    0x000D,
    0x004C,
    0x004B,
    0x0230,
    0x004D,
    0x004E,
    0x004F,
    0x0050,
    0x0054,
    0x017E,
    0x07F1,
    0x04EF,
    0x060D,
    0x0554,
    0x02B0,
    0x0509,
    0x0312,
    0x071E,
    0x0525,
    0x048E,
    0x0282,
    0x02FF,
    0x0431

 
];

function parseHexObjectKeepList(text: string): number[] {
    const out: number[] = [];

    for (const part of text.split(/[,\s]+/g)) {
        const s = part.trim();

        if (s.length === 0)
            continue;

        const clean = s.startsWith('0x') || s.startsWith('0X') ? s.slice(2) : s;
        const v = parseInt(clean, 16);

        if (!Number.isFinite(v) || v < 0 || v > 0xFFFF)
            throw new Error(`bad object type "${part}" in keep list`);

        out.push(v & 0xFFFF);
    }

return out;
}


type SfaMapAutoEntry = {
    id: number;
    romlist: string;
    directory: string;
    name: string;
};

const SFA_MAP_AUTO_ENTRIES: SfaMapAutoEntry[] = [
    { id: 0x00, romlist: 'frontend', directory: 'shipbattle', name: 'Ship Battle' },
    { id: 0x01, romlist: 'frontend2', directory: 'animtest', name: 'ZNot Used - Front End2' },
    { id: 0x02, romlist: 'dragrock', directory: 'dragrock', name: 'Dragon Rock - Top' },
    { id: 0x03, romlist: 'krazoapalace', directory: 'animtest', name: 'ZNot Used - Krazoa Palace' },
    { id: 0x04, romlist: 'temple', directory: 'volcano', name: 'Volcano Force Point' },
    { id: 0x05, romlist: 'hightop', directory: 'animtest', name: 'Rolling Demo - Just In Case' },
    { id: 0x06, romlist: 'discovery', directory: 'animtest', name: 'ZNot Used - Discovery Falls' },
    { id: 0x07, romlist: 'hollow', directory: 'swaphol', name: 'ThornTail Hollow' },
    { id: 0x08, romlist: 'hollow2', directory: 'swapholbot', name: 'ThornTail Hollow - Undergro' },
    { id: 0x09, romlist: 'mazecave', directory: 'mazecave', name: 'MazeTest' },
    { id: 0x0A, romlist: 'wastes', directory: 'nwastes', name: 'SnowHorn Wastes' },
    { id: 0x0B, romlist: 'warlock', directory: 'warlock', name: 'Krazoa Palace' },
    { id: 0x0C, romlist: 'fortress', directory: 'crfort', name: 'CloudRunner Fortress' },
    { id: 0x0D, romlist: 'wallcity', directory: 'wallcity', name: 'Walled City' },
    { id: 0x0E, romlist: 'swapcircle', directory: 'lightfoot', name: 'LightFoot Village' },
    { id: 0x0F, romlist: 'cloudtreasure', directory: 'cloudtreasure', name: 'ZNot Used - CloudRunner - T' },
    { id: 0x10, romlist: 'clouddungeon', directory: 'clouddungeon', name: 'CloudRunner - Dungeon' },
    { id: 0x11, romlist: 'cloudtrap', directory: 'animtest', name: 'ZNot Used - CloudRunner - T' },
    { id: 0x12, romlist: 'moonpass', directory: 'mmpass', name: 'Moon Mountain Pass' },
    { id: 0x13, romlist: 'snowmines', directory: 'darkicemines', name: 'DarkIce Mines - Top' },
    { id: 0x14, romlist: 'krashrin2', directory: 'animtest', name: 'ZNot Used - Krazoa Shrine' },
    { id: 0x15, romlist: 'kraztest', directory: 'desert', name: 'Ocean Force Point - Bottom' },
    { id: 0x16, romlist: 'krazchamber', directory: 'animtest', name: 'krazchamber' },
    { id: 0x17, romlist: 'newicemount', directory: 'icemountain', name: 'Ice Mountain' },
    { id: 0x18, romlist: 'newicemount2', directory: 'animtest', name: 'ZNot Used - Ice Mountain 2' },
    { id: 0x19, romlist: 'newicemount3', directory: 'animtest', name: 'ZNot Used - Ice Mountain 3' },
    { id: 0x1A, romlist: 'animtest', directory: 'animtest', name: 'Animtest' },
    { id: 0x1B, romlist: 'snowmines2', directory: 'darkicemines2', name: 'DarkIce Mines - Bottom' },
    { id: 0x1C, romlist: 'snowmines3', directory: 'bossgaldon', name: 'BOSS DarkIce' },
    { id: 0x1D, romlist: 'capeclaw', directory: 'capeclaw', name: 'Cape Claw' },
    { id: 0x1E, romlist: 'insidegal', directory: 'insidegal', name: 'ZNot Used - Inside Galleon' },
    { id: 0x1F, romlist: 'dfshrine', directory: 'dfshrine', name: 'Test Of Combat' },
    { id: 0x20, romlist: 'mmshrine', directory: 'mmshrine', name: 'Test Of Fear' },
    { id: 0x21, romlist: 'ecshrine', directory: 'ecshrine', name: 'Test Of Skill' },
    { id: 0x22, romlist: 'gpshrine', directory: 'gpshrine', name: 'Test Of Knowledge' },
    { id: 0x23, romlist: 'diamondbay', directory: 'dbay', name: 'ZNot Used - Diamond Bay' },
    { id: 0x24, romlist: 'earthwalker', directory: 'animtest', name: 'ZNot Used - EarthWalker Tem' },
    { id: 0x25, romlist: 'willow', directory: 'animtest', name: 'ZNot Used - Willow Grove' },
    { id: 0x26, romlist: 'arwing', directory: 'arwing', name: 'ArWing Level - Andross' },
    { id: 0x27, romlist: 'dbshrine', directory: 'dbshrine', name: 'Test Of Strength' },
    { id: 0x28, romlist: 'nwshrine', directory: 'worldmap', name: 'BOSS Scales' },
    { id: 0x29, romlist: 'ccshrine', directory: 'worldmap', name: 'World Map' },
    { id: 0x2A, romlist: 'wgshrine', directory: 'animtest', name: 'ZNot Used - WGShrine' },
    { id: 0x2B, romlist: 'cloudrace', directory: 'cloudrace', name: 'CloudRunner - Race' },
    { id: 0x2C, romlist: 'finalboss', directory: 'bossdrakor', name: 'BOSS Drakor' },
    { id: 0x2D, romlist: 'wminsert', directory: 'animtest', name: 'ZNot Used - WMinsert' },
    { id: 0x2E, romlist: 'snowmines4', directory: 'animtest', name: 'ZNot Used - DarkIce Mines -' },
    { id: 0x2F, romlist: 'snowmines5', directory: 'animtest', name: 'ZNot Used - DarkIce Mines -' },
    { id: 0x30, romlist: 'trexboss', directory: 'bosstrex', name: 'BOSS TRex' },
    { id: 0x31, romlist: 'mikelava', directory: 'animtest', name: 'ZNot Used - MikesLava' },
    { id: 0x32, romlist: 'dfptop', directory: 'dfptop', name: 'Ocean Force Point - Top' },
    { id: 0x33, romlist: 'swapstore', directory: 'shop', name: 'Shop' },
    { id: 0x34, romlist: 'dragbot', directory: 'dragrockbot', name: 'Dragon Rock - Bottom' },
    { id: 0x35, romlist: 'kamdrag', directory: 'animtest', name: 'ZNot Used - BOSS Kamerian D' },
    { id: 0x36, romlist: 'magicave', directory: 'magiccave', name: 'Magic Cave - Small\\Big' },
    { id: 0x37, romlist: 'duster', directory: 'cloudjoin', name: 'ZNot Used - Duster Cave' },
    { id: 0x38, romlist: 'linkb', directory: 'linkb', name: 'LinkB - Ice2Wastes' },
    { id: 0x39, romlist: 'cloudjoin', directory: 'animtest', name: 'ZNot Used - CloudRunner2Rac' },
    { id: 0x3A, romlist: 'arwingtoplanet', directory: 'arwingtoplanet', name: 'Arwing to Planet' },
    { id: 0x3B, romlist: 'arwingdarkice', directory: 'arwingdarkice', name: 'Arwing Darkice' },
    { id: 0x3C, romlist: 'arwingcloud', directory: 'arwingcloud', name: 'Arwing Cloud' },
    { id: 0x3D, romlist: 'arwingcity', directory: 'arwingcity', name: 'Arwing City' },
    { id: 0x3E, romlist: 'arwingdragon', directory: 'arwingdragon', name: 'Arwing Dragon' },
    { id: 0x3F, romlist: 'gamefront', directory: 'gamefront', name: 'Game Front' },
    { id: 0x40, romlist: 'linklevel', directory: 'linklevel', name: 'LinkK - Nik Test' },
    { id: 0x41, romlist: 'greatfox', directory: 'greatfox', name: 'Great Fox' },
    { id: 0x42, romlist: 'linka', directory: 'linka', name: 'LinkA - Warpstone to Others' },
    { id: 0x43, romlist: 'linkc', directory: 'linkc', name: 'LinkC - Wastes to Hollow' },
    { id: 0x44, romlist: 'linkd', directory: 'linkd', name: 'LinkD - Darkmines top 2 bot' },
    { id: 0x45, romlist: 'linke', directory: 'linke', name: 'LinkE - hollow to moon pass' },
    { id: 0x46, romlist: 'linkf', directory: 'linkf', name: 'LinkF - moonpass to volcano' },
    { id: 0x47, romlist: 'linkg', directory: 'linkg', name: 'LinkG - hollow to lightfoot' },
    { id: 0x48, romlist: 'linkh', directory: 'linkh', name: 'LinkH - lightfoot to capecl' },
    { id: 0x49, romlist: 'linkj', directory: 'linkj', name: 'LinkJ - capeclaw 2 ocean fo' },
    { id: 0x4A, romlist: 'linki', directory: 'linki', name: 'LinkI - CloudRunner2Race' },
];


const FINAL_MOD_TO_SFA_MAP_ID = new Map<number, number>([
    [4, 0x02],   // Dragon Rock - Top
    [8, 0x04],   // Volcano Force Point
[13, 0x07],  // Swaphol
[15, 0x0A],  // Snowhorn Wastes
    [16, 0x0B],  // Krazoa Palace
    [17, 0x33],  // Shop
    [19, 0x0C],  // Cloudrunner Fortress
    [21, 0x0D],  // Walled City
    [22, 0x0E],  // Lightfoot
    [26, 0x12],  // MMpass
    [27, 0x13],  // Darkice Mines 1
    [35, 0x1B],  // Darkice Mines 2
    [45, 0x28],  // NWShrine
    [48, 0x1D],  // Cape Claw
]);

function hexMapId(v: number): string {
    return v.toString(16).toUpperCase().padStart(2, '0');
}

function hexObjectResourceIdForMap(mapId: number): string {
    return (mapId * 7 + 6).toString(16).toUpperCase().padStart(2, '0');
}

function normalizeAutoDetectText(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function parseModNumberFromFilename(filename: string): number | null {
    const m = /(?:^|[_\-.])(?:root_)?mod([0-9a-fA-F]+)(?=[_\-.]|$)/i.exec(filename);

    if (!m)
        return null;

    return parseMaybeHexInt(m[1], -1) >= 0
        ? parseMaybeHexInt(m[1], -1)
        : null;
}

function longestMapDetectToken(e: SfaMapAutoEntry): number {
    return Math.max(
        normalizeAutoDetectText(e.romlist).length,
        normalizeAutoDetectText(e.directory).length,
        normalizeAutoDetectText(e.name).length,
    );
}

function inferSfaMapFromText(text: string): SfaMapAutoEntry | null {
    const hay = normalizeAutoDetectText(text);

    const entries = SFA_MAP_AUTO_ENTRIES
        .slice()
        .sort((a, b) => longestMapDetectToken(b) - longestMapDetectToken(a));

    for (const entry of entries) {
        const tokens = [
            entry.romlist,
            entry.directory,
            entry.name,
        ]
            .map(normalizeAutoDetectText)
            .filter((s) => s.length >= 3);

        for (const token of tokens) {
            if (hay.includes(token))
                return entry;
        }
    }

    return null;
}

function sfaMapEntryById(id: number): SfaMapAutoEntry | null {
    return SFA_MAP_AUTO_ENTRIES.find((e) => e.id === id) ?? null;
}

function inferSfaMapFromFilename(filename: string, modId: number | null): SfaMapAutoEntry | null {
    const byText = inferSfaMapFromText(filename);
    if (byText)
        return byText;

    if (modId !== null) {
        const mappedId = FINAL_MOD_TO_SFA_MAP_ID.get(modId);

        if (mappedId !== undefined)
            return sfaMapEntryById(mappedId);
    }

    return null;
}

function autoFillConverterFromFinalFile(
    file: File | null,
    modelInput: HTMLInputElement,
    nameInput: HTMLInputElement,
    objectMapInput: HTMLInputElement,
    log: HTMLTextAreaElement,
): void {
    if (!file)
        return;

    const filename = file.name;
    const modId = parseModNumberFromFilename(filename);

    if (modId !== null) {
        modelInput.value = String(modId);
        nameInput.value = `mod${modId}`;
    }

    const mapEntry = inferSfaMapFromFilename(filename, modId);

    if (mapEntry) {
        objectMapInput.value = hexMapId(mapEntry.id);

        log.value =
            `Auto-detected from ${filename}\n` +
            `visual mod=${modId !== null ? modId : 'unknown'}\n` +
            `SFA map=${hexMapId(mapEntry.id)} ${mapEntry.romlist} / ${mapEntry.name}\n` +
            `MAPS object resource=0x${hexObjectResourceIdForMap(mapEntry.id)}\n` +
            `Keep list objects stay in-place; all other objects move far away.\n`;
    } else if (modId !== null) {
        log.value =
            `Auto-detected from ${filename}\n` +
            `visual mod=${modId}\n` +
            `No SFA map match found. Fill "SFA object map ID" manually.\n`;
    }
}

function findNextMapsArchiveOffset(tab: Uint8Array, start: number, binSize: number): number {
    let best = binSize;

    for (let i = 0; i + 4 <= tab.byteLength; i += 4) {
        const raw = u32(tab, i);

        if (raw === 0 || raw === 0xFFFFFFFF)
            continue;

        const off = raw & 0x0FFFFFFF;

        if (off > start && off < best)
            best = off;
    }

    if (best <= start || best > binSize)
        throw new Error(`could not find end offset for MAPS resource at 0x${start.toString(16)}`);

    return best;
}

type PackedObjectList = {
    raw: Uint8Array;
    total: number;
    kept: number;
    removed: number;
    keepSummary: string;
};

function stripSfaObjectListRaw(raw: Uint8Array, keepObjectTypes: number[]): PackedObjectList {
const keep = new Set<number>(
    [
        ...SFA_OBJECT_ALWAYS_KEEP_TYPES,
        ...keepObjectTypes,
    ].map((v) => v & 0xFFFF),
);
    const out = copyU8(raw);

    let readOff = 0;
    let total = 0;
    let kept = 0;
    let moved = 0;

    const farXBits = 0x46EA6000; // 30000.0f
    const farYBits = 0xC6EA6000; // -30000.0f
    const farZBits = 0x46EA6000; // 30000.0f

    while (readOff + 4 <= raw.byteLength) {
        const objectType = u16(raw, readOff + 0x00);
        const words = u8(raw, readOff + 0x02);
        const recordLen = words * 4;

        if (recordLen === 0)
            break;

        if (recordLen < 4 || readOff + recordLen > raw.byteLength) {
            throw new Error(
                `bad object record at raw+0x${readOff.toString(16)}` +
                ` type=0x${objectType.toString(16).padStart(4, '0')}` +
                ` words=0x${words.toString(16)}` +
                ` len=0x${recordLen.toString(16)}` +
                ` rawLen=0x${raw.byteLength.toString(16)}`,
            );
        }

        total++;

        if (keep.has(objectType)) {
            kept++;
        } else {
            if (recordLen >= 0x14) {
                p32(out, readOff + 0x08, farXBits);
                p32(out, readOff + 0x0C, farYBits);
                p32(out, readOff + 0x10, farZBits);
                moved++;
            }
        }

        readOff += recordLen;
    }

    const keepSummary = [...keep]
        .sort((a, b) => a - b)
        .map((v) => `0x${v.toString(16).padStart(4, '0')}`)
        .join(',');

    return {
        raw: out,
        total,
        kept,
        removed: moved,
        keepSummary,
    };
}

async function patchSfaMapsObjectsForMap(
    mapsBinIn: ArrayBuffer | Uint8Array,
    mapsTabIn: ArrayBuffer | Uint8Array,
    mapId: number,
    keepObjectTypes: number[],
): Promise<{ mapsBin: Uint8Array; mapsTab: Uint8Array; log: string }> {
    const mapsBin = asU8(mapsBinIn);
    const mapsTab = asU8(mapsTabIn);

    const objectResourceId = mapId * 7 + 6;
    const tabOff = objectResourceId * 4;

    if (tabOff + 4 > mapsTab.byteLength)
        throw new Error(`map ${mapId} object resource ${objectResourceId} is outside MAPS.tab`);

    const start = u32(mapsTab, tabOff) & 0x0FFFFFFF;

    if (start <= 0 || start >= mapsBin.byteLength) {
        throw new Error(
            `bad MAPS.tab object offset for map ${mapId}` +
            ` resource=${objectResourceId}` +
            ` offset=0x${start.toString(16)}`,
        );
    }

    const end = findNextMapsArchiveOffset(mapsTab, start, mapsBin.byteLength);
    const oldSpan = end - start;

    let zlbOff = start;
    let hasFaceFeed = false;

    if (u32(mapsBin, start) === 0xFACEFEED) {
        hasFaceFeed = true;
        zlbOff = start + 0x20;
    }

    if (fourCC(mapsBin, zlbOff) !== 'ZLB\0') {
        throw new Error(
            `map ${mapId} object resource ${objectResourceId}` +
            ` is not ZLB/FACEFEED-ZLB at MAPS.bin+0x${start.toString(16)}`,
        );
    }

    const rawLen = u32(mapsBin, zlbOff + 0x08);
    const compLen = u32(mapsBin, zlbOff + 0x0C);

    if (zlbOff + 0x10 + compLen > mapsBin.byteLength) {
        throw new Error(
            `map ${mapId} object ZLB compressed data exceeds MAPS.bin` +
            ` zlbOff=0x${zlbOff.toString(16)}` +
            ` compLen=0x${compLen.toString(16)}`,
        );
    }

    const raw = await decompressZlib(mapsBin.slice(zlbOff + 0x10, zlbOff + 0x10 + compLen));

    if (raw.byteLength !== rawLen) {
        throw new Error(
            `map ${mapId} object raw length mismatch:` +
            ` got 0x${raw.byteLength.toString(16)}` +
            ` expected 0x${rawLen.toString(16)}`,
        );
    }

    const stripped = stripSfaObjectListRaw(raw, keepObjectTypes);
    const newZlb = await writeZlb(stripped.raw);

    const maxZlbLen = oldSpan - (hasFaceFeed ? 0x20 : 0);

    if (newZlb.byteLength > maxZlbLen) {
        throw new Error(
            `stripped object ZLB grew too large:` +
            ` new=0x${newZlb.byteLength.toString(16)}` +
            ` max=0x${maxZlbLen.toString(16)}` +
            ` oldSpan=0x${oldSpan.toString(16)}`,
        );
    }

    const outBin = copyU8(mapsBin);
    outBin.fill(0, start, end);

    if (hasFaceFeed) {
        outBin.set(mapsBin.subarray(start, start + 0x20), start);
        p32(outBin, start + 0x04, stripped.raw.byteLength);
        p32(outBin, start + 0x0C, newZlb.byteLength);

        outBin.set(newZlb, start + 0x20);
    } else {
        outBin.set(newZlb, start);
    }

const log =
    `objects moved far for map=${mapId}` +
    ` objectResource=${objectResourceId}` +
    ` offset=0x${start.toString(16)}` +
    ` span=0x${oldSpan.toString(16)}` +
    ` raw=0x${raw.byteLength.toString(16)}` +
    ` oldZlb=0x${(0x10 + compLen).toString(16)}` +
    ` newZlb=0x${newZlb.byteLength.toString(16)}` +
    ` total=${stripped.total}` +
    ` kept=${stripped.kept}` +
    ` moved=${stripped.removed}` +
    ` keep=[${stripped.keepSummary}]` +
    ` far=(30000,-30000,30000)`;

    return { mapsBin: outBin, mapsTab, log };
}

type EarlyInfo = ReturnType<typeof earlyInfo>;
type FinalInfo = ReturnType<typeof finalInfo>;

function earlyInfo(b: Uint8Array) {
    return {
        triOff: u32(b, 0x4C), batchOff: u32(b, 0x50), texOff: u32(b, 0x54),
        posOff: u32(b, 0x58), clrOff: u32(b, 0x5C), texcoordOff: u32(b, 0x60), shaderOff: u32(b, 0x64), dlInfoOff: u32(b, 0x68),
        posCount: u16(b, 0x8E), clrCount: u16(b, 0x92), texcoordCount: u16(b, 0x94), triCount: u16(b, 0x96),
        batchCountMinus1: u16(b, 0x98), texCount: u8(b, 0x9E), dlInfoCount: u8(b, 0x9F), shaderCount: u8(b, 0xA0),
    };
}

function finalInfo(b: Uint8Array) {
    return {
        texOff: u32(b, 0x54), posOff: u32(b, 0x58), clrOff: u32(b, 0x5C), texcoordOff: u32(b, 0x60), shaderOff: u32(b, 0x64), dlInfoOff: u32(b, 0x68),
        bitsOff: u32(b, 0x78), bitsCount: u16(b, 0x84),
        posCount: u16(b, 0x90), clrCount: u16(b, 0x94), texcoordCount: u16(b, 0x96),
        texCount: u8(b, 0xA0), dlInfoCount: u8(b, 0xA1), shaderCount: u8(b, 0xA2),
    };
}

function earlyTextures(root: Uint8Array): number[] {
    const ri = earlyInfo(root);
    const out: number[] = [];
    for (let i = 0; i < ri.texCount; i++) {
        const o = ri.texOff + i * 4;
        if (o + 4 <= root.byteLength)
            out.push(u16(root, o + 2));
    }
    return out;
}

function finalTextures(root: Uint8Array): number[] {
    const fi = finalInfo(root);
    const out: number[] = [];

    for (let i = 0; i < fi.texCount; i++) {
        const o = fi.texOff + i * 4;
        if (o + 4 <= root.byteLength)
            out.push(u32(root, o));
    }

    return out;
}

function triangles(root: Uint8Array): Tri[] {
    const ri = earlyInfo(root);
    const out: Tri[] = [];
    const maxc = Math.max(0, ((root.byteLength - ri.triOff) / 8) | 0);
    for (let i = 0; i < Math.min(ri.triCount, maxc); i++) {
        const o = ri.triOff + i * 8;
        out.push([u16(root, o + 0), u16(root, o + 2), u16(root, o + 4), u16(root, o + 6)]);
    }
    return out;
}

function computeY(root: Uint8Array, ri: EarlyInfo): number {
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < ri.posCount; i++) {
        const o = ri.posOff + i * 6;
        if (o + 6 <= root.byteLength) {
            const y = s16(root, o + 2);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
    }
    return Number.isFinite(minY) ? ((minY + maxY) / 2) | 0 : 0;
}

function convertedPositions(root: Uint8Array, ri: EarlyInfo, yTranslate: number): Uint8Array {
    const out = new Uint8Array(ri.posCount * 6);
    for (let i = 0; i < ri.posCount; i++) {
        const src = ri.posOff + i * 6;
        ps16(out, i * 6 + 0, s16(root, src + 0) * 8);
        ps16(out, i * 6 + 2, (s16(root, src + 2) - yTranslate) * 8);
        ps16(out, i * 6 + 4, s16(root, src + 4) * 8);
    }
    return out;
}

function colors(root: Uint8Array, ri: EarlyInfo): Uint8Array {
    return root.slice(ri.clrOff, ri.clrOff + ri.clrCount * 2);
}

function expandedEarly34Colors(root: Uint8Array, ri: EarlyInfo): Uint8Array {
    const palBytes = colors(root, ri);
    const palCount = palBytes.byteLength >>> 1;
    const dst = new Uint8Array(0x10000 * 2);

    if (palCount <= 0) {
        dst.fill(0xFF);
        return dst;
    }

    const mask = (palCount <= 0x0100) ? 0x00FF : (palCount <= 0x1000) ? 0x0FFF : -1;

    for (let idx = 0; idx < 0x10000; idx++) {
        let srcIdx = idx & 0x7FFF;

        if (mask !== -1)
            srcIdx &= mask;

        if (srcIdx >= palCount)
            srcIdx %= palCount;

        const s = srcIdx << 1;
        const d = idx << 1;

        dst[d + 0] = palBytes[s + 0] ?? 0xFF;
        dst[d + 1] = palBytes[s + 1] ?? 0xFF;
    }

    return dst;
}

function colorsForFinalMapOutput(root: Uint8Array, ri: EarlyInfo, sourceInfo: EarlyMapSourceInfo): Uint8Array {
    return sourceInfo.expandColorPalette16
        ? expandedEarly34Colors(root, ri)
        : colors(root, ri);
}

function texcoords(root: Uint8Array, ri: EarlyInfo): Uint8Array {
    return root.slice(ri.texcoordOff, ri.texcoordOff + ri.texcoordCount * 4);
}

const INVALID_U16 = 0xFFFF;

type EarlyMaterialHints = {
    texcoordByPos: Uint16Array;
    shaderByPos: Uint16Array;
    learnedTexcoords: number;
    learnedShaders: number;
    texcoordConflicts: number;
    shaderConflicts: number;
    decodedBitOff: number;
    decodedCalls: number;
};

class LowBitStreamReader {
    public bitIndex = 0;

    constructor(private data: Uint8Array, private byteOff: number, private byteCount: number) {
    }

    public canRead(bits: number): boolean {
        return this.bitIndex + bits <= this.byteCount * 8;
    }

    public get(bits: number): number {
        let v = 0;
        for (let i = 0; i < bits; i++) {
            const b = this.data[this.byteOff + (this.bitIndex >>> 3)] ?? 0;
            v |= ((b >>> (this.bitIndex & 7)) & 1) << i;
            this.bitIndex++;
        }
        return v >>> 0;
    }

    public skip(bits: number): void {
        this.bitIndex += bits;
    }
}

function tryDecodeEarlyShaderForDLs(root: Uint8Array, bitOff: number, dlCount: number, shaderCount: number): { shaderForDL: number[]; vcdBitsForDL: number[]; score: number; calls: number } {
    const shaderForDL = new Array<number>(dlCount).fill(-1);
    const vcdBitsForDL = new Array<number>(dlCount).fill(0x05); // POS16, CLR8, TEX16

    if (bitOff <= 0 || bitOff >= root.byteLength)
        return { shaderForDL, vcdBitsForDL, score: -999999, calls: 0 };

    const maxBytes = Math.min(root.byteLength - bitOff, 0x4000);
    const br = new LowBitStreamReader(root, bitOff, maxBytes);

    let currentShader = 0;
    let currentVcdBits = 0x05;
    let calls = 0;
    let invalid = 0;
    let ended = false;

    for (let opCount = 0; opCount < 20000 && br.canRead(4); opCount++) {
        const op = br.get(4);

        if (op === OP_SET_SHADER) {
            if (!br.canRead(6))
                break;
            currentShader = br.get(6) % Math.max(1, shaderCount);
        } else if (op === OP_CALL_DL) {
            if (!br.canRead(8))
                break;

            const listNum = br.get(8);
            if (listNum >= 0 && listNum < dlCount) {
                shaderForDL[listNum] = currentShader;
                vcdBitsForDL[listNum] = currentVcdBits;
                calls++;
            } else {
                invalid++;
            }
        } else if (op === OP_SET_VCD) {
            if (!br.canRead(3))
                break;
            currentVcdBits = br.get(1) | (br.get(1) << 1) | (br.get(1) << 2);
        } else if (op === OP_SET_MATRICES) {
            if (!br.canRead(12))
                break;
            br.skip(12);
        } else if (op === OP_END) {
            ended = true;
            break;
        } else {
            invalid += 20;
            break;
        }
    }

    const filled = shaderForDL.reduce((n, v) => n + (v >= 0 ? 1 : 0), 0);
    const score = filled * 10 + calls * 2 + (ended ? 50 : 0) - invalid * 25;

    return { shaderForDL, vcdBitsForDL, score, calls };
}

function decodeEarlyShaderForDLs(
    root: Uint8Array,
    dlCount: number,
    shaderCount: number,
    sourceInfo: EarlyMapSourceInfo = EARLY1_SOURCE_INFO,
): { shaderForDL: number[]; vcdBitsForDL: number[]; bitOff: number; calls: number } {
    const candidates = sourceInfo.bitsOffsets
        .map((off) => u32(root, off))
        .filter((v, i, a) => v > 0 && v < root.byteLength && a.indexOf(v) === i);

    let best = {
        shaderForDL: new Array<number>(dlCount).fill(-1),
        vcdBitsForDL: new Array<number>(dlCount).fill(0x05),
        score: -999999,
        calls: 0,
        bitOff: 0,
    };

    for (const bitOff of candidates) {
        const r = tryDecodeEarlyShaderForDLs(root, bitOff, dlCount, shaderCount);
        if (r.score > best.score)
            best = { ...r, bitOff };
    }

    return {
        shaderForDL: best.shaderForDL,
        vcdBitsForDL: best.vcdBitsForDL,
        bitOff: best.bitOff,
        calls: best.calls,
    };
}

function vote(votes: Map<number, Map<number, number>>, key: number, value: number): void {
    let m = votes.get(key);
    if (!m) {
        m = new Map<number, number>();
        votes.set(key, m);
    }

    m.set(value, (m.get(value) ?? 0) + 1);
}

function bakeVotes(votes: Map<number, Map<number, number>>, count: number): { values: Uint16Array; learned: number; conflicts: number } {
    const values = new Uint16Array(count);
    values.fill(INVALID_U16);

    let learned = 0;
    let conflicts = 0;

    for (const [key, m] of votes) {
        if (key < 0 || key >= count)
            continue;

        let bestValue = INVALID_U16;
        let bestCount = -1;

        for (const [value, n] of m) {
            if (n > bestCount) {
                bestValue = value;
                bestCount = n;
            }
        }

        if (bestValue !== INVALID_U16) {
            values[key] = bestValue;
            learned++;
        }

        if (m.size > 1)
            conflicts++;
    }

    return { values, learned, conflicts };
}

function scanEarlyDLVertexRecords(dl: Uint8Array, cb: (posIdx: number, colorIdx: number, texIdx: number) => void): void {
    let p = 0;

    while (p + 3 <= dl.byteLength) {
        const cmd = dl[p++];

        if (cmd === 0)
            break;

        const prim = cmd & 0xF8;
        if (prim < 0x80 || prim > 0xB8)
            break;

        const count = u16(dl, p);
        p += 2;

        for (let i = 0; i < count; i++) {
            if (p + 5 > dl.byteLength)
                return;

            const posIdx = u16(dl, p + 0);
            const colorIdx = u8(dl, p + 2);
            const texIdx = u16(dl, p + 3);

            cb(posIdx, colorIdx, texIdx);
            p += 5;
        }
    }
}

function learnMaterialHintsFromEarlyDLs(root: Uint8Array, ri: EarlyInfo, shaderCount: number): EarlyMaterialHints {
    const texVotes = new Map<number, Map<number, number>>();
    const shaderVotes = new Map<number, Map<number, number>>();

    const dlInfoStride = 0x34;
    const dlCount = Math.min(
        ri.dlInfoCount,
        Math.max(0, ((root.byteLength - ri.dlInfoOff) / dlInfoStride) | 0),
        255,
    );

    const decoded = decodeEarlyShaderForDLs(root, dlCount, shaderCount);
    const canUseShaderHints = decoded.bitOff !== 0 && decoded.calls > 0;

    for (let i = 0; i < dlCount; i++) {
        const infoOff = ri.dlInfoOff + i * dlInfoStride;
        const dlOff = u32(root, infoOff + 0x00);
        const dlSize = u16(root, infoOff + 0x04);

        if (dlOff === 0 || dlSize === 0)
            continue;
        if (dlOff + dlSize > root.byteLength)
            continue;

        const shader = decoded.shaderForDL[i];
        const dl = root.subarray(dlOff, dlOff + dlSize);

        scanEarlyDLVertexRecords(dl, (posIdx, _colorIdx, texIdx) => {
            if (posIdx < ri.posCount && texIdx < ri.texcoordCount)
                vote(texVotes, posIdx, texIdx);

            if (canUseShaderHints && posIdx < ri.posCount && shader >= 0)
                vote(shaderVotes, posIdx, shader % Math.max(1, shaderCount));
        });
    }

    const tex = bakeVotes(texVotes, ri.posCount);
    const sh = bakeVotes(shaderVotes, ri.posCount);

    return {
        texcoordByPos: tex.values,
        shaderByPos: sh.values,
        learnedTexcoords: tex.learned,
        learnedShaders: sh.learned,
        texcoordConflicts: tex.conflicts,
        shaderConflicts: sh.conflicts,
        decodedBitOff: decoded.bitOff,
        decodedCalls: decoded.calls,
    };
}

function shaderHintForTri(tri: Tri, hints: EarlyMaterialHints, shaderCount: number): number | null {
    const votes = new Map<number, number>();

    for (const idx of [tri[0], tri[1], tri[2]]) {
        const shader = hints.shaderByPos[idx];
        if (shader !== INVALID_U16)
            votes.set(shader, (votes.get(shader) ?? 0) + 1);
    }

    let bestShader = -1;
    let bestCount = -1;

    for (const [shader, count] of votes) {
        if (count > bestCount) {
            bestShader = shader;
            bestCount = count;
        }
    }

    return bestShader >= 0 ? bestShader % Math.max(1, shaderCount) : null;
}

type EarlyCornerMaterial = {
    pos: number;
    color: number;
    tex: number;
};

type EarlyTriMaterial = {
    shader: number;
    corners: [EarlyCornerMaterial, EarlyCornerMaterial, EarlyCornerMaterial];
};

type EarlyTriMaterialMatchResult = {
    byTri: Map<Tri, EarlyTriMaterial>;
    matched: number;
    unmatched: number;
    candidates: number;
    decodedBitOff: number;
    decodedCalls: number;
};

function triKeyFromPos(a: number, b: number, c: number): string {
    return [a, b, c].sort((x, y) => x - y).join('/');
}

function triKeyFromTri(tri: Tri): string {
    return triKeyFromPos(tri[0], tri[1], tri[2]);
}

function cornerForPos(mat: EarlyTriMaterial, pos: number): EarlyCornerMaterial | null {
    for (const c of mat.corners) {
        if (c.pos === pos)
            return c;
    }

    return null;
}

type EarlyDLVertexFormat = {
    name: string;
    posSize: 1 | 2;
    colorSize: 0 | 1 | 2;
    texSize: 1 | 2;
};

const EARLY_DL_VERTEX_FORMATS: EarlyDLVertexFormat[] = [
    { name: 'p16-c8-t16', posSize: 2, colorSize: 1, texSize: 2 },
    { name: 'p16-c16-t16', posSize: 2, colorSize: 2, texSize: 2 },
    { name: 'p16-t16', posSize: 2, colorSize: 0, texSize: 2 },
    { name: 'p16-c8-t8', posSize: 2, colorSize: 1, texSize: 1 },
    { name: 'p16-c16-t8', posSize: 2, colorSize: 2, texSize: 1 },
    { name: 'p16-t8', posSize: 2, colorSize: 0, texSize: 1 },
];

function earlyDLVertexFormatFromVcdBits(vcdBits: number): EarlyDLVertexFormat {
    const posSize: 1 | 2 = (vcdBits & 0x01) !== 0 ? 2 : 1;
    const colorSize: 1 | 2 = (vcdBits & 0x02) !== 0 ? 2 : 1;
    const texSize: 1 | 2 = (vcdBits & 0x04) !== 0 ? 2 : 1;

    return {
        name: `vcd${vcdBits}-p${posSize * 8}-c${colorSize * 8}-t${texSize * 8}`,
        posSize,
        colorSize,
        texSize,
    };
}

function readDLIndex(dl: Uint8Array, o: number, size: 1 | 2): number {
    return size === 2 ? u16(dl, o) : u8(dl, o);
}

function earlyDLVertexRecordSize(fmt: EarlyDLVertexFormat): number {
    return fmt.posSize + fmt.colorSize + fmt.texSize;
}

function readEarlyDLCorner(dl: Uint8Array, o: number, fmt: EarlyDLVertexFormat): EarlyCornerMaterial {
    let p = o;

    const pos = readDLIndex(dl, p, fmt.posSize);
    p += fmt.posSize;

    const color = fmt.colorSize === 0
        ? INVALID_U16
        : readDLIndex(dl, p, fmt.colorSize as 1 | 2);
    p += fmt.colorSize;

    const tex = readDLIndex(dl, p, fmt.texSize);

    return { pos, color, tex };
}

function scanEarlyDLTriangles(
    dl: Uint8Array,
    fmt: EarlyDLVertexFormat,
    cb: (corners: [EarlyCornerMaterial, EarlyCornerMaterial, EarlyCornerMaterial]) => void,
): void {
    let p = 0;
    const recordSize = earlyDLVertexRecordSize(fmt);

    while (p + 3 <= dl.byteLength) {
        const cmd = dl[p++];

        if (cmd === 0)
            break;

        const prim = cmd & 0xF8;

        if (p + 2 > dl.byteLength)
            return;

        const count = u16(dl, p);
        p += 2;

        if (count <= 0)
            continue;

        if (p + count * recordSize > dl.byteLength)
            return;

        const verts: EarlyCornerMaterial[] = [];

        for (let i = 0; i < count; i++) {
            verts.push(readEarlyDLCorner(dl, p, fmt));
            p += recordSize;
        }

        const emit = (a: number, b: number, c: number): void => {
            const va = verts[a];
            const vb = verts[b];
            const vc = verts[c];

            if (va === undefined || vb === undefined || vc === undefined)
                return;

            cb([va, vb, vc]);
        };

        if (prim === 0x80) {
            for (let i = 0; i + 3 < verts.length; i += 4) {
                emit(i + 0, i + 1, i + 2);
                emit(i + 0, i + 2, i + 3);
            }
        } else if (prim === 0x90) {
            for (let i = 0; i + 2 < verts.length; i += 3)
                emit(i + 0, i + 1, i + 2);
        } else if (prim === 0x98) {
            for (let i = 0; i + 2 < verts.length; i++) {
                if ((i & 1) === 0)
                    emit(i + 0, i + 1, i + 2);
                else
                    emit(i + 1, i + 0, i + 2);
            }
        } else if (prim === 0xA0) {
            for (let i = 1; i + 1 < verts.length; i++)
                emit(0, i, i + 1);
        }
    }
}

function scoreEarlyDLVertexFormat(
    dl: Uint8Array,
    fmt: EarlyDLVertexFormat,
    ri: EarlyInfo,
    targetKeys: Set<string>,
): number {
    let score = 0;
    let valid = 0;
    let invalid = 0;
    let hits = 0;

    scanEarlyDLTriangles(dl, fmt, (corners) => {
        let ok = true;

        for (const c of corners) {
            if (c.pos >= ri.posCount)
                ok = false;
            if (c.tex >= ri.texcoordCount)
                ok = false;
        }

        if (!ok) {
            invalid++;
            score -= 50;
            return;
        }

        valid++;

        const key = triKeyFromPos(corners[0].pos, corners[1].pos, corners[2].pos);

        if (targetKeys.has(key)) {
            hits++;
            score += 1000;
        } else {
            score += 1;
        }
    });

    return score + hits * 100 + valid - invalid * 100;
}

function chooseEarlyDLVertexFormat(
    dl: Uint8Array,
    ri: EarlyInfo,
    targetKeys: Set<string>,
): EarlyDLVertexFormat {
    let best = EARLY_DL_VERTEX_FORMATS[0];
    let bestScore = -Infinity;

    for (const fmt of EARLY_DL_VERTEX_FORMATS) {
        const score = scoreEarlyDLVertexFormat(dl, fmt, ri, targetKeys);

        if (score > bestScore) {
            best = fmt;
            bestScore = score;
        }
    }

    return best;
}

function buildTriMaterialHintsForCollisionTris(
    root: Uint8Array,
    ri: EarlyInfo,
    tris: Tri[],
    shaderCount: number,
    texCount: number,
    groupMode: GroupMode,
    textureIndexForShader: number[],
): EarlyTriMaterialMatchResult {
    const dlInfoStride = 0x34;
    const dlCount = Math.min(
        ri.dlInfoCount,
        Math.max(0, ((root.byteLength - ri.dlInfoOff) / dlInfoStride) | 0),
        255,
    );

    const decoded = decodeEarlyShaderForDLs(root, dlCount, shaderCount);
    const candidatesByKey = new Map<string, EarlyTriMaterial[]>();
    const targetKeys = new Set(tris.map((tri) => triKeyFromTri(tri)));
    let candidates = 0;

    for (let i = 0; i < dlCount; i++) {
        const infoOff = ri.dlInfoOff + i * dlInfoStride;
        const dlOff = u32(root, infoOff + 0x00);
        const dlSize = u16(root, infoOff + 0x04);

        if (dlOff === 0 || dlSize === 0)
            continue;

        if (dlOff + dlSize > root.byteLength)
            continue;

        const rawShader = decoded.shaderForDL[i] >= 0 ? decoded.shaderForDL[i] : i;
        const shader = rawShader % Math.max(1, shaderCount);
        const dl = root.subarray(dlOff, dlOff + dlSize);

        let fmt = earlyDLVertexFormatFromVcdBits(decoded.vcdBitsForDL[i] ?? 0x05);

        if (scoreEarlyDLVertexFormat(dl, fmt, ri, targetKeys) <= 0)
            fmt = chooseEarlyDLVertexFormat(dl, ri, targetKeys);

        scanEarlyDLTriangles(dl, fmt, (corners) => {
            for (const c of corners) {
                if (c.pos >= ri.posCount)
                    return;
                if (c.tex >= ri.texcoordCount)
                    return;
            }

            const key = triKeyFromPos(corners[0].pos, corners[1].pos, corners[2].pos);

            if (!targetKeys.has(key))
                return;

            const fixedCorners: [EarlyCornerMaterial, EarlyCornerMaterial, EarlyCornerMaterial] = [
                {
                    pos: corners[0].pos,
                    tex: corners[0].tex,
                    color: corners[0].color < ri.clrCount ? corners[0].color : INVALID_U16,
                },
                {
                    pos: corners[1].pos,
                    tex: corners[1].tex,
                    color: corners[1].color < ri.clrCount ? corners[1].color : INVALID_U16,
                },
                {
                    pos: corners[2].pos,
                    tex: corners[2].tex,
                    color: corners[2].color < ri.clrCount ? corners[2].color : INVALID_U16,
                },
            ];

            let list = candidatesByKey.get(key);

            if (!list) {
                list = [];
                candidatesByKey.set(key, list);
            }

            list.push({ shader, corners: fixedCorners });
            candidates++;
        });
    }

    const byTri = new Map<Tri, EarlyTriMaterial>();
    const usedPerKey = new Map<string, number>();

    let matched = 0;
    let unmatched = 0;

    for (const tri of tris) {
        const key = triKeyFromTri(tri);
        const list = candidatesByKey.get(key);

        if (!list || list.length === 0) {
            unmatched++;
            continue;
        }

        const used = usedPerKey.get(key) ?? 0;
        const fallbackIndex = Math.min(used, list.length - 1);
        void groupMode;
        void texCount;
        void textureIndexForShader;

        const chosen = list[fallbackIndex];

        usedPerKey.set(key, used + 1);
        byTri.set(tri, chosen);
        matched++;
    }

    return {
        byTri,
        matched,
        unmatched,
        candidates,
        decodedBitOff: decoded.bitOff,
        decodedCalls: decoded.calls,
    };
}

function learnLooseMaterialHintsFromEarlyDLs(
    root: Uint8Array,
    ri: EarlyInfo,
    tris: Tri[],
    shaderCount: number,
): EarlyMaterialHints {
    const texVotes = new Map<number, Map<number, number>>();
    const shaderVotes = new Map<number, Map<number, number>>();
    const targetKeys = new Set(tris.map((tri) => triKeyFromTri(tri)));

    const dlInfoStride = 0x34;
    const dlCount = Math.min(
        ri.dlInfoCount,
        Math.max(0, ((root.byteLength - ri.dlInfoOff) / dlInfoStride) | 0),
        255,
    );

    const decoded = decodeEarlyShaderForDLs(root, dlCount, shaderCount);

    for (let i = 0; i < dlCount; i++) {
        const infoOff = ri.dlInfoOff + i * dlInfoStride;
        const dlOff = u32(root, infoOff + 0x00);
        const dlSize = u16(root, infoOff + 0x04);

        if (dlOff === 0 || dlSize === 0)
            continue;
        if (dlOff + dlSize > root.byteLength)
            continue;

        const rawShader = decoded.shaderForDL[i] >= 0 ? decoded.shaderForDL[i] : i;
        const shader = rawShader % Math.max(1, shaderCount);
        const dl = root.subarray(dlOff, dlOff + dlSize);
        let fmt = earlyDLVertexFormatFromVcdBits(decoded.vcdBitsForDL[i] ?? 0x05);

        if (scoreEarlyDLVertexFormat(dl, fmt, ri, targetKeys) <= 0)
            fmt = chooseEarlyDLVertexFormat(dl, ri, targetKeys);

        scanEarlyDLTriangles(dl, fmt, (corners) => {
            for (const c of corners) {
                if (c.pos >= ri.posCount)
                    continue;

                if (c.tex < ri.texcoordCount)
                    vote(texVotes, c.pos, c.tex);

                vote(shaderVotes, c.pos, shader);
            }
        });
    }

    const tex = bakeVotes(texVotes, ri.posCount);
    const sh = bakeVotes(shaderVotes, ri.posCount);

    return {
        texcoordByPos: tex.values,
        shaderByPos: sh.values,
        learnedTexcoords: tex.learned,
        learnedShaders: sh.learned,
        texcoordConflicts: tex.conflicts,
        shaderConflicts: sh.conflicts,
        decodedBitOff: decoded.bitOff,
        decodedCalls: decoded.calls,
    };
}

function rgba4(r: number, g: number, b: number, a: number = 0xF): number {
    return ((r & 0xF) << 12) | ((g & 0xF) << 8) | ((b & 0xF) << 4) | (a & 0xF);
}

function neutralShadeColors(): Uint8Array {   
     const out = new Uint8Array(16 * 2);

    for (let i = 0; i < 16; i++) {
        const base = 6 + Math.round((i / 15) * 7); 
        const r = Math.min(15, base + 1);
        const g = Math.min(15, base + 1);
        const b = Math.min(15, base);

        p16(out, i * 2, rgba4(r, g, b, 0xF));
    }

    return out;
}

function makeNeutralShadeIndexForVertex(root: Uint8Array, ri: EarlyInfo): Uint8Array {
    const out = new Uint8Array(Math.max(1, ri.posCount));

    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < ri.posCount; i++) {
        const o = ri.posOff + i * 6;
        if (o + 6 > root.byteLength)
            continue;

        const y = s16(root, o + 2);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    }

    const spanY = Math.max(1, maxY - minY);

    for (let i = 0; i < ri.posCount; i++) {
        const o = ri.posOff + i * 6;
        if (o + 6 > root.byteLength) {
            out[i] = 8;
            continue;
        }

        const x = s16(root, o + 0);
        const y = s16(root, o + 2);
        const z = s16(root, o + 4);

        const heightShade = Math.round(((y - minY) / spanY) * 9); // 0..9
        const checker = (((x >> 5) ^ (z >> 5)) & 1) ? 2 : 0;

        out[i] = Math.max(0, Math.min(15, 3 + heightShade + checker));
    }

    return out;
}

function boundsFor(root: Uint8Array, ri: EarlyInfo, yTranslate: number, tris: Tri[]): [number, number, number, number, number, number] {
    const xs: number[] = [], ys: number[] = [], zs: number[] = [];
    for (const [v0, v1, v2] of tris) {
        for (const idx of [v0, v1, v2]) {
            if (idx >= 0 && idx < ri.posCount) {
                const o = ri.posOff + idx * 6;
                xs.push(s16(root, o) * 8);
                ys.push((s16(root, o + 2) - yTranslate) * 8);
                zs.push(s16(root, o + 4) * 8);
            }
        }
    }
    if (xs.length === 0)
        return [-8, -8, -8, 8, 8, 8];
    return [Math.min(...xs), Math.min(...ys), Math.min(...zs), Math.max(...xs), Math.max(...ys), Math.max(...zs)];
}

function makeDL(
    tris: Tri[],
    posCount: number,
    clrCount: number,
    texcoordCount: number,
    reverse = true,
    colorMode: ColorMode = 'pidx',
    textureMode: TextureMode = 'mapped',
    neutralShadeIndexForVertex?: Uint8Array,
    materialByTri?: Map<Tri, EarlyTriMaterial>,
    looseHints?: EarlyMaterialHints | null,
): Uint8Array {
    if (tris.length === 0)
        return new Uint8Array(0);

    const out = new Uint8Array(3 + tris.length * 3 * 5);
    let p = 0;
    out[p++] = 0x90 | 5; // GX_TRIANGLES, VAT 5
    p16(out, p, tris.length * 3); p += 2;

    for (const tri of tris) {
        const [v0, v1, v2] = tri;
        const material = materialByTri?.get(tri);
        const order = reverse ? [v0, v2, v1] : [v0, v1, v2];

        for (let pidx of order) {
            pidx = Math.max(0, Math.min(posCount - 1, pidx));

            const learnedCorner = material !== undefined ? cornerForPos(material, pidx) : null;

            let cidx = 0;
            if (colorMode === 'pidx') {
                cidx = learnedCorner !== null && learnedCorner.color !== INVALID_U16 && learnedCorner.color < clrCount
                    ? learnedCorner.color
                    : pidx % Math.max(1, clrCount);
            } else if (colorMode === 'neutral_shade') {
                cidx = neutralShadeIndexForVertex?.[pidx] ?? 8;
            }

            let tidx = 0;
            if (textureMode === 'mapped') {
                const looseTex = looseHints?.texcoordByPos[pidx] ?? INVALID_U16;

                tidx = learnedCorner !== null && learnedCorner.tex < texcoordCount
                    ? learnedCorner.tex
                    : looseTex !== INVALID_U16 && looseTex < texcoordCount
                        ? looseTex
                        : Math.min(pidx, Math.max(0, texcoordCount - 1));
            }
            p16(out, p, pidx); p += 2;
            out[p++] = cidx & 0xFF;
            p16(out, p, tidx); p += 2;
        }
    }

    return out;
}

function chunkList<T>(xs: T[], n: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < xs.length; i += n)
        out.push(xs.slice(i, i + n));
    return out;
}

function shaderGroupForTri(flags: number, mode: GroupMode, texCount: number): number {
    if (mode === 'single' || texCount <= 0)
        return 0;
    let v = 0;
    if (mode === 'nibble0') v = flags & 0xF;
    else if (mode === 'nibble1') v = (flags >>> 4) & 0xF;
    else if (mode === 'nibble2') v = (flags >>> 8) & 0xF;
    else if (mode === 'nibble3') v = (flags >>> 12) & 0xF;
    return v < texCount ? v : 0;
}

type BuiltLayerBitstreams = {
    bitstreams: [Uint8Array, Uint8Array, Uint8Array];
    special: number[];
    layerForDL: number[];
    layerCalls: [number[], number[], number[]];
};

function buildBitstreamForDLOrder(
    dlOrder: number[],
    shaderForDL: number[],
    vcdBitsForDL: number[],
    special: number[],
): Uint8Array {
    if (dlOrder.length === 0)
        return new Uint8Array(0);

    const bw = new LowBitWriter();

    for (const listNum of dlOrder) {
        const shaderNum = shaderForDL[listNum] ?? 0;
        const vcdBits = vcdBitsForDL[listNum] ?? 0x05;
        special[listNum] = bw.bitIndex;

        bw.put(OP_SET_SHADER, 4);
        bw.put(shaderNum, 6);

        bw.put(OP_SET_VCD, 4);
        bw.put((vcdBits >>> 0) & 1, 1);
        bw.put((vcdBits >>> 1) & 1, 1);
        bw.put((vcdBits >>> 2) & 1, 1);

        bw.put(OP_SET_MATRICES, 4);
        bw.put(1, 4);
        bw.put(0, 8);

        bw.put(OP_CALL_DL, 4);
        bw.put(listNum, 8);
    }

    bw.put(OP_END, 4);
    return bw.bytes();
}

function decodeEarlyLayerCallOrder(
    root: Uint8Array,
    bitOff: number,
    byteCount: number,
    dlCount: number,
    shaderCount: number,
): number[] {
    const out: number[] = [];

    if (bitOff <= 0 || byteCount <= 0 || bitOff >= root.byteLength)
        return out;

    if (bitOff + byteCount > root.byteLength)
        byteCount = root.byteLength - bitOff;

    const br = new LowBitStreamReader(root, bitOff, byteCount);

    for (let opCount = 0; opCount < 20000 && br.canRead(4); opCount++) {
        const op = br.get(4);

        if (op === OP_SET_SHADER) {
            if (!br.canRead(6))
                break;
            br.skip(6);
        } else if (op === OP_CALL_DL) {
            if (!br.canRead(8))
                break;

            const listNum = br.get(8);
            if (listNum >= 0 && listNum < dlCount)
                out.push(listNum);
        } else if (op === OP_SET_VCD) {
            if (!br.canRead(3))
                break;
            br.skip(3);
        } else if (op === OP_SET_MATRICES) {
            if (!br.canRead(12))
                break;
            br.skip(12);
        } else if (op === OP_END) {
            break;
        } else {
            break;
        }
    }

    void shaderCount;
    return out;
}

function buildLayerBitstreamsFromEarlyPasses(
    root: Uint8Array,
    ri: EarlyInfo,
    shaderForDL: number[],
    vcdBitsForDL: number[],
    earlyDLIndexes: number[],
    sourceInfo: EarlyMapSourceInfo = EARLY1_SOURCE_INFO,
): BuiltLayerBitstreams {
    const earlyDLInfoStride = sourceInfo.dlInfoStride;
    const earlyDLCount = Math.min(
        ri.dlInfoCount,
        Math.max(0, ((root.byteLength - ri.dlInfoOff) / earlyDLInfoStride) | 0),
        255,
    );

    const earlyLayerStreams = [
        { bitOff: u32(root, sourceInfo.bitsOffsets[0]), byteCount: u16(root, sourceInfo.bitsByteCounts[0]) },
        { bitOff: u32(root, sourceInfo.bitsOffsets[1]), byteCount: u16(root, sourceInfo.bitsByteCounts[1]) },
        { bitOff: u32(root, sourceInfo.bitsOffsets[2]), byteCount: u16(root, sourceInfo.bitsByteCounts[2]) },
    ];

    const outputIndexForEarlyDL = new Map<number, number>();
    for (let outDL = 0; outDL < earlyDLIndexes.length; outDL++)
        outputIndexForEarlyDL.set(earlyDLIndexes[outDL], outDL);

    const layerCalls: [number[], number[], number[]] = [[], [], []];
    const layerForDL = new Array<number>(shaderForDL.length).fill(0);
    const assigned = new Set<number>();

    for (let layer = 0; layer < 3; layer++) {
        const stream = earlyLayerStreams[layer];
        const earlyCalls = decodeEarlyLayerCallOrder(
            root,
            stream.bitOff,
            stream.byteCount,
            earlyDLCount,
            ri.shaderCount,
        );

        for (const earlyListNum of earlyCalls) {
            const outListNum = outputIndexForEarlyDL.get(earlyListNum);
            if (outListNum === undefined)
                continue;

            if (assigned.has(outListNum))
                continue;

            layerCalls[layer].push(outListNum);
            layerForDL[outListNum] = layer;
            assigned.add(outListNum);
        }
    }
    for (let outListNum = 0; outListNum < shaderForDL.length; outListNum++) {
        if (!assigned.has(outListNum)) {
            layerCalls[0].push(outListNum);
            layerForDL[outListNum] = 0;
        }
    }

    const special = new Array<number>(shaderForDL.length).fill(0);
    const bitstreams: [Uint8Array, Uint8Array, Uint8Array] = [
        buildBitstreamForDLOrder(layerCalls[0], shaderForDL, vcdBitsForDL, special),
        buildBitstreamForDLOrder(layerCalls[1], shaderForDL, vcdBitsForDL, special),
        buildBitstreamForDLOrder(layerCalls[2], shaderForDL, vcdBitsForDL, special),
    ];

    return { bitstreams, special, layerForDL, layerCalls };
}

function buildShaderTable(final: Uint8Array, fi: FinalInfo, shaderCount: number, texCount: number, textureIndexForShader?: number[]): Uint8Array {
        const proto = new Uint8Array(SHADER_STRIDE);
    if (fi.shaderOff + SHADER_STRIDE <= final.byteLength)
        proto.set(final.slice(fi.shaderOff, fi.shaderOff + SHADER_STRIDE));

    const out = new Uint8Array(shaderCount * SHADER_STRIDE);

    for (let i = 0; i < shaderCount; i++) {
        const sh = new Uint8Array(proto);
        const texSlot = textureIndexForShader?.[i] ?? (i % Math.max(1, texCount));
        p32(sh, 0x24, texSlot % Math.max(1, texCount));
        p32(sh, 0x40, 0x06010000);
        out.set(sh, i * SHADER_STRIDE);
    }

    return out;
}

function vcdRecordSize(vcdBits: number): number {
    const posSize = (vcdBits & 0x01) !== 0 ? 2 : 1;
    const colorSize = (vcdBits & 0x02) !== 0 ? 2 : 1;
    const texSize = (vcdBits & 0x04) !== 0 ? 2 : 1;
    return posSize + colorSize + texSize;
}

function scoreVcdBitsForRetag(dl: Uint8Array, vcdBits: number): number {
    const recSize = vcdRecordSize(vcdBits);
    let p = 0;
    let primCount = 0;
    let ended = false;

    while (p + 3 <= dl.byteLength) {
        const cmd = dl[p];

        if (cmd === 0) {
            ended = true;
            break;
        }

        const prim = cmd & 0xF8;
        if (prim < 0x80 || prim > 0xB8)
            return -100000 + primCount * 100 - p;

        const count = u16(dl, p + 1);
        p += 3;

        const next = p + count * recSize;
        if (next > dl.byteLength)
            return -50000 + primCount * 100 - (next - dl.byteLength) * 1000;

        p = next;
        primCount++;
    }

    const trailing = dl.byteLength - p;

    return (
        primCount * 1000 +
        (ended ? 5000 : 0) -
        trailing * 2
    );
}

function chooseRetagVcdBits(dl: Uint8Array, decodedVcdBits: number): number {
    const candidates = [
        decodedVcdBits & 0x07,

        0x05, // p16 c8  t16
        0x01, // p16 c8  t8
        0x04, // p8  c8  t16
        0x00, // p8  c8  t8

        0x07, // p16 c16 t16
        0x03, // p16 c16 t8
        0x06, // p8  c16 t16
        0x02, // p8  c16 t8
    ].filter((v, i, a) => a.indexOf(v) === i);

    let bestBits = candidates[0] ?? 0x05;
    let bestScore = -Infinity;

    for (const bits of candidates) {
        const score = scoreVcdBitsForRetag(dl, bits);

        if (score > bestScore) {
            bestScore = score;
            bestBits = bits;
        }
    }

    return bestBits;
}

function retagDisplayListToVat5(dlIn: Uint8Array, vcdBits: number): Uint8Array {
    const out = copyU8(dlIn);
    const recSize = vcdRecordSize(vcdBits);
    let p = 0;

    while (p + 3 <= out.byteLength) {
        const cmd = out[p];

        if (cmd === 0)
            break;

        const prim = cmd & 0xF8;
        if (prim < 0x80 || prim > 0xB8)
            break;
        out[p++] = prim | 5;

        const count = u16(out, p);
        p += 2;

        const next = p + count * recSize;
        if (next > out.byteLength)
            break;

        p = next;
    }

    return out;
}

type RepackedDLResult = {
    dl: Uint8Array;
    ok: boolean;
    log: string;
};

function writeDLIndex(out: number[], value: number, size: 1 | 2): void {
    if (size === 2) {
        out.push((value >>> 8) & 0xFF, value & 0xFF);
    } else {
        out.push(value & 0xFF);
    }
}

function compactEarly4ColorIndex(color: number, ri: EarlyInfo): number {
    const count = Math.max(1, ri.clrCount);

    const lo = color & 0xFF;
    if (lo < count)
        return lo;

    const hi = (color >>> 8) & 0xFF;
    if (hi < count)
        return hi;

    return color % count;
}

function repackDisplayListToVat5(
    dlIn: Uint8Array,
    readVcdBits: number,
    writeVcdBits: number,
    ri: EarlyInfo,
    compactColor: boolean,
): RepackedDLResult {
    const readPosSize: 1 | 2 = (readVcdBits & 0x01) !== 0 ? 2 : 1;
    const readColorSize: 1 | 2 = (readVcdBits & 0x02) !== 0 ? 2 : 1;
    const readTexSize: 1 | 2 = (readVcdBits & 0x04) !== 0 ? 2 : 1;
    const readRecSize = readPosSize + readColorSize + readTexSize;

    const writePosSize: 1 | 2 = (writeVcdBits & 0x01) !== 0 ? 2 : 1;
    const writeColorSize: 1 | 2 = (writeVcdBits & 0x02) !== 0 ? 2 : 1;
    const writeTexSize: 1 | 2 = (writeVcdBits & 0x04) !== 0 ? 2 : 1;

    const out: number[] = [];
    let p = 0;
    let prims = 0;
    let verts = 0;
    let compactedColors = 0;

    while (p + 3 <= dlIn.byteLength) {
        const cmd = dlIn[p];

        if (cmd === 0) {
            out.push(0);
            return {
                dl: new Uint8Array(out),
                ok: true,
                log: `repackOK/prims=${prims}/verts=${verts}/colors=${compactedColors}/old=0x${dlIn.byteLength.toString(16)}/new=0x${out.length.toString(16)}`,
            };
        }

        const prim = cmd & 0xF8;
        if (prim < 0x80 || prim > 0xB8) {
            return {
                dl: retagDisplayListToVat5(dlIn, readVcdBits),
                ok: false,
                log: `repackBAD/badPrim=0x${prim.toString(16)}@0x${p.toString(16)}/keptReadVcd/old=0x${dlIn.byteLength.toString(16)}`,
            };
        }

        const count = u16(dlIn, p + 1);
        p += 3;

        const next = p + count * readRecSize;
        if (next > dlIn.byteLength) {
            return {
                dl: retagDisplayListToVat5(dlIn, readVcdBits),
                ok: false,
                log: `repackBAD/oob@0x${p.toString(16)}/count=${count}/readRec=${readRecSize}/end=0x${next.toString(16)}/len=0x${dlIn.byteLength.toString(16)}/keptReadVcd`,
            };
        }

        out.push(prim | 5);
        out.push((count >>> 8) & 0xFF, count & 0xFF);

        for (let i = 0; i < count; i++) {
            let q = p + i * readRecSize;

            const pos = readDLIndex(dlIn, q, readPosSize);
            q += readPosSize;

            const rawColor = readDLIndex(dlIn, q, readColorSize);
            q += readColorSize;

            const tex = readDLIndex(dlIn, q, readTexSize);

            const color = compactColor
                ? compactEarly4ColorIndex(rawColor, ri)
                : rawColor;

            if (compactColor && color !== rawColor)
                compactedColors++;

            writeDLIndex(out, pos, writePosSize);
            writeDLIndex(out, color, writeColorSize);
            writeDLIndex(out, tex, writeTexSize);
            verts++;
        }

        p = next;
        prims++;
    }

    return {
        dl: new Uint8Array(out),
        ok: true,
        log: `repackOK/noEnd/prims=${prims}/verts=${verts}/colors=${compactedColors}/old=0x${dlIn.byteLength.toString(16)}/new=0x${out.length.toString(16)}`,
    };
}

type Early4DLParseStats = {
    prims: number;
    verts: number;
    ended: boolean;
    stop: string;
    parsedBytes: number;
    trailingBytes: number;
    badPos: number;
    badColor: number;
    badTex: number;
    posMin: number;
    posMax: number;
    colorMin: number;
    colorMax: number;
    texMin: number;
    texMax: number;
    firstCmd: number;
};

function debugVcdName(vcdBits: number): string {
    const v = vcdBits & 0x07;
    return `0x${v.toString(16)}/p${(v & 0x01) !== 0 ? 16 : 8}c${(v & 0x02) !== 0 ? 16 : 8}t${(v & 0x04) !== 0 ? 16 : 8}`;
}

function debugRangeForLog(min: number, max: number): string {
    return min <= max ? `${min}-${max}` : `none`;
}

function debugScanEarly4DLForLog(dl: Uint8Array, vcdBits: number, ri: EarlyInfo): Early4DLParseStats {
    const posSize: 1 | 2 = (vcdBits & 0x01) !== 0 ? 2 : 1;
    const colorSize: 1 | 2 = (vcdBits & 0x02) !== 0 ? 2 : 1;
    const texSize: 1 | 2 = (vcdBits & 0x04) !== 0 ? 2 : 1;
    const recSize = posSize + colorSize + texSize;

    let p = 0;
    let prims = 0;
    let verts = 0;
    let ended = false;
    let stop = 'eof';
    let firstCmd = -1;

    let badPos = 0;
    let badColor = 0;
    let badTex = 0;

    let posMin = 0x7FFFFFFF;
    let posMax = -1;
    let colorMin = 0x7FFFFFFF;
    let colorMax = -1;
    let texMin = 0x7FFFFFFF;
    let texMax = -1;

    while (p + 3 <= dl.byteLength) {
        const cmd = dl[p];

        if (firstCmd < 0)
            firstCmd = cmd;

        if (cmd === 0) {
            ended = true;
            stop = `end@0x${p.toString(16)}`;
            break;
        }

        const prim = cmd & 0xF8;
        if (prim < 0x80 || prim > 0xB8) {
            stop = `badPrim0x${prim.toString(16)}@0x${p.toString(16)}`;
            break;
        }

        const count = u16(dl, p + 1);
        p += 3;

        const next = p + count * recSize;
        if (next > dl.byteLength) {
            stop = `vertexOOB@0x${p.toString(16)} count=${count} rec=${recSize} end=0x${next.toString(16)} len=0x${dl.byteLength.toString(16)}`;
            break;
        }

        for (let i = 0; i < count; i++) {
            let q = p + i * recSize;

            const pos = readDLIndex(dl, q, posSize);
            q += posSize;

            const color = readDLIndex(dl, q, colorSize);
            q += colorSize;

            const tex = readDLIndex(dl, q, texSize);

            verts++;

            posMin = Math.min(posMin, pos);
            posMax = Math.max(posMax, pos);
            colorMin = Math.min(colorMin, color);
            colorMax = Math.max(colorMax, color);
            texMin = Math.min(texMin, tex);
            texMax = Math.max(texMax, tex);

            if (pos >= ri.posCount)
                badPos++;
            const colorLimit = colorSize === 2 ? 0x10000 : ri.clrCount;
            if (color >= colorLimit)
                badColor++;

            if (tex >= ri.texcoordCount)
                badTex++;
        }

        p = next;
        prims++;
    }

    return {
        prims,
        verts,
        ended,
        stop,
        parsedBytes: p,
        trailingBytes: Math.max(0, dl.byteLength - p),
        badPos,
        badColor,
        badTex,
        posMin,
        posMax,
        colorMin,
        colorMax,
        texMin,
        texMax,
        firstCmd,
    };
}

function debugEarly4DLStatsForLog(s: Early4DLParseStats): string {
    return (
        `prim=${s.prims}` +
        `/verts=${s.verts}` +
        `/end=${s.ended ? 1 : 0}` +
        `/stop=${s.stop}` +
        `/trail=0x${s.trailingBytes.toString(16)}` +
        `/badPCT=${s.badPos}/${s.badColor}/${s.badTex}` +
        `/pos=${debugRangeForLog(s.posMin, s.posMax)}` +
        `/clr=${debugRangeForLog(s.colorMin, s.colorMax)}` +
        `/tex=${debugRangeForLog(s.texMin, s.texMax)}` +
        `/first=0x${Math.max(0, s.firstCmd).toString(16)}`
    );
}

function debugNumberSetForLog(set: Set<number>): string {
    const xs = [...set].sort((a, b) => a - b);
    return xs.length > 0 ? xs.join('/') : 'none';
}

function debugMissingLayerCallsForLog(copiedCount: number, layerCalls: [number[], number[], number[]]): string {
    const called = new Set<number>();

    for (const layer of layerCalls) {
        for (const dl of layer)
            called.add(dl);
    }

    const missing: number[] = [];
    for (let i = 0; i < copiedCount; i++) {
        if (!called.has(i))
            missing.push(i);
    }

    return missing.length > 0 ? missing.join('/') : 'none';
}

function boundsForAllPositions(root: Uint8Array, ri: EarlyInfo, yTranslate: number): [number, number, number, number, number, number] {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < ri.posCount; i++) {
        const o = ri.posOff + i * 6;
        if (o + 6 > root.byteLength)
            continue;

        const x = s16(root, o + 0) * 8;
        const y = (s16(root, o + 2) - yTranslate) * 8;
        const z = s16(root, o + 4) * 8;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        minZ = Math.min(minZ, z);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        maxZ = Math.max(maxZ, z);
    }

    if (!Number.isFinite(minX))
        return [-8, -8, -8, 8, 8, 8];

    return [minX, minY, minZ, maxX, maxY, maxZ];
}

function boundsFromEarlyDLInfo(
    root: Uint8Array,
    infoOff: number,
    yTranslate: number,
    fallback: [number, number, number, number, number, number],
): [number, number, number, number, number, number] {
    if (infoOff + 0x12 > root.byteLength)
        return fallback;

    const x0 = s16(root, infoOff + 0x06);
    const y0 = s16(root, infoOff + 0x08);
    const z0 = s16(root, infoOff + 0x0A);
    const x1 = s16(root, infoOff + 0x0C);
    const y1 = s16(root, infoOff + 0x0E);
    const z1 = s16(root, infoOff + 0x10);

    if (x0 === 0 && y0 === 0 && z0 === 0 && x1 === 0 && y1 === 0 && z1 === 0)
        return fallback;

    const ax = x0 * 8;
    const ay = (y0 - yTranslate) * 8;
    const az = z0 * 8;
    const bx = x1 * 8;
    const by = (y1 - yTranslate) * 8;
    const bz = z1 * 8;

    const pad = 0x20;

    return [
        Math.min(ax, bx) - pad,
        Math.min(ay, by) - pad,
        Math.min(az, bz) - pad,
        Math.max(ax, bx) + pad,
        Math.max(ay, by) + pad,
        Math.max(az, bz) + pad,
    ];
}

const FINAL_SHADER_CULL_BACKFACE = 0x00000008;
const FINAL_SHADER_REFLECT_SKY   = 0x00000020;
const FINAL_SHADER_ALPHA_COMPARE = 0x00000400;
const FINAL_SHADER_SHORT_FUR     = 0x00004000;
const FINAL_SHADER_MEDIUM_FUR    = 0x00008000;
const FINAL_SHADER_WATER         = 0x80000000;
const FINAL_SHADER_TRUE_TRANS    = 0x40000000;
const FINAL_SHADER_WATER_EXTRA   = 0x00580000;
const FINAL_SHADER_TRANSLUCENT   = 0x60000000; // 0x40000000 | 0x20000000 true-trans bits

const EARLY1_STRONG_WATER_TEXIDS = new Set<number>([
    788,
    899,
    2871,
    1392, 24, 1391,
    2373,
]);

const EARLY1_CANDIDATE_WATER_TEXIDS = new Set<number>([
    899,
    2871,
    2373,
    788,
]);

const EARLY1_LAYER2_WATER_PROMOTE_TEXIDS = new Set<number>([
    788,
    899,
    2871,
    2373,
    2638,
    2640,
]);

const EARLY1_STRONG_TRANSLUCENT_TEXIDS = new Set<number>([
    998,
    1005,
    1007,
    668,
    157,
    177,

]);

const EARLY1_CANDIDATE_TRANSLUCENT_TEXIDS = new Set<number>([
    7,
    1156,
    668,
    157,
    177,

]);

const EARLY1_KNOWN_CUTOUT_TEXIDS = new Set<number>([
    1692, 1135, 1695, 1131, 176, 783, 785, 549,
    177, 526, 525, 982, 536, 1294, 1295, 418, 88, 571,
    44, 668, 417, 2090, 568, 567, 638, 810, 2094, 691,
    944, 7, 769, 767, 1156, 996, 811, 2056, 189,
    630, 646, 672, 1094, 1098, 1103, 1107, 1110, 1111, 1112,
]);



function texIdInSet(set: Set<number>, ...ids: Array<number | null>): boolean {
    for (const id of ids) {
        if (id !== null && set.has(id))
            return true;
    }

    return false;
}

type NormalizedLayerTex = {
    slot: number | null;
    rawId: number | null;
    mappedId: number | null;
};

function normalizeEarly1LayerTex(field: number, srcTex: number[], mappedTex: number[]): NormalizedLayerTex {
    if (field === 0xFFFFFFFF)
        return { slot: null, rawId: null, mappedId: null };
    if (field >= 0 && field < srcTex.length) {
        return {
            slot: field,
            rawId: srcTex[field] ?? null,
            mappedId: mappedTex[field] ?? null,
        };
    }
    const rawSlot = srcTex.indexOf(field);
    if (rawSlot >= 0) {
        return {
            slot: rawSlot,
            rawId: srcTex[rawSlot] ?? null,
            mappedId: mappedTex[rawSlot] ?? null,
        };
    }
    const mappedSlot = mappedTex.indexOf(field);
    if (mappedSlot >= 0) {
        return {
            slot: mappedSlot,
            rawId: srcTex[mappedSlot] ?? null,
            mappedId: mappedTex[mappedSlot] ?? null,
        };
    }

    return { slot: null, rawId: null, mappedId: null };
}

function early1LayerTexIdFromField(field: number, srcTex: number[]): number | null {
    if (field === 0xFFFFFFFF)
        return null;
    if (field >= 0 && field < srcTex.length)
        return srcTex[field] ?? null;

    return null;
}

function convertEarly1ShaderFlagsToFinal(
    raw16: number,
    tex0Raw: number | null,
    tex1Raw: number | null,
    tex0Mapped: number | null,
    tex1Mapped: number | null,
    tev0: number,
    tev1: number,
    numLayers: number,
): number {
    let flags = 0;

    const rawAlphaCompare =
        (raw16 & 0x0040) !== 0 ||
        (raw16 & 0x0100) !== 0;

    if (raw16 & 0x0004) flags |= 0x00000004;
    if (raw16 & 0x0008) flags |= FINAL_SHADER_CULL_BACKFACE;
        if (raw16 & 0x0020) flags |= FINAL_SHADER_REFLECT_SKY;
    if (rawAlphaCompare) flags |= FINAL_SHADER_ALPHA_COMPARE;
    if (raw16 & 0x4000) flags |= FINAL_SHADER_SHORT_FUR;
    if (raw16 & 0x8000) flags |= FINAL_SHADER_MEDIUM_FUR;
    if (raw16 & 0x0800) flags |= 0x0800;
    if (raw16 & 0x1000) flags |= 0x1000;

    const lowNib = raw16 & 0x0F;
    const tm0 = tev0 & 0x7F;
    const tm1 = tev1 & 0x7F;

    const singleLayer = numLayers <= 1 || tex1Raw === null;
    const hasTex0 = tex0Raw !== null || tex0Mapped !== null;
    const waterByStrongTex =
        texIdInSet(EARLY1_STRONG_WATER_TEXIDS, tex0Raw, tex1Raw, tex0Mapped, tex1Mapped);

    const waterByCandidateTex =
        singleLayer &&
        hasTex0 &&
        (lowNib === 0x0C || lowNib === 0x0D) &&
        texIdInSet(EARLY1_CANDIDATE_WATER_TEXIDS, tex0Raw, tex0Mapped);

    if (waterByStrongTex || waterByCandidateTex) {
        flags |= FINAL_SHADER_WATER | FINAL_SHADER_TRUE_TRANS | FINAL_SHADER_WATER_EXTRA;
        flags &= ~FINAL_SHADER_ALPHA_COMPARE;
    }
    const effectByStrongTex =
        texIdInSet(EARLY1_STRONG_TRANSLUCENT_TEXIDS, tex0Raw, tex1Raw);

    const effectByCandidateTex =
        singleLayer &&
        hasTex0 &&
        (lowNib === 0x04 || lowNib === 0x0C || lowNib === 0x0E) &&
        texIdInSet(EARLY1_CANDIDATE_TRANSLUCENT_TEXIDS, tex0Raw);

    if (
        (flags & FINAL_SHADER_WATER) === 0 &&
        (effectByStrongTex || effectByCandidateTex)
    ) {
        flags |= FINAL_SHADER_TRANSLUCENT;
        flags &= ~FINAL_SHADER_ALPHA_COMPARE;
    } else {
        const tevPlain = tm0 === 0x00 || tm0 === 0x01 || tm0 === 0x02;

        if (
            (flags & FINAL_SHADER_WATER) === 0 &&
            (flags & FINAL_SHADER_TRANSLUCENT) === 0 &&
            singleLayer &&
            hasTex0 &&
            tevPlain &&
            texIdInSet(EARLY1_KNOWN_CUTOUT_TEXIDS, tex0Raw)
        ) {
            flags |= FINAL_SHADER_ALPHA_COMPARE;
        }
    }

    return flags >>> 0;
}

function buildFinalShaderTableFromEarly1(
    root: Uint8Array,
    ri: EarlyInfo,
    shaderCount: number,
    texCount: number,
    srcTex: number[],
    mappedTex: number[],
): Uint8Array {

    const out = new Uint8Array(shaderCount * SHADER_STRIDE);
    const earlyShaderStride = 0x40;

    for (let i = 0; i < shaderCount; i++) {
        const src = ri.shaderOff + i * earlyShaderStride;
        const dst = i * SHADER_STRIDE;

        if (src + earlyShaderStride > root.byteLength) {
            p32(out, dst + 0x24, i % Math.max(1, texCount));
            p8(out, dst + 0x28, 0);
            p8(out, dst + 0x29, 0);
            p8(out, dst + 0x2A, 0);
            p32(out, dst + 0x3C, 0);
            p8(out, dst + 0x40, 0x04);
            p8(out, dst + 0x41, 1);
            p8(out, dst + 0x42, 0);
            p8(out, dst + 0x43, 0);
            continue;
        }

        out.set(root.subarray(src, src + earlyShaderStride), dst);

        const numLayers = Math.max(0, Math.min(2, u8(root, src + 0x3B)));
        const rawFlags = u16(root, src + 0x38);

        let attr = u8(root, src + 0x3A);

        const tex0Slot = u32(out, dst + 0x24);
        const tex1Slot = u32(out, dst + 0x2C);

        const tex0Info = numLayers > 0
            ? normalizeEarly1LayerTex(tex0Slot, srcTex, mappedTex)
            : { slot: null, rawId: null, mappedId: null };

        const tex1Info = numLayers > 1
            ? normalizeEarly1LayerTex(tex1Slot, srcTex, mappedTex)
            : { slot: null, rawId: null, mappedId: null };

        const tex0Raw = tex0Info.rawId;
        const tex1Raw = tex1Info.rawId;
        const tex0Mapped = tex0Info.mappedId;
        const tex1Mapped = tex1Info.mappedId;

        const tev0 = u8(root, src + 0x28);
        const tev1 = u8(root, src + 0x30);

        if (numLayers > 0 && tex0Slot !== 0xFFFFFFFF && tex0Slot < texCount)
            attr |= 0x04; // TEX0

        if (numLayers > 1 && tex1Slot !== 0xFFFFFFFF && tex1Slot < texCount)
            attr |= 0x08; // TEX1

        if ((attr & 0x0D) === 0)
            attr |= 0x01; // CLR fallback

const finalFlags = convertEarly1ShaderFlagsToFinal(
    rawFlags,
    tex0Raw,
    tex1Raw,
    tex0Mapped,
    tex1Mapped,
    tev0,
    tev1,
    numLayers,
);


p32(out, dst + 0x34, 0xFFFFFFFF);
p32(out, dst + 0x38, 0xFFFFFFFF);

p32(out, dst + 0x3C, finalFlags);
if (
    (finalFlags & FINAL_SHADER_TRANSLUCENT) !== 0 &&
    (finalFlags & FINAL_SHADER_WATER) === 0
) {

    p8(out, dst + 0x28, tev0 & 0x7F);
    p8(out, dst + 0x30, tev1 & 0x7F);
}

if ((finalFlags & (FINAL_SHADER_WATER | FINAL_SHADER_TRANSLUCENT | FINAL_SHADER_ALPHA_COMPARE)) !== 0) {
    console.warn(
        `[EARLY1 SHADER CONVERT] shader=${i}` +
        ` raw16=0x${rawFlags.toString(16)}` +
        ` lowNib=0x${(rawFlags & 0x0F).toString(16)}` +
        ` layers=${numLayers}` +
        ` tex0Slot=${tex0Slot}` +
        ` tex1Slot=${tex1Slot}` +
        ` tex0Raw=${tex0Raw}` +
        ` tex1Raw=${tex1Raw}` +
        ` tev0=0x${tev0.toString(16)}` +
        ` tev1=0x${tev1.toString(16)}` +
        ` finalFlags=0x${finalFlags.toString(16)}`,
    );
}

p8(out, dst + 0x40, attr);
        p8(out, dst + 0x41, numLayers);
        p8(out, dst + 0x42, 0);
        p8(out, dst + 0x43, 0);
    }

    return out;
}

function buildFinalShaderTableFromEarly4(
    root: Uint8Array,
    ri: EarlyInfo,
    shaderCount: number,
    texCount: number,
    srcTex: number[],
    mappedTex: number[],
): Uint8Array {
    const out = new Uint8Array(shaderCount * SHADER_STRIDE);
    const earlyShaderStride = SHADER_STRIDE;

    for (let i = 0; i < shaderCount; i++) {
        const src = ri.shaderOff + i * earlyShaderStride;
        const dst = i * SHADER_STRIDE;

        if (src + earlyShaderStride <= root.byteLength) {
            out.set(root.subarray(src, src + earlyShaderStride), dst);
        } else {
            p32(out, dst + 0x24, i % Math.max(1, texCount));
            p32(out, dst + 0x2C, 0xFFFFFFFF);
            p32(out, dst + 0x34, 0xFFFFFFFF);
            p32(out, dst + 0x38, 0xFFFFFFFF);
            p32(out, dst + 0x3C, FINAL_SHADER_CULL_BACKFACE);
            p8(out, dst + 0x40, 0x04);
            p8(out, dst + 0x41, 1);
            p8(out, dst + 0x42, 0);
            p8(out, dst + 0x43, 0);
        }

        let attr = u8(out, dst + 0x40);
        const numLayersIn = Math.max(0, Math.min(2, u8(out, dst + 0x41)));
        let numLayersOut = 0;

        for (let layer = 0; layer < 2; layer++) {
            const layerOff = dst + 0x24 + layer * 8;
            const rawField = u32(out, layerOff + 0x00);

            const texInfo = normalizeEarly1LayerTex(rawField, srcTex, mappedTex);
            const slot = texInfo.slot;

            if (layer < numLayersIn && slot !== null && slot >= 0 && slot < texCount) {
                p32(out, layerOff + 0x00, slot);
                numLayersOut = layer + 1;
                attr |= layer === 0 ? 0x04 : 0x08;
            } else {
                p32(out, layerOff + 0x00, 0xFFFFFFFF);
                p8(out, layerOff + 0x04, 0);
                p8(out, layerOff + 0x05, 0);
                p8(out, layerOff + 0x06, 0);
                p8(out, layerOff + 0x07, 0);
            }
        }

        if (numLayersOut === 0 && texCount > 0) {
            p32(out, dst + 0x24, i % texCount);
            p8(out, dst + 0x28, 0);
            p8(out, dst + 0x29, 0);
            p8(out, dst + 0x2A, 0);
            p8(out, dst + 0x2B, 0);

            numLayersOut = 1;
            attr |= 0x04;
        }
        p32(out, dst + 0x34, 0xFFFFFFFF);
        p32(out, dst + 0x38, 0xFFFFFFFF);

        if ((attr & 0x0D) === 0)
            attr |= 0x01;

        p8(out, dst + 0x40, attr);
        p8(out, dst + 0x41, numLayersOut);
        p8(out, dst + 0x42, 0);
        p8(out, dst + 0x43, 0);
    }

    return out;
}

function patchEarly4BackfaceCullForDebug(shaderTable: Uint8Array, shaderCount: number): string {
    const touched: string[] = [];

    for (let shader = 0; shader < shaderCount; shader++) {
        const off = shader * SHADER_STRIDE;
        if (off + SHADER_STRIDE > shaderTable.byteLength)
            continue;

        const before = u32(shaderTable, off + 0x3C);
        const after = (before & ~FINAL_SHADER_CULL_BACKFACE) >>> 0;

        if (before !== after) {
            p32(shaderTable, off + 0x3C, after);

            touched.push(
                `sh${shader}` +
                `/flags=0x${before.toString(16)}->0x${after.toString(16)}` +
                `/attr=0x${u8(shaderTable, off + 0x40).toString(16)}` +
                `/layers=${u8(shaderTable, off + 0x41)}` +
                `/tex0=${u32(shaderTable, off + 0x24)}` +
                `/tex1=${u32(shaderTable, off + 0x2C)}`,
            );
        }
    }

    return touched.length > 0
        ? `early4CullDebug=clearedBackfaceCull[${touched.join(',')}]`
        : `early4CullDebug=noBackfaceCullBits`;
}

function patchLayer2WaterFlagsInShaderTable(
    shaderTable: Uint8Array,
    root: Uint8Array,
    ri: EarlyInfo,
    shaderForDL: number[],
    layerForDL: number[],
    srcTex: number[],
    mappedTex: number[],
): string {
    const earlyShaderStride = 0x40;
    const touched: string[] = [];

    for (let dl = 0; dl < shaderForDL.length; dl++) {
        if (layerForDL[dl] !== 2)
            continue;

        const shader = shaderForDL[dl];
        if (shader < 0)
            continue;

        const src = ri.shaderOff + shader * earlyShaderStride;
        const dst = shader * SHADER_STRIDE;

        if (src + earlyShaderStride > root.byteLength)
            continue;
        if (dst + SHADER_STRIDE > shaderTable.byteLength)
            continue;

        const rawFlags = u16(root, src + 0x38);
        const lowNib = rawFlags & 0x0F;
        const tev0 = u8(root, src + 0x28);
        const numLayers = Math.max(0, Math.min(2, u8(root, src + 0x3B)));

        const tex0Slot = u32(shaderTable, dst + 0x24);
        const tex0Info = numLayers > 0
            ? normalizeEarly1LayerTex(tex0Slot, srcTex, mappedTex)
            : { slot: null, rawId: null, mappedId: null };

        const alreadyWater = (u32(shaderTable, dst + 0x3C) & FINAL_SHADER_WATER) !== 0;

        const layer2Water =
            alreadyWater ||
            (
                numLayers > 0 &&
                (tev0 & 0x80) !== 0 &&
                (lowNib === 0x0C || lowNib === 0x0D) &&
                texIdInSet(EARLY1_LAYER2_WATER_PROMOTE_TEXIDS, tex0Info.rawId, tex0Info.mappedId)
            );

        if (!layer2Water)
            continue;

        let flags = u32(shaderTable, dst + 0x3C);
        flags |= FINAL_SHADER_WATER | FINAL_SHADER_TRUE_TRANS | FINAL_SHADER_WATER_EXTRA;
        flags &= ~FINAL_SHADER_ALPHA_COMPARE;

        p32(shaderTable, dst + 0x3C, flags >>> 0);
        p8(shaderTable, dst + 0x40, u8(shaderTable, dst + 0x40) | 0x04);

        if (u8(shaderTable, dst + 0x41) === 0)
            p8(shaderTable, dst + 0x41, 1);

        touched.push(
            `dl${dl}/shader${shader}` +
            `/raw16=0x${rawFlags.toString(16)}` +
            `/texRaw=${tex0Info.rawId}` +
            `/texMapped=${tex0Info.mappedId}` +
            `/flags=0x${(flags >>> 0).toString(16)}`,
        );
    }

    return touched.length > 0
        ? `layer2WaterFlags=[${touched.join(',')}]`
        : `layer2WaterFlags=none`;
}

function remapEarly1Texture(texId: number, modelId: number, finalTexIds?: Set<number>): number {
    if (texId === 2640)
        return finalTexIds?.has(788) ? 788 : 2640;
    if (texId === 2727 && finalTexIds?.has(2373))
        return 2373;

    const mapped = debugResolveEarly1TextureId(texId, modelId);
    return mapped !== null ? mapped : texId;
}

function remapEarly4Texture(texId: number, modelId: number): number {
    const mapped = debugResolveEarly4TextureId(texId, modelId);
    return mapped !== null ? mapped : texId;
}

type ShaderTextureSlotInfo = {
    slots: number[];
    rawSlots: number[];
    valid: number;
    source: string;
};

function readEarlyShaderTextureSlots(root: Uint8Array, ri: EarlyInfo, shaderCount: number, texCount: number, srcTex: number[]): ShaderTextureSlotInfo {
    const fallbackSlots = Array.from({ length: shaderCount }, (_, shader) =>
        shader % Math.max(1, texCount),
    );

    const fallbackRaw = fallbackSlots.slice();

    const fallback: ShaderTextureSlotInfo = {
        slots: fallbackSlots,
        rawSlots: fallbackRaw,
        valid: 0,
        source: 'fallback_shader_mod_texCount',
    };

    if (ri.shaderOff <= 0 || ri.shaderOff >= root.byteLength || shaderCount <= 0 || texCount <= 0)
        return fallback;

    const texIdToSlot = new Map<number, number>();
    for (let i = 0; i < Math.min(srcTex.length, texCount); i++) {
        if (!texIdToSlot.has(srcTex[i]))
            texIdToSlot.set(srcTex[i], i);
    }

    const minDistinctNeeded = texCount > 1 && shaderCount > 1 ? 2 : 1;

    let best: ShaderTextureSlotInfo & { score: number } = {
        ...fallback,
        score: 0,
    };

    const consider = (
        source: string,
        slots: number[],
        rawSlots: number[],
        valid: number,
        scoreBonus: number,
    ): void => {
        if (valid <= 0)
            return;

        const counts = new Map<number, number>();

        for (let i = 0; i < shaderCount; i++) {
            if (rawSlots[i] < 0)
                continue;

            const slot = slots[i];
            if (slot < 0 || slot >= texCount)
                continue;

            counts.set(slot, (counts.get(slot) ?? 0) + 1);
        }

        const distinct = counts.size;
        const maxDup = counts.size > 0 ? Math.max(...counts.values()) : shaderCount;
        if (distinct < minDistinctNeeded)
            return;

        const invalid = shaderCount - valid;
        const score =
            scoreBonus +
            valid * 1000 +
            distinct * 250 -
            invalid * 100 -
            maxDup * 8;

        if (score > best.score) {
            best = {
                slots: slots.slice(),
                rawSlots: rawSlots.slice(),
                valid,
                source,
                score,
            };
        }
    };

    const strides = [SHADER_STRIDE, 0x40, 0x38, 0x34, 0x48, 0x4C, 0x30];

    for (const stride of strides) {
        const scanLen = Math.min(stride, 0x60);

        for (const size of [2, 4] as const) {
            for (let fieldOff = 0; fieldOff + size <= scanLen; fieldOff += size === 2 ? 2 : 4) {
                const slots = fallbackSlots.slice();
                const rawSlots = new Array<number>(shaderCount).fill(-1);
                let valid = 0;

                for (let shader = 0; shader < shaderCount; shader++) {
                    const o = ri.shaderOff + shader * stride + fieldOff;

                    if (o + size > root.byteLength)
                        continue;

                    const raw = size === 2 ? u16(root, o) : u32(root, o);
                    const slot = texIdToSlot.get(raw);

                    if (slot === undefined)
                        continue;

                    slots[shader] = slot;
                    rawSlots[shader] = raw;
                    valid++;
                }

                consider(
                    `texIdScan stride=0x${stride.toString(16)} ${size === 2 ? 'u16' : 'u32'}@0x${fieldOff.toString(16)}`,
                    slots,
                    rawSlots,
                    valid,
                    10000,
                );
            }
        }
    }

    const slotModes = [
        { name: 'u32@0x24', off: 0x24, size: 4, read: (o: number) => u32(root, o) },
        { name: 'u16@0x24', off: 0x24, size: 2, read: (o: number) => u16(root, o) },
        { name: 'u16@0x26', off: 0x26, size: 2, read: (o: number) => u16(root, o) },
        { name: 'u8@0x24', off: 0x24, size: 1, read: (o: number) => u8(root, o) },
        { name: 'u8@0x25', off: 0x25, size: 1, read: (o: number) => u8(root, o) },
        { name: 'u8@0x26', off: 0x26, size: 1, read: (o: number) => u8(root, o) },
        { name: 'u8@0x27', off: 0x27, size: 1, read: (o: number) => u8(root, o) },
    ];

    for (const mode of slotModes) {
        const slots = fallbackSlots.slice();
        const rawSlots = new Array<number>(shaderCount).fill(-1);
        let valid = 0;

        for (let shader = 0; shader < shaderCount; shader++) {
            const o = ri.shaderOff + shader * SHADER_STRIDE + mode.off;

            if (o + mode.size > root.byteLength)
                continue;

            const raw = mode.read(o);
            rawSlots[shader] = raw;

            if (raw >= 0 && raw < texCount) {
                slots[shader] = raw;
                valid++;
            }
        }
        if (valid === shaderCount) {
            consider(
                `slotScan ${mode.name}`,
                slots,
                rawSlots,
                valid,
                100,
            );
        }
    }

    return {
        slots: best.slots,
        rawSlots: best.rawSlots,
        valid: best.valid,
        source: best.source,
    };
}

function rebuildResourceAppend(root: Uint8Array, final: Uint8Array, opts: Required<Pick<Early1FinalMapConvertOptions, 'modelId' | 'outBaseName' | 'earlyMapFormat' | 'groupMode' | 'colorMode' | 'textureMode' | 'flatTextureId' | 'flatTexS' | 'flatTexT' | 'maxTrisPerDL'>>): { raw: Uint8Array; log: string } {
    const sourceInfo = earlyMapSourceInfo(opts.earlyMapFormat);
    const ri = earlyInfo(root);
const srcTex = earlyTextures(root);
const finalTexIdSet = new Set(finalTextures(final));
const mappedFromEarly =
    sourceInfo.textureRemapMode === 'early1'
        ? srcTex.map((t) => remapEarly1Texture(t, opts.modelId, finalTexIdSet))
        : sourceInfo.textureRemapMode === 'early4'
            ? srcTex.map((t) => remapEarly4Texture(t, opts.modelId))
            : srcTex.slice();
    const textureless = isTexturelessMode(opts.textureMode);

    let mapped = textureless
        ? [opts.flatTextureId]
        : mappedFromEarly.slice();

    if (mapped.length === 0)
        mapped = [opts.flatTextureId];

    const texCount = Math.max(1, Math.min(255, mapped.length));
    mapped = mapped.slice(0, texCount);

        const earlyDLInfoStride = sourceInfo.dlInfoStride;
    const earlyDLCount = Math.min(
        ri.dlInfoCount,
        Math.max(0, ((root.byteLength - ri.dlInfoOff) / earlyDLInfoStride) | 0),
        255,
    );

    const earlyShaderCount = Math.max(1, Math.min(64, ri.shaderCount || 1));
    const shaderCount = textureless ? 1 : earlyShaderCount;

const decoded = decodeEarlyShaderForDLs(root, earlyDLCount, earlyShaderCount, sourceInfo);
const infoShaderForDL: number[] = [];
for (let i = 0; i < earlyDLCount; i++) {
    const infoOff = ri.dlInfoOff + i * earlyDLInfoStride;
    const infoShader = u16(root, infoOff + 0x12);
    infoShaderForDL[i] = infoShader < earlyShaderCount ? infoShader : -1;
}

const distinctInfoShaders = new Set(infoShaderForDL.filter((v) => v >= 0));
const canUseInfoShader = distinctInfoShaders.size > 1;

const layer1EarlyDLSet = new Set<number>(
    decodeEarlyLayerCallOrder(
        root,
        u32(root, sourceInfo.bitsOffsets[1]),
        u16(root, sourceInfo.bitsByteCounts[1]),
        earlyDLCount,
        earlyShaderCount,
    ),
);

const layer2EarlyDLSet = new Set<number>(
    decodeEarlyLayerCallOrder(
        root,
        u32(root, sourceInfo.bitsOffsets[2]),
        u16(root, sourceInfo.bitsByteCounts[2]),
        earlyDLCount,
        earlyShaderCount,
    ),
);

const specialEarlyDLSet = new Set<number>([
    ...layer1EarlyDLSet,
    ...layer2EarlyDLSet,
]);

const copiedDLs: Uint8Array[] = [];
    const shaderFor: number[] = [];
    const vcdFor: number[] = [];
    const vcdReadFor: number[] = [];
    const vcdDecodedFor: number[] = [];
    const earlyDLIndexes: number[] = [];
    const early4DLDiag: string[] = [];
    const early4RepackDiag: string[] = [];
    const early4SortLayerDiag: string[] = [];
    for (let i = 0; i < earlyDLCount; i++) {
        const infoOff = ri.dlInfoOff + i * earlyDLInfoStride;
        const dlOff = u32(root, infoOff + 0x00);
        const dlSize = u16(root, infoOff + 0x04);

        if (dlOff === 0 || dlSize === 0)
            continue;

        if (dlOff + dlSize > root.byteLength)
            continue;

        const rawDL = root.subarray(dlOff, dlOff + dlSize);
        const decodedVcdBits = decoded.vcdBitsForDL[i] ?? 0x05;

        let readVcdBits = specialEarlyDLSet.has(i)
            ? chooseRetagVcdBits(rawDL, decodedVcdBits)
            : decodedVcdBits;

        if (sourceInfo.forceColorIndex16 && !specialEarlyDLSet.has(i))
            readVcdBits |= 0x02;

        let vcdBits = readVcdBits;
        let dl: Uint8Array;

        if (opts.earlyMapFormat === 'early4_lzo' && (readVcdBits & 0x02) !== 0) {
        
            const writeVcdBits = readVcdBits;
            const repacked = repackDisplayListToVat5(rawDL, readVcdBits, writeVcdBits, ri, true);

            dl = repacked.dl;
            vcdBits = readVcdBits;

            early4RepackDiag.push(
                `dl${i}` +
                `/read=${debugVcdName(readVcdBits)}` +
                `/write=${debugVcdName(vcdBits)}` +
                `/${repacked.log}`,
            );
        } else {
            dl = retagDisplayListToVat5(rawDL, vcdBits);
        }
const decodedShader = decoded.shaderForDL[i];
const infoShader = infoShaderForDL[i];

const earlyShader = canUseInfoShader && infoShader >= 0
    ? infoShader
    : decodedShader >= 0
        ? decodedShader
        : i;

copiedDLs.push(dl);
shaderFor.push(textureless ? 0 : (earlyShader % shaderCount));
vcdDecodedFor.push(decodedVcdBits);
vcdReadFor.push(readVcdBits);
vcdFor.push(vcdBits);
earlyDLIndexes.push(i);

if (opts.earlyMapFormat === 'early4_lzo') {
    const early4Layer =
        layer2EarlyDLSet.has(i) ? 'L2' :
        layer1EarlyDLSet.has(i) ? 'L1' :
        'L0';

    const decodedStats = debugScanEarly4DLForLog(rawDL, decodedVcdBits, ri);
    const usedStats = debugScanEarly4DLForLog(dl, vcdBits, ri);

    early4DLDiag.push(
        `dl${i}{` +
        `off=0x${dlOff.toString(16)}` +
        `/size=0x${dlSize.toString(16)}` +
        `/layer=${early4Layer}` +
        `/shader=${earlyShader}` +
        `/decoded=${debugVcdName(decodedVcdBits)}:${debugEarly4DLStatsForLog(decodedStats)}` +
        `/used=${debugVcdName(vcdBits)}:${debugEarly4DLStatsForLog(usedStats)}` +
        `}`,
    );
}
    }

    if (copiedDLs.length === 0)
        throw new Error(`no Early1 visual DLs found`);

    if (copiedDLs.length > 255)
        throw new Error(`too many copied Early1 DLs: ${copiedDLs.length}`);

    let out = copyU8(final);
    const start = align(out.byteLength, 0x20);
    out = growTo(out, start);

    const dlinfoOff = start;
    let cursor = align(dlinfoOff + copiedDLs.length * FINAL_DLINFO_SIZE, 0x20);

    const dlOffsets: number[] = [];
    const dlSizes: number[] = [];

    for (const dl of copiedDLs) {
        const dlOff = cursor;
        const dlSizeAligned = align(dl.byteLength, 0x20);

        dlOffsets.push(dlOff);
        dlSizes.push(dlSizeAligned);

        out = setBytes(out, dlOff, dl);
        cursor += dlSizeAligned;
    }

    const compactEarly4Palette = opts.earlyMapFormat === 'early4_lzo';

    const colorData = compactEarly4Palette
        ? colors(root, ri)
        : colorsForFinalMapOutput(root, ri, sourceInfo);

    const outClrCount = compactEarly4Palette
        ? ri.clrCount
        : sourceInfo.expandColorPalette16 ? 0xFFFF : ri.clrCount;

    const posOff = align(cursor, 0x20);
    const clrOff = align(posOff + ri.posCount * 6, 0x20);
    const texcoordOff = align(clrOff + colorData.byteLength, 0x20);
    const texOff = align(texcoordOff + ri.texcoordCount * 4, 0x20);
    const shaderOff = align(texOff + texCount * 4, 0x20);
    const bitsOff = align(shaderOff + shaderCount * SHADER_STRIDE, 0x20);

    const layerBits = buildLayerBitstreamsFromEarlyPasses(root, ri, shaderFor, vcdFor, earlyDLIndexes, sourceInfo);    const bitstream0 = layerBits.bitstreams[0];
    const bitstream1 = layerBits.bitstreams[1];
    const bitstream2 = layerBits.bitstreams[2];

    const bitsOff0 = bitstream0.byteLength > 0 ? bitsOff : 0;
    const bitsOff1 = bitstream1.byteLength > 0 ? bitsOff + bitstream0.byteLength : 0;
    const bitsOff2 = bitstream2.byteLength > 0 ? bitsOff + bitstream0.byteLength + bitstream1.byteLength : 0;

    const totalBitsLen = bitstream0.byteLength + bitstream1.byteLength + bitstream2.byteLength;
    const end = align(bitsOff + totalBitsLen, 0x20);
    out = growTo(out, end);

    const yTranslate = computeY(root, ri);

    out = setBytes(out, posOff, convertedPositions(root, ri, yTranslate));
    out = setBytes(out, clrOff, colorData);
    out = setBytes(out, texcoordOff, texcoords(root, ri));

    for (let i = 0; i < texCount; i++)
        p32(out, texOff + i * 4, mapped[i]);

    const shaderTable = textureless
        ? buildShaderTable(final, finalInfo(final), shaderCount, texCount)
        : sourceInfo.shaderMode === 'early4_final'
            ? buildFinalShaderTableFromEarly4(root, ri, shaderCount, texCount, srcTex, mapped)
            : buildFinalShaderTableFromEarly1(root, ri, shaderCount, texCount, srcTex, mapped);

const early4CullDebugLog = !textureless && sourceInfo.shaderMode === 'early4_final'
    ? 'early4CullDebug=disabled_keepOriginalCull'
    : 'early4CullDebug=notEarly4';

    const layer2WaterLog = textureless
        ? 'layer2WaterFlags=textureless'
        : sourceInfo.shaderMode === 'early4_final'
            ? 'layer2WaterFlags=early4_final_shader_flags'
            : patchLayer2WaterFlagsInShaderTable(
                shaderTable,
                root,
                ri,
                shaderFor,
                layerBits.layerForDL,
                srcTex,
                mapped,
            );

    out = setBytes(out, shaderOff, shaderTable);

    let bitsCursor = bitsOff;
    if (bitstream0.byteLength > 0) {
        out = setBytes(out, bitsCursor, bitstream0);
        bitsCursor += bitstream0.byteLength;
    }
    if (bitstream1.byteLength > 0) {
        out = setBytes(out, bitsCursor, bitstream1);
        bitsCursor += bitstream1.byteLength;
    }
    if (bitstream2.byteLength > 0) {
        out = setBytes(out, bitsCursor, bitstream2);
        bitsCursor += bitstream2.byteLength;
    }

    const finalFlagsForCopiedDL = shaderFor.map((shader) =>
        u32(shaderTable, shader * SHADER_STRIDE + 0x3C),
    );

    const broadBounds = boundsForAllPositions(root, ri, yTranslate);

    for (let i = 0; i < copiedDLs.length; i++) {
        const ro = dlinfoOff + i * FINAL_DLINFO_SIZE;
        const oldInfoOff = ri.dlInfoOff + earlyDLIndexes[i] * earlyDLInfoStride;

        p32(out, ro + 0x00, dlOffsets[i]);
        p16(out, ro + 0x04, dlSizes[i]);

        const dlBounds = opts.earlyMapFormat === 'early4_lzo'
            ? broadBounds
            : boundsFromEarlyDLInfo(root, oldInfoOff, yTranslate, broadBounds);
        ps16(out, ro + 0x06, dlBounds[0]);
        ps16(out, ro + 0x08, dlBounds[1]);
        ps16(out, ro + 0x0A, dlBounds[2]);
        ps16(out, ro + 0x0C, dlBounds[3]);
        ps16(out, ro + 0x0E, dlBounds[4]);
        ps16(out, ro + 0x10, dlBounds[5]);

        p16(out, ro + 0x12, shaderFor[i]);
        p16(out, ro + 0x14, layerBits.special[i] ?? 0);
        const oldLayer = u8(root, oldInfoOff + 0x18);
        const shaderFlags = finalFlagsForCopiedDL[i] ?? 0;
        const fallbackLayer =
            layerBits.layerForDL[i] === 2 || (shaderFlags & FINAL_SHADER_WATER) !== 0
                ? 11
                : 7;

        const finalSortLayer = opts.earlyMapFormat === 'early4_lzo'
            ? fallbackLayer
            : (oldLayer || fallbackLayer);

        if (opts.earlyMapFormat === 'early4_lzo') {
            early4SortLayerDiag.push(
                `dl${i}` +
                `/early=0x${oldLayer.toString(16)}` +
                `/final=${finalSortLayer}` +
                `/pass=${layerBits.layerForDL[i]}` +
                `/flags=0x${shaderFlags.toString(16)}`,
            );
        }

        p8(out, ro + 0x18, finalSortLayer);
        p8(out, ro + 0x19, 0);
        p16(out, ro + 0x1A, 0);
    }

    p32(out, 0x08, out.byteLength);

    p32(out, 0x54, texOff);
    p32(out, 0x58, posOff);
    p32(out, 0x5C, clrOff);
    p32(out, 0x60, texcoordOff);
    p32(out, 0x64, shaderOff);
    p32(out, 0x68, dlinfoOff);

    p32(out, 0x78, bitsOff0);
    p32(out, 0x7C, bitsOff1);
    p32(out, 0x80, bitsOff2);

    p16(out, 0x84, bitstream0.byteLength);
    p16(out, 0x86, bitstream1.byteLength);
    p16(out, 0x88, bitstream2.byteLength);

    ps16(out, 0x8E, yTranslate);

    p16(out, 0x90, ri.posCount);
    p16(out, 0x94, outClrCount);
        p16(out, 0x96, ri.texcoordCount);

    p8(out, 0xA0, texCount);
    p8(out, 0xA1, copiedDLs.length);
    p8(out, 0xA2, shaderCount);

    const early4DiagLog = opts.earlyMapFormat === 'early4_lzo'
        ? (
            `; early4Header=` +
            `pos=0x${ri.posOff.toString(16)}/${ri.posCount}` +
            ` clr=0x${ri.clrOff.toString(16)}/${ri.clrCount}` +
            ` texcoord=0x${ri.texcoordOff.toString(16)}/${ri.texcoordCount}` +
            ` tex=0x${ri.texOff.toString(16)}/${ri.texCount}` +
            ` shader=0x${ri.shaderOff.toString(16)}/${ri.shaderCount}` +
            ` dlinfo=0x${ri.dlInfoOff.toString(16)}/${ri.dlInfoCount}` +
            ` bits0=0x${u32(root, sourceInfo.bitsOffsets[0]).toString(16)}/0x${u16(root, sourceInfo.bitsByteCounts[0]).toString(16)}` +
            ` bits1=0x${u32(root, sourceInfo.bitsOffsets[1]).toString(16)}/0x${u16(root, sourceInfo.bitsByteCounts[1]).toString(16)}` +
            ` bits2=0x${u32(root, sourceInfo.bitsOffsets[2]).toString(16)}/0x${u16(root, sourceInfo.bitsByteCounts[2]).toString(16)}` +
                        `; early4PaletteMode=` +
            `${compactEarly4Palette ? 'compactC16ToC8' : 'expandedC16'}` +
            `/colorBytes=0x${colorData.byteLength.toString(16)}` +
            `/outClrCount=${outClrCount}` +
            `; early4Repack=[${early4RepackDiag.length > 0 ? early4RepackDiag.join(' ; ') : 'none'}]` +
            `; early4DecodedLayerSets=` +
            `L1=[${debugNumberSetForLog(layer1EarlyDLSet)}]` +
            ` L2=[${debugNumberSetForLog(layer2EarlyDLSet)}]` +
            ` special=[${debugNumberSetForLog(specialEarlyDLSet)}]` +
            `; early4MissingGeneratedCalls=[${debugMissingLayerCallsForLog(copiedDLs.length, layerBits.layerCalls)}]` +
            `; early4DLInfoSort=[${early4SortLayerDiag.length > 0 ? early4SortLayerDiag.join(',') : 'none'}]` +
            `; early4DLDiag=[${early4DLDiag.join(' ; ')}]`
        )
        : '';

    return {
        raw: out,
log: `visual copy source=${opts.earlyMapFormat}; EarlyDLs=${copiedDLs.length}/${earlyDLCount}; shaders=${shaderCount}/${earlyShaderCount}; bounds=earlyDLInfo; vcdDecoded=[${vcdDecodedFor.map((v) => `0x${v.toString(16)}`).join(',')}]; vcdRead=[${vcdReadFor.map((v) => `0x${v.toString(16)}`).join(',')}]; vcdUsed=[${vcdFor.map((v) => `0x${v.toString(16)}`).join(',')}];shaderFor=[${shaderFor.join(',')}]; infoShaderForDL=[${infoShaderForDL.join(',')}]; useInfoShader=${canUseInfoShader}; textureMode=${opts.textureMode}; ${early4CullDebugLog}; ${layer2WaterLog}; layerCalls=[${layerBits.layerCalls.map((xs) => xs.join('/')).join('|')}]; bitsLen=[${bitstream0.byteLength},${bitstream1.byteLength},${bitstream2.byteLength}]; tris=${triangles(root).length}/${ri.triCount}; y=${yTranslate}; oldLen=0x${final.byteLength.toString(16)} newLen=0x${out.byteLength.toString(16)}; earlyTex=[${srcTex.join(',')}]; mappedFromEarly=[${mappedFromEarly.join(',')}]; usedTex=[${mapped.join(',')}]; decodedBitOff=0x${decoded.bitOff.toString(16)} decodedCalls=${decoded.calls}${early4DiagLog}`,        };
}

function patchCollisionTriWinding(tris: Uint8Array, mode: CollisionWinding): Uint8Array {
    if (mode === 'keep')
        return tris;
    const out = copyU8(tris);
    for (let o = 0; o + 8 <= out.byteLength; o += 8) {
        const v0 = u16(out, o + 0), v1 = u16(out, o + 2), v2 = u16(out, o + 4), fl = u16(out, o + 6);
        if (mode === 'swap12') { p16(out, o + 0, v0); p16(out, o + 2, v2); p16(out, o + 4, v1); }
        else if (mode === 'swap01') { p16(out, o + 0, v1); p16(out, o + 2, v0); p16(out, o + 4, v2); }
        else if (mode === 'swap02') { p16(out, o + 0, v2); p16(out, o + 2, v1); p16(out, o + 4, v0); }
        p16(out, o + 6, fl);
    }
    return out;
}

function transformBatchY(batch: Uint8Array, yTranslate: number, mode: CollisionYMode): Uint8Array {
    if (mode === 'none' || mode === 'raw')
        return batch;
    const out = copyU8(batch);
    for (let o = 0; o + 0x14 <= out.byteLength; o += 0x14) {
        const y0 = s16(out, o + 0x06);
        const y1 = s16(out, o + 0x08);
        let a = y0 - yTranslate;
        let b = y1 - yTranslate;
        if (mode === 'subtract_expand8') { a -= 8; b += 8; }
        else if (mode === 'subtract_expand32') { a -= 32; b += 32; }
        ps16(out, o + 0x06, a);
        ps16(out, o + 0x08, b);
    }
    return out;
}

function patchResourceCollision(base: Uint8Array, early: Uint8Array, yMode: CollisionYMode, winding: CollisionWinding): { raw: Uint8Array; log: string } {
    if (yMode === 'none')
        return { raw: base, log: 'collision disabled' };

    const ri = earlyInfo(early);
    const earlyBatchOff = ri.batchOff;
    const earlyTriOff = ri.triOff;
    const earlyTriCount = ri.triCount;
    const earlyBatchCount = ri.batchCountMinus1 + 1;
    const batchLen = earlyBatchCount * 0x14;
    const triLen = earlyTriCount * 8;

    if (earlyBatchOff + batchLen > early.byteLength || earlyTriOff + triLen > early.byteLength)
        throw new Error(`early collision OOB batch=0x${earlyBatchOff.toString(16)}+0x${batchLen.toString(16)} tri=0x${earlyTriOff.toString(16)}+0x${triLen.toString(16)} len=0x${early.byteLength.toString(16)}`);

    let out = copyU8(base);
    const yTranslate = s16(out, 0x8E);
    const earlyBatch = transformBatchY(early.slice(earlyBatchOff, earlyBatchOff + batchLen), yTranslate, yMode);
    const earlyTris = patchCollisionTriWinding(early.slice(earlyTriOff, earlyTriOff + triLen), winding);

    const appendOff = align(out.byteLength, 0x20);
    out = growTo(out, appendOff);
    const newBatchOff = appendOff;
    const newTriOff = newBatchOff + earlyBatch.byteLength;
    out = setBytes(out, newBatchOff, earlyBatch);
    out = setBytes(out, newTriOff, earlyTris);
    out = growTo(out, align(out.byteLength, 0x20));

    p32(out, 0x4C, newTriOff);
    p32(out, 0x50, newBatchOff);
    p16(out, 0x98, earlyTriCount);
    p16(out, 0x9A, ri.batchCountMinus1);
    p32(out, 0x08, out.byteLength);

    return {
        raw: out,
        log: `collision yMode=${yMode} yTranslate=${yTranslate} winding=${winding}; batch 0x${earlyBatchOff.toString(16)}->0x${newBatchOff.toString(16)} len=0x${batchLen.toString(16)}; tri 0x${earlyTriOff.toString(16)}->0x${newTriOff.toString(16)} count=${earlyTriCount}`,
    };
}

export async function convertEarly1ArchiveToFinalMapZlb(
    earlyBinIn: ArrayBuffer | Uint8Array,
    earlyTabIn: ArrayBuffer | Uint8Array,
    finalZlbBinIn: ArrayBuffer | Uint8Array,
    finalTabIn: ArrayBuffer | Uint8Array,
    options: Partial<Early1FinalMapConvertOptions> = {},
): Promise<Early1FinalMapConvertResult> {
    const opts: Early1FinalMapConvertOptions = {
        modelId: options.modelId ?? 0,
        outBaseName: options.outBaseName ?? 'mod',
        earlyMapFormat: options.earlyMapFormat ?? 'early1_raw',
        groupMode: options.groupMode ?? 'nibble0',
        colorMode: options.colorMode ?? 'pidx',
        textureMode: options.textureMode ?? 'mapped',
flatTextureId: options.flatTextureId ?? 1038,
flatTexS: options.flatTexS ?? 256,
flatTexT: options.flatTexT ?? 256,
collisionYMode: options.collisionYMode ?? 'subtract',
        collisionWinding: options.collisionWinding ?? 'keep',
        maxTrisPerDL: options.maxTrisPerDL ?? 128,

        objectsEnabled: options.objectsEnabled ?? true,
        objectMapId: options.objectMapId ?? options.modelId ?? 0,
        keepObjectTypes: options.keepObjectTypes ?? [0x000D, 0x004C],
        mapsBin: options.mapsBin,
        mapsTab: options.mapsTab,
    };

    const earlyBin = asU8(earlyBinIn);
    const earlyTab = asU8(earlyTabIn);
    const finalZlbBin = asU8(finalZlbBinIn);
    const finalTab = asU8(finalTabIn);

    const finalArc = await readZlbArchive(finalZlbBin, finalTab);
    const rootArc = readEarlyMapSourceArchive(earlyBin, earlyTab, opts.earlyMapFormat);
    const outDataParts: Uint8Array[] = [];
    const outTab = copyU8(finalArc.tab);
    const logs: string[] = [];
    const processed: number[] = [];
    let cursor = 0;

    for (const rid of finalArc.ids) {
        let raw = finalArc.blocks.get(rid)!;
        const early = rootArc.blocks.get(rid);

        if (early) {
            const vis = rebuildResourceAppend(early, raw,                
                 {
                    modelId: opts.modelId,
                    outBaseName: opts.outBaseName,
                    earlyMapFormat: opts.earlyMapFormat,
                    groupMode: opts.groupMode,
                colorMode: opts.colorMode,
                textureMode: opts.textureMode,
flatTextureId: opts.flatTextureId,
flatTexS: opts.flatTexS,
flatTexT: opts.flatTexT,
maxTrisPerDL: opts.maxTrisPerDL ?? 128,
            });
            raw = vis.raw;
            logs.push(`id ${rid}: ${vis.log}`);

            if (opts.collisionYMode !== 'none') {
                const col = patchResourceCollision(raw, early, opts.collisionYMode, opts.collisionWinding);
                raw = col.raw;
                logs.push(`id ${rid}: ${col.log}`);
            }

            processed.push(rid);
        } else {
            logs.push(`id ${rid}: no matching Early1 block, kept final`);
        }

        const z = await writeZlb(raw);
        p32(outTab, rid * 4, TAB_FLAG | cursor);
        outDataParts.push(z);
        cursor += z.byteLength;
    }

    const outData = new Uint8Array(cursor);
    let p = 0;
    for (const part of outDataParts) {
        outData.set(part, p);
        p += part.byteLength;
    }

    logs.push(`final_ids=[${finalArc.ids.join(',')}]`);
    logs.push(`early_format=${opts.earlyMapFormat}`);
    logs.push(`early_ids=[${rootArc.ids.join(',')}]`);
    logs.push(`processed=[${processed.join(',')}]`);
    logs.push(`output ${opts.outBaseName}.zlb.bin bytes=${outData.byteLength}, ${opts.outBaseName}.tab bytes=${outTab.byteLength}`);

    let patchedMapsBin: Uint8Array | undefined = undefined;
    let patchedMapsTab: Uint8Array | undefined = undefined;

    if (opts.objectsEnabled === false) {
        if (!opts.mapsBin || !opts.mapsTab)
            throw new Error('objects disabled, but SFA MAPS.bin / MAPS.tab were not provided');

        const patched = await patchSfaMapsObjectsForMap(
            opts.mapsBin,
            opts.mapsTab,
            opts.objectMapId ?? opts.modelId,
            opts.keepObjectTypes ?? [0x000D, 0x004C],
        );

        patchedMapsBin = patched.mapsBin;
        patchedMapsTab = patched.mapsTab;
        logs.push(patched.log);
    } else {
        logs.push('objects enabled: SFA MAPS.bin/MAPS.tab not modified');
    }

    return {
        zlbBin: outData,
        tab: outTab,
        logs,
        processedResourceIds: processed,
        mapsBin: patchedMapsBin,
        mapsTab: patchedMapsTab,
    };
}

export async function convertEarly4ArchiveToFinalMapZlb(
    earlyBinIn: ArrayBuffer | Uint8Array,
    earlyTabIn: ArrayBuffer | Uint8Array,
    finalZlbBinIn: ArrayBuffer | Uint8Array,
    finalTabIn: ArrayBuffer | Uint8Array,
    options: Partial<Early1FinalMapConvertOptions> = {},
): Promise<Early1FinalMapConvertResult> {
    return convertEarly1ArchiveToFinalMapZlb(
        earlyBinIn,
        earlyTabIn,
        finalZlbBinIn,
        finalTabIn,
        {
            ...options,
            earlyMapFormat: 'early4_lzo',
        },
    );
}

function downloadBytes(filename: string, data: Uint8Array): void {
    const blob = new Blob([toBlobBuffer(data)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function readFile(file: File | null): Promise<ArrayBuffer> {
    if (!file)
        throw new Error('missing file input');

    return file.arrayBuffer();
}

function readOptionalFile(file: File | null): Promise<ArrayBuffer | undefined> {
    if (!file)
        return Promise.resolve(undefined);

    return file.arrayBuffer();
}

function fileInput(label: string, accept: string): { wrap: HTMLElement; input: HTMLInputElement } {
    const wrap = document.createElement('label');
    wrap.style.display = 'grid';
    wrap.style.gap = '2px';
    wrap.style.fontSize = '11px';
    wrap.textContent = label;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.fontSize = '11px';
    wrap.appendChild(input);
    return { wrap, input };
}

function selectInput<T extends string>(label: string, values: T[], def: T): { wrap: HTMLElement; input: HTMLSelectElement } {
    const wrap = document.createElement('label');
    wrap.style.display = 'grid';
    wrap.style.gap = '2px';
    wrap.style.fontSize = '11px';
    wrap.textContent = label;
    const input = document.createElement('select');
    input.style.fontSize = '11px';
    for (const v of values) {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        input.appendChild(opt);
    }
    input.value = def;
    wrap.appendChild(input);
    return { wrap, input };
}

export function installEarly1FinalMapConverterPanel(parent: HTMLElement = document.body): HTMLElement | null {
    if (typeof document === 'undefined')
        return null;

    const existing = document.getElementById('early1-finalmap-converter-panel');
    if (existing)
        return existing;

    const panel = document.createElement('div');
    panel.id = 'early1-finalmap-converter-panel';
    panel.style.position = 'fixed';
    panel.style.right = '8px';
    panel.style.bottom = '8px';
    panel.style.zIndex = '999999';
    panel.style.pointerEvents = 'auto';
panel.style.userSelect = 'auto';
    panel.style.width = '300px';
    panel.style.maxHeight = '85vh';
    panel.style.overflow = 'auto';
    panel.style.background = 'rgba(0,0,0,0.88)';
    panel.style.color = 'white';
    panel.style.border = '1px solid rgba(255,255,255,0.25)';
    panel.style.borderRadius = '8px';
    panel.style.padding = '8px';
    panel.style.fontFamily = 'monospace';
    panel.style.fontSize = '12px';
    panel.style.boxShadow = '0 4px 24px rgba(0,0,0,0.55)';

    const title = document.createElement('div');
    title.textContent = 'Early1/Early4 -> Final ZLB';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '6px';
    panel.appendChild(title);

    const earlyBin = fileInput('Early source root_modXX.bin', '.bin');
    const earlyTab = fileInput('Early source root_modXX.tab', '.tab');
    const finalBin = fileInput('Final modXX.zlb.bin', '.bin');
    const finalTab = fileInput('Final modXX.tab', '.tab');
    const mapsBin = fileInput('SFA MAPS.bin optional', '.bin');
    const mapsTab = fileInput('SFA MAPS.tab optional', '.tab');

    panel.appendChild(earlyBin.wrap);
    panel.appendChild(earlyTab.wrap);
    panel.appendChild(finalBin.wrap);
    panel.appendChild(finalTab.wrap);
    panel.appendChild(mapsBin.wrap);
    panel.appendChild(mapsTab.wrap);

    const earlyFormat = selectInput<EarlyMapFormat>('early source format', ['early1_raw', 'early4_lzo'], 'early1_raw');
    panel.appendChild(earlyFormat.wrap);

    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 1fr';
    row.style.gap = '4px';
    row.style.marginTop = '6px';

    const modelLabel = document.createElement('label');
    modelLabel.style.display = 'grid';
    modelLabel.style.gap = '2px';
    modelLabel.textContent = 'map/model ID hex/dec';
    const modelInput = document.createElement('input');
    modelInput.type = 'text';
    modelInput.value = '16';
    modelInput.style.fontSize = '11px';
    modelLabel.appendChild(modelInput);

    const nameLabel = document.createElement('label');
    nameLabel.style.display = 'grid';
    nameLabel.style.gap = '2px';
    nameLabel.textContent = 'output basename';
    const nameInput = document.createElement('input');
    nameInput.value = 'mod16';
    nameInput.style.fontSize = '11px';
    nameLabel.appendChild(nameInput);

    row.appendChild(modelLabel);
    row.appendChild(nameLabel);
    panel.appendChild(row);

       const group = selectInput<GroupMode>('visual grouping', ['single', 'nibble0', 'nibble1', 'nibble2', 'nibble3'], 'nibble0');
const color = selectInput<ColorMode>('color mode', ['pidx', 'zero', 'neutral_shade'], 'pidx');
    const texMode = selectInput<TextureMode>('texture mode', ['mapped', 'viewer_textureless', 'pseudo_textureless'], 'mapped');

    const flatTexLabel = document.createElement('label');
    flatTexLabel.style.display = 'grid';
    flatTexLabel.style.gap = '2px';
    flatTexLabel.style.fontSize = '11px';
    flatTexLabel.textContent = 'flat texture ID';
    const flatTexInput = document.createElement('input');
    flatTexInput.type = 'number';
    flatTexInput.value = '1038';
    flatTexInput.style.fontSize = '11px';
    flatTexLabel.appendChild(flatTexInput);
const flatUVRow = document.createElement('div');
flatUVRow.style.display = 'grid';
flatUVRow.style.gridTemplateColumns = '1fr 1fr';
flatUVRow.style.gap = '4px';

const flatSLabel = document.createElement('label');
flatSLabel.style.display = 'grid';
flatSLabel.style.gap = '2px';
flatSLabel.style.fontSize = '11px';
flatSLabel.textContent = 'flat S';
const flatSInput = document.createElement('input');
flatSInput.type = 'number';
flatSInput.value = '256';
flatSInput.style.fontSize = '11px';
flatSLabel.appendChild(flatSInput);

const flatTLabel = document.createElement('label');
flatTLabel.style.display = 'grid';
flatTLabel.style.gap = '2px';
flatTLabel.style.fontSize = '11px';
flatTLabel.textContent = 'flat T';
const flatTInput = document.createElement('input');
flatTInput.type = 'number';
flatTInput.value = '256';
flatTInput.style.fontSize = '11px';
flatTLabel.appendChild(flatTInput);

flatUVRow.appendChild(flatSLabel);
flatUVRow.appendChild(flatTLabel);
    const cy = selectInput<CollisionYMode>('collision Y', ['none', 'raw', 'subtract', 'subtract_expand8', 'subtract_expand32'], 'subtract');
    const cw = selectInput<CollisionWinding>('collision winding', ['keep', 'swap12', 'swap01', 'swap02'], 'keep');

    const objectMode = selectInput<'enabled' | 'disabled_keep_list'>(
        'SFA MAPS objects',
        ['enabled', 'disabled_keep_list'],
        'enabled',
    );

    const objectMapLabel = document.createElement('label');
    objectMapLabel.style.display = 'grid';
    objectMapLabel.style.gap = '2px';
    objectMapLabel.style.fontSize = '11px';
    objectMapLabel.textContent = 'SFA object map ID hex/dec';

    const objectMapInput = document.createElement('input');
    objectMapInput.type = 'text';
    objectMapInput.placeholder = 'blank = map/model ID';
    objectMapInput.style.fontSize = '11px';
    objectMapLabel.appendChild(objectMapInput);

    const keepObjLabel = document.createElement('label');
    keepObjLabel.style.display = 'grid';
    keepObjLabel.style.gap = '2px';
    keepObjLabel.style.fontSize = '11px';
keepObjLabel.textContent = 'keep these object types in-place hex';
    const keepObjInput = document.createElement('input');
keepObjInput.value = '';
keepObjInput.placeholder = 'extra keeps only, e.g. 0012,00AB';
    keepObjInput.style.fontSize = '11px';
    keepObjLabel.appendChild(keepObjInput);

    panel.appendChild(group.wrap);
    panel.appendChild(color.wrap);
    panel.appendChild(texMode.wrap);
    panel.appendChild(flatTexLabel);
    panel.appendChild(flatUVRow);
    panel.appendChild(cy.wrap);
    panel.appendChild(cw.wrap);
    panel.appendChild(objectMode.wrap);
    panel.appendChild(objectMapLabel);
    panel.appendChild(keepObjLabel);

    const convertButton = document.createElement('button');
    convertButton.textContent = 'Convert + download';
    convertButton.style.marginTop = '8px';
    convertButton.style.width = '100%';
    convertButton.style.padding = '6px';
    panel.appendChild(convertButton);

    const log = document.createElement('textarea');
    log.readOnly = true;
    log.style.marginTop = '6px';
    log.style.width = '100%';
    log.style.height = '120px';
    log.style.boxSizing = 'border-box';
    log.style.fontSize = '11px';
    log.style.background = 'rgba(255,255,255,0.08)';
    log.style.color = 'white';
    log.value = 'Preset: FULL_group_nibble0_PLUS_collision_subtract_keep\n';
    panel.appendChild(log);

    finalBin.input.addEventListener('change', () => {
        autoFillConverterFromFinalFile(
            finalBin.input.files?.[0] ?? null,
            modelInput,
            nameInput,
            objectMapInput,
            log,
        );
    });

    convertButton.onclick = async () => {
        try {
            convertButton.disabled = true;
            log.value = 'Reading files...\n';
const objectPatchDisabled = objectMode.input.value !== 'enabled';
const objectMapText = objectMapInput.value.trim();

if (objectPatchDisabled && objectMapText.length === 0) {
    throw new Error(
        'SFA MAPS objects are disabled, but no SFA object map ID was entered. ' +
        'Dragon Rock is 02. Do not leave this blank unless you really want it to use map/model ID.',
    );
}

const sfaObjectMapId = objectPatchDisabled
    ? parseSfaMapId(objectMapText, 0)
    : 0;
            const result = await convertEarly1ArchiveToFinalMapZlb(
                await readFile(earlyBin.input.files?.[0] ?? null),
                await readFile(earlyTab.input.files?.[0] ?? null),
                await readFile(finalBin.input.files?.[0] ?? null),
                await readFile(finalTab.input.files?.[0] ?? null),
                {
                    modelId: parseMaybeHexInt(modelInput.value, 0),
                                        outBaseName: nameInput.value || 'mod',
                    earlyMapFormat: earlyFormat.input.value as EarlyMapFormat,
                    groupMode: group.input.value as GroupMode,
                    colorMode: color.input.value as ColorMode,
                    textureMode: texMode.input.value as TextureMode,
flatTextureId: parseInt(flatTexInput.value, 10) || 1038,
flatTexS: parseInt(flatSInput.value, 10) || 0,
flatTexT: parseInt(flatTInput.value, 10) || 0,
collisionYMode: cy.input.value as CollisionYMode,
                    collisionWinding: cw.input.value as CollisionWinding,
                    maxTrisPerDL: 128,

objectsEnabled: !objectPatchDisabled,
objectMapId: sfaObjectMapId,
                    keepObjectTypes: parseHexObjectKeepList(keepObjInput.value),
                    mapsBin: await readOptionalFile(mapsBin.input.files?.[0] ?? null),
                    mapsTab: await readOptionalFile(mapsTab.input.files?.[0] ?? null),
                },
            );

            const base = nameInput.value || 'mod';

            downloadBytes(`${base}.zlb.bin`, result.zlbBin);
            downloadBytes(`${base}.tab`, result.tab);

            if (result.mapsBin && result.mapsTab) {
                downloadBytes(`${base}_MAPS_noobjects.bin`, result.mapsBin);
                downloadBytes(`${base}_MAPS_noobjects.tab`, result.mapsTab);
            }

            log.value = result.logs.join('\n');
            console.warn('[EARLY1 FINALMAP CONVERT]', result.logs.join('\n'));
        } catch (e) {
            console.error(e);
            log.value = String((e as Error)?.stack ?? (e as Error)?.message ?? e);
        } finally {
            convertButton.disabled = false;
        }
    };


    for (const ev of [
        'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click',
        'dblclick', 'wheel', 'keydown', 'keyup',
    ]) {
        panel.addEventListener(ev, (e) => {
            e.stopPropagation();
        });
    }

    parent.appendChild(panel);
    return panel;
}

class Early1FinalMapConverterScene implements Viewer.SceneGfx {
    private panel: HTMLElement | null;

constructor(_sceneContext: SceneContext) {
    this.panel = installEarly1FinalMapConverterPanel(document.body);
}

    public render(_device: GfxDevice, _renderInput: Viewer.ViewerRenderInput): void {
    }

    public destroy(_device: GfxDevice): void {
        this.panel?.remove();
        this.panel = null;
    }
}

export class Early1FinalMapConverterSceneDesc implements Viewer.SceneDesc {
    constructor(public id: string, public name: string) {
    }

    public createScene(_device: GfxDevice, sceneContext: SceneContext): Promise<Viewer.SceneGfx> {
        return Promise.resolve(new Early1FinalMapConverterScene(sceneContext));
    }
}
