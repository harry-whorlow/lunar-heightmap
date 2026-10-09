import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { MARS_RADIUS_KM, MOON_RADIUS_KM, openHeightMap } from "../src/scripts/sampling.ts";

// Mars relief reaches ~21 km, which overflows int16 at half-metre precision.
const BODIES = {
  moon: { input: "data/lunar-height-map.tif", radiusKm: MOON_RADIUS_KM, unitsPerKm: 2000 },
  mars: { input: "data/mars-height-map.tif", radiusKm: MARS_RADIUS_KM, unitsPerKm: 1000 },
};

const { values } = parseArgs({
  options: {
    body: { type: "string", default: "moon" },
    input: { type: "string" },
    out: { type: "string", default: "public/data" },
    cols: { type: "string", default: "1024" },
    rows: { type: "string", default: "512" },
  },
});

if (!(values.body in BODIES)) {
  throw new Error(`--body must be one of: ${Object.keys(BODIES).join(", ")}`);
}
const body = values.body as keyof typeof BODIES;
const { radiusKm, unitsPerKm } = BODIES[body];

const cols = Number(values.cols);
const rows = Number(values.rows);
if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1) {
  throw new Error("--cols and --rows must be positive integers");
}

const start = performance.now();
const map = openHeightMap(values.input ?? BODIES[body].input, { radiusKm });
const heightsKm = map.sampleGrid(cols, rows);
map.close();

const heights = new Int16Array(heightsKm.length);
let minKm = Infinity;
let maxKm = -Infinity;
for (let i = 0; i < heightsKm.length; i++) {
  heights[i] = Math.round(heightsKm[i] * unitsPerKm);
  minKm = Math.min(minKm, heightsKm[i]);
  maxKm = Math.max(maxKm, heightsKm[i]);
}

const file = `${body}-${cols}x${rows}.bin`;
mkdirSync(values.out, { recursive: true });
writeFileSync(join(values.out, file), new Uint8Array(heights.buffer));
writeFileSync(
  join(values.out, `${body}.json`),
  JSON.stringify(
    {
      file,
      cols,
      rows,
      vertexCount: heights.length,
      format: "int16le",
      unitsPerKm,
      radiusKm,
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
