import { hexzero } from '../util.js';
import ArrayBufferSlice from '../ArrayBufferSlice.js';
import * as GX_Texture from '../gx/gx_texture.js';
import { loadTextureFromMipChain, translateWrapModeGfx, translateTexFilterGfx } from '../gx/gx_render.js';
import { GfxDevice, GfxMipFilterMode, GfxTexture, GfxSampler, GfxFormat, makeTextureDescriptor2D, GfxWrapMode, GfxTexFilterMode } from '../gfx/platform/GfxPlatform.js';
import { DataFetcher } from '../DataFetcher.js';
import * as UI from '../ui.js';
import { ModelVersion } from "./modelloader.js";
import { GameInfo, DP_GAME_INFO } from './scenes.js';
import { loadRes } from './resource.js';
import { readUint32 } from './util.js';
import * as Viewer from '../viewer.js';
import { TextureMapping } from '../TextureHolder.js';
import { GfxRenderCache } from '../gfx/render/GfxRenderCache.js';

function decodeRareN64Texture(data: DataView): { width: number, height: number, cms: number, cmt: number, pixelFormat: number, pixels: Uint8Array } | null {
    const widthLo = data.getUint8(0x00);
    const heightLo = data.getUint8(0x01);
    const formatByte = data.getUint8(0x02);
    const flags = data.getUint16(0x06, false); 
    const whHi = data.getUint8(0x1B);
    const cms = data.getUint8(0x1C); 
    const cmt = data.getUint8(0x1E); 

    const width = widthLo | ((whHi & 0xF0) << 4);
    let height = heightLo | ((whHi & 0x0F) << 8);

    if ((flags & 0x100) !== 0) {
        height = Math.pow(2, Math.round(Math.log2(height * 0.75)));
    }

    const pixelFormat = formatByte & 0xF;
    const transpFormat = (formatByte >> 4) & 0xF;

    const pixelOffset = 0x20;
    const pixelCount = width * height;
    const rgba8 = new Uint8Array(pixelCount * 4);
    const rawData = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

    // FIX: Added missing N64 BPP mappings for IA4, I4, and CI8!
    let bpp = 16;
    if (pixelFormat === 7 || pixelFormat === 3 || pixelFormat === 6) bpp = 4; // CI4, I4, IA4
    else if (pixelFormat === 0) bpp = 32; // RGBA32
    else if (pixelFormat === 2 || pixelFormat === 5 || pixelFormat === 8) bpp = 8; // I8, IA8, CI8

    const width_bytes = Math.ceil((width * bpp) / 8);
    const deinterleaved = new Uint8Array(width_bytes * height);

    if (pixelFormat === 0) { 
        const stride = 16;
        const half_stride = 8;

        for (let y = 0; y < height; y++) {
            const src_row_start = pixelOffset + y * width_bytes;
            const dst_row_start = y * width_bytes;

            if ((y & 1) === 0) {
                for (let i = 0; i < width_bytes; i++) {
                    deinterleaved[dst_row_start + i] = rawData[src_row_start + i];
                }
            } else {
                for (let x = 0; x < width_bytes; x += stride) {
                    const chunk = Math.min(stride, width_bytes - x);

                    if (chunk >= stride) {
                        for (let i = 0; i < half_stride; i++) {
                            deinterleaved[dst_row_start + x + i] = rawData[src_row_start + x + half_stride + i];
                            deinterleaved[dst_row_start + x + half_stride + i] = rawData[src_row_start + x + i];
                        }
                    } else {
                        for (let i = 0; i < chunk; i++) {
                            deinterleaved[dst_row_start + x + i] = rawData[src_row_start + x + i];
                        }
                    }
                }
            }
        }
    } else {
        const stride = 8;
        const half_stride = 4;

        for (let y = 0; y < height; y++) {
            const src_row_start = pixelOffset + y * width_bytes;
            const dst_row_start = y * width_bytes;

            if ((y & 1) === 0) {
                for (let i = 0; i < width_bytes; i++) {
                    deinterleaved[dst_row_start + i] = rawData[src_row_start + i];
                }
            } else {
                for (let x = 0; x < width_bytes; x += stride) {
                    const chunk = Math.min(stride, width_bytes - x);

                    if (chunk >= stride) {
                        for (let i = 0; i < half_stride; i++) {
                            deinterleaved[dst_row_start + x + i] = rawData[src_row_start + x + half_stride + i];
                            deinterleaved[dst_row_start + x + half_stride + i] = rawData[src_row_start + x + i];
                        }
                    } else {
                        for (let i = 0; i < chunk; i++) {
                            deinterleaved[dst_row_start + x + i] = rawData[src_row_start + x + i];
                        }
                    }
                }
            }
        }
    
    }

    const dv = new DataView(deinterleaved.buffer);
    
    // --- PIXEL FORMAT DECODERS ---
    if (pixelFormat === 0) { // RGBA32
        for (let i = 0; i < pixelCount; i++) {
            const src = i * 4;
            rgba8[i * 4 + 0] = deinterleaved[src + 0];
            rgba8[i * 4 + 1] = deinterleaved[src + 1];
            rgba8[i * 4 + 2] = deinterleaved[src + 2];
            rgba8[i * 4 + 3] = deinterleaved[src + 3];
        }
    }
else if (pixelFormat === 1) { // RGBA16 (RGBA5551) - DP bins may be byte-swapped
    let aBE = 0, aLE = 0;
    const sampleCount = Math.min(pixelCount, 256);
const fracBE = aBE / sampleCount;
const fracLE = aLE / sampleCount;

const distBE = Math.abs(fracBE - 0.5);
const distLE = Math.abs(fracLE - 0.5);

const useLE = distLE > distBE;
    function scoreSwapRB(swapRB: boolean): number {
        const sx = Math.max(1, (width / 16) | 0);
        const sy = Math.max(1, (height / 16) | 0);
        let score = 0;

        function getP(i: number): number {
            const p0 = dv.getUint16(i * 2, false);
            return useLE ? (((p0 & 0xFF) << 8) | (p0 >>> 8)) : p0;
        }

        function unpack(p: number): [number, number, number] {
            const r5 = (p >>> 11) & 0x1F;
            const g5 = (p >>> 6) & 0x1F;
            const b5 = (p >>> 1) & 0x1F;
            return swapRB ? [b5, g5, r5] : [r5, g5, b5];
        }

        for (let y = 0; y < height; y += sy) {
            for (let x = 0; x < width; x += sx) {
                const i = y * width + x;
                const [r, g, b] = unpack(getP(i));

                if (x + sx < width) {
                    const j = y * width + (x + sx);
                    const [r2, g2, b2] = unpack(getP(j));
                    score += Math.abs(r - r2) + Math.abs(g - g2) + Math.abs(b - b2);
                }
                if (y + sy < height) {
                    const j = (y + sy) * width + x;
                    const [r2, g2, b2] = unpack(getP(j));
                    score += Math.abs(r - r2) + Math.abs(g - g2) + Math.abs(b - b2);
                }
            }
        }
        return score;
    }

    const scoreRGB = scoreSwapRB(false);
    const scoreBGR = scoreSwapRB(true);
const swapRB = false; 
   // console.log(`[DP RGBA16] choose ${useLE ? "LE(swapped16)" : "BE"} + ${swapRB ? "BGR" : "RGB"} (scoreRGB=${scoreRGB} scoreBGR=${scoreBGR})`);

    // --- decode pixels ---
    for (let i = 0; i < pixelCount; i++) {
        const p0 = dv.getUint16(i * 2, false);
        const p = useLE ? (((p0 & 0xFF) << 8) | (p0 >>> 8)) : p0;

        let r = ((p >>> 11) & 0x1F) * (255 / 31);
        let g = ((p >>> 6) & 0x1F) * (255 / 31);
        let b = ((p >>> 1) & 0x1F) * (255 / 31);
        const a = (p & 1) ? 255 : 0;

        if (swapRB) { const t = r; r = b; b = t; }

        rgba8[i * 4 + 0] = r;
        rgba8[i * 4 + 1] = g;
        rgba8[i * 4 + 2] = b;
        rgba8[i * 4 + 3] = a;
    }
}
    else if (pixelFormat === 2) { // Packed IA8 variant: high nibble = intensity, full byte carries alpha
        for (let i = 0; i < pixelCount; i++) {
            const byte = deinterleaved[i];
            const intensity4 = (byte >> 4) & 0xF;
            const intensity = (intensity4 << 4) | intensity4;
            const alpha = byte;

            rgba8[i * 4 + 0] = intensity;
            rgba8[i * 4 + 1] = intensity;
            rgba8[i * 4 + 2] = intensity;
            rgba8[i * 4 + 3] = alpha;
        }
    }
    else if (pixelFormat === 3) { // Packed IA4 variant: top 3 bits intensity, whole nibble carries alpha
        for (let i = 0; i < pixelCount; i++) {
            const byte = deinterleaved[i >> 1];
            const nibble = (i & 1) ? (byte & 0xF) : (byte >> 4);

            const intensity3 = (nibble >> 1) & 0x7;
            const alpha4 = nibble & 0xF;

            const intensity = (intensity3 << 5) | (intensity3 << 2) | (intensity3 >> 1);
            const alpha = (alpha4 << 4) | alpha4;

            rgba8[i * 4 + 0] = intensity;
            rgba8[i * 4 + 1] = intensity;
            rgba8[i * 4 + 2] = intensity;
            rgba8[i * 4 + 3] = alpha;
        }
    }
    else if (pixelFormat === 4) { // IA16
        for (let i = 0; i < pixelCount; i++) {
            const intensity = deinterleaved[i * 2];
            const alpha = deinterleaved[i * 2 + 1];
            rgba8[i * 4 + 0] = intensity;
            rgba8[i * 4 + 1] = intensity;
            rgba8[i * 4 + 2] = intensity;
            rgba8[i * 4 + 3] = alpha;
        }
    }
    else if (pixelFormat === 5) { // IA8
        for (let i = 0; i < pixelCount; i++) {
            const byte = deinterleaved[i];
            const intensity = byte >> 4;
            const alpha = byte & 0xF;
            const val = (intensity << 4) | intensity;
            const aVal = (alpha << 4) | alpha;
            rgba8[i * 4 + 0] = val;
            rgba8[i * 4 + 1] = val;
            rgba8[i * 4 + 2] = val;
            rgba8[i * 4 + 3] = aVal;
        }
    }
    else if (pixelFormat === 6) { // IA4 (NEW)
        for (let i = 0; i < pixelCount; i++) {
            const byte = deinterleaved[i >> 1];
            const nibble = (i & 1) ? (byte & 0xF) : (byte >> 4);
            const intensity = (nibble >> 1) & 0x7;
            const alpha = nibble & 0x1;
            const val = (intensity << 5) | (intensity << 2) | (intensity >> 1);
            rgba8[i * 4 + 0] = val;
            rgba8[i * 4 + 1] = val;
            rgba8[i * 4 + 2] = val;
            rgba8[i * 4 + 3] = alpha ? 255 : 0;
        }
    }
    else if (pixelFormat === 7) { // CI4
        const totalHeight = heightLo | ((whHi & 0x0F) << 8);
        const paletteOffset = pixelOffset + (width_bytes * totalHeight);
        const palDV = new DataView(data.buffer, data.byteOffset, data.byteLength);
        
        for (let i = 0; i < pixelCount; i++) {
            const byte = deinterleaved[i >> 1];
            const idx = (i & 1) ? (byte & 0xF) : (byte >> 4);
            
            let p = 0;
            if (paletteOffset + idx * 2 + 2 <= data.byteLength) {
                p = palDV.getUint16(paletteOffset + idx * 2, false);
            }
            
            rgba8[i * 4 + 0] = ((p >> 11) & 0x1F) * (255 / 31);
            rgba8[i * 4 + 1] = ((p >> 6) & 0x1F) * (255 / 31);
            rgba8[i * 4 + 2] = ((p >> 1) & 0x1F) * (255 / 31);
            rgba8[i * 4 + 3] = (p & 1) ? 255 : 0; 
        }
    }
    else if (pixelFormat === 8) { // CI8 (NEW)
        const totalHeight = heightLo | ((whHi & 0x0F) << 8);
        const paletteOffset = pixelOffset + (width_bytes * totalHeight);
        const palDV = new DataView(data.buffer, data.byteOffset, data.byteLength);
        
        for (let i = 0; i < pixelCount; i++) {
            const idx = deinterleaved[i];
            let p = 0;
            if (paletteOffset + idx * 2 + 2 <= data.byteLength) {
                p = palDV.getUint16(paletteOffset + idx * 2, false);
            }
            
            rgba8[i * 4 + 0] = ((p >> 11) & 0x1F) * (255 / 31);
            rgba8[i * 4 + 1] = ((p >> 6) & 0x1F) * (255 / 31);
            rgba8[i * 4 + 2] = ((p >> 1) & 0x1F) * (255 / 31);
            rgba8[i * 4 + 3] = (p & 1) ? 255 : 0; 
        }
    } else {
        return null;
    }

return { width, height, cms, cmt, pixelFormat, pixels: rgba8 };
}

type OverrideOpts = {
  wrap?: GfxWrapMode;
  minFilter?: GfxTexFilterMode;
  magFilter?: GfxTexFilterMode;
  mipFilter?: GfxMipFilterMode;
};

export class SFATexture {
    public viewerTexture?: Viewer.Texture;
    public mappings: TextureMapping[] = [];
    public lodBias: number = 0.0;

    constructor(public gfxTexture: GfxTexture, public gfxSampler: GfxSampler, public width: number, public height: number) {}

    public static create(cache: GfxRenderCache, width: number, height: number) {
        const device = cache.device;
        const gfxTexture = device.createTexture(makeTextureDescriptor2D(GfxFormat.U8_RGBA_NORM, width, height, 1));
        const gfxSampler = cache.createSampler({
            wrapS: GfxWrapMode.Clamp,
            wrapT: GfxWrapMode.Clamp,
            minFilter: GfxTexFilterMode.Bilinear,
            magFilter: GfxTexFilterMode.Bilinear,
            mipFilter: GfxMipFilterMode.Nearest,
            minLOD: 0,
            maxLOD: 100,
        });

        return new SFATexture(gfxTexture, gfxSampler, width, height);
    }

    public destroy(device: GfxDevice) { device.destroyTexture(this.gfxTexture); }

    public setOnTextureMapping(mapping: TextureMapping) {
        mapping.reset();
        mapping.gfxTexture = this.gfxTexture;
        mapping.gfxSampler = this.gfxSampler;
        mapping.width = this.width;
        mapping.height = this.height;
        mapping.lodBias = this.lodBias;
        this.mappings.push(mapping);
    }

    public updateTextureAndNotify(newTex: GfxTexture, newWidth: number, newHeight: number, newSampler?: GfxSampler) {
        this.gfxTexture = newTex;
        this.width = newWidth;
        this.height = newHeight;
        if (newSampler) this.gfxSampler = newSampler;
        for (const m of this.mappings) {
            m.gfxTexture = newTex;
            m.width = newWidth;
            m.height = newHeight;
            m.lodBias = this.lodBias;
            if (newSampler) m.gfxSampler = newSampler;
        }
    }
}

export class SFATextureArray {
    constructor(public textures: SFATexture[]) {}
    public destroy(device: GfxDevice) { for (let t of this.textures) t.destroy(device); }
}

export abstract class TextureFetcher {
    public abstract loadSubdirs(subdirs: string[], dataFetcher: DataFetcher): Promise<void>;
    public abstract getTextureArray(cache: GfxRenderCache, num: number, alwaysUseTex1: boolean): SFATextureArray | null;
    public getTexture(cache: GfxRenderCache, num: number, alwaysUseTex1: boolean) : SFATexture | null {
        const texArray = this.getTextureArray(cache, num, alwaysUseTex1);
        return texArray ? texArray.textures[0] : null;
    }
    public abstract destroy(device: GfxDevice): void;
}

function loadTexture(cache: GfxRenderCache, texData: ArrayBufferSlice, isBeta: boolean): SFATexture {
    const dv = texData.createDataView();
    const textureInput = {
        name: `Texture`,
        width: dv.getUint16(0x0A),
        height: dv.getUint16(0x0C),
        format: dv.getUint8(0x16),
        mipCount: dv.getUint16(0x1C) + 1,
        data: texData.slice(isBeta ? 0x20 : 0x60),
    };

    const fields = {
        wrapS: dv.getUint8(0x17),
        wrapT: dv.getUint8(0x18),
        minFilt: dv.getUint8(0x19),
        magFilt: dv.getUint8(0x1A),
    };

    const mipChain = GX_Texture.calcMipChain(textureInput, textureInput.mipCount);
    const loadedTexture = loadTextureFromMipChain(cache.device, mipChain);
    const [minFilter, mipFilter] = translateTexFilterGfx(fields.minFilt);

    const gfxSampler = cache.createSampler({
        wrapS: translateWrapModeGfx(fields.wrapS),
        wrapT: translateWrapModeGfx(fields.wrapT),
        minFilter: minFilter,
        magFilter: translateTexFilterGfx(fields.magFilt)[0],
        mipFilter: mipFilter,
        minLOD: 0,
        maxLOD: 100,
    });

    const texture = new SFATexture(
        loadedTexture.gfxTexture,
        gfxSampler,
        textureInput.width,
        textureInput.height,
    );

    texture.viewerTexture = loadedTexture.viewerTexture;

    texture.lodBias = -1.0;

    return texture;
}

function isValidTextureTabValue(tabValue: number) {
    return tabValue != 0xFFFFFFFF && (tabValue & 0x80000000) != 0;
}

function loadTextureArrayFromTable(cache: GfxRenderCache, tab: DataView, bin: ArrayBufferSlice, id: number, isBeta: boolean): (SFATextureArray | null) {
    const tabValue = readUint32(tab, 0, id);
    if (isValidTextureTabValue(tabValue)) {
        const arrayLength = (tabValue >> 24) & 0x3f;
        const binOffs = (tabValue & 0xffffff) * 2;
        if (arrayLength === 1) {
            const uncompData = loadRes(bin.slice(binOffs));
            return new SFATextureArray([loadTexture(cache, uncompData, isBeta)]);
        } else {
            const result: SFATexture[] = [];
            const binDv = bin.createDataView();
            for (let i = 0; i < arrayLength; i++) {
                const texOffs = readUint32(binDv, binOffs, i);
                const uncompData = loadRes(bin.slice(binOffs + texOffs));
                result.push(loadTexture(cache, uncompData, isBeta));
            }
            return new SFATextureArray(result);
        }
    }
    return null;
}

function makeFakeTexture(cache: GfxRenderCache, num: number): SFATextureArray {
    const DIM = 128; const CHECKER = 32;
    const device = cache.device;
    const gfxTexture = device.createTexture(makeTextureDescriptor2D(GfxFormat.U8_RGBA_NORM, DIM, DIM, 1));
    const gfxSampler = cache.createSampler({
        wrapS: GfxWrapMode.Repeat, wrapT: GfxWrapMode.Repeat,
        minFilter: GfxTexFilterMode.Bilinear, magFilter: GfxTexFilterMode.Bilinear,
        mipFilter: GfxMipFilterMode.Nearest, minLOD: 0, maxLOD: 100,
    });
    const pixels = new Uint8Array(DIM * DIM * 4);
    for (let y = 0; y < DIM; y++) {
        for (let x = 0; x < DIM; x++) {
            const cx = (x / CHECKER)|0; const cy = (y / CHECKER)|0;
            let color = !!((cx + cy) & 1);
            const val = color ? 255 : 200;
            pixels.set([val, val, val, 0xff], (y * DIM + x) * 4);
        }
    }
    device.uploadTextureData(gfxTexture, 0, [pixels]);
    return new SFATextureArray([new SFATexture(gfxTexture, gfxSampler, 2, 2)]);
}

class TextureFile {
    private textures: (SFATextureArray | null)[] = [];
    
    public listAllValidIds(): number[] {
        const ids: number[] = [];
        const count = (this.tab.byteLength / 4) | 0;
        for (let i = 0; i < count; i++) {
            if (isValidTextureTabValue(this.tab.getUint32(i * 4))) ids.push(i);
        }
        return ids;
    }
    constructor(private tab: DataView, private bin: ArrayBufferSlice, public name: string, private isBeta: boolean) {}
    public hasTexture(num: number): boolean {
        if (num < 0 || num * 4 >= this.tab.byteLength) return false;
        return isValidTextureTabValue(readUint32(this.tab, 0, num));
    }
    public isTextureLoaded(num: number): boolean { return this.textures[num] !== undefined; }
    public getTextureArray(cache: GfxRenderCache, num: number): SFATextureArray | null {
        if (this.textures[num] === undefined) {
            try {
                const texture = loadTextureArrayFromTable(cache, this.tab, this.bin, num, this.isBeta);
                if (texture !== null) {
                    for (let i = 0; i < texture.textures.length; i++) {
                        if (texture.textures[i].viewerTexture) texture.textures[i].viewerTexture!.name = `${this.name} #${num}${texture.textures.length > 1 ? '.' + i : ''}`;
                    }
                }
                this.textures[num] = texture;
            } catch (e) { this.textures[num] = makeFakeTexture(cache, num); }
        }
        return this.textures[num];
    }
    public destroy(device: GfxDevice) { for (let t of this.textures) t?.destroy(device); }
}

async function fetchTextureFile(dataFetcher: DataFetcher, tabPath: string, binPath: string, isBeta: boolean): Promise<TextureFile | null> {
    try {
        const [tab, bin] = await Promise.all([dataFetcher.fetchData(tabPath), dataFetcher.fetchData(binPath)]);
        if (!tab || !bin) return null;
        return new TextureFile(tab.createDataView(), bin, binPath, isBeta);
    } catch (e) { return null; }
}

export class FakeTextureFetcher extends TextureFetcher {
  private textures: SFATextureArray[] = [];
  public getTextureArray(cache: GfxRenderCache, num: number, _alwaysUseTex1: boolean): SFATextureArray | null {
    if (this.textures[num] === undefined) this.textures[num] = makeFakeTexture(cache, num);
    return this.textures[num];
  }
  public async loadSubdirs(_s: string[], _d: DataFetcher): Promise<void> {}
  public destroy(device: GfxDevice) { for (const t of this.textures) t?.destroy(device); this.textures = []; }
}

class SubdirTextureFiles {
    constructor(public tex0: TextureFile | null, public tex1: TextureFile | null) {}
    public destroy(device: GfxDevice) { this.tex0?.destroy(device); this.tex1?.destroy(device); }
}

async function decodePNGToRGBA(input: Uint8Array | ArrayBufferLike): Promise<{ width: number; height: number; pixels: Uint8ClampedArray }> {
  const bytes = input instanceof Uint8Array ? input.slice() : new Uint8Array(input as ArrayBufferLike).slice();
  const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  try {
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    return { width: bmp.width, height: bmp.height, pixels: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
  } finally { bmp.close(); }
}

async function createSFATextureFromPNG(cache: GfxRenderCache, pngBytes: Uint8Array | ArrayBufferLike, opts?: OverrideOpts): Promise<SFATexture> {
  const { width, height, pixels } = await decodePNGToRGBA(pngBytes);
  const gfxTexture = cache.device.createTexture(makeTextureDescriptor2D(GfxFormat.U8_RGBA_NORM, width, height, 1));
  cache.device.uploadTextureData(gfxTexture, 0, [new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength)]);
  const gfxSampler = cache.createSampler({
    wrapS: opts?.wrap ?? GfxWrapMode.Repeat, wrapT: opts?.wrap ?? GfxWrapMode.Repeat,
    minFilter: opts?.minFilter ?? GfxTexFilterMode.Bilinear, magFilter: opts?.magFilter ?? GfxTexFilterMode.Bilinear,
    mipFilter: opts?.mipFilter ?? GfxMipFilterMode.Nearest, minLOD: 0, maxLOD: 100,
  });
  return new SFATexture(gfxTexture, gfxSampler, width, height);
}

const early1TextureIdMap: Record<number, number> = { 5: 5555, 24: 24, 57: 60, 58: 61, 146: 980, 154: 980, 157: 130, 162: 146, 177: 157, 176: 999, 268: 398, 427: 179, 428: 186, 457: 563, 310: 256, 311: 257, 312: 253, 313: 258, 332: 483, 349: 486, 358: 1014, 361: 491, 362: 491, 487: 483, 488: 486, 489: 485, 490: 486, 491: 487, 492: 487, 493: 490, 494: 491, 495: 492, 496: 492, 497: 5555, 499: 501, 500: 489, 502: 515, 503: 490, 504: 486, 505: 251, 515: 486, 547: 770, 634: 1984, 639: 488, 898: 977, 901: 993, 912: 1005, 417: 178, 425: 181, 530: 522, 532: 592, 533: 593, 534: 594, 536: 532, 541: 533, 542: 533, 546: 534, 549: 568, 553: 1006, 555: 412, 556: 532, 559: 532, 560: 535, 561: 559, 562: 1123, 563: 561, 564: 562, 565: 561, 566: 561, 567: 564, 568: 564, 569: 565, 570: 565, 571: 566, 572: 567, 573: 567, 574: 565, 576: 534, 638: 926, 640: 183, 654: 654, 657: 642, 674: 1012, 675: 666, 691: 549, 705: 674, 706: 565, 707: 559, 708: 674, 709: 565, 710: 654, 711: 674, 767: 766, 856: 943, 860: 948, 862: 949, 871: 786, 896: 980, 897: 991, 900: 975, 902: 1004, 903: 1005, 904: 1005, 905: 975, 906: 976, 907: 977, 908: 978, 909: 977, 910: 980, 913: 1007, 916: 1006, 917: 982, 918: 1009, 933: 951, 943: 951, 946: 1042, 947: 948, 948: 942, 949: 951, 951: 537, 952: 553, 954: 951, 974: 980, 975: 974, 977: 980, 978: 978, 980: 1083, 981: 1084, 982: 1086, 983: 1085, 984: 1086, 985: 1087, 986: 1087, 987: 1088, 989: 1090, 990: 1091, 991: 1092, 992: 1090, 993: 1090, 994: 1096, 995: 1097, 997: 1093, 1000: 1102, 1001: 1103, 1002: 1104, 1003: 1106, 1007: 1112, 1008: 1113, 1009: 1114, 1090: 979, 1100: 398, 2024: 2373, 2141: 187, 2206: 2205, 2435: 2001, 2635: 2222, 535: 897, 651: 897, 660: 898, 719: 880, 720: 881, 721: 879, 722: 879, 807: 899, 810: 908, 812: 900, 813: 910, 814: 909, 815: 910, 816: 530, 1812: 1761, 1814: 406, 1815: 879, 2094: 903, 155: 977, 605: 398, 606: 301, 607: 323, 608: 398, 609: 398, 611: 398, 610: 398, 612: 592, 613: 593, 614: 594, 615: 595, 616: 398, 617: 1101, 618: 398, 619: 398, 620: 1337, 621: 398, 622: 595, 623: 398, 624: 1337, 666: 1337, 668: 1294, 899: 2373, 976: 1346, 998: 1348, 1006: 1010, 1010: 1115, 1245: 1306, 1246: 1307, 1252: 1314, 1253: 1315, 1254: 1315, 1255: 1317, 1258: 1320, 1261: 1321, 1269: 1330, 1270: 1331, 1271: 1332, 1272: 1333, 1275: 1336, 1276: 1337, 1277: 1338, 1282: 1344, 1283: 1347, 1287: 1349, 1288: 1353, 1289: 1345, 1307: 1337, 1345: 1337, 21: 64, 27: 44, 30: 45, 31: 45, 32: 45, 33: 45, 34: 45, 36: 47, 37: 65, 45: 64, 46: 51, 49: 45, 59: 62, 61: 63, 62: 66, 67: 72, 68: 73, 69: 62, 70: 1472, 71: 74, 136: 61, 811: 71, 914: 65, 915: 67, 1294: 35, 1295: 35, 2056: 54, 2640: 54, 473: 957, 508: 722, 509: 723, 510: 724, 517: 725, 522: 724, 665: 726, 859: 726, 861: 726, 920: 726, 1101: 726, 1105: 5555, 1109: 1088, 1906: 726, 2139: 726, 73: 402, 80: 85, 82: 84, 83: 85, 84: 86, 85: 87, 86: 88, 87: 89, 88: 90, 89: 91, 90: 92, 91: 93, 92: 94, 93: 1038, 94: 97, 95: 98, 96: 99, 97: 100, 98: 1071, 99: 101, 100: 103, 101: 104, 103: 105, 414: 2761, 415: 396, 416: 396, 418: 397, 419: 109, 422: 2761, 424: 415, 911: 978, 1491: 400, 1492: 2761, 2018: 2761, 2020: 2761, 2595: 2761, 2761: 93, 1466: 1528, 1467: 1529, 1468: 1530, 1469: 1531, 1470: 1532, 1471: 1533, 1472: 1533, 1473: 1535, 1474: 1536, 1475: 1537, 1524: 177, 1922: 406, 9: 405, 147: 5555, 577: 571, 579: 1170, 580: 574, 581: 5555, 582: 589, 583: 590, 584: 1163, 585: 1163, 586: 577, 587: 578, 588: 590, 589: 582, 590: 584, 591: 585, 592: 586, 593: 591, 595: 576, 596: 589, 597: 590, 598: 993, 599: 588, 600: 580, 601: 579, 602: 575, 603: 5555, 988: 570, 999: 1100, 604: 571, 1035: 5555, 1036: 5555, 1051: 571, 1054: 503, 1057: 5555, 1058: 5555, 1061: 1163, 1062: 1163, 1063: 579, 1066: 1146, 1068: 572, 1073: 5555, 1074: 580, 1075: 5555, 1076: 5555, 1080: 5555, 1532: 5555, 523: 523, 524: 522, 525: 524, 526: 524, 527: 525, 528: 522, 529: 526, 531: 1649, 539: 952, 944: 543, 199: 15, 200: 19, 391: 8, 392: 9, 757: 12, 550: 10, 554: 13, 717: 17, 809: 14, 968: 6, 1018: 7, 1019: 20, 2163: 16, 1013: 1083, 1014: 1084, 1016: 1085, 1017: 1086, 1020: 1089, 1021: 1090, 1026: 1096, 1027: 1097, 1028: 1100, 1030: 1102, 1031: 1103, 1032: 1104, 1033: 1106, 1034: 1108, 1038: 1114, 1039: 1115, 384: 437, 385: 438, 386: 439, 545: 614, 551: 620, 552: 621, 557: 627, 558: 628, 637: 713, 690: 765, 718: 799, 942: 1026, 956: 1040, 1042: 5, 7: 755, 543: 769, 544: 779, 763: 759, 764: 760, 766: 765, 768: 755, 769: 767, 771: 770, 772: 771, 773: 772, 775: 777, 776: 778, 777: 1956, 778: 779, 779: 781, 781: 782, 782: 784, 783: 784, 784: 785, 785: 787, 787: 780, 1156: 755, 1811: 769, 1011: 5, 1005: 1108, 996: 1035, 137: 1221, 197: 1645, 387: 1094, 388: 1247, 389: 5555, 390: 1115, 1106: 1093, 1107: 1094, 1108: 1188, 1110: 1088, 1111: 1094, 1112: 1180, 1113: 1248, 1114: 1197, 1115: 2358, 1116: 1648, 1117: 1196, 1118: 1197, 1119: 1214, 1120: 1648, 1121: 1198, 1122: 1188, 1123: 1227, 1124: 553, 1125: 1227, 1126: 1093, 1127: 1227, 1128: 1241, 1129: 1088, 1130: 1088, 1131: 2358, 1133: 1089, 1134: 1089, 1135: 1211, 1136: 1105, 1138: 1180, 1139: 1198, 1141: 1180, 1143: 1240, 1145: 1082, 1146: 1094, 1147: 1213, 1148: 3500, 1149: 5555, 1150: 1868, 1151: 1220, 1152: 1090, 1153: 1206, 1154: 1091, 1155: 1091, 1161: 3501, 1157: 1092, 1158: 3611, 1159: 1093, 1160: 3000, 1168: 1248, 1187: 1096, 1188: 1094, 1189: 1095, 1190: 1248, 1191: 1095, 1192: 1221, 1193: 1096, 1194: 5555, 1196: 5555, 1197: 5555, 1198: 5555, 1206: 5555, 1211: 5555, 1213: 5555, 1214: 5555, 1449: 5555, 1489: 5555, 1685: 5555, 1692: 1866, 1695: 539, 1696: 2358, 1988: 1130, 1989: 1130, 1990: 1130, 1991: 1130, 2621: 1128, 2624: 1115, 2625: 1115, 56: 59, 220: 5555, 221: 465, 437: 3612, 438: 206, 439: 468, 440: 3612, 442: 219, 443: 219, 449: 205, 450: 206, 451: 461, 454: 461, 455: 216, 458: 214, 461: 457, 462: 457, 463: 206, 465: 216, 466: 461, 468: 3613, 469: 222, 470: 221, 471: 220, 472: 233, 475: 466, 476: 467, 477: 219, 478: 224, 480: 197, 484: 197, 485: 238, 486: 206, 703: 219, 704: 206, 2047: 5555 };
const early2TextureIdMap: Record<number, number> = { 303: 5555, 340: 497, 341: 497, 342: 497, 349: 5555, 353: 5555, 354: 5555, 357: 5555, 358: 5555, 361: 5555, 362: 5555, 370: 5555, 374: 483, 375: 483, 379: 5503, 380: 5503, 382: 5503, 446: 482, 514: 495, 497: 55555, 903: 5503, 976: 5503, 2068: 5502, 2069: 5503, 2718: 760, 2849: 5555, 2866: 499, 2867: 500, 2868: 498, 2869: 505, 2870: 241, 2871: 494, 2872: 496, 2873: 505, 2874: 479, 2876: 482, 2877: 506, 2880: 506, 2879: 481, 3228: 5503, 323: 256, 325: 256, 326: 258, 371: 256, 503: 483, 505: 484, 506: 487, 507: 487, 508: 490, 509: 490, 510: 491, 511: 492, 512: 492, 516: 256, 517: 489, 520: 490, 648: 487, 653: 488, 2717: 5555, 2864: 486, 2865: 485, 3202: 253, 3364: 251, 3365: 256, 3366: 252, 3367: 257, 3368: 5555, 3369: 251, 3370: 255, 3371: 255, 3372: 257, 3373: 257, 3374: 490, 3375: 258, 3376: 487, 5: 5555, 71: 76, 78: 85, 80: 84, 81: 85, 82: 86, 83: 87, 84: 88, 85: 89, 86: 90, 87: 91, 88: 92, 89: 93, 91: 95, 92: 97, 93: 98, 94: 99, 95: 100, 96: 1071, 97: 101, 98: 103, 99: 104, 101: 105, 103: 107, 104: 108, 432: 109, 440: 113, 441: 411, 443: 415, 573: 412, 756: 5555, 1542: 1552, 1543: 1553, 1544: 1513, 1996: 90, 2078: 96, 2080: 99, 2110: 1513, 2465: 398, 2674: 413, 2723: 5555, 793: 1138, 795: 1139, 1057: 1131, 1058: 1133, 1059: 1134, 1060: 1135, 1061: 1136, 1062: 1137, 1064: 1140, 1086: 1132, 595: 574, 596: 575, 599: 1163, 603: 583, 604: 582, 605: 584, 606: 585, 607: 586, 608: 587, 610: 589, 611: 590, 612: 591, 618: 682, 1094: 1934, 1095: 1934, 1108: 5555, 1109: 5555, 2826: 578, 2827: 579, 2828: 580, 2829: 576, 2830: 577, 2831: 591, 2832: 682, 2833: 683, 2834: 685, 2835: 575, 2836: 575, 2967: 573, 2968: 581, 2969: 581, 2970: 581, 3218: 1170, 3219: 1170, 3221: 1146, 3225: 570, 3226: 588, 3227: 5555, 3388: 1171, 3389: 1111, 90: 5555, 412: 5555, 415: 5555, 433: 396, 434: 396, 436: 397, 437: 398 };
const earlydupTextureIdMap: Record<number, number> = { 176: 1099, 553: 1090, 984: 1086, 988: 1089, 989: 1090, 994: 1096, 995: 1097, 1009: 1114, 2640: 1096, 87: 1068, 88: 1069, 90: 5555, 93: 1070, 96: 1071, 117: 1072, 177: 1073, 447: 1072, 503: 483, 507: 258, 508: 490, 512: 257, 571: 1075, 650: 257, 783: 1076, 785: 1077, 790: 1078, 791: 1079, 792: 1080, 793: 1081, 794: 1082, 795: 1083, 846: 1084, 847: 1085, 848: 1086, 1011: 1103, 1013: 1098, 1014: 1099, 1016: 1105, 1017: 1101, 1021: 1105, 1024: 1109, 1025: 1110, 1028: 1115, 1030: 1117, 1031: 1118, 1032: 1119, 1033: 1121, 1034: 1123, 1037: 1128, 1039: 1130, 1163: 1088, 1168: 1089, 1185: 1090, 1188: 1091, 1190: 1092, 1192: 1093, 1221: 1094, 1224: 1095, 1226: 1096, 2727: 5555, 980: 1083, 981: 1084, 982: 1099, 983: 1085, 985: 1086, 986: 1087, 990: 1091, 991: 1092, 998: 1100, 1000: 1102, 1001: 1103, 1002: 1104, 1003: 1106, 1005: 1108, 1007: 1112, 1010: 1115, 2460: 5555, 40: 40, 118: 118, 437: 437, 438: 438, 439: 439, 614: 614, 616: 616, 617: 617, 618: 618, 620: 620, 621: 621, 626: 626, 627: 627, 628: 628, 629: 629, 713: 713, 765: 765, 766: 766, 799: 799, 908: 908, 918: 918, 1026: 1026, 1036: 553, 1040: 1040, 2760: 2760 };
const fearMapTextureIdMap: Record<number, number> = { 189: 1099, 1065: 1083, 1066: 1084, 1067: 1085, 1068: 1086, 1069: 1087, 1070: 1090, 1071: 1091, 1072: 1092, 1075: 1100, 1076: 1102, 1077: 1103, 1078: 1104, 1079: 1106, 1080: 1108, 1082: 1112, 1084: 1115, 2900: 1112 };
const ancientMapTextureIdMap: Record<number, number> = { 2282: 5555, 44: 558, 430: 1680, 431: 2060, 432: 2060, 565: 1978, 567: 2121, 568: 2365, 569: 2365, 570: 537, 571: 1042, 572: 542, 573: 539, 575: 541, 576: 539, 577: 539, 578: 542, 579: 548, 580: 553, 581: 552, 582: 553, 583: 553, 584: 1042, 585: 1042, 586: 553, 680: 548, 707: 548, 708: 555, 790: 548, 791: 1073, 917: 1041, 918: 544, 920: 1042, 921: 1041, 924: 537, 927: 537, 928: 1701, 930: 542, 933: 951, 2794: 2373, 2881: 545, 2882: 546, 0: 130, 7: 97, 43: 97, 79: 97, 87: 85, 90: 103, 91: 84, 92: 85, 93: 86, 94: 87, 95: 88, 96: 90, 97: 91, 98: 92, 99: 93, 100: 95, 101: 97, 102: 99, 105: 97, 106: 98, 107: 99, 108: 1071, 109: 103, 111: 111, 112: 111, 113: 111, 114: 104, 115: 104, 116: 107, 117: 108, 151: 109, 255: 5555, 456: 89, 457: 5555, 458: 98, 459: 103, 460: 2080, 740: 130, 1352: 412, 1383: 98, 1389: 104, 1392: 24, 1402: 412, 1415: 1564, 1416: 5555, 1926: 99, 1943: 98, 1988: 5555, 1989: 1161, 1990: 1162, 587: 559, 588: 561, 589: 560, 590: 562, 591: 561, 592: 564, 593: 564, 594: 564, 595: 567, 596: 567, 597: 565, 598: 3002, 687: 565, 688: 565, 689: 568, 690: 559, 691: 561, 692: 562, 693: 565, 694: 561, 695: 674, 696: 561, 697: 674, 698: 565, 699: 3001, 700: 3003, 701: 3004, 702: 3005, 703: 3006, 704: 565, 705: 565, 706: 674, 956: 559, 957: 565, 958: 562, 959: 562, 960: 674, 998: 563, 213: 210, 298: 948, 558: 2353, 564: 952, 574: 531, 599: 948, 600: 948, 601: 948, 603: 532, 604: 949, 681: 1803, 683: 2353, 684: 531, 800: 957, 811: 957, 836: 957, 840: 919, 851: 919, 856: 532, 1198: 5555, 1317: 572, 1347: 2122, 1662: 2122, 1797: 948, 1798: 1803, 1799: 948, 1805: 130, 1806: 130, 1927: 130, 1928: 130, 1935: 50, 1951: 950, 1952: 950, 2046: 917, 2216: 948, 2225: 775, 2228: 2248, 2231: 2353, 2465: 2122, 2467: 2248, 2538: 2248, 2541: 919, 2747: 533, 2791: 1802, 554: 5555, 555: 5555, 556: 5555, 559: 5555, 561: 5555, 605: 5555, 670: 5555, 677: 5555, 678: 5555, 709: 5555, 710: 580, 711: 5555, 712: 584, 857: 5555, 858: 5555, 1649: 5555, 1729: 5555, 1831: 5555, 1832: 5555, 1833: 5555, 1834: 5555, 1835: 5555, 1836: 5555, 1837: 5555, 1838: 5555, 2166: 5555, 2748: 5555, 3: 405, 103: 1537, 104: 1537, 118: 402, 120: 1537, 320: 1537, 845: 404, 1365: 1528, 1366: 1529, 1367: 1531, 1368: 1533, 1369: 1537, 1370: 1534, 1371: 1535, 1372: 1536, 1373: 551, 1374: 407, 1375: 1537, 1376: 407, 1391: 24, 1727: 402, 1730: 403, 1728: 1761, 1839: 406, 2390: 1537, 2862: 404, 2863: 1532, 2870: 401, 2883: 402, 606: 596, 607: 595, 608: 591, 609: 613, 610: 590, 611: 558, 612: 611, 613: 616, 614: 617, 615: 617, 616: 610, 617: 609, 618: 612, 619: 608, 620: 606, 621: 607, 622: 605, 623: 592, 624: 593, 625: 594, 626: 5555, 627: 563, 628: 604, 629: 615, 630: 603, 631: 589, 632: 588, 633: 579, 634: 602, 635: 618, 636: 587, 637: 4100, 638: 586, 639: 614, 640: 5555, 641: 583, 642: 582, 643: 581, 644: 602, 645: 611, 646: 601, 647: 600, 648: 5555, 649: 599, 651: 5555, 671: 598, 672: 1294, 713: 760, 714: 5555, 1146: 585, 1175: 597, 1176: 602, 2793: 760, 794: 2003, 795: 2002, 796: 2001, 797: 2000, 931: 5555, 1084: 2037, 1085: 2036, 1086: 2035, 1087: 2034, 1088: 2033, 1089: 2032, 1090: 2031, 1091: 2030, 1092: 2029, 1093: 2028, 1094: 2027, 1095: 2026, 1097: 2025, 1098: 2024, 1099: 2023, 1100: 2022, 1101: 2021, 1102: 2020, 1103: 2019, 1104: 2018, 1106: 2017, 1107: 2016, 1109: 2015, 1110: 2014, 1111: 2013, 1112: 2012, 1113: 2011, 1115: 2010, 1116: 2009, 1117: 2008, 1118: 2007, 1119: 2006, 1120: 2005, 1936: 2004, 1953: 5555, 1954: 5555, 1955: 5555, 2784: 5555, 231: 5555, 340: 5555, 341: 5555, 342: 5555, 343: 5555, 344: 5555, 348: 5555, 349: 5555, 351: 5555, 350: 5555, 352: 5555, 371: 5555, 389: 5555, 398: 5555, 401: 5555, 403: 5555, 404: 5555, 410: 5555, 412: 5555, 414: 5555, 415: 5555, 416: 5555, 418: 5555, 2798: 5555 };
const ANCIENT_DP_PER_MODEL_REMAP: { [mapNum: number]: { [srcId: number]: { id: number, useTex1: boolean } } } = {
    0: { // Willow Grove
        794:  { id: 900,  useTex1: true },
        795:  { id: 901,  useTex1: true },
        796:  { id: 902,  useTex1: true },
        797:  { id: 903,  useTex1: true },
        931:  { id: 1053, useTex1: true },
        1084: { id: 1400, useTex1: true },
        1085: { id: 1401, useTex1: true },
        1086: { id: 1402, useTex1: true },
        1087: { id: 1403, useTex1: true },
        1088: { id: 1404, useTex1: true },
        1089: { id: 1405, useTex1: true },
        1090: { id: 1406, useTex1: true },
        1091: { id: 1407, useTex1: true },
        1092: { id: 1408, useTex1: true },
        1093: { id: 1409, useTex1: true },
        1094: { id: 1410, useTex1: true },
        1095: { id: 1411, useTex1: true },
        1097: { id: 1413, useTex1: true },
        1098: { id: 1414, useTex1: true },
        1099: { id: 1415, useTex1: true },
        1100: { id: 1416, useTex1: true },
        1101: { id: 1417, useTex1: true },
        1102: { id: 1418, useTex1: true },
        1103: { id: 1419, useTex1: true },
        1104: { id: 1420, useTex1: true },
        1106: { id: 1422, useTex1: true },
        1107: { id: 1423, useTex1: true },
        1109: { id: 1425, useTex1: true },
        1110: { id: 1426, useTex1: true },
        1111: { id: 1427, useTex1: true },
        1112: { id: 1428, useTex1: true },
        1113: { id: 1429, useTex1: true },

        1115: { id: 1431, useTex1: true },
        1116: { id: 1432, useTex1: true },
        1117: { id: 1433, useTex1: true },
        1118: { id: 1435, useTex1: true },
        1119: { id: 1436, useTex1: true },
        1120: { id: 1437, useTex1: true },

        1347: { id: 1761, useTex1: true },

        1927: { id: 2468, useTex1: true },
        1928: { id: 2469, useTex1: true },
        1936: { id: 2478, useTex1: true },

        1951: { id: 2498, useTex1: true },
        1952: { id: 2499, useTex1: true },
        1953: { id: 2500, useTex1: true },
        1954: { id: 2501, useTex1: true },
        1955: { id: 2502, useTex1: true },
    },
        2: { // Ancient Dragon Rock Bottom -> DP map 52
        333: { id: 535, useTex1: true },
        334: { id: 536, useTex1: true },
        337: { id: 541, useTex1: true },
        345: { id: 550, useTex1: true },
        346: { id: 551, useTex1: true },
        348: { id: 553, useTex1: true },
        352: { id: 558, useTex1: true },
        353: { id: 559, useTex1: true },
        354: { id: 560, useTex1: true },
        358: { id: 564, useTex1: true },
        363: { id: 569, useTex1: true },
        364: { id: 570, useTex1: true },
        365: { id: 571, useTex1: true },
        367: { id: 573, useTex1: true },
        368: { id: 574, useTex1: true },
        369: { id: 575, useTex1: true },
        370: { id: 576, useTex1: true },
        371: { id: 577, useTex1: true },
        380: { id: 586, useTex1: true },
        381: { id: 587, useTex1: true },
        382: { id: 588, useTex1: true },
        384: { id: 590, useTex1: true },
        385: { id: 591, useTex1: true },
        389: { id: 595, useTex1: true },
        394: { id: 600, useTex1: true },
        397: { id: 603, useTex1: true },
        398: { id: 604, useTex1: true },
        403: { id: 609, useTex1: true },
        404: { id: 610, useTex1: true },
        408: { id: 614, useTex1: true },
        409: { id: 615, useTex1: true },
        412: { id: 618, useTex1: true },
        416: { id: 622, useTex1: true },
    },
    15: { // Ancient Boss T-rex -> DP map 48
        1076: { id: 1385, useTex1: true },
        1047: { id: 1342, useTex1: true },
        1046: { id: 1338, useTex1: true },
        1079: { id: 1389, useTex1: true },
        1036: { id: 1307, useTex1: true }, 
    },
    
};
const dftpmap: Record<number, number> = { 173: 4013, 185: 4012, 186: 4011, 189: 999, 198: 4010, 203: 4001, 2954: 4000, 2960: 4001, 3050: 4002, 3051: 4003, 3052: 4004, 3053: 4005, 3054: 4001, 3055: 4006, 3056: 4007, 3057: 4008, 3058: 4009 };
const early3TextureIdMap: Record<number, number> = { 651: 537, 656: 542, 660: 544, 668: 552, 670: 553, 674: 556, 675: 557, 677: 559, 678: 560, 679: 561, 680: 562, 681: 562, 682: 563, 683: 564, 684: 565, 685: 567, 686: 568, 688: 5555, 689: 5555, 690: 5555, 691: 5555, 692: 5555, 693: 569, 803: 674, 1183: 1083, 1184: 1084, 1185: 1085, 1186: 1086, 1188: 1088, 1189: 1093, 1191: 1090, 1200: 1108, 1202: 1035, 1203: 1100, 1205: 1102, 1206: 1103, 1207: 1104, 1208: 1090, 1210: 1108, 1211: 1110, 1214: 1113, 1216: 1115, 1219: 5555, 2795: 1105, 1011: 1602, 1012: 951, 1013: 917, 1014: 919, 1021: 926, 1022: 943, 1032: 5555, 1033: 937, 1037: 5555, 1038: 949, 1039: 942, 1040: 943, 1041: 944, 1044: 947, 1045: 948, 1047: 949, 1048: 950, 1051: 952, 1056: 957, 1058: 960, 1062: 964, 1067: 968, 1068: 969, 629: 522, 630: 5555, 631: 524, 632: 524, 633: 525, 634: 526, 635: 5555, 636: 526, 723: 592, 724: 593, 725: 594, 726: 595, 727: 1330, 1449: 1331, 1450: 1303, 1451: 1330, 1453: 1306, 1454: 1307, 1455: 1307, 1457: 1330, 1458: 1309, 1463: 1314, 1464: 1315, 1466: 5555, 1468: 1319, 1469: 1321, 1470: 1294, 1477: 1330, 1478: 1331, 1480: 1333, 1484: 1337, 1485: 1338, 1486: 1337, 1492: 1345, 1493: 1346, 1494: 1347, 1495: 1348, 1496: 1349, 1500: 1353, 1501: 1330, 1506: 5555, 647: 552, 648: 917, 652: 538, 653: 539, 655: 541, 657: 542, 661: 545, 662: 546, 664: 548, 665: 549, 669: 553, 671: 554, 672: 908, 673: 555, 676: 558, 1131: 1038, 1135: 1042, 649: 534, 650: 535, 658: 543, 659: 1042, 627: 519, 843: 720, 844: 716, 845: 717, 846: 718, 847: 719, 848: 722, 849: 723, 850: 724, 851: 721, 852: 721, 853: 728, 854: 725, 855: 726, 856: 727, 857: 728, 227: 205, 228: 206, 247: 213, 248: 214, 257: 216, 258: 217, 261: 219, 262: 220, 263: 221, 264: 222, 265: 224, 266: 225, 279: 233, 280: 234, 281: 235, 296: 238, 565: 455, 566: 456, 567: 457, 568: 458, 570: 460, 571: 461, 573: 463, 574: 464, 575: 465, 576: 468, 579: 467, 580: 466, 581: 198, 582: 5555, 1395: 199, 1396: 200, 916: 789, 917: 791, 918: 792, 919: 793, 920: 794, 963: 873, 921: 797, 922: 917, 923: 798, 924: 797, 925: 5555, 926: 801, 927: 802, 928: 804, 509: 178, 523: 179, 527: 181, 528: 179, 532: 186, 738: 1984, 741: 180, 742: 183, 768: 182, 1753: 5555, 1752: 177, 2334: 187, 617: 508, 618: 509, 815: 686, 816: 687, 817: 689, 818: 690, 819: 691, 820: 692, 821: 693, 822: 695, 823: 696, 824: 699, 825: 700, 828: 703, 829: 704, 830: 671, 831: 706, 832: 509, 833: 707, 834: 708, 534: 445, 535: 430, 536: 1429, 537: 432, 538: 432, 539: 432, 540: 193, 541: 449, 542: 433, 543: 444, 544: 433, 545: 434, 546: 435, 547: 436, 548: 437, 549: 439, 550: 440, 551: 441, 552: 441, 553: 442, 554: 446, 555: 444, 556: 447, 557: 448, 558: 450, 559: 435, 560: 451, 561: 455, 562: 453, 563: 454, 564: 455 };
const early4TextureIdMap: Record<number, number> = { 651: 537, 656: 542, 660: 544, 668: 552, 670: 553, 674: 556, 675: 557, 677: 559, 678: 560, 679: 561, 680: 562, 681: 562, 682: 563, 683: 564, 684: 565, 685: 567, 686: 568, 688: 5555, 689: 5555, 690: 5555, 691: 5555, 692: 5555, 693: 569, 803: 674, 2881: 566, 1183: 1083, 1184: 1084, 1185: 1085, 1186: 1086, 1188: 1088, 1189: 1093, 1191: 1090, 1200: 1108, 1202: 1035, 1203: 1100, 1205: 1102, 1206: 1103, 1207: 1104, 1208: 1090, 1210: 1108, 1211: 1110, 1214: 1113, 1216: 1115, 1219: 5555, 2795: 1105, 929: 951, 930: 917, 931: 919, 937: 943, 938: 926, 939: 943, 942: 5555, 943: 5555, 944: 5555, 947: 5555, 948: 943, 949: 5555, 950: 937, 951: 5555, 952: 5555, 954: 5555, 955: 949, 956: 942, 957: 943, 958: 944, 960: 947, 961: 947, 962: 948, 964: 949, 965: 950, 966: 950, 967: 952, 972: 957, 975: 960, 979: 964, 983: 968, 984: 968, 985: 969, 2486: 531, 629: 522, 630: 5555, 631: 524, 632: 524, 633: 525, 634: 526, 635: 5555, 636: 526, 646: 592, 647: 593, 648: 594, 649: 595, 650: 1330, 1336: 1303, 1339: 1306, 1340: 1307, 1352: 5555, 1354: 1320, 1355: 1321, 1356: 1294, 1364: 1330, 1365: 1331, 1371: 1337, 1373: 1337, 1379: 1345, 1380: 1346, 1381: 1347, 1383: 1349, 1388: 1330, 1393: 5555, 2497: 1338, 2498: 1315, 2499: 1333, 2500: 2298, 2501: 1348, 2502: 1314, 2503: 1330, 2504: 1309, 2505: 1353, 572: 917, 575: 537, 576: 538, 577: 539, 579: 541, 581: 542, 582: 543, 583: 544, 584: 545, 585: 546, 587: 548, 588: 549, 591: 552, 592: 553, 594: 554, 595: 908, 596: 555, 597: 556, 598: 557, 599: 558, 1054: 1038, 1058: 1042, 658: 543, 665: 549, 669: 553, 673: 555, 1131: 1038, 1135: 1042, 551: 519, 764: 720, 765: 716, 766: 717, 767: 718, 768: 719, 769: 722, 770: 723, 771: 724, 772: 721, 773: 721, 774: 728, 775: 725, 776: 726, 777: 727, 778: 728, 214: 205, 215: 206, 222: 213, 223: 214, 225: 216, 226: 217, 227: 219, 228: 220, 229: 221, 230: 222, 231: 224, 232: 225, 239: 233, 240: 234, 241: 235, 243: 238, 489: 456, 490: 457, 491: 458, 493: 460, 494: 461, 496: 463, 497: 465, 498: 466, 499: 467, 500: 468, 504: 198, 505: 5555, 2574: 199, 2575: 200, 2576: 5555, 836: 789, 837: 791, 838: 792, 839: 793, 840: 794, 2572: 790, 963: 873, 841: 797, 842: 917, 843: 798, 844: 797, 845: 797, 846: 5555, 926: 801, 927: 802, 928: 804, 2871: 1984, 2885: 179, 2886: 183, 2887: 186, 2888: 187, 2889: 182, 2890: 180, 2891: 178, 2892: 181, 2893: 177, 2894: 5555, 541: 508, 542: 509, 736: 686, 737: 687, 738: 689, 739: 690, 740: 691, 741: 692, 742: 693, 743: 695, 744: 696, 745: 699, 746: 700, 749: 703, 750: 704, 751: 2013, 752: 706, 753: 509, 754: 707, 755: 708, 756: 5555, 535: 430, 536: 1429, 537: 432, 538: 432, 539: 432, 540: 193, 544: 433, 545: 434, 546: 435, 547: 436, 548: 437, 549: 439, 550: 440, 552: 441, 553: 442, 554: 446, 555: 444, 556: 447, 557: 448, 558: 450, 560: 451, 561: 455, 562: 453, 563: 454, 564: 455, 2800: 436, 2801: 433, 2802: 1429, 2873: 445, 2884: 444, 253: 5555, 254: 5555, 256: 5555, 258: 5555, 259: 5555, 260: 5555, 510: 5555, 512: 5555, 514: 5555, 515: 5555, 517: 5555, 518: 5555, 519: 5555, 2507: 5555, 2508: 5555, 2509: 5555, 2510: 5555, 2511: 5555, 2512: 5555, 2513: 5555, 2514: 5555, 2515: 5555, 2516: 5555, 80: 76, 88: 84, 89: 85, 90: 86, 91: 87, 92: 88, 93: 89, 94: 90, 95: 91, 96: 92, 97: 93, 99: 95, 100: 96, 101: 97, 102: 98, 103: 99, 104: 100, 105: 102, 106: 101, 107: 103, 109: 105, 111: 107, 112: 108, 113: 109, 513: 410, 516: 411, 520: 414, 521: 415, 1716: 1552, 1717: 1553, 884: 768, 885: 757, 886: 757, 887: 759, 888: 760, 889: 761, 890: 762, 891: 764, 892: 765, 893: 766, 894: 755, 895: 767, 897: 769, 898: 770, 899: 772, 900: 773, 901: 774, 903: 777, 904: 778, 905: 779, 906: 780, 907: 755, 908: 781, 909: 782, 910: 783, 911: 784, 912: 785, 913: 786, 914: 787, 915: 788, 1301: 1187, 1302: 1187, 1305: 1242, 1306: 1188, 1308: 1191, 1309: 1192, 1310: 1191, 1311: 1192, 1312: 1194, 1313: 1193, 1314: 1194, 1315: 1228, 1322: 5555, 1330: 1236, 1332: 1211, 1333: 1241, 1335: 3610, 1338: 1209, 1341: 1216, 1342: 1217, 1343: 1218, 1344: 1215, 1345: 1221, 1346: 1198, 1349: 1226, 1350: 1227, 1357: 1236, 1358: 1239, 1359: 1240, 1360: 1241, 1361: 1243, 1362: 1244, 1370: 1246, 1390: 5555, 1391: 1248, 1395: 1249, 1396: 1249, 1397: 2341, 2825: 1219, 2826: 1219, 2833: 1213, 2834: 1214, 2835: 1215, 2836: 3612, 2837: 3613, 2838: 3614, 2839: 1223, 2840: 1224, 2841: 1225, 2842: 1201, 1153: 1131, 1154: 1132, 1155: 1133, 1156: 1134, 1157: 1135, 1158: 1136, 1159: 1137, 1160: 1138, 1161: 1139, 1163: 1140, 1164: 1141 };

const EARLY1_PER_MODEL_REMAP: { [mapNum: number]: { [srcId: number]: number } } = {
  15: { 100: 100, 114: 114, 124: 124, 489: 489, 630: 630, 1619: 1619, 1620: 1620, 1621: 1621, 1954: 1954, 2175: 2175, 2176: 2176, 2574: 2574, 2849: 2849 },
  64: { 91: 91, 565: 565, 705: 705, 736: 736 },
  30: { 57: 61, 58: 62, 86: 85, 87: 86, 93: 92, 666: 657, 530: 522, 533: 525, 532: 524, 531: 523, 528: 520, 675: 666, 529: 521, 523: 515, 524: 516 },
  7: { 559: 629, 568: 5, 556: 626, 553: 621, 549: 618, 547: 616, 532: 450, 946: 1030, 952: 553 }
};
const EARLY4_PER_MODEL_REMAP: { [mapNum: number]: { [srcId: number]: number } } = {
  11: { 649: 595, 650: 1330, 1335: 1337 },
  8: { 649: 534, 650: 535 },
  63: { 541: 508, 542: 509 },
  27: { 551: 441 },
  23: { 541: 519 },
  12: { 518: 412, 519: 413 },
  2: { 518: 491, 443: 486, 573: 491 },
  13: { 1352: 3611, 1354: 1230, 1355: 1229, 1356: 1232 },
  48: { 2718: 5555 }
};
const EARLYDUP_PER_MODEL_REMAP: { [mapNum: number]: { [srcId: number]: number } } = {
  7: { 1030: 1030, 1031: 1031, 1032: 1032 }
};
const DP_FACE_CLAMP_TEXIDS = new Set<number>([2562, 2575, 2581, 2761, 2762]);
const DP_FACE_SOFT_ALPHA_TEXIDS = new Set<number>([2562, 2581]);
const DP_FORCE_MIRROR_S_TEXIDS = new Set<number>([
 1172,1173,1026,1027 // put broken texId here
]);

const DP_FORCE_MIRROR_T_TEXIDS = new Set<number>([
]);
export class SFATextureFetcher extends TextureFetcher {
    private makeMutablePlaceholder(cache: GfxRenderCache, texId: number): SFATextureArray {
    const arr = makeFakeTexture(cache, Math.max(0, texId));
    const tex = arr.textures[0];

    if (tex.viewerTexture)
        tex.viewerTexture.name = `DP Placeholder #${texId}`;

    return arr;
}
    private texturesEnabled = true;
    private dpBinCache = new Map<number, SFATextureArray>();
    private dpTex0BinCache = new Map<number, SFATextureArray>();
private dpDecoded = new Map<number, {
    width: number; height: number;
    pixelFormat: number;
    pixels: Uint8Array;
    wrapS: GfxWrapMode; wrapT: GfxWrapMode;
    cutoutLikely: boolean;
}>();

private dpDerivedInfo = new Map<number, { baseId: number; r: number; g: number; b: number }>();
private dpDerivedKeyToId = new Map<string, number>();
private dpNextDerivedId = -1;

public getDPTintedTexId(baseId: number, r: number, g: number, b: number): number {
    const key = `${baseId|0}_${r|0}_${g|0}_${b|0}`;
    const hit = this.dpDerivedKeyToId.get(key);
    if (hit !== undefined) return hit;

    const id = this.dpNextDerivedId--;
    this.dpDerivedKeyToId.set(key, id);
    this.dpDerivedInfo.set(id, { baseId: baseId|0, r: r|0, g: g|0, b: b|0 });
    return id;
}
    public dataFetcherRef?: DataFetcher;
    private currentModelID: number = 0;
    private modelVersion: ModelVersion = ModelVersion.Final;
    private preferCOSModelIDs = new Set<number>();
    private pngOverrides = new Map<number, { path: string, opts?: OverrideOpts }>();
    private preloadedPngTextures = new Map<number, SFATextureArray>();

    private textableBin!: DataView;
    private texpre: TextureFile | null = null;
    private rootTex0: TextureFile | null = null;
    private rootTex1: TextureFile | null = null;
    private subdirTextureFiles: { [subdir: string]: SubdirTextureFiles } = {};
    private fakes: FakeTextureFetcher = new FakeTextureFetcher();

    public textureHolder: UI.TextureListHolder = { viewerTextures: [], onnewtextures: null };

    private constructor(private gameInfo: GameInfo, private isBeta: boolean) { super(); }

    public static async create(gameInfo: GameInfo, dataFetcher: DataFetcher, isBeta: boolean): Promise<SFATextureFetcher> {
        const self = new SFATextureFetcher(gameInfo, isBeta);
        self.dataFetcherRef = dataFetcher;
        const pathBase = self.gameInfo.pathBase;

        try {
            const [textableBin, texpre, rootTex0, rootTex1] = await Promise.all([
                dataFetcher.fetchData(`${pathBase}/TEXTABLE.bin`),
                fetchTextureFile(dataFetcher, `${pathBase}/TEXPRE.tab`, `${pathBase}/TEXPRE.bin`, false),
                fetchTextureFile(dataFetcher, `${pathBase}/TEX0.tab`, `${pathBase}/TEX0.bin`, false),
                fetchTextureFile(dataFetcher, `${pathBase}/TEX1.tab`, `${pathBase}/TEX1.bin`, false),
            ]);

            self.textableBin = textableBin ? textableBin.createDataView() : new DataView(new ArrayBuffer(0x8000));
            self.texpre = texpre;
            self.rootTex0 = rootTex0;
            self.rootTex1 = rootTex1;
        } catch (e) {
            self.textableBin = new DataView(new ArrayBuffer(0x8000));
            self.texpre = null;
            self.rootTex0 = null;
            self.rootTex1 = null;
        }

        return self;
    }

private async loadDPBinTexture(
    cache: GfxRenderCache,
    texId: number,
    pathBaseOverride?: string,
    prefixes: string[] = ['tex_'],
    targetCache: Map<number, SFATextureArray> = this.dpBinCache,
) {
    if (!this.dataFetcherRef) return;

    if (!Number.isInteger(texId) || texId < 0 || texId > 0x7FFF)
        return;

    const idStr = (texId < 1000) ? texId.toString().padStart(3, '0') : texId.toString();
    const pathBase = pathBaseOverride ?? this.gameInfo.pathBase;

    for (const prefix of prefixes) {
        const path = `${pathBase}/uncompressed_textures/${prefix}${idStr}.bin`;

        try {
            const buf = await this.dataFetcherRef.fetchData(path, { allow404: true }).catch(() => null);
            if (!buf || buf.byteLength === 0)
                continue;

            const decoded = decodeRareN64Texture(buf.createDataView());
            if (!decoded)
                continue;

            const device = cache.device;

            if (texId === 16 || texId === 17) {
                for (let i = 0; i < decoded.pixels.length; i += 4)
                    decoded.pixels[i + 3] = 0;
            }

            const forceClampFace = DP_FACE_CLAMP_TEXIDS.has(texId);
            const preserveSoftAlpha = DP_FACE_SOFT_ALPHA_TEXIDS.has(texId);

            let solidLeft = 0;
            let solidRight = 0;
            let solidTop = 0;
            let solidBottom = 0;
            let invisibleCount = 0;

            for (let y = 0; y < decoded.height; y++) {
                for (let x = 0; x < decoded.width; x++) {
                    const i = (y * decoded.width + x) * 4;
                    const r = decoded.pixels[i + 0];
                    const g = decoded.pixels[i + 1];
                    const b = decoded.pixels[i + 2];
                    let a = decoded.pixels[i + 3];

                    if (!preserveSoftAlpha) {
                        if (b > 200 && r < 40 && g < 40)
                            a = 0;

                        if (a === 0) {
                            decoded.pixels[i + 0] = 0;
                            decoded.pixels[i + 1] = 0;
                            decoded.pixels[i + 2] = 0;
                            decoded.pixels[i + 3] = 0;
                            invisibleCount++;
                            continue;
                        }

                        if (a > 20 && a < 255) {
                            a = Math.min(255, Math.floor(a * 1.2));
                            decoded.pixels[i + 3] = a;
                        }
                    } else {
                        decoded.pixels[i + 3] = a;
                        if (a === 0) {
                            invisibleCount++;
                            continue;
                        }
                    }

                    if (a > 50) {
                        if (x === 0) solidLeft++;
                        if (x === decoded.width - 1) solidRight++;
                        if (y === 0) solidTop++;
                        if (y === decoded.height - 1) solidBottom++;
                    }
                }
            }

            const gfxTexture = device.createTexture(makeTextureDescriptor2D(GfxFormat.U8_RGBA_NORM, decoded.width, decoded.height, 1));
            device.uploadTextureData(gfxTexture, 0, [decoded.pixels]);

            const wrapFromN64 = (cm: number): GfxWrapMode => {
                if (cm & 0x02) return GfxWrapMode.Clamp;
                if (cm & 0x01) return GfxWrapMode.Mirror;
                return GfxWrapMode.Repeat;
            };

            let wrapS = wrapFromN64(decoded.cms);
            let wrapT = wrapFromN64(decoded.cmt);

            const totalPixels = decoded.width * decoded.height;

            if (forceClampFace) {
                wrapS = GfxWrapMode.Clamp;
                wrapT = GfxWrapMode.Clamp;
            } else if (invisibleCount > (totalPixels * 0.02)) {
                wrapS = (solidLeft > 0 && solidRight > 0) ? GfxWrapMode.Repeat : GfxWrapMode.Clamp;
                wrapT = (solidTop > 0 && solidBottom > 0) ? GfxWrapMode.Repeat : GfxWrapMode.Clamp;
            }

            if (DP_FORCE_MIRROR_S_TEXIDS.has(texId))
                wrapS = GfxWrapMode.Mirror;
            if (DP_FORCE_MIRROR_T_TEXIDS.has(texId))
                wrapT = GfxWrapMode.Mirror;

            const cutoutLikely = invisibleCount > (totalPixels * 0.02);

            this.dpDecoded.set(texId, {
                width: decoded.width,
                height: decoded.height,
                pixelFormat: decoded.pixelFormat,
                pixels: decoded.pixels.slice(),
                wrapS,
                wrapT,
                cutoutLikely,
            });

            for (const [derivedId, info] of this.dpDerivedInfo) {
                if (info.baseId === texId)
                    this.buildDPDerivedTexture(cache, derivedId);
            }

            const gfxSampler = cache.createSampler({
                wrapS,
                wrapT,
                minFilter: GfxTexFilterMode.Bilinear,
                magFilter: GfxTexFilterMode.Bilinear,
                mipFilter: GfxMipFilterMode.Nearest,
                minLOD: 0,
                maxLOD: 0,
            });

            const cachedArray = targetCache.get(texId);
            if (cachedArray && cachedArray.textures[0]) {
                const fakeTex = cachedArray.textures[0];
                fakeTex.updateTextureAndNotify(gfxTexture, decoded.width, decoded.height, gfxSampler);

                const canvas = document.createElement('canvas');
                canvas.width = decoded.width;
                canvas.height = decoded.height;
                const ctx = canvas.getContext('2d')!;

                const clampedData = new Uint8ClampedArray(decoded.pixels);
                const imgData = new ImageData(clampedData, decoded.width, decoded.height);
                ctx.putImageData(imgData, 0, 0);

                if (!fakeTex.viewerTexture) {
                    fakeTex.viewerTexture = {
                        name: `DP Texture #${texId}`,
                        surfaces: [canvas],
                    } as any;

                    if (this.textureHolder.viewerTextures.indexOf(fakeTex.viewerTexture!) === -1)
                        this.textureHolder.viewerTextures.push(fakeTex.viewerTexture!);
                } else {
                    fakeTex.viewerTexture.surfaces = [canvas];
                }

                if (this.textureHolder.onnewtextures)
                    this.textureHolder.onnewtextures();
            }

          //  console.warn(`[DP TEX BIN] loaded ${prefix}${idStr}.bin for texId=${texId}`);
            return;
        } catch (e) {
        }
    }
}
private getDPTex0BinTextureArray(cache: GfxRenderCache, texId: number, pathBaseOverride?: string): SFATextureArray | null {
    if (!Number.isInteger(texId) || texId < 0 || texId > 0x7FFF)
        return this.makeMutablePlaceholder(cache, 0);

    if (this.dpTex0BinCache.has(texId))
        return this.dpTex0BinCache.get(texId)!;

    const mutableArray = this.makeMutablePlaceholder(cache, texId);
    this.dpTex0BinCache.set(texId, mutableArray);

    void this.loadDPBinTexture(cache, texId, pathBaseOverride, ['tex0_', 'tex_'], this.dpTex0BinCache);

    return mutableArray;
}
private buildDPDerivedTexture(cache: GfxRenderCache, derivedId: number) {
    const info = this.dpDerivedInfo.get(derivedId);
    if (!info) return;

    const base = this.dpDecoded.get(info.baseId);
    if (!base) {
        this.loadDPBinTexture(cache, info.baseId);
        return;
    }

 
    const isIntensityFmt = (base.pixelFormat >= 2 && base.pixelFormat <= 6);
    const doTint = isIntensityFmt && base.cutoutLikely;

    const pixels = base.pixels.slice();
    if (doTint) {
        for (let i = 0; i < pixels.length; i += 4) {
            const intensity = pixels[i + 0]; // greyscale
            pixels[i + 0] = (intensity * info.r / 255) | 0;
            pixels[i + 1] = (intensity * info.g / 255) | 0;
            pixels[i + 2] = (intensity * info.b / 255) | 0;
            // keep alpha
        }
    }

    const device = cache.device;
    const gfxTexture = device.createTexture(makeTextureDescriptor2D(GfxFormat.U8_RGBA_NORM, base.width, base.height, 1));
    device.uploadTextureData(gfxTexture, 0, [pixels]);

    const gfxSampler = cache.createSampler({
        wrapS: base.wrapS,
        wrapT: base.wrapT,
        minFilter: GfxTexFilterMode.Bilinear,
        magFilter: GfxTexFilterMode.Bilinear,
        mipFilter: GfxMipFilterMode.Nearest,
        minLOD: 0,
        maxLOD: 0,
    });

    const arr = this.dpBinCache.get(derivedId);
    if (arr && arr.textures[0]) {
        arr.textures[0].updateTextureAndNotify(gfxTexture, base.width, base.height, gfxSampler);
    }
}

private getDPBinTextureArray(cache: GfxRenderCache, texId: number, useTex1: boolean, pathBaseOverride?: string): SFATextureArray | null {
    if (!Number.isInteger(texId) || texId < 0 || texId > 0x7FFF)
        return this.makeMutablePlaceholder(cache, 0);

    if (this.dpBinCache.has(texId))
        return this.dpBinCache.get(texId)!;

    const mutableArray = this.makeMutablePlaceholder(cache, texId);
    this.dpBinCache.set(texId, mutableArray);

    void this.loadDPBinTexture(cache, texId, pathBaseOverride);

    return mutableArray;
}

    public getTextureArray(cache: GfxRenderCache, texId: number, useTex1: boolean): SFATextureArray | null {
if (this.modelVersion === ModelVersion.DinosaurPlanet) {
    if (texId < 0 && this.dpDerivedInfo.has(texId)) {
        if (this.dpBinCache.has(texId))
            return this.dpBinCache.get(texId)!;

        const fakeTex = this.fakes.getTextureArray(cache, 0, useTex1)!.textures[0];
        const arr = new SFATextureArray([fakeTex]);
        this.dpBinCache.set(texId, arr);

        this.buildDPDerivedTexture(cache, texId);
        return arr;
    }

    return this.getDPBinTextureArray(cache, texId, useTex1);
}

        if (!this.texturesEnabled) return this.fakes.getTextureArray(cache, texId, useTex1); 
        if (this.modelVersion === ModelVersion.Early1) {
            const per = EARLY1_PER_MODEL_REMAP[this.currentModelID];
            if (per && per[texId] !== undefined) texId = per[texId];
            else if (early1TextureIdMap[texId] !== undefined) texId = early1TextureIdMap[texId];
            else return this.fakes.getTextureArray(cache, texId, useTex1);
      } else if (this.modelVersion === ModelVersion.AncientMap) {
    const per = ANCIENT_DP_PER_MODEL_REMAP[this.currentModelID];
    const dpHit = per ? per[texId] : undefined;

    if (dpHit !== undefined) {
        return this.getDPBinTextureArray(cache, dpHit.id, dpHit.useTex1, DP_GAME_INFO.pathBase);
    }

    if (!(texId in ancientMapTextureIdMap))
        return this.fakes.getTextureArray(cache, texId, useTex1);

    texId = ancientMapTextureIdMap[texId];

        } else if (this.modelVersion === ModelVersion.dup) {
            const per = EARLYDUP_PER_MODEL_REMAP[this.currentModelID];
            if (per && per[texId] !== undefined) texId = per[texId];
            else if (earlydupTextureIdMap[texId] !== undefined) texId = earlydupTextureIdMap[texId];
            else return this.fakes.getTextureArray(cache, texId, useTex1);
        } else if (this.modelVersion === ModelVersion.fear) {
            if (!(texId in fearMapTextureIdMap)) return this.fakes.getTextureArray(cache, texId, useTex1);
            texId = fearMapTextureIdMap[texId];
        } else if (this.modelVersion === ModelVersion.dfpt) {
            if (!(texId in dftpmap)) return this.fakes.getTextureArray(cache, texId, useTex1);
            texId = dftpmap[texId];
        } else if (this.modelVersion === ModelVersion.Early2) {
            if (!(texId in early2TextureIdMap)) return this.fakes.getTextureArray(cache, texId, useTex1);
            texId = early2TextureIdMap[texId];
        } else if (this.modelVersion === ModelVersion.Early4) {
            const per = EARLY4_PER_MODEL_REMAP[this.currentModelID];
            if (per && per[texId] !== undefined) texId = per[texId];
            else if (early4TextureIdMap[texId] !== undefined) texId = early4TextureIdMap[texId];
            else return this.fakes.getTextureArray(cache, texId, useTex1);
        } else if (this.modelVersion === ModelVersion.Early3) {
            if (!(texId in early3TextureIdMap)) return this.fakes.getTextureArray(cache, texId, useTex1);
            texId = early3TextureIdMap[texId];
        }

        const pngHit = this.preloadedPngTextures.get(texId);
        if (pngHit) return pngHit;

        let file = this.getTextureFile(texId, useTex1);
        if (file.file === null) return this.fakes.getTextureArray(cache, texId, useTex1);
        const isNewlyLoaded = !file.file.isTextureLoaded(file.texNum);
        const textureArray = file.file.getTextureArray(cache, file.texNum);
        if (textureArray === null) return this.fakes.getTextureArray(cache, texId, useTex1);

        if (isNewlyLoaded) {
            for (let t of textureArray.textures) {
                if (t.viewerTexture && this.textureHolder.viewerTextures.indexOf(t.viewerTexture) === -1) {
                    this.textureHolder.viewerTextures.push(t.viewerTexture);
                }
            }
            if (this.textureHolder.onnewtextures) this.textureHolder.onnewtextures();
        }
        return textureArray;
    }

    private getTextureFile(texId: number, useTex1: boolean): { texNum: number, file: TextureFile | null } {
        let texNum = texId;
        if (!useTex1) {
            const val = this.textableBin.getUint16(texId * 2);
            if (texId < 3000 || val === 0) texNum = val;
            else return { texNum: val + 1, file: this.texpre };
        }
        for (const s in this.subdirTextureFiles) {
            const f = useTex1 ? this.subdirTextureFiles[s].tex1 : this.subdirTextureFiles[s].tex0;
            if (f && f.hasTexture(texNum)) return { texNum, file: f };
        }
        return { texNum, file: null };
    }

public getDirectRootTexture(cache: GfxRenderCache, texNum: number, useTex1: boolean): SFATexture | null {
    return this.getRootTextureArray(cache, texNum, useTex1)?.textures[0] ?? null;
}
public getDPTextureByTex0ID(cache: GfxRenderCache, tex0Id: number): SFATexture | null {
    if (tex0Id < 0)
        return null;

    return (
        this.getDPTex0BinTextureArray(cache, tex0Id)?.textures[0] ??
        this.getRootTextureArray(cache, tex0Id, false)?.textures[0] ??
        null
    );
}

public getDPTextureByTextableID(cache: GfxRenderCache, textableId: number): SFATexture | null {
    if (textableId < 0)
        return null;

    const offs = textableId * 2;
    if (offs + 2 > this.textableBin.byteLength)
        return null;

    const tex0Id = this.textableBin.getUint16(offs);

    return this.getDPTextureByTex0ID(cache, tex0Id);
}
    private getRootTextureArray(cache: GfxRenderCache, texNum: number, useTex1: boolean): SFATextureArray | null {
        const file = useTex1 ? this.rootTex1 : this.rootTex0;
        if (!file || !file.hasTexture(texNum))
            return null;

        const isNewlyLoaded = !file.isTextureLoaded(texNum);
        const textureArray = file.getTextureArray(cache, texNum);
        if (textureArray === null)
            return null;

        if (isNewlyLoaded) {
            for (const t of textureArray.textures) {
                if (t.viewerTexture && this.textureHolder.viewerTextures.indexOf(t.viewerTexture) === -1) {
                    this.textureHolder.viewerTextures.push(t.viewerTexture);
                }
            }
            if (this.textureHolder.onnewtextures)
                this.textureHolder.onnewtextures();
        }

        return textureArray;
    }
    private loadingSubdirs = new Set<string>();
    private async loadSubdir(subdir: string, dataFetcher: DataFetcher) {
        if (this.loadingSubdirs.has(subdir)) return;
        this.loadingSubdirs.add(subdir);
        if (this.subdirTextureFiles[subdir] === undefined) {
            const pathBase = this.gameInfo.pathBase;
            const [tex0, tex1] = await Promise.all([
                fetchTextureFile(dataFetcher, `${pathBase}/${subdir}/TEX0.tab`, `${pathBase}/${subdir}/TEX0.bin`, this.isBeta),
                fetchTextureFile(dataFetcher, `${pathBase}/${subdir}/TEX1.tab`, `${pathBase}/${subdir}/TEX1.bin`, this.isBeta),
            ]);
            this.subdirTextureFiles[subdir] = new SubdirTextureFiles(tex0, tex1);
        }
    }

    public async loadSubdirs(subdirs: string[], dataFetcher: DataFetcher) {
        const promises: Promise<void>[] = [];
        for (let subdir of subdirs) promises.push(this.loadSubdir(subdir, dataFetcher));
        await Promise.all(promises);
    }

    public listAllTextureIDs(useTex1: boolean = false): number[] {
        const out = new Set<number>();
        for (const s in this.subdirTextureFiles) {
            const f = useTex1 ? this.subdirTextureFiles[s].tex1 : this.subdirTextureFiles[s].tex0;
            if (f) for (const id of f.listAllValidIds()) out.add(id);
        }
        return [...out].sort((a, b) => a - b);
    }

    public setTexturesEnabled(on: boolean) { this.texturesEnabled = on; }
    public getTexturesEnabled() { return this.texturesEnabled; }
    public setModelVersion(v: ModelVersion) { this.modelVersion = v; }
    public setCurrentModelID(id: number) { this.currentModelID = id | 0; }
    public preferCopyOfSwapholForModelIDs(ids: number[]) { for (const id of ids) this.preferCOSModelIDs.add(id | 0); }
    public setPngOverride(id: number, p: string, o?: OverrideOpts) { this.pngOverrides.set(id, { path: p, opts: o }); }
    public async preloadPngOverrides(cache: GfxRenderCache, dataFetcher: DataFetcher) {
        for (const [id, { path: p, opts: o }] of this.pngOverrides) {
            if (this.preloadedPngTextures.has(id)) continue;
            const buf = await dataFetcher.fetchData(`${this.gameInfo.pathBase}/${p}`);
            const tex = await createSFATextureFromPNG(cache, buf.createTypedArray(Uint8Array), o);
            this.preloadedPngTextures.set(id, new SFATextureArray([tex]));
        }
    }
    public loadAllFromTables(cache: GfxRenderCache, useTex1: boolean): { attempted: number, shown: number } {
        let attempted = 0;
        let shown = 0;

        for (const subdir in this.subdirTextureFiles) {
            const file = useTex1 ? this.subdirTextureFiles[subdir].tex1 : this.subdirTextureFiles[subdir].tex0;
            if (!file) continue;

            const ids = file.listAllValidIds();
            for (const id of ids) {
                attempted++;
                const texArray = file.getTextureArray(cache, id);
                if (texArray) {
                    shown++;
                }
            }
        }
        return { attempted, shown };
    }
public getTextureByTextable(cache: GfxRenderCache, textableId: number): SFATexture | null {
    if (textableId < 0)
        return null;

    if (this.modelVersion === ModelVersion.DinosaurPlanet) {
        let tex = this.getRootTextureArray(cache, textableId, false)?.textures[0] ?? null;
        if (tex)
            return tex;

        tex = this.getDPTex0BinTextureArray(cache, textableId)?.textures[0] ?? null;
        if (tex)
            return tex;

        const offs = textableId * 2;
        if (offs + 2 > this.textableBin.byteLength)
            return null;

        const resolvedTex0Id = this.textableBin.getUint16(offs);

        tex = this.getRootTextureArray(cache, resolvedTex0Id, false)?.textures[0] ?? null;
        if (tex)
            return tex;

        tex = this.getDPTex0BinTextureArray(cache, resolvedTex0Id)?.textures[0] ?? null;
        if (tex)
            return tex;

        return null;
    }

    const offs = textableId * 2;
    if (offs + 2 > this.textableBin.byteLength)
        return null;

    return this.getTexture(cache, textableId, false);
}
    public destroy(device: GfxDevice) {
        this.texpre?.destroy(device);
        this.rootTex0?.destroy(device);
        this.rootTex1?.destroy(device);
        for (let s in this.subdirTextureFiles) this.subdirTextureFiles[s].destroy(device);
        this.subdirTextureFiles = {};
        this.fakes.destroy(device);
    }
}