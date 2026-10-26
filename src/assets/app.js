// Art Will Save: random picker, adult-content gate, sharing, submission word counter.
(function () {
  'use strict';
  var LANGS = ['en', 'fr', 'es'];

  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val);
    } catch (e) { return null; }
  }
  function params() {
    var out = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (p) {
      if (!p) return;
      var kv = p.split('=');
      out[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
    });
    return out;
  }
  function pickLang(q) {
    if (LANGS.indexOf(q.lang) >= 0) return q.lang;
    var saved = store('aws-lang');
    if (LANGS.indexOf(saved) >= 0) return saved;
    var nav = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < nav.length; i++) {
      var c = String(nav[i]).slice(0, 2).toLowerCase();
      if (LANGS.indexOf(c) >= 0) return c;
    }
    return 'en';
  }

  // ---------- random picker (/r/) ----------
  function runRandom() {
    var q = params();
    var lang = pickLang(q);
    var label = document.querySelector('[data-finding-text] [data-l="' + lang + '"]');
    if (label) label.hidden = false;
    store('aws-lang', lang);
    var skipAdult = store('aws-skip-adult') === '1';

    fetch('/stories.json', { cache: 'no-cache' })
      .then(function (r) { return r.json(); })
      .then(function (all) {
        if (!all.length) { location.replace('/' + lang + '/stories/'); return; }
        var pool = all.filter(function (s) { return !(skipAdult && s.m); });
        if (!pool.length) pool = all;
        if (pool.length > 1 && q.from) pool = pool.filter(function (s) { return s.s !== q.from; });

        // Prefer stories already translated into the reader's language
        var inLang = pool.filter(function (s) { return s.l.indexOf(lang) >= 0; });
        if (inLang.length) pool = inLang;

        // Don't repeat a story until this reader has seen everything in the pool
        var seen = [];
        try { seen = JSON.parse(store('aws-seen') || '[]'); } catch (e) {}
        var fresh = pool.filter(function (s) { return seen.indexOf(s.s) < 0; });
        if (!fresh.length) {
          var poolSlugs = pool.map(function (s) { return s.s; });
          seen = seen.filter(function (x) { return poolSlugs.indexOf(x) < 0; });
          fresh = pool;
        }
        var pick = fresh[Math.floor(Math.random() * fresh.length)];
        seen.push(pick.s);
        store('aws-seen', JSON.stringify(seen.slice(-500)));
        location.replace('/' + lang + '/s/' + pick.s + '/');
      })
      .catch(function () { location.replace('/' + lang + '/stories/'); });
  }

  // ---------- adult gate ----------
  function setupGate() {
    var yes = document.querySelector('[data-gate-yes]');
    if (yes) yes.addEventListener('click', function () {
      store('aws-adult-ok', '1');
      document.documentElement.classList.add('adult-ok');
      var story = document.querySelector('.story');
      if (story) story.classList.add('revealed');
      var h = document.querySelector('.story-head h1');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-skip-adult]'), function (box) {
      box.checked = store('aws-skip-adult') === '1';
      box.addEventListener('change', function () { store('aws-skip-adult', box.checked ? '1' : null); });
    });
  }

  // ---------- language switch remembers choice ----------
  function setupLangLinks() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-setlang]'), function (a) {
      a.addEventListener('click', function () { store('aws-lang', a.getAttribute('data-setlang')); });
    });
  }

  // ---------- share ----------
  function setupShare() {
    var btn = document.querySelector('[data-share]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var url = location.origin + location.pathname;
      var title = document.title;
      if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () {}); return; }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () {
          var orig = btn.textContent;
          btn.textContent = btn.getAttribute('data-copied');
          setTimeout(function () { btn.textContent = orig; }, 2200);
        });
      }
    });
  }

  // ---------- submission form ----------
  function setupForm() {
    var form = document.querySelector('.submit-form');
    if (!form) return;
    var ta = form.querySelector('textarea[name="story"]');
    var out = form.querySelector('#f-count');
    var max = parseInt(out.getAttribute('data-max'), 10);
    var locale = out.getAttribute('data-locale');
    var fmt = function (n) { try { return n.toLocaleString(locale); } catch (e) { return String(n); } };
    function count() { var m = ta.value.trim().match(/\S+/g); return m ? m.length : 0; }
    function render() {
      var n = count();
      var over = n > max;
      out.textContent = (over ? out.getAttribute('data-over') : out.getAttribute('data-template'))
        .replace('{n}', fmt(n)).replace('{max}', fmt(max));
      out.classList.toggle('over', over);
      ta.setCustomValidity(over ? out.textContent : '');
    }
    ta.addEventListener('input', render);
    render();

    var toggle = form.querySelector('[data-mature-toggle]');
    var note = form.querySelector('[data-note-field]');
    function showNote() { note.classList.toggle('show', toggle.checked); }
    toggle.addEventListener('change', showNote);
    showNote();
  }

  function init() {
    if (document.querySelector('[data-random]')) runRandom();
    setupGate();
    setupLangLinks();
    setupShare();
    setupForm();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
