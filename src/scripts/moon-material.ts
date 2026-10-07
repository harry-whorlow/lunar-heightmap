import * as THREE from "three";

const RAMP = ["#2b1a5e", "#2f4fa8", "#2a9bb5", "#55b86b", "#d8c95a", "#d9813a", "#b8402e", "#f4ede4"];

export interface TopoMaterialOptions {
  heightMap: THREE.DataTexture;
  minKm: number;
  maxKm: number;
  contourIntervalKm?: number;
  heatmap?: boolean;
  surface?: boolean;
  fillColor?: THREE.ColorRepresentation;
}

export interface TopoMaterial extends THREE.MeshStandardMaterial {
  setContourInterval(km: number): void;
  setHeatmap(enabled: boolean): void;
  setSurface(enabled: boolean): void;
}

export function createTopoMaterial({
  heightMap,
  minKm,
  maxKm,
  contourIntervalKm = 1,
  heatmap = true,
  surface = true,
  fillColor = "#090b10",
}: TopoMaterialOptions): TopoMaterial {
  const uniforms = {
    uHeightMap: { value: heightMap },
    uMinKm: { value: minKm },
    uMaxKm: { value: maxKm },
    uContourInterval: { value: contourIntervalKm },
    uRamp: { value: RAMP.map((hex) => new THREE.Color(hex)) },
    uHeatmap: { value: heatmap },
    uSurface: { value: surface },
    uFillColor: { value: new THREE.Color(fillColor) },
  };

  const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 }) as TopoMaterial;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 gridUv;\nvarying vec2 vGridUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGridUv = gridUv;");

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        #define RAMP_SIZE ${RAMP.length}
        uniform sampler2D uHeightMap;
        uniform float uMinKm;
        uniform float uMaxKm;
        uniform float uContourInterval;
        uniform vec3 uRamp[RAMP_SIZE];
        uniform bool uHeatmap;
        uniform bool uSurface;
        uniform vec3 uFillColor;
        varying vec2 vGridUv;

        float heightAt(ivec2 p, ivec2 size) {
          p.x = (p.x % size.x + size.x) % size.x;
          p.y = clamp(p.y, 0, size.y - 1);
          return texelFetch(uHeightMap, p, 0).r;
        }

        vec4 bspline(float f) {
          float f2 = f * f;
          float f3 = f2 * f;
          return vec4(
            (1.0 - 3.0 * f + 3.0 * f2 - f3),
            (4.0 - 6.0 * f2 + 3.0 * f3),
            (1.0 + 3.0 * f + 3.0 * f2 - 3.0 * f3),
            f3
          ) / 6.0;
        }

        float smoothHeight(vec2 uv) {
          ivec2 size = textureSize(uHeightMap, 0);
          vec2 p = uv * vec2(float(size.x), float(size.y - 1));
          vec2 cell = floor(p);
          vec2 f = p - cell;
          ivec2 base = ivec2(cell) - 1;
          vec4 wx = bspline(f.x);
          vec4 wy = bspline(f.y);
          float h = 0.0;
          for (int y = 0; y < 4; y++) {
            float row = 0.0;
            for (int x = 0; x < 4; x++) {
              row += wx[x] * heightAt(base + ivec2(x, y), size);
            }
            h += wy[y] * row;
          }
          return h;
        }

        vec3 ramp(float t) {
          float x = clamp(t, 0.0, 1.0) * float(RAMP_SIZE - 1);
          int i = int(min(floor(x), float(RAMP_SIZE - 2)));
          return mix(uRamp[i], uRamp[i + 1], x - float(i));
        }

        float contour(float h, float interval, float width) {
          float t = h / interval;
          float d = abs(fract(t - 0.5) - 0.5) / fwidth(t);
          float halfWidth = 0.5 * width;
          return clamp(min(d + 0.5, halfWidth) - max(d - 0.5, -halfWidth), 0.0, 1.0);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float vHeight = smoothHeight(vGridUv);
        float heightT = clamp((vHeight - uMinKm) / (uMaxKm - uMinKm), 0.0, 1.0);
        vec3 baseColor = uHeatmap ? ramp(heightT) : vec3(1.0);
        vec3 minorColor = uHeatmap ? baseColor : vec3(mix(0.15, 1.0, heightT));
        float minorShade = uHeatmap ? 0.35 : mix(0.6, 0.1, heightT);
        float minorLine = 0.0;
        float majorLine = 0.0;
        if (uContourInterval > 0.0) {
          minorLine = contour(vHeight, uContourInterval, 0.6);
          majorLine = contour(vHeight, uContourInterval * 5.0, 1.2);
        }
        diffuseColor.rgb = baseColor * (1.0 - max(minorLine * minorShade, majorLine * 0.7));`,
      )
      .replace(
        "#include <opaque_fragment>",
        /* glsl */ `if (!uSurface) {
          outgoingLight = mix(uFillColor, minorColor, minorLine * 0.6);
          outgoingLight = mix(outgoingLight, baseColor, majorLine);
        }
        #include <opaque_fragment>`,
      );
  };

  material.setContourInterval = (km) => {
    uniforms.uContourInterval.value = km;
  };

  material.setHeatmap = (enabled) => {
    uniforms.uHeatmap.value = enabled;
  };

  material.setSurface = (enabled) => {
    uniforms.uSurface.value = enabled;
  };

  return material;
}
