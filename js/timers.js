// Lab Arcade — aba TIMERS: vários timers simultâneos, com nome editável.
// Cada timer é um "jogador" (P1, P2...) com cor e tom de alarme próprios.

import { unlock, ring, stop, wake } from './alarme.js?v=7';

var LS = 'labarcade-timers', MAX = 12, SEGS = 20;
var COLORS = ['#00e5ff', '#ff3df2', '#39ff88', '#ff9a3d', '#b06bff', '#ffe14d'];
var TONES = [880, 988, 1047, 1175, 1319, 784];
var PRESETS = [[60, '1m'], [180, '3m'], [300, '5m'], [600, '10m'], [900, '15m'], [1800, '30m'], [3600, '1h']];
var box, tabEl, st, tick = null, baseTitle = document.title;

function save() { try { localStorage.setItem(LS, JSON.stringify(st)); } catch { /* ignora */ } }
function load() {
  var s;
  try { s = JSON.parse(localStorage.getItem(LS) || 'null'); } catch { s = null; }
  if (!s || !Array.isArray(s.list)) s = { list: [], seq: 0 };
  return s;
}
function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function find(id) { return st.list.filter(function (t) { return t.id === id; })[0]; }
function left(t) { return t.endAt ? t.endAt - Date.now() : t.left; }
function state(t) { return t.ring ? 'ring' : t.endAt ? 'run' : t.left < t.dur ? 'pause' : 'idle'; }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function clock(ms) {
  var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
  return h ? h + ':' + pad(m) + ':' + pad(r) : pad(m) + ':' + pad(r);
}
function hhmm(ts) { var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function durTxt(ms) {
  var s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
  return [h ? h + ' h' : '', m ? m + ' min' : '', r ? r + ' s' : ''].filter(Boolean).join(' ') || '0 s';
}
function meta(t) {
  var s = state(t);
  if (s === 'ring') return 'TEMPO ESGOTADO';
  if (s === 'run') return 'TERMINA ' + hhmm(t.endAt);
  if (s === 'pause') return 'PAUSADO · FALTAM ' + durTxt(Math.ceil(t.left / 1000) * 1000);
  return 'PRONTO · ' + durTxt(t.dur);
}
function filled(t) {
  var s = state(t);
  if (s === 'ring') return 0;
  if (s === 'idle') return SEGS;
  return Math.max(0, Math.min(SEGS, Math.ceil(left(t) / t.dur * SEGS)));
}

// ---------- ações ----------
function add() {
  if (st.list.length >= MAX) return;
  st.seq = (st.seq || 0) + 1;
  var used = st.list.map(function (t) { return t.c; }), c = 0;
  while (used.indexOf(c) > -1 && c < COLORS.length - 1) c++;
  if (used.indexOf(c) > -1) c = st.seq % COLORS.length;
  st.list.push({ id: 't' + Date.now().toString(36) + st.seq, name: 'TIMER ' + st.seq, c: c, dur: 300000, left: 300000, endAt: null, ring: false });
  save(); render();
  var last = box.querySelector('.tcard:last-of-type');
  if (last) try { last.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch { /* ignora */ }
}
function setDur(t, ms) { ms = Math.max(5000, Math.min(ms, 24 * 3600000)); t.dur = ms; t.left = ms; }
function act(t, a, v) {
  if (a === 'start') {
    unlock();
    if (state(t) === 'idle') t.left = t.dur;
    t.endAt = Date.now() + t.left; loop();
  } else if (a === 'pause') { t.left = left(t); t.endAt = null; }
  else if (a === 'reset') { stop(t.id); t.ring = false; t.endAt = null; t.left = t.dur; }
  else if (a === 'ok') { stop(t.id); t.ring = false; t.endAt = null; t.left = t.dur; }
  else if (a === 'plus') {
    stop(t.id); unlock();
    if (t.ring) { t.ring = false; t.endAt = Date.now() + 60000; t.dur = Math.max(t.dur, 60000); }
    else if (t.endAt) t.endAt += 60000;
    else t.left += 60000;
    if (t.left > t.dur) t.dur = t.left;
    loop();
  } else if (a === 'preset') setDur(t, v * 1000);
  else if (a === 'adj') setDur(t, t.dur + v * 1000);
  else if (a === 'del') { stop(t.id); st.list = st.list.filter(function (x) { return x !== t; }); }
  wakeSync(); save(); render();
}
function wakeSync() { wake('timers', st.list.some(function (t) { return t.endAt; })); }

// ---------- relógio ----------
function loop() { if (!tick) tick = setInterval(update, 250); }
function update() {
  var running = 0, ringing = 0, soon = null, changed = false;
  st.list.forEach(function (t) {
    if (t.endAt && left(t) <= 0) { t.endAt = null; t.left = 0; t.ring = true; changed = true; ring(t.id, TONES[t.c % TONES.length]); }
    if (t.ring) ringing++;
    if (t.endAt) { running++; if (!soon || t.endAt < soon.endAt) soon = t; }
  });
  if (changed) { save(); wakeSync(); render(); }
  else if (box && !box.hidden) {
    st.list.forEach(function (t) {
      var card = box.querySelector('[data-id="' + t.id + '"]');
      if (!card || !t.endAt) return;
      card.querySelector('.tclock').textContent = clock(left(t));
      var f = filled(t), segs = card.querySelectorAll('.tbar i');
      Array.prototype.forEach.call(segs, function (s, i) { s.className = i < f ? 'on' : ''; });
      card.classList.toggle('low', left(t) <= 10000);
    });
  }
  // aba e título mostram o que está acontecendo mesmo de outra aba
  if (tabEl) {
    tabEl.textContent = 'TIMERS' + (running + ringing ? ' · ' + (running + ringing) : '');
    tabEl.classList.toggle('tab-alarm', ringing > 0);
  }
  document.title = ringing ? '⏰ TEMPO! · ' + baseTitle : soon ? '⏱ ' + clock(left(soon)) + ' · ' + baseTitle : baseTitle;
  if (!running && !ringing) { clearInterval(tick); tick = null; }
}

// ---------- interface ----------
function cardHtml(t, i) {
  var s = state(t), col = COLORS[t.c % COLORS.length], f = filled(t), segs = '';
  for (var k = 0; k < SEGS; k++) segs += '<i' + (k < f ? ' class="on"' : '') + '></i>';
  var h = '<article class="tcard ' + s + (t.endAt && left(t) <= 10000 ? ' low' : '') + '" style="--tc:' + col + '" data-id="' + t.id + '">';
  h += '<div class="thead"><span class="tp">P' + (i + 1) + '</span>' +
    '<label class="tname-wrap"><span class="sr">Nome do timer</span><input class="tname" value="' + esc(t.name) + '" maxlength="24" autocomplete="off" spellcheck="false" enterkeyhint="done"><span class="tpen" aria-hidden="true">✎</span></label>' +
    '<button type="button" class="tdel" data-a="del" aria-label="Remover ' + esc(t.name) + '">✕</button></div>';
  h += '<div class="tscreen"><div class="tclock" aria-live="off">' + (s === 'ring' ? 'TEMPO!' : clock(s === 'idle' ? t.dur : left(t))) + '</div>' +
    '<div class="tbar" aria-hidden="true">' + segs + '</div><p class="tmeta">' + meta(t) + '</p></div>';
  if (s === 'idle') {
    h += '<div class="tset"><div class="tchips">' + PRESETS.map(function (p) {
      return '<button type="button" class="tchip' + (t.dur === p[0] * 1000 ? ' cur' : '') + '" data-a="preset" data-v="' + p[0] + '">' + p[1] + '</button>';
    }).join('') + '</div><div class="tadj">' +
      [[-60, '−1m'], [-10, '−10s'], [10, '+10s'], [60, '+1m']].map(function (p) { return '<button type="button" class="tchip" data-a="adj" data-v="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div></div>';
  }
  h += '<div class="tctl">';
  if (s === 'ring') h += '<button type="button" class="tbtn main" data-a="ok">OK</button><button type="button" class="tbtn sm" data-a="plus" aria-label="Mais 1 minuto">+1m</button>';
  else if (s === 'run') h += '<button type="button" class="tbtn main" data-a="pause"><span class="ico">❚❚</span> PAUSAR</button><button type="button" class="tbtn sm" data-a="plus" aria-label="Mais 1 minuto">+1m</button><button type="button" class="tbtn sm" data-a="reset" aria-label="Zerar">↺</button>';
  else if (s === 'pause') h += '<button type="button" class="tbtn main" data-a="start"><span class="ico">▶</span> CONTINUAR</button><button type="button" class="tbtn sm" data-a="reset" aria-label="Zerar">↺</button>';
  else h += '<button type="button" class="tbtn main" data-a="start"><span class="ico">▶</span> INICIAR</button>';
  return h + '</div></article>';
}
var COIN = ['..oooo..', '.oyyyyo.', 'oyyooyyo', 'oyoyyyyo', 'oyoyyyyo', 'oyyooyyo', '.oyyyyo.', '..oooo..'];
function coinSvg() {
  var r = '';
  COIN.forEach(function (row, y) { row.split('').forEach(function (c, x) { if (c !== '.') r += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + (c === 'o' ? '#ff9a3d' : '#ffe14d') + '"/>'; }); });
  return '<svg class="coin" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">' + r + '</svg>';
}
function render() {
  if (!box || box.hidden) return;
  var n = st.list.length, run = st.list.filter(function (t) { return t.endAt || t.ring; }).length;
  var h = '<section aria-labelledby="ht1"><h2 class="stage-h" id="ht1"><span class="lv">' + n + '/' + MAX + '</span> TIMERS' + (run ? ' · ' + run + ' EM JOGO' : '') + '</h2>';
  if (!n) {
    h += '<div class="tempty px">' + coinSvg() + '<p class="blink">INSIRA UMA FICHA</p><span>Crie timers para incubações, centrífuga, estufa…<br>Vários podem rodar ao mesmo tempo.</span><button type="button" class="tbtn main tnew" data-a="new">+ NOVO TIMER</button></div>';
  } else {
    h += '<div class="tgrid">' + st.list.map(cardHtml).join('') + '</div>';
    if (n < MAX) h += '<button type="button" class="tadd" data-a="new">' + coinSvg() + '<span>+ NOVO TIMER</span></button>';
  }
  box.innerHTML = h + '</section>';
}

function onClick(e) {
  var b = e.target.closest('[data-a]');
  if (!b) return;
  var a = b.getAttribute('data-a');
  if (a === 'new') { add(); return; }
  var card = b.closest('[data-id]'), t = card && find(card.getAttribute('data-id'));
  if (t) act(t, a, +b.getAttribute('data-v'));
}
function onName(e) {
  if (!e.target.classList.contains('tname')) return;
  var t = find(e.target.closest('[data-id]').getAttribute('data-id'));
  if (t) { t.name = e.target.value; save(); }
}

export function initTimers(el) {
  box = el;
  tabEl = document.querySelector('.tab[data-mode="tim"]');
  st = load();
  box.addEventListener('click', onClick);
  box.addEventListener('input', onName);
  box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.classList.contains('tname')) e.target.blur(); });
  box.addEventListener('focusout', function (e) {
    if (!e.target.classList.contains('tname')) return;
    var t = find(e.target.closest('[data-id]').getAttribute('data-id'));
    if (t && !t.name.trim()) { t.name = 'TIMER'; e.target.value = t.name; save(); }
  });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') update(); });
  st.list.forEach(function (t) { if (t.ring) ring(t.id, TONES[t.c % TONES.length]); });
  if (st.list.some(function (t) { return t.endAt || t.ring; })) { wakeSync(); update(); loop(); }
}
export function renderTimers() { render(); }
