import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { MOON_RADIUS_KM, openHeightMap } from "../src/scripts/sampling.ts";

const HALF_METRES_PER_KM = 2000;

const { values } = parseArgs({
  options: {
    input: { type: "string", default: "data/lunar-height-map.tif" },
    out: { type: "string", default: "public/data" },
    cols: { type: "string", default: "1024" },
    rows: { type: "string", default: "512" },
  },
});

const cols = Number(values.cols);
const rows = Number(values.rows);
if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
  throw new Error("--cols and --rows must be positive integers");
}

const start = performance.now();
const map = openHeightMap(values.input);
const heightsKm = map.sampleGrid(cols, rows);
map.close();

const heights = new Int16Array(heightsKm.length);
let minKm = Infinity;
let maxKm = -Infinity;
for (let i = 0; i < heightsKm.length; i++) {
  heights[i] = Math.round(heightsKm[i] * HALF_METRES_PER_KM);
  minKm = Math.min(minKm, heightsKm[i]);
  maxKm = Math.max(maxKm, heightsKm[i]);
}

const file = `moon-${cols}x${rows}.bin`;
mkdirSync(values.out, { recursive: true });
writeFileSync(join(values.out, file), new Uint8Array(heights.buffer));
writeFileSync(
  join(values.out, "moon.json"),
  JSON.stringify(
    {
      file,
      cols,
      rows,
      vertexCount: heights.length,
      format: "int16le",
      unitsPerKm: HALF_METRES_PER_KM,
      radiusKm: MOON_RADIUS_KM,
      minKm,
      maxKm,
    },
    null,
    2,
  ),
);

console.log(
  `Wrote ${file} (${cols + 1}x${rows + 1} vertices, ${heights.byteLength} bytes, ` +
    `${minKm.toFixed(2)}..${maxKm.toFixed(2)} km) in ${(performance.now() - start).toFixed(0)} ms`,
);
