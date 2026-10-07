import * as THREE from "three";

export interface SpinControlsOptions {
  radiansPerPixel?: number;
  damping?: number;
  autoSpeed?: number;
}

export interface SpinControls {
  update(dt: number): void;
}

export function createSpinControls(
  object: THREE.Object3D,
  camera: THREE.Camera,
  element: HTMLElement,
  {
    radiansPerPixel = 0.005,
    damping = 4,
    autoSpeed = 0,
  }: SpinControlsOptions = {},
): SpinControls {
  const velocity = new THREE.Vector2();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastTime = 0;

  const rotate = (dx: number, dy: number) => {
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    object.quaternion.premultiply(turn.setFromAxisAngle(up, dx));
    object.quaternion.premultiply(turn.setFromAxisAngle(right, dy));
  };

  element.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = event.timeStamp;
    velocity.set(0, 0);
    element.setPointerCapture(event.pointerId);
    element.classList.add("dragging");
  });

  element.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const dx = (event.clientX - lastX) * radiansPerPixel;
    const dy = (event.clientY - lastY) * radiansPerPixel;
    const dt = Math.max((event.timeStamp - lastTime) / 1000, 1 / 240);
    rotate(dx, dy);
    velocity.set(dx / dt, dy / dt);
    lastX = event.clientX;
    lastY = event.clientY;
    lastTime = event.timeStamp;
  });

  const release = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (event.timeStamp - lastTime > 80) velocity.set(0, 0);
    element.classList.remove("dragging");
  };
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);

  return {
    update(dt) {
      if (dragging) return;
      rotate(velocity.x * dt, (velocity.y + autoSpeed) * dt);
      if (velocity.lengthSq() < 1e-6) return;
      velocity.multiplyScalar(Math.exp(-damping * dt));
    },
  };
}
