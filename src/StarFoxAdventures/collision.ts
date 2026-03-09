import { vec3 } from 'gl-matrix';
import { MapInstance } from './maps.js';
import { ModelInstance } from './models.js';
import { Shape } from './shapes.js';

export class CollisionManager {
    constructor(private mapInstance: MapInstance) {}

    public checkCollision(x: number, y: number, z: number, radius: number = 5): boolean {

        const bx = Math.floor(x / 640);
        const bz = Math.floor(z / 640);

        for (let cz = bz - 1; cz <= bz + 1; cz++) {
            for (let cx = bx - 1; cx <= bx + 1; cx++) {
                const block = this.mapInstance.getBlockAtPosition(cx * 640, cz * 640);
                if (!block) continue;

                if (this.checkBlockCollision(block, cx, cz, x, y, z, radius)) {
                    return false; 
                }
            }
        }

        return true; 
    }

    private checkBlockCollision(block: ModelInstance, bx: number, bz: number, px: number, py: number, pz: number, radius: number): boolean {
        const blockOffsetX = bx * 640;
        const blockOffsetZ = bz * 640;

        const localX = px - blockOffsetX;
        const localZ = pz - blockOffsetZ;
        const localY = py; 

        const shapes = block.model.sharedModelShapes;
        if (!shapes) return false;

        for (const pass of shapes.shapes) {
            for (const shape of pass) {
                if (this.checkShapeCollision(shape, localX, localY, localZ, radius)) {
                    return true;
                }
            }
        }
        return false;
    }

    private checkShapeCollision(shape: Shape, px: number, py: number, pz: number, radius: number): boolean {
        const geom = shape.geom;
        const data = geom.loadedVertexData;
const posData = data.vertexBuffers[0];        


        if (geom.aabb) {
            // Quick AABB check
            if (px < geom.aabb.minX - radius || px > geom.aabb.maxX + radius ||
                py < geom.aabb.minY - radius || py > geom.aabb.maxY + radius ||
                pz < geom.aabb.minZ - radius || pz > geom.aabb.maxZ + radius) {
                return false;
            }
        }

const view = new DataView(posData);
const indices = new DataView(data.indexData);
        const numIndices = data.totalIndexCount;

        // Iterate triangles
        for (let i = 0; i < numIndices; i += 3) {
            const idx0 = indices.getUint16(i * 2);
            const idx1 = indices.getUint16((i + 1) * 2);
            const idx2 = indices.getUint16((i + 2) * 2);
            
            const v0 = this.getVertex(view, idx0);
            const v1 = this.getVertex(view, idx1);
            const v2 = this.getVertex(view, idx2);

            if (this.triangleIntersect(v0, v1, v2, px, py, pz, radius)) {
                return true;
            }
        }

        return false;
    }

    private getVertex(view: DataView, index: number): vec3 {
        const stride = 6; 
        const offset = index * stride;
        const x = view.getInt16(offset + 0);
        const y = view.getInt16(offset + 2);
        const z = view.getInt16(offset + 4);
        
        return vec3.fromValues(x, y, z);
    }

    private triangleIntersect(p1: vec3, p2: vec3, p3: vec3, centerx: number, centery: number, centerz: number, radius: number): boolean {
        const minH = Math.min(p1[1], p2[1], p3[1]);
        const maxH = Math.max(p1[1], p2[1], p3[1]);
        
        if (centery > maxH + 10 || centery < minH - 10) return false;
        return this.testCircleTriangle(
            centerx, centerz, radius,
            p1[0], p1[2],
            p2[0], p2[2],
            p3[0], p3[2]
        );
    }

    private testCircleTriangle(cx: number, cy: number, r: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): boolean {

        if (this.circleLineIntersect(cx, cy, r, x1, y1, x2, y2)) return true;
        if (this.circleLineIntersect(cx, cy, r, x2, y2, x3, y3)) return true;
        if (this.circleLineIntersect(cx, cy, r, x3, y3, x1, y1)) return true;
        return false; 
    }

    private circleLineIntersect(cx: number, cy: number, r: number, x1: number, y1: number, x2: number, y2: number): boolean {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        const t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
        
        const clampT = Math.max(0, Math.min(1, t));
        const closestX = x1 + clampT * dx;
        const closestY = y1 + clampT * dy;
        
        const distSq = (cx - closestX) ** 2 + (cy - closestY) ** 2;
        return distSq < (r * r);
    }
}