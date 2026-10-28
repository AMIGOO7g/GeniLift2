/* ---------- Отправка заявок на сервер (send.php) ---------- */
window.glRoot = (function(){ const a=document.querySelector('.hdr-logo'); try{ return new URL(a?a.getAttribute('href'):'./', location.href).href; }catch(e){ return '/'; } })();
window.glSend = function(form, st, items){
  if (form.dataset.busy) return; form.dataset.busy = '1'; st.textContent = 'Отправляем…';
  const fd = new FormData(form); fd.delete('agree'); fd.append('agree', form.agree && form.agree.checked ? 'yes' : 'no');
  fd.append('page', location.href); fd.append('form', form.id || form.className);
  if (items && items.length) fd.append('items', JSON.stringify(items));
  fetch(window.glRoot + 'send.php', { method: 'POST', body: fd })
    .then(r => r.json().catch(() => ({ ok: false })))
    .then(d => { if (d && d.ok) { st.textContent = 'Заявка отправлена. Перезвоним в течение часа.'; form.reset(); } else { st.textContent = (d && d.error) || 'Не удалось отправить. Позвоните: +7 985 481-72-28'; } })
    .catch(() => { st.textContent = 'Не удалось отправить. Позвоните: +7 985 481-72-28'; })
    .finally(() => { delete form.dataset.busy; });
};
/* GeniLift — сайт: заставка, шахта с параллаксом, двери этажей, появления, заявка, каталог */
(() => {
  if (!/\/$|\.html$/.test(location.pathname)) { location.replace(location.pathname + '/' + location.search + location.hash); return; }
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.querySelector('.hero');

  /* ---------- Появления: разрядка сжимается, блоки раскрываются как двери ---------- */
  const targets = [...document.querySelectorAll('[data-track],[data-doors],[data-fade],[data-reveal]')].filter(el => !el.closest('.fl-body'));
  /* этажи главной: элементы проявляются по очереди, когда лифт погас */
  document.querySelectorAll('.fl-body').forEach(b => b.querySelectorAll('[data-fade],[data-reveal]').forEach((el, i) => el.style.setProperty('--d', Math.min(i * .14, .9) + 's')));
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -12% 0px' });
  const reveal = () => { root.classList.add('ready'); targets.forEach(t => io.observe(t)); };

  /* ---------- Первый экран: дверь открывается, камера въезжает в свет ---------- */
  /* масштаб, при котором проём двери закрывает весь экран — «мы вошли» */
  const fillScale = door => {
    const ow = door.offsetWidth * .6513, oh = door.offsetHeight * .7835;
    const off = Math.abs(door.offsetHeight * .055);
    return Math.max(innerWidth / ow, (innerHeight + off * 2) / oh) * 1.22;   // с запасом: рама уходит за края целиком
  };
  const openHero = (fast) => {
    if (!hero || !hero.querySelector('.door')) return reveal();
    reveal();
  };

  /* ---------- Заставка: белый экран, логотип строго по центру, затем плавно растворяется в экран с лифтом ---------- */
  if (root.classList.contains('intro-on')) {
    let done = false;
    const steps = ['s1', 's2', 's3', 's5'];
    const end = () => { if (done) return; done = true;
      const lg = document.querySelector('.intro-logo'), tg = document.querySelector('.hdr-logo');
      if (lg && tg) {
        const a = lg.getBoundingClientRect(), b = tg.getBoundingClientRect();
        const k = Math.min(b.height / a.height, .5) * 1.4;
        lg.style.transition = 'transform .85s cubic-bezier(.65,0,.35,1), opacity .5s ease .45s';
        lg.style.transform = `translate(${(b.left + b.width / 2) - (a.left + a.width / 2)}px, ${(b.top + b.height / 2) - (a.top + a.height / 2)}px) scale(${k})`;
        lg.style.opacity = '0';
      }
      root.classList.add('s5');
      setTimeout(() => root.classList.add('wm-in'), 600);
      setTimeout(() => { root.classList.remove('intro-on', ...steps); openHero(); }, 950);
      try { sessionStorage.setItem('gl-intro', '1'); } catch (e) {} };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    (async () => {
      await wait(200); root.classList.add('s1');
      await wait(500); root.classList.add('s2');
      await wait(1100); root.classList.add('s3');
      await wait(1900); end();
    })();
    document.getElementById('intro').addEventListener('click', end);
  } else {
    requestAnimationFrame(reveal);
  }

  /* ---------- Шахта: лифт едет между этажами и останавливается у дверей ---------- */
  const shaft = document.getElementById('shaft');
  /* неизменная высота экрана: адресная строка Safari не сдвигает расчёты */
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  let VH = probe.offsetHeight || innerHeight;
  if (shaft) {
    const wall = shaft.querySelector('.sh-wall');
    const rails = [...shaft.querySelectorAll('.sh-rail')];
    const ropes = [...shaft.querySelectorAll('.sh-ropes')];
    const fg = document.getElementById('fg');
    const stages = [...document.querySelectorAll('[data-stage]')].map(el => ({ el, door: el.querySelector('.door') }));
    const tileH = (el, ratio) => el.offsetWidth * ratio;
    let tW = 0, tRail = 0, tRope = 0;
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const layout = () => {
      VH = probe.offsetHeight || innerHeight;
      tW = tileH(wall, 3);                         // wall.webp 1024×3072
      wall.style.height = innerHeight + tW + 'px';
      tRail = rails[0] ? tileH(rails[0], 3072 / 180) : 1;
      rails.forEach(r => r.style.height = innerHeight + tRail + 'px');
      tRope = ropes[0] ? tileH(ropes[0], 1217 / 190) : 1;
      ropes.forEach(r => r.style.height = innerHeight + tRope + 'px');
      stages.forEach(s => {
        const cs = getComputedStyle(s.el);
        s.stick = parseFloat(getComputedStyle(s.door).top);
        s.dh = s.door.offsetHeight;
        s.pad = parseFloat(cs.paddingTop) || 0;
        s.start = s.el.getBoundingClientRect().top + scrollY + s.pad - s.stick;   // дверь встала по центру
        s.len = s.el.offsetHeight - s.pad - s.dh;                                 // сколько она стоит
        s.E = VH * .95;                                                  // путь открытия и входа
        const wrap = s.el.querySelector('.stage-body .wrap');
        const wb = wrap ? wrap.getBoundingClientRect().bottom + scrollY : s.start + s.len;
        s.dEx = (wb - VH * .35) - s.start;                               // текст ушёл — выходим
        s.X = VH * .9;                                                   // выход: назад, двери закрываются
        s.dEx = Math.min(s.dEx, s.len - s.X - VH * .12);                 // успеть закрыть до отъезда
        const ow = s.door.offsetWidth * .6513, oh = s.dh * .7835, oc = s.stick + s.dh * .555;
        s.S = Math.max(s.el.offsetWidth / ow, 2 * Math.max(oc, VH - oc) / oh) * 1.12;
      });
      /* Передний план: балки и кабели по всему пути лифта (картинки уже размыты) */
      if (fg && !reduce && innerWidth > 820) {
        fg.innerHTML = '';
        const travelMax = document.documentElement.scrollHeight - stages.reduce((n, s) => n + s.len, 0);
        const kinds = ['cab-l', 'beam-r', 'cab-r', 'beam-l'];
        let k = 0;
        for (let y = innerHeight * 1.1; y < travelMax * 1.7 + innerHeight; y += innerHeight * .95) {
          const kind = kinds[k++ % kinds.length], im = new Image();
          im.src = kind.startsWith('beam') ? 'assets/shaft/beam-edge.webp' : 'assets/shaft/cables-blur.webp';
          im.alt = ''; im.className = kind; im.decoding = 'async'; im.style.top = y + 'px';
          fg.appendChild(im);
        }
      }
    };
    let ticking = false, cur = null;
    const frame = () => {
      ticking = false;
      const s = scrollY, vh = innerHeight;
      /* путь лифта = прокрутка минус время стоянок у дверей */
      let travel = s;
      stages.forEach(st => {
        const d = s - st.start;
        travel -= clamp(d, 0, st.len);
        const sm = v => v * v * (3 - 2 * v);
        const open = clamp((d - VH * .05) / (st.E * .3));                      // створки расходятся
        const e = sm(clamp((d - st.E * .25) / (st.E * .75)));      // входим в кабину
        const x = clamp((d - st.dEx) / st.X);                      // выход
        const back = sm(clamp(x / .6));                            // камера отъезжает назад
        const close = sm(clamp((x - .55) / .35));                  // створки закрываются
        const depth = e * (1 - back);
        st.door.style.setProperty('--o', (open * (1 - close)).toFixed(3));
        st.door.style.setProperty('--s', (1 + depth * (st.S - 1)).toFixed(3));
        st.door.style.setProperty('--k', depth.toFixed(3));
        st.door.style.setProperty('--f', '1');
        
      });
      /* сглаживание: слои мягко догоняют прокрутку, без рывков */
      if (cur === null || reduce) cur = travel; else cur += (travel - cur) * .16;
      const px = v => Math.round(v * 2) / 2;
      wall.style.transform = `translate3d(0,${px(-((cur * .35) % tW))}px,0)`;
      rails.forEach(r => r.style.transform = `translate3d(0,${px(-((cur * .8) % tRail))}px,0)`);
      ropes.forEach(r => r.style.transform = `translate3d(0,${px(-((cur * 1) % tRope))}px,0)`);
      if (fg) fg.style.transform = `translate3d(0,${px(-cur * 1.7)}px,0)`;
      if (Math.abs(travel - cur) > .4) { ticking = true; requestAnimationFrame(frame); }
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
    addEventListener('scroll', onScroll, { passive: true });
    let lastW = innerWidth;
    addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth; layout(); frame(); });
    addEventListener('load', () => { layout(); frame(); });
    layout(); frame();
  }

  /* ---------- Лифт — «площадка» между этажами. Внизу этажа лифт выезжает обычной прокруткой и встаёт на место.
     Дальше колёсико/палец ведёт поездку: свет по шву, табло меняет этаж, двери открываются, камера едет к титру.
     Вверх — зеркально. Проскочить этаж мимо лифта нельзя ---------- */
  const secs = [...document.querySelectorAll('section.fl')].map(el => ({ el, ls: el.querySelector('.liftsec'), body: el.querySelector('.fl-body'), n: +el.dataset.floor }));
  const MOBILE = matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  if (secs.length && secs[0].ls && MOBILE) {
    secs.forEach(s => {
      const ind = s.ls.querySelector('.sk-ind'), beam = s.ls.querySelector('.sk-beam'), nm = s.ls.querySelector('.ls-name');
      let raf = 0;
      const play = on => { cancelAnimationFrame(raf); const t0 = performance.now(), from = +(s.ls.style.getPropertyValue('--o') || 0), D = on ? 2400 : 400;
        const st = now => { const k = Math.min(1, (now - t0) / D);
          if (on) { const tr = Math.min(1, k / .4), op = Math.max(0, (k - .45) / .55), e = op < .5 ? 2 * op * op : 1 - Math.pow(-2 * op + 2, 2) / 2;
            ind.textContent = (s.n === 1 || tr > .5) ? '0' + s.n : '0' + Math.max(1, s.n - 1); beam.style.opacity = (Math.sin(Math.PI * tr) * (op < .02 ? 1 : 0)).toFixed(3); beam.style.setProperty('--bp', (tr * 100).toFixed(1) + '%'); nm.style.opacity = Math.min(1, tr * 1.5).toFixed(2); s.ls.style.setProperty('--o', e.toFixed(3)); }
          else { s.ls.style.setProperty('--o', (from * (1 - k)).toFixed(3)); }
          if (k < 1) raf = requestAnimationFrame(st); };
        raf = requestAnimationFrame(st); };
      ind.textContent = '0' + Math.max(1, s.n - 1);
      const io = new IntersectionObserver(es => es.forEach(en => { if (en.intersectionRatio > .6) { const go = () => root.classList.contains('intro-on') ? setTimeout(go, 300) : setTimeout(() => play(true), s.n === 1 ? 700 : 0); go(); } else if (en.intersectionRatio < .1) play(false); }), { threshold: [0, .1, .6] });
      io.observe(s.ls);
      s.body.classList.add('go', 'arrived');
    });
  } else if (secs.length && secs[0].ls) {
    const hdrH = () => (document.querySelector('.hdr') || {}).offsetHeight || 0;
    const topOf = el => el.getBoundingClientRect().top + scrollY;
    const lsY = i => Math.max(0, topOf(secs[i].ls) - hdrH());
    const bodyY = i => topOf(secs[i].body) - hdrH();
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    let locked = false; const lock = on => { locked = on; };
    addEventListener('touchmove', e => { if (locked) e.preventDefault(); }, { passive: false });
    addEventListener('keydown', e => { if (locked && ['ArrowDown','ArrowUp','PageDown','PageUp',' ','Home','End'].includes(e.key)) e.preventDefault(); });
    let ride = null, lastY = scrollY;
    secs.forEach(s => {
      s.lin = s.ls.querySelector('.ls-in'); s.copy = s.ls.querySelector('.ls-copy');
      s.ind = s.ls.querySelector('.sk-ind'); s.door = s.ls.querySelector('.sk-door'); s.beam = s.ls.querySelector('.sk-beam'); s.nm = s.ls.querySelector('.ls-name');
      s.from = '0' + Math.max(1, s.n - 1); s.to = '0' + s.n;
    });
    const fill = s => {
      if (s.filled) return; s.filled = true;
      s.copy.className = 'ls-copy ' + s.el.className; s.copy.setAttribute('style', s.el.getAttribute('style') || ''); s.copy.dataset.tone = s.el.dataset.tone || '';
      const b = document.createElement('div'); b.className = 'wrap fl-body go'; b.appendChild(s.el.querySelector('.tc').cloneNode(true));
      s.copy.replaceChildren(b);
    };
    /* p: 0 — лифт закрыт (табло — прошлый этаж), 1 — титр этажа на месте */
    const draw = (s, p) => {
      const tr = clamp(p / .28), open = ease(clamp((p - .3) / .36)), pan = ease(clamp((p - .68) / .32));
      s.ind.textContent = (s.n === 1 || tr > .5) ? s.to : s.from;
      s.beam.style.opacity = (Math.min(1, Math.sin(Math.PI * tr) * 1.6) * (open < .02 ? 1 : 0)).toFixed(3); s.beam.style.setProperty('--bp', (tr * 100).toFixed(1) + '%');
      s.nm.style.opacity = clamp((tr - .45) / .4).toFixed(3);
      s.ls.style.setProperty('--o', open.toFixed(4));
      s.lin.style.transform = `translate3d(${(-pan * 100).toFixed(3)}vw,0,0)`;
      s.copy.style.transform = `translate3d(${((1 - pan) * 100).toFixed(3)}vw,0,0)`;
    };
    secs.forEach(s => draw(s, 0));
    const begin = (i, p) => {
      const s = secs[i]; fill(s); s.body.classList.add('go');
      ride = { s, i, p, start: p, target: p, auto: false, last: performance.now() };
      lock(true); scrollTo({ top: lsY(i), behavior: 'instant' }); draw(s, p);
      window.__glFloor = s.n;
    };
    const finish = () => {
      const r = ride; ride = null;
      if (r.p >= 1) {
        r.s.body.classList.add('arrived');
        lock(false); scrollTo({ top: bodyY(r.i), behavior: 'instant' });
        requestAnimationFrame(() => draw(r.s, 0));
      } else { lock(false); draw(r.s, 0); scrollTo({ top: lsY(r.i), behavior: 'instant' }); }
      lastY = scrollY;
    };
    const tick = () => {
      if (ride) {
        const now = performance.now();
        if (!ride.auto && now - ride.last > 650) { ride.auto = true; ride.target = ride.start < .5 ? (ride.p > .3 ? 1 : 0) : (ride.p < .7 ? 0 : 1); }
        ride.p += (ride.target - ride.p) * (ride.auto ? .13 : .18);
        if (Math.abs(ride.target - ride.p) < (ride.auto ? .015 : .002)) ride.p = ride.target;
        draw(ride.s, ride.p);
        if (ride.auto && (ride.p === 0 || ride.p === 1)) finish();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const nudge = d => { ride.target = clamp(ride.target + d); ride.auto = false; ride.last = performance.now(); };
    const intro = () => root.classList.contains('intro-on') || root.classList.contains('nav-in');
    const near = (y, v) => Math.abs(y - v) <= 40;
    const landingAt = y => secs.findIndex((s, i) => near(y, lsY(i)));
    const titleAt = y => secs.findIndex((s, i) => y >= bodyY(i) - 3 && y <= bodyY(i) + 60);
    const K = 1500;
    let snapping = false;
    const snap = to => {                                         // короткий доезд 350 мс, ввод на это время заблокирован
      if (snapping) return; snapping = true; lock(true);
      const from = scrollY, t0 = performance.now(), D = 350;
      const st = now => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
        scrollTo({ top: from + (to - from) * e, behavior: 'instant' });
        if (k < 1) requestAnimationFrame(st); else { scrollTo({ top: Math.round(to), behavior: 'instant' }); lastY = scrollY; setTimeout(() => { snapping = false; lock(false); lastY = scrollY; }, 260); } };
      requestAnimationFrame(st);
    };
    addEventListener('wheel', e => {
      if (intro()) return;
      if (snapping) { e.preventDefault(); return; }
      if (ride) { e.preventDefault(); if (ride.p > .9 && e.deltaY > 0) { ride.auto = true; ride.target = 1; } else if (ride.p < .1 && e.deltaY < 0) { ride.auto = true; ride.target = 0; } else nudge(e.deltaY / K); return; }
      const y = scrollY;
      if (e.deltaY > 0) {
        const i = landingAt(y);
        if (i >= 0) { e.preventDefault(); begin(i, 0); nudge(e.deltaY / K); return; }
        const j = secs.findIndex((s, k) => y < lsY(k) && y + e.deltaY >= lsY(k) - innerHeight * .35);   // лифт выезжает и встаёт на место
        if (j >= 0) { e.preventDefault(); snap(lsY(j)); }
      } else if (e.deltaY < 0) {
        const i = titleAt(y);
        if (i >= 0) { e.preventDefault(); begin(i, 1); nudge(e.deltaY / K); }
      }
    }, { passive: false });
    /* инерция, полоса прокрутки, телефон: заехали на площадку — лифт встаёт и ведётся пальцем */
    addEventListener('scroll', () => {
      if (ride || intro() || snapping) { lastY = scrollY; return; }
      const y = scrollY, down = y > lastY; lastY = y;
      secs.forEach((s, i) => {
        if (y > lsY(i) + 3 && y < bodyY(i) - 3) { if (down) begin(i, 0); else begin(i, 1); return; }
        const top = s.ls.getBoundingClientRect().top - hdrH();
        if (down && top > 3 && top < innerHeight * .6) snap(lsY(i));          // площадка показалась — доезжаем ровно
      });
    }, { passive: true });
    let ty = null;
    addEventListener('touchstart', e => { ty = e.touches[0].clientY; }, { passive: true });
    addEventListener('touchmove', e => {
      if (ty == null || intro()) return;
      const y = e.touches[0].clientY, dy = ty - y;
      if (ride) { e.preventDefault(); nudge(dy / (innerHeight * .8)); ty = y; return; }
      if (dy > 6) { const i = landingAt(scrollY); if (i >= 0) { e.preventDefault(); begin(i, 0); nudge(dy / (innerHeight * .8)); ty = y; } }
      else if (dy < -6) { const i = titleAt(scrollY); if (i >= 0) { e.preventDefault(); begin(i, 1); nudge(dy / (innerHeight * .8)); ty = y; } }
    }, { passive: false });
    addEventListener('touchend', () => { ty = null; if (ride) { ride.auto = true; ride.target = ride.start < .5 ? (ride.p > .18 ? 1 : 0) : (ride.p < .82 ? 0 : 1); } }, { passive: true });
    addEventListener('keydown', e => {
      const d = ['ArrowDown', 'PageDown', ' '].includes(e.key) ? 1 : ['ArrowUp', 'PageUp'].includes(e.key) ? -1 : 0;
      if (!d || intro()) return;
      if (ride) { e.preventDefault(); ride.auto = true; ride.target = d > 0 ? 1 : 0; return; }
      const i = d > 0 ? landingAt(scrollY) : titleAt(scrollY);
      if (i >= 0) { e.preventDefault(); begin(i, d > 0 ? 0 : 1); ride.auto = true; ride.target = d > 0 ? 1 : 0; }
    });
    /* кнопка «Следующий этаж» */
    document.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', async () => {
      if (ride) return;
      const i = secs.findIndex(s => s.el.contains(b)) + 1; if (i <= 0 || i >= secs.length) return;
      scrollTo({ top: lsY(i), behavior: 'smooth' });
      await new Promise(r => setTimeout(r, 700));
      begin(i, 0); ride.auto = true; ride.target = 1;
    }));
    window.__glRide = () => ({ ride: ride && { i: ride.i, p: +ride.p.toFixed(3) }, y: scrollY, ls: secs.map((s, i) => lsY(i)), body: secs.map((s, i) => bodyY(i)) });
    window.__glGoFloor = n => { ride = null; lock(false); secs[n - 1].body.classList.add('go', 'arrived'); scrollTo({ top: bodyY(n - 1), behavior: 'instant' }); };
    addEventListener('hashchange', () => { const m = location.hash.match(/floor-(\d)/); if (m) window.__glGoFloor(+m[1]); });
    if (location.hash.match(/floor-(\d)/)) setTimeout(() => window.__glGoFloor(+location.hash.match(/floor-(\d)/)[1]), 60);
    const fbg = document.getElementById('floorBg');
    if (fbg) {
      const bio = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { const f = en.target.closest('.fl'); fbg.style.setProperty('--fbg', f.dataset.bg); if (!ride) window.__glFloor = +f.dataset.floor; } }), { rootMargin: '-40% 0px -40% 0px' });
      secs.forEach(s => bio.observe(s.body));
    }
  }

  /* ---------- Табло этажа в шапке: цифра и стрелка направления ---------- */
  const reel = document.getElementById('hfReel'), hfName = document.getElementById('hfName');
  const arrow = document.getElementById('hfArrow');
  let floorNow = reel ? Math.round(-parseFloat((reel.style.transform.match(/-?[\d.]+/) || [0])[0]) / 28) + 1 : 1;
  if (arrow) {
    let lastY = scrollY, idle;
    addEventListener('scroll', () => {
      const y = scrollY; if (Math.abs(y - lastY) < 4) return;
      arrow.classList.add('go'); arrow.classList.toggle('down', y > lastY); lastY = y;
      clearTimeout(idle); idle = setTimeout(() => arrow.classList.remove('go'), 700);
    }, { passive: true });
  }
  const floors = document.querySelectorAll('[data-floor]');
  if (reel && floors.length) {
    const fio = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return;
      floorNow = +en.target.dataset.floor;
      reel.style.transform = `translateY(${-(floorNow - 1) * 28}px)`;
      hfName.textContent = en.target.dataset.name;
    }), { rootMargin: '-45% 0px -50% 0px' });
    floors.forEach(f => fio.observe(f));
  }

  /* ---------- Переход между разделами — поездка: двери закрываются на этом этаже, свет по шву,
     табло меняет этаж, на новой странице открываются двери нужной кабины. Внутри раздела — мягко, без лифта ---------- */
  const nl = document.getElementById('navlift');
  const FL = { '': 1, 'o-kompanii': 1, 'obekty': 1, 'zapchasti': 2, 'korzina': 2, 'dostavka': 2, 'podbor-po-foto': 2, 'servis': 3, 'ustroystvo': 3, 'kontakty': 4, 'holl': 4 };
  const NAMES = { 1: ['Этаж первый', 'О компании'], 2: ['Этаж второй', 'Запчасти'], 3: ['Этаж третий', 'Монтаж и сервис'], 4: ['Этаж четвёртый', 'Контакты'] };
  const base = new URL((document.querySelector('.hdr-logo') || {}).href || './', location.href).pathname;
  const sect = u => { const p = new URL(u, location.href).pathname; return p.startsWith(base) ? p.slice(base.length).split('/')[0] : p; };
  const floorOf = u => { const m = String(u).match(/#floor-(\d)/); if (m) return +m[1]; return FL[sect(u)] || 1; };
  const R = nl ? nl.dataset.r || '' : '';
  const setNl = (cabN, num, nameN) => {
    if (!nl) return;
    if (cabN) document.getElementById('nlCab').src = R + 'assets/shaft/sk-cab-' + cabN + '.webp';
    document.getElementById('nlNum').textContent = '0' + num;
    const nm = document.getElementById('nlName'); if (nameN) { nm.querySelector('span').textContent = NAMES[nameN][0]; nm.querySelector('b').textContent = NAMES[nameN][1]; }
  };
  if (root.classList.contains('nav-in') && nl) {
    let from = 1, to = floorOf(location.href);
    try { const v = sessionStorage.getItem('gl-nav') || ''; const m = v.match(/^(\d)>(\d)$/); if (m) { from = +m[1]; to = +m[2]; } sessionStorage.removeItem('gl-nav'); } catch (e) {}
    setNl(to, from, to);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    (async () => {
      await Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), wait(600)]);
      nl.classList.add('trav'); await wait(450);
      setNl(0, to, to); nl.classList.add('named'); await wait(450);
      nl.classList.remove('trav'); nl.classList.add('go'); await wait(1000);
      nl.classList.add('pan'); await wait(900);
      root.classList.remove('nav-in'); setTimeout(() => nl.classList.remove('pan', 'go', 'named'), 400);
    })();
  }
  const go = href => {
    location.href = href; return;   // поездки между страницами теперь ведёт здание на главной
    if (reduce || !nl) { location.href = href; return; }
    const from = sect(location.href) === '' ? (window.__glFloor || 1) : floorOf(location.href), to = floorOf(href);
    if (from === to && !/#floor-/.test(href)) { location.href = href; return; }
    try { sessionStorage.setItem('gl-nav', from + '>' + to); } catch (e) {}
    setNl(from, from, from);
    nl.classList.remove('go', 'named', 'trav'); nl.classList.add('on');
    setTimeout(() => nl.classList.add('shut'), 300);
    setTimeout(() => { location.href = href; }, 1100);
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    const href = a.getAttribute('href');
    if (/^(tel:|mailto:|https?:|#)/.test(href)) return;
    const url = new URL(a.href, location.href);
    if (url.pathname === location.pathname && url.hash) return;   // якорь на этой же странице
    e.preventDefault();
    const key = a.closest('.lm-keys') || a.closest('.plan');
    if (key) { a.classList.add('lit'); setTimeout(() => go(a.href), 260); } else go(a.href);
  });
  addEventListener('pageshow', e => { if (!e.persisted) return; root.classList.remove('soft-out', 'nav-in'); if (nl) nl.classList.remove('on', 'shut', 'trav', 'named', 'go', 'pan'); });

  /* ---------- Меню: лифтовая панель ---------- */
  const lm = document.getElementById('liftmenu');
  const lmFloor = document.getElementById('lmFloor');
  const menuBtn = document.querySelector('[data-menu-open]');
  const here = location.pathname.replace(/index\.html$/, '');
  lm.querySelectorAll('.pl-f').forEach(a => {
    const p = new URL(a.href, location.href).pathname.replace(/index\.html$/, '');
    if (p === here) a.classList.add('here');
  });
  lm.querySelectorAll('.lm-keys a').forEach(a => {
    if (new URL(a.href, location.href).pathname === here && here !== new URL(document.querySelector('.hdr-logo').href, location.href).pathname) a.classList.add('here');
    const p = new URL(a.href, location.href).pathname.replace(/index\.html$/, '');
    if (p === here) a.setAttribute('aria-current', 'page');
  });
  const openMenu = () => {
    const fl = window.__glFloor || floorNow; lmFloor.textContent = String(fl).padStart(2, '0');
    if (window.__glFloor) lm.querySelectorAll('.lm-keys a').forEach((a, i) => a.classList.toggle('here', i + 1 === fl));
    if (window.__glFloor) { const ps = [...lm.querySelectorAll('.pl-f')].reverse(); ps.forEach((a, i) => a.classList.toggle('here', i + 1 === fl)); } lm.classList.add('open'); lm.setAttribute('aria-hidden', 'false'); menuBtn.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; setTimeout(() => lm.querySelector('.lm-keys a').focus(), 60); };
  const closeMenu = () => { lm.classList.remove('open'); lm.setAttribute('aria-hidden', 'true'); menuBtn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; menuBtn.focus(); };
  menuBtn.addEventListener('click', openMenu);
  lm.addEventListener('click', e => { if (e.target === lm || e.target.closest('[data-menu-close]')) closeMenu(); if (e.target.closest('[data-cart-open]')) closeMenu(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && lm.classList.contains('open')) closeMenu(); });

  /* ---------- Формы «вопрос или фото» ---------- */
  document.querySelectorAll('[data-ask]').forEach(form => {
    const span = form.querySelector('.file span');
    form.photo.addEventListener('change', () => { span.textContent = form.photo.files[0] ? form.photo.files[0].name : 'Прикрепить фото шильдика'; });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const st = form.querySelector('.ask-status');
      if (!form.phone.value.trim()) { st.textContent = 'Укажите телефон — по нему перезвоним.'; form.phone.focus(); return; }
      if (!form.agree.checked) { st.textContent = 'Отметьте согласие на обработку данных.'; return; }
      window.glSend(form, st);
    });
  });
})();

/* ---------- Шахта вместо полосы прокрутки: этажи и кабинка ---------- */
(() => {
  const home = document.body.classList.contains('home');
  let marks = [];
  if (home) {
    marks = [...document.querySelectorAll('section.fl')].map(s => ({ el: s.querySelector('.fl-body'), n: s.dataset.floor.padStart(2, '0'), name: s.dataset.name }));
  } else {
    const ps = document.querySelector('.psign');
    if (ps) marks.push({ el: ps, n: '↑', name: 'Начало' });
    document.querySelectorAll('main .sec-t, main .sect, main .faq2, main .prod2, main .grid, main .phone-plq').forEach(el => {
      if (el.closest('.sect') && !el.classList.contains('sect')) return;
      const t = el.querySelector && el.querySelector('.sec-t');
      marks.push({ el, n: String(marks.length).padStart(2, '0'), name: t ? t.textContent : '' });
    });
  }
  const bar = document.createElement('nav');
  bar.className = 'shaftbar'; bar.setAttribute('aria-label', home ? 'Этажи' : 'Разделы страницы');
  bar.innerHTML = '<span class="sb-line"></span><span class="sb-cab" role="slider" tabindex="-1" aria-label="Положение на странице"></span>';
  document.body.appendChild(bar);
  const cab = bar.querySelector('.sb-cab');
  const ticks = marks.map(m => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sb-tick';
    b.innerHTML = `<b>${m.n}</b><span>${m.name || ''}</span>`;
    b.addEventListener('click', () => { if (home && window.__glGoFloor) { window.__glGoFloor(parseInt(m.n, 10)); return; } const y = m.el.getBoundingClientRect().top + scrollY - (document.querySelector('.hdr')?.offsetHeight || 76); scrollTo({ top: y, behavior: 'smooth' }); });
    bar.appendChild(b); return b;
  });
  let H = 1, T = 1, hideT;
  const place = () => {
    H = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    T = bar.clientHeight;
    marks.forEach((m, i) => {
      const y = Math.min(1, Math.max(0, (m.el.getBoundingClientRect().top + scrollY - 80) / H));
      ticks[i].style.top = (y * T) + 'px';
    });
  };
  const upd = () => {
    const p = Math.min(1, Math.max(0, scrollY / H));
    cab.style.transform = `translate3d(-50%, ${(p * (T - 30)).toFixed(1)}px, 0)`;
    const cy = p * (T - 30) + 15;
    let cur = -1; ticks.forEach((t, i) => { const ty = parseFloat(t.style.top) || 0; const passed = ty <= cy + 2; t.classList.toggle('lit', passed); if (passed) cur = i; });
    ticks.forEach((t, i) => t.classList.toggle('on', i === cur));
    /* цвет шахты подстраивается под фон этажа или страницы */
    let tone = document.body.dataset.tone || 'dark';
    if (home) { const onLift = [...document.querySelectorAll('.liftsec')].some(l => { const r = l.getBoundingClientRect(); return r.top < innerHeight * .5 && r.bottom > innerHeight * .5; }); const fl = marks[Math.max(cur, 0)] && marks[Math.max(cur, 0)].el.closest('.fl'); tone = onLift ? 'light' : (fl ? fl.dataset.tone : 'dark'); }
    bar.dataset.tone = tone;
    bar.classList.add('show'); clearTimeout(hideT); hideT = setTimeout(() => bar.classList.remove('show'), 1600);
  };
  let tk = false;
  addEventListener('scroll', () => { if (!tk) { tk = true; requestAnimationFrame(() => { tk = false; upd(); }); } }, { passive: true });
  addEventListener('resize', () => { place(); upd(); });
  addEventListener('load', () => { place(); upd(); });
  /* кабинку можно тянуть, как обычный ползунок */
  let drag = false;
  const toScroll = e => { const r = bar.getBoundingClientRect(); const p = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)); scrollTo(0, p * H); };
  cab.addEventListener('pointerdown', e => { drag = true; cab.setPointerCapture(e.pointerId); e.preventDefault(); });
  cab.addEventListener('pointermove', e => { if (drag) toScroll(e); });
  cab.addEventListener('pointerup', () => { drag = false; });
  bar.querySelector('.sb-line').addEventListener('click', toScroll);
  place(); upd();
})();
/* ---------- Заявка, каталог, вкладки ---------- */
(() => {
  const KEY = 'gl-cart';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const save = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} };
  let cart = load();
  const drawer = document.getElementById('drawer');
  const lines = document.getElementById('cartLines');
  const toast = document.getElementById('toast');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const render = () => {
    const total = cart.reduce((n, i) => n + i.q, 0);
    document.querySelectorAll('[data-cart-count]').forEach(el => el.textContent = total);
    lines.innerHTML = cart.length
      ? cart.map((i, k) => `<div class="line"><div><b>${esc(i.b)} ${esc(i.a)}</b><span>${esc(i.n)}</span></div>
          <div class="qty"><button type="button" data-q="${k}" data-d="-1" aria-label="Меньше">−</button><output>${i.q}</output><button type="button" data-q="${k}" data-d="1" aria-label="Больше">+</button></div>
          <button class="rm" type="button" data-rm="${k}" aria-label="Убрать">×</button></div>`).join('')
      : `<div class="drawer-empty">${(document.getElementById('emEmpty') || {}).innerHTML || ''}<p>Заявка пуста. Добавьте детали из каталога или опишите задачу и пришлите фото — подберём сами.</p></div>`;
    document.querySelectorAll('.cart-ico').forEach(ic => ic.classList.toggle('has', total > 0));
    document.querySelectorAll('[data-add]').forEach(b => {
      const d = JSON.parse(b.dataset.add), inCart = cart.some(i => i.s === d.s && i.a === d.a);
      b.classList.toggle('in', inCart);
      const label = b.querySelector('span');
      if (label) label.textContent = inCart ? 'В запросе' : 'Добавить в запрос';
    });
  };
  const say = t => { toast.textContent = t; toast.classList.add('show'); clearTimeout(say.t); say.t = setTimeout(() => toast.classList.remove('show'), 2200); };
  const bump = () => document.querySelectorAll('.hdr-cart').forEach(b => { b.classList.add('bump'); setTimeout(() => b.classList.remove('bump'), 300); });

  let last;
  const open = photo => {
    last = document.activeElement;
    drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => (photo ? drawer.querySelector('.file input') : drawer.querySelector('.drawer-head .ico')).focus(), 50);
  };
  const close = () => {
    drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; if (last) last.focus();
  };
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const d = JSON.parse(add.dataset.add), f = cart.find(i => i.s === d.s && i.a === d.a);
      if (f) f.q++; else cart.push({ ...d, q: 1 });
      save(cart);
      /* деталь летит в корзину в шапке; цифра щёлкает, когда долетела */
      const tgt = [...document.querySelectorAll('.hdr-cart')].find(x => x.offsetParent);
      const done = () => {
        render(); bump(); say(`${d.b} ${d.a} — в заявке`);
        document.querySelectorAll('[data-cart-count]').forEach(el => { el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip'); });
        document.querySelectorAll('.cart-ico').forEach(ic => { ic.classList.remove('got'); void ic.getBoundingClientRect(); ic.classList.add('got'); });
      };
      if (tgt && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const a = add.getBoundingClientRect(), b = tgt.getBoundingClientRect();
        const fl = document.createElement('div'); fl.className = 'fly';
        fl.innerHTML = '<svg viewBox="0 0 44 30" width="44" height="30"><use href="#flyBoard"/></svg>';
        document.body.appendChild(fl);
        const x0 = a.left + a.width / 2 - 22, y0 = a.top - 30, x1 = b.left + b.width / 2 - 22, y1 = b.top;
        const mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 90;
        fl.animate([{ transform: `translate(${x0}px,${y0}px)`, opacity: 1 }, { transform: `translate(${mx}px,${my}px) scale(.85) rotate(-8deg)`, opacity: 1, offset: .5 }, { transform: `translate(${x1}px,${y1}px) scale(.3)`, opacity: .25 }],
          { duration: 600, easing: 'cubic-bezier(.45,0,.3,1)' }).onfinish = () => { fl.remove(); done(); };
      } else done();
      return;
    }
    const q = e.target.closest('[data-q]');
    if (q) { const i = cart[+q.dataset.q]; i.q = Math.max(1, i.q + +q.dataset.d); save(cart); render(); return; }
    const rm = e.target.closest('[data-rm]');
    if (rm) { cart.splice(+rm.dataset.rm, 1); save(cart); render(); return; }
    const op = e.target.closest('[data-cart-open]');
    if (op) { open(op.hasAttribute('data-photo')); return; }
    if (e.target.closest('[data-cart-close]')) close();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) close(); });

  const form = document.getElementById('order');
  const fileSpan = form.querySelector('.file span');
  form.photo.addEventListener('change', () => { fileSpan.textContent = form.photo.files[0] ? form.photo.files[0].name : 'Прикрепить фото детали или шильдика'; });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const st = form.querySelector('.order-status');
    if (!form.phone.value.trim()) { st.textContent = 'Укажите телефон — по нему перезвоним.'; form.phone.focus(); return; }
    if (!form.agree.checked) { st.textContent = 'Отметьте согласие на обработку данных.'; return; }
    if (!cart.length && !form.photo.files[0] && !form.msg.value.trim()) { st.textContent = 'Добавьте деталь, фото или опишите задачу.'; return; }
    window.glSend(form, st, cart);
  });
  render();

  /* ---------- Страница корзины и оформление ---------- */
  const cpLines = document.getElementById('cpLines');
  if (cpLines) {
    const cpEmpty = document.getElementById('cpEmpty'), cpSum = document.getElementById('cpSum');
    const plural = n => n % 10 === 1 && n % 100 !== 11 ? 'позиция' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'позиции' : 'позиций';
    const draw = () => {
      cpLines.innerHTML = cart.map((i, k) => `<div class="cp-line"><a href="../zapchasti/${esc(i.s)}/"><b>${esc(i.a)}</b><span>${esc(i.b)} · ${esc(i.n)}</span></a>
        <div class="qty"><button type="button" data-q="${k}" data-d="-1" aria-label="Меньше">−</button><output>${i.q}</output><button type="button" data-q="${k}" data-d="1" aria-label="Больше">+</button></div>
        <em>по запросу</em><button class="rm" type="button" data-rm="${k}" aria-label="Убрать">×</button></div>`).join('');
      const total = cart.reduce((n, i) => n + i.q, 0);
      cpEmpty.hidden = cart.length > 0;
      cpSum.textContent = cart.length ? `${cart.length} ${plural(cart.length)}, ${total} шт. Цена и срок — после проверки совместимости.` : '';
    };
    draw();
    document.addEventListener('click', e => { if (e.target.closest('[data-q],[data-rm]')) setTimeout(draw, 0); });
    const f = document.getElementById('checkout');
    const comp = f.querySelector('.cp-company');
    f.querySelectorAll('input[name=who]').forEach(r => r.addEventListener('change', () => { comp.hidden = f.who.value !== 'company'; }));
    const addr = f.querySelector('.cp-addr');
    f.querySelectorAll('input[name=ship]').forEach(r => r.addEventListener('change', () => { addr.hidden = f.ship.value === 'self'; }));
    const fs = f.querySelector('.cp-file span');
    f.photo.addEventListener('change', () => { fs.textContent = f.photo.files[0] ? f.photo.files[0].name : 'Прикрепить фото шильдика'; });
    f.addEventListener('submit', e => {
      e.preventDefault();
      const st = f.querySelector('.cp-status');
      if (!f.phone.value.trim()) { st.textContent = 'Укажите телефон — по нему перезвоним.'; f.phone.focus(); return; }
      if (!cart.length && !f.photo.files[0] && !f.msg.value.trim()) { st.textContent = 'Добавьте деталь из каталога, фото или опишите задачу.'; return; }
      if (!f.agree.checked) { st.textContent = 'Отметьте согласие на обработку данных.'; return; }
      const num = 'GL-' + String(Date.now()).slice(-5);
      const done = document.getElementById('cpDone');
      done.querySelector('.cp-num').textContent = `Заказ ${num} принят (демо: отправка заработает после подключения сервера)`;
      f.hidden = true; done.hidden = false;
      cart = []; save(cart); render(); draw();
      done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /* Каталог: поиск, марки, разделы */
  const grid = document.getElementById('grid');
  if (grid) {
    const cards = [...grid.querySelectorAll(':scope > .card')];
    const norm = s => s.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '');
    cards.forEach(c => c._n = norm(c.dataset.q));
    const q = document.getElementById('q'), found = document.getElementById('found'), empty = document.getElementById('empty'), reset = document.getElementById('reset');
    const p0 = new URLSearchParams(location.search);
    const st = { q: p0.get('q') || '', brand: (p0.get('brand') || '').toLowerCase(), cat: p0.get('cat') || '' };
    q.value = st.q;
    const plural = n => n % 10 === 1 && n % 100 !== 11 ? 'позиция' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'позиции' : 'позиций';
    const STEP = 36; let lim = STEP, lastKey = '';
    const more = document.getElementById('more');
    const apply = () => {
      const nq = norm(st.q); let n = 0;
      const key = nq + '|' + st.brand + '|' + st.cat; if (key !== lastKey) { lim = STEP; lastKey = key; }
      cards.forEach(c => {
        const ok = (!nq || c._n.includes(nq)) && (!st.brand || c.dataset.brand === st.brand) && (!st.cat || c.dataset.cat === st.cat);
        if (ok) n++;
        c.hidden = !ok || n > lim;
      });
      const shelves = document.getElementById('shelves'), filt = !!(nq || st.brand || st.cat);
      if (shelves) { shelves.hidden = filt; grid.hidden = !filt; }
      if (more) { more.hidden = n <= lim; more.textContent = `Показать ещё — ${Math.min(STEP, n - lim)} из ${n - lim}`; }
      found.textContent = `${n} ${plural(n)}`;
      empty.hidden = n > 0;
      reset.hidden = !(st.q || st.brand || st.cat);
      document.querySelectorAll('.chips button').forEach(b => b.setAttribute('aria-pressed', b.dataset.brand === st.brand));
      document.querySelectorAll('.cats button').forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === st.cat));
      const p = new URLSearchParams(); if (st.q) p.set('q', st.q); if (st.brand) p.set('brand', st.brand); if (st.cat) p.set('cat', st.cat);
      history.replaceState(null, '', p.toString() ? '?' + p : location.pathname);
    };
    q.addEventListener('input', () => { st.q = q.value; apply(); });
    document.getElementById('searchForm').addEventListener('submit', e => { e.preventDefault(); st.q = q.value; apply(); grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    document.querySelectorAll('.chips button').forEach(b => b.addEventListener('click', () => { st.brand = st.brand === b.dataset.brand ? '' : b.dataset.brand; apply(); }));
    document.querySelectorAll('.cats button').forEach(b => b.addEventListener('click', () => { st.cat = st.cat === b.dataset.cat ? '' : b.dataset.cat; apply(); }));
    reset.addEventListener('click', () => { st.q = st.brand = st.cat = ''; q.value = ''; apply(); });
    if (more) more.addEventListener('click', () => { lim += STEP; apply(); });
    document.querySelectorAll('[data-shelf]').forEach(b => b.addEventListener('click', () => { st.cat = b.dataset.shelf; apply(); grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    if (location.hash === '#q') q.focus();
    addEventListener('hashchange', () => { if (location.hash === '#q') { q.focus(); q.scrollIntoView({ block: 'center' }); } });
    apply();
  }

  /* Вкладки карточки */
  const tabs = [...document.querySelectorAll('[role=tab]')];
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => { const on = x === t; x.setAttribute('aria-selected', on); document.getElementById(x.getAttribute('aria-controls')).hidden = !on; });
  }));
})();

/* ---------- Вопросы: оглавление слева, ответ справа ---------- */
document.querySelectorAll('[data-qa]').forEach(qa => {
  qa.addEventListener('click', e => {
    const b = e.target.closest('.qa-q'); if (!b) return;
    qa.querySelectorAll('.qa-i').forEach(i => {
      const on = i.contains(b);
      i.classList.toggle('on', on);
      i.querySelector('.qa-q').setAttribute('aria-expanded', on ? 'true' : 'false');
    });
  });
});

/* ---------- Эмблемы: колокол тревоги качается один раз ---------- */
(() => {
  const bells = document.querySelectorAll('.em.alarm');
  const ring = el => { el.classList.remove('go'); void el.getBoundingClientRect(); el.classList.add('go'); };
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { ring(en.target); io.unobserve(en.target); } }), { threshold: .6 });
  bells.forEach(b => { io.observe(b); (b.closest('a,button') || b).addEventListener('mouseenter', () => ring(b)); });
})();

/* ---------- Разовые «оживления»: рисунки, эмблемы — один раз при появлении ---------- */
(() => {
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('rv'); io.unobserve(en.target); } }), { threshold: .35 });
  document.querySelectorAll('[data-reveal], .em').forEach(el => io.observe(el));
  /* эмблемы: короткое движение и при наведении на карточку */
  document.querySelectorAll('.em').forEach(em => {
    const host = em.closest('a, button, .desk-c, .dn, .perks li') || em;
    host.addEventListener('mouseenter', () => { em.classList.remove('rv'); void em.getBoundingClientRect(); em.classList.add('rv'); });
  });
  /* подсказки на разрезе шахты: касание на телефоне открывает, второе — закрывает */
  document.querySelectorAll('.sf-pt').forEach(pt => pt.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const on = pt.classList.contains('open');
    document.querySelectorAll('.sf-pt.open').forEach(x => x.classList.remove('open'));
    if (!on) pt.classList.add('open');
  }));
})();

/* ---------- Единая рамка титра: считаем, где начинается цветная полоса (под шапкой) ---------- */
(() => {
  const fit = () => {
    const hb = (document.querySelector('.hdr') || {}).getBoundingClientRect ? document.querySelector('.hdr').getBoundingClientRect().bottom + scrollY : 0;
    const vw = document.documentElement.clientWidth;
    document.querySelectorAll('.ttl-band').forEach(el => { const r = el.getBoundingClientRect(); el.style.setProperty('--bt', Math.max(0, r.top + scrollY - hb) + 'px'); el.style.setProperty('--bl', r.left + 'px'); el.style.setProperty('--br', (vw - r.right) + 'px'); });
  };
  document.querySelectorAll('.pg .page>.wrap>.psign, .title-shop, .title-prod').forEach(el => el.classList.add('ttl-band'));
  fit(); let _w2 = innerWidth; addEventListener('resize', () => { if (innerWidth !== _w2) { _w2 = innerWidth; fit(); } }); addEventListener('load', fit);
})();
/* ---------- Подсказки шахты: не исчезают, пока ведёте мышь к ним ---------- */
document.querySelectorAll('.sf-pt').forEach(pt => {
  let t; pt.addEventListener('mouseenter', () => { clearTimeout(t); pt.classList.add('hov'); });
  pt.addEventListener('mouseleave', () => { t = setTimeout(() => pt.classList.remove('hov'), 380); });
});

/* ---------- Подсказки шахты: закрываются по нажатию на свободное место ---------- */
document.addEventListener('click', e => { if (!e.target.closest('.sf-pt')) document.querySelectorAll('.sf-pt.open,.sf-pt.hov').forEach(x => x.classList.remove('open', 'hov')); });
/* ---------- Заголовок внутренних страниц — в одну строку: подгоняем размер под ширину ---------- */
(() => {
  const fitT = () => document.querySelectorAll('.pg .psign .mx-t').forEach(t => {
    t.style.fontSize = ''; const max = parseFloat(getComputedStyle(t).fontSize), box = t.parentElement.clientWidth * .96;
    let f = max; t.style.whiteSpace = 'nowrap';
    while (t.scrollWidth > box && f > 26) { f -= 2; t.style.fontSize = f + 'px'; }
    if (t.scrollWidth > box) t.style.whiteSpace = 'normal';
  });
  fitT(); let _w1 = innerWidth; addEventListener('resize', () => { if (innerWidth !== _w1) { _w1 = innerWidth; fitT(); } }); if (document.fonts) document.fonts.ready.then(fitT);
})();

/* ---------- Вкладки «Лифт · Эскалатор» ---------- */
document.querySelectorAll('[data-tabs]').forEach(t => t.addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  t.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
  t.querySelectorAll('[data-pane]').forEach(p => { const on = p.dataset.pane === b.dataset.tab; p.classList.toggle('on', on); if (on) p.querySelectorAll('[data-reveal]').forEach(r => r.classList.add('rv')); });
  dispatchEvent(new Event('resize'));
}));

/* ---------- 3D и разрез в одной рамке ---------- */
document.querySelectorAll('.viz').forEach(v => v.querySelector('.viz-sw')?.addEventListener('click', e => {
  const b = e.target.closest('[data-viz]'); if (!b) return;
  v.querySelectorAll('[data-viz]').forEach(x => x.classList.toggle('on', x === b));
  v.querySelectorAll('[data-p]').forEach(p => { const on = p.dataset.p === b.dataset.viz; p.classList.toggle('on', on); if (on) p.querySelectorAll('[data-reveal]').forEach(r => r.classList.add('rv')); });
  dispatchEvent(new Event('resize'));
}));
/* ---------- заголовки этажей главной — в одну строку на ПК ---------- */
(() => { const fit = () => { if (innerWidth < 900) return; document.querySelectorAll('.home .fl .mx-t').forEach(t => {
  t.style.fontSize = ''; t.style.whiteSpace = 'nowrap'; const box = (t.closest('.mx-sign') || t.parentElement).clientWidth * .9; let f = parseFloat(getComputedStyle(t).fontSize);
  while (t.scrollWidth > box && f > 30) { f -= 2; t.style.fontSize = f + 'px'; } }); };
  fit(); let _w3 = innerWidth; addEventListener('resize', () => { if (innerWidth !== _w3) { _w3 = innerWidth; fit(); } }); if (document.fonts) document.fonts.ready.then(fit); })();

/* ---------- Сервис: «Лифты · Эскалаторы» переключает всю страницу; ?t=esc — сразу эскалаторы ---------- */
(() => {
  const nav = document.querySelector('[data-kinds]'); if (!nav) return;
  const set = k => {
    nav.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    document.querySelectorAll('.kind-pane').forEach(p => { const on = p.dataset.kind === k; p.classList.toggle('on', on); if (on) p.querySelectorAll('[data-reveal]').forEach(r => r.classList.add('rv')); });
    dispatchEvent(new Event('resize'));
  };
  nav.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { set(b.dataset.k); history.replaceState(null, '', b.dataset.k === 'esc' ? '?t=esc' : location.pathname); } });
  if (/[?&]t=esc/.test(location.search)) set('esc');
})();

/* ---------- Разрядка: компенсируем «хвост» после последней буквы — заголовки строго по центру ---------- */
document.querySelectorAll('.ch-t,.mc-t,.sec-t,.cta2 h2,.h2,.dp-h h2,.mx-t').forEach(e => { const ls = parseFloat(getComputedStyle(e).letterSpacing) || 0; if (ls > 1) e.style.paddingLeft = ls + 'px'; });

/* ---------- Лупа в шапке: строка поиска поверх шапки ---------- */
(() => {
  const ov = document.createElement('div'); ov.className = 'srch-ov'; ov.innerHTML = '<form><input type="search" name="q" placeholder="Артикул, марка или название детали" aria-label="Поиск по артикулу" autocomplete="off"><button type="submit">Найти</button><button type="button" class="srch-x" aria-label="Закрыть">×</button></form>';
  document.body.appendChild(ov);
  const base = (document.querySelector('.hdr-logo') || {}).getAttribute ? document.querySelector('.hdr-logo').getAttribute('href') : './';
  const close = () => ov.classList.remove('on');
  document.addEventListener('click', e => { const a = e.target.closest('a[href*="#q"]'); if (!a) return; e.preventDefault(); e.stopImmediatePropagation(); ov.classList.add('on'); setTimeout(() => ov.querySelector('input').focus(), 50); }, true);
  ov.querySelector('.srch-x').addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  ov.querySelector('form').addEventListener('submit', e => { e.preventDefault(); const q = ov.querySelector('input').value.trim(); if (!q) return; const l = q.toLowerCase();
    const SRV = [['монтаж','servis/montazh/'],['обслуж','servis/obsluzhivanie/'],['ремонт','servis/obsluzhivanie/'],['пусконалад','servis/pusk/'],['наладк','servis/pusk/'],['подбор лифт','servis/podbor/'],['доставк','dostavka/'],['оплат','dostavka/'],['контакт','kontakty/']];
    const hit = SRV.find(x => l.includes(x[0])); if (hit) { location.href = base + hit[1]; return; }
    const ESC = ['эскалат','поруч','ступен','гребён','гребен','фриз','травол'];
    location.href = base + (ESC.some(w => l.includes(w)) ? 'zapchasti/eskalatory/' : 'zapchasti/') + '?q=' + encodeURIComponent(q); });
})();

/* ---------- Переходы между этажами — через здание на главной ---------- */
(() => {
  const SLUGS = { 'o-kompanii': 1, 'zapchasti': 2, 'servis': 3, 'kontakty': 4, 'holl': 4 };
  const logo = document.querySelector('.hdr-logo'); if (!logo) return;
  const root = new URL(logo.getAttribute('href') || './', location.href);
  const floorOfUrl = u => { if (u.origin !== root.origin || !u.pathname.startsWith(root.pathname)) return -1;
    const rest = u.pathname.slice(root.pathname.length).replace(/index\.html$/, '');
    if (rest === '') return 0; const m = rest.match(/^([a-z-]+)\/$/); return m && SLUGS[m[1]] ? SLUGS[m[1]] : -1; };
  const here = floorOfUrl(new URL(location.href));
  const isHome = document.body.classList.contains('home-bld');
  const D = document.documentElement;
  // «диафрагма»: закрытие в центр экрана → темнота → открытие из центра, когда страница готова
  // занавес-диафрагма: чёрный слой с круглым «окном» по центру экрана
  const R = () => Math.hypot(innerWidth, innerHeight) / 2 + 30, ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const curtain = () => { let c = document.getElementById('irisC'); if (!c) { c = document.createElement('div'); c.id = 'irisC'; document.body.appendChild(c); } return c; };
  const hole = (c, r) => { const m = `radial-gradient(circle at 50% 50%, transparent ${r}px, #000 ${r + .6}px)`; c.style.webkitMaskImage = m; c.style.maskImage = m; };
  const run = (c, from, to, D2) => new Promise(res => { const t0 = performance.now(); const st = now => { const k = Math.min(1, (now - t0) / D2); hole(c, from + (to - from) * ease(k)); if (k < 1) requestAnimationFrame(st); else res(); }; requestAnimationFrame(st); });
  let came = false; try { came = !!sessionStorage.getItem('gl-iris'); sessionStorage.removeItem('gl-iris'); } catch (e) {}
  if (came) { const c = curtain(); hole(c, 0); D.classList.remove('iris-in');
    const open = async () => { await run(c, 0, R(), 480); c.remove(); };
    let _op=0; const go1=()=>{ if(_op) return; _op=1; setTimeout(open, 40); }; if (document.readyState !== 'loading') go1(); else addEventListener('DOMContentLoaded', go1); setTimeout(go1, 700); }
  const calmOn = () => { try { return localStorage.getItem('gl-calm') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const irisOut = async href => { if (calmOn()) { location.href = href; return; } try { sessionStorage.setItem('gl-iris', '1'); } catch (e) {} const c = curtain(); hole(c, R()); await run(c, R(), 0, 420); setTimeout(() => { location.href = href; }, 60); };
  window.__irisOut = href => irisOut(href);
  window.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('[data-search]')) return;
    const a = e.target.closest && e.target.closest('a[href]'); if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target || a.hasAttribute('download')) return;
    const href = a.getAttribute('href'); if (/^(tel:|mailto:|#)/.test(href)) return;
    const u = new URL(href, location.href); if (u.origin !== location.origin || !u.pathname.startsWith(root.pathname)) return;
    if (u.pathname === location.pathname) return;
    const to = floorOfUrl(u);
    if (isHome && to > 0 && window.__bldGo) { e.preventDefault(); e.stopImmediatePropagation(); window.__bldGo(to); return; }
    if (isHome) return;
    e.preventDefault(); e.stopImmediatePropagation(); irisOut(u.href);
  }, true);
  addEventListener('pageshow', e => { if (e.persisted) { const c = document.getElementById('irisC'); c && c.remove(); } });
  document.querySelectorAll('.esc-brands').forEach(bar => bar.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true'; bar.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const br = on ? b.dataset.brand : ''; const grid = bar.nextElementSibling; grid.querySelectorAll('.card').forEach(c => { c.hidden = !!br && c.dataset.brand !== br; }); }));
  // эмблемы оживают на любой странице: при появлении и при наведении (колокольчик качается и т. д.)  emblem-reveal
  const ems = document.querySelectorAll('svg.em'); const replay = el => { const g = el.classList.contains('go'); el.classList.remove('rv', 'go'); void el.getBoundingClientRect(); el.classList.add('rv'); if (g || el.classList.contains('alarm')) el.classList.add('go'); };
  if (ems.length) { const io2 = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { replay(e.target); io2.unobserve(e.target); } }), { threshold: .5 });
    ems.forEach(el => { io2.observe(el); (el.closest('a,button,.desk-c,.dn,.fi-c') || el).addEventListener('mouseenter', () => replay(el)); }); }
  // Лавка эскалаторов: марки и разделы — как в Лавке лифтов
  const es = document.getElementById('escStrips');
  if (es) { const setBrand = br => { document.querySelectorAll('.esc-s').forEach(sec => { let vis = 0; sec.querySelectorAll('.esc-grid .card').forEach(c => { const ok = !br || c.dataset.brand === br; c.hidden = !ok; if (ok) vis++; }); sec.hidden = !!br && !vis; }); };
    window.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-ebrand],[data-ecat]'); if (!b) return; e.stopImmediatePropagation(); e.preventDefault();
      if (b.dataset.ebrand !== undefined) { const on = b.getAttribute('aria-pressed') !== 'true'; es.querySelectorAll('[data-ebrand]').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', on ? 'true' : 'false'); setBrand(on ? b.dataset.ebrand : ''); }
      else { const t = document.getElementById(b.dataset.ecat); if (t) { t.hidden = false; scrollTo({ top: t.getBoundingClientRect().top + scrollY - 110, behavior: 'smooth' }); } } }, true); }
  // поиск в Лавке эскалаторов
  const eq = document.getElementById('escq');
  if (eq) { const run = () => { const q = eq.value.trim().toLowerCase().replace(/ё/g, 'е'); let first = null;
      document.querySelectorAll('.esc-s').forEach(sec => { let vis = 0; sec.querySelectorAll('.esc-grid .card').forEach(c => { const ok = !q || (c.dataset.q || '').replace(/ё/g, 'е').includes(q); c.hidden = !ok; if (ok) vis++; }); sec.hidden = !!q && !vis; if (vis && !first && q) first = sec; });
      return first; };
    eq.addEventListener('input', run); document.getElementById('escSearch').addEventListener('submit', e => { e.preventDefault(); const f = run(); if (f) scrollTo({ top: f.getBoundingClientRect().top + scrollY - 110, behavior: 'smooth' }); }); }
  // интертитры глав проявляются при прокрутке
  const its = document.querySelectorAll('[data-inter]'); if (its.length) { const io3 = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io3.unobserve(e.target); } }), { threshold: .3 }); its.forEach(x => io3.observe(x)); }
  // старые ссылки вида ?cat=раздел — прокрутка к разделу единой Лавки
  if (es) { const cq = new URLSearchParams(location.search).get('cat'); if (cq) { const t = document.getElementById(cq); if (t) setTimeout(() => scrollTo({ top: t.getBoundingClientRect().top + scrollY - 110 }), 400); } }
  // Лавка: подсветка текущего раздела в строке разделов (catSpy)
  if (es) { const btns = [...document.querySelectorAll('[data-ecat]')]; const map = new Map(btns.map(b => [b.dataset.ecat, b]));
    const io4 = new IntersectionObserver(en => en.forEach(e => { if (e.isIntersecting) { btns.forEach(b => b.classList.remove('cur')); const b = map.get(e.target.id); b && b.classList.add('cur'); } }), { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('.esc-s[id]').forEach(s => io4.observe(s)); }
  // Контакты: телефон с неизменяемым «+7»
  if (document.body.classList.contains('pg-cnt')) document.querySelectorAll('input[type=tel]').forEach(t => {
    const fmt = v => { const d = v.replace(/\D/g, '').replace(/^7?/, '').slice(0, 10); let o = '+7'; if (d.length) o += ' (' + d.slice(0, 3); if (d.length >= 3) o += ')'; if (d.length > 3) o += ' ' + d.slice(3, 6); if (d.length > 6) o += '-' + d.slice(6, 8); if (d.length > 8) o += '-' + d.slice(8, 10); return o; };
    t.addEventListener('focus', () => { if (!t.value) t.value = '+7 '; }); t.addEventListener('blur', () => { if (t.value.replace(/\D/g, '').length <= 1) t.value = ''; });
    t.addEventListener('input', () => { t.value = fmt(t.value); });
    t.addEventListener('keydown', e => { if ((e.key === 'Backspace' || e.key === 'Delete') && t.selectionStart <= 3 && t.selectionEnd <= 3) e.preventDefault(); }); });
  // Лавка на телефоне: «Марка» и «Раздел» в титуле, раскрываются стрелкой (mDrop)
  if (es && matchMedia('(max-width:760px)').matches) {
    const cats = document.querySelector('.catstrip.esc-strip');
    if (cats) { const box = document.createElement('div'); box.className = 'brandstrip esc-strip m-cats'; box.innerHTML = '<span class="bs-k">Раздел</span>'; box.appendChild(cats.querySelector('ol')); es.insertAdjacentElement('afterend', box); cats.remove(); }
    document.querySelectorAll('.psign .esc-strip').forEach(st => { const k = st.querySelector('.bs-k'); const arr = document.createElement('button'); arr.type = 'button'; arr.className = 'm-arr'; arr.setAttribute('aria-label', 'Показать список'); arr.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>'; k.insertAdjacentElement('afterend', arr);
      const tog = () => st.classList.toggle('m-open'); arr.addEventListener('click', tog); k.addEventListener('click', tog); });
    window.addEventListener('click', e => { const b = e.target.closest && e.target.closest('.psign [data-ebrand], .psign [data-ecat]'); if (b) setTimeout(() => b.closest('.esc-strip').classList.remove('m-open'), 150); });
  }
  // разрезы на телефоне: подсказка по номеру — в нижней панели (tipSheet)
  if (matchMedia('(max-width:760px)').matches) {
    let ts = null;
    window.addEventListener('click', e => { const pt = e.target.closest && e.target.closest('.sf-pt'); if (!pt || e.target.closest('.sf-tip a')) return; const tip = pt.querySelector('.sf-tip'); if (!tip) return;
      e.preventDefault(); e.stopPropagation();
      if (!ts) { ts = document.createElement('div'); ts.className = 'm-sheet tip-sheet'; ts.innerHTML = '<div class="ms-panel"><button type="button" class="ms-x" aria-label="Закрыть">×</button><div class="ms-body"></div></div>'; document.body.appendChild(ts);
        ts.addEventListener('click', ev => { if (ev.target === ts || ev.target.closest('.ms-x')) ts.classList.remove('on'); }); }
      ts.querySelector('.ms-body').innerHTML = tip.innerHTML; ts.classList.add('on'); }, true);
  }
  // главная на телефоне: подсказка и роспись — по бокам здания (m-hints)
  if (matchMedia('(max-width:760px)').matches) { const bh = document.querySelector('#bld .bhint'), h1 = document.querySelector('#bld h1.b-h1');
    [bh, h1].forEach(x => { if (x) { x.classList.add('m-side'); x.querySelectorAll('br').forEach(b => b.replaceWith(' ')); document.body.appendChild(x); setTimeout(() => x.classList.add('on'), 2600); } }); }
  // Лавка на телефоне: «Марка» и «Раздел» раскрываются плавно по стрелке (mAcc)
  if (es && matchMedia('(max-width:760px)').matches) {
    const mk = (box, label) => { if (!box) return; box.classList.add('m-acc'); const t = document.createElement('button'); t.type = 'button'; t.className = 'acc-t'; t.innerHTML = '<span>' + label + '</span><i aria-hidden="true">▾</i>';
      box.insertBefore(t, box.firstChild); t.addEventListener('click', ev => { ev.stopPropagation(); box.classList.toggle('open'); }); };
    const k = es.querySelector('.bs-k'); if (k) k.remove(); mk(es, 'Марка'); mk(document.querySelector('.catstrip.esc-strip'), 'Раздел');
  }
  // одна кнопка заявки справа внизу (ПК), с надписью и мягкой пульсацией
  if (!isHome) { const src = document.querySelector('[data-cart-open]');
    if (src) { const b = document.createElement('button'); b.type = 'button'; b.className = 'cta-fix'; b.innerHTML = '<span>Заявка</span>'; b.setAttribute('aria-label', 'Оставить заявку');
      b.addEventListener('click', () => src.click()); document.body.appendChild(b); D.classList.add('has-ctafix'); } }
  // поиск по сайту: лупа в шапке
  const openSearch = async () => {
    let box = document.getElementById('srch');
    if (!box) { box = document.createElement('div'); box.id = 'srch'; box.innerHTML = '<div class="sr-in"><input type="search" placeholder="Артикул, деталь, марка или услуга" autocomplete="off"><button class="sr-x" aria-label="Закрыть">×</button></div><div class="sr-res"></div>'; document.body.appendChild(box);
      const inp = box.querySelector('input'), res = box.querySelector('.sr-res'); let IDX = null;
      try { IDX = await (await fetch(root.href + 'assets/search.json')).json(); } catch (e) { IDX = []; }
      const norm = s => s.toLowerCase().replace(/ё/g, 'е');
      inp.addEventListener('input', () => { const q = norm(inp.value.trim()); if (q.length < 2) { res.innerHTML = ''; return; }
        const words = q.split(/\s+/); const hits = IDX.filter(x => { const h = norm(x.t + ' ' + x.d + ' ' + x.u); return words.every(w => h.includes(w)); }).slice(0, 12);
        res.innerHTML = hits.length ? hits.map(x => `<a href="${root.href + x.u}">${x.i ? `<img src="${root.href + x.i}" alt="">` : '<i></i>'}<span><b>${x.t}</b><small>${x.d}</small></span></a>`).join('') : '<p class="sr-no">Ничего не нашли — позвоните: <a href="tel:+79854817228">+7 985 481-72-28</a></p>'; });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = res.querySelector('a'); if (f) location.href = f.href; } if (e.key === 'Escape') box.classList.remove('on'); });
      box.querySelector('.sr-x').onclick = () => box.classList.remove('on'); box.addEventListener('click', e => { if (e.target === box) box.classList.remove('on'); }); }
    box.classList.add('on'); setTimeout(() => box.querySelector('input').focus(), 50); };
  document.querySelectorAll('[data-search]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); openSearch(); }, true));
})();

/* v98: полоса под адресной строкой iPhone — в цвет шапки, страница под ней не видна */
(() => { const h = document.querySelector('.hdr'); if (!h) return;
  const st = document.createElement('div'); st.className = 'safe-top'; document.body.appendChild(st);
  const paint = () => { let c = getComputedStyle(h).backgroundColor; const m = c.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(',').map(x => x.trim()); c = `rgb(${p[0]},${p[1]},${p[2]})`; }
    st.style.background = c; let t = document.querySelector('meta[name="theme-color"]'); if (!t) { t = document.createElement('meta'); t.name = 'theme-color'; document.head.appendChild(t); } t.content = c; };
  paint(); addEventListener('load', paint);
})();

/* плашка над шапкой (iPhone): цвет шапки над ней и в адресной строке */
(function(){ const h=document.querySelector('.hdr'); if(!h) return; let c=getComputedStyle(h).backgroundColor;
  if(!c||c==='rgba(0, 0, 0, 0)'||c==='transparent'){ const x=h.querySelector('*'); c=x?getComputedStyle(x).backgroundColor:'#151311'; }
  document.documentElement.style.setProperty('--hdrc',c); let m=document.querySelector('meta[name="theme-color"]');
  if(!m){ m=document.createElement('meta'); m.name='theme-color'; document.head.appendChild(m); } m.content=c; })();

/* Лавка: «Показать ещё» */
(function(){const N=matchMedia('(max-width:760px)').matches?6:(matchMedia('(min-width:1500px)').matches?12:8);
document.querySelectorAll('.esc-s').forEach(s=>{const g=s.querySelector('.esc-grid');if(!g)return;const cards=[...g.querySelectorAll('.card')];if(cards.length<=N)return;
 cards.slice(N).forEach(c=>c.classList.add('more-h'));const b=document.createElement('button');b.type='button';b.className='more-b';
 const upd=()=>{const left=g.querySelectorAll('.card.more-h').length;b.textContent=left?(left<=20?('Показать остальные '+left):('Показать ещё 20 из '+left)):'';b.style.display=left?'':'none';};
 b.onclick=()=>{[...g.querySelectorAll('.card.more-h')].slice(0,20).forEach(c=>c.classList.remove('more-h'));upd();};upd();g.after(b);});})();

(function(){ if(!document.body.classList.contains('pg-shop')) return;
 const sync=()=>{ const on=!!document.querySelector('[data-ebrand][aria-pressed="true"]'); document.body.classList.toggle('flt',on); };
 window.addEventListener('pointerup',e=>{ if(e.target.closest&&e.target.closest('[data-ebrand]')) setTimeout(sync,120); },true); window.addEventListener('keyup',()=>setTimeout(sync,120));
 const reveal=()=>{ const id=location.hash.slice(1); if(!id) return; const t=document.getElementById(decodeURIComponent(id)); const c=t&&(t.classList.contains('card')?t:t.closest('.card')); if(c&&c.classList.contains('more-h')){ c.classList.remove('more-h'); c.scrollIntoView({block:'center'}); } };
 reveal(); addEventListener('hashchange',reveal); sync(); })();

/* Лавка (телефон): «Раздел» в титуле — как «Марка», со стрелкой */
(function(){ if(!matchMedia('(max-width:760px)').matches) return; const box=document.querySelector('.psign .m-cats'); if(!box||box.classList.contains('m-acc')) return;
 const k=box.querySelector('.bs-k'); if(k) k.remove(); box.classList.add('m-acc'); const t=document.createElement('button'); t.type='button'; t.className='acc-t'; t.innerHTML='<span>Раздел</span><i aria-hidden="true">▾</i>';
 box.insertBefore(t,box.firstChild); t.addEventListener('click',e=>{e.stopPropagation(); box.classList.toggle('open');}); })();

/* Лавка: ?q= — сразу к результату: раздел, марка или деталь */
(function(){ if(!document.body.classList.contains('pg-shop')) return; const q=(new URLSearchParams(location.search).get('q')||'').trim(); if(!q) return; const l=q.toLowerCase(), stem=l.length>5?l.slice(0,-2):l;
 const go=el=>{ setTimeout(()=>{ const y=el.getBoundingClientRect().top+scrollY-110; scrollTo({top:y,behavior:'smooth'}); },700); };
 const secs=[...document.querySelectorAll('.esc-s')]; const sec=secs.find(s=>{const h=s.querySelector('h2,h3,h4'); return h&&h.textContent.toLowerCase().includes(stem);}); if(sec){ go(sec); return; }
 const br=[...document.querySelectorAll('.psign [data-ebrand]')].find(b=>b.textContent.trim().toLowerCase()===l||b.dataset.ebrand===l.replace(/\s+/g,'-')); if(br){ br.click(); setTimeout(()=>document.body.classList.add('flt'),80); go(document.querySelector('.esc-depts')||br); return; }
 const cards=[...document.querySelectorAll('.esc-grid .card')].filter(c=>c.textContent.toLowerCase().includes(l));
 if(cards.length===1){ const a=cards[0].querySelector('a[href]'); if(a){ location.href=a.href; return; } }
 if(cards.length){ cards.forEach(c=>c.classList.remove('more-h')); cards.forEach(c=>c.classList.add('q-hit')); go(cards[0]); } })();
/* Главная (телефон): «пальчик» на «Скобяной лавке» и роспись под зданием */
(function(){ if(!document.body.classList.contains('home-bld')||!matchMedia('(max-width:760px)').matches) return;
 document.querySelectorAll('body>.m-side').forEach(x=>x.style.display='none');
 const st=document.getElementById('bStage'), B=document.getElementById('bld'); if(!st||!B) return;
 const h1=document.querySelector('h1.b-h1'); const sig=document.createElement('p'); sig.className='m-sig'; sig.textContent=h1?h1.textContent.replace(/\s+/g,' ').trim():'GeniLift — запчасти, монтаж и обслуживание лифтов и эскалаторов · Москва и область'; document.body.appendChild(sig);
 const place=()=>{ sig.style.top=(st.offsetTop+st.offsetHeight+10)+'px'; }; place(); addEventListener('resize',place); setTimeout(place,1500); setTimeout(place,5000);
 if(sessionStorage.getItem('gl-tapped')) return; const fc=B.querySelector('.fc[data-f="2"]'); if(!fc) return;
 const t=document.createElement('span'); t.className='tap-hint'; t.innerHTML='<i></i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10h.5V8.5a1.5 1.5 0 0 1 3 0V10h.5V9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.7a6 6 0 0 1-4.6-2.2L4.4 15.6a1.4 1.4 0 0 1 2-2L9 15.5z"/></svg>';
 setTimeout(()=>{ t.style.left=(fc.offsetLeft+fc.offsetWidth*.62)+'px'; t.style.top=(fc.offsetTop+fc.offsetHeight*.55)+'px'; B.appendChild(t); requestAnimationFrame(()=>t.classList.add('on')); },4200);
 B.addEventListener('click',()=>{ try{sessionStorage.setItem('gl-tapped','1')}catch(e){} t.remove(); },{once:true}); })();

/* Поиск: подсказки при вводе */
(function(){ const ov=document.querySelector('.srch-ov'); if(!ov) return; const inp=ov.querySelector('input'), form=ov.querySelector('form'); const logo=document.querySelector('.hdr-logo'); const base=logo?logo.getAttribute('href'):'./';
 const box=document.createElement('div'); box.className='srch-sug'; form.after(box); let data=null;
 const SRV=[['Подбор запчасти по фото','podbor-po-foto/'],['Монтаж лифтов','servis/montazh/'],['Обслуживание лифтов и эскалаторов','servis/obsluzhivanie/'],['Пусконаладка','servis/pusk/'],['Подбор лифта','servis/podbor/'],['Доставка и оплата','dostavka/'],['Контакты','kontakty/']];
 const BR=['Hitachi','KONE','OTIS','LG Sigma','Mitsubishi','ThyssenKrupp','Hyundai','Schindler','Gustav Wolf','Draka','Fujitec','Toshiba','SJEC','Canny','Yungtay'];
 const load=()=>data?Promise.resolve(data):fetch(base+'assets/search.json').then(r=>r.json()).then(d=>data=d).catch(()=>data={p:[],s:[]});
 const esc=t=>t.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
 inp.addEventListener('input',()=>{ const q=inp.value.trim().toLowerCase(); if(q.length<2){box.innerHTML='';return;} load().then(d=>{ const out=[];
  d.s.filter(x=>x.t.toLowerCase().includes(q)).slice(0,3).forEach(x=>out.push([x.t,x.k,x.u]));
  BR.filter(b=>b.toLowerCase().includes(q)).slice(0,2).forEach(b=>out.push([b,'Марка','zapchasti/?q='+encodeURIComponent(b)]));
  SRV.filter(x=>x[0].toLowerCase().includes(q)).slice(0,2).forEach(x=>out.push([x[0],'Услуга',x[1]]));
  d.p.filter(x=>x.t.toLowerCase().includes(q)).slice(0,8-out.length).forEach(x=>out.push([x.t,'Деталь',x.u]));
  box.innerHTML=out.slice(0,8).map(o=>'<a href="'+base+o[2]+'"><span>'+esc(o[0])+'</span><em>'+o[1]+'</em></a>').join('')||'<p>Ничего не нашли — нажмите «Найти» или пришлите фото шильдика</p>'; }); });
})();
/* «Где в лифте / в эскалаторе эта деталь»: горит только свой узел, под разрезом — подпись */
(function(){ const w=document.querySelector('.where'); if(!w) return; const fig=w.querySelector('.escfig,.shaftfig'); if(!fig) return; let hot=null;
 if(w.classList.contains('where-esc')){ const crumbs=[...document.querySelectorAll('.crumbs a, .crumbs span, .crumbs li')].map(e=>e.textContent.toLowerCase()).join(' ');
  const MAP=[['ролик','ступени'],['фрикцион','поручень'],['цепи поручня','поручень'],['входные узлы','поручень'],['натяжн','натяжн'],['ступенчат','ступенчатая цепь'],['ступени','ступени'],['гребён','гребён'],['фриз','гребён']];
  const m=MAP.find(x=>crumbs.includes(x[0])); const pts=[...fig.querySelectorAll('.sf-pt')];
  if(m){ hot=pts.find(p=>(p.querySelector('strong')||{}).textContent&&p.querySelector('strong').textContent.toLowerCase().includes(m[1])); }
  if(hot){ pts.forEach(p=>{ if(p!==hot) p.classList.add('dim'); }); hot.classList.add('hot'); const l=w.querySelector('.esc-list'); if(l) l.style.display='none'; } }
 else { const all=[...fig.querySelectorAll('.sf-pt')].filter(p=>!p.classList.contains('off')); hot=all[0]; if(all.length>1){ all.slice(1).forEach(h=>{ const t=h.querySelector('.sf-tip'); const cap=document.createElement('p'); cap.className='where-cap'; cap.innerHTML='<b>'+h.childNodes[0].textContent.trim().padStart(2,'0')+'</b><span><strong>'+(t.querySelector('strong')||{}).textContent+'</strong><em>'+((t.querySelector('em')||{}).textContent||'')+'</em></span>'; setTimeout(()=>{ const last=[...w.querySelectorAll('.where-cap')].pop(); (last||fig).after(cap); },0); }); } }
 if(hot){ const t=hot.querySelector('.sf-tip'); const cap=document.createElement('p'); cap.className='where-cap';
  cap.innerHTML='<b>'+hot.childNodes[0].textContent.trim().padStart(2,'0')+'</b><span><strong>'+(t.querySelector('strong')||{}).textContent+'</strong><em>'+((t.querySelector('em')||{}).textContent||'')+'</em></span>'; fig.after(cap); } })();

/* Доставка/Оплата: высота плашки не меняется при переключении */
(function(){ const t=document.querySelector('.dl-tabs'); if(!t) return; const btns=[...t.querySelectorAll('button')].filter(b=>/Доставка|Оплата/i.test(b.textContent)); if(btns.length<2) return;
 const fix=()=>{ t.style.minHeight=''; const cur=btns.find(b=>b.getAttribute('aria-selected')==='true'||b.classList.contains('on'))||btns[0]; let mx=0; btns.forEach(b=>{ b.click(); mx=Math.max(mx,t.offsetHeight); }); cur.click(); t.style.minHeight=mx+'px'; };
 if(document.readyState==='complete') fix(); else addEventListener('load',fix); let rt; addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(fix,300);}); })();

/* Меню (телефон): блокировка прокрутки под меню; аварийный вызов — рядом с телефоном */
(function(){ const lm=document.getElementById('liftmenu'); if(!lm) return;
 new MutationObserver(()=>{ const on=lm.classList.contains('open'); document.documentElement.classList.toggle('lm-lock',on); }).observe(lm,{attributes:true,attributeFilter:['class']});
 const sos=lm.querySelector('.sos-menu'), ph=lm.querySelector('.lm-phone'); if(sos&&ph&&matchMedia('(max-width:760px)').matches){ ph.parentElement.insertBefore(sos,ph.nextSibling); }
 lm.addEventListener('click',e=>{ if(e.target===lm) { const x=lm.querySelector('[data-menu-close]'); x&&x.click(); } }); })();

/* Лавка: отделы чередуются по порядку (оливковый / бордовый) */
(function(){ document.querySelectorAll('body.pg-shop .dept').forEach((d,i)=>{ d.classList.add(i%2?'d-b':'d-o'); if(i>0) d.classList.add(i%2?'from-o':'from-b'); }); })();
/* Подвал: «Связаться» — четвёртой колонкой */
(function(){ const c=document.querySelector('.ftr-c2 .f2-contact'), cols=document.querySelector('.ftr-c2 .f2-cols'); if(c&&cols&&!cols.contains(c)) cols.appendChild(c); })();

/* Ловушка для ботов в формах */
document.querySelectorAll('form.order, form[data-ask]').forEach(f=>{ if(f.querySelector('[name=website]')) return; const i=document.createElement('input'); i.type='text'; i.name='website'; i.tabIndex=-1; i.autocomplete='off'; i.setAttribute('aria-hidden','true'); i.style.cssText='position:absolute;left:-9999px;width:1px;height:1px;opacity:0'; f.appendChild(i); });
/* Cookie-баннер и Яндекс Метрика (номер счётчика — в config.js) */
(function(){ const s=document.createElement('script'); s.src=window.glRoot+'config.js'; s.onload=s.onerror=init; document.head.appendChild(s);
 function metrika(){ const id=(window.GL_CONFIG||{}).metrika; if(!id||window.ym) return;
  (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
  window.ym(id,'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false}); }
 function init(){ let c=null; try{ c=localStorage.getItem('gl-cookie'); }catch(e){}
  if(c==='all'){ metrika(); return; } if(c==='need') return;
  const cfg=window.GL_CONFIG||{}; const b=document.createElement('div'); b.className='ck-bar'; b.setAttribute('role','dialog'); b.setAttribute('aria-label','Файлы cookie');
  b.innerHTML='<p>Мы используем файлы cookie и сервис Яндекс Метрика, чтобы сайт работал и становился удобнее. Подробнее — в <a href="'+window.glRoot+(cfg.cookiePage||'politika/')+'">политике</a>.</p><div><button type="button" data-ck="need">Только необходимые</button><button type="button" data-ck="all">Принять</button></div>';
  document.body.appendChild(b); requestAnimationFrame(()=>b.classList.add('on'));
  b.addEventListener('click',e=>{ const k=e.target.closest('[data-ck]'); if(!k) return; try{ localStorage.setItem('gl-cookie',k.dataset.ck); }catch(_){} b.classList.remove('on'); setTimeout(()=>b.remove(),400); if(k.dataset.ck==='all') metrika(); }); } })();
