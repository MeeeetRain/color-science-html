import * as THREE from 'three';

const stage = document.querySelector('#gaussian-stage');
const placeholder = document.querySelector('#viewer-placeholder');
const loadButton = document.querySelector('#load-scene');
const status = document.querySelector('#viewer-status');
const hud = document.querySelector('#viewer-hud');
const mobilePad = document.querySelector('#mobile-pad');
const speedLabel = document.querySelector('#speed-label');

const camera = new THREE.PerspectiveCamera(
  2 * Math.atan(4284 / (2 * 3960.5593)) * 180 / Math.PI,
  1, 0.05, 500
);
const origin = new THREE.Vector3(0, 0, 0);
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const keys = new Set();
const touchMoves = new Set();
let viewer;
let yaw = 0;
let pitch = 0;
let speed = 1;
let dragging = false;
let pointerX = 0;
let pointerY = 0;
let lastTime = 0;
let moveFrame = 0;
let active = false;
let loading = false;
let appearance = {size:1, opacity:1, points:false};

function applyAppearance() {
  if (!active || !viewer?.splatMesh) return;
  viewer.splatMesh.setSplatScale(appearance.size);
  viewer.splatMesh.getScene(0).opacity = appearance.opacity;
  viewer.splatMesh.setPointCloudModeEnabled(appearance.points);
  viewer.forceRenderNextFrame();
}
window.addEventListener('gaussian-appearance', event => {
  appearance = event.detail;
  applyAppearance();
});
window.addEventListener('gaussian-lab-load', () => {
  resizeCamera();
  if (!active && !loading) loadScene();
});

function setStatus(message, hidden = false) {
  status.textContent = message;
  status.hidden = hidden;
}

function updateCameraOrientation() {
  camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  camera.updateMatrixWorld();
}

function resetView() {
  camera.position.copy(origin);
  yaw = 0;
  pitch = 0;
  updateCameraOrientation();
  viewer?.forceRenderNextFrame();
}

function resizeCamera() {
  camera.aspect = Math.max(1, stage.clientWidth) / Math.max(1, stage.clientHeight);
  camera.updateProjectionMatrix();
  viewer?.forceRenderNextFrame();
}

function updateSpeed(factor) {
  speed = Math.min(8, Math.max(.15, speed * factor));
  speedLabel.textContent = `速度 ${speed.toFixed(1)}×`;
}

function animateMovement(time) {
  if (!active) return;
  const delta = Math.min(.05, Math.max(0, (time - lastTime) / 1000));
  lastTime = time;
  camera.getWorldDirection(forward).normalize();
  right.crossVectors(forward, up).normalize();
  // The closest visible splats are only ~1.7 scene units from the source
  // camera. A conventional 1-unit/s fly speed crosses them almost instantly.
  const stride = delta * .22 * speed * (keys.has('shift') ? 3 : 1);
  const directions = [
    [keys.has('w') || keys.has('arrowup') || touchMoves.has('forward'), forward, 1],
    [keys.has('s') || keys.has('arrowdown') || touchMoves.has('back'), forward, -1],
    [keys.has('d') || keys.has('arrowright') || touchMoves.has('right'), right, 1],
    [keys.has('a') || keys.has('arrowleft') || touchMoves.has('left'), right, -1],
    [keys.has('e'), up, 1], [keys.has('q'), up, -1]
  ];
  let changed = false;
  for (const [pressed, vector, sign] of directions) {
    if (!pressed) continue;
    camera.position.addScaledVector(vector, stride * sign);
    changed = true;
  }
  // A single photo does not establish a valid 360° scene. Bound navigation
  // around its source camera so a held key cannot fly behind the near splats.
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -1.2, 1.2);
  camera.position.y = THREE.MathUtils.clamp(camera.position.y, -.8, .8);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -.8, .8);
  if (changed) viewer?.forceRenderNextFrame();
  moveFrame = requestAnimationFrame(animateMovement);
}

async function loadScene() {
  if (active || loading) return;
  loading = true;
  loadButton.disabled = true;
  setStatus('正在初始化 WebGL…');
  try {
    if (!document.createElement('canvas').getContext('webgl2')) {
      throw new Error('浏览器或显卡未提供 WebGL 2。');
    }
    const GaussianSplats3D = await import('./lib/gaussian-splats-3d.module.js');
    resizeCamera();
    viewer = new GaussianSplats3D.Viewer({
      rootElement: stage,
      camera,
      selfDrivenMode: true,
      useBuiltInControls: false,
      enableOptionalEffects: true,
      ignoreDevicePixelRatio: true,
      halfPrecisionCovariancesOnGPU: true,
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort: false,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
      renderMode: GaussianSplats3D.RenderMode.OnChange,
      maxScreenSpaceSplatSize: 160
    });
    setStatus('正在读取 3DGS 模型…');
    await viewer.addSplatScene('assets/photo-3dgs/horse-sharp.ply', {
      // SHARP's camera is OpenCV (+x right, +y down, +z forward).
      // Rotate the whole scene into Three.js (+y up, -z forward).
      rotation: [1, 0, 0, 0],
      progressiveLoad: false,
      showLoadingUI: false,
      onProgress: (percentage, _label, phase) => {
        setStatus(`${phase === 1 ? '处理高斯' : '加载模型'} ${Math.round(percentage)}%`);
      }
    });
    viewer.start();
    resetView();
    placeholder.hidden = true;
    hud.style.display = 'flex';
    mobilePad.hidden = false;
    setStatus('已就绪 · 鼠标拖动转向，WASD 自由移动');
    active = true;
    applyAppearance();
    lastTime = performance.now();
    moveFrame = requestAnimationFrame(animateMovement);
    stage.focus();
    new ResizeObserver(resizeCamera).observe(stage);
  } catch (error) {
    console.error('3DGS 场景加载失败', error);
    setStatus(`加载失败：${error?.message || String(error)}`);
    loadButton.disabled = false;
    loadButton.textContent = '重试加载 3DGS';
    if (viewer) { await viewer.dispose(); viewer = undefined; }
  } finally {
    loading = false;
  }
}

loadButton.addEventListener('click', loadScene);
document.querySelector('#reset-view').addEventListener('click', resetView);
document.querySelector('#speed-down').addEventListener('click', () => updateSpeed(.75));
document.querySelector('#speed-up').addEventListener('click', () => updateSpeed(1.333));

stage.addEventListener('pointerdown', (event) => {
  if (!active || event.target.closest('button')) return;
  dragging = true;
  pointerX = event.clientX;
  pointerY = event.clientY;
  stage.setPointerCapture(event.pointerId);
  stage.focus();
});
stage.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  yaw -= (event.clientX - pointerX) * .003;
  pitch = Math.max(-1.4, Math.min(1.4, pitch - (event.clientY - pointerY) * .003));
  pointerX = event.clientX;
  pointerY = event.clientY;
  updateCameraOrientation();
  viewer?.forceRenderNextFrame();
});
stage.addEventListener('pointerup', () => { dragging = false; });
stage.addEventListener('pointercancel', () => { dragging = false; });
stage.addEventListener('wheel', (event) => {
  if (!active) return;
  event.preventDefault();
  updateSpeed(event.deltaY > 0 ? .85 : 1.18);
}, {passive: false});
stage.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if ('wasdqer'.includes(key) || key.startsWith('arrow') || key === 'shift') {
    event.preventDefault();
    if (key === 'r') resetView();
    else keys.add(key);
  }
});
stage.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
stage.addEventListener('blur', () => keys.clear());
for (const button of mobilePad.querySelectorAll('button')) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    touchMoves.add(button.dataset.move);
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointerup', () => touchMoves.delete(button.dataset.move));
  button.addEventListener('pointercancel', () => touchMoves.delete(button.dataset.move));
}
window.addEventListener('pagehide', () => {
  active = false;
  cancelAnimationFrame(moveFrame);
  viewer?.dispose();
});
