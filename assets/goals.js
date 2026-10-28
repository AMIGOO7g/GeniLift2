/* GeniLift — цели Яндекс Метрики. События уходят только если задан номер счётчика (config.js) и посетитель принял cookie. */
(function () {
  function goal(name, params) {
    try {
      var id = (window.GL_CONFIG || {}).metrika;
      if (id && typeof window.ym === 'function') window.ym(id, 'reachGoal', name, params || undefined);
    } catch (e) { /* аналитика не должна ломать сайт */ }
  }
  window.glGoal = goal;

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href],button') : null;
    if (!a) return;
    var h = a.getAttribute('href') || '';
    if (/^tel:/.test(h)) goal(a.classList.contains('gl-sos') || /sos/i.test(a.className) ? 'click_sos' : 'click_phone');
    else if (/t\.me\//.test(h)) goal('click_telegram');
    else if (/wa\.me\//.test(h)) goal('click_whatsapp');
    else if (/max\.ru/.test(h)) goal('click_max');
    else if (/^mailto:/.test(h)) goal('click_mail');
    if (a.hasAttribute('data-add')) goal('add_to_request');
    if (a.hasAttribute('data-cart-open') || a.classList.contains('cta-fix') || a.classList.contains('mb-req')) goal('open_request');
  }, true);

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f && f.matches && f.matches('form[role=search],form.search,form.desk-search')) goal('search_submit');
  }, true);
})();
