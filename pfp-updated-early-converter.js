var PfpUpdatedEarlyConverter = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  var early_converter_standalone_exports = {};
  __export(early_converter_standalone_exports, {
    convertAncientBlocksArchiveToFinalMapZlb: () => convertAncientBlocksArchiveToFinalMapZlb,
    convertEarly1ArchiveToFinalMapZlb: () => convertEarly1ArchiveToFinalMapZlb,
    convertEarly3ArchiveToFinalMapZlb: () => convertEarly3ArchiveToFinalMapZlb,
    convertEarly4ArchiveToFinalMapZlb: () => convertEarly4ArchiveToFinalMapZlb,
    installEarly1FinalMapConverterPanel: () => installEarly1FinalMapConverterPanel
  });
  function getPfpEarlyConverterDeps() {
    const deps = window.__PFP_EARLY_CONVERTER_DEPS__;
    if (!deps)
      throw new Error("Project FoxPlanet converter dependencies are not ready.");
    return deps;
  }
  function debugResolveEarly1TextureId(texId, modelId = 0) {
    return getPfpEarlyConverterDeps().debugResolveEarly1TextureId(texId, modelId);
  }
  function debugResolveEarly3TextureId(texId, modelId = 0) {
    return getPfpEarlyConverterDeps().debugResolveEarly3TextureId(texId, modelId);
  }
  function debugResolveEarly4TextureId(texId, modelId = 0) {
    return getPfpEarlyConverterDeps().debugResolveEarly4TextureId(texId, modelId);
  }
  function debugResolveAncientTextureId(texId, modelId = 0) {
    return getPfpEarlyConverterDeps().debugResolveAncientTextureId(texId, modelId);
  }
  const ArrayBufferSlice = {
    fromView(view) {
      return getPfpEarlyConverterDeps().ArrayBufferSlice.fromView(view);
    }
  };
  function lzoDecompress(input, outputSize) {
    return getPfpEarlyConverterDeps().lzoDecompress(input, outputSize);
  }
  const EARLY1_SOURCE_INFO = {
    format: "early1_raw",
    dlInfoStride: 52,
    shaderStride: 64,
    bitsOffsets: [116, 124, 132],
    bitsByteCounts: [120, 128, 136],
    shaderMode: "early1",
    forceColorIndex16: false,
    expandColorPalette16: false,
    textureRemapMode: "early1"
  };
  const EARLY3_SOURCE_INFO = {
    format: "early3_raw",
    dlInfoStride: 56,
    shaderStride: 68,
    bitsOffsets: [120, 124, 128],
    bitsByteCounts: [132, 134, 136],
    shaderMode: "early3",
    forceColorIndex16: true,
    expandColorPalette16: true,
    textureRemapMode: "early3"
  };
  const EARLY4_SOURCE_INFO = {
    format: "early4_lzo",
    dlInfoStride: 56,
    shaderStride: 68,
    bitsOffsets: [120, 124, 128],
    bitsByteCounts: [132, 134, 136],
    shaderMode: "early4_final",
    forceColorIndex16: true,
    expandColorPalette16: true,
    textureRemapMode: "early4"
  };
  const ANCIENT_TRKBLK = {
    1: 22,
    2: 35,
    3: 57,
    4: 87,
    5: 0,
    6: 142,
    7: 164,
    8: 186,
    9: 208,
    10: 230,
    11: 252,
    12: 275,
    13: 297,
    14: 323,
    15: 345,
    16: 384,
    17: 448,
    18: 453,
    19: 475,
    20: 510,
    21: 532,
    22: 554,
    23: 576,
    24: 598,
    25: 620,
    26: 642,
    27: 664,
    28: 708,
    29: 730,
    30: 752,
    31: 774,
    32: 788,
    33: 805,
    34: 821,
    35: 843,
    36: 867,
    37: 872,
    38: 894,
    39: 916,
    40: 938,
    41: 960,
    42: 982,
    43: 1004,
    44: 1026,
    45: 1048,
    46: 1070,
    47: 1071,
    48: 1093,
    49: 1115,
    50: 1137,
    51: 1159,
    52: 1183,
    53: 1205,
    54: 1227,
    55: 1243
  };
  function ancientBlockResourceIdForFinalSub(modelId, finalSubIndex) {
    const base = ANCIENT_TRKBLK[modelId];
    if (base === void 0)
      throw new Error(`no Ancient BLOCKS base for mod/model ${modelId}`);
    if (finalSubIndex < 0)
      throw new Error(`bad Ancient final sub index ${finalSubIndex}`);
    return base + finalSubIndex;
  }
  function ancientSubIndexForFinalResource(finalResourceId, firstFinalResourceId) {
    return finalResourceId - firstFinalResourceId;
  }
  function earlyMapSourceInfo(format) {
    if (format === "early3_raw")
      return EARLY3_SOURCE_INFO;
    if (format === "early4_lzo")
      return EARLY4_SOURCE_INFO;
    return EARLY1_SOURCE_INFO;
  }
  function isEarly34Format(format) {
    return format === "early3_raw" || format === "early4_lzo";
  }
  const TAB_FLAG = 268435456;
  const FINAL_DLINFO_SIZE = 28;
  const SHADER_STRIDE = 68;
  const OP_SET_SHADER = 1;
  const OP_CALL_DL = 2;
  const OP_SET_VCD = 3;
  const OP_SET_MATRICES = 4;
  const OP_END = 5;
  function copyU8(src) {
    const out = new Uint8Array(src.byteLength);
    out.set(src);
    return out;
  }
  function toBlobBuffer(src) {
    return copyU8(src).buffer;
  }
  function asU8(buf) {
    if (buf instanceof Uint8Array)
      return copyU8(buf);
    return new Uint8Array(buf);
  }
  function u8(b, o) {
    return b[o] ?? 0;
  }
  function u16(b, o) {
    return (b[o] ?? 0) << 8 | (b[o + 1] ?? 0);
  }
  function s16(b, o) {
    const v = u16(b, o);
    return v & 32768 ? v - 65536 : v;
  }
  function u32(b, o) {
    return ((b[o] ?? 0) << 24 | (b[o + 1] ?? 0) << 16 | (b[o + 2] ?? 0) << 8 | (b[o + 3] ?? 0)) >>> 0;
  }
  function p8(b, o, v) {
    b[o] = v & 255;
  }
  function p16(b, o, v) {
    b[o] = v >>> 8 & 255;
    b[o + 1] = v & 255;
  }
  function ps16(b, o, v) {
    p16(b, o, Math.max(-32768, Math.min(32767, v | 0)) & 65535);
  }
  function p32(b, o, v) {
    b[o] = v >>> 24 & 255;
    b[o + 1] = v >>> 16 & 255;
    b[o + 2] = v >>> 8 & 255;
    b[o + 3] = v & 255;
  }
  function align(v, a) {
    return v + a - 1 & ~(a - 1);
  }
  function isTexturelessMode(mode) {
    return mode !== "mapped";
  }
  function growTo(src, size) {
    const out = new Uint8Array(Math.max(src.byteLength, size));
    out.set(src);
    return out;
  }
  function setBytes(dst, off, src) {
    const out = growTo(dst, off + src.byteLength);
    out.set(src, off);
    return out;
  }
  class LowBitWriter {
    constructor() {
      __publicField(this, "data", []);
      __publicField(this, "bitIndex", 0);
    }
    put(value, bits) {
      for (let i = 0; i < bits; i++) {
        if ((this.bitIndex & 7) === 0)
          this.data.push(0);
        if ((value >>> i & 1) !== 0)
          this.data[this.data.length - 1] |= 1 << (this.bitIndex & 7);
        this.bitIndex++;
      }
    }
    bytes() {
      return new Uint8Array(this.data);
    }
  }
  function parseTab(tab, includeFF = false) {
    const out = new Map();
    for (let i = 0; i + 4 <= tab.byteLength; i += 4) {
      const raw = u32(tab, i);
      if (raw === 0)
        continue;
      if (raw === 4294967295) {
        if (includeFF)
          out.set(i >>> 2, null);
      } else {
        out.set(i >>> 2, raw & 268435455);
      }
    }
    return out;
  }
  function readRawArchive(bin, tabIn) {
    const tab = copyU8(tabIn);
    const t = parseTab(tab);
    const ids = [...t.entries()].filter(([, value]) => value !== null).map(([resourceId]) => resourceId).sort((a, b) => a - b);
    const blocks = new Map();
    for (let n = 0; n < ids.length; n++) {
      const resourceId = ids[n];
      const start = t.get(resourceId);
      const end = n + 1 < ids.length ? t.get(ids[n + 1]) : bin.byteLength;
      if (end > start) {
        blocks.set(
          resourceId,
          copyU8(bin.subarray(start, end))
        );
      }
    }
    return {
      tab,
      blocks,
      ids: [...blocks.keys()].sort((a, b) => a - b)
    };
  }
  function readRawArchiveByPhysicalOffset(bin, tabIn) {
    const tab = copyU8(tabIn);
    const t = parseTab(tab);
    const ids = [...t.entries()].filter(([, value]) => value !== null).map(([resourceId]) => resourceId).sort((a, b) => a - b);
    const blocks = new Map();
    const physicalOffsets = [...new Set(
      ids.map((resourceId) => t.get(resourceId)).filter(
        (offset) => offset >= 0 && offset < bin.byteLength
      )
    )].sort((a, b) => a - b);
    const endForOffset = new Map();
    for (let i = 0; i < physicalOffsets.length; i++) {
      const start = physicalOffsets[i];
      const end = i + 1 < physicalOffsets.length ? physicalOffsets[i + 1] : bin.byteLength;
      endForOffset.set(start, end);
    }
    for (const resourceId of ids) {
      const start = t.get(resourceId);
      if (start < 0 || start >= bin.byteLength)
        continue;
      const end = endForOffset.get(start) ?? bin.byteLength;
      if (end <= start || end > bin.byteLength)
        continue;
      blocks.set(
        resourceId,
        copyU8(bin.subarray(start, end))
      );
    }
    return {
      tab,
      blocks,
      ids: [...blocks.keys()].sort((a, b) => a - b)
    };
  }
  function fourCC(b, o) {
    return String.fromCharCode(
      u8(b, o + 0),
      u8(b, o + 1),
      u8(b, o + 2),
      u8(b, o + 3)
    );
  }
  function decompressLZOnResource(block, rid) {
    if (block.byteLength < 4)
      return copyU8(block);
    if (fourCC(block, 0) !== "LZOn")
      return copyU8(block);
    if (block.byteLength < 16)
      throw new Error(`resource ${rid} has truncated LZOn header, len=0x${block.byteLength.toString(16)}`);
    const rawLen = u32(block, 8);
    const comp = ArrayBufferSlice.fromView(block.subarray(16));
    const raw = lzoDecompress(comp, rawLen);
    return copyU8(new Uint8Array(raw.copyToBuffer()));
  }
  function readLzoArchive(bin, tabIn) {
    const rawArc = readRawArchiveByPhysicalOffset(
      bin,
      tabIn
    );
    const blocks = new Map();
    for (const rid of rawArc.ids) {
      const block = rawArc.blocks.get(rid);
      if (!block)
        continue;
      blocks.set(rid, decompressLZOnResource(block, rid));
    }
    return {
      tab: rawArc.tab,
      blocks,
      ids: [...blocks.keys()].sort((a, b) => a - b)
    };
  }
  function readEarlyMapSourceArchive(bin, tabIn, format) {
    if (format === "early4_lzo")
      return readLzoArchive(bin, tabIn);
    if (format === "early3_raw")
      return readRawArchiveByPhysicalOffset(bin, tabIn);
    return readRawArchive(bin, tabIn);
  }
  async function streamTransform(kind, input) {
    const streamCtorName = kind === "deflate" ? "CompressionStream" : "DecompressionStream";
    const StreamCtor = globalThis[streamCtorName];
    if (!StreamCtor)
      throw new Error(`${streamCtorName} is not available in this browser. Use Chrome/Edge, or wire this to your existing Deflate module.`);
    const format = "deflate";
    const stream = new Blob([toBlobBuffer(input)]).stream().pipeThrough(new StreamCtor(format));
    const ab = await new Response(stream).arrayBuffer();
    return new Uint8Array(ab);
  }
  async function decompressZlib(input) {
    return streamTransform("inflate", input);
  }
  async function compressZlib(input) {
    return streamTransform("deflate", input);
  }
  async function readZlbArchive(bin, tabIn) {
    const tab = copyU8(tabIn);
    const t = parseTab(tab, true);
    const ids = [...t.entries()].filter(([, v]) => v !== null).map(([k]) => k).sort((a, b) => a - b);
    const blocks = new Map();
    for (const rid of ids) {
      const s = t.get(rid);
      if (String.fromCharCode(bin[s], bin[s + 1], bin[s + 2], bin[s + 3]) !== "ZLB\0")
        throw new Error(`resource ${rid} is not ZLB at 0x${s.toString(16)}`);
      const rawLen = u32(bin, s + 8);
      const compLen = u32(bin, s + 12);
      const raw = await decompressZlib(bin.slice(s + 16, s + 16 + compLen));
      if (raw.byteLength !== rawLen)
        throw new Error(`resource ${rid} raw length mismatch: got ${raw.byteLength}, expected ${rawLen}`);
      blocks.set(rid, raw);
    }
    return { tab, blocks, ids };
  }
  async function writeZlb(raw) {
    const comp = await compressZlib(raw);
    const out = new Uint8Array(16 + comp.byteLength);
    out[0] = 90;
    out[1] = 76;
    out[2] = 66;
    out[3] = 0;
    p32(out, 4, 1);
    p32(out, 8, raw.byteLength);
    p32(out, 12, comp.byteLength);
    out.set(comp, 16);
    return out;
  }
  function textureTabValueForOffset(off) {
    if ((off & 1) !== 0)
      throw new Error(`texture BIN offset must be 2-byte aligned, got 0x${off.toString(16)}`);
    const halfOff = off >>> 1;
    if (halfOff > 16777215)
      throw new Error(`texture BIN offset too large for SFA texture tab: 0x${off.toString(16)}`);
    return (2164260864 | halfOff) >>> 0;
  }
  function isValidTextureTabValue(raw) {
    return raw !== 4294967295 && (raw & 2147483648) !== 0;
  }
  function textureTabOffset(raw) {
    return (raw & 16777215) * 2;
  }
  function textureTabArrayLength(raw) {
    return raw >>> 24 & 63;
  }
  async function decodePngToRgba(pngBytes) {
    const bmp = await createImageBitmap(new Blob([toBlobBuffer(pngBytes)], { type: "image/png" }));
    try {
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = canvas.getContext("2d");
      if (!ctx)
        throw new Error("could not create PNG decode canvas");
      ctx.drawImage(bmp, 0, 0);
      const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
      return {
        width: bmp.width,
        height: bmp.height,
        rgba: new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength).slice()
      };
    } finally {
      bmp.close();
    }
  }
  function encodeGxRgba8(rgba, width, height) {
    const bw = align(width, 4);
    const bh = align(height, 4);
    const out = new Uint8Array(bw * bh * 4);
    let p = 0;
    for (let ty = 0; ty < bh; ty += 4) {
      for (let tx = 0; tx < bw; tx += 4) {
        for (let y = 0; y < 4; y++) {
          for (let x = 0; x < 4; x++) {
            const sx = tx + x;
            const sy = ty + y;
            if (sx < width && sy < height) {
              const src = (sy * width + sx) * 4;
              out[p++] = rgba[src + 3];
              out[p++] = rgba[src + 0];
            } else {
              out[p++] = 255;
              out[p++] = 0;
            }
          }
        }
        for (let y = 0; y < 4; y++) {
          for (let x = 0; x < 4; x++) {
            const sx = tx + x;
            const sy = ty + y;
            if (sx < width && sy < height) {
              const src = (sy * width + sx) * 4;
              out[p++] = rgba[src + 1];
              out[p++] = rgba[src + 2];
            } else {
              out[p++] = 0;
              out[p++] = 0;
            }
          }
        }
      }
    }
    return out;
  }
  function makeSfaTextureResourceRgba8(width, height, rgba) {
    const texData = encodeGxRgba8(rgba, width, height);
    const out = new Uint8Array(96 + texData.byteLength);
    p16(out, 10, width);
    p16(out, 12, height);
    p8(out, 22, 6);
    p8(out, 23, 1);
    p8(out, 24, 1);
    p8(out, 25, 1);
    p8(out, 26, 1);
    p16(out, 28, 0);
    out.set(texData, 96);
    return out;
  }
  async function patchSfaTextureArchiveWithPngs(texBinIn, texTabIn, entries) {
    let texBin = asU8(texBinIn);
    let texTab = asU8(texTabIn);
    const logs = [];
    for (const entry of entries) {
      const tabOff = entry.targetTexId * 4;
      if (tabOff + 4 > texTab.byteLength) {
        const grown = new Uint8Array(tabOff + 4);
        grown.fill(255);
        grown.set(texTab);
        texTab = grown;
      }
      const oldRaw = u32(texTab, tabOff);
      const oldDesc = isValidTextureTabValue(oldRaw) ? `oldRaw=0x${oldRaw.toString(16)}/arrayLen=${textureTabArrayLength(oldRaw)}/oldOff=0x${textureTabOffset(oldRaw).toString(16)}` : `oldRaw=0x${oldRaw.toString(16)}/missing`;
      const png = await decodePngToRgba(entry.png);
      const rawTex = makeSfaTextureResourceRgba8(png.width, png.height, png.rgba);
      const zlbTex = await writeZlb(rawTex);
      const appendOff = align(texBin.byteLength, 32);
      const outBin = new Uint8Array(appendOff + zlbTex.byteLength);
      outBin.set(texBin);
      outBin.set(zlbTex, appendOff);
      texBin = outBin;
      p32(texTab, tabOff, textureTabValueForOffset(appendOff));
      logs.push(
        `texInject ${entry.name} -> id=${entry.targetTexId} ${oldDesc} newOff=0x${appendOff.toString(16)} size=${png.width}x${png.height} raw=0x${rawTex.byteLength.toString(16)} zlb=0x${zlbTex.byteLength.toString(16)}`
      );
    }
    return { texBin, texTab, logs };
  }
  function parseMaybeHexInt(text, fallback) {
    const s = text.trim();
    if (s.length === 0)
      return fallback;
    const isHex = s.startsWith("0x") || s.startsWith("0X") || /[a-fA-F]/.test(s);
    const v = parseInt(isHex ? s.replace(/^0x/i, "") : s, isHex ? 16 : 10);
    return Number.isFinite(v) ? v : fallback;
  }
  function parseSfaMapId(text, fallback) {
    const s = text.trim();
    if (s.length === 0)
      return fallback;
    const clean = s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s;
    if (!/^[0-9a-fA-F]+$/.test(clean))
      throw new Error(`bad SFA map ID "${text}"`);
    return parseInt(clean, 16);
  }
  const SFA_OBJECT_ALWAYS_KEEP_TYPES = [
    13,
    76,
    75,
    560,
    77,
    78,
    79,
    80,
    84,
    382,
    2033,
    1263,
    1549,
    1364,
    688,
    1289,
    786,
    1822,
    1317,
    1166,
    642,
    767,
    1073
  ];
  function parseHexObjectKeepList(text) {
    const out = [];
    for (const part of text.split(/[,\s]+/g)) {
      const s = part.trim();
      if (s.length === 0)
        continue;
      const clean = s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s;
      const v = parseInt(clean, 16);
      if (!Number.isFinite(v) || v < 0 || v > 65535)
        throw new Error(`bad object type "${part}" in keep list`);
      out.push(v & 65535);
    }
    return out;
  }
  const SFA_MAP_AUTO_ENTRIES = [
    { id: 0, romlist: "frontend", directory: "shipbattle", name: "Ship Battle" },
    { id: 1, romlist: "frontend2", directory: "animtest", name: "ZNot Used - Front End2" },
    { id: 2, romlist: "dragrock", directory: "dragrock", name: "Dragon Rock - Top" },
    { id: 3, romlist: "krazoapalace", directory: "animtest", name: "ZNot Used - Krazoa Palace" },
    { id: 4, romlist: "temple", directory: "volcano", name: "Volcano Force Point" },
    { id: 5, romlist: "hightop", directory: "animtest", name: "Rolling Demo - Just In Case" },
    { id: 6, romlist: "discovery", directory: "animtest", name: "ZNot Used - Discovery Falls" },
    { id: 7, romlist: "hollow", directory: "swaphol", name: "ThornTail Hollow" },
    { id: 8, romlist: "hollow2", directory: "swapholbot", name: "ThornTail Hollow - Undergro" },
    { id: 9, romlist: "mazecave", directory: "mazecave", name: "MazeTest" },
    { id: 10, romlist: "wastes", directory: "nwastes", name: "SnowHorn Wastes" },
    { id: 11, romlist: "warlock", directory: "warlock", name: "Krazoa Palace" },
    { id: 12, romlist: "fortress", directory: "crfort", name: "CloudRunner Fortress" },
    { id: 13, romlist: "wallcity", directory: "wallcity", name: "Walled City" },
    { id: 14, romlist: "swapcircle", directory: "lightfoot", name: "LightFoot Village" },
    { id: 15, romlist: "cloudtreasure", directory: "cloudtreasure", name: "ZNot Used - CloudRunner - T" },
    { id: 16, romlist: "clouddungeon", directory: "clouddungeon", name: "CloudRunner - Dungeon" },
    { id: 17, romlist: "cloudtrap", directory: "animtest", name: "ZNot Used - CloudRunner - T" },
    { id: 18, romlist: "moonpass", directory: "mmpass", name: "Moon Mountain Pass" },
    { id: 19, romlist: "snowmines", directory: "darkicemines", name: "DarkIce Mines - Top" },
    { id: 20, romlist: "krashrin2", directory: "animtest", name: "ZNot Used - Krazoa Shrine" },
    { id: 21, romlist: "kraztest", directory: "desert", name: "Ocean Force Point - Bottom" },
    { id: 22, romlist: "krazchamber", directory: "animtest", name: "krazchamber" },
    { id: 23, romlist: "newicemount", directory: "icemountain", name: "Ice Mountain" },
    { id: 24, romlist: "newicemount2", directory: "animtest", name: "ZNot Used - Ice Mountain 2" },
    { id: 25, romlist: "newicemount3", directory: "animtest", name: "ZNot Used - Ice Mountain 3" },
    { id: 26, romlist: "animtest", directory: "animtest", name: "Animtest" },
    { id: 27, romlist: "snowmines2", directory: "darkicemines2", name: "DarkIce Mines - Bottom" },
    { id: 28, romlist: "snowmines3", directory: "bossgaldon", name: "BOSS DarkIce" },
    { id: 29, romlist: "capeclaw", directory: "capeclaw", name: "Cape Claw" },
    { id: 30, romlist: "insidegal", directory: "insidegal", name: "ZNot Used - Inside Galleon" },
    { id: 31, romlist: "dfshrine", directory: "dfshrine", name: "Test Of Combat" },
    { id: 32, romlist: "mmshrine", directory: "mmshrine", name: "Test Of Fear" },
    { id: 33, romlist: "ecshrine", directory: "ecshrine", name: "Test Of Skill" },
    { id: 34, romlist: "gpshrine", directory: "gpshrine", name: "Test Of Knowledge" },
    { id: 35, romlist: "diamondbay", directory: "dbay", name: "ZNot Used - Diamond Bay" },
    { id: 36, romlist: "earthwalker", directory: "animtest", name: "ZNot Used - EarthWalker Tem" },
    { id: 37, romlist: "willow", directory: "animtest", name: "ZNot Used - Willow Grove" },
    { id: 38, romlist: "arwing", directory: "arwing", name: "ArWing Level - Andross" },
    { id: 39, romlist: "dbshrine", directory: "dbshrine", name: "Test Of Strength" },
    { id: 40, romlist: "nwshrine", directory: "worldmap", name: "BOSS Scales" },
    { id: 41, romlist: "ccshrine", directory: "worldmap", name: "World Map" },
    { id: 42, romlist: "wgshrine", directory: "animtest", name: "ZNot Used - WGShrine" },
    { id: 43, romlist: "cloudrace", directory: "cloudrace", name: "CloudRunner - Race" },
    { id: 44, romlist: "finalboss", directory: "bossdrakor", name: "BOSS Drakor" },
    { id: 45, romlist: "wminsert", directory: "animtest", name: "ZNot Used - WMinsert" },
    { id: 46, romlist: "snowmines4", directory: "animtest", name: "ZNot Used - DarkIce Mines -" },
    { id: 47, romlist: "snowmines5", directory: "animtest", name: "ZNot Used - DarkIce Mines -" },
    { id: 48, romlist: "trexboss", directory: "bosstrex", name: "BOSS TRex" },
    { id: 49, romlist: "mikelava", directory: "animtest", name: "ZNot Used - MikesLava" },
    { id: 50, romlist: "dfptop", directory: "dfptop", name: "Ocean Force Point - Top" },
    { id: 51, romlist: "swapstore", directory: "shop", name: "Shop" },
    { id: 52, romlist: "dragbot", directory: "dragrockbot", name: "Dragon Rock - Bottom" },
    { id: 53, romlist: "kamdrag", directory: "animtest", name: "ZNot Used - BOSS Kamerian D" },
    { id: 54, romlist: "magicave", directory: "magiccave", name: "Magic Cave - Small\\Big" },
    { id: 55, romlist: "duster", directory: "cloudjoin", name: "ZNot Used - Duster Cave" },
    { id: 56, romlist: "linkb", directory: "linkb", name: "LinkB - Ice2Wastes" },
    { id: 57, romlist: "cloudjoin", directory: "animtest", name: "ZNot Used - CloudRunner2Rac" },
    { id: 58, romlist: "arwingtoplanet", directory: "arwingtoplanet", name: "Arwing to Planet" },
    { id: 59, romlist: "arwingdarkice", directory: "arwingdarkice", name: "Arwing Darkice" },
    { id: 60, romlist: "arwingcloud", directory: "arwingcloud", name: "Arwing Cloud" },
    { id: 61, romlist: "arwingcity", directory: "arwingcity", name: "Arwing City" },
    { id: 62, romlist: "arwingdragon", directory: "arwingdragon", name: "Arwing Dragon" },
    { id: 63, romlist: "gamefront", directory: "gamefront", name: "Game Front" },
    { id: 64, romlist: "linklevel", directory: "linklevel", name: "LinkK - Nik Test" },
    { id: 65, romlist: "greatfox", directory: "greatfox", name: "Great Fox" },
    { id: 66, romlist: "linka", directory: "linka", name: "LinkA - Warpstone to Others" },
    { id: 67, romlist: "linkc", directory: "linkc", name: "LinkC - Wastes to Hollow" },
    { id: 68, romlist: "linkd", directory: "linkd", name: "LinkD - Darkmines top 2 bot" },
    { id: 69, romlist: "linke", directory: "linke", name: "LinkE - hollow to moon pass" },
    { id: 70, romlist: "linkf", directory: "linkf", name: "LinkF - moonpass to volcano" },
    { id: 71, romlist: "linkg", directory: "linkg", name: "LinkG - hollow to lightfoot" },
    { id: 72, romlist: "linkh", directory: "linkh", name: "LinkH - lightfoot to capecl" },
    { id: 73, romlist: "linkj", directory: "linkj", name: "LinkJ - capeclaw 2 ocean fo" },
    { id: 74, romlist: "linki", directory: "linki", name: "LinkI - CloudRunner2Race" }
  ];
  const FINAL_MOD_TO_SFA_MAP_ID = new Map([
    [4, 2],

    [8, 4],

    [13, 7],

    [15, 10],

    [16, 11],

    [17, 51],

    [19, 12],

    [21, 13],

    [22, 14],

    [26, 18],

    [27, 19],

    [35, 27],

    [45, 40],

    [48, 29]


  ]);
  function hexMapId(v) {
    return v.toString(16).toUpperCase().padStart(2, "0");
  }
  function hexObjectResourceIdForMap(mapId) {
    return (mapId * 7 + 6).toString(16).toUpperCase().padStart(2, "0");
  }
  function normalizeAutoDetectText(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
  function parseModNumberFromFilename(filename) {
    const m = /(?:^|[_\-.])(?:root_)?mod([0-9a-fA-F]+)(?=[_\-.]|$)/i.exec(filename);
    if (!m)
      return null;
    return parseMaybeHexInt(m[1], -1) >= 0 ? parseMaybeHexInt(m[1], -1) : null;
  }
  function longestMapDetectToken(e) {
    return Math.max(
      normalizeAutoDetectText(e.romlist).length,
      normalizeAutoDetectText(e.directory).length,
      normalizeAutoDetectText(e.name).length
    );
  }
  function inferSfaMapFromText(text) {
    const hay = normalizeAutoDetectText(text);
    const entries = SFA_MAP_AUTO_ENTRIES.slice().sort((a, b) => longestMapDetectToken(b) - longestMapDetectToken(a));
    for (const entry of entries) {
      const tokens = [
        entry.romlist,
        entry.directory,
        entry.name
      ].map(normalizeAutoDetectText).filter((s) => s.length >= 3);
      for (const token of tokens) {
        if (hay.includes(token))
          return entry;
      }
    }
    return null;
  }
  function sfaMapEntryById(id) {
    return SFA_MAP_AUTO_ENTRIES.find((e) => e.id === id) ?? null;
  }
  function inferSfaMapFromFilename(filename, modId) {
    const byText = inferSfaMapFromText(filename);
    if (byText)
      return byText;
    if (modId !== null) {
      const mappedId = FINAL_MOD_TO_SFA_MAP_ID.get(modId);
      if (mappedId !== void 0)
        return sfaMapEntryById(mappedId);
    }
    return null;
  }
  function autoFillConverterFromFinalFile(file, modelInput, nameInput, objectMapInput, log) {
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
      log.value = `Auto-detected from ${filename}
visual mod=${modId !== null ? modId : "unknown"}
SFA map=${hexMapId(mapEntry.id)} ${mapEntry.romlist} / ${mapEntry.name}
MAPS object resource=0x${hexObjectResourceIdForMap(mapEntry.id)}
Keep list objects stay in-place; all other objects move far away.
`;
    } else if (modId !== null) {
      log.value = `Auto-detected from ${filename}
visual mod=${modId}
No SFA map match found. Fill "SFA object map ID" manually.
`;
    }
  }
  function findNextMapsArchiveOffset(tab, start, binSize) {
    let best = binSize;
    for (let i = 0; i + 4 <= tab.byteLength; i += 4) {
      const raw = u32(tab, i);
      if (raw === 0 || raw === 4294967295)
        continue;
      const off = raw & 268435455;
      if (off > start && off < best)
        best = off;
    }
    if (best <= start || best > binSize)
      throw new Error(`could not find end offset for MAPS resource at 0x${start.toString(16)}`);
    return best;
  }
  function stripSfaObjectListRaw(raw, keepObjectTypes) {
    const keep = new Set(
      [
        ...SFA_OBJECT_ALWAYS_KEEP_TYPES,
        ...keepObjectTypes
      ].map((v) => v & 65535)
    );
    const out = copyU8(raw);
    let readOff = 0;
    let total = 0;
    let kept = 0;
    let moved = 0;
    const farXBits = 1189765120;
    const farYBits = 3337248768;
    const farZBits = 1189765120;
    while (readOff + 4 <= raw.byteLength) {
      const objectType = u16(raw, readOff + 0);
      const words = u8(raw, readOff + 2);
      const recordLen = words * 4;
      if (recordLen === 0)
        break;
      if (recordLen < 4 || readOff + recordLen > raw.byteLength) {
        throw new Error(
          `bad object record at raw+0x${readOff.toString(16)} type=0x${objectType.toString(16).padStart(4, "0")} words=0x${words.toString(16)} len=0x${recordLen.toString(16)} rawLen=0x${raw.byteLength.toString(16)}`
        );
      }
      total++;
      if (keep.has(objectType)) {
        kept++;
      } else {
        if (recordLen >= 20) {
          p32(out, readOff + 8, farXBits);
          p32(out, readOff + 12, farYBits);
          p32(out, readOff + 16, farZBits);
          moved++;
        }
      }
      readOff += recordLen;
    }
    const keepSummary = [...keep].sort((a, b) => a - b).map((v) => `0x${v.toString(16).padStart(4, "0")}`).join(",");
    return {
      raw: out,
      total,
      kept,
      removed: moved,
      keepSummary
    };
  }
  async function patchSfaMapsObjectsForMap(mapsBinIn, mapsTabIn, mapId, keepObjectTypes) {
    const mapsBin = asU8(mapsBinIn);
    const mapsTab = asU8(mapsTabIn);
    const objectResourceId = mapId * 7 + 6;
    const tabOff = objectResourceId * 4;
    if (tabOff + 4 > mapsTab.byteLength)
      throw new Error(`map ${mapId} object resource ${objectResourceId} is outside MAPS.tab`);
    const start = u32(mapsTab, tabOff) & 268435455;
    if (start <= 0 || start >= mapsBin.byteLength) {
      throw new Error(
        `bad MAPS.tab object offset for map ${mapId} resource=${objectResourceId} offset=0x${start.toString(16)}`
      );
    }
    const end = findNextMapsArchiveOffset(mapsTab, start, mapsBin.byteLength);
    const oldSpan = end - start;
    let zlbOff = start;
    let hasFaceFeed = false;
    if (u32(mapsBin, start) === 4207869677) {
      hasFaceFeed = true;
      zlbOff = start + 32;
    }
    if (fourCC(mapsBin, zlbOff) !== "ZLB\0") {
      throw new Error(
        `map ${mapId} object resource ${objectResourceId} is not ZLB/FACEFEED-ZLB at MAPS.bin+0x${start.toString(16)}`
      );
    }
    const rawLen = u32(mapsBin, zlbOff + 8);
    const compLen = u32(mapsBin, zlbOff + 12);
    if (zlbOff + 16 + compLen > mapsBin.byteLength) {
      throw new Error(
        `map ${mapId} object ZLB compressed data exceeds MAPS.bin zlbOff=0x${zlbOff.toString(16)} compLen=0x${compLen.toString(16)}`
      );
    }
    const raw = await decompressZlib(mapsBin.slice(zlbOff + 16, zlbOff + 16 + compLen));
    if (raw.byteLength !== rawLen) {
      throw new Error(
        `map ${mapId} object raw length mismatch: got 0x${raw.byteLength.toString(16)} expected 0x${rawLen.toString(16)}`
      );
    }
    const stripped = stripSfaObjectListRaw(raw, keepObjectTypes);
    const newZlb = await writeZlb(stripped.raw);
    const maxZlbLen = oldSpan - (hasFaceFeed ? 32 : 0);
    if (newZlb.byteLength > maxZlbLen) {
      throw new Error(
        `stripped object ZLB grew too large: new=0x${newZlb.byteLength.toString(16)} max=0x${maxZlbLen.toString(16)} oldSpan=0x${oldSpan.toString(16)}`
      );
    }
    const outBin = copyU8(mapsBin);
    outBin.fill(0, start, end);
    if (hasFaceFeed) {
      outBin.set(mapsBin.subarray(start, start + 32), start);
      p32(outBin, start + 4, stripped.raw.byteLength);
      p32(outBin, start + 12, newZlb.byteLength);
      outBin.set(newZlb, start + 32);
    } else {
      outBin.set(newZlb, start);
    }
    const log = `objects moved far for map=${mapId} objectResource=${objectResourceId} offset=0x${start.toString(16)} span=0x${oldSpan.toString(16)} raw=0x${raw.byteLength.toString(16)} oldZlb=0x${(16 + compLen).toString(16)} newZlb=0x${newZlb.byteLength.toString(16)} total=${stripped.total} kept=${stripped.kept} moved=${stripped.removed} keep=[${stripped.keepSummary}] far=(30000,-30000,30000)`;
    return { mapsBin: outBin, mapsTab, log };
  }
  function hitsTabMissingValue(tab) {
    let zeroCount = 0;
    let ffCount = 0;
    for (let i = 0; i + 4 <= tab.byteLength; i += 4) {
      const raw = u32(tab, i);
      if (raw === 0)
        zeroCount++;
      else if (raw === 4294967295)
        ffCount++;
    }
    return ffCount > zeroCount ? 4294967295 : 0;
  }
  function hitsTabOffsetOrNull(raw, binSize) {
    if (raw === 0 || raw === 4294967295)
      return null;
    const off = raw & 268435455;
    if (off <= 0 || off >= binSize)
      return null;
    return off;
  }
  function findNextHitsArchiveOffset(tab, start, binSize) {
    let best = binSize;
    for (let i = 0; i + 4 <= tab.byteLength; i += 4) {
      const raw = u32(tab, i);
      const off = hitsTabOffsetOrNull(raw, binSize);
      if (off !== null && off > start && off < best)
        best = off;
    }
    return best;
  }
  function patchSfaHitsDisableResourceIds(hitsBinIn, hitsTabIn, resourceIds) {
    const hitsBin = asU8(hitsBinIn);
    const hitsTab = asU8(hitsTabIn);
    const missingValue = hitsTabMissingValue(hitsTab);
    const uniqueIds = [...new Set(resourceIds)].filter((rid) => Number.isFinite(rid) && rid >= 0).sort((a, b) => a - b);
    let cleared = 0;
    let alreadyMissing = 0;
    let outsideTab = 0;
    let invalidOffset = 0;
    let totalBytes = 0;
    let totalLines20 = 0;
    const details = [];
    for (const rid of uniqueIds) {
      const tabOff = rid * 4;
      if (tabOff + 4 > hitsTab.byteLength) {
        outsideTab++;
        if (details.length < 32)
          details.push(`rid0x${rid.toString(16)}=outsideTab`);
        continue;
      }
      const raw = u32(hitsTab, tabOff);
      const start = hitsTabOffsetOrNull(raw, hitsBin.byteLength);
      if (start === null) {
        alreadyMissing++;
        if (details.length < 32)
          details.push(`rid0x${rid.toString(16)}=missing/raw0x${raw.toString(16)}`);
        continue;
      }
      const end = findNextHitsArchiveOffset(hitsTab, start, hitsBin.byteLength);
      const span = end - start;
      if (span <= 0 || end > hitsBin.byteLength) {
        invalidOffset++;
        if (details.length < 32) {
          details.push(
            `rid0x${rid.toString(16)}=badSpan/start0x${start.toString(16)}/end0x${end.toString(16)}`
          );
        }
        continue;
      }
      hitsBin.fill(0, start, end);
      p32(hitsTab, tabOff, missingValue);
      cleared++;
      totalBytes += span;
      totalLines20 += Math.floor(span / 20);
      if (details.length < 32) {
        details.push(
          `rid0x${rid.toString(16)}/tab+0x${tabOff.toString(16)}/oldRaw0x${raw.toString(16)}/span0x${span.toString(16)}/lines20=${Math.floor(span / 20)}`
        );
      }
    }
    return {
      hitsBin,
      hitsTab,
      log: `HITS special collision disabled ids=${uniqueIds.length} cleared=${cleared} alreadyMissing=${alreadyMissing} outsideTab=${outsideTab} invalidOffset=${invalidOffset} bytesZeroed=0x${totalBytes.toString(16)} lines20=${totalLines20} missingMarker=0x${missingValue.toString(16)} details=[${details.join("; ")}]`
    };
  }
  const SFA_MAP_ID_WARLOCK = 11;
  const SFA_MAP_GRID_WIDTH = 12;
  const SFA_MAP_GRID_HEIGHT = 16;
  const SFA_MAP_GRID_EMPTY = 2147352703;
  const ANCIENT_WARLOCK_LAYOUT_TOP_ROW = 3;
  const ANCIENT_WARLOCK_LAYOUT_LEFT_COL = 0;
  const ANCIENT_WARLOCK_LAYOUT_SUBS = [
    [null, null, null, null, null, 0, 1, 2, 61, 57],
    [null, null, null, null, 3, 4, 5, 6, 11, 63],
    [62, null, 32, 7, 8, 9, 10, 37, 36, null],
    [60, null, 33, 12, 13, 14, 15, 16, 17, 34],
    [57, 39, 40, 18, 19, 20, 21, 22, 23, 35],
    [41, 42, 43, 38, 24, 25, 26, 27, null, null],
    [57, 45, 59, 58, 28, 29, 30, 31, 55, null],
    [56, 47, 48, 49, 50, 51, 52, 53, 54, null]
  ];
  function sfaMapsResourceOffset(mapsTab, mapsBinSize, resourceId) {
    const tabOff = resourceId * 4;
    if (tabOff + 4 > mapsTab.byteLength)
      throw new Error(`MAPS resource 0x${resourceId.toString(16)} is outside MAPS.tab`);
    const raw = u32(mapsTab, tabOff);
    if (raw === 0 || raw === 4294967295)
      throw new Error(`MAPS resource 0x${resourceId.toString(16)} is missing in MAPS.tab`);
    const off = raw & 268435455;
    if (off <= 0 || off >= mapsBinSize)
      throw new Error(
        `bad MAPS resource 0x${resourceId.toString(16)} offset 0x${off.toString(16)}`
      );
    return off;
  }
  function finalMapGridValueForSub(firstFinalResourceId, finalSubIndex) {
    return (firstFinalResourceId + finalSubIndex) * 131072 + 127 >>> 0;
  }
  function decodeFinalMapGridResourceId(cell) {
    if (cell === SFA_MAP_GRID_EMPTY)
      return null;
    if ((cell & 65535) !== 127)
      return null;
    const rid = Math.floor(cell / 131072);
    if (rid <= 0 || rid >= 16128)
      return null;
    return rid;
  }
  function inferWarlockFinalResourceBaseFromExistingMaps(mapsBin, mapsTab) {
    const mapBaseResourceId = SFA_MAP_ID_WARLOCK * 7;
    const gridResourceId = mapBaseResourceId + 1;
    const gridOff = sfaMapsResourceOffset(mapsTab, mapsBin.byteLength, gridResourceId);
    const rids = [];
    for (let row = 0; row < SFA_MAP_GRID_HEIGHT; row++) {
      for (let col = 0; col < SFA_MAP_GRID_WIDTH; col++) {
        const cellOff = gridOff + (row * SFA_MAP_GRID_WIDTH + col) * 4;
        const rid = decodeFinalMapGridResourceId(u32(mapsBin, cellOff));
        if (rid !== null)
          rids.push(rid);
      }
    }
    if (rids.length === 0)
      return null;
    const distinct = [...new Set(rids)].sort((a, b) => a - b);
    return {
      firstFinalResourceId: distinct[0],
      minRid: distinct[0],
      maxRid: distinct[distinct.length - 1],
      distinctCount: distinct.length,
      sample: distinct.slice(0, 16)
    };
  }
  function patchSfaMapsAncientWarlockLayoutAndVisibility(mapsBinIn, mapsTabIn, mapsGridFirstResourceId) {
    const mapsBin = asU8(mapsBinIn);
    const mapsTab = asU8(mapsTabIn);
    const mapBaseResourceId = SFA_MAP_ID_WARLOCK * 7;
    const headerResourceId = mapBaseResourceId + 0;
    const gridResourceId = mapBaseResourceId + 1;
    const visResourceIds = [mapBaseResourceId + 2, mapBaseResourceId + 3];
    const headerOff = sfaMapsResourceOffset(mapsTab, mapsBin.byteLength, headerResourceId);
    const oldStartCol = u16(mapsBin, headerOff + 4);
    const oldStartRow = u16(mapsBin, headerOff + 6);
    const gridOff = sfaMapsResourceOffset(mapsTab, mapsBin.byteLength, gridResourceId);
    const gridLen = SFA_MAP_GRID_WIDTH * SFA_MAP_GRID_HEIGHT * 4;
    if (gridOff + gridLen > mapsBin.byteLength) {
      throw new Error(
        `Warlock MAPS grid OOB: resource=0x${gridResourceId.toString(16)} off=0x${gridOff.toString(16)} len=0x${gridLen.toString(16)} bin=0x${mapsBin.byteLength.toString(16)}`
      );
    }
    for (let row = 0; row < SFA_MAP_GRID_HEIGHT; row++) {
      for (let col = 0; col < SFA_MAP_GRID_WIDTH; col++) {
        const cellOff = gridOff + (row * SFA_MAP_GRID_WIDTH + col) * 4;
        p32(mapsBin, cellOff, SFA_MAP_GRID_EMPTY);
      }
    }
    const occupiedCells = [];
    for (let srcRow = 0; srcRow < ANCIENT_WARLOCK_LAYOUT_SUBS.length; srcRow++) {
      const row = ANCIENT_WARLOCK_LAYOUT_SUBS[srcRow];
      for (let srcCol = 0; srcCol < row.length; srcCol++) {
        const sub = row[srcCol];
        if (sub === null)
          continue;
        const dstRow = ANCIENT_WARLOCK_LAYOUT_TOP_ROW + srcRow;
        const dstCol = ANCIENT_WARLOCK_LAYOUT_LEFT_COL + srcCol;
        const finalRid = mapsGridFirstResourceId + sub;
        if (dstRow < 0 || dstRow >= SFA_MAP_GRID_HEIGHT || dstCol < 0 || dstCol >= SFA_MAP_GRID_WIDTH) {
          throw new Error(
            `Ancient Warlock layout cell outside MAPS grid: sub=${sub} row=${dstRow} col=${dstCol}`
          );
        }
        const cellOff = gridOff + (dstRow * SFA_MAP_GRID_WIDTH + dstCol) * 4;
        p32(mapsBin, cellOff, finalMapGridValueForSub(mapsGridFirstResourceId, sub));
        occupiedCells.push({ row: dstRow, col: dstCol, sub, rid: finalRid });
      }
    }
    const visible44BB = new Uint8Array([
      68,
      187,
      68,
      187,
      68,
      187,
      68,
      187
    ]);
    for (const visResourceId of visResourceIds) {
      const visOff = sfaMapsResourceOffset(mapsTab, mapsBin.byteLength, visResourceId);
      const visLen = SFA_MAP_GRID_WIDTH * SFA_MAP_GRID_HEIGHT * 8;
      if (visOff + visLen > mapsBin.byteLength) {
        throw new Error(
          `Warlock MAPS visibility grid OOB: resource=0x${visResourceId.toString(16)} off=0x${visOff.toString(16)} len=0x${visLen.toString(16)} bin=0x${mapsBin.byteLength.toString(16)}`
        );
      }
      for (const cell of occupiedCells) {
        const recOff = visOff + (cell.row * SFA_MAP_GRID_WIDTH + cell.col) * 8;
        mapsBin.set(visible44BB, recOff);
      }
    }
    return {
      mapsBin,
      mapsTab,
      log: `ancient Warlock MAPS layout applied map=0x${SFA_MAP_ID_WARLOCK.toString(16)} headerResource=0x${headerResourceId.toString(16)} headerOff=0x${headerOff.toString(16)} headerStartKept=${oldStartCol},${oldStartRow} gridResource=0x${gridResourceId.toString(16)} gridOff=0x${gridOff.toString(16)} mapsGridFirstResource=0x${mapsGridFirstResourceId.toString(16)} topLeft=row${ANCIENT_WARLOCK_LAYOUT_TOP_ROW},col${ANCIENT_WARLOCK_LAYOUT_LEFT_COL} occupied=${occupiedCells.length} visibility=preserved_then_44BB_on_occupied_cells_only visResources=[${visResourceIds.map((v) => `0x${v.toString(16)}`).join(",")}]`
    };
  }
  function earlyInfo(b) {
    return {
      triOff: u32(b, 76),
      batchOff: u32(b, 80),
      texOff: u32(b, 84),
      posOff: u32(b, 88),
      clrOff: u32(b, 92),
      texcoordOff: u32(b, 96),
      shaderOff: u32(b, 100),
      dlInfoOff: u32(b, 104),
      posCount: u16(b, 142),
      clrCount: u16(b, 146),
      texcoordCount: u16(b, 148),
      triCount: u16(b, 150),
      batchCountMinus1: u16(b, 152),
      texCount: u8(b, 158),
      dlInfoCount: u8(b, 159),
      shaderCount: u8(b, 160)
    };
  }
  function finalInfo(b) {
    return {
      texOff: u32(b, 84),
      posOff: u32(b, 88),
      clrOff: u32(b, 92),
      texcoordOff: u32(b, 96),
      shaderOff: u32(b, 100),
      dlInfoOff: u32(b, 104),
      bitsOff: u32(b, 120),
      bitsCount: u16(b, 132),
      posCount: u16(b, 144),
      clrCount: u16(b, 148),
      texcoordCount: u16(b, 150),
      texCount: u8(b, 160),
      dlInfoCount: u8(b, 161),
      shaderCount: u8(b, 162)
    };
  }
  function earlyTextures(root) {
    const ri = earlyInfo(root);
    const out = [];
    for (let i = 0; i < ri.texCount; i++) {
      const o = ri.texOff + i * 4;
      if (o + 4 <= root.byteLength)
        out.push(u16(root, o + 2));
    }
    return out;
  }
  function finalTextures(root) {
    const fi = finalInfo(root);
    const out = [];
    for (let i = 0; i < fi.texCount; i++) {
      const o = fi.texOff + i * 4;
      if (o + 4 <= root.byteLength)
        out.push(u32(root, o));
    }
    return out;
  }
  function triangles(root) {
    const ri = earlyInfo(root);
    const out = [];
    const maxc = Math.max(0, (root.byteLength - ri.triOff) / 8 | 0);
    for (let i = 0; i < Math.min(ri.triCount, maxc); i++) {
      const o = ri.triOff + i * 8;
      out.push([u16(root, o + 0), u16(root, o + 2), u16(root, o + 4), u16(root, o + 6)]);
    }
    return out;
  }
  function computeY(root, ri) {
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < ri.posCount; i++) {
      const o = ri.posOff + i * 6;
      if (o + 6 <= root.byteLength) {
        const y = s16(root, o + 2);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    return Number.isFinite(minY) ? (minY + maxY) / 2 | 0 : 0;
  }
  function convertedPositions(root, ri, yTranslate) {
    const out = new Uint8Array(ri.posCount * 6);
    for (let i = 0; i < ri.posCount; i++) {
      const src = ri.posOff + i * 6;
      ps16(out, i * 6 + 0, s16(root, src + 0) * 8);
      ps16(out, i * 6 + 2, (s16(root, src + 2) - yTranslate) * 8);
      ps16(out, i * 6 + 4, s16(root, src + 4) * 8);
    }
    return out;
  }
  function colors(root, ri) {
    return root.slice(ri.clrOff, ri.clrOff + ri.clrCount * 2);
  }
  function expandedEarly34Colors(root, ri) {
    const palBytes = colors(root, ri);
    const palCount = palBytes.byteLength >>> 1;
    const dst = new Uint8Array(65536 * 2);
    if (palCount <= 0) {
      dst.fill(255);
      return dst;
    }
    const mask = palCount <= 256 ? 255 : palCount <= 4096 ? 4095 : -1;
    for (let idx = 0; idx < 65536; idx++) {
      let srcIdx = idx & 32767;
      if (mask !== -1)
        srcIdx &= mask;
      if (srcIdx >= palCount)
        srcIdx %= palCount;
      const s = srcIdx << 1;
      const d = idx << 1;
      dst[d + 0] = palBytes[s + 0] ?? 255;
      dst[d + 1] = palBytes[s + 1] ?? 255;
    }
    return dst;
  }
  function colorsForFinalMapOutput(root, ri, sourceInfo) {
    return sourceInfo.expandColorPalette16 ? expandedEarly34Colors(root, ri) : colors(root, ri);
  }
  function texcoords(root, ri) {
    return root.slice(ri.texcoordOff, ri.texcoordOff + ri.texcoordCount * 4);
  }
  class LowBitStreamReader {
    constructor(data, byteOff, byteCount) {
      __publicField(this, "data", data);
      __publicField(this, "byteOff", byteOff);
      __publicField(this, "byteCount", byteCount);
      __publicField(this, "bitIndex", 0);
    }
    canRead(bits) {
      return this.bitIndex + bits <= this.byteCount * 8;
    }
    get(bits) {
      let v = 0;
      for (let i = 0; i < bits; i++) {
        const b = this.data[this.byteOff + (this.bitIndex >>> 3)] ?? 0;
        v |= (b >>> (this.bitIndex & 7) & 1) << i;
        this.bitIndex++;
      }
      return v >>> 0;
    }
    skip(bits) {
      this.bitIndex += bits;
    }
  }
  function tryDecodeEarlyShaderForDLs(root, bitOff, dlCount, shaderCount) {
    const shaderForDL = new Array(dlCount).fill(-1);
    const vcdBitsForDL = new Array(dlCount).fill(5);
    if (bitOff <= 0 || bitOff >= root.byteLength)
      return { shaderForDL, vcdBitsForDL, score: -999999, calls: 0 };
    const maxBytes = Math.min(root.byteLength - bitOff, 16384);
    const br = new LowBitStreamReader(root, bitOff, maxBytes);
    let currentShader = 0;
    let currentVcdBits = 5;
    let calls = 0;
    let invalid = 0;
    let ended = false;
    for (let opCount = 0; opCount < 2e4 && br.canRead(4); opCount++) {
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
        currentVcdBits = br.get(1) | br.get(1) << 1 | br.get(1) << 2;
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
  function decodeEarlyShaderForDLs(root, dlCount, shaderCount, sourceInfo = EARLY1_SOURCE_INFO) {
    const candidates = sourceInfo.bitsOffsets.map((off) => u32(root, off)).filter((v, i, a) => v > 0 && v < root.byteLength && a.indexOf(v) === i);
    let best = {
      shaderForDL: new Array(dlCount).fill(-1),
      vcdBitsForDL: new Array(dlCount).fill(5),
      score: -999999,
      calls: 0,
      bitOff: 0
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
      calls: best.calls
    };
  }
  function readDLIndex(dl, o, size) {
    return size === 2 ? u16(dl, o) : u8(dl, o);
  }
  function buildBitstreamForDLOrder(dlOrder, shaderForDL, vcdBitsForDL, special) {
    if (dlOrder.length === 0)
      return new Uint8Array(0);
    const bw = new LowBitWriter();
    for (const listNum of dlOrder) {
      const shaderNum = shaderForDL[listNum] ?? 0;
      const vcdBits = vcdBitsForDL[listNum] ?? 5;
      special[listNum] = bw.bitIndex;
      bw.put(OP_SET_SHADER, 4);
      bw.put(shaderNum, 6);
      bw.put(OP_SET_VCD, 4);
      bw.put(vcdBits >>> 0 & 1, 1);
      bw.put(vcdBits >>> 1 & 1, 1);
      bw.put(vcdBits >>> 2 & 1, 1);
      bw.put(OP_SET_MATRICES, 4);
      bw.put(1, 4);
      bw.put(0, 8);
      bw.put(OP_CALL_DL, 4);
      bw.put(listNum, 8);
    }
    bw.put(OP_END, 4);
    return bw.bytes();
  }
  function buildFinalBitstreamsForDLOrderByPass(dlOrder, shaderForDL, vcdBitsForDL, passForDL) {
    const special = new Array(shaderForDL.length).fill(0);
    const layerForDL = new Array(shaderForDL.length).fill(0);
    const layerCalls = [[], [], []];
    for (const listNum of dlOrder) {
      const rawPass = passForDL[listNum] ?? 0;
      const pass = rawPass <= 0 ? 0 : rawPass >= 2 ? 2 : 1;
      layerCalls[pass].push(listNum);
      layerForDL[listNum] = pass;
    }
    return {
      bitstreams: [
        buildBitstreamForDLOrder(layerCalls[0], shaderForDL, vcdBitsForDL, special),
        buildBitstreamForDLOrder(layerCalls[1], shaderForDL, vcdBitsForDL, special),
        buildBitstreamForDLOrder(layerCalls[2], shaderForDL, vcdBitsForDL, special)
      ],
      special,
      layerForDL,
      layerCalls
    };
  }
  function decodeEarlyLayerCallOrder(root, bitOff, byteCount, dlCount, shaderCount) {
    const out = [];
    if (bitOff <= 0 || byteCount <= 0 || bitOff >= root.byteLength)
      return out;
    if (bitOff + byteCount > root.byteLength)
      byteCount = root.byteLength - bitOff;
    const br = new LowBitStreamReader(root, bitOff, byteCount);
    for (let opCount = 0; opCount < 2e4 && br.canRead(4); opCount++) {
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
  function buildLayerBitstreamsFromEarlyPasses(root, ri, shaderForDL, vcdBitsForDL, earlyDLIndexes, sourceInfo = EARLY1_SOURCE_INFO, forcedLayerForOutputDL) {
    const earlyDLInfoStride = sourceInfo.dlInfoStride;
    const earlyDLCount = Math.min(
      ri.dlInfoCount,
      Math.max(0, (root.byteLength - ri.dlInfoOff) / earlyDLInfoStride | 0),
      255
    );
    const earlyLayerStreams = [
      { bitOff: u32(root, sourceInfo.bitsOffsets[0]), byteCount: u16(root, sourceInfo.bitsByteCounts[0]) },
      { bitOff: u32(root, sourceInfo.bitsOffsets[1]), byteCount: u16(root, sourceInfo.bitsByteCounts[1]) },
      { bitOff: u32(root, sourceInfo.bitsOffsets[2]), byteCount: u16(root, sourceInfo.bitsByteCounts[2]) }
    ];
    const outputIndexForEarlyDL = new Map();
    for (let outDL = 0; outDL < earlyDLIndexes.length; outDL++)
      outputIndexForEarlyDL.set(earlyDLIndexes[outDL], outDL);
    const layerCalls = [[], [], []];
    const layerForDL = new Array(shaderForDL.length).fill(0);
    const assigned = new Set();
    for (let layer = 0; layer < 3; layer++) {
      const stream = earlyLayerStreams[layer];
      const earlyCalls = decodeEarlyLayerCallOrder(
        root,
        stream.bitOff,
        stream.byteCount,
        earlyDLCount,
        ri.shaderCount
      );
      for (const earlyListNum of earlyCalls) {
        const outListNum = outputIndexForEarlyDL.get(earlyListNum);
        if (outListNum === void 0)
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
    if (forcedLayerForOutputDL !== void 0) {
      for (let outListNum = 0; outListNum < shaderForDL.length; outListNum++) {
        const forcedLayer = forcedLayerForOutputDL[outListNum];
        if (forcedLayer === null || forcedLayer === void 0 || forcedLayer < 0 || forcedLayer > 2) {
          continue;
        }
        for (let layer = 0; layer < 3; layer++) {
          const index = layerCalls[layer].indexOf(outListNum);
          if (index >= 0)
            layerCalls[layer].splice(index, 1);
        }
        layerCalls[forcedLayer].push(outListNum);
        layerForDL[outListNum] = forcedLayer;
      }
    }
    const special = new Array(shaderForDL.length).fill(0);
    const bitstreams = [
      buildBitstreamForDLOrder(layerCalls[0], shaderForDL, vcdBitsForDL, special),
      buildBitstreamForDLOrder(layerCalls[1], shaderForDL, vcdBitsForDL, special),
      buildBitstreamForDLOrder(layerCalls[2], shaderForDL, vcdBitsForDL, special)
    ];
    return { bitstreams, special, layerForDL, layerCalls };
  }
  function buildShaderTable(final, fi, shaderCount, texCount, textureIndexForShader) {
    const proto = new Uint8Array(SHADER_STRIDE);
    if (fi.shaderOff + SHADER_STRIDE <= final.byteLength)
      proto.set(final.slice(fi.shaderOff, fi.shaderOff + SHADER_STRIDE));
    const out = new Uint8Array(shaderCount * SHADER_STRIDE);
    for (let i = 0; i < shaderCount; i++) {
      const sh = new Uint8Array(proto);
      const texSlot = textureIndexForShader?.[i] ?? i % Math.max(1, texCount);
      p32(sh, 36, texSlot % Math.max(1, texCount));
      p32(sh, 64, 100728832);
      out.set(sh, i * SHADER_STRIDE);
    }
    return out;
  }
  function vcdRecordSize(vcdBits, texcoordLayers = 1) {
    const posSize = (vcdBits & 1) !== 0 ? 2 : 1;
    const colorSize = (vcdBits & 2) !== 0 ? 2 : 1;
    const texSize = (vcdBits & 4) !== 0 ? 2 : 1;
    const layerCount = Math.max(1, Math.min(2, texcoordLayers));
    return posSize + colorSize + texSize * layerCount;
  }
  function validateEarly1VcdBits(dl, vcdBits, ri, texcoordLayers = 1) {
    const bits = vcdBits & 7;
    const layerCount = Math.max(1, Math.min(2, texcoordLayers));
    const posSize = (bits & 1) !== 0 ? 2 : 1;
    const colorSize = (bits & 2) !== 0 ? 2 : 1;
    const texSize = (bits & 4) !== 0 ? 2 : 1;
    const recSize = posSize + colorSize + texSize * layerCount;
    let p = 0;
    let prims = 0;
    let verts = 0;
    let invalid = 0;
    let ended = false;
    let structuralError = false;
    while (p < dl.byteLength) {
      const cmd = dl[p];
      if (cmd === 0) {
        ended = true;
        p++;
        break;
      }
      if (p + 3 > dl.byteLength) {
        structuralError = true;
        break;
      }
      const prim = cmd & 248;
      if (prim < 128 || prim > 184) {
        structuralError = true;
        break;
      }
      const count = u16(dl, p + 1);
      p += 3;
      const next = p + count * recSize;
      if (next > dl.byteLength) {
        structuralError = true;
        break;
      }
      for (let i = 0; i < count; i++) {
        let q = p + i * recSize;
        const pos = readDLIndex(dl, q, posSize);
        q += posSize;
        const color = readDLIndex(dl, q, colorSize);
        q += colorSize;
        if (pos >= ri.posCount)
          invalid++;
        if (color >= ri.clrCount)
          invalid++;
        for (let layer = 0; layer < layerCount; layer++) {
          const tex = readDLIndex(dl, q, texSize);
          q += texSize;
          if (tex >= ri.texcoordCount)
            invalid++;
        }
        verts++;
      }
      p = next;
      prims++;
    }
    let trailingNonZero = 0;
    for (let i = p; i < dl.byteLength; i++) {
      if (dl[i] !== 0)
        trailingNonZero++;
    }
    return {
      bits,
      complete: !structuralError && (ended || p === dl.byteLength) && trailingNonZero === 0,
      consumed: p,
      invalid,
      prims,
      verts,
      preferred: false
    };
  }
  function chooseValidatedEarly1VcdBits(dl, decodedVcdBits, ri, texcoordLayers = 1) {
    const preferred = decodedVcdBits & 7;
    const preferredResult = validateEarly1VcdBits(
      dl,
      preferred,
      ri,
      texcoordLayers
    );
    if (preferredResult.complete && preferredResult.invalid === 0 && preferredResult.prims > 0) {
      return preferred;
    }
    const candidates = [
      preferred,
      0,
      1,
      4,
      5,
      2,
      3,
      6,
      7
    ].filter((value, index, array) => array.indexOf(value) === index);
    let best = null;
    for (const bits of candidates) {
      const candidate = validateEarly1VcdBits(
        dl,
        bits,
        ri,
        texcoordLayers
      );
      candidate.preferred = bits === preferred;
      if (best === null) {
        best = candidate;
        continue;
      }
      let useCandidate = false;
      if (candidate.complete !== best.complete) {
        useCandidate = candidate.complete;
      } else if (candidate.invalid !== best.invalid) {
        useCandidate = candidate.invalid < best.invalid;
      } else if (candidate.prims > 0 !== best.prims > 0) {
        useCandidate = candidate.prims > 0;
      } else if (candidate.verts !== best.verts) {
        useCandidate = candidate.verts > best.verts;
      } else if (candidate.prims !== best.prims) {
        useCandidate = candidate.prims > best.prims;
      } else if (candidate.consumed !== best.consumed) {
        useCandidate = candidate.consumed > best.consumed;
      } else {
        useCandidate = candidate.preferred && !best.preferred;
      }
      if (useCandidate)
        best = candidate;
    }
    return best?.bits ?? preferred;
  }
  function retagDisplayListToVat5(dlIn, vcdBits, trimAtStop = false, zeroIsNop = false, texcoordLayers = 1) {
    const out = copyU8(dlIn);
    const recSize = vcdRecordSize(vcdBits, texcoordLayers);
    let p = 0;
    const finish = (trimEnd) => {
      return trimAtStop ? out.slice(0, Math.max(0, trimEnd)) : out;
    };
    while (p < out.byteLength) {
      const cmdOff = p;
      const cmd = out[p];
      if (cmd === 0) {
        if (zeroIsNop) {
          p++;
          continue;
        }
        return finish(cmdOff + 1);
      }
      if (p + 3 > out.byteLength)
        return finish(cmdOff);
      const prim = cmd & 248;
      if (prim < 128 || prim > 184)
        return finish(cmdOff);
      out[p++] = prim | 5;
      const count = u16(out, p);
      p += 2;
      const next = p + count * recSize;
      if (next > out.byteLength)
        return finish(cmdOff);
      p = next;
    }
    return finish(p);
  }
  function writeDLIndex(out, value, size) {
    if (size === 2) {
      out.push(value >>> 8 & 255, value & 255);
    } else {
      out.push(value & 255);
    }
  }
  function compactEarly4ColorIndex(color, ri) {
    const count = Math.max(1, ri.clrCount);
    const lo = color & 255;
    if (lo < count)
      return lo;
    const hi = color >>> 8 & 255;
    if (hi < count)
      return hi;
    return color % count;
  }
  function repackDisplayListToVat5(dlIn, readVcdBits, writeVcdBits, ri, compactColor, zeroIsNop = false, texcoordLayers = 1) {
    const layerCount = Math.max(1, Math.min(2, texcoordLayers));
    const readPosSize = (readVcdBits & 1) !== 0 ? 2 : 1;
    const readColorSize = (readVcdBits & 2) !== 0 ? 2 : 1;
    const readTexSize = (readVcdBits & 4) !== 0 ? 2 : 1;
    const readRecSize = readPosSize + readColorSize + readTexSize * layerCount;
    const writePosSize = (writeVcdBits & 1) !== 0 ? 2 : 1;
    const writeColorSize = (writeVcdBits & 2) !== 0 ? 2 : 1;
    const writeTexSize = (writeVcdBits & 4) !== 0 ? 2 : 1;
    const out = [];
    let p = 0;
    let prims = 0;
    let verts = 0;
    let compactedColors = 0;
    while (p + 3 <= dlIn.byteLength) {
      const cmd = dlIn[p];
      if (cmd === 0) {
        out.push(0);
        p++;
        if (zeroIsNop)
          continue;
        return {
          dl: new Uint8Array(out),
          ok: true,
          log: `repackOK/prims=${prims}/verts=${verts}/colors=${compactedColors}/texLayers=${layerCount}/old=0x${dlIn.byteLength.toString(16)}/new=0x${out.length.toString(16)}`
        };
      }
      const prim = cmd & 248;
      if (prim < 128 || prim > 184) {
        return {
          dl: retagDisplayListToVat5(
            dlIn,
            readVcdBits,
            true,
            zeroIsNop,
            layerCount
          ),
          ok: false,
          log: `repackBAD/badPrim=0x${prim.toString(16)}@0x${p.toString(16)}/texLayers=${layerCount}/keptReadVcd/old=0x${dlIn.byteLength.toString(16)}`
        };
      }
      const count = u16(dlIn, p + 1);
      p += 3;
      const next = p + count * readRecSize;
      if (next > dlIn.byteLength) {
        return {
          dl: retagDisplayListToVat5(
            dlIn,
            readVcdBits,
            true,
            zeroIsNop,
            layerCount
          ),
          ok: false,
          log: `repackBAD/oob@0x${p.toString(16)}/count=${count}/readRec=${readRecSize}/texLayers=${layerCount}/end=0x${next.toString(16)}/len=0x${dlIn.byteLength.toString(16)}/keptReadVcd`
        };
      }
      out.push(prim | 5);
      out.push(count >>> 8 & 255, count & 255);
      for (let i = 0; i < count; i++) {
        let q = p + i * readRecSize;
        const pos = readDLIndex(dlIn, q, readPosSize);
        q += readPosSize;
        const rawColor = readDLIndex(dlIn, q, readColorSize);
        q += readColorSize;
        const texIndexes = [];
        for (let layer = 0; layer < layerCount; layer++) {
          texIndexes.push(
            readDLIndex(dlIn, q, readTexSize)
          );
          q += readTexSize;
        }
        const color = compactColor ? compactEarly4ColorIndex(rawColor, ri) : rawColor;
        if (compactColor && color !== rawColor)
          compactedColors++;
        writeDLIndex(out, pos, writePosSize);
        writeDLIndex(out, color, writeColorSize);
        for (const tex of texIndexes)
          writeDLIndex(out, tex, writeTexSize);
        verts++;
      }
      p = next;
      prims++;
    }
    return {
      dl: new Uint8Array(out),
      ok: true,
      log: `repackOK/noEnd/prims=${prims}/verts=${verts}/colors=${compactedColors}/texLayers=${layerCount}/old=0x${dlIn.byteLength.toString(16)}/new=0x${out.length.toString(16)}`
    };
  }
  function debugVcdName(vcdBits) {
    const v = vcdBits & 7;
    return `0x${v.toString(16)}/p${(v & 1) !== 0 ? 16 : 8}c${(v & 2) !== 0 ? 16 : 8}t${(v & 4) !== 0 ? 16 : 8}`;
  }
  function debugRangeForLog(min, max) {
    return min <= max ? `${min}-${max}` : `none`;
  }
  function debugScanEarly4DLForLog(dl, vcdBits, ri, texcoordLayers = 1) {
    const layerCount = Math.max(1, Math.min(2, texcoordLayers));
    const posSize = (vcdBits & 1) !== 0 ? 2 : 1;
    const colorSize = (vcdBits & 2) !== 0 ? 2 : 1;
    const texSize = (vcdBits & 4) !== 0 ? 2 : 1;
    const recSize = posSize + colorSize + texSize * layerCount;
    let p = 0;
    let prims = 0;
    let verts = 0;
    let ended = false;
    let stop = "eof";
    let firstCmd = -1;
    let badPos = 0;
    let badColor = 0;
    let badTex = 0;
    let posMin = 2147483647;
    let posMax = -1;
    let colorMin = 2147483647;
    let colorMax = -1;
    let texMin = 2147483647;
    let texMax = -1;
    while (p + 3 <= dl.byteLength) {
      const cmd = dl[p];
      if (firstCmd < 0)
        firstCmd = cmd;
      if (cmd === 0) {
        p++;
        continue;
      }
      const prim = cmd & 248;
      if (prim < 128 || prim > 184) {
        stop = `badPrim0x${prim.toString(16)}@0x${p.toString(16)}`;
        break;
      }
      const count = u16(dl, p + 1);
      p += 3;
      const next = p + count * recSize;
      if (next > dl.byteLength) {
        stop = `vertexOOB@0x${p.toString(16)} count=${count} rec=${recSize} layers=${layerCount} end=0x${next.toString(16)} len=0x${dl.byteLength.toString(16)}`;
        break;
      }
      for (let i = 0; i < count; i++) {
        let q = p + i * recSize;
        const pos = readDLIndex(dl, q, posSize);
        q += posSize;
        const color = readDLIndex(dl, q, colorSize);
        q += colorSize;
        verts++;
        posMin = Math.min(posMin, pos);
        posMax = Math.max(posMax, pos);
        colorMin = Math.min(colorMin, color);
        colorMax = Math.max(colorMax, color);
        if (pos >= ri.posCount)
          badPos++;
        const colorLimit = colorSize === 2 ? 65536 : ri.clrCount;
        if (color >= colorLimit)
          badColor++;
        for (let layer = 0; layer < layerCount; layer++) {
          const tex = readDLIndex(dl, q, texSize);
          q += texSize;
          texMin = Math.min(texMin, tex);
          texMax = Math.max(texMax, tex);
          if (tex >= ri.texcoordCount)
            badTex++;
        }
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
      firstCmd
    };
  }
  function early4ParseConsumesWholeDL(dl, stats) {
    const consumed = Math.min(
      dl.byteLength,
      stats.ended ? stats.parsedBytes + 1 : stats.parsedBytes
    );
    if (!stats.ended && stats.stop !== "eof")
      return false;
    for (let i = consumed; i < dl.byteLength; i++) {
      if (dl[i] !== 0)
        return false;
    }
    return true;
  }
  function chooseValidatedEarly4VcdBits(dl, decodedVcdBits, ri, texcoordLayers = 1) {
    const preferred = decodedVcdBits & 7;
    const candidates = [
      preferred,
      0,

      1,

      4,

      5,

      2,

      3,

      6,

      7

    ].filter((value, index, array) => array.indexOf(value) === index);
    let best = null;
    for (const bits of candidates) {
      const stats = debugScanEarly4DLForLog(
        dl,
        bits,
        ri,
        texcoordLayers
      );
      const candidate = {
        bits,
        complete: early4ParseConsumesWholeDL(dl, stats),
        consumed: Math.min(
          dl.byteLength,
          stats.ended ? stats.parsedBytes + 1 : stats.parsedBytes
        ),
        invalid: stats.badPos + stats.badColor + stats.badTex,
        prims: stats.prims,
        verts: stats.verts,
        preferred: bits === preferred
      };
      if (best === null) {
        best = candidate;
        continue;
      }
      let useCandidate = false;
      if (candidate.complete !== best.complete) {
        useCandidate = candidate.complete;
      } else if (!candidate.complete) {
        if (candidate.consumed !== best.consumed)
          useCandidate = candidate.consumed > best.consumed;
        else if (candidate.invalid !== best.invalid)
          useCandidate = candidate.invalid < best.invalid;
        else if (candidate.verts !== best.verts)
          useCandidate = candidate.verts > best.verts;
        else if (candidate.prims !== best.prims)
          useCandidate = candidate.prims > best.prims;
        else
          useCandidate = candidate.preferred && !best.preferred;
      } else {
        if (candidate.invalid !== best.invalid)
          useCandidate = candidate.invalid < best.invalid;
        else if (candidate.verts !== best.verts)
          useCandidate = candidate.verts > best.verts;
        else if (candidate.prims !== best.prims)
          useCandidate = candidate.prims > best.prims;
        else if (candidate.consumed !== best.consumed)
          useCandidate = candidate.consumed > best.consumed;
        else
          useCandidate = candidate.preferred && !best.preferred;
      }
      if (useCandidate)
        best = candidate;
    }
    return best?.bits ?? preferred;
  }
  function debugEarly4DLStatsForLog(s) {
    return `prim=${s.prims}/verts=${s.verts}/end=${s.ended ? 1 : 0}/stop=${s.stop}/trail=0x${s.trailingBytes.toString(16)}/badPCT=${s.badPos}/${s.badColor}/${s.badTex}/pos=${debugRangeForLog(s.posMin, s.posMax)}/clr=${debugRangeForLog(s.colorMin, s.colorMax)}/tex=${debugRangeForLog(s.texMin, s.texMax)}/first=0x${Math.max(0, s.firstCmd).toString(16)}`;
  }
  function debugNumberSetForLog(set) {
    const xs = [...set].sort((a, b) => a - b);
    return xs.length > 0 ? xs.join("/") : "none";
  }
  function debugMissingLayerCallsForLog(copiedCount, layerCalls) {
    const called = new Set();
    for (const layer of layerCalls) {
      for (const dl of layer)
        called.add(dl);
    }
    const missing = [];
    for (let i = 0; i < copiedCount; i++) {
      if (!called.has(i))
        missing.push(i);
    }
    return missing.length > 0 ? missing.join("/") : "none";
  }
  function boundsForAllPositions(root, ri, yTranslate) {
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
  function boundsFromEarlyDLInfo(root, infoOff, yTranslate, fallback) {
    if (infoOff + 18 > root.byteLength)
      return fallback;
    const x0 = s16(root, infoOff + 6);
    const y0 = s16(root, infoOff + 8);
    const z0 = s16(root, infoOff + 10);
    const x1 = s16(root, infoOff + 12);
    const y1 = s16(root, infoOff + 14);
    const z1 = s16(root, infoOff + 16);
    if (x0 === 0 && y0 === 0 && z0 === 0 && x1 === 0 && y1 === 0 && z1 === 0)
      return fallback;
    const ax = x0 * 8;
    const ay = (y0 - yTranslate) * 8;
    const az = z0 * 8;
    const bx = x1 * 8;
    const by = (y1 - yTranslate) * 8;
    const bz = z1 * 8;
    const pad = 32;
    return [
      Math.min(ax, bx) - pad,
      Math.min(ay, by) - pad,
      Math.min(az, bz) - pad,
      Math.max(ax, bx) + pad,
      Math.max(ay, by) + pad,
      Math.max(az, bz) + pad
    ];
  }
  const FINAL_SHADER_CULL_BACKFACE = 8;
  const FINAL_SHADER_REFLECT_SKY = 32;
  const FINAL_SHADER_REFLECTIVE = 256;
  const FINAL_SHADER_ALPHA_COMPARE = 1024;
  const FINAL_SHADER_SHORT_FUR = 16384;
  const FINAL_SHADER_MEDIUM_FUR = 32768;
  const FINAL_SHADER_WATER = 2147483648;
  const FINAL_SHADER_TRUE_TRANS = 1073741824;
  const FINAL_SHADER_WATER_EXTRA = 5767168;
  const FINAL_SHADER_TRANSLUCENT = 1610612736;
  const EARLY1_STRONG_WATER_TEXIDS = new Set([
    788,
    899,
    2871,
    1392,
    24,
    1391,
    2373
  ]);
  const EARLY1_CANDIDATE_WATER_TEXIDS = new Set([
    899,
    2871,
    2373,
    788
  ]);
  const EARLY1_LAYER2_WATER_PROMOTE_TEXIDS = new Set([
    788,
    899,
    2871,
    2373,
    2638,
    2640
  ]);
  const EARLY1_STRONG_TRANSLUCENT_TEXIDS = new Set([
    998,
    1005,
    1007,
    668,
    157,
    177
  ]);
  const EARLY1_CANDIDATE_TRANSLUCENT_TEXIDS = new Set([
    7,
    1156,
    668,
    157,
    177
  ]);
  const EARLY1_KNOWN_CUTOUT_TEXIDS = new Set([
    1692,
    1135,
    1695,
    1131,
    176,
    783,
    785,
    549,
    177,
    526,
    525,
    982,
    536,
    1294,
    1295,
    418,
    88,
    571,
    44,
    668,
    417,
    2090,
    568,
    567,
    638,
    810,
    2094,
    691,
    944,
    7,
    769,
    767,
    1156,
    996,
    811,
    2056,
    189,
    630,
    646,
    672,
    1094,
    1098,
    1103,
    1107,
    1110,
    1111,
    1112
  ]);
  const ANCIENT_KNOWN_BLEND_TEXIDS = new Set([
    584
  ]);
  const ANCIENT_KNOWN_WATER_TEXIDS = new Set([
    918,
    788,
    2373,
    2794,
    24,
    2871,
    713,
    2793
  ]);
  const ANCIENT_KNOWN_CUTOUT_TEXIDS = new Set([
    630,
    646,
    672,
    1094,
    1098,
    1103,
    1107,
    1110,
    1111,
    1112,
    928,
    791,
    430,
    573,
    575,
    576,
    577,
    2882,
    44,
    2046,
    2228,
    2467,
    2538,
    1798,
    2791,
    574,
    684,
    96,
    740,
    0,
    595,
    596,
    593,
    594,
    592,
    589,
    1701,
    572,
    578,
    580,
    582,
    583,
    708,
    790,
    927,
    928,
    430,
    431,
    432,
    707,
    1680,
    2060,
    87,
    88,
    89,
    90,
    91,
    92,
    93,
    94,
    95,
    96,
    97,
    98,
    99,
    100,
    101,
    102,
    103,
    106,
    107,
    108,
    109,
    456,
    457,
    458,
    459,
    460,
    1926,
    1943
  ]);
  function texIdInSet(set, ...ids) {
    for (const id of ids) {
      if (id !== null && set.has(id))
        return true;
    }
    return false;
  }
  function normalizeEarly1LayerTex(field, srcTex, mappedTex) {
    if (field === 4294967295)
      return { slot: null, rawId: null, mappedId: null };
    if (field >= 0 && field < srcTex.length) {
      return {
        slot: field,
        rawId: srcTex[field] ?? null,
        mappedId: mappedTex[field] ?? null
      };
    }
    const rawSlot = srcTex.indexOf(field);
    if (rawSlot >= 0) {
      return {
        slot: rawSlot,
        rawId: srcTex[rawSlot] ?? null,
        mappedId: mappedTex[rawSlot] ?? null
      };
    }
    const mappedSlot = mappedTex.indexOf(field);
    if (mappedSlot >= 0) {
      return {
        slot: mappedSlot,
        rawId: srcTex[mappedSlot] ?? null,
        mappedId: mappedTex[mappedSlot] ?? null
      };
    }
    return { slot: null, rawId: null, mappedId: null };
  }
  function convertEarly1ShaderFlagsToFinal(raw16, tex0Raw, tex1Raw, tex0Mapped, tex1Mapped, tev0, tev1, numLayers) {
    let flags = 0;
    const rawAlphaCompare = (raw16 & 64) !== 0 || (raw16 & 256) !== 0;
    if (raw16 & 4) flags |= 4;
    if (raw16 & 8) flags |= FINAL_SHADER_CULL_BACKFACE;
    if (raw16 & 32) flags |= FINAL_SHADER_REFLECT_SKY;
    if (rawAlphaCompare) flags |= FINAL_SHADER_ALPHA_COMPARE;
    if (raw16 & 16384) flags |= FINAL_SHADER_SHORT_FUR;
    if (raw16 & 32768) flags |= FINAL_SHADER_MEDIUM_FUR;
    if (raw16 & 2048) flags |= 2048;
    if (raw16 & 4096) flags |= 4096;
    const lowNib = raw16 & 15;
    const tm0 = tev0 & 127;
    const tm1 = tev1 & 127;
    const singleLayer = numLayers <= 1 || tex1Raw === null;
    const hasTex0 = tex0Raw !== null || tex0Mapped !== null;
    const waterByStrongTex = texIdInSet(EARLY1_STRONG_WATER_TEXIDS, tex0Raw, tex1Raw, tex0Mapped, tex1Mapped);
    const waterByCandidateTex = singleLayer && hasTex0 && (lowNib === 12 || lowNib === 13) && texIdInSet(EARLY1_CANDIDATE_WATER_TEXIDS, tex0Raw, tex0Mapped);
    if (waterByStrongTex || waterByCandidateTex) {
      flags |= FINAL_SHADER_WATER | FINAL_SHADER_TRUE_TRANS | FINAL_SHADER_WATER_EXTRA;
      flags &= ~FINAL_SHADER_ALPHA_COMPARE;
    }
    const effectByStrongTex = texIdInSet(EARLY1_STRONG_TRANSLUCENT_TEXIDS, tex0Raw, tex1Raw);
    const effectByCandidateTex = singleLayer && hasTex0 && (lowNib === 4 || lowNib === 12 || lowNib === 14) && texIdInSet(EARLY1_CANDIDATE_TRANSLUCENT_TEXIDS, tex0Raw);
    if ((flags & FINAL_SHADER_WATER) === 0 && (effectByStrongTex || effectByCandidateTex)) {
      flags |= FINAL_SHADER_TRANSLUCENT;
      flags &= ~FINAL_SHADER_ALPHA_COMPARE;
    } else {
      const tevPlain = tm0 === 0 || tm0 === 1 || tm0 === 2;
      if ((flags & FINAL_SHADER_WATER) === 0 && (flags & FINAL_SHADER_TRANSLUCENT) === 0 && singleLayer && hasTex0 && tevPlain && texIdInSet(EARLY1_KNOWN_CUTOUT_TEXIDS, tex0Raw)) {
        flags |= FINAL_SHADER_ALPHA_COMPARE;
      }
    }
    return flags >>> 0;
  }
  function convertEarly3ShaderFlagsToFinal(raw16) {
    let flags = raw16 & 8191 & ~32;
    if ((raw16 & 8192) !== 0)
      flags |= 536870912;
    if ((raw16 & 16384) !== 0)
      flags |= FINAL_SHADER_TRUE_TRANS;
    const isWater = (raw16 & 49152) === 49152;
    if (isWater) {
      flags |= FINAL_SHADER_WATER | FINAL_SHADER_TRUE_TRANS | FINAL_SHADER_WATER_EXTRA;
      flags &= ~FINAL_SHADER_ALPHA_COMPARE;
    } else if ((raw16 & 16384) !== 0 && (raw16 & 16) !== 0) {
      flags &= ~16;
      flags |= FINAL_SHADER_REFLECTIVE;
    }
    return flags >>> 0;
  }
  function buildFinalShaderTableFromEarly1(root, ri, shaderCount, texCount, srcTex, mappedTex) {
    const out = new Uint8Array(shaderCount * SHADER_STRIDE);
    const earlyShaderStride = 64;
    for (let i = 0; i < shaderCount; i++) {
      const src = ri.shaderOff + i * earlyShaderStride;
      const dst = i * SHADER_STRIDE;
      if (src + earlyShaderStride > root.byteLength) {
        p32(out, dst + 36, i % Math.max(1, texCount));
        p8(out, dst + 40, 0);
        p8(out, dst + 41, 0);
        p8(out, dst + 42, 0);
        p32(out, dst + 60, 0);
        p8(out, dst + 64, 4);
        p8(out, dst + 65, 1);
        p8(out, dst + 66, 0);
        p8(out, dst + 67, 0);
        continue;
      }
      out.set(root.subarray(src, src + earlyShaderStride), dst);
      const numLayers = Math.max(0, Math.min(2, u8(root, src + 59)));
      const rawFlags = u16(root, src + 56);
      let attr = u8(root, src + 58);
      const tex0Slot = u32(out, dst + 36);
      const tex1Slot = u32(out, dst + 44);
      const tex0Info = numLayers > 0 ? normalizeEarly1LayerTex(tex0Slot, srcTex, mappedTex) : { slot: null, rawId: null, mappedId: null };
      const tex1Info = numLayers > 1 ? normalizeEarly1LayerTex(tex1Slot, srcTex, mappedTex) : { slot: null, rawId: null, mappedId: null };
      const tex0Raw = tex0Info.rawId;
      const tex1Raw = tex1Info.rawId;
      const tex0Mapped = tex0Info.mappedId;
      const tex1Mapped = tex1Info.mappedId;
      const tev0 = u8(root, src + 40);
      const tev1 = u8(root, src + 48);
      if (numLayers > 0 && tex0Slot !== 4294967295 && tex0Slot < texCount)
        attr |= 4;
      if (numLayers > 1 && tex1Slot !== 4294967295 && tex1Slot < texCount)
        attr |= 8;
      if ((attr & 13) === 0)
        attr |= 1;
      const finalFlags = convertEarly1ShaderFlagsToFinal(
        rawFlags,
        tex0Raw,
        tex1Raw,
        tex0Mapped,
        tex1Mapped,
        tev0,
        tev1,
        numLayers
      );
      p32(out, dst + 52, 4294967295);
      p32(out, dst + 56, 4294967295);
      p32(out, dst + 60, finalFlags);
      if ((finalFlags & FINAL_SHADER_TRANSLUCENT) !== 0 && (finalFlags & FINAL_SHADER_WATER) === 0) {
        p8(out, dst + 40, tev0 & 127);
        p8(out, dst + 48, tev1 & 127);
      }
      if ((finalFlags & (FINAL_SHADER_WATER | FINAL_SHADER_TRANSLUCENT | FINAL_SHADER_ALPHA_COMPARE)) !== 0) {
        console.warn(
          `[EARLY1 SHADER CONVERT] shader=${i} raw16=0x${rawFlags.toString(16)} lowNib=0x${(rawFlags & 15).toString(16)} layers=${numLayers} tex0Slot=${tex0Slot} tex1Slot=${tex1Slot} tex0Raw=${tex0Raw} tex1Raw=${tex1Raw} tev0=0x${tev0.toString(16)} tev1=0x${tev1.toString(16)} finalFlags=0x${finalFlags.toString(16)}`
        );
      }
      p8(out, dst + 64, attr);
      p8(out, dst + 65, numLayers);
      p8(out, dst + 66, 0);
      p8(out, dst + 67, 0);
    }
    return out;
  }
  function buildFinalShaderTableFromEarly3(root, ri, shaderCount, texCount, srcTex, mappedTex) {
    const out = new Uint8Array(shaderCount * SHADER_STRIDE);
    const earlyShaderStride = 68;
    for (let i = 0; i < shaderCount; i++) {
      const src = ri.shaderOff + i * earlyShaderStride;
      const dst = i * SHADER_STRIDE;
      let rawFlags = FINAL_SHADER_CULL_BACKFACE;
      let sourceAttr = 6;
      let numLayersIn = texCount > 0 ? 1 : 0;
      let tev0 = 0;
      let tev1 = 0;
      if (src + earlyShaderStride <= root.byteLength) {
        out.set(
          root.subarray(
            src,
            src + earlyShaderStride
          ),
          dst
        );
        rawFlags = u16(root, src + 60);
        sourceAttr = u8(root, src + 62);
        numLayersIn = Math.max(
          0,
          Math.min(
            2,
            u8(root, src + 63)
          )
        );
        tev0 = u8(root, src + 40);
        tev1 = u8(root, src + 48);
      } else {
        p32(
          out,
          dst + 36,
          i % Math.max(1, texCount)
        );
        p32(out, dst + 44, 4294967295);
      }
      let attr = sourceAttr & 1 | 2;
      let numLayersOut = 0;
      for (let layer = 0; layer < 2; layer++) {
        const layerOff = dst + 36 + layer * 8;
        const rawField = u32(
          out,
          layerOff + 0
        );
        const texInfo = normalizeEarly1LayerTex(
          rawField,
          srcTex,
          mappedTex
        );
        const slot = texInfo.slot;
        if (layer < numLayersIn && slot !== null && slot >= 0 && slot < texCount) {
          p32(
            out,
            layerOff + 0,
            slot
          );
          numLayersOut = layer + 1;
        } else {
          p32(
            out,
            layerOff + 0,
            4294967295
          );
          p8(out, layerOff + 4, 0);
          p8(out, layerOff + 5, 0);
          p8(out, layerOff + 6, 0);
          p8(out, layerOff + 7, 0);
        }
      }
      if (numLayersOut === 0 && texCount > 0) {
        p32(
          out,
          dst + 36,
          i % texCount
        );
        p8(out, dst + 40, 0);
        p8(out, dst + 41, 0);
        p8(out, dst + 42, 0);
        p8(out, dst + 43, 0);
        numLayersOut = 1;
      }
      const tex0Slot = u32(out, dst + 36);
      const tex1Slot = u32(out, dst + 44);
      const tex0Info = numLayersOut > 0 ? normalizeEarly1LayerTex(tex0Slot, srcTex, mappedTex) : { slot: null, rawId: null, mappedId: null };
      const tex1Info = numLayersOut > 1 ? normalizeEarly1LayerTex(tex1Slot, srcTex, mappedTex) : { slot: null, rawId: null, mappedId: null };
      const finalFlags = convertEarly3ShaderFlagsToFinal(rawFlags);
      p32(out, dst + 52, 4294967295);
      p32(out, dst + 56, 4294967295);
      p32(out, dst + 60, finalFlags);
      if (numLayersOut > 0)
        attr |= 4;
      attr &= 7;
      p8(out, dst + 64, attr);
      p8(out, dst + 65, numLayersOut);
      p8(out, dst + 66, 0);
      p8(out, dst + 67, 0);
      if ((finalFlags & (FINAL_SHADER_WATER | FINAL_SHADER_TRANSLUCENT | FINAL_SHADER_ALPHA_COMPARE)) !== 0) {
        console.warn(
          `[EARLY3 SHADER CONVERT] shader=${i} raw16=0x${rawFlags.toString(16)} lowNib=0x${(rawFlags & 15).toString(16)} layers=${numLayersOut} tex0Raw=${tex0Info.rawId} tex1Raw=${tex1Info.rawId} tex0Mapped=${tex0Info.mappedId} tex1Mapped=${tex1Info.mappedId} tev0=0x${tev0.toString(16)} tev1=0x${tev1.toString(16)} finalFlags=0x${finalFlags.toString(16)}`
        );
      }
    }
    return out;
  }
  function buildFinalShaderTableFromEarly4(root, ri, shaderCount, texCount, srcTex, mappedTex) {
    const out = new Uint8Array(shaderCount * SHADER_STRIDE);
    const earlyShaderStride = SHADER_STRIDE;
    for (let i = 0; i < shaderCount; i++) {
      const src = ri.shaderOff + i * earlyShaderStride;
      const dst = i * SHADER_STRIDE;
      if (src + earlyShaderStride <= root.byteLength) {
        out.set(
          root.subarray(
            src,
            src + earlyShaderStride
          ),
          dst
        );
      } else {
        p32(
          out,
          dst + 36,
          i % Math.max(1, texCount)
        );
        p32(out, dst + 44, 4294967295);
        p32(out, dst + 52, 4294967295);
        p32(out, dst + 56, 4294967295);
        p32(out, dst + 60, FINAL_SHADER_CULL_BACKFACE);
        p8(out, dst + 64, 6);
        p8(out, dst + 65, 1);
        p8(out, dst + 66, 0);
        p8(out, dst + 67, 0);
      }
      const sourceAttr = u8(
        out,
        dst + 64
      );
      let attr = sourceAttr & 1 | 2;
      const numLayersIn = Math.max(
        0,
        Math.min(
          2,
          u8(out, dst + 65)
        )
      );
      let numLayersOut = 0;
      for (let layer = 0; layer < 2; layer++) {
        const layerOff = dst + 36 + layer * 8;
        const rawField = u32(
          out,
          layerOff + 0
        );
        const texInfo = normalizeEarly1LayerTex(
          rawField,
          srcTex,
          mappedTex
        );
        const slot = texInfo.slot;
        if (layer < numLayersIn && slot !== null && slot >= 0 && slot < texCount) {
          p32(
            out,
            layerOff + 0,
            slot
          );
          numLayersOut = layer + 1;
        } else {
          p32(
            out,
            layerOff + 0,
            4294967295
          );
          p8(out, layerOff + 4, 0);
          p8(out, layerOff + 5, 0);
          p8(out, layerOff + 6, 0);
          p8(out, layerOff + 7, 0);
        }
      }
      if (numLayersOut === 0 && texCount > 0) {
        p32(
          out,
          dst + 36,
          i % texCount
        );
        p8(out, dst + 40, 0);
        p8(out, dst + 41, 0);
        p8(out, dst + 42, 0);
        p8(out, dst + 43, 0);
        numLayersOut = 1;
      }
      p32(out, dst + 52, 4294967295);
      p32(out, dst + 56, 4294967295);
      if (numLayersOut > 0)
        attr |= 4;
      attr &= 7;
      p8(out, dst + 64, attr);
      p8(out, dst + 65, numLayersOut);
      p8(out, dst + 66, 0);
      p8(out, dst + 67, 0);
    }
    return out;
  }
  function patchEarly4BackfaceCullForDebug(shaderTable, shaderCount) {
    const touched = [];
    for (let shader = 0; shader < shaderCount; shader++) {
      const off = shader * SHADER_STRIDE;
      if (off + SHADER_STRIDE > shaderTable.byteLength)
        continue;
      const before = u32(shaderTable, off + 60);
      const after = (before & ~FINAL_SHADER_CULL_BACKFACE) >>> 0;
      if (before !== after) {
        p32(shaderTable, off + 60, after);
        touched.push(
          `sh${shader}/flags=0x${before.toString(16)}->0x${after.toString(16)}/attr=0x${u8(shaderTable, off + 64).toString(16)}/layers=${u8(shaderTable, off + 65)}/tex0=${u32(shaderTable, off + 36)}/tex1=${u32(shaderTable, off + 44)}`
        );
      }
    }
    return touched.length > 0 ? `early4CullDebug=clearedBackfaceCull[${touched.join(",")}]` : `early4CullDebug=noBackfaceCullBits`;
  }
  function patchLayer2WaterFlagsInShaderTable(shaderTable, root, ri, shaderForDL, layerForDL, srcTex, mappedTex) {
    const earlyShaderStride = 64;
    const touched = [];
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
      const rawFlags = u16(root, src + 56);
      const lowNib = rawFlags & 15;
      const tev0 = u8(root, src + 40);
      const numLayers = Math.max(0, Math.min(2, u8(root, src + 59)));
      const tex0Slot = u32(shaderTable, dst + 36);
      const tex0Info = numLayers > 0 ? normalizeEarly1LayerTex(tex0Slot, srcTex, mappedTex) : { slot: null, rawId: null, mappedId: null };
      const alreadyWater = (u32(shaderTable, dst + 60) & FINAL_SHADER_WATER) !== 0;
      const layer2Water = alreadyWater || numLayers > 0 && (tev0 & 128) !== 0 && (lowNib === 12 || lowNib === 13) && texIdInSet(EARLY1_LAYER2_WATER_PROMOTE_TEXIDS, tex0Info.rawId, tex0Info.mappedId);
      if (!layer2Water)
        continue;
      let flags = u32(shaderTable, dst + 60);
      flags |= FINAL_SHADER_WATER | FINAL_SHADER_TRUE_TRANS | FINAL_SHADER_WATER_EXTRA;
      flags &= ~FINAL_SHADER_ALPHA_COMPARE;
      p32(shaderTable, dst + 60, flags >>> 0);
      p8(shaderTable, dst + 64, u8(shaderTable, dst + 64) | 4);
      if (u8(shaderTable, dst + 65) === 0)
        p8(shaderTable, dst + 65, 1);
      touched.push(
        `dl${dl}/shader${shader}/raw16=0x${rawFlags.toString(16)}/texRaw=${tex0Info.rawId}/texMapped=${tex0Info.mappedId}/flags=0x${(flags >>> 0).toString(16)}`
      );
    }
    return touched.length > 0 ? `layer2WaterFlags=[${touched.join(",")}]` : `layer2WaterFlags=none`;
  }
  function validMappedTextureOrSource(mapped, sourceTexId) {
    return mapped !== null && mapped !== 5555 ? mapped : sourceTexId;
  }
  const EARLY1_SWAPHOL_KIOSK_TEXTURE_REMAP = {
    93: 1038,
    384: 556,
    385: 1042,
    386: 552,
    545: 544,
    547: 537,
    548: 548,
    549: 539,
    551: 541,
    552: 542,
    556: 552,
    557: 543,
    558: 554,
    559: 1038,
    637: 538,
    690: 548,
    691: 549,
    718: 555,
    723: 558,
    810: 558,
    817: 546,
    942: 544,
    946: 1042,
    947: 546,
    948: 546,
    952: 553,
    956: 556,
    2640: 557
  };
  const EARLY1_NWASTES_KIOSK_TEXTURE_REMAP = {
    5: 941,

    536: 937,

    946: 917,

    948: 933,

    2635: 969

  };
  const EARLY1_NWASTES_PASS1_RAW_TEXIDS = new Set([
    5,
    536,
    946,
    948,
    998,
    1005,
    2635
  ]);
  function readEarly1RawTextureIdsForShader(root, ri, shader, srcTex) {
    const src = ri.shaderOff + shader * 64;
    if (shader < 0 || src < 0 || src + 64 > root.byteLength)
      return [];
    const numLayers = Math.max(0, Math.min(2, u8(root, src + 59)));
    const out = [];
    for (let layer = 0; layer < numLayers; layer++) {
      const field = u32(root, src + 36 + layer * 8);
      if (field !== 4294967295 && field >= 0 && field < srcTex.length)
        out.push(srcTex[field]);
    }
    return out;
  }
  function buildEarly1NorthernWastesForcedLayers(modelId, earlyMapFormat, root, ri, shaderForDL, srcTex) {
    if (modelId !== 15 || earlyMapFormat !== "early1_raw")
      return void 0;
    return shaderForDL.map((shader) => {
      const rawTexIds = readEarly1RawTextureIdsForShader(
        root,
        ri,
        shader,
        srcTex
      );
      return rawTexIds.some(
        (texId) => EARLY1_NWASTES_PASS1_RAW_TEXIDS.has(texId)
      ) ? 1 : null;
    });
  }
  function patchEarly1NorthernWastesMaterialsInShaderTable(modelId, earlyMapFormat, shaderTable, root, ri, shaderCount, srcTex) {
    if (modelId !== 15 || earlyMapFormat !== "early1_raw")
      return "nwastesMaterials=notModel15";
    const touched = [];
    for (let shader = 0; shader < shaderCount; shader++) {
      const src = ri.shaderOff + shader * 64;
      const dst = shader * SHADER_STRIDE;
      if (src < 0 || src + 64 > root.byteLength || dst < 0 || dst + SHADER_STRIDE > shaderTable.byteLength) {
        continue;
      }
      const rawTexIds = readEarly1RawTextureIdsForShader(
        root,
        ri,
        shader,
        srcTex
      );
      if (rawTexIds.length === 0)
        continue;
      const rawFlags = u16(root, src + 56);
      let finalFlags = null;
      let materialName = "";
      if (rawTexIds.includes(536)) {
        finalFlags = FINAL_SHADER_TRUE_TRANS | FINAL_SHADER_REFLECTIVE | rawFlags & 12;
        materialName = "reflectiveIce";
      } else if (rawTexIds.includes(5)) {
        finalFlags = FINAL_SHADER_TRUE_TRANS | 14;
        materialName = "iceEffect";
      } else if (rawTexIds.includes(948)) {
        finalFlags = FINAL_SHADER_TRUE_TRANS | 4;
        materialName = "translucentEffect";
      } else if (rawTexIds.includes(2635)) {
        finalFlags = FINAL_SHADER_TRUE_TRANS | 4;
        materialName = "nwastesEffect";
      } else if (rawTexIds.includes(946) || rawTexIds.includes(998) || rawTexIds.includes(1005)) {
        finalFlags = FINAL_SHADER_TRUE_TRANS | rawFlags & 12;
        materialName = "transparentIce";
      }
      if (finalFlags === null)
        continue;
      finalFlags &= ~FINAL_SHADER_ALPHA_COMPARE;
      finalFlags &= ~FINAL_SHADER_WATER;
      p32(shaderTable, dst + 60, finalFlags >>> 0);
      p8(shaderTable, dst + 40, u8(root, src + 40));
      p8(shaderTable, dst + 48, u8(root, src + 48));
      const numLayers = Math.max(0, Math.min(2, u8(root, src + 59)));
      p8(shaderTable, dst + 65, numLayers);
      let attr = u8(shaderTable, dst + 64);
      if (numLayers > 0)
        attr |= 4;
      if (numLayers > 1)
        attr |= 8;
      p8(shaderTable, dst + 64, attr);
      touched.push(
        `shader${shader}/${materialName}/rawFlags=0x${rawFlags.toString(16)}/rawTex=[${rawTexIds.join(",")}]/finalFlags=0x${(finalFlags >>> 0).toString(16)}`
      );
    }
    return touched.length > 0 ? `nwastesMaterials=[${touched.join(";")}]` : "nwastesMaterials=noneFound";
  }
  function remapEarly1Texture(texId, modelId, finalTexIds) {
    if (modelId === 13) {
      const swapholMapped = EARLY1_SWAPHOL_KIOSK_TEXTURE_REMAP[texId];
      if (swapholMapped !== void 0)
        return swapholMapped;
    }
    if (modelId === 15) {
      const nwastesMapped = EARLY1_NWASTES_KIOSK_TEXTURE_REMAP[texId];
      if (nwastesMapped !== void 0)
        return nwastesMapped;
    }
    if (texId === 2640)
      return finalTexIds?.has(788) ? 788 : 2640;
    if (texId === 2727 && finalTexIds?.has(2373))
      return 2373;
    return validMappedTextureOrSource(
      debugResolveEarly1TextureId(texId, modelId),
      texId
    );
  }
  function remapEarly3Texture(texId, modelId) {
    return validMappedTextureOrSource(
      debugResolveEarly3TextureId(texId, modelId),
      texId
    );
  }
  function remapEarly4Texture(texId, modelId) {
    return validMappedTextureOrSource(
      debugResolveEarly4TextureId(texId, modelId),
      texId
    );
  }
  function remapAncientTexture(texId, modelId) {
    if (modelId === 13 && texId === 918)
      return 788;
    const mapped = debugResolveAncientTextureId(texId, modelId);
    return mapped !== null ? mapped : texId;
  }
  function ancientInfo(b) {
    return {
      triOff: u32(b, 76),
      batchOff: u32(b, 80),
      collPosOff: u32(b, 84),
      texOff: u32(b, 88),
      posOff: u32(b, 92),
      clrOff: u32(b, 96),
      texcoordOff: u32(b, 100),
      shaderOff: u32(b, 104),
      dlOffsetsOff: u32(b, 108),
      dlSizesOff: u32(b, 112),
      bitsOff: u32(b, 124),
      bitsCount: u16(b, 128),
      posCount: u16(b, 134),
      collPosCount: u16(b, 136),
      clrCount: u16(b, 138),
      texcoordCount: u16(b, 140),
      texCount: u8(b, 152),
      shaderCount: u8(b, 153),
      dlCount: u8(b, 154)
    };
  }
  function ancientTextures(root, ai) {
    const out = [];
    for (let i = 0; i < ai.texCount; i++) {
      const o = ai.texOff + i * 4;
      if (o + 4 <= root.byteLength)
        out.push(u32(root, o));
    }
    return out;
  }
  function computeYFromPositionTable(root, posOff, posCount) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < posCount; i++) {
      const o = posOff + i * 6;
      if (o + 6 > root.byteLength)
        continue;
      const y = s16(root, o + 2);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return Number.isFinite(minY) ? (minY + maxY) / 2 | 0 : 0;
  }
  function convertedPositionTable(root, posOff, posCount, yTranslate) {
    const out = new Uint8Array(posCount * 6);
    for (let i = 0; i < posCount; i++) {
      const src = posOff + i * 6;
      ps16(out, i * 6 + 0, s16(root, src + 0) * 8);
      ps16(out, i * 6 + 2, (s16(root, src + 2) - yTranslate) * 8);
      ps16(out, i * 6 + 4, s16(root, src + 4) * 8);
    }
    return out;
  }
  function boundsForPositionTable(root, posOff, posCount, yTranslate) {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < posCount; i++) {
      const o = posOff + i * 6;
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
  function decodeAncientShaderForDLs(root, bitOff, byteCount, shaderCount) {
    const shaderForDL = new Array(64).fill(-1);
    const vcdBitsForDL = new Array(64).fill(5);
    const callOrder = [];
    if (bitOff <= 0 || byteCount <= 0 || bitOff >= root.byteLength)
      return { shaderForDL, vcdBitsForDL, callOrder, bitOff: 0, calls: 0 };
    if (bitOff + byteCount > root.byteLength)
      byteCount = root.byteLength - bitOff;
    const br = new LowBitStreamReader(root, bitOff, byteCount);
    let currentShader = 0;
    let currentVcdBits = 5;
    let calls = 0;
    for (let opCount = 0; opCount < 2e4 && br.canRead(4); opCount++) {
      const op = br.get(4);
      if (op === OP_SET_SHADER) {
        if (!br.canRead(6))
          break;
        currentShader = br.get(6) % Math.max(1, shaderCount);
      } else if (op === OP_CALL_DL) {
        if (!br.canRead(6))
          break;
        const listNum = br.get(6);
        if (listNum >= 0 && listNum < 64) {
          shaderForDL[listNum] = currentShader;
          vcdBitsForDL[listNum] = currentVcdBits;
          callOrder.push(listNum);
          calls++;
        }
      } else if (op === OP_SET_VCD) {
        if (!br.canRead(3))
          break;
        currentVcdBits = br.get(1) | br.get(1) << 1 | br.get(1) << 2;
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
    return { shaderForDL, vcdBitsForDL, callOrder, bitOff, calls };
  }
  function scoreAncientDLVcdBits(dl, vcdBits, ai) {
    const posSize = (vcdBits & 1) !== 0 ? 2 : 1;
    const colorSize = (vcdBits & 2) !== 0 ? 2 : 1;
    const texSize = (vcdBits & 4) !== 0 ? 2 : 1;
    const recSize = posSize + colorSize + texSize;
    let p = 0;
    let prims = 0;
    let verts = 0;
    let ended = false;
    let stop = "eof";
    let badPos = 0;
    let badColor = 0;
    let badTex = 0;
    let maxPos = -1;
    const usedPos = new Set();
    while (p + 3 <= dl.byteLength) {
      const cmd = dl[p];
      if (cmd === 0) {
        ended = true;
        stop = `end@0x${p.toString(16)}`;
        break;
      }
      const prim = cmd & 248;
      if (prim < 128 || prim > 184) {
        stop = `badPrim0x${prim.toString(16)}@0x${p.toString(16)}`;
        break;
      }
      const count = u16(dl, p + 1);
      p += 3;
      if (count <= 0 || count > 16384) {
        stop = `badCount${count}@0x${(p - 3).toString(16)}`;
        break;
      }
      const next = p + count * recSize;
      if (next > dl.byteLength) {
        stop = `vertexOOB@0x${p.toString(16)}/count=${count}/rec=${recSize}/end=0x${next.toString(16)}/len=0x${dl.byteLength.toString(16)}`;
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
        maxPos = Math.max(maxPos, pos);
        if (pos >= ai.posCount) {
          badPos++;
        } else {
          usedPos.add(pos);
        }
        if (color >= Math.max(1, ai.clrCount))
          badColor++;
        if (tex >= ai.texcoordCount)
          badTex++;
      }
      p = next;
      prims++;
      if (prims > 4096) {
        stop = "tooManyPrims";
        break;
      }
    }
    const trailing = Math.max(0, dl.byteLength - p);
    const largePositionTable = ai.posCount > 255;
    let score = prims * 2e3 + verts + usedPos.size * 20 + (ended ? 8e3 : 0) - trailing * 2 - badPos * 5e4 - badTex * 2e4 - badColor * 50 - (prims === 0 ? 1e5 : 0);
    if (largePositionTable) {
      if (posSize === 2 && badPos === 0 && prims > 0) {
        score += 3e5;
        score += Math.min(usedPos.size, 512) * 200;
      } else if (posSize === 1) {
        score -= 3e5;
        score -= verts * 500;
      }
    }
    if (!largePositionTable && posSize === 1 && badPos === 0 && prims > 0)
      score += 1e4;
    return {
      vcdBits,
      score,
      prims,
      verts,
      ended,
      stop,
      badPos,
      badColor,
      badTex,
      trailing,
      posSize,
      maxPos,
      distinctPos: usedPos.size
    };
  }
  function chooseAncientVcdBits(dl, decodedVcdBits, ai) {
    const decoded = decodedVcdBits & 7;
    const largePositionTable = ai.posCount > 255;
    const candidates = (largePositionTable ? [
      decoded | 1,
      5,

      1,

      7,

      3,

      decoded,
      4,

      0,

      6,

      2

    ] : [
      decoded,
      0,

      4,

      2,

      6,

      5,

      1,

      7,

      3

    ]).filter((v, i, a) => a.indexOf(v) === i);
    let best = scoreAncientDLVcdBits(dl, candidates[0] ?? 5, ai);
    for (const bits of candidates.slice(1)) {
      const s = scoreAncientDLVcdBits(dl, bits, ai);
      if (s.score > best.score)
        best = s;
    }
    return best;
  }
  function chooseAncientDLSize(root, dlOff, size16, size32, ai) {
    const candidates = [];
    if (size16 > 0 && dlOff + size16 <= root.byteLength)
      candidates.push({ size: size16, source: "u16" });
    if (size32 > 0 && size32 <= 131072 && dlOff + size32 <= root.byteLength)
      candidates.push({ size: size32, source: "u32" });
    let best = null;
    for (const c of candidates) {
      const dl = root.subarray(dlOff, dlOff + c.size);
      const score = chooseAncientVcdBits(dl, 5, ai);
      if (best === null || score.score > best.score.score)
        best = { ...c, score };
    }
    return best;
  }
  function collectAncientDisplayLists(root, ai) {
    const out = [];
    const dlCount = Math.max(0, Math.min(64, ai.dlCount || ai.shaderCount || 0));
    for (let i = 0; i < dlCount; i++) {
      const offOff = ai.dlOffsetsOff + i * 4;
      const sizeOff16 = ai.dlSizesOff + i * 2;
      const sizeOff32 = ai.dlSizesOff + i * 4;
      if (offOff + 4 > root.byteLength)
        break;
      const dlOff = u32(root, offOff);
      if (dlOff === 0 || dlOff >= root.byteLength)
        continue;
      const size16 = sizeOff16 + 2 <= root.byteLength ? u16(root, sizeOff16) : 0;
      const size32 = sizeOff32 + 4 <= root.byteLength ? u32(root, sizeOff32) : 0;
      const chosen = chooseAncientDLSize(root, dlOff, size16, size32, ai);
      if (chosen === null)
        continue;
      out.push({
        sourceIndex: i,
        dl: root.slice(dlOff, dlOff + chosen.size),
        oldOff: dlOff,
        oldSize: chosen.size
      });
    }
    return out;
  }
  function ancientLooksWater(flags8, texId0Raw, texId0Mapped) {
    void flags8;
    return texIdInSet(ANCIENT_KNOWN_WATER_TEXIDS, texId0Raw, texId0Mapped);
  }
  function ancientLooksCutout(texId0Raw, texId0Mapped) {
    return texIdInSet(ANCIENT_KNOWN_CUTOUT_TEXIDS, texId0Raw, texId0Mapped);
  }
  function findFinalWaterShaderPrototypeInResource(resourceId, final) {
    const fi = finalInfo(final);
    if (fi.shaderOff <= 0 || fi.shaderCount <= 0)
      return null;
    const texIds = finalTextures(final);
    for (let shader = 0; shader < fi.shaderCount; shader++) {
      const off = fi.shaderOff + shader * SHADER_STRIDE;
      if (off + SHADER_STRIDE > final.byteLength)
        break;
      const flags = u32(final, off + 60);
      if ((flags & FINAL_SHADER_WATER) === 0)
        continue;
      return {
        resourceId,
        shaderIndex: shader,
        shader: final.slice(off, off + SHADER_STRIDE),
        texIds,
        flags
      };
    }
    return null;
  }
  function findFinalWaterShaderPrototypeInArchive(blocks) {
    const ids = [...blocks.keys()].sort((a, b) => a - b);
    for (const rid of ids) {
      const raw = blocks.get(rid);
      if (!raw)
        continue;
      const proto = findFinalWaterShaderPrototypeInResource(rid, raw);
      if (proto)
        return proto;
    }
    return null;
  }
  function buildFinalShaderTableFromAncient(root, ai, shaderCount, texCount, srcTex, mappedTex, finalWaterPrototype = null) {
    const ANCIENT_SHADER_STRIDE = 60;
    const out = new Uint8Array(shaderCount * SHADER_STRIDE);
    for (let i = 0; i < shaderCount; i++) {
      const src = ai.shaderOff + i * ANCIENT_SHADER_STRIDE;
      const dst = i * SHADER_STRIDE;
      let attr = 1;
      let ancientAttrRaw = 0;
      let numLayersOut = 0;
      let texId0 = null;
      let texId0Mapped = null;
      let texId1 = null;
      let texId1Mapped = null;
      let tev0 = 0;
      let tev1 = 0;
      let flags8 = 0;
      if (src + ANCIENT_SHADER_STRIDE <= root.byteLength) {
        flags8 = u8(root, src + 56);
        ancientAttrRaw = u8(root, src + 57);
        attr = ancientAttrRaw & 3;
        const numLayersIn = Math.max(0, Math.min(2, u8(root, src + 58)));
        for (let layer = 0; layer < 2; layer++) {
          const srcLayer = src + 36 + layer * 8;
          const dstLayer = dst + 36 + layer * 8;
          const rawField = u32(root, srcLayer + 0);
          const texInfo = normalizeEarly1LayerTex(rawField, srcTex, mappedTex);
          const slot = texInfo.slot;
          if (layer < numLayersIn && slot !== null && slot >= 0 && slot < texCount) {
            p32(out, dstLayer + 0, slot);
            p8(out, dstLayer + 4, u8(root, srcLayer + 4));
            p8(out, dstLayer + 5, u8(root, srcLayer + 5));
            p8(out, dstLayer + 6, u8(root, srcLayer + 6));
            p8(out, dstLayer + 7, u8(root, srcLayer + 7));
            if (layer === 0) {
              texId0 = texInfo.rawId;
              texId0Mapped = texInfo.mappedId;
              tev0 = u8(root, srcLayer + 4) & 127;
            } else if (layer === 1) {
              texId1 = texInfo.rawId;
              texId1Mapped = texInfo.mappedId;
              tev1 = u8(root, srcLayer + 4) & 127;
            }
            numLayersOut = layer + 1;
            attr |= layer === 0 ? 4 : 8;
          } else {
            p32(out, dstLayer + 0, 4294967295);
            p8(out, dstLayer + 4, 0);
            p8(out, dstLayer + 5, 0);
            p8(out, dstLayer + 6, 0);
            p8(out, dstLayer + 7, 0);
          }
        }
      } else {
        const fallbackSlot = texCount > 0 ? i % texCount : -1;
        p32(out, dst + 36, fallbackSlot >= 0 ? fallbackSlot : 4294967295);
        numLayersOut = texCount > 0 ? 1 : 0;
        attr = texCount > 0 ? 4 : 1;
        texId0 = fallbackSlot >= 0 ? srcTex[fallbackSlot] ?? null : null;
        texId0Mapped = fallbackSlot >= 0 ? mappedTex[fallbackSlot] ?? null : null;
      }
      if (numLayersOut === 0 && texCount > 0) {
        const fallbackSlot = i % texCount;
        p32(out, dst + 36, fallbackSlot);
        p8(out, dst + 40, 0);
        p8(out, dst + 41, 0);
        p8(out, dst + 42, 0);
        p8(out, dst + 43, 0);
        texId0 = srcTex[fallbackSlot] ?? null;
        texId0Mapped = mappedTex[fallbackSlot] ?? null;
        texId1 = null;
        texId1Mapped = null;
        tev0 = 0;
        tev1 = 0;
        numLayersOut = 1;
        attr |= 4;
      }
      p32(out, dst + 52, 4294967295);
      p32(out, dst + 56, 4294967295);
      let finalFlags = FINAL_SHADER_CULL_BACKFACE;
      const water = ancientLooksWater(flags8, texId0, texId0Mapped) || ancientLooksWater(flags8, texId1, texId1Mapped);
      const hasTex = texId0 !== null || texId0Mapped !== null || texId1 !== null || texId1Mapped !== null;
      const ancientAttrHi = ancientAttrRaw & 24;
      const wantsAncientCutout = ancientAttrHi === 16;
      const wantsAncientBlend = ancientAttrHi === 24 && hasTex && texIdInSet(ANCIENT_KNOWN_BLEND_TEXIDS, texId0, texId0Mapped, texId1, texId1Mapped);
      const cutout = !water && hasTex && (ancientLooksCutout(texId0, texId0Mapped) || ancientLooksCutout(texId1, texId1Mapped) || wantsAncientCutout);
      if (water) {
        const ancientWaterSlot = numLayersOut > 0 && u32(out, dst + 36) !== 4294967295 ? u32(out, dst + 36) : texCount > 0 ? 0 : -1;
        if (finalWaterPrototype !== null) {
          out.set(finalWaterPrototype.shader, dst);
          attr = u8(out, dst + 64) & 15;
          numLayersOut = 0;
          for (let layer = 0; layer < 2; layer++) {
            const layerOff = dst + 36 + layer * 8;
            const protoSlot = u32(out, layerOff + 0);
            if (protoSlot === 4294967295) {
              p32(out, layerOff + 0, 4294967295);
              p8(out, layerOff + 4, 0);
              p8(out, layerOff + 5, 0);
              p8(out, layerOff + 6, 0);
              p8(out, layerOff + 7, 0);
              continue;
            }
            const protoTexId = protoSlot >= 0 && protoSlot < finalWaterPrototype.texIds.length ? finalWaterPrototype.texIds[protoSlot] : null;
            const remappedSlot = protoTexId !== null ? mappedTex.indexOf(protoTexId) : -1;
            if (remappedSlot >= 0) {
              p32(out, layerOff + 0, remappedSlot);
              numLayersOut = layer + 1;
              attr |= layer === 0 ? 4 : 8;
            } else if (layer === 0 && ancientWaterSlot >= 0) {
              p32(out, layerOff + 0, ancientWaterSlot);
              numLayersOut = 1;
              attr |= 4;
            } else {
              p32(out, layerOff + 0, 4294967295);
              p8(out, layerOff + 4, 0);
              p8(out, layerOff + 5, 0);
              p8(out, layerOff + 6, 0);
              p8(out, layerOff + 7, 0);
            }
          }
          if (numLayersOut <= 0 && ancientWaterSlot >= 0) {
            p32(out, dst + 36, ancientWaterSlot);
            p8(out, dst + 40, 0);
            p8(out, dst + 41, 0);
            p8(out, dst + 42, 0);
            p8(out, dst + 43, 0);
            numLayersOut = 1;
            attr |= 4;
          }
          finalFlags = u32(out, dst + 60);
          finalFlags |= FINAL_SHADER_WATER | FINAL_SHADER_TRUE_TRANS | FINAL_SHADER_WATER_EXTRA;
          finalFlags &= ~FINAL_SHADER_ALPHA_COMPARE;
          finalFlags &= ~FINAL_SHADER_CULL_BACKFACE;
        } else {
          finalFlags |= FINAL_SHADER_TRANSLUCENT;
          finalFlags &= ~FINAL_SHADER_ALPHA_COMPARE;
          finalFlags &= ~FINAL_SHADER_WATER;
          finalFlags &= ~FINAL_SHADER_WATER_EXTRA;
        }
      } else if (wantsAncientBlend) {
        finalFlags |= FINAL_SHADER_TRANSLUCENT;
        finalFlags &= ~FINAL_SHADER_ALPHA_COMPARE;
      } else if (cutout) {
        finalFlags |= FINAL_SHADER_ALPHA_COMPARE;
      }
      if ((finalFlags & (FINAL_SHADER_WATER | FINAL_SHADER_TRANSLUCENT | FINAL_SHADER_ALPHA_COMPARE)) !== 0) {
        finalFlags &= ~FINAL_SHADER_CULL_BACKFACE;
      }
      if (numLayersOut > 0 && !water && (finalFlags & (FINAL_SHADER_ALPHA_COMPARE | FINAL_SHADER_TRANSLUCENT)) !== 0) {
        p8(out, dst + 40, 0);
        p8(out, dst + 41, 0);
        p8(out, dst + 42, 0);
        p8(out, dst + 43, 0);
      }
      void tev0;
      void tev1;
      attr &= 15;
      if ((attr & 13) === 0)
        attr |= 1;
      p32(out, dst + 60, finalFlags >>> 0);
      p8(out, dst + 64, attr);
      p8(out, dst + 65, numLayersOut);
      p8(out, dst + 66, 0);
      p8(out, dst + 67, 0);
    }
    return out;
  }
  function rebuildResourceAppendAncient(root, final, opts, finalWaterPrototype = null) {
    const ai = ancientInfo(root);
    const textureless = isTexturelessMode(opts.textureMode);
    const srcTex = ancientTextures(root, ai);
    const mappedFromAncient = srcTex.map((texId) => remapAncientTexture(texId, opts.modelId));
    let mapped = textureless ? [opts.flatTextureId] : mappedFromAncient.slice();
    if (mapped.length === 0)
      mapped = [opts.flatTextureId];
    const texCount = Math.max(1, Math.min(255, mapped.length));
    mapped = mapped.slice(0, texCount);
    const shaderCount = textureless ? 1 : Math.max(1, Math.min(64, ai.shaderCount || 1));
    const decoded = decodeAncientShaderForDLs(root, ai.bitsOff, ai.bitsCount, shaderCount);
    const ancientDLs = collectAncientDisplayLists(root, ai);
    if (ancientDLs.length === 0)
      throw new Error(`no Ancient display lists found`);
    if (ancientDLs.length > 255)
      throw new Error(`too many Ancient display lists: ${ancientDLs.length}`);
    const sourceIndexToOutputIndex = new Map();
    const copiedDLs = [];
    const shaderFor = [];
    const vcdFor = [];
    const sourceIndexes = [];
    const ancientVcdDiag = [];
    for (let outIndex = 0; outIndex < ancientDLs.length; outIndex++) {
      const srcDL = ancientDLs[outIndex];
      const sourceIndex = srcDL.sourceIndex;
      const decodedVcd = decoded.vcdBitsForDL[sourceIndex] ?? 5;
      const chosenVcd = chooseAncientVcdBits(srcDL.dl, decodedVcd, ai);
      const shader = decoded.shaderForDL[sourceIndex] >= 0 ? decoded.shaderForDL[sourceIndex] : sourceIndex;
      sourceIndexToOutputIndex.set(sourceIndex, outIndex);
      copiedDLs.push(retagDisplayListToVat5(srcDL.dl, chosenVcd.vcdBits, true));
      shaderFor.push(textureless ? 0 : shader % shaderCount);
      vcdFor.push(chosenVcd.vcdBits);
      sourceIndexes.push(sourceIndex);
      ancientVcdDiag.push(
        `src${sourceIndex}/decoded=${debugVcdName(decodedVcd)}/chosen=${debugVcdName(chosenVcd.vcdBits)}/score=${chosenVcd.score}/prim=${chosenVcd.prims}/verts=${chosenVcd.verts}/badPCT=${chosenVcd.badPos}/${chosenVcd.badColor}/${chosenVcd.badTex}/posMax=${chosenVcd.maxPos}/posN=${chosenVcd.distinctPos}/trail=0x${chosenVcd.trailing.toString(16)}/stop=${chosenVcd.stop}/oldSize=0x${srcDL.oldSize.toString(16)}`
      );
    }
    let dlOrder = [];
    for (const sourceIndex of decoded.callOrder) {
      const outIndex = sourceIndexToOutputIndex.get(sourceIndex);
      if (outIndex !== void 0 && dlOrder.indexOf(outIndex) < 0)
        dlOrder.push(outIndex);
    }
    if (dlOrder.length === 0)
      dlOrder = copiedDLs.map((_dl, i) => i);
    for (let i = 0; i < copiedDLs.length; i++) {
      if (dlOrder.indexOf(i) < 0)
        dlOrder.push(i);
    }
    const compactAncientShop = opts.modelId === 17 && opts.collisionYMode !== "none";
    const FINAL_MAP_HEADER_SIZE = 184;
    let out = compactAncientShop ? copyU8(final.slice(0, Math.min(final.byteLength, FINAL_MAP_HEADER_SIZE))) : copyU8(final);
    const start = align(out.byteLength, 32);
    out = growTo(out, start);
    const dlinfoOff = start;
    let cursor = align(dlinfoOff + copiedDLs.length * FINAL_DLINFO_SIZE, 32);
    const dlOffsets = [];
    const dlSizes = [];
    for (const dl of copiedDLs) {
      const dlOff = cursor;
      const dlSizeAligned = align(dl.byteLength, 32);
      dlOffsets.push(dlOff);
      dlSizes.push(dlSizeAligned);
      out = setBytes(out, dlOff, dl);
      cursor += dlSizeAligned;
    }
    const sourceYTranslate = computeYFromPositionTable(root, ai.posOff, ai.posCount);
    const useFinalShopY = opts.modelId === 17;
    const outputYTranslate = useFinalShopY ? s16(final, 142) : sourceYTranslate;
    const colorData = root.slice(ai.clrOff, ai.clrOff + ai.clrCount * 2);
    const texcoordData = root.slice(ai.texcoordOff, ai.texcoordOff + ai.texcoordCount * 4);
    const posOff = align(cursor, 32);
    const clrOff = align(posOff + ai.posCount * 6, 32);
    const texcoordOff = align(clrOff + colorData.byteLength, 32);
    const texOff = align(texcoordOff + texcoordData.byteLength, 32);
    const shaderOff = align(texOff + texCount * 4, 32);
    const bitsOff = align(shaderOff + shaderCount * SHADER_STRIDE, 32);
    const shaderTable = textureless ? buildShaderTable(final, finalInfo(final), shaderCount, texCount) : buildFinalShaderTableFromAncient(root, ai, shaderCount, texCount, srcTex, mapped, finalWaterPrototype);
    const passForDL = shaderFor.map((shader) => {
      const shaderOff2 = shader * SHADER_STRIDE;
      if (shaderOff2 + SHADER_STRIDE > shaderTable.byteLength)
        return 0;
      const flags = u32(shaderTable, shaderOff2 + 60);
      return (flags & FINAL_SHADER_WATER) !== 0 ? 2 : 0;
    });
    const layerBits = buildFinalBitstreamsForDLOrderByPass(
      dlOrder,
      shaderFor,
      vcdFor,
      passForDL
    );
    const bitstream0 = layerBits.bitstreams[0];
    const bitstream1 = layerBits.bitstreams[1];
    const bitstream2 = layerBits.bitstreams[2];
    const bitsOff0 = bitstream0.byteLength > 0 ? bitsOff : 0;
    const bitsOff1 = bitstream1.byteLength > 0 ? bitsOff + bitstream0.byteLength : 0;
    const bitsOff2 = bitstream2.byteLength > 0 ? bitsOff + bitstream0.byteLength + bitstream1.byteLength : 0;
    const totalBitsLen = bitstream0.byteLength + bitstream1.byteLength + bitstream2.byteLength;
    const end = align(bitsOff + totalBitsLen, 32);
    out = growTo(out, end);
    out = setBytes(out, posOff, convertedPositionTable(root, ai.posOff, ai.posCount, sourceYTranslate));
    out = setBytes(out, clrOff, colorData);
    out = setBytes(out, texcoordOff, texcoordData);
    for (let i = 0; i < texCount; i++)
      p32(out, texOff + i * 4, mapped[i]);
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
    const broadBounds = boundsForPositionTable(root, ai.posOff, ai.posCount, sourceYTranslate);
    for (let i = 0; i < copiedDLs.length; i++) {
      const ro = dlinfoOff + i * FINAL_DLINFO_SIZE;
      const shader = shaderFor[i];
      const shaderFlags = u32(shaderTable, shader * SHADER_STRIDE + 60);
      const sortLayer = (shaderFlags & FINAL_SHADER_WATER) !== 0 ? 11 : 7;
      p32(out, ro + 0, dlOffsets[i]);
      p16(out, ro + 4, dlSizes[i]);
      ps16(out, ro + 6, broadBounds[0]);
      ps16(out, ro + 8, broadBounds[1]);
      ps16(out, ro + 10, broadBounds[2]);
      ps16(out, ro + 12, broadBounds[3]);
      ps16(out, ro + 14, broadBounds[4]);
      ps16(out, ro + 16, broadBounds[5]);
      p16(out, ro + 18, shader);
      p16(out, ro + 20, layerBits.special[i] ?? 0);
      p8(out, ro + 24, sortLayer);
      p8(out, ro + 25, 0);
      p16(out, ro + 26, 0);
    }
    p32(out, 8, out.byteLength);
    p32(out, 84, texOff);
    p32(out, 88, posOff);
    p32(out, 92, clrOff);
    p32(out, 96, texcoordOff);
    p32(out, 100, shaderOff);
    p32(out, 104, dlinfoOff);
    p32(out, 120, bitsOff0);
    p32(out, 124, bitsOff1);
    p32(out, 128, bitsOff2);
    p16(out, 132, bitstream0.byteLength);
    p16(out, 134, bitstream1.byteLength);
    p16(out, 136, bitstream2.byteLength);
    ps16(out, 142, outputYTranslate);
    p16(out, 144, ai.posCount);
    p16(out, 148, ai.clrCount);
    p16(out, 150, ai.texcoordCount);
    p8(out, 160, texCount);
    p8(out, 161, copiedDLs.length);
    p8(out, 162, shaderCount);
    return {
      raw: out,
      log: `visual copy source=ancient_blocks storage=${compactAncientShop ? "compact_header_rebuild" : "append_after_final"} AncientDLs=${copiedDLs.length} sourceIndexes=[${sourceIndexes.join(",")}] shaders=${shaderCount} textureMode=${opts.textureMode} ancientStablePass=opaque_pass0_safeFauxWater_textureOnly bitsLen=[${bitstream0.byteLength},${bitstream1.byteLength},${bitstream2.byteLength}] layerCalls=[${layerBits.layerCalls.map((xs) => xs.join("/")).join("|")}] sourceY=${sourceYTranslate} outputY=${outputYTranslate} shopPlacement=${useFinalShopY ? "final_header" : "source"} oldLen=0x${final.byteLength.toString(16)} newLen=0x${out.byteLength.toString(16)} ancientTex=[${srcTex.join(",")}] mappedFromAncient=[${mappedFromAncient.join(",")}] usedTex=[${mapped.join(",")}] decodedBitOff=0x${decoded.bitOff.toString(16)} decodedCalls=${decoded.calls} ancientVcd=[${ancientVcdDiag.join(" ; ")}]`
    };
  }
  function rebuildResourceAppend(root, final, opts) {
    const sourceInfo = earlyMapSourceInfo(opts.earlyMapFormat);
    const ri = earlyInfo(root);
    const srcTex = earlyTextures(root);
    const finalTexIdSet = new Set(finalTextures(final));
    const mappedFromEarly = sourceInfo.textureRemapMode === "early1" ? srcTex.map((t) => remapEarly1Texture(t, opts.modelId, finalTexIdSet)) : sourceInfo.textureRemapMode === "early3" ? srcTex.map((t) => remapEarly3Texture(t, opts.modelId)) : sourceInfo.textureRemapMode === "early4" ? srcTex.map((t) => remapEarly4Texture(t, opts.modelId)) : srcTex.slice();
    const textureless = isTexturelessMode(opts.textureMode);
    let mapped = textureless ? [opts.flatTextureId] : mappedFromEarly.slice();
    if (mapped.length === 0)
      mapped = [opts.flatTextureId];
    const texCount = Math.max(1, Math.min(255, mapped.length));
    mapped = mapped.slice(0, texCount);
    const earlyDLInfoStride = sourceInfo.dlInfoStride;
    const earlyDLCount = Math.min(
      ri.dlInfoCount,
      Math.max(0, (root.byteLength - ri.dlInfoOff) / earlyDLInfoStride | 0),
      255
    );
    const earlyShaderCount = Math.max(1, Math.min(64, ri.shaderCount || 1));
    const shaderCount = textureless ? 1 : earlyShaderCount;
    const decoded = decodeEarlyShaderForDLs(root, earlyDLCount, earlyShaderCount, sourceInfo);
    const infoShaderForDL = [];
    for (let i = 0; i < earlyDLCount; i++) {
      const infoOff = ri.dlInfoOff + i * earlyDLInfoStride;
      const infoShader = sourceInfo.shaderMode === "early3" ? u8(root, infoOff + 20) : u16(root, infoOff + 18);
      infoShaderForDL[i] = infoShader < earlyShaderCount ? infoShader : -1;
    }
    const distinctInfoShaders = new Set(infoShaderForDL.filter((v) => v >= 0));
    const canUseInfoShader = distinctInfoShaders.size > 1;
    const layer1EarlyDLSet = new Set(
      decodeEarlyLayerCallOrder(
        root,
        u32(root, sourceInfo.bitsOffsets[1]),
        u16(root, sourceInfo.bitsByteCounts[1]),
        earlyDLCount,
        earlyShaderCount
      )
    );
    const layer2EarlyDLSet = new Set(
      decodeEarlyLayerCallOrder(
        root,
        u32(root, sourceInfo.bitsOffsets[2]),
        u16(root, sourceInfo.bitsByteCounts[2]),
        earlyDLCount,
        earlyShaderCount
      )
    );
    const specialEarlyDLSet = new Set([
      ...layer1EarlyDLSet,
      ...layer2EarlyDLSet
    ]);
    const copiedDLs = [];
    const shaderFor = [];
    const vcdFor = [];
    const vcdReadFor = [];
    const vcdDecodedFor = [];
    const earlyDLIndexes = [];
    const early4DLDiag = [];
    const early4RepackDiag = [];
    const early4SortLayerDiag = [];
    for (let i = 0; i < earlyDLCount; i++) {
      const infoOff = ri.dlInfoOff + i * earlyDLInfoStride;
      const dlOff = u32(root, infoOff + 0);
      const dlSize = u16(root, infoOff + 4);
      if (dlOff === 0 || dlSize === 0)
        continue;
      if (dlOff + dlSize > root.byteLength)
        continue;
      const rawDL = root.subarray(dlOff, dlOff + dlSize);
      const decodedVcdBits = decoded.vcdBitsForDL[i] ?? 5;
      const decodedShader = decoded.shaderForDL[i];
      const infoShader = infoShaderForDL[i];
      const earlyShader = canUseInfoShader && infoShader >= 0 ? infoShader : decodedShader >= 0 ? decodedShader : i;
      const sourceShaderLayerOffset = sourceInfo.shaderMode === "early1" ? 59 : sourceInfo.shaderMode === "early3" ? 63 : sourceInfo.shaderMode === "early4_final" ? 65 : -1;
      const early4TexcoordLayers = sourceShaderLayerOffset >= 0 && earlyShader >= 0 && earlyShader < earlyShaderCount ? Math.max(
        1,
        Math.min(
          2,
          u8(
            root,
            ri.shaderOff + earlyShader * sourceInfo.shaderStride + sourceShaderLayerOffset
          )
        )
      ) : 1;
      let readVcdBits = isEarly34Format(opts.earlyMapFormat) ? chooseValidatedEarly4VcdBits(
        rawDL,
        decodedVcdBits,
        ri,
        early4TexcoordLayers
      ) : chooseValidatedEarly1VcdBits(
        rawDL,
        decodedVcdBits,
        ri,
        early4TexcoordLayers
      );
      let vcdBits = readVcdBits;
      let dl;
      if (isEarly34Format(opts.earlyMapFormat) && (readVcdBits & 2) !== 0) {
        const writeVcdBits = readVcdBits;
        const repacked = repackDisplayListToVat5(
          rawDL,
          readVcdBits,
          writeVcdBits,
          ri,
          true,
          true,
          early4TexcoordLayers
        );
        dl = repacked.dl;
        vcdBits = writeVcdBits;
        early4RepackDiag.push(
          `dl${i}/texLayers=${early4TexcoordLayers}/read=${debugVcdName(readVcdBits)}/write=${debugVcdName(vcdBits)}/${repacked.log}`
        );
      } else {
        dl = retagDisplayListToVat5(
          rawDL,
          vcdBits,
          opts.earlyMapFormat !== "early1_raw",
          isEarly34Format(opts.earlyMapFormat),
          early4TexcoordLayers
        );
      }
      copiedDLs.push(dl);
      shaderFor.push(
        textureless ? 0 : earlyShader % shaderCount
      );
      vcdDecodedFor.push(decodedVcdBits);
      vcdReadFor.push(readVcdBits);
      vcdFor.push(vcdBits);
      earlyDLIndexes.push(i);
      if (isEarly34Format(opts.earlyMapFormat)) {
        const early4Layer = layer2EarlyDLSet.has(i) ? "L2" : layer1EarlyDLSet.has(i) ? "L1" : "L0";
        const decodedStats = debugScanEarly4DLForLog(
          rawDL,
          decodedVcdBits,
          ri,
          early4TexcoordLayers
        );
        const usedStats = debugScanEarly4DLForLog(
          dl,
          vcdBits,
          ri,
          early4TexcoordLayers
        );
        early4DLDiag.push(
          `dl${i}{off=0x${dlOff.toString(16)}/size=0x${dlSize.toString(16)}/layer=${early4Layer}/shader=${earlyShader}/texLayers=${early4TexcoordLayers}/decoded=${debugVcdName(decodedVcdBits)}:${debugEarly4DLStatsForLog(decodedStats)}/used=${debugVcdName(vcdBits)}:${debugEarly4DLStatsForLog(usedStats)}}`
        );
      }
    }
    if (copiedDLs.length === 0)
      throw new Error(`no Early1 visual DLs found`);
    if (copiedDLs.length > 255)
      throw new Error(`too many copied Early1 DLs: ${copiedDLs.length}`);
    const keepOriginalFinalBody = opts.collisionYMode === "none";
    let out = keepOriginalFinalBody ? copyU8(final) : copyU8(
      final.subarray(
        0,
        Math.min(final.byteLength, 184)
      )
    );
    const start = align(out.byteLength, 32);
    out = growTo(out, start);
    const dlinfoOff = start;
    let cursor = align(dlinfoOff + copiedDLs.length * FINAL_DLINFO_SIZE, 32);
    const dlOffsets = [];
    const dlSizes = [];
    for (const dl of copiedDLs) {
      const dlOff = cursor;
      const dlSizeAligned = align(dl.byteLength, 32);
      dlOffsets.push(dlOff);
      dlSizes.push(dlSizeAligned);
      out = setBytes(out, dlOff, dl);
      cursor += dlSizeAligned;
    }
    const compactEarly4Palette = isEarly34Format(opts.earlyMapFormat);
    const colorData = compactEarly4Palette ? colors(root, ri) : colorsForFinalMapOutput(root, ri, sourceInfo);
    const outClrCount = compactEarly4Palette ? ri.clrCount : sourceInfo.expandColorPalette16 ? 65535 : ri.clrCount;
    const posOff = align(cursor, 32);
    const clrOff = align(posOff + ri.posCount * 6, 32);
    const texcoordOff = align(clrOff + colorData.byteLength, 32);
    const texOff = align(texcoordOff + ri.texcoordCount * 4, 32);
    const shaderOff = align(texOff + texCount * 4, 32);
    const bitsOff = align(shaderOff + shaderCount * SHADER_STRIDE, 32);
    const forcedLayerForOutputDL = buildEarly1NorthernWastesForcedLayers(
      opts.modelId,
      opts.earlyMapFormat,
      root,
      ri,
      shaderFor,
      srcTex
    );
    const layerBits = buildLayerBitstreamsFromEarlyPasses(
      root,
      ri,
      shaderFor,
      vcdFor,
      earlyDLIndexes,
      sourceInfo,
      forcedLayerForOutputDL
    );
    const bitstream0 = layerBits.bitstreams[0];
    const bitstream1 = layerBits.bitstreams[1];
    const bitstream2 = layerBits.bitstreams[2];
    const bitsOff0 = bitstream0.byteLength > 0 ? bitsOff : 0;
    const bitsOff1 = bitstream1.byteLength > 0 ? bitsOff + bitstream0.byteLength : 0;
    const bitsOff2 = bitstream2.byteLength > 0 ? bitsOff + bitstream0.byteLength + bitstream1.byteLength : 0;
    const totalBitsLen = bitstream0.byteLength + bitstream1.byteLength + bitstream2.byteLength;
    const end = align(bitsOff + totalBitsLen, 32);
    out = growTo(out, end);
    const sourceYTranslate = computeY(root, ri);
    const useFinalShopY = opts.modelId === 17;
    const outputYTranslate = useFinalShopY ? s16(final, 142) : sourceYTranslate;
    out = setBytes(
      out,
      posOff,
      convertedPositions(root, ri, sourceYTranslate)
    );
    out = setBytes(out, clrOff, colorData);
    out = setBytes(out, texcoordOff, texcoords(root, ri));
    for (let i = 0; i < texCount; i++)
      p32(out, texOff + i * 4, mapped[i]);
    const shaderTable = textureless ? buildShaderTable(final, finalInfo(final), shaderCount, texCount) : sourceInfo.shaderMode === "early3" ? buildFinalShaderTableFromEarly3(root, ri, shaderCount, texCount, srcTex, mapped) : sourceInfo.shaderMode === "early4_final" ? buildFinalShaderTableFromEarly4(root, ri, shaderCount, texCount, srcTex, mapped) : buildFinalShaderTableFromEarly1(root, ri, shaderCount, texCount, srcTex, mapped);
    const nwastesMaterialLog = !textureless && sourceInfo.shaderMode === "early1" ? patchEarly1NorthernWastesMaterialsInShaderTable(
      opts.modelId,
      opts.earlyMapFormat,
      shaderTable,
      root,
      ri,
      shaderCount,
      srcTex
    ) : "nwastesMaterials=notEarly1";
    const early4CullDebugLog = !textureless && sourceInfo.shaderMode === "early4_final" ? patchEarly4BackfaceCullForDebug(
      shaderTable,
      shaderCount
    ) : "early4CullDebug=notEarly4";
    const layer2WaterLog = textureless ? "layer2WaterFlags=textureless" : sourceInfo.shaderMode !== "early1" ? "layer2WaterFlags=early34_final_style_shader_flags" : patchLayer2WaterFlagsInShaderTable(
      shaderTable,
      root,
      ri,
      shaderFor,
      layerBits.layerForDL,
      srcTex,
      mapped
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
    const finalFlagsForCopiedDL = shaderFor.map(
      (shader) => u32(shaderTable, shader * SHADER_STRIDE + 60)
    );
    const broadBounds = boundsForAllPositions(
      root,
      ri,
      sourceYTranslate
    );
    for (let i = 0; i < copiedDLs.length; i++) {
      const ro = dlinfoOff + i * FINAL_DLINFO_SIZE;
      const oldInfoOff = ri.dlInfoOff + earlyDLIndexes[i] * earlyDLInfoStride;
      p32(out, ro + 0, dlOffsets[i]);
      p16(out, ro + 4, dlSizes[i]);
      const dlBounds = isEarly34Format(opts.earlyMapFormat) ? broadBounds : boundsFromEarlyDLInfo(
        root,
        oldInfoOff,
        sourceYTranslate,
        broadBounds
      );
      ps16(out, ro + 6, dlBounds[0]);
      ps16(out, ro + 8, dlBounds[1]);
      ps16(out, ro + 10, dlBounds[2]);
      ps16(out, ro + 12, dlBounds[3]);
      ps16(out, ro + 14, dlBounds[4]);
      ps16(out, ro + 16, dlBounds[5]);
      p16(out, ro + 18, shaderFor[i]);
      p16(out, ro + 20, layerBits.special[i] ?? 0);
      const oldLayer = u8(root, oldInfoOff + 24);
      const shaderFlags = finalFlagsForCopiedDL[i] ?? 0;
      const fallbackLayer = layerBits.layerForDL[i] === 2 || (shaderFlags & FINAL_SHADER_WATER) !== 0 ? 11 : 7;
      const finalSortLayer = isEarly34Format(opts.earlyMapFormat) ? fallbackLayer : oldLayer || fallbackLayer;
      if (isEarly34Format(opts.earlyMapFormat)) {
        early4SortLayerDiag.push(
          `dl${i}/early=0x${oldLayer.toString(16)}/final=${finalSortLayer}/pass=${layerBits.layerForDL[i]}/flags=0x${shaderFlags.toString(16)}`
        );
      }
      p8(out, ro + 24, finalSortLayer);
      p8(out, ro + 25, 0);
      p16(out, ro + 26, 0);
    }
    p32(out, 8, out.byteLength);
    p32(out, 84, texOff);
    p32(out, 88, posOff);
    p32(out, 92, clrOff);
    p32(out, 96, texcoordOff);
    p32(out, 100, shaderOff);
    p32(out, 104, dlinfoOff);
    p32(out, 120, bitsOff0);
    p32(out, 124, bitsOff1);
    p32(out, 128, bitsOff2);
    p16(out, 132, bitstream0.byteLength);
    p16(out, 134, bitstream1.byteLength);
    p16(out, 136, bitstream2.byteLength);
    ps16(out, 142, outputYTranslate);
    p16(out, 144, ri.posCount);
    p16(out, 148, outClrCount);
    p16(out, 150, ri.texcoordCount);
    p8(out, 160, texCount);
    p8(out, 161, copiedDLs.length);
    p8(out, 162, shaderCount);
    const early4DiagLog = isEarly34Format(opts.earlyMapFormat) ? `; early4Header=pos=0x${ri.posOff.toString(16)}/${ri.posCount} clr=0x${ri.clrOff.toString(16)}/${ri.clrCount} texcoord=0x${ri.texcoordOff.toString(16)}/${ri.texcoordCount} tex=0x${ri.texOff.toString(16)}/${ri.texCount} shader=0x${ri.shaderOff.toString(16)}/${ri.shaderCount} dlinfo=0x${ri.dlInfoOff.toString(16)}/${ri.dlInfoCount} bits0=0x${u32(root, sourceInfo.bitsOffsets[0]).toString(16)}/0x${u16(root, sourceInfo.bitsByteCounts[0]).toString(16)} bits1=0x${u32(root, sourceInfo.bitsOffsets[1]).toString(16)}/0x${u16(root, sourceInfo.bitsByteCounts[1]).toString(16)} bits2=0x${u32(root, sourceInfo.bitsOffsets[2]).toString(16)}/0x${u16(root, sourceInfo.bitsByteCounts[2]).toString(16)}; early4PaletteMode=${compactEarly4Palette ? "compactC16ToC8" : "expandedC16"}/colorBytes=0x${colorData.byteLength.toString(16)}/outClrCount=${outClrCount}; early4Repack=[${early4RepackDiag.length > 0 ? early4RepackDiag.join(" ; ") : "none"}]; early4DecodedLayerSets=L1=[${debugNumberSetForLog(layer1EarlyDLSet)}] L2=[${debugNumberSetForLog(layer2EarlyDLSet)}] special=[${debugNumberSetForLog(specialEarlyDLSet)}]; early4MissingGeneratedCalls=[${debugMissingLayerCallsForLog(copiedDLs.length, layerBits.layerCalls)}]; early4DLInfoSort=[${early4SortLayerDiag.length > 0 ? early4SortLayerDiag.join(",") : "none"}]; early4DLDiag=[${early4DLDiag.join(" ; ")}]` : "";
    return {
      raw: out,
      log: `visual copy source=${opts.earlyMapFormat}; EarlyDLs=${copiedDLs.length}/${earlyDLCount}; shaders=${shaderCount}/${earlyShaderCount}; bounds=earlyDLInfo; vcdDecoded=[${vcdDecodedFor.map((v) => `0x${v.toString(16)}`).join(",")}]; vcdRead=[${vcdReadFor.map((v) => `0x${v.toString(16)}`).join(",")}]; vcdUsed=[${vcdFor.map((v) => `0x${v.toString(16)}`).join(",")}];shaderFor=[${shaderFor.join(",")}]; infoShaderForDL=[${infoShaderForDL.join(",")}]; useInfoShader=${canUseInfoShader}; textureMode=${opts.textureMode}; ${nwastesMaterialLog}; ${early4CullDebugLog}; ${layer2WaterLog}; layerCalls=[${layerBits.layerCalls.map((xs) => xs.join("/")).join("|")}]; bitsLen=[${bitstream0.byteLength},${bitstream1.byteLength},${bitstream2.byteLength}]; tris=${triangles(root).length}/${ri.triCount}; y=${outputYTranslate}; oldLen=0x${final.byteLength.toString(16)} newLen=0x${out.byteLength.toString(16)}; earlyTex=[${srcTex.join(",")}]; mappedFromEarly=[${mappedFromEarly.join(",")}]; usedTex=[${mapped.join(",")}]; decodedBitOff=0x${decoded.bitOff.toString(16)} decodedCalls=${decoded.calls}${early4DiagLog}`
    };
  }
  function patchCollisionTriWinding(tris, mode, vertexBase = 0) {
    if (mode === "keep" && vertexBase === 0)
      return tris;
    const out = copyU8(tris);
    const addBase = (v) => {
      const n = v + vertexBase;
      if (n < 0 || n > 65535)
        throw new Error(`collision vertex index overflow: ${v}+${vertexBase}=${n}`);
      return n;
    };
    for (let o = 0; o + 8 <= out.byteLength; o += 8) {
      const v0 = addBase(u16(out, o + 0));
      const v1 = addBase(u16(out, o + 2));
      const v2 = addBase(u16(out, o + 4));
      const fl = u16(out, o + 6);
      if (mode === "swap12") {
        p16(out, o + 0, v0);
        p16(out, o + 2, v2);
        p16(out, o + 4, v1);
      } else if (mode === "swap01") {
        p16(out, o + 0, v1);
        p16(out, o + 2, v0);
        p16(out, o + 4, v2);
      } else if (mode === "swap02") {
        p16(out, o + 0, v2);
        p16(out, o + 2, v1);
        p16(out, o + 4, v0);
      } else {
        p16(out, o + 0, v0);
        p16(out, o + 2, v1);
        p16(out, o + 4, v2);
      }
      p16(out, o + 6, fl);
    }
    return out;
  }
  function transformBatchY(batch, yTranslate, mode) {
    if (mode === "none" || mode === "raw" || mode === "raw_scale8")
      return batch;
    const out = copyU8(batch);
    const pad = mode === "subtract_expand8" ? 8 : mode === "subtract_expand32" ? 32 : mode === "subtract_scale8_expand64" ? 64 : mode === "subtract_scale8_expand256" ? 256 : 0;
    for (let o = 0; o + 20 <= out.byteLength; o += 20) {
      const y0 = s16(out, o + 6);
      const y1 = s16(out, o + 8);
      const a = y0 - yTranslate;
      const b = y1 - yTranslate;
      ps16(out, o + 6, Math.min(a, b) - pad);
      ps16(out, o + 8, Math.max(a, b) + pad);
    }
    return out;
  }
  function ancientNextSectionOffset(root, start) {
    let best = root.byteLength;
    for (let o = 76; o <= 128; o += 4) {
      if (o + 4 > root.byteLength)
        continue;
      const off = u32(root, o);
      if (off > start && off <= root.byteLength && off < best)
        best = off;
    }
    return best;
  }
  function ancientCollisionInfo(root) {
    const triOff = u32(root, 76);
    const batchOff = u32(root, 80);
    if (triOff <= 0 || batchOff <= 0)
      return null;
    if (triOff >= root.byteLength || batchOff >= root.byteLength)
      return null;
    const triEnd = ancientNextSectionOffset(root, triOff);
    const batchEnd = ancientNextSectionOffset(root, batchOff);
    let triLen = triEnd - triOff;
    let batchLen = batchEnd - batchOff;
    triLen -= triLen % 8;
    batchLen -= batchLen % 20;
    const triCount = triLen / 8 | 0;
    const batchCount = batchLen / 20 | 0;
    if (triCount <= 0 || batchCount <= 0)
      return null;
    return {
      triOff,
      triLen,
      triCount,
      batchOff,
      batchLen,
      batchCount
    };
  }
  function writeCollisionTriRecord(out, o, a, b, c, fl, winding) {
    if (winding === "swap12") {
      p16(out, o + 0, a);
      p16(out, o + 2, c);
      p16(out, o + 4, b);
    } else if (winding === "swap01") {
      p16(out, o + 0, b);
      p16(out, o + 2, a);
      p16(out, o + 4, c);
    } else if (winding === "swap02") {
      p16(out, o + 0, c);
      p16(out, o + 2, b);
      p16(out, o + 4, a);
    } else {
      p16(out, o + 0, a);
      p16(out, o + 2, b);
      p16(out, o + 4, c);
    }
    p16(out, o + 6, fl);
  }
  function patchResourceCollisionFromAncient(base, ancient, yMode, winding) {
    if (yMode === "none")
      return { raw: base, log: "ancient collision disabled" };
    const info = ancientCollisionInfo(ancient);
    if (info === null)
      return { raw: base, log: "ancient collision not found; kept final collision" };
    const ai = ancientInfo(ancient);
    let out = copyU8(base);
    const sourceYTranslate = computeYFromPositionTable(ancient, ai.posOff, ai.posCount);
    const outputYTranslate = s16(out, 142);
    const finalPosOff = u32(out, 88);
    const finalPosCount = u16(out, 144);
    const finalPosLen = finalPosCount * 6;
    if (finalPosOff <= 0 || finalPosOff + finalPosLen > out.byteLength) {
      throw new Error(
        `bad final position table before Ancient collision copy: posOff=0x${finalPosOff.toString(16)} posCount=${finalPosCount} len=0x${out.byteLength.toString(16)}`
      );
    }
    const ancientTriStride = 16;
    const ancientTriCountFromHeader = u16(ancient, 142);
    const ancientTriCount = ancientTriCountFromHeader > 0 && info.triOff + ancientTriCountFromHeader * ancientTriStride <= ancient.byteLength ? ancientTriCountFromHeader : Math.floor(info.triLen / ancientTriStride);
    if (ancientTriCount <= 0) {
      throw new Error(
        `Ancient collision has no 0x10 triangle records: triOff=0x${info.triOff.toString(16)} triLen=0x${info.triLen.toString(16)} headerCount=${ancientTriCountFromHeader}`
      );
    }
    const compactTris = new Uint8Array(ancientTriCount * 8);
    let maxVertex = 0;
    let degenerate = 0;
    let planeMax = 0;
    let flagMin = 65535;
    let flagMax = 0;
    for (let i = 0; i < ancientTriCount; i++) {
      const src = info.triOff + i * ancientTriStride;
      const dst = i * 8;
      const v0 = u16(ancient, src + 0);
      const v1 = u16(ancient, src + 2);
      const v2 = u16(ancient, src + 4);
      const plane0 = u16(ancient, src + 6);
      const plane1 = u16(ancient, src + 8);
      const plane2 = u16(ancient, src + 10);
      const plane3 = u16(ancient, src + 12);
      const fl = u16(ancient, src + 14);
      maxVertex = Math.max(maxVertex, v0, v1, v2);
      planeMax = Math.max(planeMax, plane0, plane1, plane2, plane3);
      flagMin = Math.min(flagMin, fl);
      flagMax = Math.max(flagMax, fl);
      if (v0 >= finalPosCount || v1 >= finalPosCount || v2 >= finalPosCount) {
        throw new Error(
          `Ancient collision tri vertex OOB: tri=${i} verts=[${v0},${v1},${v2}] finalPosCount=${finalPosCount} ancientPosCount=${ai.posCount} triOff=0x${info.triOff.toString(16)}`
        );
      }
      if (v0 === v1 || v1 === v2 || v2 === v0)
        degenerate++;
      writeCollisionTriRecord(compactTris, dst, v0, v1, v2, fl, winding);
    }
    if (flagMin === 65535)
      flagMin = 0;
    const ancientBatchRaw = ancient.slice(info.batchOff, info.batchOff + info.batchLen);
    const patchedBatch = transformBatchY(ancientBatchRaw, sourceYTranslate, yMode);
    const appendOff = align(out.byteLength, 32);
    out = growTo(out, appendOff);
    const newBatchOff = appendOff;
    const newTriOff = newBatchOff + patchedBatch.byteLength;
    out = setBytes(out, newBatchOff, patchedBatch);
    out = setBytes(out, newTriOff, compactTris);
    out = growTo(out, align(out.byteLength, 32));
    p32(out, 76, newTriOff);
    p32(out, 80, newBatchOff);
    p16(out, 152, ancientTriCount);
    p16(out, 154, Math.max(0, info.batchCount - 1));
    p32(out, 8, out.byteLength);
    return {
      raw: out,
      log: `ancient collision copied REAL_0x10_TRI_TABLE_FIXED_FLAGS yMode=${yMode} sourceYTranslate=${sourceYTranslate} outputYTranslate=${outputYTranslate} winding=${winding} triStride=0x10->0x08 ancientFlagSource=word0x0E ignoredAncientPlaneWords=0x06/0x08/0x0A/0x0C headerTriCount=${ancientTriCountFromHeader} finalTriCount=${ancientTriCount} maxVertex=${maxVertex} planeMax=${planeMax} flagRange=0x${flagMin.toString(16)}-0x${flagMax.toString(16)} degenerate=${degenerate} finalPosCount=${finalPosCount} ancientPosCount=${ai.posCount} batch=0x${info.batchOff.toString(16)}->0x${newBatchOff.toString(16)} batchLen=0x${info.batchLen.toString(16)} batchCount=${info.batchCount} tri=0x${info.triOff.toString(16)}->0x${newTriOff.toString(16)} oldTriLen=0x${info.triLen.toString(16)} newTriLen=0x${compactTris.byteLength.toString(16)}`
    };
  }
  function patchResourceCollision(base, early, yMode, winding) {
    if (yMode === "none")
      return { raw: base, log: "collision disabled" };
    const ri = earlyInfo(early);
    const earlyBatchOff = ri.batchOff;
    const earlyTriOff = ri.triOff;
    const earlyTriCount = ri.triCount;
    const earlyBatchCount = ri.batchCountMinus1 + 1;
    const batchLen = earlyBatchCount * 20;
    const triLen = earlyTriCount * 8;
    if (earlyBatchOff + batchLen > early.byteLength || earlyTriOff + triLen > early.byteLength)
      throw new Error(`early collision OOB batch=0x${earlyBatchOff.toString(16)}+0x${batchLen.toString(16)} tri=0x${earlyTriOff.toString(16)}+0x${triLen.toString(16)} len=0x${early.byteLength.toString(16)}`);
    let out = copyU8(base);
    const yTranslate = computeY(early, ri);
    const earlyBatch = transformBatchY(early.slice(earlyBatchOff, earlyBatchOff + batchLen), yTranslate, yMode);
    const earlyTris = patchCollisionTriWinding(early.slice(earlyTriOff, earlyTriOff + triLen), winding);
    const appendOff = align(out.byteLength, 32);
    out = growTo(out, appendOff);
    const newBatchOff = appendOff;
    const newTriOff = newBatchOff + earlyBatch.byteLength;
    out = setBytes(out, newBatchOff, earlyBatch);
    out = setBytes(out, newTriOff, earlyTris);
    out = growTo(out, align(out.byteLength, 32));
    p32(out, 76, newTriOff);
    p32(out, 80, newBatchOff);
    p16(out, 152, earlyTriCount);
    p16(out, 154, ri.batchCountMinus1);
    p32(out, 8, out.byteLength);
    return {
      raw: out,
      log: `collision yMode=${yMode} yTranslate=${yTranslate} winding=${winding}; batch 0x${earlyBatchOff.toString(16)}->0x${newBatchOff.toString(16)} len=0x${batchLen.toString(16)}; tri 0x${earlyTriOff.toString(16)}->0x${newTriOff.toString(16)} count=${earlyTriCount}`
    };
  }
  async function convertEarly1ArchiveToFinalMapZlb(earlyBinIn, earlyTabIn, finalZlbBinIn, finalTabIn, options = {}) {
    const opts = {
      modelId: options.modelId ?? 0,
      outBaseName: options.outBaseName ?? "mod",
      earlyMapFormat: options.earlyMapFormat ?? "early1_raw",
      groupMode: options.groupMode ?? "nibble0",
      colorMode: options.colorMode ?? "pidx",
      textureMode: options.textureMode ?? "mapped",
      flatTextureId: options.flatTextureId ?? 1038,
      flatTexS: options.flatTexS ?? 256,
      flatTexT: options.flatTexT ?? 256,
      collisionYMode: options.collisionYMode ?? "subtract",
      collisionWinding: options.collisionWinding ?? "keep",
      maxTrisPerDL: options.maxTrisPerDL ?? 128,
      objectsEnabled: options.objectsEnabled ?? true,
      objectMapId: options.objectMapId ?? options.modelId ?? 0,
      keepObjectTypes: options.keepObjectTypes ?? [13, 76],
      mapsBin: options.mapsBin,
      mapsTab: options.mapsTab,
      hitsEnabled: options.hitsEnabled ?? true,
      hitsBin: options.hitsBin,
      hitsTab: options.hitsTab
    };
    const earlyBin = asU8(earlyBinIn);
    const earlyTab = asU8(earlyTabIn);
    const finalZlbBin = asU8(finalZlbBinIn);
    const finalTab = asU8(finalTabIn);
    const finalArc = await readZlbArchive(finalZlbBin, finalTab);
    const rootArc = readEarlyMapSourceArchive(earlyBin, earlyTab, opts.earlyMapFormat);
    const outDataParts = [];
    const logs = [];
    const processed = [];
    const hitResourceIdsToDisable = [];
    let cursor = 0;
    const ancientSource = opts.earlyMapFormat === "ancient_blocks";
    const firstFinalResourceId = finalArc.ids.length > 0 ? finalArc.ids[0] : 0;
    const firstEarlyResourceId = rootArc.ids.length > 0 ? rootArc.ids[0] : 0;
    const prePatchMapsBin = opts.mapsBin !== void 0 ? asU8(opts.mapsBin) : void 0;
    const prePatchMapsTab = opts.mapsTab !== void 0 ? asU8(opts.mapsTab) : void 0;
    const outTab = copyU8(finalArc.tab);
    let mapsGridFirstResourceId = firstFinalResourceId;
    if (ancientSource && opts.modelId === 16) {
      const inferredWarlockBase = prePatchMapsBin !== void 0 && prePatchMapsTab !== void 0 ? inferWarlockFinalResourceBaseFromExistingMaps(prePatchMapsBin, prePatchMapsTab) : null;
      mapsGridFirstResourceId = inferredWarlockBase !== null ? inferredWarlockBase.firstFinalResourceId : 960;
      logs.push(
        `ancient Warlock MAPS grid base: mapsGridBase=0x${mapsGridFirstResourceId.toString(16)} selectedFinalRange=0x${firstFinalResourceId.toString(16)}..0x${(finalArc.ids[finalArc.ids.length - 1] ?? firstFinalResourceId).toString(16)}` + (inferredWarlockBase !== null ? ` mapsGridRange=0x${inferredWarlockBase.minRid.toString(16)}..0x${inferredWarlockBase.maxRid.toString(16)} mapsGridCount=${inferredWarlockBase.distinctCount}` : ` mapsGridBaseFallback=0x3c0`) + ` output TAB IDs are not rebased`
      );
    }
    const finalWaterPrototype = ancientSource ? findFinalWaterShaderPrototypeInArchive(finalArc.blocks) : null;
    if (ancientSource && opts.modelId === 16) {
      logs.push(
        `ancient Warlock validation skipped: using selected Final archive range 0x${firstFinalResourceId.toString(16)}..0x${(finalArc.ids[finalArc.ids.length - 1] ?? firstFinalResourceId).toString(16)}`
      );
    }
    if (ancientSource) {
      logs.push(
        `ancient resource mapping: finalFirstRid=${firstFinalResourceId} / 0x${firstFinalResourceId.toString(16)} modelBase=0x${(ANCIENT_TRKBLK[opts.modelId] ?? -1).toString(16)} modelId=${opts.modelId}`
      );
      logs.push(
        finalWaterPrototype !== null ? `final water shader prototype: resource=${finalWaterPrototype.resourceId} / 0x${finalWaterPrototype.resourceId.toString(16)} shader=${finalWaterPrototype.shaderIndex} flags=0x${finalWaterPrototype.flags.toString(16)} texIds=[${finalWaterPrototype.texIds.join(",")}]` : `final water shader prototype: none found`
      );
    }
    for (const rid of finalArc.ids) {
      let raw = finalArc.blocks.get(rid);
      const finalSubIndex = ancientSubIndexForFinalResource(
        rid,
        firstFinalResourceId
      );
      const sourceRid = ancientSource ? ancientBlockResourceIdForFinalSub(
        opts.modelId,
        finalSubIndex
      ) : opts.earlyMapFormat === "early4_lzo" ? firstEarlyResourceId + finalSubIndex : rid;
      const outputRid = rid;
      hitResourceIdsToDisable.push(outputRid);
      if (ancientSource && opts.modelId === 16)
        hitResourceIdsToDisable.push(mapsGridFirstResourceId + finalSubIndex);
      const early = rootArc.blocks.get(sourceRid);
      if (early) {
        const vis = ancientSource ? rebuildResourceAppendAncient(
          early,
          raw,
          {
            modelId: opts.modelId,
            outBaseName: opts.outBaseName,
            textureMode: opts.textureMode,
            flatTextureId: opts.flatTextureId,
            flatTexS: opts.flatTexS,
            flatTexT: opts.flatTexT,
            collisionYMode: opts.collisionYMode
          },
          finalWaterPrototype
        ) : rebuildResourceAppend(
          early,
          raw,
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
            collisionYMode: opts.collisionYMode
          }
        );
        raw = vis.raw;
        logs.push(
          ancientSource ? `id ${outputRid}: inputFinalId=${rid} finalSub=${finalSubIndex} -> Ancient BLOCKS resource ${sourceRid} / 0x${sourceRid.toString(16)}: ${vis.log}` : `id ${rid}: ${vis.log}`
        );
        if (ancientSource) {
          const col = patchResourceCollisionFromAncient(
            raw,
            early,
            opts.collisionYMode,
            opts.collisionWinding
          );
          raw = col.raw;
          logs.push(`id ${rid}: ${col.log}`);
        } else if (opts.collisionYMode !== "none") {
          const col = patchResourceCollision(raw, early, opts.collisionYMode, opts.collisionWinding);
          raw = col.raw;
          logs.push(`id ${rid}: ${col.log}`);
        }
        processed.push(outputRid);
      } else {
        logs.push(
          ancientSource ? `id ${outputRid}: inputFinalId=${rid} finalSub=${finalSubIndex} -> no Ancient BLOCKS resource ${sourceRid} / 0x${sourceRid.toString(16)}, kept final` : `id ${rid}: no matching Early block, kept final`
        );
      }
      const z = await writeZlb(raw);
      if (outputRid * 4 + 4 > outTab.byteLength)
        throw new Error(`output resource 0x${outputRid.toString(16)} outside generated TAB`);
      p32(outTab, outputRid * 4, TAB_FLAG | cursor);
      outDataParts.push(z);
      cursor += z.byteLength;
    }
    const outData = new Uint8Array(cursor);
    let p = 0;
    for (const part of outDataParts) {
      outData.set(part, p);
      p += part.byteLength;
    }
    logs.push(`final_ids=[${finalArc.ids.join(",")}]`);
    logs.push(`early_format=${opts.earlyMapFormat}`);
    logs.push(`early_ids=[${rootArc.ids.join(",")}]`);
    logs.push(`processed=[${processed.join(",")}]`);
    logs.push(`output ${opts.outBaseName}.zlb.bin bytes=${outData.byteLength}, ${opts.outBaseName}.tab bytes=${outTab.byteLength}`);
    let patchedMapsBin = void 0;
    let patchedMapsTab = void 0;
    let workingMapsBin = prePatchMapsBin;
    let workingMapsTab = prePatchMapsTab;
    let mapsTouched = false;
    const wantsAncientWarlockMapsPatch = ancientSource && opts.modelId === 16;
    if (wantsAncientWarlockMapsPatch) {
      if (workingMapsBin !== void 0 && workingMapsTab !== void 0) {
        const patched = patchSfaMapsAncientWarlockLayoutAndVisibility(
          workingMapsBin,
          workingMapsTab,
          mapsGridFirstResourceId
        );
        workingMapsBin = patched.mapsBin;
        workingMapsTab = patched.mapsTab;
        mapsTouched = true;
        logs.push(patched.log);
      } else {
        logs.push(
          `ancient Warlock MAPS layout skipped: select SFA MAPS.bin and SFA MAPS.tab to auto-patch the working layout`
        );
      }
    }
    if (opts.objectsEnabled === false) {
      if (workingMapsBin === void 0 || workingMapsTab === void 0)
        throw new Error("objects disabled, but SFA MAPS.bin / MAPS.tab were not provided");
      const objectMapIdForPatch = wantsAncientWarlockMapsPatch ? SFA_MAP_ID_WARLOCK : opts.objectMapId ?? opts.modelId;
      const patched = await patchSfaMapsObjectsForMap(
        workingMapsBin,
        workingMapsTab,
        objectMapIdForPatch,
        opts.keepObjectTypes ?? [13, 76]
      );
      workingMapsBin = patched.mapsBin;
      workingMapsTab = patched.mapsTab;
      mapsTouched = true;
      logs.push(patched.log);
    } else {
      logs.push(
        mapsTouched ? "objects enabled: MAPS layout/visibility patched; object list not modified" : "objects enabled: SFA MAPS.bin/MAPS.tab not modified"
      );
    }
    if (mapsTouched) {
      if (workingMapsBin === void 0 || workingMapsTab === void 0)
        throw new Error("internal MAPS patch state lost MAPS.bin / MAPS.tab");
      patchedMapsBin = workingMapsBin;
      patchedMapsTab = workingMapsTab;
    }
    let patchedHitsBin = void 0;
    let patchedHitsTab = void 0;
    if (opts.hitsEnabled === false) {
      if (opts.hitsBin === void 0 || opts.hitsTab === void 0)
        throw new Error("HITS disabled, but SFA HITS.bin / HITS.tab were not provided");
      const patchedHits = patchSfaHitsDisableResourceIds(
        opts.hitsBin,
        opts.hitsTab,
        hitResourceIdsToDisable
      );
      patchedHitsBin = patchedHits.hitsBin;
      patchedHitsTab = patchedHits.hitsTab;
      logs.push(patchedHits.log);
    } else {
      logs.push("HITS enabled: SFA HITS.bin/HITS.tab not modified");
    }
    return {
      zlbBin: outData,
      tab: outTab,
      logs,
      processedResourceIds: processed,
      mapsBin: patchedMapsBin,
      mapsTab: patchedMapsTab,
      hitsBin: patchedHitsBin,
      hitsTab: patchedHitsTab
    };
  }
  async function convertAncientBlocksArchiveToFinalMapZlb(blocksBinIn, blocksTabIn, finalZlbBinIn, finalTabIn, options = {}) {
    return convertEarly1ArchiveToFinalMapZlb(
      blocksBinIn,
      blocksTabIn,
      finalZlbBinIn,
      finalTabIn,
      {
        ...options,
        earlyMapFormat: "ancient_blocks"
      }
    );
  }
  async function convertEarly3ArchiveToFinalMapZlb(earlyBinIn, earlyTabIn, finalZlbBinIn, finalTabIn, options = {}) {
    return convertEarly1ArchiveToFinalMapZlb(
      earlyBinIn,
      earlyTabIn,
      finalZlbBinIn,
      finalTabIn,
      {
        ...options,
        earlyMapFormat: "early3_raw"
      }
    );
  }
  async function convertEarly4ArchiveToFinalMapZlb(earlyBinIn, earlyTabIn, finalZlbBinIn, finalTabIn, options = {}) {
    return convertEarly1ArchiveToFinalMapZlb(
      earlyBinIn,
      earlyTabIn,
      finalZlbBinIn,
      finalTabIn,
      {
        ...options,
        earlyMapFormat: "early4_lzo"
      }
    );
  }
  function downloadBytes(filename, data) {
    const blob = new Blob([toBlobBuffer(data)], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2e3);
  }
  function readFile(file) {
    if (!file)
      throw new Error("missing file input");
    return file.arrayBuffer();
  }
  function readOptionalFile(file) {
    if (!file)
      return Promise.resolve(void 0);
    return file.arrayBuffer();
  }
  function normalizeTexturePngKey(name) {
    const leaf = name.split(/[\\/]/g).pop() ?? name;
    return leaf.replace(/\.png$/i, "").trim().toLowerCase();
  }
  function parseTextureInjectMappingText(text) {
    const out = new Map();
    for (const rawLine of text.split(/\r?\n/g)) {
      const line = rawLine.replace(/\/\/.*$/g, "").replace(/#.*$/g, "").trim();
      if (line.length === 0)
        continue;
      const m = /^(.+?)(?:->|=|:)(.+)$/.exec(line);
      if (!m)
        throw new Error(`bad texture mapping line "${rawLine}". Use PNG_ID=TARGET_ID, e.g. 618=612`);
      const srcKey = normalizeTexturePngKey(m[1]);
      const targetTexId = parseMaybeHexInt(m[2], -1);
      if (srcKey.length === 0)
        throw new Error(`bad empty PNG name in texture mapping line "${rawLine}"`);
      if (targetTexId < 0)
        throw new Error(`bad target texture ID in texture mapping line "${rawLine}"`);
      out.set(srcKey, targetTexId);
    }
    return out;
  }
  async function buildTextureInjectEntriesFromFiles(files, mappingText) {
    const fileArray = Array.prototype.slice.call(files ?? []);
    const mapping = parseTextureInjectMappingText(mappingText);
    const entries = [];
    const seenKeys = new Set();
    for (const file of fileArray) {
      const key = normalizeTexturePngKey(file.name);
      const targetTexId = mapping.get(key) ?? parseMaybeHexInt(key, -1);
      if (targetTexId < 0) {
        throw new Error(
          `no texture target for PNG "${file.name}". Either name it like 612.png or add a mapping line like ${key}=612`
        );
      }
      seenKeys.add(key);
      entries.push({
        targetTexId,
        png: new Uint8Array(await file.arrayBuffer()),
        name: file.name
      });
    }
    void seenKeys;
    return entries;
  }
  function fileInput(label, accept) {
    const wrap = document.createElement("label");
    wrap.style.display = "grid";
    wrap.style.gap = "2px";
    wrap.style.fontSize = "11px";
    wrap.textContent = label;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.fontSize = "11px";
    wrap.appendChild(input);
    return { wrap, input };
  }
  function multiFileInput(label, accept) {
    const wrap = document.createElement("label");
    wrap.style.display = "grid";
    wrap.style.gap = "2px";
    wrap.style.fontSize = "11px";
    wrap.textContent = label;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = true;
    input.style.fontSize = "11px";
    wrap.appendChild(input);
    return { wrap, input };
  }
  function selectInput(label, values, def) {
    const wrap = document.createElement("label");
    wrap.style.display = "grid";
    wrap.style.gap = "2px";
    wrap.style.fontSize = "11px";
    wrap.textContent = label;
    const input = document.createElement("select");
    input.style.fontSize = "11px";
    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      input.appendChild(opt);
    }
    input.value = def;
    wrap.appendChild(input);
    return { wrap, input };
  }
  function installEarly1FinalMapConverterPanel(parent = document.body) {
    if (typeof document === "undefined")
      return null;
    const existing = document.getElementById("early1-finalmap-converter-panel");
    if (existing)
      return existing;
    const panel = document.createElement("div");
    panel.id = "early1-finalmap-converter-panel";
    panel.style.position = "fixed";
    panel.style.right = "8px";
    panel.style.bottom = "8px";
    panel.style.zIndex = "999999";
    panel.style.pointerEvents = "auto";
    panel.style.userSelect = "auto";
    panel.style.width = "300px";
    panel.style.maxHeight = "85vh";
    panel.style.overflow = "auto";
    panel.style.background = "rgba(0,0,0,0.88)";
    panel.style.color = "white";
    panel.style.border = "1px solid rgba(255,255,255,0.25)";
    panel.style.borderRadius = "8px";
    panel.style.padding = "8px";
    panel.style.fontFamily = "monospace";
    panel.style.fontSize = "12px";
    panel.style.boxShadow = "0 4px 24px rgba(0,0,0,0.55)";
    const title = document.createElement("div");
    title.textContent = "Early1/Early3/Early4 -> Final ZLB";
    title.style.fontWeight = "bold";
    title.style.marginBottom = "6px";
    panel.appendChild(title);
    const earlyBin = fileInput("Early source root_modXX.bin OR Ancient BLOCKS.bin", ".bin");
    const earlyTab = fileInput("Early source root_modXX.tab OR Ancient BLOCKS.tab", ".tab");
    const finalBin = fileInput("Final modXX.zlb.bin", ".bin");
    const finalTab = fileInput("Final modXX.tab", ".tab");
    const mapsBin = fileInput("SFA MAPS.bin optional", ".bin");
    const mapsTab = fileInput("SFA MAPS.tab optional", ".tab");
    const hitsBin = fileInput("SFA HITS.bin optional", ".bin");
    const hitsTab = fileInput("SFA HITS.tab optional", ".tab");
    const texBin = fileInput("SFA TEX archive .bin optional", ".bin");
    const texTab = fileInput("SFA TEX archive .tab optional", ".tab");
    const texPngs = multiFileInput("PNG textures to inject optional", ".png");
    panel.appendChild(earlyBin.wrap);
    panel.appendChild(earlyTab.wrap);
    panel.appendChild(finalBin.wrap);
    panel.appendChild(finalTab.wrap);
    panel.appendChild(mapsBin.wrap);
    panel.appendChild(mapsTab.wrap);
    panel.appendChild(hitsBin.wrap);
    panel.appendChild(hitsTab.wrap);
    panel.appendChild(texBin.wrap);
    panel.appendChild(texTab.wrap);
    panel.appendChild(texPngs.wrap);
    const texMapLabel = document.createElement("label");
    texMapLabel.style.display = "grid";
    texMapLabel.style.gap = "2px";
    texMapLabel.style.fontSize = "11px";
    texMapLabel.textContent = "PNG -> final texture ID map";
    const texMapInput = document.createElement("textarea");
    texMapInput.style.fontSize = "11px";
    texMapInput.style.height = "78px";
    texMapInput.style.background = "rgba(255,255,255,0.08)";
    texMapInput.style.color = "white";
    texMapInput.style.boxSizing = "border-box";
    texMapInput.value = `ribbon=619

walls=618
floor1=617
pillar=616
transwall=615
support=614
chain=613
head=612
krazfloor=611
decor1=610
floor2=609
ceiling1=608
walls2=607
pillar2=606
wood=605
button=604
sash=603
floor3=602
vines=601
walls3=600
block=599
innerdoor=598
stained=597
spire=596
crates=595

sabrestart=591
walls4=590
floor4=589
floor5=588
walls5=587
kraz=586
black=585
transring=584
spire2=583
kraz2=582
kraz3=581
port=580
floor6=579`;
    texMapLabel.appendChild(texMapInput);
    panel.appendChild(texMapLabel);
    const earlyFormat = selectInput("source format", ["early1_raw", "early3_raw", "early4_lzo", "ancient_blocks"], "early1_raw");
    panel.appendChild(earlyFormat.wrap);
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "1fr 1fr";
    row.style.gap = "4px";
    row.style.marginTop = "6px";
    const modelLabel = document.createElement("label");
    modelLabel.style.display = "grid";
    modelLabel.style.gap = "2px";
    modelLabel.textContent = "map/model ID hex/dec";
    const modelInput = document.createElement("input");
    modelInput.type = "text";
    modelInput.value = "16";
    modelInput.style.fontSize = "11px";
    modelLabel.appendChild(modelInput);
    const nameLabel = document.createElement("label");
    nameLabel.style.display = "grid";
    nameLabel.style.gap = "2px";
    nameLabel.textContent = "output basename";
    const nameInput = document.createElement("input");
    nameInput.value = "mod16";
    nameInput.style.fontSize = "11px";
    nameLabel.appendChild(nameInput);
    row.appendChild(modelLabel);
    row.appendChild(nameLabel);
    panel.appendChild(row);
    const group = selectInput("visual grouping", ["single", "nibble0", "nibble1", "nibble2", "nibble3"], "nibble0");
    const color = selectInput("color mode", ["pidx", "zero", "neutral_shade"], "pidx");
    const texMode = selectInput("texture mode", ["mapped", "viewer_textureless", "pseudo_textureless"], "mapped");
    const flatTexLabel = document.createElement("label");
    flatTexLabel.style.display = "grid";
    flatTexLabel.style.gap = "2px";
    flatTexLabel.style.fontSize = "11px";
    flatTexLabel.textContent = "flat texture ID";
    const flatTexInput = document.createElement("input");
    flatTexInput.type = "number";
    flatTexInput.value = "1038";
    flatTexInput.style.fontSize = "11px";
    flatTexLabel.appendChild(flatTexInput);
    const flatUVRow = document.createElement("div");
    flatUVRow.style.display = "grid";
    flatUVRow.style.gridTemplateColumns = "1fr 1fr";
    flatUVRow.style.gap = "4px";
    const flatSLabel = document.createElement("label");
    flatSLabel.style.display = "grid";
    flatSLabel.style.gap = "2px";
    flatSLabel.style.fontSize = "11px";
    flatSLabel.textContent = "flat S";
    const flatSInput = document.createElement("input");
    flatSInput.type = "number";
    flatSInput.value = "256";
    flatSInput.style.fontSize = "11px";
    flatSLabel.appendChild(flatSInput);
    const flatTLabel = document.createElement("label");
    flatTLabel.style.display = "grid";
    flatTLabel.style.gap = "2px";
    flatTLabel.style.fontSize = "11px";
    flatTLabel.textContent = "flat T";
    const flatTInput = document.createElement("input");
    flatTInput.type = "number";
    flatTInput.value = "256";
    flatTInput.style.fontSize = "11px";
    flatTLabel.appendChild(flatTInput);
    flatUVRow.appendChild(flatSLabel);
    flatUVRow.appendChild(flatTLabel);
    const cy = selectInput(
      "collision Y",
      [
        "none",
        "raw",
        "raw_scale8",
        "subtract",
        "subtract_scale8",
        "subtract_expand8",
        "subtract_expand32",
        "subtract_scale8_expand64",
        "subtract_scale8_expand256"
      ],
      "subtract"
    );
    const cw = selectInput("collision winding", ["keep", "swap12", "swap01", "swap02"], "keep");
    const objectMode = selectInput(
      "SFA MAPS objects",
      ["enabled", "disabled_keep_list"],
      "enabled"
    );
    const hitsMode = selectInput(
      "SFA HITS special collision",
      ["enabled", "disabled_for_selected_map_blocks"],
      "enabled"
    );
    const objectMapLabel = document.createElement("label");
    objectMapLabel.style.display = "grid";
    objectMapLabel.style.gap = "2px";
    objectMapLabel.style.fontSize = "11px";
    objectMapLabel.textContent = "SFA object map ID hex/dec";
    const objectMapInput = document.createElement("input");
    objectMapInput.type = "text";
    objectMapInput.placeholder = "blank = map/model ID";
    objectMapInput.style.fontSize = "11px";
    objectMapLabel.appendChild(objectMapInput);
    const keepObjLabel = document.createElement("label");
    keepObjLabel.style.display = "grid";
    keepObjLabel.style.gap = "2px";
    keepObjLabel.style.fontSize = "11px";
    keepObjLabel.textContent = "keep these object types in-place hex";
    const keepObjInput = document.createElement("input");
    keepObjInput.value = "";
    keepObjInput.placeholder = "extra keeps only, e.g. 0012,00AB";
    keepObjInput.style.fontSize = "11px";
    keepObjLabel.appendChild(keepObjInput);
    panel.appendChild(group.wrap);
    panel.appendChild(color.wrap);
    panel.appendChild(texMode.wrap);
    panel.appendChild(flatTexLabel);
    panel.appendChild(flatUVRow);
    panel.appendChild(cy.wrap);
    panel.appendChild(cw.wrap);
    panel.appendChild(objectMode.wrap);
    panel.appendChild(hitsMode.wrap);
    panel.appendChild(objectMapLabel);
    panel.appendChild(keepObjLabel);
    const convertButton = document.createElement("button");
    convertButton.textContent = "Convert + download";
    convertButton.style.marginTop = "8px";
    convertButton.style.width = "100%";
    convertButton.style.padding = "6px";
    panel.appendChild(convertButton);
    const log = document.createElement("textarea");
    log.readOnly = true;
    log.style.marginTop = "6px";
    log.style.width = "100%";
    log.style.height = "120px";
    log.style.boxSizing = "border-box";
    log.style.fontSize = "11px";
    log.style.background = "rgba(255,255,255,0.08)";
    log.style.color = "white";
    log.value = "Preset: FULL_group_nibble0_PLUS_collision_subtract_keep\n";
    panel.appendChild(log);
    finalBin.input.addEventListener("change", () => {
      autoFillConverterFromFinalFile(
        finalBin.input.files?.[0] ?? null,
        modelInput,
        nameInput,
        objectMapInput,
        log
      );
    });
    convertButton.onclick = async () => {
      try {
        convertButton.disabled = true;
        log.value = "Reading files...\n";
        const objectPatchDisabled = objectMode.input.value !== "enabled";
        const objectMapText = objectMapInput.value.trim();
        if (objectPatchDisabled && objectMapText.length === 0) {
          throw new Error(
            "SFA MAPS objects are disabled, but no SFA object map ID was entered. Dragon Rock is 02. Do not leave this blank unless you really want it to use map/model ID."
          );
        }
        const sfaObjectMapId = objectPatchDisabled ? parseSfaMapId(objectMapText, 0) : 0;
        const hitsPatchDisabled = hitsMode.input.value !== "enabled";
        if (hitsPatchDisabled && ((hitsBin.input.files?.length ?? 0) === 0 || (hitsTab.input.files?.length ?? 0) === 0)) {
          throw new Error(
            "SFA HITS special collision is disabled, but no SFA HITS.bin / HITS.tab was selected."
          );
        }
        const result = await convertEarly1ArchiveToFinalMapZlb(
          await readFile(earlyBin.input.files?.[0] ?? null),
          await readFile(earlyTab.input.files?.[0] ?? null),
          await readFile(finalBin.input.files?.[0] ?? null),
          await readFile(finalTab.input.files?.[0] ?? null),
          {
            modelId: parseMaybeHexInt(modelInput.value, 0),
            outBaseName: nameInput.value || "mod",
            earlyMapFormat: earlyFormat.input.value,
            groupMode: group.input.value,
            colorMode: color.input.value,
            textureMode: texMode.input.value,
            flatTextureId: parseInt(flatTexInput.value, 10) || 1038,
            flatTexS: parseInt(flatSInput.value, 10) || 0,
            flatTexT: parseInt(flatTInput.value, 10) || 0,
            collisionYMode: cy.input.value,
            collisionWinding: cw.input.value,
            maxTrisPerDL: 128,
            objectsEnabled: !objectPatchDisabled,
            objectMapId: sfaObjectMapId,
            keepObjectTypes: parseHexObjectKeepList(keepObjInput.value),
            mapsBin: await readOptionalFile(mapsBin.input.files?.[0] ?? null),
            mapsTab: await readOptionalFile(mapsTab.input.files?.[0] ?? null),
            hitsEnabled: !hitsPatchDisabled,
            hitsBin: await readOptionalFile(hitsBin.input.files?.[0] ?? null),
            hitsTab: await readOptionalFile(hitsTab.input.files?.[0] ?? null)
          }
        );
        const base = nameInput.value || "mod";
        const finalLogs = result.logs.slice();
        downloadBytes(`${base}.zlb.bin`, result.zlbBin);
        downloadBytes(`${base}.tab`, result.tab);
        if (result.mapsBin && result.mapsTab) {
          downloadBytes(`${base}_MAPS_patched.bin`, result.mapsBin);
          downloadBytes(`${base}_MAPS_patched.tab`, result.mapsTab);
        }
        if (result.hitsBin && result.hitsTab) {
          downloadBytes(`${base}_HITS_patched.bin`, result.hitsBin);
          downloadBytes(`${base}_HITS_patched.tab`, result.hitsTab);
        }
        const wantsTextureInject = (texBin.input.files?.length ?? 0) > 0 || (texTab.input.files?.length ?? 0) > 0 || (texPngs.input.files?.length ?? 0) > 0;
        if (wantsTextureInject) {
          const texBinFile = texBin.input.files?.[0] ?? null;
          const texTabFile = texTab.input.files?.[0] ?? null;
          if (!texBinFile)
            throw new Error("PNG texture injection requested, but no SFA TEX archive .bin was selected");
          if (!texTabFile)
            throw new Error("PNG texture injection requested, but no SFA TEX archive .tab was selected");
          const texEntries = await buildTextureInjectEntriesFromFiles(
            texPngs.input.files,
            texMapInput.value
          );
          if (texEntries.length === 0)
            throw new Error("PNG texture injection requested, but no PNG files were selected");
          const texResult = await patchSfaTextureArchiveWithPngs(
            await readFile(texBinFile),
            await readFile(texTabFile),
            texEntries
          );
          const texBase = texBinFile.name.replace(/\.bin$/i, "");
          downloadBytes(`${texBase}_patched.bin`, texResult.texBin);
          downloadBytes(`${texBase}_patched.tab`, texResult.texTab);
          finalLogs.push(
            `texture archive patched: ${texBinFile.name} / ${texTabFile.name}`,
            `downloaded ${texBase}_patched.bin / ${texBase}_patched.tab`,
            ...texResult.logs
          );
        } else {
          finalLogs.push("texture archive injection skipped: no TEX bin/tab/PNGs selected");
        }
        log.value = finalLogs.join("\n");
        console.warn("[EARLY1 FINALMAP CONVERT]", finalLogs.join("\n"));
      } catch (e) {
        console.error(e);
        log.value = String(e?.stack ?? e?.message ?? e);
      } finally {
        convertButton.disabled = false;
      }
    };
    for (const ev of [
      "pointerdown",
      "pointerup",
      "mousedown",
      "mouseup",
      "click",
      "dblclick",
      "wheel",
      "keydown",
      "keyup"
    ]) {
      panel.addEventListener(ev, (e) => {
        e.stopPropagation();
      });
    }
    parent.appendChild(panel);
    return panel;
  }
  return __toCommonJS(early_converter_standalone_exports);
})();
