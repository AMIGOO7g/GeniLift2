/* GeniLift — подбор по фото: загрузка, сжатие, распознавание артикула (локально, без сторонних сервисов), отправка */
(function () {
  const f = document.getElementById('photoForm');
  if (!f) return;
  const me = document.querySelector('script[src*="photo.js"]');
  const BASE = new URL('./', me ? me.src : location.href).href;          // .../assets/
  const $ = s => f.querySelector(s);
  const drop = $('#phDrop'), prevImg = $('#phImg'), prevName = $('#phName'), st = $('#phSt');
  const frame = $('#phFrame');
  const ocrBox = $('#phOcr'), ocrBtn = $('#phOcrBtn'), ocrSt = $('#phOcrSt'), ocrBar = $('#phOcrBar'), hits = $('#phHits');
  const main = f.photo, MAXSIDE = 1800;
  { const t = document.createElement('input'); t.type = 'text'; t.name = 'website'; t.tabIndex = -1; t.autocomplete = 'off'; t.setAttribute('aria-hidden', 'true'); t.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0'; f.appendChild(t); }   // ловушка для ботов
  let current = null;

  const load = file => new Promise((ok, no) => { const u = URL.createObjectURL(file); const i = new Image(); i.onload = () => ok({ i, u }); i.onerror = () => { URL.revokeObjectURL(u); no(); }; i.src = u; });
  const toCanvas = (img, max, gray) => {
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
    if (gray) {                                                              // серый + растяжение контраста — шильдики читаются лучше
      const d = x.getImageData(0, 0, c.width, c.height), p = d.data; let lo = 255, hi = 0;
      for (let n = 0; n < p.length; n += 4) { const g = (p[n] * .3 + p[n + 1] * .59 + p[n + 2] * .11) | 0; p[n] = g; if (g < lo) lo = g; if (g > hi) hi = g; }
      const s = hi > lo ? 255 / (hi - lo) : 1;
      for (let n = 0; n < p.length; n += 4) { const g = Math.max(0, Math.min(255, (p[n] - lo) * s)); p[n] = p[n + 1] = p[n + 2] = g; }
      x.putImageData(d, 0, 0);
    }
    return c;
  };

  async function setFile(file) {
    if (!file || !/^image\//.test(file.type || 'image/jpeg')) { st.textContent = 'Нужен файл-изображение (JPG, PNG, WebP).'; return; }
    st.textContent = '';
    let out = file, loaded = null;
    try {
      loaded = await load(file);
      const big = Math.max(loaded.i.naturalWidth, loaded.i.naturalHeight) > MAXSIDE || file.size > 2.5 * 1048576;
      if (big) {                                                             // сжимаем до ~1800 px: быстрее уходит с телефона
        const blob = await new Promise(r => toCanvas(loaded.i, MAXSIDE).toBlob(r, 'image/jpeg', .86));
        if (blob && blob.size < file.size) out = new File([blob], (file.name || 'foto').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
      }
    } catch (e) { /* оставляем исходный файл */ }
    current = loaded;
    try { const dt = new DataTransfer(); dt.items.add(out); main.files = dt.files; } catch (e) { /* старый браузер: уйдёт файл из основного поля */ }
    prevImg.src = loaded ? loaded.u : URL.createObjectURL(out);
    prevName.textContent = out.name + ' · ' + (out.size / 1048576 < 1 ? Math.max(1, Math.round(out.size / 1024)) + ' КБ' : (out.size / 1048576).toFixed(1) + ' МБ');
    if (window.glGoal) window.glGoal('photo_selected');
    drop.classList.add('has'); ocrBox.classList.add('on'); hits.innerHTML = ''; ocrSt.textContent = '';
  }
  function clearFile() {
    try { main.value = ''; } catch (e) { /* noop */ }
    f.querySelectorAll('input[type=file]').forEach(i => { i.value = ''; });
    drop.classList.remove('has'); ocrBox.classList.remove('on'); prevImg.removeAttribute('src'); hits.innerHTML = ''; ocrSt.textContent = ''; current = null;
  }

  f.querySelectorAll('input[type=file]').forEach(i => i.addEventListener('change', () => { if (i.files[0]) setFile(i.files[0]); }));
  $('#phClear').addEventListener('click', clearFile);
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { const x = e.dataTransfer && e.dataTransfer.files[0]; if (x) setFile(x); });
  addEventListener('paste', e => { const it = [...(e.clipboardData ? e.clipboardData.items : [])].find(i => i.type.indexOf('image/') === 0); if (it) setFile(it.getAsFile()); });

  /* ---------- Распознавание артикула ---------- */
  const norm = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  let SK = null;
  const skus = () => SK ? Promise.resolve(SK) : fetch(BASE + 'skus.json').then(r => r.json()).then(j => { SK = Object.keys(j).map(k => ({ k, n: norm(k), v: j[k] })).filter(x => x.n.length >= 4); return SK; }).catch(() => (SK = []));
  const simd = () => { try { return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11])); } catch (e) { return false; } };
  const script = src => new Promise((ok, no) => { if (window.Tesseract) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('load')); document.head.appendChild(s); });
  let worker = null;
  async function getWorker() {
    if (worker) return worker;
    await script(BASE + 'ocr/tesseract.min.js');
    worker = await Tesseract.createWorker('eng', 1, {
      workerPath: BASE + 'ocr/worker.min.js',
      corePath: BASE + 'ocr/tesseract-core' + (simd() ? '-simd' : '') + '-lstm.wasm.js',
      langPath: BASE + 'ocr', workerBlobURL: false, gzip: true,
      logger: m => { if (m.status === 'recognizing text') { ocrBar.firstElementChild.style.width = Math.round(10 + m.progress * 90) + '%'; } }
    });
    await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-./ ', preserve_interword_spaces: '1' });
    return worker;
  }
  const tokens = text => {
    const raw = (text.toUpperCase().match(/[A-Z0-9][A-Z0-9\-\/.]{3,}[A-Z0-9]/g) || []).filter(t => /\d/.test(t));
    return [...new Set(raw)].slice(0, 12);
  };
  const find = (toks, list) => {
    const seen = new Set(), out = [];
    toks.forEach(t => { const n = norm(t); if (n.length < 5) return;
      list.forEach(x => { if (seen.has(x.v[0] + x.k)) return;
        if (x.n === n || (n.length >= 7 && x.n.length >= 7 && (x.n.includes(n) || n.includes(x.n)))) { seen.add(x.v[0] + x.k); out.push(x); } }); });
    return out.slice(0, 6);
  };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  ocrBtn.addEventListener('click', async () => {
    if (!current || ocrBtn.disabled) return;
    if (window.glGoal) window.glGoal('photo_ocr');
    ocrBtn.disabled = true; hits.innerHTML = ''; frame.classList.add('scanning'); ocrBar.classList.add('on'); ocrBar.firstElementChild.style.width = '4%';
    try {
      ocrSt.textContent = worker ? 'Читаем фото…' : 'Загружаем распознавание (один раз, около 11 МБ)…';
      const w = await getWorker();
      ocrSt.textContent = 'Читаем фото…';
      const c = toCanvas(current.i, 2200, true);
      const r = await w.recognize(c);
      const toks = tokens(r.data.text || '');
      const list = await skus();
      const found = find(toks, list);
      ocrBar.firstElementChild.style.width = '100%';
      if (toks.length) {
        const t = f.msg, add = 'Распознано на фото: ' + toks.join(', ');
        if (t.value.indexOf('Распознано на фото:') < 0) t.value = (t.value ? t.value + '\n' : '') + add;
      }
      if (found.length && window.glGoal) window.glGoal('photo_ocr_found');
      if (found.length) {
        ocrSt.textContent = 'Похоже, это — проверьте и откройте. Инженер всё равно сверит артикул перед заказом.';
        hits.innerHTML = found.map(x => '<li><a href="../zapchasti/' + esc(x.v[0]) + '/"><span><b>' + esc(x.k) + '</b>' + esc(x.v[2] || x.k) + '</span><em class="ph-ok">Найдено</em></a></li>').join('');
      } else if (toks.length) {
        ocrSt.textContent = 'Распознали: ' + toks.slice(0, 6).join(', ') + '. В каталоге точного совпадения нет — отправьте заявку, инженер подберёт.';
      } else {
        ocrSt.textContent = 'Артикул на фото разобрать не удалось. Это нормально — отправьте заявку, инженер определит по фото сам.';
      }
    } catch (e) {
      ocrSt.textContent = 'Не удалось распознать автоматически. Отправьте заявку — инженер определит по фото сам.';
    } finally { frame.classList.remove('scanning'); ocrBtn.disabled = false; setTimeout(() => ocrBar.classList.remove('on'), 800); }
  });

  /* ---------- Отправка ---------- */
  f.addEventListener('submit', e => {
    e.preventDefault();
    if (!f.phone.value.trim()) { st.textContent = 'Укажите телефон — по нему перезвоним.'; f.phone.focus(); return; }
    if (!main.files[0]) { st.textContent = 'Добавьте фото шильдика или детали.'; return; }
    if (!f.agree.checked) { st.textContent = 'Отметьте согласие на обработку данных.'; return; }
    const keep = f.msg.value, b = f.brand.value;
    if (b) f.msg.value = 'Марка лифта: ' + b + (keep ? '\n' + keep : '');
    window.glSend(f, st, null);
    f.msg.value = keep;
  });
  f.addEventListener('reset', () => setTimeout(clearFile, 0));
})();
