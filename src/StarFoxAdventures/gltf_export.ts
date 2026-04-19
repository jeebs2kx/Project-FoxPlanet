import { mat4, ReadonlyMat4 } from 'gl-matrix';
import { downloadBlob } from '../DownloadUtils.js';
import { getFormatCompByteSize, getFormatComponentCount, getFormatFlags, getFormatTypeFlags, FormatFlags, FormatTypeFlags } from '../gfx/platform/GfxPlatformFormat.js';
import { VertexAttributeInput } from '../gx/gx_displaylist.js';
import { MaterialFactory } from './materials.js';
import { ModelInstance, ModelShapes } from './models.js';
import { Shape } from './shapes.js';
import { TextureFetcher } from './textures.js';
import * as GX_Texture from '../gx/gx_texture.js';

type ExportMaterialInfo = {
    key: string;
    name: string;
    baseColorTextureBytes?: Uint8Array;
    baseColorTextureTexCoord?: number;
};

type ExtractedPrimitive = {
    name: string;
    positions: Float32Array;
    normals?: Float32Array;
    texcoords?: Float32Array;
    texcoords1?: Float32Array;
    colors?: Uint8Array;
    indices: Uint16Array | Uint32Array;
    material: ExportMaterialInfo;
};

type PlacedModelInstance = {
    name: string;
    modelInst: ModelInstance;
    placementMatrix?: ReadonlyMat4;
};

type TextureLayerMode = 'auto' | 'tex0' | 'tex1' | 'last';

type GLTFExportOptions = {
    includeTextures?: boolean;
    textureLayerMode?: TextureLayerMode;
};

type TextureResolveHint = {
    preferredBank?: 'tex0' | 'tex1';
    preferTextableLookup?: boolean;
    allowCrossBankFallback?: boolean;
    layerIndex?: number;
    gameFamily?: 'sfa' | 'dp' | 'unknown';
    directTexId?: number | null;
    textableTexId?: number | null;
    texCoordOverride?: number | null;
};

type ResolvedTextureCandidate = {
    pngBytes: Uint8Array;
    width: number;
    height: number;
    sourceLabel: string;
    sourceKind: 'direct' | 'textable';
    bank?: 'tex0' | 'tex1';
};

type SingleVertexInputLayoutLike = {
    attrInput: number;
    bufferOffset: number;
    bufferIndex: number;
    format: number;
};

function align4(n: number): number {
    return (n + 3) & ~3;
}

function padBytes(src: Uint8Array, padValue: number = 0): Uint8Array {
    const padded = new Uint8Array(align4(src.byteLength));
    padded.set(src);
    if (padValue !== 0) {
        for (let i = src.byteLength; i < padded.byteLength; i++)
            padded[i] = padValue;
    }
    return padded;
}

function mat4ToArray(m: ReadonlyMat4): number[] {
    return Array.from(m as ArrayLike<number>);
}

function normalizeSigned(value: number, bits: number): number {
    const max = (1 << (bits - 1)) - 1;
    return Math.max(-1.0, value / max);
}

function normalizeUnsigned(value: number, bits: number): number {
    const max = (1 << bits) - 1;
    return value / max;
}

function readFormatComponents(view: DataView, offs: number, fmt: number): number[] {
    const componentCount = getFormatComponentCount(fmt);
    const componentByteSize = getFormatCompByteSize(fmt);
    const typeFlags = getFormatTypeFlags(fmt);
    const normalized = (getFormatFlags(fmt) & FormatFlags.Normalized) !== 0;
    const out = new Array<number>(componentCount);

    for (let i = 0; i < componentCount; i++) {
        const o = offs + i * componentByteSize;
        let v = 0;

        switch (typeFlags) {
        case FormatTypeFlags.F32:
            v = view.getFloat32(o, true);
            break;
        case FormatTypeFlags.U8:
            v = view.getUint8(o);
            if (normalized) v = normalizeUnsigned(v, 8);
            break;
        case FormatTypeFlags.U16:
            v = view.getUint16(o, true);
            if (normalized) v = normalizeUnsigned(v, 16);
            break;
        case FormatTypeFlags.U32:
            v = view.getUint32(o, true);
            break;
        case FormatTypeFlags.S8:
            v = view.getInt8(o);
            if (normalized) v = normalizeSigned(v, 8);
            break;
        case FormatTypeFlags.S16:
            v = view.getInt16(o, true);
            if (normalized) v = normalizeSigned(v, 16);
            break;
        case FormatTypeFlags.S32:
            v = view.getInt32(o, true);
            break;
        default:
            throw new Error(`Unsupported vertex format type ${typeFlags}`);
        }

        out[i] = v;
    }

    return out;
}

function getInputLayout(shape: Shape, attrInput: VertexAttributeInput): SingleVertexInputLayoutLike | null {
    const layout = shape.geom.getLoadedVertexLayout() as any;
    const entries = (layout.singleVertexInputLayouts ?? []) as SingleVertexInputLayoutLike[];
    return entries.find((v) => v.attrInput === attrInput) ?? null;
}

function extractIndices(shape: Shape): Uint16Array | Uint32Array {
    const data = shape.geom.loadedVertexData;
    const layout = shape.geom.getLoadedVertexLayout() as any;
    const typeFlags = getFormatTypeFlags(layout.indexFormat);
    const indexView = new DataView(data.indexData as ArrayBuffer);

    if (typeFlags === FormatTypeFlags.U16) {
        const out = new Uint16Array(data.totalIndexCount);
        for (let i = 0; i < out.length; i++)
            out[i] = indexView.getUint16(i * 2, true);
        return out;
    }

    if (typeFlags === FormatTypeFlags.U32) {
        const out = new Uint32Array(data.totalIndexCount);
        for (let i = 0; i < out.length; i++)
            out[i] = indexView.getUint32(i * 4, true);
        return out;
    }

    throw new Error(`Unsupported index format type ${typeFlags}`);
}

function extractShapeStreams(shape: Shape): Omit<ExtractedPrimitive, 'material' | 'name'> {
    const geom = shape.geom;
    const data = geom.loadedVertexData;
    const vertexCount = data.totalVertexCount;

    const posInput = getInputLayout(shape, VertexAttributeInput.POS);
    if (posInput === null)
        throw new Error('Shape is missing position data');

    const nrmInput = getInputLayout(shape, VertexAttributeInput.NRM);
    const clrInput = getInputLayout(shape, VertexAttributeInput.CLR0);
    const texInput = getInputLayout(shape, VertexAttributeInput.TEX01);

    const positions = new Float32Array(vertexCount * 3);
    const normals = nrmInput ? new Float32Array(vertexCount * 3) : undefined;

    const texComponentCount = texInput ? getFormatComponentCount(texInput.format) : 0;
    const texcoords = texInput ? new Float32Array(vertexCount * 2) : undefined;
    const texcoords1 = texInput && texComponentCount >= 4 ? new Float32Array(vertexCount * 2) : undefined;

    const colors = clrInput ? new Uint8Array(vertexCount * 4) : undefined;

    const loadedLayout = shape.geom.getLoadedVertexLayout() as any;

    const posBuffer = new DataView(data.vertexBuffers[posInput.bufferIndex] as ArrayBuffer);
    const posStride = loadedLayout.vertexBufferStrides[posInput.bufferIndex] as number;

    const nrmBuffer = nrmInput ? new DataView(data.vertexBuffers[nrmInput.bufferIndex] as ArrayBuffer) : null;
    const nrmStride = nrmInput ? loadedLayout.vertexBufferStrides[nrmInput.bufferIndex] as number : 0;

    const clrBuffer = clrInput ? new DataView(data.vertexBuffers[clrInput.bufferIndex] as ArrayBuffer) : null;
    const clrStride = clrInput ? loadedLayout.vertexBufferStrides[clrInput.bufferIndex] as number : 0;

    const texBuffer = texInput ? new DataView(data.vertexBuffers[texInput.bufferIndex] as ArrayBuffer) : null;
    const texStride = texInput ? loadedLayout.vertexBufferStrides[texInput.bufferIndex] as number : 0;

    for (let i = 0; i < vertexCount; i++) {
        const pos = readFormatComponents(posBuffer, posInput.bufferOffset + i * posStride, posInput.format);
        positions[i * 3 + 0] = pos[0] ?? 0;
        positions[i * 3 + 1] = pos[1] ?? 0;
        positions[i * 3 + 2] = pos[2] ?? 0;

        if (normals && nrmInput && nrmBuffer) {
            const nrm = readFormatComponents(nrmBuffer, nrmInput.bufferOffset + i * nrmStride, nrmInput.format);
            normals[i * 3 + 0] = nrm[0] ?? 0;
            normals[i * 3 + 1] = nrm[1] ?? 0;
            normals[i * 3 + 2] = nrm[2] ?? 0;
        }

        if (texcoords && texInput && texBuffer) {
            const uv = readFormatComponents(texBuffer, texInput.bufferOffset + i * texStride, texInput.format);
            texcoords[i * 2 + 0] = uv[0] ?? 0;
            texcoords[i * 2 + 1] = uv[1] ?? 0;

            if (texcoords1) {
                texcoords1[i * 2 + 0] = uv[2] ?? 0;
                texcoords1[i * 2 + 1] = uv[3] ?? 0;
            }
        }

        if (colors && clrInput && clrBuffer) {
            const c = readFormatComponents(clrBuffer, clrInput.bufferOffset + i * clrStride, clrInput.format);
            colors[i * 4 + 0] = Math.max(0, Math.min(255, Math.round((c[0] ?? 1) * 255)));
            colors[i * 4 + 1] = Math.max(0, Math.min(255, Math.round((c[1] ?? 1) * 255)));
            colors[i * 4 + 2] = Math.max(0, Math.min(255, Math.round((c[2] ?? 1) * 255)));
            colors[i * 4 + 3] = Math.max(0, Math.min(255, Math.round((c[3] ?? 1) * 255)));
        }
    }

    return {
        positions,
        normals,
        texcoords,
        texcoords1,
        colors,
        indices: extractIndices(shape),
    };
}

function flattenModelShapes(modelShapes: ModelShapes): Shape[] {
    const out: Shape[] = [];

    for (const bucket of modelShapes.shapes) {
        if (!bucket) continue;
        for (const shape of bucket)
            out.push(shape);
    }

    return out;
}

function dataURLToBytes(dataURL: string): Uint8Array {
    const comma = dataURL.indexOf(',');
    if (comma < 0)
        throw new Error('Invalid data URL');

    const base64 = dataURL.substring(comma + 1);
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++)
        out[i] = binary.charCodeAt(i);

    return out;
}

async function surfaceToPNGBytes(surface: any): Promise<Uint8Array | null> {
    if (!surface)
        return null;

const canvasToPNGBytes = async (canvas: HTMLCanvasElement | OffscreenCanvas): Promise<Uint8Array | null> => {
    if (typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement) {
        try {
            const dataURL = canvas.toDataURL('image/png');
            return dataURLToBytes(dataURL);
        } catch (e) {
            console.warn('[GLTF export] HTMLCanvasElement.toDataURL() failed', e);
            return null;
        }
    } else if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
        try {
            const blob = await canvas.convertToBlob({ type: 'image/png' });
            return new Uint8Array(await blob.arrayBuffer());
        } catch (e) {
            console.warn('[GLTF export] OffscreenCanvas.convertToBlob() failed', e);
            return null;
        }
    }

    return null;
};

    if (typeof HTMLCanvasElement !== 'undefined' && surface instanceof HTMLCanvasElement)
        return await canvasToPNGBytes(surface);

    if (typeof OffscreenCanvas !== 'undefined' && surface instanceof OffscreenCanvas)
        return await canvasToPNGBytes(surface);

    if (surface.canvas) {
        const result = await surfaceToPNGBytes(surface.canvas);
        if (result)
            return result;
    }

    if (typeof surface.toCanvas === 'function') {
        const maybeCanvas = await surface.toCanvas();
        const result = await surfaceToPNGBytes(maybeCanvas);
        if (result)
            return result;
    }

    if (typeof ImageBitmap !== 'undefined' && surface instanceof ImageBitmap) {
        const canvas = document.createElement('canvas');
        canvas.width = surface.width;
        canvas.height = surface.height;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return null;
        ctx.drawImage(surface, 0, 0);
        return await canvasToPNGBytes(canvas);
    }

    if (
        typeof document !== 'undefined' &&
        typeof surface.width === 'number' &&
        typeof surface.height === 'number' &&
        surface.pixels instanceof Uint8Array
    ) {
        const canvas = document.createElement('canvas');
        canvas.width = surface.width;
        canvas.height = surface.height;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return null;

        const imageData = ctx.createImageData(surface.width, surface.height);
        imageData.data.set(surface.pixels);
        ctx.putImageData(imageData, 0, 0);
        return await canvasToPNGBytes(canvas);
    }

    return null;
}

async function viewerTextureToPNGBytes(viewerTexture: any): Promise<Uint8Array | null> {
    if (!viewerTexture)
        return null;

    const trySurfaces = async (): Promise<Uint8Array | null> => {
        const surfaces = Array.isArray(viewerTexture.surfaces) ? viewerTexture.surfaces : [];
        for (const surface of surfaces) {
            const result = await surfaceToPNGBytes(surface);
            if (result)
                return result;
        }
        return null;
    };

    let result = await trySurfaces();
    if (result)
        return result;

    if (typeof viewerTexture.activate === 'function') {
        try {
            await viewerTexture.activate();
        } catch (e) {
            console.warn('[GLTF export] viewerTexture.activate() failed', e);
        }

        result = await trySurfaces();
        if (result)
            return result;
    }

    return null;
}

async function exportTextureInputToPNGBytes(tex: any): Promise<Uint8Array | null> {
    const texInput = tex?.exportTextureInput as GX_Texture.TextureInputGX | undefined;
    if (!texInput)
        return null;

    try {
        const decoded = await GX_Texture.decodeTexture(texInput);
        const pixels = decoded.pixels instanceof Uint8Array
            ? decoded.pixels
            : new Uint8Array(decoded.pixels.buffer, decoded.pixels.byteOffset, decoded.pixels.byteLength);

        return await surfaceToPNGBytes({
            width: texInput.width,
            height: texInput.height,
            pixels,
        });
    } catch (e) {
        console.warn('[GLTF export] exportTextureInput decode failed', e);
        return null;
    }
}

function isLikelyFallbackTexture(tex: any): boolean {
    if (!tex)
        return false;

    const hasExportTextureInput = !!tex.exportTextureInput;
    const hasViewerSurfaces = Array.isArray(tex.viewerTexture?.surfaces) && tex.viewerTexture.surfaces.length > 0;
    const hasViewerSurface = !!tex.viewerTexture?.surface || !!tex.surface;

    return tex.width === 2 && tex.height === 2 && !hasExportTextureInput && !hasViewerSurfaces && !hasViewerSurface;
}

async function textureObjectToPNGBytes(tex: any): Promise<Uint8Array | null> {
    if (!tex)
        return null;

    const pngFromExportTextureInput = await exportTextureInputToPNGBytes(tex);
    if (pngFromExportTextureInput)
        return pngFromExportTextureInput;

    const pngFromViewerTexture = await viewerTextureToPNGBytes(tex.viewerTexture ?? null);
    if (pngFromViewerTexture)
        return pngFromViewerTexture;

    const surface =
        tex.viewerTexture?.surface ??
        tex.surface ??
        null;

    const pngFromSurface = await surfaceToPNGBytes(surface);
    if (pngFromSurface)
        return pngFromSurface;

    return null;
}



function pushUniqueLayer(out: number[], idx: number): void {
    if (idx < 0)
        return;
    if (!out.includes(idx))
        out.push(idx);
}

function getOrderedLayerIndices(layerCount: number, mode: TextureLayerMode, uvSetCount: number): number[] {
    const out: number[] = [];
    const last = layerCount - 1;

    switch (mode) {
    case 'tex0':
        pushUniqueLayer(out, 0);
        for (let i = 1; i <= last; i++)
            pushUniqueLayer(out, i);
        break;

    case 'tex1':
        if (uvSetCount >= 2)
            pushUniqueLayer(out, 1);
        for (let i = last; i >= 0; i--)
            pushUniqueLayer(out, i);
        break;

    case 'last':
        for (let i = last; i >= 0; i--)
            pushUniqueLayer(out, i);
        break;

    case 'auto':
    default:
        if (uvSetCount >= 2)
            pushUniqueLayer(out, 1);
        for (let i = last; i >= 0; i--)
            pushUniqueLayer(out, i);
        break;
    }

    return out;
}

function getNaturalLayerIndices(layerCount: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < layerCount; i++)
        out.push(i);
    return out;
}

function getExportLayerIndices(
    layerCount: number,
    mode: TextureLayerMode,
    uvSetCount: number,
    gameFamily: 'sfa' | 'dp' | 'unknown',
): number[] {

    if (mode === 'auto' && gameFamily === 'sfa')
        return getNaturalLayerIndices(layerCount);

    return getOrderedLayerIndices(layerCount, mode, uvSetCount);
}


function safeTryGetTexture(fetcher: any, label: string, fn: () => any): any | null {
    try {
        return fn() ?? null;
    } catch (e) {
        console.warn(`[GLTF export] ${label} failed`, e);
        return null;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function readOptionalLayerBoolean(layer: any, keys: string[]): boolean | null {
    for (const k of keys) {
        if (typeof layer?.[k] === 'boolean')
            return layer[k];
    }
    return null;
}

function readOptionalLayerNumber(layer: any, keys: string[]): number | null {
    for (const k of keys) {
        const v = layer?.[k];
        if (typeof v === 'number' && Number.isFinite(v))
            return v;
    }
    return null;
}

function detectTextureGameFamily(texFetcher: any): 'sfa' | 'dp' | 'unknown' {
    const pathBase = String(
        texFetcher?.gameInfo?.pathBase ??
        texFetcher?.pathBase ??
        '',
    ).toLowerCase();

    if (pathBase.includes('dinosaurplanet'))
        return 'dp';

    if (
        pathBase.includes('starfox') ||
        pathBase.includes('adventures') ||
        pathBase.includes('demo')
    ) {
        return 'sfa';
    }

    return 'unknown';
}

function getLayerDirectTextureId(layer: any): number | null {
    return readOptionalLayerNumber(layer, [
        'texId',
        'textureId',
        'textureID',
        'imageId',
        'imageID',
        'directTexId',
        'directTextureId',
        'resolvedTexId',
    ]);
}

function getLayerTextableTextureId(layer: any): number | null {
    return readOptionalLayerNumber(layer, [
        'textableId',
        'textableID',
        'textableIndex',
        'textableIdx',
        'texTableId',
        'texTableID',
        'texTableIndex',
        'texTableIdx',
        'xrefTexId',
        'xrefTextureId',
        'xrefTextureID',
        'id',
        'index',
        'textureIndex',
        'textureIdx',
    ]);
}

function getTextureObjectSize(tex: any): { width: number; height: number } {
    const width = Number(
        tex?.width ??
        tex?.exportTextureInput?.width ??
        tex?.viewerTexture?.width ??
        tex?.viewerTexture?.surface?.width ??
        0
    );

    const height = Number(
        tex?.height ??
        tex?.exportTextureInput?.height ??
        tex?.viewerTexture?.height ??
        tex?.viewerTexture?.surface?.height ??
        0
    );

    return {
        width: Number.isFinite(width) ? width : 0,
        height: Number.isFinite(height) ? height : 0,
    };
}

function buildTextureResolveHint(
    texFetcher: any,
    layer: any,
    layerIndex: number,
    uvSetCount: number,
    textureLayerMode: TextureLayerMode,
): TextureResolveHint {
    const gameFamily = detectTextureGameFamily(texFetcher);

    const explicitUseTex1 = readOptionalLayerBoolean(layer, [
        'useTex1',
        'isTex1',
        'tex1',
        'useSecondaryBank',
        'secondaryBank',
    ]);

    const coordIndex = readOptionalLayerNumber(layer, [
        'texCoord',
        'texCoordId',
        'texCoordIndex',
        'uvIndex',
        'uvSlot',
        'coord',
        'coordIndex',
        'coordId',
        'texGenIndex',
    ]);

let preferredBank: 'tex0' | 'tex1';
if (textureLayerMode === 'tex0') {
    preferredBank = 'tex0';
} else if (textureLayerMode === 'tex1') {
    preferredBank = 'tex1';
} else if (gameFamily === 'sfa') {
    preferredBank = 'tex1';
} else if (explicitUseTex1 !== null) {
    preferredBank = explicitUseTex1 ? 'tex1' : 'tex0';
} else if (coordIndex !== null) {
    preferredBank = (coordIndex >= 1 && uvSetCount >= 2) ? 'tex1' : 'tex0';
} else {
    preferredBank = (uvSetCount >= 2 && layerIndex >= 1) ? 'tex1' : 'tex0';
}

    const directTexId = getLayerDirectTextureId(layer);
    const textableTexId = getLayerTextableTextureId(layer);

let preferTextableLookup = readOptionalLayerBoolean(layer, [
    'preferTextableLookup',
    'useTextable',
    'isTextable',
    'fromTextable',
    'usesTextable',
]);

if (preferTextableLookup === null) {
    preferTextableLookup =
        (textableTexId !== null) ||
        (gameFamily === 'sfa' && directTexId === null);
}

    return {
        preferredBank,
        preferTextableLookup,
        allowCrossBankFallback: gameFamily === 'sfa',
        layerIndex,
        gameFamily,
        directTexId,
        textableTexId,
        texCoordOverride: coordIndex !== null ? (coordIndex >= 1 ? 1 : 0) : null,
    };
}

async function resolveTextureCandidates(
    texFetcher: any,
    materialFactory: MaterialFactory,
    hint: TextureResolveHint,
): Promise<ResolvedTextureCandidate[]> {
    if (!texFetcher)
        return [];

    const cache = (materialFactory as any).cache ?? (materialFactory as any).getCache?.();
    if (!cache)
        return [];

const directTexId = hint.directTexId ?? null;
const textableTexId = hint.textableTexId ?? null;

    const tried = new Set<any>();
const rawCandidates: Array<{
    label: string;
    tex: any | null;
    sourceKind: 'direct' | 'textable';
    bank?: 'tex0' | 'tex1';
    getter: () => any;
}> = [];

const pushCandidate = (
    label: string,
    sourceKind: 'direct' | 'textable',
    getter: () => any,
    bank?: 'tex0' | 'tex1',
): void => {
    const tex = safeTryGetTexture(texFetcher, label, getter);
    if (!tex || tried.has(tex))
        return;

    tried.add(tex);
    rawCandidates.push({ label, tex, sourceKind, bank, getter });
};

const pushDirectBank = (bank: 'tex0' | 'tex1'): void => {
    if (directTexId === null || directTexId < 0)
        return;

    pushCandidate(
        `getDirectTextureByID(${directTexId}, ${bank === 'tex1'})`,
        'direct',
        () =>
            texFetcher.getDirectTextureByID?.(cache, directTexId, bank === 'tex1') ??
            texFetcher.getTexture?.(cache, directTexId, bank === 'tex1'),
        bank,
    );
};

    const pushTextableLookups = (): void => {
        if (textableTexId === null || textableTexId < 0)
            return;

        pushCandidate(
            `getTextureByTextable(${textableTexId})`,
            'textable',
            () => texFetcher.getTextureByTextable?.(cache, textableTexId),
        );

        pushCandidate(
            `getDPTextureByTextableID(${textableTexId})`,
            'textable',
            () => texFetcher.getDPTextureByTextableID?.(cache, textableTexId),
        );
    };

const preferredBank = hint.preferredBank;

if (hint.gameFamily === 'sfa' && hint.preferTextableLookup)
    pushTextableLookups();

if (preferredBank !== undefined)
    pushDirectBank(preferredBank);

if (hint.allowCrossBankFallback && preferredBank !== undefined)
    pushDirectBank(preferredBank === 'tex0' ? 'tex1' : 'tex0');

if (!(hint.gameFamily === 'sfa' && hint.preferTextableLookup))
    if (hint.preferTextableLookup)
        pushTextableLookups();

const nonFallback = rawCandidates.filter((c) => !isLikelyFallbackTexture(c.tex));
    const fallback = rawCandidates.filter((c) => isLikelyFallbackTexture(c.tex));

const decodeGroup = async (
    group: typeof rawCandidates,
): Promise<ResolvedTextureCandidate[]> => {
    const out: ResolvedTextureCandidate[] = [];

    for (const candidate of group) {
        let tex = candidate.tex;
        let pngBytes = await textureObjectToPNGBytes(tex);

        if (!pngBytes) {
            for (let attempt = 0; attempt < 8; attempt++) {
                await sleep(50);

                // First try the same object again in case it updated in-place.
                pngBytes = await textureObjectToPNGBytes(tex);
                if (pngBytes)
                    break;

                // Then re-fetch in case the fetcher now returns the real texture.
                const refreshed = safeTryGetTexture(
                    texFetcher,
                    `${candidate.label} retry ${attempt}`,
                    candidate.getter,
                );

                if (refreshed)
                    tex = refreshed;

                pngBytes = await textureObjectToPNGBytes(tex);
                if (pngBytes)
                    break;
            }
        }

        if (!pngBytes)
            continue;

        const size = getTextureObjectSize(tex);
        out.push({
            pngBytes,
            width: size.width,
            height: size.height,
            sourceLabel: candidate.label,
            sourceKind: candidate.sourceKind,
            bank: candidate.bank,
        });
    }

    return out;
};

const resolvedNonFallback = await decodeGroup(nonFallback);
if (resolvedNonFallback.length > 0)
    return resolvedNonFallback;

// Try fallback candidates too, because some of them are only temporary placeholders
// while the real DP/SFA texture finishes loading asynchronously.
const resolvedFallback = await decodeGroup(fallback);

// For SFA, only accept fallback results if they turned into a real texture.
// Keep rejecting tiny 2x2 placeholders.
if (hint.gameFamily === 'sfa') {
    const usableFallback = resolvedFallback.filter((c) => !(c.width <= 2 && c.height <= 2));
    if (usableFallback.length > 0)
        return usableFallback;

    console.warn(
        `[GLTF export] Could not convert texture direct=${directTexId} textable=${textableTexId} to PNG bytes`,
        rawCandidates.map((c) => ({
            label: c.label,
            sourceKind: c.sourceKind,
            bank: c.bank,
            width: c.tex?.width,
            height: c.tex?.height,
            hasExportTextureInput: !!c.tex?.exportTextureInput,
            hasViewerTexture: !!c.tex?.viewerTexture,
            surfaceCount: Array.isArray(c.tex?.viewerTexture?.surfaces) ? c.tex.viewerTexture.surfaces.length : 0,
        })),
    );
    return [];
}

if (resolvedFallback.length > 0)
    return resolvedFallback;

    console.warn(
        `[GLTF export] Could not convert texture direct=${directTexId} textable=${textableTexId} to PNG bytes`,
        rawCandidates.map((c) => ({
            label: c.label,
            sourceKind: c.sourceKind,
            bank: c.bank,
            width: c.tex?.width,
            height: c.tex?.height,
            hasExportTextureInput: !!c.tex?.exportTextureInput,
            hasViewerTexture: !!c.tex?.viewerTexture,
            surfaceCount: Array.isArray(c.tex?.viewerTexture?.surfaces) ? c.tex.viewerTexture.surfaces.length : 0,
        })),
    );

    return [];
}

function scoreResolvedTextureCandidate(
    candidate: ResolvedTextureCandidate,
    hint: TextureResolveHint,
): number {
    let score = 0;

if (hint.gameFamily === 'sfa') {
    score += candidate.sourceKind === 'direct' ? 220 : 140;
} else {
    score += candidate.sourceKind === 'direct' ? 220 : 80;
}

    if (hint.preferredBank && candidate.bank === hint.preferredBank)
        score += 140;

    if (hint.preferredBank && candidate.bank && candidate.bank !== hint.preferredBank)
        score -= 220;

    if (candidate.width >= 64 || candidate.height >= 64)
        score += 60;
    else if (candidate.width >= 32 || candidate.height >= 32)
        score += 40;
    else if (candidate.width >= 16 || candidate.height >= 16)
        score += 20;

    if (candidate.width <= 2 && candidate.height <= 2)
        score -= 180;

    return score;
}

async function getShapeMaterialInfo(
    shape: Shape,
    materialFactory: MaterialFactory,
    fallbackTexFetcher: TextureFetcher,
    options: GLTFExportOptions = {},
    uvSetCount: number = 1,
): Promise<ExportMaterialInfo> {
    const includeTextures = options.includeTextures ?? true;
    const textureLayerMode = options.textureLayerMode ?? 'auto';

    if (!includeTextures)
        return { key: 'vcol-only', name: 'vertex_color' };

    const matObj = shape.material.getExportMaterial() as any;
    const shader = matObj?.shader;
    const texFetcher = matObj?.texFetcher ?? fallbackTexFetcher;
    const gameFamily = detectTextureGameFamily(texFetcher);

    const layers: any[] = Array.isArray(shader?.layers) ? shader.layers : [];
    const orderedLayerIndices = getExportLayerIndices(
        layers.length,
        textureLayerMode,
        uvSetCount,
        gameFamily,
    );

for (const i of orderedLayerIndices) {
    const layer = layers[i];
    if (!layer)
        continue;

    const hint = buildTextureResolveHint(texFetcher, layer, i, uvSetCount, textureLayerMode);

    if (hint.directTexId === null && hint.textableTexId === null)
        continue;

        const resolvedCandidates = await resolveTextureCandidates(texFetcher, materialFactory, hint);

        if (resolvedCandidates.length === 0) {
            // Important SFA rule:
            // if the first plausible/base layer fails, stop there instead of
            // falling into later effect/detail layers that export incorrectly.
            if (gameFamily === 'sfa')
                break;

            continue;
        }

        resolvedCandidates.sort((a, b) => scoreResolvedTextureCandidate(b, hint) - scoreResolvedTextureCandidate(a, hint));

        const best = resolvedCandidates[0];
        const chosenTexId = hint.textableTexId ?? hint.directTexId ?? -1;
        const texCoord = hint.texCoordOverride ?? ((uvSetCount >= 2 && hint.preferredBank === 'tex1') ? 1 : 0);

        return {
            key: `tex:${chosenTexId}:${best.bank ?? 'na'}:uv${texCoord}:layer${i}:${best.sourceKind}`,
            name: `tex_${chosenTexId}`,
            baseColorTextureBytes: best.pngBytes,
            baseColorTextureTexCoord: texCoord,
        };
    }

    return { key: 'vcol-only', name: 'vertex_color' };
}

async function extractPrimitive(
    shape: Shape,
    materialFactory: MaterialFactory,
    fallbackTexFetcher: TextureFetcher,
    name: string,
    options: GLTFExportOptions = {},
): Promise<ExtractedPrimitive> {
    const streams = extractShapeStreams(shape);
    const uvSetCount = streams.texcoords1 ? 2 : (streams.texcoords ? 1 : 0);
    const material = await getShapeMaterialInfo(shape, materialFactory, fallbackTexFetcher, options, uvSetCount);

    return {
        name,
        ...streams,
        material,
    };
}

function computeMinMax(positions: Float32Array): { min: number[]; max: number[] } {
    const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

    for (let i = 0; i < positions.length; i += 3) {
        min[0] = Math.min(min[0], positions[i + 0]);
        min[1] = Math.min(min[1], positions[i + 1]);
        min[2] = Math.min(min[2], positions[i + 2]);
        max[0] = Math.max(max[0], positions[i + 0]);
        max[1] = Math.max(max[1], positions[i + 1]);
        max[2] = Math.max(max[2], positions[i + 2]);
    }

    return { min, max };
}

class BinBuilder {
    private chunks: Uint8Array[] = [];
    public byteLength = 0;

    public append(bytes: Uint8Array, padValue: number = 0): { byteOffset: number; byteLength: number; paddedByteLength: number } {
        const chunk = padBytes(bytes, padValue);
        const info = {
            byteOffset: this.byteLength,
            byteLength: bytes.byteLength,
            paddedByteLength: chunk.byteLength,
        };
        this.chunks.push(chunk);
        this.byteLength += chunk.byteLength;
        return info;
    }

    public finish(): Uint8Array {
        const out = new Uint8Array(this.byteLength);
        let offs = 0;
        for (const chunk of this.chunks) {
            out.set(chunk, offs);
            offs += chunk.byteLength;
        }
        return out;
    }
}

function typedArrayToBytes(view: ArrayBufferView): Uint8Array {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
}

function buildNodeMatrix(baseMatrix: ReadonlyMat4 | undefined, modelInst: ModelInstance): mat4 {
    const out = mat4.create();
    if (baseMatrix)
        mat4.copy(out, baseMatrix as mat4);

    const translate = mat4.create();
    const t = modelInst.model.modelTranslate;
    mat4.fromTranslation(translate, [t[0], t[1], t[2]]);
    mat4.mul(out, out, translate);
    return out;
}

function yieldToBrowser(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame !== 'undefined')
            requestAnimationFrame(() => resolve());
        else
            setTimeout(resolve, 0);
    });
}

function uint8ArrayToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const out = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(out).set(bytes);
    return out;
}

async function pngBytesToImageData(pngBytes: Uint8Array): Promise<ImageData | null> {
    try {
        const blob = new Blob([uint8ArrayToArrayBuffer(pngBytes)], { type: 'image/png' });
        const bmp = await createImageBitmap(blob);

        try {
if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (!ctx)
        return null;

    ctx.drawImage(bmp, 0, 0);
    return ctx.getImageData(0, 0, bmp.width, bmp.height);
} else {
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;

    const ctx = canvas.getContext('2d');
    if (!ctx)
        return null;

    ctx.drawImage(bmp, 0, 0);
    return ctx.getImageData(0, 0, bmp.width, bmp.height);
}
        } finally {
            bmp.close();
        }
    } catch (e) {
        console.warn('[GLTF export] pngBytesToImageData failed', e);
        return null;
    }
}

type AlphaModeInfo = {
    alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND';
    alphaCutoff?: number;
    doubleSided?: boolean;
};

async function analyzeTextureAlpha(pngBytes: Uint8Array | undefined): Promise<AlphaModeInfo> {
    if (!pngBytes)
        return { alphaMode: 'OPAQUE', doubleSided: false };

    const imageData = await pngBytesToImageData(pngBytes);
    if (!imageData)
        return { alphaMode: 'OPAQUE', doubleSided: false };

    const data = imageData.data;
    let hasAnyTransparent = false;
    let hasSoftAlpha = false;
    let opaqueCount = 0;
    let cutoutCount = 0;

    for (let i = 3; i < data.length; i += 4) {
        const a = data[i];

        if (a < 250)
            hasAnyTransparent = true;

        if (a > 0 && a < 250)
            hasSoftAlpha = true;

        if (a >= 250)
            opaqueCount++;
        else if (a <= 16)
            cutoutCount++;
    }

    if (!hasAnyTransparent)
        return { alphaMode: 'OPAQUE', doubleSided: false };

    if (!hasSoftAlpha) {
        return {
            alphaMode: 'MASK',
            alphaCutoff: 0.5,
            doubleSided: true,
        };
    }

    return {
        alphaMode: 'BLEND',
        doubleSided: true,
    };
}

export async function exportModelInstanceToGLB(
    filename: string,
    modelInst: ModelInstance,
    materialFactory: MaterialFactory,
    fallbackTexFetcher: TextureFetcher,
    options: GLTFExportOptions = {},
): Promise<void> {
    await exportPlacedModelInstancesToGLB(
        filename,
        [{ name: filename.replace(/\.glb$/i, ''), modelInst }],
        materialFactory,
        fallbackTexFetcher,
        options,
    );
}

export async function exportPlacedModelInstancesToGLB(
    filename: string,
    entries: PlacedModelInstance[],
    materialFactory: MaterialFactory,
    fallbackTexFetcher: TextureFetcher,
    options: GLTFExportOptions = {},
): Promise<void> {    const gltf: any = {
        asset: { version: '2.0', generator: 'Project-FoxPlanet GLB Exporter' },
        buffers: [{ byteLength: 0 }],
        bufferViews: [],
        accessors: [],
        images: [],
        textures: [],
        samplers: [{ magFilter: 9729, minFilter: 9729, wrapS: 10497, wrapT: 10497 }],
        materials: [],
        meshes: [],
        nodes: [],
        scenes: [{ nodes: [] }],
        scene: 0,
    };

    const bin = new BinBuilder();
    const materialCache = new Map<string, number>();

    for (const entry of entries) {
        entry.modelInst.prepareForExport();
        const modelShapes = entry.modelInst.getModelShapes();
        const shapes = flattenModelShapes(modelShapes);
        const primitives: any[] = [];

for (let i = 0; i < shapes.length; i++) {
if ((i & 63) === 63)
    await yieldToBrowser();

    let primitive: ExtractedPrimitive;
    try {
primitive = await extractPrimitive(
    shapes[i],
    materialFactory,
    fallbackTexFetcher,
    `${entry.name}_shape_${i}`,
    options,
);
} catch (e) {
    console.warn(`[GLTF export] Skipping texture resolution failure on ${entry.name}_shape_${i}`, e);

    const streams = extractShapeStreams(shapes[i]);
    primitive = {
        name: `${entry.name}_shape_${i}`,
        ...streams,
        material: { key: 'vcol-only', name: 'vertex_color' },
    };
}
            const positionInfo = bin.append(typedArrayToBytes(primitive.positions));
            const { min, max } = computeMinMax(primitive.positions);
            const positionAccessor = gltf.accessors.push({
                bufferView: gltf.bufferViews.push({
                    buffer: 0,
                    byteOffset: positionInfo.byteOffset,
                    byteLength: positionInfo.byteLength,
                    target: 34962,
                }) - 1,
                componentType: 5126,
                count: primitive.positions.length / 3,
                type: 'VEC3',
                min,
                max,
            }) - 1;

            const attrs: any = { POSITION: positionAccessor };

            if (primitive.normals) {
                const info = bin.append(typedArrayToBytes(primitive.normals));
                attrs.NORMAL = gltf.accessors.push({
                    bufferView: gltf.bufferViews.push({
                        buffer: 0,
                        byteOffset: info.byteOffset,
                        byteLength: info.byteLength,
                        target: 34962,
                    }) - 1,
                    componentType: 5126,
                    count: primitive.normals.length / 3,
                    type: 'VEC3',
                }) - 1;
            }

if (primitive.texcoords) {
    const info = bin.append(typedArrayToBytes(primitive.texcoords));
    attrs.TEXCOORD_0 = gltf.accessors.push({
        bufferView: gltf.bufferViews.push({
            buffer: 0,
            byteOffset: info.byteOffset,
            byteLength: info.byteLength,
            target: 34962,
        }) - 1,
        componentType: 5126,
        count: primitive.texcoords.length / 2,
        type: 'VEC2',
    }) - 1;
}

if (primitive.texcoords1) {
    const info = bin.append(typedArrayToBytes(primitive.texcoords1));
    attrs.TEXCOORD_1 = gltf.accessors.push({
        bufferView: gltf.bufferViews.push({
            buffer: 0,
            byteOffset: info.byteOffset,
            byteLength: info.byteLength,
            target: 34962,
        }) - 1,
        componentType: 5126,
        count: primitive.texcoords1.length / 2,
        type: 'VEC2',
    }) - 1;
}

            if (primitive.colors) {
                const info = bin.append(primitive.colors);
                attrs.COLOR_0 = gltf.accessors.push({
                    bufferView: gltf.bufferViews.push({
                        buffer: 0,
                        byteOffset: info.byteOffset,
                        byteLength: info.byteLength,
                        target: 34962,
                    }) - 1,
                    componentType: 5121,
                    normalized: true,
                    count: primitive.colors.length / 4,
                    type: 'VEC4',
                }) - 1;
            }

            const indexInfo = bin.append(typedArrayToBytes(primitive.indices));
            const indexAccessor = gltf.accessors.push({
                bufferView: gltf.bufferViews.push({
                    buffer: 0,
                    byteOffset: indexInfo.byteOffset,
                    byteLength: indexInfo.byteLength,
                    target: 34963,
                }) - 1,
                componentType: primitive.indices instanceof Uint32Array ? 5125 : 5123,
                count: primitive.indices.length,
                type: 'SCALAR',
            }) - 1;

            let materialIndex = materialCache.get(primitive.material.key);
            if (materialIndex === undefined) {
                let baseColorTexture: number | undefined = undefined;
                if (primitive.material.baseColorTextureBytes) {
                    const imageInfo = bin.append(primitive.material.baseColorTextureBytes);
                    const imageIndex = gltf.images.push({
                        bufferView: gltf.bufferViews.push({
                            buffer: 0,
                            byteOffset: imageInfo.byteOffset,
                            byteLength: imageInfo.byteLength,
                        }) - 1,
                        mimeType: 'image/png',
                        name: primitive.material.name,
                    }) - 1;
                    baseColorTexture = gltf.textures.push({ sampler: 0, source: imageIndex, name: primitive.material.name }) - 1;
                }

const alphaInfo = await analyzeTextureAlpha(primitive.material.baseColorTextureBytes);

materialIndex = gltf.materials.push({
    name: primitive.material.name,
    pbrMetallicRoughness: {
        baseColorFactor: [1, 1, 1, 1],
        metallicFactor: 0,
        roughnessFactor: 1,
        ...(baseColorTexture !== undefined ? {
            baseColorTexture: {
                index: baseColorTexture,
                texCoord: primitive.material.baseColorTextureTexCoord ?? 0,
            },
        } : {}),
    },
    ...(alphaInfo.alphaMode && alphaInfo.alphaMode !== 'OPAQUE' ? { alphaMode: alphaInfo.alphaMode } : {}),
    ...(alphaInfo.alphaMode === 'MASK' ? { alphaCutoff: alphaInfo.alphaCutoff ?? 0.5 } : {}),
    doubleSided: alphaInfo.doubleSided ?? false,
}) - 1;
                materialCache.set(primitive.material.key, materialIndex);
            }

            primitives.push({
                attributes: attrs,
                indices: indexAccessor,
                material: materialIndex,
                mode: 4,
            });
        }

        const meshIndex = gltf.meshes.push({ name: entry.name, primitives }) - 1;
        const nodeMatrix = buildNodeMatrix(entry.placementMatrix, entry.modelInst);
        const nodeIndex = gltf.nodes.push({ name: entry.name, mesh: meshIndex, matrix: mat4ToArray(nodeMatrix) }) - 1;
        gltf.scenes[0].nodes.push(nodeIndex);
    }

    const binBytes = bin.finish();
    gltf.buffers[0].byteLength = binBytes.byteLength;

    const jsonBytes = padBytes(new TextEncoder().encode(JSON.stringify(gltf)), 0x20);
    const binChunk = padBytes(binBytes);
    const totalLength = 12 + 8 + jsonBytes.byteLength + 8 + binChunk.byteLength;

    const glb = new ArrayBuffer(totalLength);
    const u8 = new Uint8Array(glb);
    const dv = new DataView(glb);

    dv.setUint32(0, 0x46546C67, true);
    dv.setUint32(4, 2, true);
    dv.setUint32(8, totalLength, true);

    let offs = 12;
    dv.setUint32(offs + 0, jsonBytes.byteLength, true);
    dv.setUint32(offs + 4, 0x4E4F534A, true);
    u8.set(jsonBytes, offs + 8);
    offs += 8 + jsonBytes.byteLength;

    dv.setUint32(offs + 0, binChunk.byteLength, true);
    dv.setUint32(offs + 4, 0x004E4942, true);
    u8.set(binChunk, offs + 8);

    downloadBlob(filename, new Blob([glb], { type: 'model/gltf-binary' }));
}