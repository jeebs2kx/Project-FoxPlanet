import { DataFetcher } from '../DataFetcher.js';
import { GameInfo } from './scenes.js';
import { SFATextureFetcher } from './textures.js';

const DP_LEVELNAME_ELEMENT_ID = 'dp-levelname-overlay';
const DP_FONT_DINO_MEDIUM_FONT_IN = 4;
const DP_FONT_SIZE = 0x8C0;
const DP_FONT_TEXTURE_IDS_OFFS = 0x40;
const DP_FONT_GLYPHS_OFFS = 0xC0;
const DP_FONT_GLYPH_COUNT = 256;

type DPFontGlyph = {
    textureIndex: number;
    kerning: number;
    offsetX: number;
    offsetY: number;
    textureU: number;
    textureV: number;
    width: number;
    height: number;
};

type DPBitmapFont = {
    name: string;
    textureIds: number[];
    glyphs: DPFontGlyph[];
    lineHeight: number;
    spaceAdvance: number;
    atlasCanvases: Map<number, HTMLCanvasElement>;
};

type DPLevelNameDef = {
    text: string;
    displayDurationFrames: number;
    scale?: number;
};

// Dragon Rock test entries.
// dpscenes.ts: Dragon Rock Top = 2, Dragon Rock Bottom = 52.
const DP_LEVELNAME_BY_MAP_ID: Record<number, DPLevelNameDef> = {
    2: { text: 'DRAGON\nROCK', displayDurationFrames: 260 },
    3: { text: 'KRAZOA\nPALACE', displayDurationFrames: 260 },
    4: { text: 'VOLCANO\nFORCE POINT\nTEMPLE', displayDurationFrames: 260, scale: 0.40 },
    5: { text: 'ROLLING\nDEMO', displayDurationFrames: 260 },
    6: { text: 'DISCOVERY\nFALLS', displayDurationFrames: 260, scale: 0.45 },
    7: { text: 'SWAPSTONE\nHOLLOW', displayDurationFrames: 260, scale: 0.40 },
    8: { text: 'SWAPSTONE\nHOLLOW\nBOTTOM', displayDurationFrames: 260, scale: 0.40 },
    9: { text: 'GOLDEN\nPLAINS', displayDurationFrames: 260 },
    10: { text: 'SNOWHORN\nWASTES', displayDurationFrames: 260, scale: 0.45 },
    11: { text: 'WARLOCK\nMOUNTAIN', displayDurationFrames: 260, scale: 0.45 },
    12: { text: 'CLOUDRUNNER\nFORTRESS', displayDurationFrames: 260, scale: 0.35 },
    13: { text: 'WALLED\nCITY', displayDurationFrames: 260 },
    14: { text: 'SWAPSTONE\nCIRCLE', displayDurationFrames: 260, scale: 0.40 },
    15: { text: 'CLOUDRUNNER\nTREASURE', displayDurationFrames: 260, scale: 0.35 },
    16: { text: 'CLOUDRUNNER\nDUNGEON', displayDurationFrames: 260, scale: 0.35 },
    18: { text: 'MOON\nMOUNTAIN\nPASS', displayDurationFrames: 260, scale: 0.40 },
    19: { text: 'DARKICE\nMINES', displayDurationFrames: 260 },
    20: { text: 'KRAZOA\nSHRINE\n(UNUSED)', displayDurationFrames: 260, scale: 0.40 },
    21: { text: 'DESERT\nFORCE\nPOINT\nBOTTOM', displayDurationFrames: 260, scale: 0.40 },
    22: { text: 'UNUSED\nKRAZOA\nTEST\nALT', displayDurationFrames: 260, scale: 0.40 },
    23: { text: 'ICE\nMOUNTAIN\n1', displayDurationFrames: 260, scale: 0.40 },
    24: { text: 'ICE\nMOUNTAIN\n2', displayDurationFrames: 260, scale: 0.40 },
    25: { text: 'ICE\nMOUNTAIN\n3', displayDurationFrames: 260, scale: 0.40 },
    26: { text: 'ANIMTEST', displayDurationFrames: 260, scale: 0.40 },
    27: { text: 'DARKICE\nMINES\n2', displayDurationFrames: 260, scale: 0.40 },
    28: { text: 'BOSS\nGALDON', displayDurationFrames: 260 },
    29: { text: 'CAPE\nCLAW', displayDurationFrames: 260 },
    30: { text: 'INSIDE\nGALLEON', displayDurationFrames: 260 },
    31: { text: 'TEST\nOF\nCOMBAT', displayDurationFrames: 260, scale: 0.40 },
    32: { text: 'TEST\nOF\nFEAR', displayDurationFrames: 260, scale: 0.40 },
    33: { text: 'TEST\nOF\nSKILL', displayDurationFrames: 260, scale: 0.40 },
    34: { text: 'TEST\nOF\nKNOWLEDGE', displayDurationFrames: 260, scale: 0.40 },
    35: { text: 'DIAMOND\nBAY', displayDurationFrames: 260 },
    36: { text: 'EARTHWALKER\nTEMPLE', displayDurationFrames: 260, scale: 0.35 },
    37: { text: 'WILLOW\nGROVE', displayDurationFrames: 260 },
    38: { text: 'BLACKWATER\nCANYON', displayDurationFrames: 260, scale: 0.35 },
    39: { text: 'TEST\nOF\nSTRENGTH', displayDurationFrames: 260, scale: 0.40 },
    40: { text: 'TEST\nOF\nSACRIFICE', displayDurationFrames: 260, scale: 0.40 },
    41: { text: 'TEST\nOF\nCHARACTER', displayDurationFrames: 260, scale: 0.40 },
    43: { text: 'CLOUDRUNNER\nRACE', displayDurationFrames: 260, scale: 0.35 },
    44: { text: 'BOSS\nDRAKOR', displayDurationFrames: 260 },
    45: { text: 'WMINSERT\nUNUSED', displayDurationFrames: 260,  scale: 0.35 },
    46: { text: 'DARKICE\nMINES\nCAVES', displayDurationFrames: 260, scale: 0.40 },
    47: { text: 'DARKICE\nMINES\nLAVA', displayDurationFrames: 260, scale: 0.40 },
    48: { text: 'BOSS\nKLANADACK', displayDurationFrames: 260,  scale: 0.35 },
    49: { text: 'MIKES\nLAVA', displayDurationFrames: 260,  scale: 0.35 },
    50: { text: 'DESERT\nFORCE\nPOINT\nTEMPLE', displayDurationFrames: 260, scale: 0.40 },
    51: { text: 'SWAP\nSTORE', displayDurationFrames: 260 },
    52: { text: 'DRAGON\nROCK\nBOTTOM', displayDurationFrames: 260, scale: 0.40 },
    53: { text: 'BOSS\nKAMERIAN\nDRAGON', displayDurationFrames: 260, scale: 0.40 },
    54: { text: 'MAGIC\nCAVE\nSMALL', displayDurationFrames: 260, scale: 0.40 },
};

let fontPromise: Promise<DPBitmapFont> | null = null;

function readAsciiZ(dv: DataView, offs: number, maxLen: number): string {
    let s = '';
    for (let i = 0; i < maxLen; i++) {
        const c = dv.getUint8(offs + i);
        if (c === 0)
            break;
        s += String.fromCharCode(c);
    }
    return s;
}

function parseDPFont(fontsDv: DataView, fontIndex: number): Omit<DPBitmapFont, 'atlasCanvases'> {
    const fontCount = fontsDv.getUint32(0);
    if (fontIndex < 0 || fontIndex >= fontCount)
        throw new Error(`FONTS.bin does not contain font index ${fontIndex}`);

    const fontBase = 4 + (fontIndex * DP_FONT_SIZE);

    const name = readAsciiZ(fontsDv, fontBase + 0x00, 0x20);

    const textureIds: number[] = [];
    for (let i = 0; i < 64; i++)
        textureIds.push(fontsDv.getInt16(fontBase + DP_FONT_TEXTURE_IDS_OFFS + (i * 2)));

    const glyphs: DPFontGlyph[] = [];
    let maxGlyphHeight = 0;

    for (let i = 0; i < DP_FONT_GLYPH_COUNT; i++) {
        const offs = fontBase + DP_FONT_GLYPHS_OFFS + (i * 8);

        const glyph: DPFontGlyph = {
            textureIndex: fontsDv.getUint8(offs + 0),
            kerning: fontsDv.getInt8(offs + 1),
            offsetX: fontsDv.getInt8(offs + 2),
            offsetY: fontsDv.getInt8(offs + 3),
            textureU: fontsDv.getUint8(offs + 4),
            textureV: fontsDv.getUint8(offs + 5),
            width: fontsDv.getUint8(offs + 6),
            height: fontsDv.getUint8(offs + 7),
        };

        glyphs.push(glyph);
        maxGlyphHeight = Math.max(maxGlyphHeight, glyph.height + Math.max(0, glyph.offsetY));
    }

    const spaceGlyph = glyphs[0x20];
    const spaceAdvance =
        spaceGlyph.kerning !== 0
            ? spaceGlyph.kerning
            : Math.max(4, spaceGlyph.width !== 0 ? spaceGlyph.width : Math.floor(maxGlyphHeight / 3));

    return {
        name,
        textureIds,
        glyphs,
        lineHeight: Math.max(1, maxGlyphHeight),
        spaceAdvance,
    };
}

function getDPDecodedTexture(
    textureFetcher: SFATextureFetcher,
    texId: number,
): { width: number; height: number; pixels: Uint8Array } | null {
    const fetcherAny = textureFetcher as any;

    const dpDecoded:
        | Map<number, { width: number; height: number; pixels: Uint8Array }>
        | undefined = fetcherAny.dpDecoded;

    const hit = dpDecoded?.get(texId);
    if (hit === undefined)
        return null;

    return hit;
}

function decodedTextureToCanvas(decoded: { width: number; height: number; pixels: Uint8Array }): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = decoded.width;
    canvas.height = decoded.height;

    const ctx = canvas.getContext('2d');
    if (ctx === null)
        throw new Error('Could not create DP font texture canvas context');

    const imageData = ctx.createImageData(decoded.width, decoded.height);
    imageData.data.set(new Uint8ClampedArray(decoded.pixels));
    ctx.putImageData(imageData, 0, 0);

    return canvas;
}

async function waitForDPFontTextureCanvas(
    textureFetcher: SFATextureFetcher,
    materialCache: any,
    texId: number,
    timeoutMs: number = 4000,
): Promise<HTMLCanvasElement | null> {
    const fetcherAny = textureFetcher as any;

    // Important:
    // Force the DP uncompressed TEX0 path:
    // dinosaurplanet/uncompressed_textures/tex0_836.bin etc.
    //
    // This is private in TypeScript, but not private at runtime.
    if (typeof fetcherAny.getDPTex0BinTextureArray === 'function')
        void fetcherAny.getDPTex0BinTextureArray(materialCache, texId);

    const startTime = performance.now();

    for (;;) {
        const decoded = getDPDecodedTexture(textureFetcher, texId);
        if (decoded !== null)
            return decodedTextureToCanvas(decoded);

        // Keep poking the async loader while waiting.
        if (typeof fetcherAny.getDPTex0BinTextureArray === 'function')
            void fetcherAny.getDPTex0BinTextureArray(materialCache, texId);

        if ((performance.now() - startTime) >= timeoutMs)
            return null;

        await new Promise<void>((resolve) => window.setTimeout(resolve, 16));
    }
}


async function loadDPLevelNameFont(
    gameInfo: GameInfo,
    dataFetcher: DataFetcher,
    materialCache: any,
): Promise<DPBitmapFont> {
    if (fontPromise !== null)
        return fontPromise;

    fontPromise = (async () => {
        const fontsBin = await dataFetcher.fetchData(`${gameInfo.pathBase}/FONTS.bin`);
        const parsed = parseDPFont(fontsBin.createDataView(), DP_FONT_DINO_MEDIUM_FONT_IN);

      //  console.log(
       //     'DP levelname font',
       //     parsed.name,
       //     'textureIds',
       //     parsed.textureIds.filter((id) => id >= 0).slice(0, 16),
     //   );

        for (const ch of 'DRAGON ROCK') {
            const code = ch.charCodeAt(0) & 0xFF;
            const g = parsed.glyphs[code];
          //  console.log('DP glyph', ch, code, g);
        }

const textureFetcher = await SFATextureFetcher.create(gameInfo, dataFetcher, false);
const atlasCanvases = new Map<number, HTMLCanvasElement>();

const neededTextureIds = new Set<number>();

for (const def of Object.values(DP_LEVELNAME_BY_MAP_ID)) {
    for (const ch of def.text) {
        const code = ch.charCodeAt(0) & 0xFF;
        const glyph = parsed.glyphs[code];

        if (glyph === undefined)
            continue;

        if (glyph.textureIndex === 0xFF)
            continue;

        const texId = parsed.textureIds[glyph.textureIndex];
        if (texId !== undefined && texId >= 0)
            neededTextureIds.add(texId);
    }
}

//console.log(
   // 'DP levelname needed TEX pages',
   // [...neededTextureIds],
//);

for (const texId of neededTextureIds) {
    const canvas = await waitForDPFontTextureCanvas(textureFetcher, materialCache, texId, 4000);

    if (canvas === null) {
       // console.warn('DP levelname missing font TEX page', texId);
        continue;
    }

    atlasCanvases.set(texId, canvas);
}

//console.log(
    //'DP levelname atlasCount',
   // atlasCanvases.size,
  //  'needed',
  //  [...neededTextureIds],
//);

        return {
            ...parsed,
            atlasCanvases,
        };
    })();

    return fontPromise;
}

function getMainViewerCanvas(): HTMLCanvasElement | null {
    const canvases = Array.from(document.querySelectorAll('canvas')) as HTMLCanvasElement[];

    let bestCanvas: HTMLCanvasElement | null = null;
    let bestArea = 0;

    for (const canvas of canvases) {
        if (canvas.closest(`#${DP_LEVELNAME_ELEMENT_ID}`) !== null)
            continue;

        const rect = canvas.getBoundingClientRect();
        const area = rect.width * rect.height;

        // Main noclip/WebGL canvas should be the biggest canvas on screen.
        if (area > bestArea) {
            bestArea = area;
            bestCanvas = canvas;
        }
    }

    return bestCanvas;
}

function restoreDPLevelNameParentState(root: HTMLElement): void {
    const parent = root.parentElement as HTMLElement | null;
    if (parent === null)
        return;

    const hadInlinePosition = root.dataset.dpHadInlinePosition === '1';
    const oldInlinePosition = root.dataset.dpOldInlinePosition ?? '';

    if (hadInlinePosition) {
        parent.style.position = oldInlinePosition;
    } else {
        parent.style.removeProperty('position');
    }
}

function insertDPLevelNameOverlay(root: HTMLElement): void {
    const mainCanvas = getMainViewerCanvas();

    if (mainCanvas !== null && mainCanvas.parentElement !== null) {
        const parent = mainCanvas.parentElement as HTMLElement;

        root.dataset.dpHadInlinePosition = parent.style.position !== '' ? '1' : '0';
        root.dataset.dpOldInlinePosition = parent.style.position;

        const style = window.getComputedStyle(parent);
        if (style.position === 'static')
            parent.style.position = 'relative';

        parent.insertBefore(root, mainCanvas.nextSibling);
        return;
    }

    document.body.appendChild(root);
}

function removeExistingDPLevelNameOverlay(): void {
    const old = document.getElementById(DP_LEVELNAME_ELEMENT_ID) as HTMLElement | null;
    if (old !== null) {
        restoreDPLevelNameParentState(old);
        old.remove();
    }
}

function isAnyNoclipMenuOpen(): boolean {
    const selectors = [
        '.panel-container',
        '.scene-select-panel',
        '.scene-select',
        '.Panel',
        '.panel',
    ];

    for (const selector of selectors) {
        const elems = Array.from(document.querySelectorAll(selector));
        for (const elem of elems) {
            const h = elem as HTMLElement;
            const style = window.getComputedStyle(h);

            if (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                h.getClientRects().length > 0
            ) {
                return true;
            }
        }
    }

    return false;
}

function getGlyphAdvance(font: DPBitmapFont, glyph: DPFontGlyph): number {
    if (glyph.kerning !== 0)
        return glyph.kerning;
    if (glyph.width !== 0)
        return glyph.width;
    return font.spaceAdvance;
}

function measureText(font: DPBitmapFont, text: string): number {
    let w = 0;

    for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i) & 0xFF;

        if (ch === 0x20) {
            w += font.spaceAdvance;
            continue;
        }

        const glyph = font.glyphs[ch];
        if (glyph === undefined)
            continue;

        w += getGlyphAdvance(font, glyph);
    }

    return w;
}

function drawDPTextBoxCenteredScreen(
    ctx: CanvasRenderingContext2D,
    scratchCanvas: HTMLCanvasElement,
    scratchCtx: CanvasRenderingContext2D,
    font: DPBitmapFont,
    text: string,
    centerX320: number,
    y240: number,
    alpha: number,
    scale320: number,
    canvasWidth: number,
    canvasHeight: number,
): void {
    const sx = canvasWidth / 320;
    const sy = canvasHeight / 240;

    ctx.save();
    ctx.scale(sx, sy);
    ctx.scale(scale320, scale320);

    const width = measureText(font, text);
    let x = (centerX320 / scale320) - (width / 2);
    const y = y240 / scale320;

    for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i) & 0xFF;

        if (ch === 0x20) {
            x += font.spaceAdvance;
            continue;
        }

        const glyph = font.glyphs[ch];
        if (glyph === undefined)
            continue;

        drawTintedGlyph(
            ctx,
            scratchCanvas,
            scratchCtx,
            font,
            glyph,
            x + glyph.offsetX,
            y + glyph.offsetY,
            alpha,
        );

        x += getGlyphAdvance(font, glyph);
    }

    ctx.restore();
}

function drawTintedGlyph(
    dstCtx: CanvasRenderingContext2D,
    scratchCanvas: HTMLCanvasElement,
    scratchCtx: CanvasRenderingContext2D,
    font: DPBitmapFont,
    glyph: DPFontGlyph,
    dx: number,
    dy: number,
    alpha: number,
): void {
if (glyph.textureIndex === 0xFF)
    return;

const texId = font.textureIds[glyph.textureIndex];
if (texId === undefined || texId < 0)
    return;

    const atlas = font.atlasCanvases.get(texId);
    if (atlas === undefined)
        return;

    const sw = glyph.width;
    const sh = glyph.height;

    if (sw <= 0 || sh <= 0)
        return;

dstCtx.save();
dstCtx.globalAlpha = Math.max(0, Math.min(255, alpha)) / 255;

// Draw the real DP font TEX page pixels.
// Do not recolor with source-in, because that flattens the font to plain white.
dstCtx.drawImage(
    atlas,
    glyph.textureU,
    glyph.textureV,
    sw,
    sh,
    dx,
    dy,
    sw,
    sh,
);

dstCtx.restore();
}

function drawDPTextRightAligned(
    ctx: CanvasRenderingContext2D,
    scratchCanvas: HTMLCanvasElement,
    scratchCtx: CanvasRenderingContext2D,
    font: DPBitmapFont,
    text: string,
    rightX: number,
    y: number,
    alpha: number,
    scale: number,
): void {
    const width = measureText(font, text);

    // rightX/y are in 320x240 screen coordinates.
    // Because we scale the canvas context, convert back into font-space coords.
    let x = (rightX / scale) - width;
    const scaledY = y / scale;

    ctx.save();
    ctx.scale(scale, scale);

    for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i) & 0xFF;

        if (ch === 0x20) {
            x += font.spaceAdvance;
            continue;
        }

        const glyph = font.glyphs[ch];
        if (glyph === undefined)
            continue;

        drawTintedGlyph(
            ctx,
            scratchCanvas,
            scratchCtx,
            font,
            glyph,
            x + glyph.offsetX,
            scaledY + glyph.offsetY,
            alpha,
        );

        x += getGlyphAdvance(font, glyph);
    }

    ctx.restore();
}

function drawDPTextRightAlignedScreen(
    ctx: CanvasRenderingContext2D,
    scratchCanvas: HTMLCanvasElement,
    scratchCtx: CanvasRenderingContext2D,
    font: DPBitmapFont,
    text: string,
    rightX320: number,
    y240: number,
    alpha: number,
    scale320: number,
    canvasWidth: number,
    canvasHeight: number,
): void {
    // Convert original N64 320x240 coordinates into real canvas pixels.
    const sx = canvasWidth / 320;
    const sy = canvasHeight / 240;

    ctx.save();
    ctx.scale(sx, sy);

    drawDPTextRightAligned(
        ctx,
        scratchCanvas,
        scratchCtx,
        font,
        text,
        rightX320,
        y240,
        alpha,
        scale320,
    );

    ctx.restore();
}

export async function showDPLevelNameForScene(
    mapId: number,
    gameInfo: GameInfo,
    dataFetcher: DataFetcher,
    materialCache: any,
): Promise<void> {
    removeExistingDPLevelNameOverlay();

    const def = DP_LEVELNAME_BY_MAP_ID[mapId];
    if (def === undefined)
        return;

    if (materialCache === undefined || materialCache === null) {
        console.warn('DP levelname overlay: missing material cache');
        return;
    }

    const font = await loadDPLevelNameFont(gameInfo, dataFetcher, materialCache);

    const root = document.createElement('div');
    root.id = DP_LEVELNAME_ELEMENT_ID;
root.style.position = 'fixed';
root.style.left = '0';
root.style.top = '0';
root.style.width = '100vw';
root.style.height = '100vh';
root.style.zIndex = '1';
root.style.pointerEvents = 'none';

const canvas = document.createElement('canvas');

canvas.style.display = 'block';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.imageRendering = 'auto';
const dpr = window.devicePixelRatio || 1;
canvas.width = Math.max(1, Math.ceil(window.innerWidth * dpr));
canvas.height = Math.max(1, Math.ceil(window.innerHeight * dpr));

const ctxMaybe = canvas.getContext('2d');
if (ctxMaybe === null)
    return;

const ctx: CanvasRenderingContext2D = ctxMaybe;
ctx.imageSmoothingEnabled = true;

const scratchCanvas = document.createElement('canvas');
scratchCanvas.width = 64;
scratchCanvas.height = 64;

const scratchCtxMaybe = scratchCanvas.getContext('2d');
if (scratchCtxMaybe === null)
    return;

const scratchCtx: CanvasRenderingContext2D = scratchCtxMaybe;
scratchCtx.imageSmoothingEnabled = false;

    root.appendChild(canvas);
    document.body.appendChild(root);

    let frame = 0;
    let opacity = 0;
    let state: 1 | 2 | 3 | 4 = 1;

    const maxOpacity = 220;
    const fadeSpeedPerFrame = 4;
    const displayDurationFrames = def.displayDurationFrames;

    function step(): void {
        if (!document.body.contains(root))
            return;

root.style.display = isAnyNoclipMenuOpen() ? 'none' : 'block';

if (root.style.display === 'none') {
    requestAnimationFrame(step);
    return;
}

const activeMainCanvas = getMainViewerCanvas();
if (activeMainCanvas === null) {
    removeExistingDPLevelNameOverlay();
    return;
}

        switch (state) {
        case 1:
            // LEVELNAME_STATE_1_FADING_IN:
            // objdata->opacity += gUpdateRate * 4;
            opacity += fadeSpeedPerFrame;
            if (opacity > maxOpacity) {
                opacity = maxOpacity;
                state = 2;
                frame = 0;
            }
            break;

        case 2:
            // LEVELNAME_STATE_2_HOLDING:
            // opacity = fsin16(timer * 0x500) * 30 + 0xDC;
            frame++;
            opacity = 220 + Math.sin(frame * 0.07) * 30;

            if (frame > displayDurationFrames)
                state = 3;

            break;

        case 3:
            // LEVELNAME_STATE_3_FADING_OUT:
            // objdata->opacity -= gUpdateRate * 4;
            opacity -= fadeSpeedPerFrame;
            if (opacity < 0) {
                opacity = 0;
                state = 4;
            }
            break;

        case 4:
            restoreDPLevelNameParentState(root);
            root.remove();
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

const lines = def.text.split('\n');

const centerX = 268;
const scale = def.scale ?? 0.55;
const lineHeight = Math.round(33 * scale);

// Keep two-line titles anchored near the same bottom-right area.
let y = lines.length > 1 ? 178 - lineHeight : 192;

for (const line of lines) {
    drawDPTextBoxCenteredScreen(
        ctx,
        scratchCanvas,
        scratchCtx,
        font,
        line,
        centerX,
        y,
        opacity,
        scale,
        canvas.width,
        canvas.height,
    );

    y += lineHeight;
}
        requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}