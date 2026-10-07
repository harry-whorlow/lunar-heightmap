import * as THREE from "three";

const RAMP = ["#2b1a5e", "#2f4fa8", "#2a9bb5", "#55b86b", "#d8c95a", "#d9813a", "#b8402e", "#f4ede4"];

export interface TopoMaterialOptions {
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
  minKm,
  maxKm,
  contourIntervalKm = 1,
  heatmap = true,
  surface = true,
  fillColor = "#090b10",
}: TopoMaterialOptions): TopoMaterial {
  const uniforms = {
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
      .replace("#include <common>", "#include <common>\nattribute float height;\nvarying float vHeight;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvHeight = height;");

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        #define RAMP_SIZE ${RAMP.length}
        uniform float uMinKm;
        uniform float uMaxKm;
        uniform float uContourInterval;
        uniform vec3 uRamp[RAMP_SIZE];
        uniform bool uHeatmap;
        uniform bool uSurface;
        uniform vec3 uFillColor;
        varying float vHeight;

        vec3 ramp(float t) {
          float x = clamp(t, 0.0, 1.0) * float(RAMP_SIZE - 1);
          int i = int(min(floor(x), float(RAMP_SIZE - 2)));
          return mix(uRamp[i], uRamp[i + 1], x - float(i));
        }

        float contour(float h, float interval, float width) {
          float t = h / interval;
          float d = abs(fract(t - 0.5) - 0.5) / fwidth(t);
          return 1.0 - clamp(d / width, 0.0, 1.0);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        vec3 baseColor = uHeatmap ? ramp((vHeight - uMinKm) / (uMaxKm - uMinKm)) : vec3(1.0);
        float minorLine = 0.0;
        float majorLine = 0.0;
        if (uContourInterval > 0.0) {
          minorLine = contour(vHeight, uContourInterval, 0.75);
          majorLine = contour(vHeight, uContourInterval * 5.0, 1.5);
        }
        diffuseColor.rgb = baseColor * (1.0 - max(minorLine * 0.35, majorLine * 0.7));`,
      )
      .replace(
        "#include <opaque_fragment>",
        /* glsl */ `if (!uSurface) {
          outgoingLight = mix(uFillColor, baseColor, max(minorLine * 0.6, majorLine));
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
