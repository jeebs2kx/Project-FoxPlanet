import * as Viewer from '../viewer.js';
import { SceneContext } from '../SceneBase.js';
import { DeviceProgram } from '../Program.js';
import { assert } from '../util.js';
import { makeStaticDataBuffer } from '../gfx/helpers/BufferHelpers.js';
import { fillMatrix4x3, fillMatrix4x4 } from '../gfx/helpers/UniformBufferHelpers.js';
import { GfxRenderInstManager, GfxRendererLayer, makeSortKey } from '../gfx/render/GfxRenderInstManager.js';
import {
    GfxBindingLayoutDescriptor,
    GfxBuffer,
    GfxBufferUsage,
    GfxCullMode,
    GfxDevice,
    GfxFormat,
    GfxInputLayout,
    GfxInputLayoutBufferDescriptor,
    GfxProgram,
    GfxVertexAttributeDescriptor,
    GfxVertexBufferDescriptor,
    GfxVertexBufferFrequency,
} from '../gfx/platform/GfxPlatform.js';
import { SFAAnimationController } from './animation.js';
import { MaterialFactory } from './materials.js';
import { SceneRenderContext, SFARenderer, SFARenderLists } from './render.js';

interface DKRTrackBatch {
    name: string;
    group: number;
    batch: number;
    localTex: number;
    globalTex: number | null;
    start: number;
    count: number;
    triangles: number;
    renderFlags?: number;
    vertOverride?: number;
    verticesStart?: number;
    verticesEnd?: number;
    facesStart?: number;
    facesEnd?: number;
}

interface DKRTrackDrawCall extends DKRTrackBatch {
    backfaceDraw: boolean;
    triangleFlagsMask: number;
    triangleFlags: number[];
    numberOfOpaqueBatches?: number;
}

interface DKRTrackSegment {
    group: number;
    recordOffset: number;
    vertexOffset: number;
    triangleOffset: number;
    batchOffset: number;
    collisionFacetsOffset: number;
    collisionPlanesOffset: number;
    numberOfVertices: number;
    numberOfTriangles: number;
    numberOfBatches: number;
    numberOfOpaqueBatches: number;
    hasWavesByte: number;
    boundingBox: { min: number[]; max: number[]; rawS16: number[] };
}

interface DKRBspTreeNode {
    leftNode: number;
    rightNode: number;
    splitType: number;
    segmentIndex: number;
    splitValue: number;
    raw: string;
}

interface DKRTrackMeshData {
    format: string;
    trackIndex: number;
    name: string;
    vertexStride: number;
    noTextures: boolean;
    bounds: { min: number[]; max: number[]; center: number[]; radius: number };
    batches: DKRTrackBatch[];
    drawCalls?: DKRTrackDrawCall[];
    segments?: DKRTrackSegment[];
    bspTree?: DKRBspTreeNode[];
    segmentBitfieldsRaw?: string;
    vertices: number[];
    stats: { vertices: number; triangles: number; batches: number; drawCalls?: number; segments?: number; badTrianglesSkipped: number };
}

// Keep this in your normal preferred map scale.
const DKR_WORLD_SCALE = 20.0;

// If this causes missing faces, set to false. True is closer to DKR geometry behaviour:
// triangle flag 0x40 = draw backface, otherwise cull backface.
const DKR_RESPECT_BACKFACE_FLAGS = true;

const bindingLayouts: GfxBindingLayoutDescriptor[] = [{ numUniformBuffers: 1, numSamplers: 0 }];

function scaleDKRMeshInPlace(mesh: DKRTrackMeshData, scale: number): void {
    for (let i = 0; i < mesh.vertices.length; i += mesh.vertexStride) {
        mesh.vertices[i + 0] *= scale;
        mesh.vertices[i + 1] *= scale;
        mesh.vertices[i + 2] *= scale;
    }

    for (let i = 0; i < 3; i++) {
        mesh.bounds.min[i] *= scale;
        mesh.bounds.max[i] *= scale;
        mesh.bounds.center[i] *= scale;
    }

    mesh.bounds.radius *= scale;

    if (mesh.segments !== undefined) {
        for (const segment of mesh.segments) {
            for (let i = 0; i < 3; i++) {
                segment.boundingBox.min[i] *= scale;
                segment.boundingBox.max[i] *= scale;
            }
        }
    }
}

function logDKRGeometryInfo(mesh: DKRTrackMeshData): void {
    console.group(`DKR geometry: track ${mesh.trackIndex} - ${mesh.name}`);
    console.log('Loaded geometry-only v8 data:', mesh.stats);
    console.log('Segments:', mesh.segments ?? []);
    console.log('BSP tree:', mesh.bspTree ?? []);
    console.log('Segment bitfields raw:', mesh.segmentBitfieldsRaw ?? '');
    console.log('Draw calls now include DKR triangle backface flags. 0x40 means draw backface; otherwise cull backface.');
    console.table((mesh.drawCalls ?? []).map((drawCall) => ({
        group: drawCall.group,
        batch: drawCall.batch,
        localTex: drawCall.localTex,
        globalTex: drawCall.globalTex,
        triangles: drawCall.triangles,
        backfaceDraw: drawCall.backfaceDraw,
        triangleFlagsMask: `0x${drawCall.triangleFlagsMask.toString(16)}`,
        renderFlags: drawCall.renderFlags !== undefined ? `0x${drawCall.renderFlags.toString(16)}` : '',
    })));
    console.groupEnd();

    (window as any).__dkrMesh = mesh;
    (window as any).__dkrDrawCalls = mesh.drawCalls ?? [];
    (window as any).__dkrSegments = mesh.segments ?? [];
}

class DKRTrackProgram extends DeviceProgram {
    public static ub_SceneParams = 0;

    public both = `
precision highp float;

layout(std140) uniform ub_SceneParams {
    Mat4x4 u_Projection;
    Mat4x3 u_View;
    vec4 u_Misc;
};

#ifdef VERT
layout(location = 0) in vec3 a_Position;
layout(location = 1) in vec4 a_Color;
layout(location = 2) in vec2 a_TexCoord;

varying vec4 v_Color;
varying vec2 v_TexCoord;

void main() {
    vec3 viewPosition = Mul(u_View, vec4(a_Position, 1.0));
    gl_Position = Mul(u_Projection, vec4(viewPosition, 1.0));
    v_Color = a_Color;
    v_TexCoord = a_TexCoord;
}
#endif

#ifdef FRAG
varying vec4 v_Color;
varying vec2 v_TexCoord;

void main() {
    // Texture-free display. This keeps DKR vertex colours, with only a subtle UV checker
    // so texture regions remain visible while we sort out final texture IDs later.
    vec3 baseColor = clamp(v_Color.rgb, 0.0, 1.0);

    vec2 uv = fract(v_TexCoord * 2.0);
    float checker = mod(floor(uv.x * 2.0) + floor(uv.y * 2.0), 2.0);
    vec3 checkerColor = mix(vec3(0.82, 0.82, 0.82), vec3(1.00, 1.00, 1.00), checker);

    gl_FragColor = vec4(baseColor * checkerColor, 1.0);
}
#endif
`;
}

class DKRTrackNativeScene extends SFARenderer {
    private program = new DKRTrackProgram();
    private gfxProgram: GfxProgram | null = null;
    private inputLayout: GfxInputLayout;
    private vertexBuffer: GfxBuffer;
    private vertexBufferDescriptors: GfxVertexBufferDescriptor[];

    public constructor(context: SceneContext, animController: SFAAnimationController, materialFactory: MaterialFactory, private mesh: DKRTrackMeshData) {
        super(context, animController, materialFactory);

        assert(mesh.format === 'ProjectFoxPlanet-DKRTrackNative-v1' || mesh.format === 'ProjectFoxPlanet-DKRTrackNative-v2-geometry');
        assert(mesh.vertexStride === 9);

        this.program.name = `DKR Track Native Renderer - ${mesh.name}`;

        const vertexData = new Float32Array(mesh.vertices);
        const vertexDataBuffer = new ArrayBuffer(vertexData.byteLength);
        new Uint8Array(vertexDataBuffer).set(new Uint8Array(vertexData.buffer, vertexData.byteOffset, vertexData.byteLength));
        this.vertexBuffer = makeStaticDataBuffer(context.device, GfxBufferUsage.Vertex, vertexDataBuffer);
        this.vertexBufferDescriptors = [{ buffer: this.vertexBuffer, byteOffset: 0 }];

        const vertexAttributeDescriptors: GfxVertexAttributeDescriptor[] = [
            { location: 0, bufferIndex: 0, bufferByteOffset: 0x00, format: GfxFormat.F32_RGB },
            { location: 1, bufferIndex: 0, bufferByteOffset: 0x0C, format: GfxFormat.F32_RGBA },
            { location: 2, bufferIndex: 0, bufferByteOffset: 0x1C, format: GfxFormat.F32_RG },
        ];

        const vertexBufferDescriptors: GfxInputLayoutBufferDescriptor[] = [
            { byteStride: 0x24, frequency: GfxVertexBufferFrequency.PerVertex },
        ];

        this.inputLayout = context.device.createInputLayout({
            indexBufferFormat: null,
            vertexAttributeDescriptors,
            vertexBufferDescriptors,
        });
    }

    protected override addWorldRenderInsts(device: GfxDevice, renderInstManager: GfxRenderInstManager, renderLists: SFARenderLists, sceneCtx: SceneRenderContext): void {
        const template = this.renderHelper.pushTemplateRenderInst();
        template.setBindingLayouts(bindingLayouts);

        let offs = template.allocateUniformBuffer(DKRTrackProgram.ub_SceneParams, 16 + 12 + 4);
        const mapped = template.mapUniformBufferF32(DKRTrackProgram.ub_SceneParams);
        offs += fillMatrix4x4(mapped, offs, sceneCtx.viewerInput.camera.projectionMatrix);
        offs += fillMatrix4x3(mapped, offs, sceneCtx.worldToViewMtx);

        mapped[offs++] = 0.0;
        mapped[offs++] = this.mesh.bounds.radius;
        mapped[offs++] = 0.0;
        mapped[offs++] = 0.0;

        this.gfxProgram = this.gfxProgram ?? this.renderHelper.renderCache.createProgram(this.program);

        const drawCalls = this.mesh.drawCalls ?? this.mesh.batches.map((batch) => ({
            ...batch,
            backfaceDraw: true,
            triangleFlagsMask: 0x40,
            triangleFlags: [0x40],
        }));

        for (let i = 0; i < drawCalls.length; i++) {
            const drawCall = drawCalls[i];
            if (drawCall.count <= 0)
                continue;

            const renderInst = renderInstManager.newRenderInst();
            renderInst.setGfxProgram(this.gfxProgram);
            renderInst.setVertexInput(this.inputLayout, this.vertexBufferDescriptors, null);
            renderInst.setDrawCount(drawCall.count, drawCall.start);

            const cullMode = DKR_RESPECT_BACKFACE_FLAGS && !drawCall.backfaceDraw ? GfxCullMode.Back : GfxCullMode.None;
            renderInst.setMegaStateFlags({ cullMode, depthWrite: true });
            renderInst.sortKey = makeSortKey(GfxRendererLayer.OPAQUE, i);
            renderLists.world[0].submitRenderInst(renderInst);
        }

        this.renderHelper.renderInstManager.popTemplateRenderInst();
    }

    public override destroy(device: GfxDevice): void {
        device.destroyBuffer(this.vertexBuffer);
        device.destroyInputLayout(this.inputLayout);
        super.destroy(device);
    }
}

export class DKRTrackNativeSceneDesc implements Viewer.SceneDesc {
    public constructor(public id: string, public name: string, private dataPath: string) {
    }

    public async createScene(device: GfxDevice, context: SceneContext): Promise<Viewer.SceneGfx> {
        const data = await context.dataFetcher.fetchData(this.dataPath);
        const json = new TextDecoder('utf-8').decode(data.createTypedArray(Uint8Array));
        const mesh = JSON.parse(json) as DKRTrackMeshData;

        scaleDKRMeshInPlace(mesh, DKR_WORLD_SCALE);
        logDKRGeometryInfo(mesh);

        const materialFactory = new MaterialFactory(device);
        materialFactory.initialize();

        const animController = new SFAAnimationController();
        return new DKRTrackNativeScene(context, animController, materialFactory, mesh);
    }
}
