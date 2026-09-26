import {ellipsoid, alphaAt, over, toSRGB} from './splat-math.mjs';

const defaults = {size:1, stretch:2, yaw:35, roll:20, opacity:.65, count:4};
const inputs = Object.fromEntries(Object.keys(defaults).map(key => [key, document.querySelector(`#lab-${key}`)]));
const reverse = document.querySelector('#lab-reverse');
const canvases = ['space','projection','composite'].map(key => document.querySelector(`#lab-${key}`));
const colors = [[.06,.42,.8],[.06,.75,.38],[1,.46,.09],[.8,.07,.3],[.42,.2,.86],[.1,.72,.75],[.85,.75,.1]];
let pending = false;

function ellipseOutline(ctx, covariance, center, pixels) {
  const [xx, xy, yy] = covariance;
  const trace = xx + yy;
  const spread = Math.sqrt((xx - yy) ** 2 + 4 * xy ** 2);
  const major = Math.sqrt((trace + spread) / 2) * pixels;
  const minor = Math.sqrt((trace - spread) / 2) * pixels;
  // Screen coordinates invert y, hence the negative rotation angle.
  const angle = -.5 * Math.atan2(2 * xy, xx - yy);
  ctx.save(); ctx.setLineDash([4,4]); ctx.strokeStyle = '#d7f6ff99';
  ctx.beginPath(); ctx.ellipse(center[0], center[1], major, minor, angle, 0, 2*Math.PI); ctx.stroke(); ctx.restore();
}

function renderPixels(canvas, state, model, composite) {
  const ctx = canvas.getContext('2d');
  const {width:w, height:h} = canvas;
  const image = ctx.createImageData(w,h);
  const pixels = 30;
  const layers = Array.from({length:composite ? state.count : 1}, (_, i) => {
    const phase = i * 2.39996;
    const radius = i === 0 ? 0 : .7;
    return {x:Math.cos(phase)*radius, y:Math.sin(phase)*radius, color:colors[i]};
  });
  if (reverse.checked && composite) layers.reverse();
  let centerAlpha = 0;
  for (const layer of layers) {
    const alpha = alphaAt(-layer.x,-layer.y,model.covariance,state.opacity);
    centerAlpha = alpha + centerAlpha * (1-alpha);
  }
  for (let y=0; y<h; y++) for(let x=0; x<w; x++) {
    const tile = (Math.floor(x/20)+Math.floor(y/20))%2;
    let rgb = tile ? [.022,.032,.047] : [.012,.019,.03];
    for(const layer of layers) {
      const alpha = alphaAt((x-w/2)/pixels-layer.x, (h/2-y)/pixels-layer.y, model.covariance, state.opacity);
      rgb = over(layer.color, alpha, rgb);
    }
    const offset = (y*w+x)*4;
    for(let c=0;c<3;c++) image.data[offset+c]=Math.round(toSRGB(rgb[c])*255);
    image.data[offset+3]=255;
  }
  ctx.putImageData(image,0,0);
  if(!composite) ellipseOutline(ctx,model.covariance,[w/2,h/2],pixels);
  ctx.fillStyle='#a7b0bf'; ctx.font='12px sans-serif';
  ctx.fillText(composite ? (reverse.checked ? '前后顺序：已反转' : '蓝 → 绿 → 橙 → …（后 → 前）') : '虚线：1σ 等值线',14,h-15);
  return centerAlpha;
}

function drawSpace(canvas, model) {
  const ctx=canvas.getContext('2d'); const {width:w,height:h}=canvas;
  ctx.clearRect(0,0,w,h);
  const project = p => [w/2 + 29*(p[0]+p[2]*.55),h/2-29*(p[1]+p[2]*.32)];
  const transform = p => model.rotation.map(row=>row.reduce((s,v,k)=>s+v*p[k],0));
  // Display the image plane in an oblique technical drawing. This is a
  // visualization of the orthographic projection, not another camera render.
  const corners=[[-3,-2,-2],[3,-2,-2],[3,2,-2],[-3,2,-2]].map(project);
  ctx.beginPath(); corners.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();
  ctx.fillStyle='#34dff20b';ctx.fill();ctx.strokeStyle='#34dff250';ctx.stroke();
  ctx.fillStyle='#a7b0bf';ctx.font='12px sans-serif';ctx.fillText('屏幕平面',corners[0][0],corners[0][1]+20);
  const lines=[];
  for(let ring=0;ring<7;ring++) {
    const longitude=ring*Math.PI/7;
    const points=[];
    for(let step=0;step<=80;step++) {
      const t=step/80*2*Math.PI;
      points.push(transform([model.sigma[0]*Math.cos(t),model.sigma[1]*Math.sin(t)*Math.cos(longitude),model.sigma[2]*Math.sin(t)*Math.sin(longitude)]));
    }
    lines.push(points);
  }
  for(const points of lines) {
    ctx.beginPath();points.map(project).forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));
    ctx.strokeStyle='#b7f05b99';ctx.lineWidth=1.1;ctx.stroke();
  }
  ctx.setLineDash([3,5]);ctx.strokeStyle='#34dff27a';
  for(const sign of [-1,1]) {
    const p=transform([sign*model.sigma[0],0,0]);
    ctx.beginPath();ctx.moveTo(...project(p));ctx.lineTo(...project([p[0],p[1],-2]));ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle='#b7f05b';ctx.beginPath();ctx.arc(...project([0,0,0]),4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#a7b0bf';ctx.fillText('绿色：空间等密度轮廓 · 青色：投影方向',14,h-15);
}

function render() {
  pending=false;
  const state=Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,Number(input.value)]));
  for(const [key,value] of Object.entries(state)) {
    document.querySelector(`#value-${key}`).textContent = key==='count' ? `${value} 颗` : ['yaw','roll'].includes(key) ? `${value}°` : key==='opacity' ? `${Math.round(value*100)}%` : `${value.toFixed(2)}×`;
  }
  const model=ellipsoid(state.size,state.stretch,state.yaw,state.roll);
  drawSpace(canvases[0],model);
  renderPixels(canvases[1],state,model,false);
  const combined=renderPixels(canvases[2],state,model,true);
  document.querySelector('#lab-stat').textContent=`中心累计不透明度 ${(combined*100).toFixed(1)}%`;
}
function schedule(){if(!pending){pending=true;requestAnimationFrame(render);}}
Object.values(inputs).forEach(input=>input.addEventListener('input',schedule));
reverse.addEventListener('change',schedule);
document.querySelector('#lab-reset').addEventListener('click',()=>{
  for(const [key,value] of Object.entries(defaults)) inputs[key].value=value;
  reverse.checked=false;schedule();
});
render();

// Reuse the existing full-scene viewer. Moving its root keeps one PLY,
// one GPU scene and the existing keyboard/mouse controller alive.
const horsePanel = document.querySelector('#horse-lab');
const syntheticPanel = document.querySelector('#synthetic-lab');
const stage = document.querySelector('#gaussian-stage');
const originalParent = stage.parentElement;
const returnNotice = document.createElement('div');
returnNotice.className = 'explore-return';
returnNotice.hidden = true;
returnNotice.innerHTML = '<p>马匹场景正在上方的高斯实验中显示。两个章节共用同一个场景。</p><button type="button" class="button" id="return-explore">在这里继续自由探索</button>';
stage.after(returnNotice);
const horseSize = document.querySelector('#horse-size');
const horseOpacity = document.querySelector('#horse-opacity');
const horsePoints = document.querySelector('#horse-points');
let horseMode = false;
function updateHorse() {
  document.querySelector('#horse-size-value').textContent = `${Number(horseSize.value).toFixed(2)}×`;
  document.querySelector('#horse-opacity-value').textContent = `${Math.round(Number(horseOpacity.value)*100)}%`;
  if (horseMode) window.dispatchEvent(new CustomEvent('gaussian-appearance', {detail:{
    size:Number(horseSize.value), opacity:Number(horseOpacity.value), points:horsePoints.checked
  }}));
}
function selectMode(horse) {
  horseMode = horse;
  horsePanel.hidden = !horse;
  syntheticPanel.hidden = horse;
  for (const [id,selected] of [['mode-horse',horse],['mode-synthetic',!horse]]) {
    const button=document.querySelector(`#${id}`);
    button.classList.toggle('primary',selected);
    button.setAttribute('aria-pressed',String(selected));
  }
  document.querySelector('.lab-tag').textContent = horse ? '真实 PLY · 118 万高斯 · 实际渲染参数' : '正交投影原理实验 · 非真实 PLY';
  document.querySelector('.lab-top p').textContent = horse ? '缩小颗粒看缝隙，放大看融合；降低透明度，观察百万高斯如何叠成画面。' : '先改变空间转向，观察投影面积；再调透明度和数量，观察重叠区域。';
  document.querySelector('#gaussian-lab > .wrap > .note').hidden = horse;
  returnNotice.hidden = !horse;
  if (horse) {
    document.querySelector('#horse-viewer-host').append(stage);
    updateHorse();
    window.dispatchEvent(new Event('gaussian-lab-load'));
  } else {
    originalParent.insertBefore(stage,returnNotice);
    window.dispatchEvent(new CustomEvent('gaussian-appearance',{detail:{size:1,opacity:1,points:false}}));
    window.dispatchEvent(new Event('resize'));
  }
}
document.querySelector('#mode-horse').addEventListener('click',()=>selectMode(true));
document.querySelector('#mode-synthetic').addEventListener('click',()=>selectMode(false));
document.querySelector('#return-explore').addEventListener('click',()=>{
  selectMode(false); stage.scrollIntoView({block:'center'}); stage.focus();
});
horseSize.addEventListener('input',updateHorse);
horseOpacity.addEventListener('input',updateHorse);
horsePoints.addEventListener('change',updateHorse);
for(const button of document.querySelectorAll('[data-horse-preset]')) {
  button.addEventListener('click',()=>{
    const presets={original:[1,1],grains:[.25,1],soft:[1.7,1],transparent:[1,.15]};
    [horseSize.value,horseOpacity.value]=presets[button.dataset.horsePreset];
    horsePoints.checked=false;updateHorse();
  });
}
