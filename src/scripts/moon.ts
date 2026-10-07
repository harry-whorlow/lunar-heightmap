import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadHeightMap, MoonGeometry } from "./moon-geometry";

const canvas = document.querySelector<HTMLCanvasElement>("#moon-canvas");
const exaggerationInput = document.querySelector<HTMLInputElement>("#exaggeration");
const exaggerationValue = document.querySelector<HTMLOutputElement>("#exaggeration-value");

if (canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(0, 0, 4);
  scene.add(camera);

  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.position.set(5, 2, -3);
  camera.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.08));

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
  const material = new THREE.MeshStandardMaterial({ color: 0xb8b5ad, roughness: 1, metalness: 0 });
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
}
