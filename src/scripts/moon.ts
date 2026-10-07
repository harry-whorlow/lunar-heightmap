import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadHeightMap, MoonGeometry } from "./moon-geometry";
import { createTopoMaterial } from "./moon-material";

const canvas = document.querySelector<HTMLCanvasElement>("#moon-canvas");
const exaggerationInput =
  document.querySelector<HTMLInputElement>("#exaggeration");
const exaggerationValue = document.querySelector<HTMLOutputElement>(
  "#exaggeration-value",
);
const contourInput = document.querySelector<HTMLSelectElement>("#contours");
const heatmapInput = document.querySelector<HTMLInputElement>("#heatmap");
const surfaceInput = document.querySelector<HTMLInputElement>("#surface");

if (canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(0, 0, 4);
  scene.add(camera);

  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(5, 2, -3);
  camera.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 10;

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  const exaggeration = () => Number(exaggerationInput?.value ?? 10);
  const data = await loadHeightMap();
  const geometry = new MoonGeometry(data, exaggeration());
  const contourInterval = () => Number(contourInput?.value ?? 1);
  const material = createTopoMaterial({
    minKm: data.meta.minKm,
    maxKm: data.meta.maxKm,
    contourIntervalKm: contourInterval(),
    heatmap: heatmapInput?.checked ?? true,
    surface: surfaceInput?.checked ?? true,
  });
  scene.add(new THREE.Mesh(geometry, material));

  let pending = false;
  exaggerationInput?.addEventListener("input", () => {
    if (exaggerationValue) exaggerationValue.value = `${exaggeration()}×`;
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      geometry.setExaggeration(exaggeration());
      pending = false;
    });
  });

  contourInput?.addEventListener("change", () =>
    material.setContourInterval(contourInterval()),
  );
  heatmapInput?.addEventListener("change", () =>
    material.setHeatmap(heatmapInput.checked),
  );
  surfaceInput?.addEventListener("change", () => {
    if (!surfaceInput.checked && contourInput && contourInterval() === 0) {
      contourInput.value = "1";
      material.setContourInterval(1);
    }
    material.setSurface(surfaceInput.checked);
  });
}
