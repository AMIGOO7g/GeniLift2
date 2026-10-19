(function(){
const INFO={handrail:['Поручень','Резиновый поручень движется синхронно со ступенями.','poruchni'],steps:['Ступени','Несущие ступени с роликами; на площадках выравниваются в пол.','stupeni'],step_chain:['Ступенчатая цепь','Тянет ступени по замкнутой петле.','stupenchatye-tsepi'],drive:['Приводная станция','Верхняя звёздочка передаёт усилие на ступенчатую цепь.','prochee'],motor:['Мотор и редуктор','Привод эскалатора на верхней площадке.','prochee'],controller:['Шкаф управления','Управление, защиты и пуск эскалатора.','prochee'],handrail_drive:['Привод поручня','Фрикционное колесо, которое ведёт поручень.','friktsionnye-kolesa'],tension:['Натяжная станция','Нижнее колесо с пружиной держит цепь в натяжении.','natyazhnye-tsepi'],truss:['Ферма','Стальная несущая конструкция под ступенями.',''],combs:['Гребёнки','Пластины на входе и выходе, в которые «уходят» ступени.','grebenki']};
const ORDER=['handrail','steps','step_chain','drive','motor','controller','handrail_drive','tension','truss','combs'];
const host=document.getElementById('e3d'); if(!host) return; const DARK=host.dataset.theme==='dark'; const INK=DARK?0xE8D9B5:0x1E4A3F, CREAM=DARK?0x3E4127:0xF3E9D6, HI=DARK?0xF2C230:0xA3271F;
const v3=h=>`vec3(${((h>>16)&255)/255},${((h>>8)&255)/255},${(h&255)/255})`;
const cv=host.querySelector('canvas');
const BASE=host.dataset.base||'';
const R=new THREE.WebGLRenderer({canvas:cv,antialias:true}); R.setPixelRatio(Math.min(2,devicePixelRatio)); R.setClearColor(CREAM);
const S=new THREE.Scene(); const C=new THREE.PerspectiveCamera(30,1,.1,300);
const ctl=new THREE.OrbitControls(C,cv); ctl.enablePan=true; ctl.screenSpacePanning=true; ctl.panSpeed=.8; ctl.enableDamping=true; ctl.dampingFactor=.08; ctl.autoRotate=true; ctl.autoRotateSpeed=.5; ctl.enablePan=false; ctl.enableZoom=false; ctl.minPolarAngle=.05; ctl.maxPolarAngle=1.7;
let viewAnim=null; ctl.addEventListener('start',()=>{ctl.autoRotate=false; viewAnim=null; setView(null);});
const parts={}, hulls={}, pts=[];
const off={polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1};
const fill=new THREE.MeshBasicMaterial({color:CREAM,...off});
const hatchM=(dens,a)=>new THREE.ShaderMaterial({...off,vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`void main(){float s=mod(gl_FragCoord.x+gl_FragCoord.y,${dens.toFixed(1)});vec3 cr=${v3(CREAM)},ik=${v3(INK)};gl_FragColor=vec4(s<1.2?mix(cr,ik,${a}):cr,1.);}`});
const hStep=hatchM(6,.32), hFloor=hatchM(5,.42);
const reg=(k,o,list=parts)=>{(list[k]=list[k]||[]).push(o);};
const lineM=()=>new THREE.LineBasicMaterial({color:INK});
function edges(mesh,k,thr=20){ const l=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,thr),lineM()); mesh.add(l); reg(k,l); }
function hull(mesh,k,t){ const g=mesh.geometry; g.computeBoundingBox(); const s=g.boundingBox.getSize(new THREE.Vector3());
  const h=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:INK,side:THREE.BackSide})); h.scale.set((s.x+2*t)/Math.max(s.x,1e-4),(s.y+2*t)/Math.max(s.y,1e-4),(s.z+2*t)/Math.max(s.z,1e-4)); mesh.add(h); reg(k,h,hulls); }
function box(w,h,d,x,y,z,k,par,mat,t=.008){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat||fill); m.position.set(x,y,z); (par||S).add(m); edges(m,k); if(t) hull(m,k,t); return m; }
function cyl(r,len,x,y,z,k,par,axis='z',segs=24){ const g=new THREE.CylinderGeometry(r,r,len,segs); const m=new THREE.Mesh(g,fill); if(axis==='z') m.rotation.x=Math.PI/2; if(axis==='x') m.rotation.z=Math.PI/2; m.position.set(x,y,z); (par||S).add(m); edges(m,k,30); hull(m,k,.01); return m; }
function poly(points,k,closed,dashed){ const g=new THREE.BufferGeometry().setFromPoints(points); const l=closed?new THREE.LineLoop(g,dashed?new THREE.LineDashedMaterial({color:INK,dashSize:.08,gapSize:.06}):lineM()):new THREE.Line(g,dashed?new THREE.LineDashedMaterial({color:INK,dashSize:.08,gapSize:.06}):lineM()); if(dashed) l.computeLineDistances(); S.add(l); reg(k,l); return l; }
/* ---------- профиль: нижняя площадка — наклон 30° — верхняя площадка ---------- */
const H=3.2, X0=0, XA=1.6, XB=XA+H/Math.tan(Math.PI/6), X1=XB+1.6, TR=.7;
const sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
function topY(x){ if(x<=XA-TR/2) return 0; if(x>=XB+TR/2) return H;
  const k=Math.tan(Math.PI/6);
  if(x<XA+TR/2){ const u=(x-(XA-TR/2))/TR; return k*TR/2*u*u; }
  if(x>XB-TR/2){ const u=(x-(XB-TR/2))/TR; return k*(XB-TR/2-XA)+k*TR/2*(1-(1-u)*(1-u)) +0; }
  return k*(x-XA); }
const yFix=H-topY(XB+TR/2-1e-6); /* подгонка верхнего перехода */
const top=x=>{ const y=topY(x); return x>XB-TR/2&&x<XB+TR/2? y+yFix*sm((x-(XB-TR/2))/TR): y; };
const DROP=.75, RAD=DROP/2, W=1.0;
/* замкнутая петля ступеней: верхняя ветвь → звёздочка → нижняя ветвь → натяжное колесо */
const loop=[]; const xs=X0+.4, xe=X1-.4;
for(let x=xs;x<=xe;x+=.05) loop.push(new THREE.Vector2(x,top(x)));
const cTop=new THREE.Vector2(xe,H-RAD); for(let a=Math.PI/2;a>=-Math.PI/2;a-=Math.PI/24) loop.push(new THREE.Vector2(cTop.x+RAD*Math.cos(a),cTop.y+RAD*Math.sin(a)));
for(let x=xe;x>=xs;x-=.05) loop.push(new THREE.Vector2(x,top(x)-DROP));
const cBot=new THREE.Vector2(xs,-RAD); for(let a=-Math.PI/2;a>=-Math.PI*1.5;a-=Math.PI/24) loop.push(new THREE.Vector2(cBot.x+RAD*Math.cos(a),cBot.y+RAD*Math.sin(a)));
const cum=[0]; for(let i=1;i<loop.length;i++) cum.push(cum[i-1]+loop[i].distanceTo(loop[i-1])); const LEN=cum[cum.length-1]+loop[0].distanceTo(loop[loop.length-1]);
const topLen=cum[Math.round((xe-xs)/.05)];
function at(s){ s=((s%LEN)+LEN)%LEN; let i=1; while(i<cum.length&&cum[i]<s) i++; if(i>=cum.length) return loop[0].clone(); const t=(s-cum[i-1])/(cum[i]-cum[i-1]); return loop[i-1].clone().lerp(loop[i],t); }
/* ферма */
const tr=[]; for(let x=X0;x<=X1+.01;x+=.1) tr.push(x);
[-.62,.62].forEach(z=>{ poly(tr.map(x=>new THREE.Vector3(x,top(x)-.15,z)),'truss'); poly(tr.map(x=>new THREE.Vector3(x,top(x)-1.15,z)),'truss');
  for(let x=X0;x<=X1;x+=.8){ const a=new THREE.Vector3(x,top(x)-.15,z), b=new THREE.Vector3(x,top(x)-1.15,z), c=new THREE.Vector3(Math.min(X1,x+.8),top(Math.min(X1,x+.8))-1.15,z); poly([a,b],'truss'); poly([a,c],'truss'); } });
for(let x=X0;x<=X1;x+=1.6) poly([new THREE.Vector3(x,top(x)-1.15,-.62),new THREE.Vector3(x,top(x)-1.15,.62)],'truss');
/* площадки этажей (срезом) */
box(2.2,.3,2.4,X0-1.1,-.15,0,'truss',S,hFloor,0); box(2.2,.3,2.4,X1+1.1,H-.15,0,'truss',S,hFloor,0);
box(.75,.06,1.3,X0+.02,-.03,0,'combs',S,fill,.006); box(.75,.06,1.3,X1-.02,H-.03,0,'combs',S,fill,.006);
[[X0-.15,-1.45,X0+.9,0],[X1-.9,H-1.45,X1+.15,H]].forEach(([a,b,c,d])=>{ [-.66,.66].forEach(z=>poly([new THREE.Vector3(a,d,z),new THREE.Vector3(a,b,z),new THREE.Vector3(c,b,z)],'truss')); });
/* балюстрады: стекло контуром, стойки */
[-.6,.6].forEach(z=>{ const lo=[],hi=[]; for(let x=X0+.25;x<=X1-.25;x+=.1){ lo.push(new THREE.Vector3(x,top(x)+.12,z)); hi.push(new THREE.Vector3(x,top(x)+.92,z)); }
  const gl=poly(lo.concat(hi.reverse()),'handrail',true,false); gl.material.transparent=true; gl.material.opacity=.45;
  for(let x=X0+.6;x<X1-.4;x+=1.3){ const l=poly([new THREE.Vector3(x,top(x)+.12,z),new THREE.Vector3(x,top(x)+.92,z)],'handrail'); l.material.transparent=true; l.material.opacity=.45; } });
/* поручень — замкнутая петля над балюстрадой, движется */
const hrPts=(z)=>{ const p=[]; for(let x=X0+.25;x<=X1-.25;x+=.1) p.push(new THREE.Vector3(x,top(x)+1.0,z));
  const e=X1-.25; for(let a=Math.PI/2;a>=-Math.PI/2;a-=Math.PI/12) p.push(new THREE.Vector3(e+.22*Math.cos(a),H+.78+.22*Math.sin(a),z));
  for(let x=X1-.25;x>=X0+.25;x-=.1) p.push(new THREE.Vector3(x,top(x)+.56,z));
  const b=X0+.25; for(let a=-Math.PI/2;a>=-Math.PI*1.5;a-=Math.PI/12) p.push(new THREE.Vector3(b+.22*Math.cos(a),.78+.22*Math.sin(a),z)); return p; };
const hrMarks=[];
[-.6,.6].forEach(z=>{ const pp=hrPts(z); const curve=new THREE.CatmullRomCurve3(pp,true,'catmullrom',.1);
  const tube=new THREE.Mesh(new THREE.TubeGeometry(curve,400,.035,6,true),new THREE.MeshBasicMaterial({color:INK})); S.add(tube); reg('handrail',tube);
  for(let i=0;i<7;i++){ const m=new THREE.Mesh(new THREE.BoxGeometry(.018,.076,.076),new THREE.MeshBasicMaterial({color:CREAM})); S.add(m); hrMarks.push({m,curve,u:i/7}); } });
/* ступени: проступь + подступенок, едут по петле */
const pitch=.42, N=Math.floor(LEN/pitch), steps=[];
for(let i=0;i<N;i++){ const g=new THREE.Group(); S.add(g);
  const tread=box(pitch-.03,.05,W,0,0,0,'steps',g,hStep,.006); tread.position.set(-pitch/2,-.025,0);
  const riser=new THREE.Mesh(new THREE.BoxGeometry(.03,1,W),fill); riser.position.set(-pitch+.015,-.5,0); g.add(riser); edges(riser,'steps'); hull(riser,'steps',.004);
  const r1=cyl(.045,.06,-pitch+.06,-.08,.45,'step_chain',g,'z',12), r2=cyl(.045,.06,-pitch+.06,-.08,-.45,'step_chain',g,'z',12);
  steps.push({g,riser,s:i*pitch}); }
[-.45,.45].forEach(z=>{ poly(loop.map(p=>new THREE.Vector3(p.x-pitch+.06,p.y-.08,z)),'step_chain',true); });
/* гребёнки на входе и выходе */
[[X0+.4,0],[X1-.4,H]].forEach(([x,y],i)=>{ const c=box(.28,.05,W+.1,x+(i?-.05:.05),y+.03,0,'combs',S,fill,.006); for(let z=-.45;z<=.45;z+=.1) poly([new THREE.Vector3(x+(i?-.19:.19),y+.03,z),new THREE.Vector3(x+(i?-.3:.3),y+.03,z)],'combs'); });
/* привод: звёздочка, редуктор, мотор */
const spr=new THREE.Group(); spr.position.set(cTop.x,cTop.y,0); S.add(spr);
[-.45,.45].forEach(z=>{ const w=cyl(RAD*.92,.05,0,0,z,'drive',spr,'z',28); });
for(let a=0;a<6;a++){ const l=poly([new THREE.Vector3(0,0,0),new THREE.Vector3(Math.cos(a*Math.PI/3)*RAD*.85,Math.sin(a*Math.PI/3)*RAD*.85,0)],'drive'); S.remove(l); spr.add(l); }
cyl(.06,1.1,cTop.x,cTop.y,0,'drive',S,'z',12);
box(.5,.45,.45,cTop.x+.55,cTop.y-.05,.7,'motor'); cyl(.2,.6,cTop.x+1.15,cTop.y-.05,.7,'motor',S,'x',20); cyl(.22,.05,cTop.x+1.47,cTop.y-.05,.7,'motor',S,'x',20);
/* натяжная станция: колесо и пружина */
const tw=new THREE.Group(); tw.position.set(cBot.x,cBot.y,0); S.add(tw);
[-.45,.45].forEach(z=>cyl(RAD*.92,.05,0,0,z,'tension',tw,'z',28));
for(let a=0;a<6;a++){ const l=poly([new THREE.Vector3(0,0,0),new THREE.Vector3(Math.cos(a*Math.PI/3)*RAD*.85,Math.sin(a*Math.PI/3)*RAD*.85,0)],'tension'); S.remove(l); tw.add(l); }
const coil=[]; for(let t=0;t<=1;t+=.01){ const a=t*Math.PI*2*9; coil.push(new THREE.Vector3(cBot.x+.25+t*.6,cBot.y+.09*Math.sin(a),.75+.09*Math.cos(a))); } poly(coil,'tension');
box(.12,.3,.3,cBot.x+.9,cBot.y,.75,'tension');
/* привод поручня — фрикционное колесо у верхнего конца */
const hd=new THREE.Group(); hd.position.set(X1-.7,H+.66,0); S.add(hd); [-.6,.6].forEach(z=>cyl(.16,.08,0,0,z,'handrail_drive',hd,'z',20));
for(let a=0;a<4;a++){ [-.6,.6].forEach(z=>{ const l=poly([new THREE.Vector3(0,0,z),new THREE.Vector3(Math.cos(a*Math.PI/2)*.14,Math.sin(a*Math.PI/2)*.14,z)],'handrail_drive'); S.remove(l); hd.add(l); }); }
/* шкаф управления на верхнем этаже */
const cab=box(.6,1.3,.4,X1+1.35,H+.65,.85,'controller',S,fill,.01); poly([new THREE.Vector3(X1+1.1,H+.35,.648),new THREE.Vector3(X1+1.6,H+.35,.648),new THREE.Vector3(X1+1.6,H+1.15,.648),new THREE.Vector3(X1+1.1,H+1.15,.648)],'controller',true);
/* ---------- номера ---------- */
const P={handrail:[ (XA+XB)/2, top((XA+XB)/2)+1.02, -.6],steps:[(XA+XB)/2+.6,top((XA+XB)/2+.6)+.05,0],step_chain:[(XA+XB)/2-.4,top((XA+XB)/2-.4)-.85,.45],drive:[cTop.x,cTop.y,-.5],motor:[cTop.x+1.15,cTop.y+.2,.7],controller:[X1+1.35,H+1.0,.9],handrail_drive:[X1-.7,H+.66,-.62],tension:[cBot.x+.5,cBot.y,.75],truss:[(XA+XB)/2,top((XA+XB)/2)-.9,-.62],combs:[X0+.45,.06,0]};
ORDER.forEach((k,i)=>{ const el=document.createElement('span'); el.className='pt'; el.textContent=i+1; host.appendChild(el); el.addEventListener('click',e=>{e.stopPropagation(); pick(k);}); pts.push({k,p:new THREE.Vector3(...P[k]),el}); });
const card=host.querySelector('.l3d-card'); let picked=null;
function paint(){ Object.entries(parts).forEach(([k,ls])=>ls.forEach(l=>l.material.color&&l.material.color.setHex(k===picked?HI:(l.material.color.getHex()===CREAM?CREAM:INK)))); Object.entries(hulls).forEach(([k,hs])=>hs.forEach(h=>h.material.color.setHex(k===picked?HI:INK))); }
function pick(k){ picked=k; paint(); pts.forEach(p=>p.el.classList.toggle('on',p.k===k)); card.querySelector('b').textContent=INFO[k][0]; card.querySelector('i').textContent=INFO[k][1];
  const a=card.querySelector('a'); if(INFO[k][2]){ a.style.display=''; a.href=BASE+'#'+INFO[k][2]; a.textContent='Детали в отделе →'; } else { a.style.display='none'; } card.classList.add('on'); ctl.autoRotate=false; }
cv.addEventListener('click',()=>{ picked=null; paint(); card.classList.remove('on'); pts.forEach(p=>p.el.classList.remove('on')); });
/* ---------- виды, вписывание ---------- */
const box3=__robustBox(S); const ctr=box3.getCenter(new THREE.Vector3()); ctl.target.copy(ctr);
const VIEWS={side:new THREE.Vector3(0,.15,1),front:new THREE.Vector3(-1,.25,0),top:new THREE.Vector3(.02,1,.02),free:new THREE.Vector3(.7,.45,1)};
const MOB=innerWidth<700; C.position.copy(ctr).add((MOB?VIEWS.side:VIEWS.free).clone()); if(MOB){ ctl.autoRotate=false; setTimeout(()=>setView('side'),0); }
function setView(v){ host.querySelectorAll('.views button').forEach(b=>b.classList.toggle('on',b.dataset.v===v)); }
host.querySelectorAll('.views button').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); const v=b.dataset.v; setView(v); viewAnim={from:C.position.clone().sub(ctl.target).normalize(),to:VIEWS[v].clone().normalize(),t:0,d:C.position.distanceTo(ctl.target),v}; ctl.autoRotate=false; }));


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
  const dir=C.position.clone().sub(c); if(dir.lengthSq()<1e-6) dir.set(1,.35,1); dir.normalize(); const d=__exactD(box,dir,.97);
  C.position.copy(c).addScaledVector(dir,d); ctl.minDistance=d; ctl.maxDistance=d*1.5; ctl.update();
  if(!ctl.__exactHook){ ctl.__exactHook=1; ctl.addEventListener('change',()=>{ if(__clamp) return; const v=C.position.clone().sub(ctl.target), need=__exactD(box,v.clone().normalize(),.97);
    ctl.minDistance=need; if(v.length()<need-1e-4){ __clamp=true; C.position.copy(ctl.target).add(v.setLength(need)); ctl.update(); __clamp=false; } }); } }
function fit(){ const w=cv.clientWidth,h=cv.clientHeight; if(!w||!h) return; __fitExact(box3); }
let _w0=0,_h0=0; function resize(){ const w=cv.clientWidth,h=cv.clientHeight; if(!w||!h) return; if(w===_w0&&Math.abs(h-_h0)<(innerWidth<700?160:2)) return; _w0=w; _h0=h; R.setSize(w,h,false); C.aspect=w/h; C.fov=w<700?42:30; C.zoom=w<700?1:2.3; C.updateProjectionMatrix(); fit(); }
let _rw=0; addEventListener('resize',()=>{ if(innerWidth!==_rw){ _rw=innerWidth; resize(); } });
  host.querySelectorAll('.zoom button').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); const k=+b.dataset.z>0?.85:1/.85; const dir=C.position.clone().sub(ctl.target); const nd=Math.min(ctl.maxDistance,Math.max(ctl.minDistance,dir.length()*k)); C.position.copy(ctl.target).add(dir.setLength(nd)); })); new ResizeObserver(resize).observe(host);
(()=>{let d0=0,z0=1;const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);cv.addEventListener('touchstart',e=>{if(e.touches.length===2){d0=dist(e.touches);z0=C.zoom;}},{passive:true});cv.addEventListener('touchmove',e=>{if(e.touches.length===2&&d0){e.preventDefault();e.stopPropagation();C.zoom=Math.min(4,Math.max(.8,z0*dist(e.touches)/d0));C.updateProjectionMatrix();}},{passive:false,capture:true});cv.addEventListener('touchend',e=>{if(e.touches.length<2)d0=0;},{passive:true});})();
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2; const v=new THREE.Vector3(); let last=performance.now(), sh=0;
function loop2(){ requestAnimationFrame(loop2); if(!host.offsetParent) return;
  const now=performance.now(), dt=Math.min(.05,(now-last)/1000); last=now; if(!picked) sh+=dt*.35;
  steps.forEach(st=>{ const s=st.s+sh; const p=at(s), q=at(s-pitch); st.g.position.set(p.x,p.y,0);
    const ss=((s%LEN)+LEN)%LEN, onTop=ss<topLen, semi=Math.PI*RAD, botLen=LEN-topLen-2*semi;
    let rot=0; if(!onTop){ if(ss<topLen+semi) rot=Math.PI*(ss-topLen)/semi; else if(ss<topLen+semi+botLen) rot=Math.PI; else rot=Math.PI+Math.PI*(ss-topLen-semi-botLen)/semi; }
    st.g.rotation.z=-rot;
    const rise=onTop?Math.max(.01,p.y-q.y):.01; st.riser.scale.y=rise; st.riser.position.y=-rise/2; st.riser.visible=onTop&&rise>.02; });
  spr.rotation.z=-sh/RAD; tw.rotation.z=-sh/RAD; hd.rotation.z=-sh/.16*.5;
  hrMarks.forEach(o=>{ const u=((o.u+sh/(o.curve.getLength()))%1+1)%1; o.curve.getPointAt(u,o.m.position); });
  if(viewAnim){ viewAnim.t=Math.min(1,viewAnim.t+dt/.9); const k=ease(viewAnim.t); C.position.copy(ctl.target).add(viewAnim.from.clone().lerp(viewAnim.to,k).normalize().multiplyScalar(viewAnim.d)); if(viewAnim.t>=1){ if(viewAnim.v==='free') ctl.autoRotate=true; viewAnim=null; } }
  ctl.update(); R.render(S,C);
  const rw=cv.clientWidth, rh=cv.clientHeight, camD=C.position.distanceTo(ctl.target);
  pts.forEach(o=>{ v.copy(o.p).project(C); o.el.style.left=((v.x+1)/2*rw)+'px'; o.el.style.top=(cv.offsetTop+(1-v.y)/2*rh)+'px'; o.el.style.left=(cv.offsetLeft+(v.x+1)/2*rw)+'px'; o.el.style.visibility=(v.y<-1||v.y>1||v.x<-1||v.x>1)?'hidden':''; o.el.classList.toggle('back',C.position.distanceTo(o.p)>camD+.5); }); }
resize(); loop2();
})();
