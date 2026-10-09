import { closeSync, openSync, readSync } from "node:fs";

export const MOON_RADIUS_KM = 1737.4;
export const MARS_RADIUS_KM = 3396.19;

const UINT16_OFFSET = 20000;
const HALF_METRES_PER_KM = 2000;
const METRES_PER_KM = 1000;

const TAG_IMAGE_WIDTH = 256;
const TAG_IMAGE_LENGTH = 257;
const TAG_BITS_PER_SAMPLE = 258;
const TAG_COMPRESSION = 259;
const TAG_STRIP_OFFSETS = 273;
const TAG_SAMPLES_PER_PIXEL = 277;
const TAG_ROWS_PER_STRIP = 278;
const TAG_SAMPLE_FORMAT = 339;

const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 16: 8 };

type PixelFormat = "float32" | "uint16" | "int16";

interface TiffLayout {
  width: number;
  height: number;
  format: PixelFormat;
  bytesPerPixel: number;
  littleEndian: boolean;
  rowsPerStrip: number;
  stripOffsets: number[];
}

export interface HeightMapSampler {
  readonly width: number;
  readonly height: number;
    readonly pixelsPerDegree: number;
  readonly format: PixelFormat;
    samplePixel(x: number, y: number): number;
    sample(latDeg: number, lonDeg: number): number;
    sampleRadius(latDeg: number, lonDeg: number): number;
    sampleGrid(cols: number, rows: number): Float32Array;
  close(): void;
}

function readTiffLayout(fd: number): TiffLayout {
  const header = Buffer.alloc(8);
  readSync(fd, header, 0, 8, 0);

  const order = header.toString("ascii", 0, 2);
  if (order !== "II" && order !== "MM") throw new Error("Not a TIFF file");
  const le = order === "II";
  const u16 = (b: Buffer, o: number) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (b: Buffer, o: number) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));

  if (u16(header, 2) !== 42) throw new Error("Unsupported TIFF (BigTIFF is not supported)");
  const ifdOffset = u32(header, 4);

  const countBuf = Buffer.alloc(2);
  readSync(fd, countBuf, 0, 2, ifdOffset);
  const entryCount = u16(countBuf, 0);
  const ifd = Buffer.alloc(entryCount * 12);
  readSync(fd, ifd, 0, ifd.length, ifdOffset + 2);
  const tags = new Map<number, number[]>();
  for (let i = 0; i < entryCount; i++) {
    const e = i * 12;
    const tag = u16(ifd, e);
    const type = u16(ifd, e + 2);
    const count = u32(ifd, e + 4);
    if (type !== 3 && type !== 4) continue;

    const size = TYPE_SIZES[type] * count;
    let data: Buffer;
    let base: number;
    if (size <= 4) {
      data = ifd;
      base = e + 8;
    } else {
      data = Buffer.alloc(size);
      readSync(fd, data, 0, size, u32(ifd, e + 8));
      base = 0;
    }
    const values = new Array<number>(count);
    for (let j = 0; j < count; j++) {
      values[j] = type === 3 ? u16(data, base + j * 2) : u32(data, base + j * 4);
    }
    tags.set(tag, values);
  }

  const get = (tag: number, fallback?: number): number => {
    const v = tags.get(tag)?.[0] ?? fallback;
    if (v === undefined) throw new Error(`TIFF missing required tag ${tag}`);
    return v;
  };

  const width = get(TAG_IMAGE_WIDTH);
  const height = get(TAG_IMAGE_LENGTH);
  const bits = get(TAG_BITS_PER_SAMPLE);
  const sampleFormat = get(TAG_SAMPLE_FORMAT, 1);

  if (get(TAG_COMPRESSION, 1) !== 1) throw new Error("Compressed TIFFs are not supported");
  if (get(TAG_SAMPLES_PER_PIXEL, 1) !== 1) throw new Error("Expected a single-band TIFF");

  const stripOffsets = tags.get(TAG_STRIP_OFFSETS);
  if (!stripOffsets) throw new Error("Tiled TIFFs are not supported (no StripOffsets)");

  let format: PixelFormat;
  if (bits === 32 && sampleFormat === 3) format = "float32";
  else if (bits === 16 && sampleFormat === 1) format = "uint16";
  else if (bits === 16 && sampleFormat === 2) format = "int16";
  else throw new Error(`Unsupported pixel format: ${bits}-bit, SampleFormat ${sampleFormat}`);

  return {
    width,
    height,
    format,
    bytesPerPixel: bits / 8,
    littleEndian: le,
    rowsPerStrip: get(TAG_ROWS_PER_STRIP, height),
    stripOffsets,
  };
}

export function openHeightMap(
  path: string,
  { radiusKm = MOON_RADIUS_KM, rowCacheSize = 256 } = {},
): HeightMapSampler {
  const fd = openSync(path, "r");
  let layout: TiffLayout;
  try {
    layout = readTiffLayout(fd);
  } catch (err) {
    closeSync(fd);
    throw err;
  }

  const { width, height, format, bytesPerPixel, littleEndian, rowsPerStrip, stripOffsets } = layout;
  const pixelsPerDegree = width / 360;
  const rowBytes = width * bytesPerPixel;
  const rowBuf = Buffer.alloc(rowBytes);
  const rowCache = new Map<number, Float32Array>();

  const toKm =
    format === "float32"
      ? (v: number) => v
      : format === "int16"
        ? (v: number) => v / METRES_PER_KM
        : (v: number) => (v - UINT16_OFFSET) / HALF_METRES_PER_KM;

  function readRow(y: number): Float32Array {
    const cached = rowCache.get(y);
    if (cached) {
      rowCache.delete(y);
      rowCache.set(y, cached);
      return cached;
    }

    const strip = Math.floor(y / rowsPerStrip);
    const offset = stripOffsets[strip] + (y % rowsPerStrip) * rowBytes;
    readSync(fd, rowBuf, 0, rowBytes, offset);

    const row = new Float32Array(width);
    if (format === "float32") {
      for (let x = 0; x < width; x++) {
        row[x] = littleEndian ? rowBuf.readFloatLE(x * 4) : rowBuf.readFloatBE(x * 4);
      }
    } else if (format === "int16") {
      for (let x = 0; x < width; x++) {
        row[x] = toKm(littleEndian ? rowBuf.readInt16LE(x * 2) : rowBuf.readInt16BE(x * 2));
      }
    } else {
      for (let x = 0; x < width; x++) {
        row[x] = toKm(littleEndian ? rowBuf.readUInt16LE(x * 2) : rowBuf.readUInt16BE(x * 2));
      }
    }

    rowCache.set(y, row);
    if (rowCache.size > rowCacheSize) {
      rowCache.delete(rowCache.keys().next().value!);
    }
    return row;
  }

  const wrapX = (x: number) => ((x % width) + width) % width;
  const clampY = (y: number) => Math.min(height - 1, Math.max(0, y));

  function samplePixel(x: number, y: number): number {
    return readRow(clampY(Math.floor(y)))[wrapX(Math.floor(x))];
  }

  function sample(latDeg: number, lonDeg: number): number {
    const fx = (lonDeg + 180) * pixelsPerDegree - 0.5;
    const fy = (90 - latDeg) * pixelsPerDegree - 0.5;

    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;

    const top = readRow(clampY(y0));
    const bottom = readRow(clampY(y0 + 1));
    const xa = wrapX(x0);
    const xb = wrapX(x0 + 1);

    const h0 = top[xa] * (1 - tx) + top[xb] * tx;
    const h1 = bottom[xa] * (1 - tx) + bottom[xb] * tx;
    return h0 * (1 - ty) + h1 * ty;
  }

  function sampleGrid(cols: number, rows: number): Float32Array {
    const out = new Float32Array((cols + 1) * (rows + 1));
    for (let r = 0; r <= rows; r++) {
      const lat = 90 - (r / rows) * 180;
      for (let c = 0; c <= cols; c++) {
        const lon = -180 + (c / cols) * 360;
        out[r * (cols + 1) + c] = sample(lat, lon);
      }
    }
    return out;
  }

  return {
    width,
    height,
    pixelsPerDegree,
    format,
    samplePixel,
    sample,
    sampleRadius: (lat, lon) => radiusKm + sample(lat, lon),
    sampleGrid,
    close: () => {
      rowCache.clear();
      closeSync(fd);
    },
  };
}
