import * as THREE from "three";

const canvas = document.querySelector<HTMLCanvasElement>("#moon-canvas");

if (canvas) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 5.8);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const moon = new THREE.Group();
  scene.add(moon);

  const geometry = new THREE.SphereGeometry(1.22, 160, 160);
  const positions = geometry.getAttribute("position");
  const craters = [
    { x: -0.38, y: 0.68, z: 0.62, radius: 0.17, depth: 0.047 },
    { x: 0.2, y: 0.35, z: 0.91, radius: 0.13, depth: 0.038 },
    { x: 0.7, y: -0.08, z: 0.71, radius: 0.2, depth: 0.055 },
    { x: -0.73, y: -0.16, z: 0.66, radius: 0.11, depth: 0.033 },
    { x: -0.14, y: -0.65, z: 0.74, radius: 0.15, depth: 0.043 },
    { x: 0.4, y: -0.68, z: 0.61, radius: 0.09, depth: 0.027 },
    { x: -0.71, y: 0.62, z: 0.32, radius: 0.08, depth: 0.024 },
  ].map((crater) => ({
    ...crater,
    direction: new THREE.Vector3(crater.x, crater.y, crater.z).normalize(),
  }));

  for (let index = 0; index < positions.count; index += 1) {
    const direction = new THREE.Vector3(
      positions.getX(index),
      positions.getY(index),
      positions.getZ(index),
    ).normalize();
    let elevation =
      Math.sin(direction.x * 31 + direction.z * 17) * 0.002 +
      Math.sin(direction.y * 43 - direction.x * 21) * 0.0015;

    for (const crater of craters) {
      const distance = direction.angleTo(crater.direction);
      if (distance < crater.radius) {
        const craterShape = 1 - distance / crater.radius;
        const rim = Math.exp(-((distance - crater.radius * 0.82) ** 2) / 0.001);
        elevation += -crater.depth * craterShape ** 2 + rim * crater.depth * 0.22;
      }
    }

    positions.setXYZ(
      index,
      direction.x * (1.22 + elevation),
      direction.y * (1.22 + elevation),
      direction.z * (1.22 + elevation),
    );
  }
  geometry.computeVertexNormals();

  const surface = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: 0xbdbbb4,
      roughness: 0.94,
      metalness: 0,
    }),
  );
  moon.add(surface);

  scene.add(new THREE.AmbientLight(0x66718a, 1.25));
  const sunlight = new THREE.DirectionalLight(0xffe4bd, 3.4);
  sunlight.position.set(-3, 2, 4);
  scene.add(sunlight);

  const starPositions = new Float32Array(450 * 3);
  for (let index = 0; index < starPositions.length; index += 3) {
    starPositions[index] = (Math.random() - 0.5) * 12;
    starPositions[index + 1] = (Math.random() - 0.5) * 8;
    starPositions[index + 2] = -2 - Math.random() * 8;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(starPositions, 3),
  );
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0xc6ccda,
      size: 0.012,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    }),
  );
  scene.add(stars);

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(bounds.width, 1);
    const height = Math.max(bounds.height, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  let targetRotationX = 0;
  let targetRotationY = -0.25;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  let dragging = false;
  let previousX = 0;
  let previousY = 0;

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    previousX = event.clientX;
    previousY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    targetRotationY += (event.clientX - previousX) * 0.005;
    targetRotationX += (event.clientY - previousY) * 0.005;
    targetRotationX = THREE.MathUtils.clamp(targetRotationX, -0.8, 0.8);
    previousX = event.clientX;
    previousY = event.clientY;
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
  });
  canvas.addEventListener("pointercancel", () => {
    dragging = false;
  });

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const animate = () => {
    moon.rotation.x += (targetRotationX - moon.rotation.x) * 0.06;
    moon.rotation.y += (targetRotationY - moon.rotation.y) * 0.06;
    if (!dragging && !reduceMotion) targetRotationY += 0.0007;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  animate();
}
