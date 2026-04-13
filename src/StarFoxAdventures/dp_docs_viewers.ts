import * as Viewer from '../viewer.js';
import * as UI from '../ui.js';
import { GfxDevice } from '../gfx/platform/GfxPlatform.js';
import { SceneContext } from '../SceneBase.js';
import { GfxRenderInstManager } from '../gfx/render/GfxRenderInstManager.js';
import { MaterialFactory } from './materials.js';
import { SFAAnimationController } from './animation.js';
import { SFARenderer, SceneRenderContext, SFARenderLists } from './render.js';
import { GameInfo } from './scenes.js';

type MapInfoRow = {
    id: number;
    name: string;
    type: number;
    unkOffset: number;
};

type TriggerEntry = {
    indexInMap: number;
    objId: number;
    typeName: string;
    sizeBytes: number;
    x: number;
    y: number;
    z: number;
    uid: number;
    curveId: number;
    scaleX: number;
    scaleY: number;
    scaleZ: number;
    rotateY: number;
    rotateX: number;
    rotateZ: number;
    activatorObjType: number;
    setGamebit: number;
    delay: number;
    checkGamebit1: number;
    checkGamebit2: number;
    checkGamebit3: number;
    checkGamebit4: number;
    commands: Array<{ slot: number; condition: number; commandId: number; arg16: number; argA: number; argB: number; }>;
};

type WarpEntry = {
    index: number;
    x: number;
    y: number;
    z: number;
    layer: number;
};

type SetupEntry = {
    globalIndex: number;
    mapId: number;
    setupId: number;
    x: number;
    y: number;
    z: number;
};

type GlobalMapEntry = {
    index: number;
    x: number;
    z: number;
    layerOffset: number;
    mapA: number;
    mapB: number;
    mapC: number;
};

const TRIGGER_TYPE_NAMES = new Map<number, string>([
    [75, 'TriggerPoint'],
    [76, 'TriggerPlane'],
    [77, 'TriggerArea'],
    [78, 'TriggerTime'],
    [79, 'TriggerButton'],
    [80, 'TriggerSetup'],
    [84, 'TriggerBits'],
    [244, 'TriggerCurve'],
    [560, 'TriggerCylinder'],
]);

function makeButton(label: string, onclick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = onclick;
    b.style.cursor = 'pointer';
    b.style.padding = '4px 8px';
    return b;
}

function makeLabel(text: string): HTMLDivElement {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.fontSize = '12px';
    d.style.color = '#AAB';
    return d;
}

function readCString(view: DataView, offs: number, maxLen: number): string {
    let s = '';
    for (let i = 0; i < maxLen && offs + i < view.byteLength; i++) {
        const c = view.getUint8(offs + i);
        if (c === 0)
            break;
        if (c < 0x20 || c > 0x7E)
            s += ' ';
        else
            s += String.fromCharCode(c);
    }
    return s.trim();
}

function hex16(v: number): string {
    return `0x${(v & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')}`;
}

function hex32(v: number): string {
    return `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

function toInt(v: any, fallback: number = -1): number {
    const n = Number(v);
    return Number.isFinite(n) ? (n | 0) : fallback;
}

function pickInt(obj: any, keys: string[], fallback: number = -1): number {
    for (const k of keys) {
        if (obj != null && Object.prototype.hasOwnProperty.call(obj, k))
            return toInt(obj[k], fallback);
    }
    return fallback;
}

async function fetchJSONFile<T = any>(path: string): Promise<T> {
    const candidates = [
        `/data/${path}`,
        path,
    ];

    let lastStatus = 'unknown';
    for (const url of candidates) {
        const r = await fetch(url);
        if (r.ok)
            return await r.json() as T;
        lastStatus = `${r.status} for ${url}`;
    }

    throw new Error(`HTTP ${lastStatus}`);
}

async function loadMapInfoRows(gameInfo: GameInfo, _dataFetcher: any): Promise<MapInfoRow[]> {
    const rows = await fetchJSONFile<any[]>(`${gameInfo.pathBase}/MAPINFO.json`);
    if (!Array.isArray(rows))
        throw new Error(`MAPINFO is not an array`);

    return rows.map((r, i) => ({
        id: i,
        name: typeof r?.Name === 'string' ? r.Name : `Map ${i}`,
        type: Number(r?.Type ?? 0) | 0,
        unkOffset: Number(r?.Unk1 ?? 0) | 0,
    }));
}

async function loadWarps(gameInfo: GameInfo, dataFetcher: any): Promise<WarpEntry[]> {
    const buf = await dataFetcher.fetchData(`${gameInfo.pathBase}/WARPTAB.bin`);
    const view = buf.createDataView();
    const out: WarpEntry[] = [];
    const count = Math.floor(view.byteLength / 0x10);

    for (let i = 0; i < count; i++) {
        const base = i * 0x10;
        out.push({
            index: i,
            x: view.getFloat32(base + 0x0, false),
            y: view.getFloat32(base + 0x4, false),
            z: view.getFloat32(base + 0x8, false),
            layer: view.getInt32(base + 0xC, false),
        });
    }

    return out;
}

async function loadMapSetup(gameInfo: GameInfo, dataFetcher: any): Promise<SetupEntry[]> {
    const [indBuf, tabBuf, mapInfos] = await Promise.all([
        dataFetcher.fetchData(`${gameInfo.pathBase}/MAPSETUP.ind`),
        dataFetcher.fetchData(`${gameInfo.pathBase}/MAPSETUP.tab`),
        loadMapInfoRows(gameInfo, dataFetcher),
    ]);

    const ind = indBuf.createDataView();
    const tab = tabBuf.createDataView();
    const out: SetupEntry[] = [];

    const mapCount = Math.min(mapInfos.length, Math.floor(ind.byteLength / 2) - 1);

    for (let mapId = 0; mapId < mapCount; mapId++) {
        const startIndex = ind.getUint16(mapId * 2, false);
        const endIndex = ind.getUint16((mapId + 1) * 2, false);

        if (endIndex < startIndex)
            continue;

        for (let setupId = 0; setupId < endIndex - startIndex; setupId++) {
            const globalIndex = startIndex + setupId;
            const base = globalIndex * 12;
            if (base + 12 > tab.byteLength)
                break;

            out.push({
                globalIndex,
                mapId,
                setupId,
                x: tab.getFloat32(base + 0x0, false),
                y: tab.getFloat32(base + 0x4, false),
                z: tab.getFloat32(base + 0x8, false),
            });
        }
    }

    return out;
}

async function loadGlobalMap(gameInfo: GameInfo, _dataFetcher: any): Promise<GlobalMapEntry[]> {
    const rows = await fetchJSONFile<any[]>(`${gameInfo.pathBase}/GLOBALMAP.json`);
    if (!Array.isArray(rows))
        throw new Error(`GLOBALMAP is not an array`);

    const out: GlobalMapEntry[] = [];

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        let entry: GlobalMapEntry | null = null;

        if (Array.isArray(r)) {
            entry = {
                index: i,
                x: toInt(r[0], -1),
                z: toInt(r[1], -1),
                layerOffset: toInt(r[2], 0),
                mapA: toInt(r[3], -1),
                mapB: toInt(r[4], -1),
                mapC: toInt(r[5], -1),
            };
        } else if (r && typeof r === 'object') {
            const x = pickInt(r, ['CoordX', 'coordX', 'x', 'X', 'GridX', 'gridX'], -1);
            const z = pickInt(r, ['CoordZ', 'coordZ', 'z', 'Z', 'GridZ', 'gridZ'], -1);
            const layerOffset = pickInt(r, ['Unk0', 'layerOffset', 'LayerOffset', 'layer_offset'], 0);

            const mapA = pickInt(r, ['MapIndex', 'mapIndex', 'mapA', 'MapA', 'A'], -1);
            const mapB = pickInt(r, ['Unk1', 'mapB', 'MapB', 'B'], -1);
            const mapC = pickInt(r, ['Unk2', 'mapC', 'MapC', 'C'], -1);

            entry = {
                index: pickInt(r, ['index', 'Index', 'id', 'Id'], i),
                x,
                z,
                layerOffset,
                mapA,
                mapB,
                mapC,
            };
        }

        if (!entry)
            continue;

        const allEmpty =
            entry.x === -1 &&
            entry.z === -1 &&
            entry.mapA === -1 &&
            entry.mapB === -1 &&
            entry.mapC === -1;

        if (!allEmpty)
            out.push(entry);
    }

    if (out.length === 0 && rows.length > 0)
        console.log('GLOBALMAP first raw row:', rows[0]);

    return out;
}

async function loadTriggerEntriesForMap(gameInfo: GameInfo, dataFetcher: any, mapId: number): Promise<TriggerEntry[]> {
    const [tabBuf, binBuf] = await Promise.all([
        dataFetcher.fetchData(`${gameInfo.pathBase}/MAPS.tab`),
        dataFetcher.fetchData(`${gameInfo.pathBase}/MAPS.bin`),
    ]);

    const mapsTab = tabBuf.createDataView();
    const mapsBin = binBuf.createDataView();

    const entryBase = mapId * 0x1C;
    if (entryBase + 0x14 > mapsTab.byteLength)
        return [];

    const objectsOffset = mapsTab.getUint32(entryBase + 0x10, false);
    const objectsEnd = mapsTab.getUint32(entryBase + 0x14, false);
    if (objectsEnd <= objectsOffset || objectsEnd > mapsBin.byteLength)
        return [];

    const objects = new DataView(
        mapsBin.buffer,
        mapsBin.byteOffset + objectsOffset,
        objectsEnd - objectsOffset,
    );

    const out: TriggerEntry[] = [];
    let offs = 0;
    let indexInMap = 0;

    while (offs + 4 <= objects.byteLength) {
        const objId = objects.getInt16(offs + 0x0, false);
        const quarterSize = objects.getUint8(offs + 0x2);
        const sizeBytes = quarterSize * 4;

        if (sizeBytes <= 0 || offs + sizeBytes > objects.byteLength)
            break;

        if (TRIGGER_TYPE_NAMES.has(objId)) {
            const commands: TriggerEntry['commands'] = [];

            for (let i = 0; i < 8; i++) {
                const cOffs = offs + 0x18 + i * 4;
                if (cOffs + 4 <= offs + sizeBytes) {
                    commands.push({
                        slot: i + 1,
                        condition: objects.getUint8(cOffs + 0x0),
                        commandId: objects.getUint8(cOffs + 0x1),
                        arg16: objects.getUint16(cOffs + 0x2, false),
                        argA: objects.getUint8(cOffs + 0x2),
                        argB: objects.getUint8(cOffs + 0x3),
                    });
                }
            }

            out.push({
                indexInMap,
                objId,
                typeName: TRIGGER_TYPE_NAMES.get(objId)!,
                sizeBytes,
                x: sizeBytes >= 0x14 ? objects.getFloat32(offs + 0x08, false) : 0,
                y: sizeBytes >= 0x14 ? objects.getFloat32(offs + 0x0C, false) : 0,
                z: sizeBytes >= 0x14 ? objects.getFloat32(offs + 0x10, false) : 0,
                uid: sizeBytes >= 0x18 ? objects.getInt32(offs + 0x14, false) : 0,
                curveId: sizeBytes >= 0x3A ? objects.getInt16(offs + 0x38, false) : 0,
                scaleX: sizeBytes >= 0x3B ? objects.getUint8(offs + 0x3A) : 0,
                scaleY: sizeBytes >= 0x3C ? objects.getUint8(offs + 0x3B) : 0,
                scaleZ: sizeBytes >= 0x3D ? objects.getUint8(offs + 0x3C) : 0,
                rotateY: sizeBytes >= 0x3E ? objects.getUint8(offs + 0x3D) : 0,
                rotateX: sizeBytes >= 0x3F ? objects.getUint8(offs + 0x3E) : 0,
                rotateZ: sizeBytes >= 0x40 ? objects.getUint8(offs + 0x3F) : 0,
                activatorObjType: sizeBytes >= 0x44 ? objects.getInt16(offs + 0x42, false) : 0,
                setGamebit: sizeBytes >= 0x46 ? objects.getInt16(offs + 0x44, false) : 0,
                delay: sizeBytes >= 0x48 ? objects.getInt16(offs + 0x46, false) : 0,
                checkGamebit1: sizeBytes >= 0x4A ? objects.getInt16(offs + 0x48, false) : 0,
                checkGamebit2: sizeBytes >= 0x4C ? objects.getInt16(offs + 0x4A, false) : 0,
                checkGamebit3: sizeBytes >= 0x4E ? objects.getInt16(offs + 0x4C, false) : 0,
                checkGamebit4: sizeBytes >= 0x50 ? objects.getInt16(offs + 0x4E, false) : 0,
                commands,
            });
        }

        offs += sizeBytes;
        indexInMap++;
    }

    return out;
}

class EmptyDocRenderer extends SFARenderer {
    protected override addWorldRenderInsts(
        _device: GfxDevice,
        _renderInstManager: GfxRenderInstManager,
        _renderLists: SFARenderLists,
        _sceneCtx: SceneRenderContext,
    ) {
    }
}

function drawScatter(
    canvas: HTMLCanvasElement,
    points: Array<{ x: number; z: number; color: string; label?: string; }>,
): void {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#101318';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (points.length === 0) {
        ctx.fillStyle = '#DDD';
        ctx.font = '14px sans-serif';
        ctx.fillText('No points to draw.', 12, 20);
        return;
    }

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
    }

    const pad = 24;
    const spanX = Math.max(1, maxX - minX);
    const spanZ = Math.max(1, maxZ - minZ);

    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < 10; i++) {
        const x = pad + (i / 9) * (canvas.width - pad * 2);
        ctx.beginPath();
        ctx.moveTo(x, pad);
        ctx.lineTo(x, canvas.height - pad);
        ctx.stroke();

        const y = pad + (i / 9) * (canvas.height - pad * 2);
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(canvas.width - pad, y);
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeRect(pad, pad, canvas.width - pad * 2, canvas.height - pad * 2);

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const nx = (p.x - minX) / spanX;
        const nz = (p.z - minZ) / spanZ;
        const px = pad + nx * (canvas.width - pad * 2);
        const py = canvas.height - pad - nz * (canvas.height - pad * 2);

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();

        if (i < 20 && p.label) {
            ctx.fillStyle = '#EAEAEA';
            ctx.font = '11px monospace';
            ctx.fillText(p.label, px + 6, py - 6);
        }
    }
}

class DPTriggerBrowserRenderer extends EmptyDocRenderer {
    private readonly panel = new UI.Panel();
    private readonly mapInput = document.createElement('input');
    private readonly filterInput = document.createElement('input');
    private readonly status = document.createElement('div');
    private readonly canvas = document.createElement('canvas');
    private readonly output = document.createElement('pre');

    private mapInfos: MapInfoRow[] = [];
    private entries: TriggerEntry[] = [];
    private currentMapId = 2;

    constructor(
        private readonly context: SceneContext,
        animController: SFAAnimationController,
        public override materialFactory: MaterialFactory,
        private readonly gameInfo: GameInfo,
    ) {
        super(context, animController, materialFactory);

        this.panel.setTitle(UI.LAYER_ICON, 'DP Trigger Browser');
        this.panel.setExpanded(true);

        const row1 = document.createElement('div');
        row1.style.display = 'grid';
        row1.style.gridTemplateColumns = '90px 1fr auto';
        row1.style.gap = '8px';
        row1.style.alignItems = 'center';
        row1.style.marginBottom = '8px';

        row1.appendChild(makeLabel('Map ID'));
        this.mapInput.type = 'number';
        this.mapInput.value = '2';
        row1.appendChild(this.mapInput);
        row1.appendChild(makeButton('Load', () => {
            this.currentMapId = Math.max(0, Number(this.mapInput.value) | 0);
            void this.reload();
        }));

        const row2 = document.createElement('div');
        row2.style.display = 'grid';
        row2.style.gridTemplateColumns = '90px 1fr';
        row2.style.gap = '8px';
        row2.style.alignItems = 'center';
        row2.style.marginBottom = '8px';

        row2.appendChild(makeLabel('Filter'));
        this.filterInput.type = 'text';
        this.filterInput.placeholder = 'type name, objId, gamebit, uid...';
        this.filterInput.oninput = () => this.refresh();
        row2.appendChild(this.filterInput);

        this.canvas.width = 520;
        this.canvas.height = 300;
        this.canvas.style.width = '100%';
        this.canvas.style.border = '1px solid #444';
        this.canvas.style.marginBottom = '8px';

        this.output.style.whiteSpace = 'pre-wrap';
        this.output.style.maxHeight = '45vh';
        this.output.style.overflow = 'auto';
        this.output.style.fontSize = '12px';

        this.panel.contents.appendChild(row1);
        this.panel.contents.appendChild(row2);
        this.panel.contents.appendChild(this.status);
        this.panel.contents.appendChild(this.canvas);
        this.panel.contents.appendChild(this.output);

        void this.reload();
    }

    public createPanels(): UI.Panel[] {
        return [this.panel];
    }

private async reload(): Promise<void> {
    this.status.textContent = 'Loading...';

    try {
        if (this.mapInfos.length === 0)
            this.mapInfos = await loadMapInfoRows(this.gameInfo, this.context.dataFetcher);

        this.entries = await loadTriggerEntriesForMap(this.gameInfo, this.context.dataFetcher, this.currentMapId);
        this.refresh();
    } catch (e) {
        console.error(e);
        this.entries = [];
        this.status.textContent = `Trigger Browser load failed: ${e instanceof Error ? e.message : String(e)}`;
        this.output.textContent = '';
        drawScatter(this.canvas, []);
    }
}

    private refresh(): void {
        const q = this.filterInput.value.trim().toLowerCase();
        const mapName = this.mapInfos[this.currentMapId]?.name ?? `Map ${this.currentMapId}`;

        const filtered = this.entries.filter((e) => {
            if (q === '')
                return true;

            const blob =
                `${e.typeName} ${e.objId} ${e.uid} ${e.setGamebit} ${e.checkGamebit1} ${e.checkGamebit2} ${e.checkGamebit3} ${e.checkGamebit4}`
                    .toLowerCase();
            return blob.includes(q);
        });

        this.status.textContent =
            `Map ${this.currentMapId}: ${mapName} | Trigger instances: ${filtered.length}/${this.entries.length}`;

        drawScatter(this.canvas, filtered.map((e) => ({
            x: e.x,
            z: e.z,
            color:
                e.objId === 75 ? '#79C0FF' :
                e.objId === 76 ? '#FFA657' :
                e.objId === 77 ? '#A5D6A7' :
                e.objId === 560 ? '#F2CC60' :
                '#D2A8FF',
            label: `${e.typeName} #${e.indexInMap}`,
        })));

        this.output.textContent = filtered.map((e) => {
            const commands = e.commands
                .map((c) =>
                    `  cmd${c.slot}: cond=${hex16(c.condition)} id=${hex16(c.commandId)} arg16=${hex16(c.arg16)} bytes=[${hex16(c.argA)}, ${hex16(c.argB)}]`)
                .join('\n');

            return (
                `#${e.indexInMap} ${e.typeName} (objId=${e.objId})\n` +
                `  pos=(${e.x.toFixed(3)}, ${e.y.toFixed(3)}, ${e.z.toFixed(3)}) uid=${hex32(e.uid)} size=${hex16(e.sizeBytes)}\n` +
                `  curveId=${hex16(e.curveId)} activator=${hex16(e.activatorObjType)} setGamebit=${hex16(e.setGamebit)} delay=${hex16(e.delay)}\n` +
                `  checkBits=[${hex16(e.checkGamebit1)}, ${hex16(e.checkGamebit2)}, ${hex16(e.checkGamebit3)}, ${hex16(e.checkGamebit4)}]\n` +
                `  scale=[${e.scaleX}, ${e.scaleY}, ${e.scaleZ}] rot=[${e.rotateY}, ${e.rotateX}, ${e.rotateZ}]\n` +
                commands
            );
        }).join('\n\n');
    }
}

class DPWarpSetupRenderer extends EmptyDocRenderer {
    private readonly panel = new UI.Panel();
    private readonly mapInput = document.createElement('input');
    private readonly status = document.createElement('div');
    private readonly canvas = document.createElement('canvas');
    private readonly output = document.createElement('pre');

    private mapInfos: MapInfoRow[] = [];
    private warps: WarpEntry[] = [];
    private setups: SetupEntry[] = [];
    private currentMapId = 2;

    constructor(
        private readonly context: SceneContext,
        animController: SFAAnimationController,
        public override materialFactory: MaterialFactory,
        private readonly gameInfo: GameInfo,
    ) {
        super(context, animController, materialFactory);

        this.panel.setTitle(UI.LAYER_ICON, 'DP Warp + Setup Browser');
        this.panel.setExpanded(true);

        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '90px 1fr auto auto';
        row.style.gap = '8px';
        row.style.alignItems = 'center';
        row.style.marginBottom = '8px';

        row.appendChild(makeLabel('Map ID'));
        this.mapInput.type = 'number';
        this.mapInput.value = '2';
        row.appendChild(this.mapInput);
        row.appendChild(makeButton('Load Map', () => {
            this.currentMapId = Math.max(0, Number(this.mapInput.value) | 0);
            this.refresh();
        }));
        row.appendChild(makeButton('All Maps', () => {
            this.currentMapId = -1;
            this.mapInput.value = '-1';
            this.refresh();
        }));

        this.canvas.width = 540;
        this.canvas.height = 320;
        this.canvas.style.width = '100%';
        this.canvas.style.border = '1px solid #444';
        this.canvas.style.marginBottom = '8px';

        this.output.style.whiteSpace = 'pre-wrap';
        this.output.style.maxHeight = '45vh';
        this.output.style.overflow = 'auto';
        this.output.style.fontSize = '12px';

        this.panel.contents.appendChild(row);
        this.panel.contents.appendChild(this.status);
        this.panel.contents.appendChild(this.canvas);
        this.panel.contents.appendChild(this.output);

        void this.reload();
    }

    public createPanels(): UI.Panel[] {
        return [this.panel];
    }

private async reload(): Promise<void> {
    this.status.textContent = 'Loading...';

    try {
        const [mapInfos, warps, setups] = await Promise.all([
            loadMapInfoRows(this.gameInfo, this.context.dataFetcher),
            loadWarps(this.gameInfo, this.context.dataFetcher),
            loadMapSetup(this.gameInfo, this.context.dataFetcher),
        ]);
        this.mapInfos = mapInfos;
        this.warps = warps;
        this.setups = setups;
        this.refresh();
    } catch (e) {
        console.error(e);
        this.mapInfos = [];
        this.warps = [];
        this.setups = [];
        this.status.textContent = `Warp + Setup Browser load failed: ${e instanceof Error ? e.message : String(e)}`;
        this.output.textContent = '';
        drawScatter(this.canvas, []);
    }
}

    private refresh(): void {
        const activeName = this.currentMapId >= 0
            ? (this.mapInfos[this.currentMapId]?.name ?? `Map ${this.currentMapId}`)
            : 'All Maps';

        const activeSetups = this.currentMapId >= 0
            ? this.setups.filter((s) => s.mapId === this.currentMapId)
            : this.setups;

        const activeWarps = this.warps.filter((w) => !(w.x === 0 && w.y === 0 && w.z === 0));

        this.status.textContent =
            `${activeName} | nonzero WARPTAB entries: ${activeWarps.length} | MAPSETUP points shown: ${activeSetups.length}`;

        drawScatter(this.canvas, [
            ...activeWarps.map((w) => ({
                x: w.x,
                z: w.z,
                color: '#79C0FF',
                label: `W${w.index}`,
            })),
            ...activeSetups.map((s) => ({
                x: s.x,
                z: s.z,
                color: '#F2CC60',
                label: `S${s.setupId}`,
            })),
        ]);

        const setupLines = activeSetups.map((s) => {
            const name = this.mapInfos[s.mapId]?.name ?? `Map ${s.mapId}`;
            return `setup map=${s.mapId} (${name}) setupId=${s.setupId} global=${s.globalIndex} pos=(${s.x.toFixed(3)}, ${s.y.toFixed(3)}, ${s.z.toFixed(3)})`;
        });

        const warpLines = activeWarps.map((w) =>
            `warp ${w.index} layer=${w.layer} pos=(${w.x.toFixed(3)}, ${w.y.toFixed(3)}, ${w.z.toFixed(3)})`
        );

        this.output.textContent =
            `=== WARPTAB ===\n${warpLines.join('\n')}\n\n=== MAPSETUP ===\n${setupLines.join('\n')}`;
    }
}

class DPGlobalWorldRenderer extends EmptyDocRenderer {
    private readonly panel = new UI.Panel();
    private readonly status = document.createElement('div');
    private readonly canvas = document.createElement('canvas');
    private readonly output = document.createElement('pre');

    private mapInfos: MapInfoRow[] = [];
    private globals: GlobalMapEntry[] = [];

    constructor(
        private readonly context: SceneContext,
        animController: SFAAnimationController,
        public override materialFactory: MaterialFactory,
        private readonly gameInfo: GameInfo,
    ) {
        super(context, animController, materialFactory);

        this.panel.setTitle(UI.LAYER_ICON, 'DP Global World Explorer');
        this.panel.setExpanded(true);

        this.canvas.width = 620;
        this.canvas.height = 420;
        this.canvas.style.width = '100%';
        this.canvas.style.border = '1px solid #444';
        this.canvas.style.marginBottom = '8px';

        this.output.style.whiteSpace = 'pre-wrap';
        this.output.style.maxHeight = '45vh';
        this.output.style.overflow = 'auto';
        this.output.style.fontSize = '12px';

        this.panel.contents.appendChild(this.status);
        this.panel.contents.appendChild(this.canvas);
        this.panel.contents.appendChild(this.output);

        void this.reload();
    }

    public createPanels(): UI.Panel[] {
        return [this.panel];
    }

private async reload(): Promise<void> {
    this.status.textContent = 'Loading...';

    try {
        const [mapInfos, globals] = await Promise.all([
            loadMapInfoRows(this.gameInfo, this.context.dataFetcher),
            loadGlobalMap(this.gameInfo, this.context.dataFetcher),
        ]);
        this.mapInfos = mapInfos;
        this.globals = globals;
        this.refresh();
    } catch (e) {
        console.error(e);
        this.mapInfos = [];
        this.globals = [];
        this.status.textContent = `Global World Explorer load failed: ${e instanceof Error ? e.message : String(e)}`;
        this.output.textContent = '';
        const ctx = this.canvas.getContext('2d')!;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = '#101318';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
}

    private refresh(): void {
        const ctx = this.canvas.getContext('2d')!;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = '#101318';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.globals.length === 0) {
            this.status.textContent = 'No GLOBALMAP entries.';
            return;
        }

        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (const g of this.globals) {
            if (g.x < minX) minX = g.x;
            if (g.x > maxX) maxX = g.x;
            if (g.z < minZ) minZ = g.z;
            if (g.z > maxZ) maxZ = g.z;
        }

        const pad = 28;
        const spanX = Math.max(1, maxX - minX + 1);
        const spanZ = Math.max(1, maxZ - minZ + 1);
        const cellW = (this.canvas.width - pad * 2) / spanX;
        const cellH = (this.canvas.height - pad * 2) / spanZ;

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        for (let x = 0; x <= spanX; x++) {
            const px = pad + x * cellW;
            ctx.beginPath();
            ctx.moveTo(px, pad);
            ctx.lineTo(px, this.canvas.height - pad);
            ctx.stroke();
        }
        for (let z = 0; z <= spanZ; z++) {
            const py = pad + z * cellH;
            ctx.beginPath();
            ctx.moveTo(pad, py);
            ctx.lineTo(this.canvas.width - pad, py);
            ctx.stroke();
        }

        for (const g of this.globals) {
            const gx = pad + (g.x - minX) * cellW;
            const gz = pad + (g.z - minZ) * cellH;

            ctx.fillStyle = 'rgba(124, 189, 255, 0.22)';
            ctx.fillRect(gx + 1, gz + 1, cellW - 2, cellH - 2);

            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.strokeRect(gx + 1, gz + 1, cellW - 2, cellH - 2);

            const lines: string[] = [];
            if (g.mapA >= 0) lines.push(`A:${this.mapInfos[g.mapA]?.name ?? g.mapA}`);
            if (g.mapB >= 0) lines.push(`B:${this.mapInfos[g.mapB]?.name ?? g.mapB}`);
            if (g.mapC >= 0) lines.push(`C:${this.mapInfos[g.mapC]?.name ?? g.mapC}`);

            ctx.fillStyle = '#EAEAEA';
            ctx.font = '11px monospace';
            ctx.fillText(`[${g.index}] (${g.x},${g.z})`, gx + 4, gz + 14);

            for (let i = 0; i < Math.min(3, lines.length); i++)
                ctx.fillText(lines[i], gx + 4, gz + 28 + i * 13);
        }

        const mobile = this.mapInfos.filter((m) => m.type === 1);

        this.status.textContent =
            `GLOBALMAP entries: ${this.globals.length} | mobile MAPINFO entries: ${mobile.length}`;

        this.output.textContent =
            `=== GLOBALMAP ===\n` +
            this.globals.map((g) =>
                `[${g.index}] grid=(${g.x}, ${g.z}) layerOffset=${g.layerOffset} ` +
                `A=${g.mapA >= 0 ? `${g.mapA}:${this.mapInfos[g.mapA]?.name ?? g.mapA}` : '-'} ` +
                `B=${g.mapB >= 0 ? `${g.mapB}:${this.mapInfos[g.mapB]?.name ?? g.mapB}` : '-'} ` +
                `C=${g.mapC >= 0 ? `${g.mapC}:${this.mapInfos[g.mapC]?.name ?? g.mapC}` : '-'}`
            ).join('\n') +
            `\n\n=== MOBILE MAPS (MAPINFO type 1) ===\n` +
            mobile.map((m) => `[${m.id}] ${m.name} unkOffset=${m.unkOffset}`).join('\n');
    }
}

export class DPTriggerBrowserSceneDesc implements Viewer.SceneDesc {
    constructor(
        public id: string,
        public name: string,
        private readonly gameInfo: GameInfo,
    ) {}

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        const materialFactory = new MaterialFactory(device);
        materialFactory.initialize();
        const animController = new SFAAnimationController();
        return new DPTriggerBrowserRenderer(context, animController, materialFactory, this.gameInfo);
    }
}

export class DPWarpSetupBrowserSceneDesc implements Viewer.SceneDesc {
    constructor(
        public id: string,
        public name: string,
        private readonly gameInfo: GameInfo,
    ) {}

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        const materialFactory = new MaterialFactory(device);
        materialFactory.initialize();
        const animController = new SFAAnimationController();
        return new DPWarpSetupRenderer(context, animController, materialFactory, this.gameInfo);
    }
}

export class DPGlobalWorldExplorerSceneDesc implements Viewer.SceneDesc {
    constructor(
        public id: string,
        public name: string,
        private readonly gameInfo: GameInfo,
    ) {}

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        const materialFactory = new MaterialFactory(device);
        materialFactory.initialize();
        const animController = new SFAAnimationController();
        return new DPGlobalWorldRenderer(context, animController, materialFactory, this.gameInfo);
    }
}