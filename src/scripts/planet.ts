import * as THREE from "three";
import { createCameraRig } from "./camera-rig";
import { createSpinControls } from "./spin-controls";
import { HeightMapGeometry, loadHeightMap } from "./height-map-geometry";
import { createTopoMaterial } from "./topo-material";

const canvas = document.querySelector<HTMLCanvasElement>("#planet-canvas");
const exaggerationInput =
  document.querySelector<HTMLInputElement>("#exaggeration");
const exaggerationValue = document.querySelector<HTMLOutputElement>(
  "#exaggeration-value",
);
const contourInput = document.querySelector<HTMLSelectElement>("#contours");
const heatmapInput = document.querySelector<HTMLInputElement>("#heatmap");
const surfaceInput = document.querySelector<HTMLInputElement>("#surface");
const freeCamInput = document.querySelector<HTMLInputElement>("#free-cam");
const distanceInput = document.querySelector<HTMLInputElement>("#distance");
const distanceValue =
  document.querySelector<HTMLOutputElement>("#distance-value");

if (canvas) {
  const body = canvas.dataset.body ?? "moon";
  const radiusKm = Number(canvas.dataset.radiusKm);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  scene.add(camera);

  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(5, 2, -3);
  camera.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const rig = createCameraRig(camera, {
    position: new THREE.Vector3(0, 1.05, 1.4),
    target: new THREE.Vector3(0, 0.95, 0),
    minRadius: 1.25,
    maxRadius: 6,
  });
  rig.setFree(freeCamInput?.checked ?? false);
  freeCamInput?.addEventListener("change", () =>
    rig.setFree(freeCamInput.checked),
  );

  const altitudeKm = () => Number(distanceInput?.value ?? 1300);
  const updateDistance = () => {
    rig.setDistance(1 + altitudeKm() / radiusKm);
    if (distanceValue) {
      distanceValue.value = `${altitudeKm().toLocaleString("en")} km`;
    }
  };
  distanceInput?.addEventListener("input", updateDistance);
  updateDistance();

  const planet = new THREE.Group();
  scene.add(planet);
  const spin = createSpinControls(planet, camera, canvas, { autoSpeed: 0.02 });

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const timer = new THREE.Timer();
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    const dt = Math.min(timer.getDelta(), 0.1);
    rig.update(dt);
    spin.update(dt);
    renderer.render(scene, camera);
  });

  const exaggeration = () => Number(exaggerationInput?.value ?? 10);
  const data = await loadHeightMap(body);
  const geometry = new HeightMapGeometry(data, exaggeration());
  const contourInterval = () => Number(contourInput?.value ?? 1);
  const material = createTopoMaterial({
    heightMap: geometry.heightTexture,
    minKm: data.meta.minKm,
    maxKm: data.meta.maxKm,
    contourIntervalKm: contourInterval(),
    heatmap: heatmapInput?.checked ?? true,
    surface: surfaceInput?.checked ?? true,
  });
  planet.add(new THREE.Mesh(geometry, material));

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
