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

export async function loadHeightMap(
  baseUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/data`,
): Promise<HeightMapData> {
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
  readonly heightTexture: THREE.DataTexture;
  private readonly directions: Float32Array;
  private readonly relativeHeights: Float32Array;

  constructor({ meta, heights }: HeightMapData, exaggeration = 1, { meshCols = 1024, meshRows = 512 } = {}) {
    super();
    const cols = Math.min(meshCols, meta.cols);
    const rows = Math.min(meshRows, meta.rows);
    this.cols = cols;
    this.rows = rows;

    const heightsKm = new Float32Array(meta.cols * (meta.rows + 1));
    for (let r = 0; r <= meta.rows; r++) {
      for (let c = 0; c < meta.cols; c++) {
        heightsKm[r * meta.cols + c] = heights[r * (meta.cols + 1) + c] / meta.unitsPerKm;
      }
    }
    this.heightTexture = new THREE.DataTexture(heightsKm, meta.cols, meta.rows + 1, THREE.RedFormat, THREE.FloatType);
    this.heightTexture.needsUpdate = true;

    const count = (cols + 1) * (rows + 1);
    this.directions = new Float32Array(count * 3);
    this.relativeHeights = new Float32Array(count);
    const gridUv = new Float32Array(count * 2);

    for (let r = 0; r <= rows; r++) {
      const lat = THREE.MathUtils.degToRad(90 - (r / rows) * 180);
      const dataRow = Math.round((r / rows) * meta.rows);
      for (let c = 0; c <= cols; c++) {
        const lon = THREE.MathUtils.degToRad(-180 + (c / cols) * 360);
        const dataCol = Math.round((c / cols) * meta.cols) % meta.cols;
        const i = r * (cols + 1) + c;
        this.directions[i * 3] = Math.cos(lat) * Math.sin(lon);
        this.directions[i * 3 + 1] = Math.sin(lat);
        this.directions[i * 3 + 2] = Math.cos(lat) * Math.cos(lon);
        this.relativeHeights[i] = heightsKm[dataRow * meta.cols + dataCol] / meta.radiusKm;
        gridUv[i * 2] = c / cols;
        gridUv[i * 2 + 1] = r / rows;
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
    this.setAttribute("gridUv", new THREE.BufferAttribute(gridUv, 2));
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
