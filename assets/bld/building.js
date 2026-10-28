/* GeniLift — главная-здание: лифт, этажи, вход в комнату раздела */
(() => {
  const B = document.getElementById('bld'); if (!B) return;
  const R = B.dataset.r || '';
  const W0 = 1086, H0 = 1219, NF = 4, FLOORBOT = {1:1115,2:880,3:649,4:420}, BOX = {x0:215,x1:870,y0:0,y1:1179};
  const SLUG = {1:'o-kompanii',2:'zapchasti',3:'servis',4:'kontakty'};
  const ANG = {1:-84,2:-28,3:28,4:84};
  const car = document.getElementById('bCar'), cw = document.getElementById('bCw'), wheel = document.getElementById('bWheel'), ndl = document.getElementById('bNdl');
  const stage = document.getElementById('bStage'), roomv = document.getElementById('roomv'), rc = document.getElementById('rc'), hero = document.getElementById('rhero');
  const hdr = document.querySelector('.hdr');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let floor = 1, pos = 0, busy = false;
  try { floor = +(sessionStorage.getItem('gl-floor') || 1); } catch (e) {}
  if (!(floor >= 1 && floor <= NF)) floor = 1;
  const hh = () => (hdr ? hdr.getBoundingClientRect().height : 72);
  const barH = () => { const b = document.querySelector('.mbar'); return b && getComputedStyle(b).display !== 'none' ? b.getBoundingClientRect().height : 0; };
  function fit() {
    const mob = innerWidth <= 760, top = hh() + (mob ? 18 : 34), bot = barH() + (mob ? 64 : 40), aw = innerWidth - 16, ah = innerHeight - top - bot;
    if (mob) {                                       // телефон: здание по ширине экрана, страница прокручивается
      const fx0 = W0 * .235, fx1 = W0 * .775, s = (innerWidth - 56) / (fx1 - fx0), t = hh() + 14;   // крупно: шахта + этажи
      Object.assign(B.style, { width: W0 * s + 'px', height: H0 * s + 'px', left: (innerWidth / 2 - (fx0 + fx1) / 2 * s) + 'px', top: (t - BOX.y0 * s) + 'px' });
      Object.assign(stage.style, { position: 'absolute', top: '0px', left: '0px', right: '0px', height: (t + (BOX.y1 - BOX.y0) * s + 90) + 'px' }); B.style.transform = 'none'; return;
    }
    const s = Math.min(aw / (BOX.x1 - BOX.x0), ah / (BOX.y1 - BOX.y0));
    Object.assign(B.style, { width: W0 * s + 'px', height: H0 * s + 'px', left: (innerWidth / 2 - (BOX.x0 + BOX.x1) / 2 * s) + 'px', top: (top + (ah - (BOX.y1 - BOX.y0) * s) / 2 - BOX.y0 * s) + 'px' });
    stage.style.top = '0px'; B.style.transform = 'none';
  }
  const carTop = n => { const h = car.getBoundingClientRect().height / B.getBoundingClientRect().height * H0; return (FLOORBOT[n] - h - 3) / H0 * 100; };
  function setPos(p) { pos = p; car.style.top = p + '%'; const k = (carTop(1) - p) / (carTop(1) - carTop(NF)); cw.style.top = (17.8 + k * 55.4) + '%'; wheel.style.transform = `rotate(${(p * 22).toFixed(2)}deg)`; }
  const needleTo = (n, inst) => { if (inst) ndl.style.transition = 'none'; ndl.style.transform = `rotate(${ANG[n]}deg)`; if (inst) { void ndl.offsetWidth; ndl.style.transition = ''; } };
  const light = (n, on) => B.querySelectorAll(`[data-f="${n}"]`).forEach(e => e.classList.toggle('on', on));
  function move(n) { return new Promise(res => { const from = pos, to = carTop(n), D = (sessionStorage.getItem('gl-rides') ? Math.min(1300, 500 + Math.abs(n - floor) * 220) : Math.min(2400, 800 + Math.abs(n - floor) * 420)), t0 = performance.now();
    const st = now => { const k = Math.min(1, (now - t0) / D), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; setPos(from + (to - from) * e); if (innerWidth <= 760) { const r = car.getBoundingClientRect(); { const ty = scrollY + (r.top + r.height / 2 - innerHeight / 2); const f = Math.min(.35, .03 + k * 1.6); scrollTo({ top: scrollY + (ty - scrollY) * f, behavior: 'instant' }); } } if (k < 1) requestAnimationFrame(st); else res(); }; requestAnimationFrame(st); }); }
  function fitRoom() {}
  function fillRoom(n) { const pq = B.querySelector(`.pq[data-f="${n}"]`), cs = getComputedStyle(pq);
    rc.querySelector('.tint').style.setProperty('--bg', cs.getPropertyValue('--bg')); rc.querySelector('.sign').style.setProperty('--hc', cs.getPropertyValue('--hc'));
    rc.querySelector('.k').textContent = pq.querySelector('.pk').textContent; const t = rc.querySelector('.t'); t.textContent = pq.querySelector('.pt').textContent; t.dataset.raw = t.textContent;
    if (window.__fitSign) window.__fitSign(rc); }
  async function enterRoom(n) {                       // точка в центр экрана → страница раздела
    try { sessionStorage.setItem('gl-floor', n); } catch (e) {}
    const href = R + SLUG[n] + '/';
    if (window.__irisOut) window.__irisOut(href); else location.href = href;
  }
  async function go(n) {
    if (busy) return; busy = true; const fast = !!sessionStorage.getItem('gl-rides'); try { sessionStorage.setItem('gl-rides', '1'); } catch (e) {}
    if (n !== floor) { car.classList.add('closed'); await wait(fast ? 350 : 650); light(floor, false); needleTo(n); await wait(fast ? 80 : 200); await move(n);
      car.animate([{transform:'translateY(0)'},{transform:'translateY(2px)'},{transform:'translateY(0)'}], {duration: 380}); floor = n; await wait(250);
      car.classList.remove('closed'); await wait(fast ? 250 : 450); light(n, true); await wait(fast ? 500 : 1100); }
    await enterRoom(n);
  }
  window.__bldGo = go;
  B.querySelectorAll('.pq,.hit,.note').forEach(e => e.addEventListener('click', ev => { ev.preventDefault(); go(+e.dataset.f); }));
  addEventListener('resize', () => { if (!busy) { fit(); setPos(carTop(floor)); } fitRoom(); });
  addEventListener('pageshow', e => { if (e.persisted) { busy = false; stage.classList.remove('left'); roomv.classList.remove('in', 'show'); } });
  async function start() {
    fit(); setPos(carTop(floor)); light(floor, true); needleTo(floor, true);
    if (innerWidth <= 760) { const r = car.getBoundingClientRect(); scrollTo(0, Math.max(0, scrollY + r.top + r.height / 2 - innerHeight / 2)); }
    let seen = false; try { seen = !!sessionStorage.getItem('gl-intro'); sessionStorage.setItem('gl-intro', '1'); } catch (e) {}
    const it = document.getElementById('bIntro'), hn = document.querySelector('.bhint');
    if (seen) { it && it.remove(); document.documentElement.classList.add('b-ready'); hn && hn.classList.add('on'); const h1 = B.querySelector('.b-h1'); h1 && h1.classList.add('on'); return; }
    document.documentElement.classList.add('b-intro', 'b-nologo');
    const fl = document.getElementById('bFly'), wm = document.querySelector('.hdr-logo');
    await wait(150); it.classList.add('s1'); await wait(2100); it.classList.add('s2'); fl.style.opacity = '1'; await wait(700);
    it.classList.add('out'); document.documentElement.classList.remove('b-intro'); document.documentElement.classList.add('b-ready');
    if (wm) { const fb = fl.querySelector('b') || fl, wb = wm.querySelector('b,strong,.lg-t,span') || wm; const cs = getComputedStyle(wb), fs = parseFloat(cs.fontSize), ls = (parseFloat(cs.letterSpacing) || 0) / fs; fb.style.fontFamily = cs.fontFamily; fb.style.fontWeight = cs.fontWeight; fb.style.letterSpacing = ls + 'em'; fb.style.paddingLeft = ls + 'em'; const a = fb.getBoundingClientRect(), b2 = wb.getBoundingClientRect(), k = fs / parseFloat(getComputedStyle(fb).fontSize);
      fl.style.transition = 'transform 1.1s cubic-bezier(.65,0,.35,1), color 1.1s ease';
      fl.style.transform = `translate(calc(-50% + ${(b2.left + b2.width / 2) - (a.left + a.width / 2)}px), calc(-50% + ${(b2.top + b2.height / 2) - (a.top + a.height / 2)}px)) scale(${k})`; fl.classList.add('gold'); }
    await wait(1000); document.documentElement.classList.remove('b-nologo'); fl.style.transition = 'opacity .25s ease'; fl.style.opacity = '0'; await wait(260); setTimeout(() => it.remove(), 800);
    const h1 = B.querySelector('.b-h1'); setTimeout(() => { hn && hn.classList.add('on'); h1 && h1.classList.add('on'); }, 600);
  }
  if (document.readyState === 'complete') start(); else addEventListener('load', start);
})();
