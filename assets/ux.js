/* GeniLift — удобство: табло этажа, аварийный вызов, режим «без анимации», кнопка заявки на телефоне, «вы смотрели» */
(function () {
  var D = document.documentElement, B = document.body;
  if (!B) return;
  var logo = document.querySelector('.hdr-logo');
  var home = B.classList.contains('home-bld');
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* без хранилища всё работает */ } return null; };

  /* ---------- режим без анимации ---------- */
  var calm = ls('gl-calm') === '1' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (calm) D.classList.add('calm');

  /* ---------- шапка: табло этажа и аварийный вызов ---------- */
  var inner = document.querySelector('.hdr2-in');
  if (inner && !inner.querySelector('.gl-hleft')) {
    var base = '/';
    try { base = new URL(logo ? logo.getAttribute('href') : './', location.href).pathname; } catch (e) { /* корень */ }
    var seg = location.pathname.indexOf(base) === 0 ? location.pathname.slice(base.length).split('/')[0] : '';
    var FL = { 'o-kompanii': [1, 'О компании'], 'obekty': [1, 'О компании'], 'zapchasti': [2, 'Запчасти'], 'korzina': [2, 'Запчасти'], 'dostavka': [2, 'Запчасти'], 'podbor-po-foto': [2, 'Запчасти'], 'brendy': [2, 'Запчасти'], 'razdely': [2, 'Запчасти'], 'servis': [3, 'Сервис'], 'ustroystvo': [3, 'Сервис'], 'kontakty': [4, 'Контакты'] };
    var left = document.createElement('div');
    left.className = 'gl-hleft';
    if (FL[seg] && !home) {
      var cur = FL[seg][0], prev = cur;
      try { var pv = parseInt(sessionStorage.getItem('gl-fl'), 10); if (pv >= 1 && pv <= 4) prev = pv; sessionStorage.setItem('gl-fl', String(cur)); } catch (e) { /* без хранилища — без анимации */ }
      var fl = document.createElement('a');
      fl.className = 'gl-floor'; fl.href = '#'; fl.setAttribute('aria-label', 'Этаж ' + cur + ': ' + FL[seg][1] + '. Открыть меню этажей');
      var dir = cur > prev ? 'up' : (cur < prev ? 'down' : '');
      var pad = function (n) { return '0' + n; };
      var col = dir === 'up' ? '<i>' + pad(prev) + '</i><i>' + pad(cur) + '</i>' : (dir === 'down' ? '<i>' + pad(cur) + '</i><i>' + pad(prev) + '</i>' : '<i>' + pad(cur) + '</i>');
      fl.innerHTML = '<span class="gf-d"><span class="gf-col' + (dir ? ' go-' + dir : '') + '">' + col + '</span></span>' + (dir ? '<b class="gf-ar ' + dir + '" aria-hidden="true"></b>' : '') + '<span class="gf-t">' + FL[seg][1] + '</span>';
      fl.addEventListener('click', function (e) { e.preventDefault(); var m = document.querySelector('[data-menu-open]'); if (m) m.click(); });
      left.appendChild(fl);
      if (dir) requestAnimationFrame(function () { requestAnimationFrame(function () { fl.querySelector('.gf-col').classList.add('run'); setTimeout(function () { var ar = fl.querySelector('.gf-ar'); if (ar) ar.classList.add('off'); }, 1300); }); });
    }
    var sos = document.createElement('a');
    sos.className = 'gl-sos'; sos.href = 'tel:+79854817228'; sos.setAttribute('aria-label', 'Аварийный вызов лифта 24/7');
    sos.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-6 6v3.5L4.5 16h15L18 12.5V9a6 6 0 0 0-6-6z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg><span>Авария 24/7</span>';
    left.appendChild(sos);
    inner.insertBefore(left, inner.firstChild);
  }

  /* ---------- режим «без анимации» в меню этажей ---------- */
  var foot = document.querySelector('#liftmenu .lm-side');
  if (foot && !foot.querySelector('.calm-t')) {
    var t = document.createElement('button');
    t.type = 'button'; t.className = 'calm-t';
    var paint = function () { t.innerHTML = 'Анимации и поездки лифта: <b>' + (D.classList.contains('calm') ? 'выключены' : 'включены') + '</b>'; };
    paint();
    t.addEventListener('click', function () {
      var on = !D.classList.contains('calm');
      D.classList.toggle('calm', on); ls('gl-calm', on ? '1' : '0'); paint();
    });
    foot.appendChild(t);
  }

  /* ---------- карточка детали ---------- */
  var op = document.querySelector('.opis .op-t');
  if (op) {
    var cell = function (name) {
      var th = op.querySelectorAll('th[scope=row]');
      for (var i = 0; i < th.length; i++) if (th[i].textContent.trim() === name) return th[i].parentNode.querySelector('td:last-child');
      return null;
    };
    var skuC = cell('Артикул') || cell('Серия');
    var img = document.querySelector('.prod2 .tag-img img');
    var h1 = document.querySelector('.ps-t');

    /* на телефоне нижняя панель: «Позвонить» и «Запросить цену» */
    var main = document.querySelector('.pacts .em-btn-main');
    var mbar = document.querySelector('.mbar');
    if (main && mbar && mbar.children.length > 1) {
      var second = mbar.children[1];
      var req = document.createElement('button');
      req.type = 'button'; req.className = 'mb-req'; req.textContent = 'Запросить цену';
      req.addEventListener('click', function () { main.click(); });
      mbar.replaceChild(req, second);
    }

    /* «Вы смотрели»: последние просмотренные детали (только в этом браузере) */
    if (skuC && img && h1) {
      var list = [];
      try { list = JSON.parse(ls('gl-recent') || '[]'); } catch (e) { list = []; }
      var here = { u: location.pathname, t: h1.textContent.trim(), i: new URL(img.getAttribute('src'), location.href).pathname };
      var others = list.filter(function (x) { return x.u !== here.u; });
      ls('gl-recent', JSON.stringify([here].concat(others).slice(0, 8)));
      if (others.length) {
        var sec = document.createElement('section');
        sec.className = 'recent'; sec.setAttribute('aria-label', 'Вы смотрели');
        var ul = others.slice(0, 6).map(function (x) {
          var a = document.createElement('li'), l = document.createElement('a'), im = document.createElement('img'), b = document.createElement('b');
          l.href = x.u; im.src = x.i; im.alt = ''; im.loading = 'lazy'; im.width = 116; im.height = 116; b.textContent = x.t;
          l.appendChild(im); l.appendChild(b); a.appendChild(l); return a;
        });
        var h2 = document.createElement('h2'); h2.textContent = 'Вы смотрели';
        var u = document.createElement('ul'); ul.forEach(function (li) { u.appendChild(li); });
        sec.appendChild(h2); sec.appendChild(u);
        var rel = document.querySelector('.related');
        if (rel && rel.parentNode) rel.parentNode.insertBefore(sec, rel); else (document.querySelector('main') || B).appendChild(sec);
      }
    }
  }
})();
