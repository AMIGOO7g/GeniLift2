/* GeniLift — живые данные каталога (цена, наличие, скрытые позиции). Файл assets/live.json формирует админка. */
(function () {
  var logo = document.querySelector('.hdr-logo');
  var root = (logo && logo.getAttribute('href')) || './';
  var money = function (n) { try { return new Intl.NumberFormat('ru-RU').format(n) + ' ₽'; } catch (e) { return n + ' ₽'; } };
  var P = null;

  function row(table, name) {
    var ths = table.querySelectorAll('th[scope=row]');
    for (var i = 0; i < ths.length; i++) if (ths[i].textContent.trim() === name) return ths[i].parentNode.querySelector('td:last-child');
    return null;
  }

  function productPage() {
    var t = document.querySelector('.opis .op-t'); if (!t) return;
    var a = row(t, 'Артикул'), av = row(t, 'Наличие'), pr = row(t, 'Цена');
    var info = a && P[a.textContent.trim()];
    if (info) {
      if (av && info.av) av.textContent = info.av;
      if (pr && info.pr) pr.textContent = money(info.pr);
      if (info.h) {
        var n = document.createElement('p'); n.className = 'live-note';
        n.textContent = 'Позиция сейчас снята с продажи. Уточните наличие и аналоги — пришлите заявку или фото.';
        var box = document.querySelector('.prod2'); if (box) box.parentNode.insertBefore(n, box);
      }
    }
    document.querySelectorAll('.vt tbody tr').forEach(function (tr) {
      var c = tr.querySelector('.vt-a'); var i = c && P[c.textContent.trim()]; if (!i) return;
      if (i.h) { tr.hidden = true; return; }
      var last = tr.lastElementChild, s = document.createElement('span'); s.className = 'vt-pr';
      s.textContent = [i.pr ? money(i.pr) : '', i.av || ''].filter(Boolean).join(' · ');
      if (s.textContent) last.insertBefore(s, last.firstChild);
    });
  }

  function cards() {
    var keys = {}; Object.keys(P).forEach(function (k) { keys[k.toLowerCase()] = k; });
    document.querySelectorAll('.card.tag').forEach(function (c) {
      var skus = [], b = c.querySelector('.tag-btn.add');
      if (b) { try { skus.push(JSON.parse(b.getAttribute('data-add')).a); } catch (e) { /* пропускаем */ } }
      else (c.getAttribute('data-q') || '').split(/\s+/).forEach(function (w) { if (keys[w]) skus.push(keys[w]); });
      var infos = skus.map(function (s) { return P[s]; }).filter(Boolean); if (!infos.length) return;
      if (b && infos[0].h) { c.hidden = true; c.setAttribute('data-live-hidden', '1'); return; }
      var prices = infos.filter(function (i) { return i.pr && !i.h; }).map(function (i) { return i.pr; });
      var stock = infos.some(function (i) { return i.av === 'В наличии' && !i.h; });
      if (!prices.length && !stock) return;
      var s = document.createElement('span'); s.className = 'tag-price';
      s.textContent = (prices.length ? (b || Math.min.apply(null, prices) === Math.max.apply(null, prices) ? '' : 'от ') + money(Math.min.apply(null, prices)) : '') + (stock ? (prices.length ? ' · ' : '') + 'в наличии' : '');
      var ref = c.querySelector('.tag-btn'); if (ref) ref.parentNode.insertBefore(s, ref); else c.appendChild(s);
    });
  }

  fetch(root + 'assets/live.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d || !d.p) return; P = d.p;
    productPage(); cards();
  }).catch(function () { /* без живых данных сайт работает как раньше */ });
})();
