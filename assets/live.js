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

  /* Цена и наличие — в структурированные данные (для поисковиков), когда они заданы в админке */
  function offerLd(sku, info) {
    if (!info.pr || info.h) return;
    var AV = { 'В наличии': 'https://schema.org/InStock', 'Под заказ': 'https://schema.org/PreOrder' };
    document.querySelectorAll('script[type="application/ld+json"]').forEach(function (sc) {
      try {
        var j = JSON.parse(sc.textContent);
        if (j && j['@type'] === 'Product' && !j.offers) {
          j.offers = { '@type': 'Offer', price: String(info.pr), priceCurrency: 'RUB', url: location.href.split('#')[0] };
          if (AV[info.av]) j.offers.availability = AV[info.av];
          sc.textContent = JSON.stringify(j);
        }
      } catch (e) { /* чужая разметка не трогаем */ }
    });
  }

  function productPage() {
    var t = document.querySelector('.opis .op-t'); if (!t) return;
    var a = row(t, 'Артикул'), av = row(t, 'Наличие'), pr = row(t, 'Цена');
    var info = a && P[a.textContent.trim()];
    if (info) {
      if (av && info.av) av.innerHTML = '<span class="stamp ' + (info.av === 'В наличии' ? 'stamp-ok' : 'stamp-order') + '">' + info.av + '</span>';
      if (pr && info.pr) pr.innerHTML = '<b class="price-big">' + money(info.pr) + '</b>';
      offerLd(a.textContent.trim(), info);
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
      c.setAttribute('data-price', prices.length ? Math.min.apply(null, prices) : '');
      if (stock) c.setAttribute('data-stock', '1');
      var s = document.createElement('span'); s.className = 'tag-price';
      s.innerHTML = (prices.length ? (b || Math.min.apply(null, prices) === Math.max.apply(null, prices) ? '' : 'от ') + money(Math.min.apply(null, prices)) : '') + (stock ? '<em class="stamp stamp-ok stamp-s">в наличии</em>' : '');
      var ref = c.querySelector('.tag-btn'); if (ref) ref.parentNode.insertBefore(s, ref); else c.appendChild(s);
    });
  }

  function toolbar() {
    var strip = document.querySelector('.catstrip');
    var cards = document.querySelectorAll('.esc-grid .card');
    if (!strip || !cards.length || !document.querySelector('.card[data-price],.card[data-stock]')) return;
    cards.forEach(function (c, i) { c.setAttribute('data-i', i); });
    var bar = document.createElement('div');
    bar.className = 'cat-tools';
    bar.innerHTML = '<label class="ct-chk"><input type="checkbox" id="ctStock"><span>Только в наличии</span></label>' +
      '<label class="ct-sel"><span>Сортировка</span><select id="ctSort"><option value="">По порядку каталога</option><option value="stock">Сначала в наличии</option><option value="asc">Сначала дешевле</option><option value="desc">Сначала дороже</option><option value="sku">По артикулу</option></select></label>';
    strip.parentNode.insertBefore(bar, strip.nextSibling);
    var stock = bar.querySelector('#ctStock'), sort = bar.querySelector('#ctSort');
    var apply = function () {
      var on = stock.checked || sort.value !== '';
      document.body.classList.toggle('live-flt', on);
      cards.forEach(function (c) {                                 // «Показать ещё» не мешает: при фильтре показываем всё подходящее
        if (on && c.classList.contains('more-h')) { c.setAttribute('data-mh', '1'); c.classList.remove('more-h'); }
        else if (!on && c.hasAttribute('data-mh')) { c.removeAttribute('data-mh'); c.classList.add('more-h'); }
      });
      document.querySelectorAll('.esc-grid').forEach(function (g) {
        var list = [].slice.call(g.querySelectorAll('.card'));
        list.forEach(function (c) { c.classList.toggle('live-off', stock.checked && !c.hasAttribute('data-stock')); });
        var key = {
          '': function (c) { return +c.getAttribute('data-i'); },
          stock: function (c) { return (c.hasAttribute('data-stock') ? 0 : 1) * 1e6 + +c.getAttribute('data-i'); },
          asc: function (c) { var p = c.getAttribute('data-price'); return p ? +p : 1e12; },
          desc: function (c) { var p = c.getAttribute('data-price'); return p ? -p : 1e12; },
          sku: function (c) { return (c.querySelector('.tag-pn') || {}).textContent || ''; }
        }[sort.value];
        list.sort(function (a, b) { var x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0; }).forEach(function (c) { g.appendChild(c); });
      });
    };
    stock.addEventListener('change', apply); sort.addEventListener('change', apply);
  }

  fetch(root + 'assets/live.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d || !d.p) return; P = d.p;
    productPage(); cards(); toolbar();
  }).catch(function () { /* без живых данных сайт работает как раньше */ });
})();
