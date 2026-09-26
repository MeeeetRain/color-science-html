import * as THREE from 'three';
import {loadModelParts} from './model-parts.mjs';

const stage = document.querySelector('#gaussian-stage');
const placeholder = document.querySelector('#viewer-placeholder');
const loadButton = document.querySelector('#load-scene');
const status = document.querySelector('#viewer-status');
const hud = document.querySelector('#viewer-hud');
const mobilePad = document.querySelector('#mobile-pad');
const shell = document.querySelector('#viewer-shell');
const expandButton = document.querySelector('#expand-view');
const touchLayout = window.matchMedia('(any-pointer: coarse), (max-width: 800px)');
const mobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const usesTouchControls = () => mobileDevice || touchLayout.matches;
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
let dragPointer;
let pointerX = 0;
let pointerY = 0;
let lastTime = 0;
let moveFrame = 0;
let active = false;
let loading = false;
let appearance = {size:1, opacity:1, points:false};
const touchPointers = new Map();
let savedBodyOverflow;

function updateTouchLayout() {
  const touch = usesTouchControls();
  document.documentElement.classList.toggle('touch-view', touch);
  mobilePad.hidden = !active || !touch;
  if (!touch) setExpanded(false);
}
touchLayout.addEventListener('change', updateTouchLayout);
updateTouchLayout();

function setExpanded(expanded) {
  if (expanded === shell.classList.contains('is-expanded')) return;
  if (expanded) savedBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = expanded ? 'hidden' : savedBodyOverflow;
  shell.classList.toggle('is-expanded', expanded);
  expandButton.setAttribute('aria-pressed', String(expanded));
  const label = expanded ? '退出大画面' : '展开画面';
  expandButton.setAttribute('aria-label', label);
  expandButton.title = label;
  expandButton.querySelector('img').src = `assets/photo-3dgs/icons/${expanded ? 'minimize' : 'maximize'}.svg`;
  clearMovement();
  resizeCamera();
}

function clearMovement() {
  keys.clear();
  touchMoves.clear();
  touchPointers.clear();
  dragging = false;
  dragPointer = undefined;
  for (const button of mobilePad.querySelectorAll('[data-move]')) button.setAttribute('aria-pressed', 'false');
}
// The original lossless PLY remains available for A/B and rollback.
const useCompressed = new URLSearchParams(location.search).get('asset') !== 'original';

async function compressedModel() {
  setStatus('下载压缩模型（23.45 MiB）…');
  const response = await fetch(new URL('horse-sharp.ksplat.shuf4.gz',import.meta.url));
  if (!response.ok) throw new Error(`模型下载失败 HTTP ${response.status}`);
  if (!window.DecompressionStream) throw new Error('浏览器不支持 gzip 解码，请升级浏览器。');
  const reader = response.body.pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks=[];let length=0;
  for (;;) {
    const {done,value}=await reader.read();if(done)break;
    length+=value.length;
    if(length>28421404){await reader.cancel();throw new Error('压缩模型尺寸异常');}
    chunks.push(value);
  }
  if(length!==28421404)throw new Error('压缩模型不完整');
  const shuffled=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){shuffled.set(chunk,offset);offset+=chunk.length;}
  const raw=new Uint8Array(length),n=length/4;
  for(let i=0;i<n;i++)for(let j=0;j<4;j++)raw[i*4+j]=shuffled[j*n+i];
  return new Blob([raw],{type:'application/octet-stream'});
}
if(new URLSearchParams(location.search).has('ab')) {
  window.addEventListener('gaussian-test-pose',event=>{
    const p=event.detail;camera.position.set(...p.position);yaw=p.yaw;pitch=p.pitch;
    updateCameraOrientation();viewer?.forceRenderNextFrame();
  });
}

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
  clearMovement();
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
  let modelURL;
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
    const model = useCompressed ? await compressedModel() : await loadModelParts(new URL('horse-sharp.manifest.json', import.meta.url), percentage => {
      setStatus(`加载模型 ${Math.round(percentage)}%`);
    });
    modelURL = URL.createObjectURL(model);
    await viewer.addSplatScene(modelURL, {
      format: useCompressed ? GaussianSplats3D.SceneFormat.KSplat : GaussianSplats3D.SceneFormat.Ply,
      // SHARP's camera is OpenCV (+x right, +y down, +z forward).
      // Rotate the whole scene into Three.js (+y up, -z forward).
      rotation: [1, 0, 0, 0],
      progressiveLoad: false,
      showLoadingUI: false,
      onProgress: (percentage, _label, phase) => {
        setStatus(`${phase === 1 ? '处理高斯' : '读取模型'} ${Math.round(percentage)}%`);
      }
    });
    viewer.start();
    resetView();
    placeholder.hidden = true;
    hud.style.display = 'flex';
    active = true;
    stage.dataset.ready = 'true';
    updateTouchLayout();
    setStatus(usesTouchControls() ? '场景已就绪' : '已就绪 · 鼠标拖动转向，WASD 自由移动');
    applyAppearance();
    lastTime = performance.now();
    moveFrame = requestAnimationFrame(animateMovement);
    stage.focus({preventScroll: true});
    new ResizeObserver(resizeCamera).observe(stage);
  } catch (error) {
    console.error('3DGS 场景加载失败', error);
    setStatus(`加载失败：${error?.message || String(error)}`);
    loadButton.disabled = false;
    loadButton.textContent = '重试加载 3DGS';
    if (viewer) { await viewer.dispose(); viewer = undefined; }
  } finally {
    if (modelURL) URL.revokeObjectURL(modelURL);
    loading = false;
  }
}

loadButton.addEventListener('click', loadScene);
document.querySelector('#reset-view').addEventListener('click', resetView);
document.querySelector('#reset-view-mobile').addEventListener('click', resetView);
expandButton.addEventListener('click', () => setExpanded(!shell.classList.contains('is-expanded')));
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') setExpanded(false);
});
document.querySelector('#speed-down').addEventListener('click', () => updateSpeed(.75));
document.querySelector('#speed-up').addEventListener('click', () => updateSpeed(1.333));

stage.addEventListener('pointerdown', (event) => {
  if (!active || dragging || event.button !== 0 || event.target.closest('button')) return;
  dragging = true;
  dragPointer = event.pointerId;
  pointerX = event.clientX;
  pointerY = event.clientY;
  stage.setPointerCapture(event.pointerId);
  stage.focus({preventScroll: true});
});
stage.addEventListener('pointermove', (event) => {
  if (!dragging || event.pointerId !== dragPointer) return;
  yaw -= (event.clientX - pointerX) * .003;
  pitch = Math.max(-1.4, Math.min(1.4, pitch - (event.clientY - pointerY) * .003));
  pointerX = event.clientX;
  pointerY = event.clientY;
  updateCameraOrientation();
  viewer?.forceRenderNextFrame();
});
function endDrag(event) {
  if (event.pointerId === dragPointer) { dragging = false; dragPointer = undefined; }
}
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('lostpointercapture', endDrag);
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
function syncTouchMoves() {
  touchMoves.clear();
  for (const direction of touchPointers.values()) touchMoves.add(direction);
  for (const button of mobilePad.querySelectorAll('[data-move]')) {
    button.setAttribute('aria-pressed', String(touchMoves.has(button.dataset.move)));
  }
}
for (const button of mobilePad.querySelectorAll('[data-move]')) {
  button.addEventListener('pointerdown', (event) => {
    if (!active || event.button !== 0) return;
    event.preventDefault();
    touchPointers.set(event.pointerId, button.dataset.move);
    syncTouchMoves();
    button.setPointerCapture(event.pointerId);
  });
  const stop = event => { touchPointers.delete(event.pointerId); syncTouchMoves(); };
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('lostpointercapture', stop);
}
window.addEventListener('blur', clearMovement);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearMovement(); });
window.addEventListener('pagehide', () => {
  clearMovement();
  setExpanded(false);
  active = false;
  cancelAnimationFrame(moveFrame);
  viewer?.dispose();
});
