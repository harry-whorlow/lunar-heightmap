import * as THREE from "three";

const RAMP = ["#2b1a5e", "#2f4fa8", "#2a9bb5", "#55b86b", "#d8c95a", "#d9813a", "#b8402e", "#f4ede4"];

export interface TopoMaterialOptions {
  minKm: number;
  maxKm: number;
  contourIntervalKm?: number;
}

export interface TopoMaterial extends THREE.MeshStandardMaterial {
  setContourInterval(km: number): void;
}

export function createTopoMaterial({ minKm, maxKm, contourIntervalKm = 1 }: TopoMaterialOptions): TopoMaterial {
  const uniforms = {
    uMinKm: { value: minKm },
    uMaxKm: { value: maxKm },
    uContourInterval: { value: contourIntervalKm },
    uRamp: { value: RAMP.map((hex) => new THREE.Color(hex)) },
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
        diffuseColor.rgb = ramp((vHeight - uMinKm) / (uMaxKm - uMinKm));
        if (uContourInterval > 0.0) {
          float minor = contour(vHeight, uContourInterval, 0.75);
          float major = contour(vHeight, uContourInterval * 5.0, 1.5);
          diffuseColor.rgb *= 1.0 - max(minor * 0.35, major * 0.7);
        }`,
      );
  };

  material.setContourInterval = (km) => {
    uniforms.uContourInterval.value = km;
  };

  return material;
}
