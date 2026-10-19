(function(){
const INFO={machine:['Тяговая лебёдка','Мотор, редуктор и канатоведущий шкив — поднимают и опускают кабину.'],cabinet:['Шкаф управления','Платы и привод — «мозг» лифта: движение, двери, вызовы.'],governor:['Ограничитель скорости','Следит за скоростью кабины через свой канат и при превышении включает ловители.'],ropes:['Тяговые канаты','Держат кабину и противовес, перекинуты через шкив лебёдки.'],car:['Кабина','Кабина в раме-купе с башмаками и ловителями, двери открываются вместе с дверьми шахты.'],rails:['Направляющие','Стальные рельсы по всей высоте шахты — по ним скользят башмаки.'],counterweight:['Противовес','Уравновешивает кабину и движется ей навстречу.'],buffers:['Буферы','Пружинные упоры в приямке — последняя ступень безопасности.'],landing_doors:['Двери шахты','На каждом этаже; замки и контакты — частая причина остановок.']};
const SHOP={machine:'enkodery',cabinet:'platy-upravleniya',governor:'vyklyuchateli',ropes:'kanaty',car:'knopki-i-posty',rails:'bashmaki',counterweight:'bashmaki',buffers:'drugoe',landing_doors:'vyklyuchateli'};
const ORDER=['machine','cabinet','governor','ropes','landing_doors','car','counterweight','rails','buffers'];
const host=document.getElementById('l3d'); if(!host) return; const DARK=host.dataset.theme==='dark'; const INK=DARK?0xE8D9B5:0x1E4A3F, CREAM=DARK?0x3E4127:0xF3E9D6, HI=DARK?0xF2C230:0xA3271F;
const v3=h=>`vec3(${((h>>16)&255)/255},${((h>>8)&255)/255},${(h&255)/255})`;
const cv=host.querySelector('canvas'); const RR=document.currentScript?document.currentScript.dataset.r:'';
const R=new THREE.WebGLRenderer({canvas:cv,antialias:true}); R.setPixelRatio(Math.min(2,devicePixelRatio)); R.setClearColor(CREAM);
const S=new THREE.Scene(); const C=new THREE.PerspectiveCamera(30,1,.1,200);
const ctl=new THREE.OrbitControls(C,cv); ctl.enablePan=true; ctl.screenSpacePanning=true; ctl.panSpeed=.8; ctl.enableDamping=true; ctl.dampingFactor=.08; ctl.autoRotate=true; ctl.autoRotateSpeed=.6; ctl.enablePan=false; ctl.enableZoom=false; ctl.minPolarAngle=.05; ctl.maxPolarAngle=1.75;
let viewAnim=null;
ctl.addEventListener('start',()=>{ctl.autoRotate=false; viewAnim=null; setView(null);});
const parts={}, pts=[], hulls={}; let carNode,cwNode,carBase,cwBase;
const off={polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1};
const fill=new THREE.MeshBasicMaterial({color:CREAM,...off});
const hatch=(dens,alpha)=>new THREE.ShaderMaterial({...off,uniforms:{a:{value:alpha}},vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform float a;void main(){float s=mod(gl_FragCoord.x+gl_FragCoord.y,${dens.toFixed(1)});vec3 cr=${v3(CREAM)},ik=${v3(INK)};gl_FragColor=vec4(s<1.2?mix(cr,ik,a):cr,1.);}`});
const hatchCar=hatch(7,.38), hatchCw=hatch(4.5,.5);
const lineMat=()=>new THREE.LineBasicMaterial({color:INK});
const hullMat=new THREE.MeshBasicMaterial({color:INK,side:THREE.BackSide});
const keyOf=o=>{let n=o.name||'',p=o.parent;while(!Object.keys(INFO).concat(['shaft']).some(k=>n.startsWith(k))&&p){n=p.name||'';p=p.parent;}return Object.keys(INFO).concat(['shaft']).find(k=>n.startsWith(k))||'shaft';};
function addHull(mesh,key,t){
  const g=mesh.geometry; g.computeBoundingBox(); const s=g.boundingBox.getSize(new THREE.Vector3());
  const h=new THREE.Mesh(g,hullMat.clone()); h.scale.set((s.x+2*t)/Math.max(s.x,1e-4),(s.y+2*t)/Math.max(s.y,1e-4),(s.z+2*t)/Math.max(s.z,1e-4));
  const c=g.boundingBox.getCenter(new THREE.Vector3()); h.position.copy(c).multiplyScalar(1).sub(c.clone().multiply(h.scale)); mesh.add(h); (hulls[key]=hulls[key]||[]).push(h);
}
function addLines(obj,geom,key,thr,dashed){
  const eg=new THREE.EdgesGeometry(geom,thr);
  const lm=dashed?new THREE.LineDashedMaterial({color:INK,dashSize:.07,gapSize:.05}):lineMat();
  const ln=new THREE.LineSegments(eg,lm); if(dashed) ln.computeLineDistances(); obj.add(ln); (parts[key]=parts[key]||[]).push(ln); return ln;
}
function box(w,h,d,x,y,z,parent,key,mat){ const g=new THREE.BoxGeometry(w,h,d); const m=new THREE.Mesh(g,mat||fill); m.position.set(x,y,z); parent.add(m); addLines(m,g,key,20); addHull(m,key,.008); return m; }
const ropeLines=[];
new THREE.GLTFLoader().load(RR+'assets/model/genilift_elevator.glb',g=>{
  const root=g.scene; S.add(root);
  const meshes=[]; root.traverse(o=>{ if(o.isMesh) meshes.push(o); });
  meshes.forEach(o=>{
    const key=keyOf(o);
    if(key==='ropes'){ o.visible=false; return; }
    const dashed=key==='landing_doors';
    addLines(o,o.geometry,key,key==='rails'?42:26,dashed);
    if(dashed||key==='shaft'){ o.material=new THREE.MeshBasicMaterial({visible:false}); return; }
    o.material=key==='car'?hatchCar:key==='counterweight'?hatchCw:fill;
    if(key!=='rails') addHull(o,key,key==='machine'||key==='cabinet'?.012:.009);
  });
  carNode=root.getObjectByName('car'); cwNode=root.getObjectByName('counterweight'); carBase=carNode.position.y; cwBase=cwNode.position.y;
  /* детали кабины: створки, рама-купе, башмаки, ловители (едут вместе с кабиной) */
  const cg=new THREE.Group(); carNode.add(cg);
  const inv=new THREE.Matrix4().copy(carNode.matrixWorld).invert(); cg.applyMatrix4(inv);
  box(.42,2.05,.03,-.215,3.55,-.885,cg,'car'); box(.42,2.05,.03,.215,3.55,-.885,cg,'car');
  box(.07,3.2,.12,-1.0,3.75,-.05,cg,'car'); box(.07,3.2,.12,1.0,3.75,-.05,cg,'car');
  box(2.07,.14,.16,0,5.38,-.05,cg,'car'); box(2.07,.14,.16,0,2.33,-.05,cg,'car');
  [[-1.0,5.2],[1.0,5.2],[-1.0,2.42],[1.0,2.42]].forEach(([x,y])=>box(.12,.16,.16,x,y,-.05,cg,'car'));
  box(.16,.22,.2,-1.0,2.18,-.05,cg,'car'); box(.16,.22,.2,1.0,2.18,-.05,cg,'car');
  /* канат ограничителя скорости — петля по всей высоте */
  const gv=new THREE.Group(); root.add(gv);
  [[-.86,.93],[-.86,.84]].forEach(([x,z])=>{ const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,.35,z),new THREE.Vector3(x,7.55,z)]); const l=new THREE.Line(geo,lineMat()); gv.add(l); (parts.governor=parts.governor||[]).push(l); });
  /* тяговые канаты — линии, длина меняется с ходом кабины */
  [-.18,-.06,.06,.18].forEach(x=>ropeLines.push({x,z:.02,top:8.12,car:true}));
  [.56,.66,.76,.86].forEach(x=>ropeLines.push({x,z:.83,top:8.12,car:false}));
  ropeLines.forEach(r=>{ const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(r.x,r.top,r.z),new THREE.Vector3(r.x,4,r.z)]); r.line=new THREE.Line(geo,new THREE.LineBasicMaterial({color:INK})); root.add(r.line); (parts.ropes=parts.ropes||[]).push(r.line); });
  const box3=__robustBox(root), ctr=box3.getCenter(new THREE.Vector3());
  window.__box=box3; C.position.set(ctr.x+1,ctr.y+.35,ctr.z+1); ctl.target.copy(ctr); fit();
  ORDER.forEach((k,i)=>{
    const objs=[]; root.traverse(o=>{ if(o.isMesh && keyOf(o)===k) objs.push(o); }); if(!objs.length) return;
    const b=new THREE.Box3(); objs.forEach(o=>b.expandByObject(o)); const p=b.getCenter(new THREE.Vector3());
    if(k==='ropes') p.set(-.12,6.6,.02); if(k==='rails') p.set(-1.0,1.4,0); if(k==='landing_doors') p.y=b.min.y+1;
    if(k==='governor') p.set(-.86,7.6,.93);
    const el=document.createElement('span'); el.className='pt'; el.textContent=i+1; host.appendChild(el);
    el.addEventListener('click',e=>{e.stopPropagation(); pick(k);});
    pts.push({k,p,el,moves:k==='car'?'car':k==='counterweight'?'cw':null,base:p.clone()});
  });
  const HI=(host.dataset.hi||'').split(',').filter(Boolean); if(HI.length){ pts.forEach(p=>p.el.classList.toggle('dim',!HI.includes(p.k)));  }
  resize(); loop();
});
const card=host.querySelector('.l3d-card'); let picked=null;
function paint(){ const H2=(host.dataset.hi||'').split(','); Object.entries(parts).forEach(([kk,ls])=>ls.forEach(l=>l.material.color.setHex(kk===picked?HI:INK))); Object.entries(hulls).forEach(([kk,hs])=>hs.forEach(h=>h.material.color.setHex(kk===picked?HI:INK))); }
function pick(k){ picked=k; paint(); pts.forEach(p=>p.el.classList.toggle('on',p.k===k)); card.querySelector('b').textContent=INFO[k][0]; card.querySelector('i').textContent=INFO[k][1]; card.querySelector('a').href=RR+'zapchasti/?cat='+(SHOP[k]||''); card.classList.add('on'); ctl.autoRotate=false; }
cv.addEventListener('click',()=>{ picked=null; paint(); card.classList.remove('on'); pts.forEach(p=>p.el.classList.remove('on')); });
/* виды */
const VIEWS={front:new THREE.Vector3(0,.12,-1),side:new THREE.Vector3(1,.12,0),top:new THREE.Vector3(.02,1,-.02),free:new THREE.Vector3(1,.35,1)};
function setView(v){ host.querySelectorAll('.views button').forEach(b=>b.classList.toggle('on',b.dataset.v===v)); }
host.querySelectorAll('.views button').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); const v=b.dataset.v; setView(v);
  const d=C.position.distanceTo(ctl.target); viewAnim={from:C.position.clone().sub(ctl.target).normalize(),to:VIEWS[v].clone().normalize(),t:0,d,v}; ctl.autoRotate=false; }));


function __robustBox(obj){ obj.updateMatrixWorld(true); const xs=[],ys=[],zs=[],v=new THREE.Vector3();
  obj.traverse(o=>{ if(!o.visible||o.isSprite||!o.geometry||!o.geometry.attributes||!o.geometry.attributes.position) return; const a=o.geometry.attributes.position, st=Math.max(1,Math.floor(a.count/4000));
    for(let i=0;i<a.count;i+=st){ v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld); xs.push(v.x); ys.push(v.y); zs.push(v.z); } });
  if(!xs.length) return new THREE.Box3().setFromObject(obj);
  const q=(arr,p)=>{ const s=arr.slice().sort((a,b)=>a-b); return s[Math.min(s.length-1,Math.max(0,Math.round(p*(s.length-1))))]; };
  return new THREE.Box3(new THREE.Vector3(q(xs,.003),q(ys,.003),q(zs,.003)),new THREE.Vector3(q(xs,.997),q(ys,.997),q(zs,.997))); }
function __exactD(box,dir,pad){ const c=box.getCenter(new THREE.Vector3()), mn=box.min, mx=box.max, pts=[]; const fz=C.far; C.far=1e5; C.updateProjectionMatrix();
  for(const x of [mn.x,mx.x]) for(const y of [mn.y,mx.y]) for(const z of [mn.z,mx.z]) pts.push(new THREE.Vector3(x,y,z));
  const sp=C.position.clone(), sq=C.quaternion.clone(); let lo=.01, hi=800;
  for(let i=0;i<30;i++){ const d=(lo+hi)/2; C.position.copy(c).addScaledVector(dir,d); C.lookAt(c); C.updateMatrixWorld(true); let m=0;
    const inv=C.matrixWorldInverse; for(const p of pts){ const cs=p.clone().applyMatrix4(inv); if(cs.z>-C.near){ m=9; break; } const q=p.clone().project(C); m=Math.max(m,Math.abs(q.x),Math.abs(q.y)); } if(m>pad) lo=d; else hi=d; }
  C.position.copy(sp); C.quaternion.copy(sq); C.far=fz; C.updateProjectionMatrix(); C.updateMatrixWorld(true); return hi; }
let __clamp=false;
function __fitExact(box){ C.clearViewOffset&&C.clearViewOffset(); C.updateProjectionMatrix(); const c=box.getCenter(new THREE.Vector3()); ctl.target.copy(c);
  const dir=C.position.clone().sub(c); if(dir.lengthSq()<1e-6) dir.set(1,.35,1); dir.normalize(); const d=__exactD(box,dir,.9);
  C.position.copy(c).addScaledVector(dir,d); ctl.minDistance=d; ctl.maxDistance=d*1.5; ctl.update();
  if(!ctl.__exactHook){ ctl.__exactHook=1; ctl.addEventListener('change',()=>{ if(__clamp) return; const v=C.position.clone().sub(ctl.target), need=__exactD(box,v.clone().normalize(),.9);
    ctl.minDistance=need; if(v.length()<need-1e-4){ __clamp=true; C.position.copy(ctl.target).add(v.setLength(need)); ctl.update(); __clamp=false; } }); } }
function fit(){ if(!window.__box) return; __fitExact(__box); }
let _w0=0,_h0=0; function resize(){ const w=cv.clientWidth,h=cv.clientHeight; if(!w||!h) return; if(w===_w0&&Math.abs(h-_h0)<(innerWidth<700?160:2)) return; _w0=w; _h0=h; R.setSize(w,h,false); C.aspect=w/h; C.fov=w<700?40:30; C.updateProjectionMatrix(); fit(); }
let _rw=0; addEventListener('resize',()=>{ if(innerWidth!==_rw){ _rw=innerWidth; resize(); } });
  host.querySelectorAll('.zoom button').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); const k=+b.dataset.z>0?.85:1/.85; const dir=C.position.clone().sub(ctl.target); const nd=Math.min(ctl.maxDistance,Math.max(ctl.minDistance,dir.length()*k)); C.position.copy(ctl.target).add(dir.setLength(nd)); })); new ResizeObserver(resize).observe(host);
(()=>{let d0=0,z0=1;const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);cv.addEventListener('touchstart',e=>{if(e.touches.length===2){d0=dist(e.touches);z0=C.zoom;}},{passive:true});cv.addEventListener('touchmove',e=>{if(e.touches.length===2&&d0){e.preventDefault();e.stopPropagation();C.zoom=Math.min(4,Math.max(.8,z0*dist(e.touches)/d0));C.updateProjectionMatrix();}},{passive:false,capture:true});cv.addEventListener('touchend',e=>{if(e.touches.length<2)d0=0;},{passive:true});})();  new ResizeObserver(resize).observe(host);
const v=new THREE.Vector3(); let tm=0, last=performance.now();
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function travel(t){ /* цикл 16 с: стоянка внизу, подъём, стоянка вверху, спуск */ const c=t%16; let u;
  if(c<3)u=0; else if(c<8)u=ease((c-3)/5); else if(c<11)u=1; else u=1-ease((c-11)/5); return u; }
function loop(){
  if(!host.offsetParent){ requestAnimationFrame(loop); return; }
  const now=performance.now(), dt=(now-last)/1000; last=now; if(!picked) tm+=dt;
  if(carNode){ const u=travel(tm), dy=-2.2+u*4.1, cwo=3.0-u*3.5; carNode.position.y=carBase+dy; cwNode.position.y=cwBase+cwo;
    ropeLines.forEach(r=>{ const a=r.line.geometry.attributes.position; a.setY(1,r.car?4.8+dy:3.35+cwo); a.needsUpdate=true; });
    pts.forEach(o=>{ if(o.moves==='car') o.p.y=o.base.y+dy; if(o.moves==='cw') o.p.y=o.base.y+cwo; }); }
  if(viewAnim){ viewAnim.t=Math.min(1,viewAnim.t+dt/0.9); const k=ease(viewAnim.t); const dir=viewAnim.from.clone().lerp(viewAnim.to,k).normalize();
    C.position.copy(ctl.target).add(dir.multiplyScalar(viewAnim.d)); if(viewAnim.t>=1){ if(viewAnim.v==='free') ctl.autoRotate=true; viewAnim=null; } }
  ctl.update(); R.render(S,C);
  const rw=cv.clientWidth, rh=cv.clientHeight;
  pts.forEach(o=>{ v.copy(o.p).project(C); o.el.style.left=((v.x+1)/2*rw)+'px'; o.el.style.top=(cv.offsetTop+(1-v.y)/2*rh)+'px'; o.el.style.left=(cv.offsetLeft+(v.x+1)/2*rw)+'px';
    const camD=C.position.distanceTo(ctl.target), pD=C.position.distanceTo(o.p); o.el.style.visibility=(v.y<-1||v.y>1||v.x<-1||v.x>1)?'hidden':''; o.el.classList.toggle('back',pD>camD+.4); });
  requestAnimationFrame(loop); }

})();