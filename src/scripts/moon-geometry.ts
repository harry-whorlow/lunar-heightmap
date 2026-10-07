import * as THREE from "three";

export interface HeightMapMeta {
  file: string;
  cols: number;
  rows: number;
  vertexCount: number;
  format: "int16le";
  unitsPerKm: number;
  radiusKm: number;
  minKm: number;
  maxKm: number;
}

export interface HeightMapData {
  meta: HeightMapMeta;
  heights: Int16Array;
}

export async function loadHeightMap(baseUrl = "/data"): Promise<HeightMapData> {
  const meta: HeightMapMeta = await (await fetch(`${baseUrl}/moon.json`)).json();
  const buffer = await (await fetch(`${baseUrl}/${meta.file}`)).arrayBuffer();
  const heights = new Int16Array(buffer);
  if (heights.length !== meta.vertexCount) {
    throw new Error(`Expected ${meta.vertexCount} heights, got ${heights.length}`);
  }
  return { meta, heights };
}

export class MoonGeometry extends THREE.BufferGeometry {
  readonly cols: number;
  readonly rows: number;
  private readonly directions: Float32Array;
  private readonly relativeHeights: Float32Array;

  constructor({ meta, heights }: HeightMapData, exaggeration = 1) {
    super();
    const { cols, rows } = meta;
    this.cols = cols;
    this.rows = rows;

    const count = (cols + 1) * (rows + 1);
    this.directions = new Float32Array(count * 3);
    this.relativeHeights = new Float32Array(count);
    const heightsKm = new Float32Array(count);

    for (let r = 0; r <= rows; r++) {
      const lat = THREE.MathUtils.degToRad(90 - (r / rows) * 180);
      for (let c = 0; c <= cols; c++) {
        const lon = THREE.MathUtils.degToRad(-180 + (c / cols) * 360);
        const i = r * (cols + 1) + c;
        this.directions[i * 3] = Math.cos(lat) * Math.sin(lon);
        this.directions[i * 3 + 1] = Math.sin(lat);
        this.directions[i * 3 + 2] = Math.cos(lat) * Math.cos(lon);
        heightsKm[i] = heights[i] / meta.unitsPerKm;
        this.relativeHeights[i] = heightsKm[i] / meta.radiusKm;
      }
    }

    const indices: number[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = a + cols + 1;
        const d = a + 1;
        const e = b + 1;
        if (r > 0) indices.push(a, b, d);
        if (r < rows - 1) indices.push(b, e, d);
      }
    }

    this.setIndex(count > 65535 ? new THREE.Uint32BufferAttribute(indices, 1) : new THREE.Uint16BufferAttribute(indices, 1));
    this.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.setAttribute("height", new THREE.BufferAttribute(heightsKm, 1));
    this.setExaggeration(exaggeration);
  }

  setExaggeration(exaggeration: number): void {
    const position = this.getAttribute("position") as THREE.BufferAttribute;
    const p = position.array as Float32Array;
    for (let i = 0; i < this.relativeHeights.length; i++) {
      const scale = 1 + this.relativeHeights[i] * exaggeration;
      p[i * 3] = this.directions[i * 3] * scale;
      p[i * 3 + 1] = this.directions[i * 3 + 1] * scale;
      p[i * 3 + 2] = this.directions[i * 3 + 2] * scale;
    }
    position.needsUpdate = true;
    this.computeVertexNormals();
    this.weldNormals();
    this.computeBoundingSphere();
  }

  private weldNormals(): void {
    const normal = this.getAttribute("normal") as THREE.BufferAttribute;
    const n = normal.array as Float32Array;
    const { cols, rows } = this;
    const v = new THREE.Vector3();

    for (let r = 0; r <= rows; r++) {
      const first = r * (cols + 1);
      const last = first + cols;
      v.set(n[first * 3] + n[last * 3], n[first * 3 + 1] + n[last * 3 + 1], n[first * 3 + 2] + n[last * 3 + 2]).normalize();
      v.toArray(n, first * 3);
      v.toArray(n, last * 3);
    }

    for (const r of [0, rows]) {
      v.set(0, 0, 0);
      for (let c = 0; c < cols; c++) {
        const i = (r * (cols + 1) + c) * 3;
        v.x += n[i];
        v.y += n[i + 1];
        v.z += n[i + 2];
      }
      v.normalize();
      for (let c = 0; c <= cols; c++) v.toArray(n, (r * (cols + 1) + c) * 3);
    }

    normal.needsUpdate = true;
  }
}
