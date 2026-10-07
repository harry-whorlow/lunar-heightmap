import * as THREE from "three";

const ARROWS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

export interface CameraRigOptions {
  position: THREE.Vector3;
  target: THREE.Vector3;
  minRadius: number;
  maxRadius: number;
  returnRate?: number;
}

export interface CameraRig {
  setFree(free: boolean): void;
  setDistance(distance: number): void;
  update(dt: number): void;
}

export function createCameraRig(
  camera: THREE.PerspectiveCamera,
  { position, target, minRadius, maxRadius, returnRate = 4 }: CameraRigOptions,
): CameraRig {
  const homeDirection = position.clone().normalize();
  const homeDistance = position.length();
  const homePosition = position.clone();
  const homeQuaternion = new THREE.Quaternion();
  const origin = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const pose = new THREE.Camera();

  const setHome = (distance: number) => {
    homePosition.copy(homeDirection).multiplyScalar(distance);
    const t = THREE.MathUtils.clamp(
      (distance - homeDistance) / (maxRadius - homeDistance),
      0,
      1,
    );
    aim.lerpVectors(target, origin, t);
    pose.position.copy(homePosition);
    pose.lookAt(aim);
    homeQuaternion.copy(pose.quaternion);
  };
  setHome(homeDistance);
  camera.position.copy(homePosition);
  camera.quaternion.copy(homeQuaternion);

  const held = new Set<string>();
  let free = false;
  let shift = false;

  const ignore = (event: KeyboardEvent) =>
    event.target instanceof HTMLSelectElement ||
    (event.target instanceof HTMLInputElement && event.target.type === "range");

  window.addEventListener("keydown", (event) => {
    shift = event.shiftKey;
    if (!free || !ARROWS.includes(event.key) || ignore(event)) return;
    event.preventDefault();
    held.add(event.key);
  });
  window.addEventListener("keyup", (event) => {
    shift = event.shiftKey;
    held.delete(event.key);
  });
  window.addEventListener("blur", () => held.clear());

  const axis = (positive: string, negative: string) =>
    (held.has(positive) ? 1 : 0) - (held.has(negative) ? 1 : 0);

  return {
    setFree(value) {
      free = value;
      held.clear();
    },

    setDistance(distance) {
      const d = THREE.MathUtils.clamp(distance, minRadius, maxRadius);
      setHome(d);
      if (free) camera.position.setLength(d);
    },

    update(dt) {
      if (!free) {
        const t = 1 - Math.exp(-returnRate * dt);
        camera.position.lerp(homePosition, t);
        camera.quaternion.slerp(homeQuaternion, t);
        return;
      }

      const speed = Math.max(0.05, camera.position.length() - 1) * dt;
      const vertical = axis("ArrowUp", "ArrowDown");
      camera.translateX(axis("ArrowRight", "ArrowLeft") * speed);
      if (shift) camera.translateZ(-vertical * speed);
      else camera.translateY(vertical * speed);

      const radius = camera.position.length();
      if (radius < minRadius) camera.position.setLength(minRadius);
      else if (radius > maxRadius) camera.position.setLength(maxRadius);
    },
  };
}
