// Lab Arcade — aba PROTOCOLOS: etapas com timer por etapa.
// Avanço sempre manual. Fim do timer: som + vibração (vibração não existe no Safari do iPhone).
// Um timer por vez; ele continua rodando se você navegar para outra etapa.

var LS = 'labarcade-pro';
import { unlock, ring as ringId, stop as stopId, wake as wakeId } from './alarme.js?v=7';

var P = [], box, st, tick = null;
function ring() { ringId('pro', 880); }
function stopRing() { stopId('pro'); }
function wake(on) { wakeId('pro', on); }

function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function load() { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch { return {}; } }
function save() { try { localStorage.setItem(LS, JSON.stringify(st)); } catch { /* ignora */ } }
function proto() { return P.filter(function (p) { return p.id === st.id; })[0] || P[0]; }
function mmss(ms) {
  var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return h ? h + ':' + p(m) + ':' + p(r) : p(m) + ':' + p(r);
}
function durTxt(d) { return d >= 3600 ? (d / 3600).toString().replace('.', ',') + ' h' : Math.round(d / 60) + ' min'; }
// T = timer único: { pid, step, lbl, dur, endAt (rodando) | left (pausado), ring (tocando) }
function left(T) { return T.endAt ? T.endAt - Date.now() : T.left; }

// ---------- timer ----------
function loop() {
  if (tick) return;
  tick = setInterval(update, 250);
}
function update() {
  var T = st.timer;
  if (!T) { clearInterval(tick); tick = null; return; }
  if (T.endAt && left(T) <= 0) {
    T.left = 0; T.endAt = null; T.ring = true; save();
    ring(); wake(false); render(); return;
  }
  var txt = mmss(left(T));
  Array.prototype.forEach.call(box.querySelectorAll('[data-clock]'), function (el) { el.textContent = txt; });
}
function start(step) {
  var p = proto(), s = p.steps[step];
  unlock(); // libera o áudio no toque do usuário (exigência do iPhone)
  var T = st.timer;
  if (T && T.pid === p.id && T.step === step) { if (!T.endAt && T.left > 0) T.endAt = Date.now() + T.left; }
  else st.timer = { pid: p.id, step: step, lbl: s.lbl || 'TIMER', dur: s.d * 1000, endAt: Date.now() + s.d * 1000, left: s.d * 1000 };
  save(); wake(true); loop(); render();
}
function pause() { var T = st.timer; if (T && T.endAt) { T.left = left(T); T.endAt = null; save(); wake(false); render(); } }
function reset() { stopRing(); st.timer = null; save(); wake(false); render(); }
function addMin() {
  var T = st.timer; if (!T) return;
  stopRing(); T.ring = false;
  if (T.endAt) T.endAt += 60000; else { T.left = Math.max(0, T.left) + 60000; T.endAt = Date.now() + T.left; }
  save(); wake(true); loop(); render();
}
function ack() { stopRing(); st.timer = null; save(); render(); }

// ---------- interface ----------
function go(i) {
  var p = proto();
  st.i = Math.max(0, Math.min(p.steps.length - 1, i));
  save(); render();
  try { box.querySelector('.pcard').scrollIntoView({ block: 'nearest' }); } catch { /* ignora */ }
}
function timerHtml(p, i) {
  var s = p.steps[i], T = st.timer;
  if (!s.d) return '';
  var mine = T && T.pid === p.id && T.step === i, other = T && !mine;
  var ms = mine ? left(T) : s.d * 1000, run = mine && T.endAt, rng = mine && T.ring;
  var h = '<div class="ptimer px' + (rng ? ' ring' : run ? ' run' : '') + '"><span class="plbl">' + esc(s.lbl || 'TIMER') + '</span>';
  h += '<span class="pclock"' + (mine ? ' data-clock' : '') + '>' + (rng ? 'TEMPO!' : mmss(ms)) + '</span><div class="tools">';
  if (rng) h += '<button type="button" class="tool pbig" data-p="ack">OK, PARAR ALARME</button><button type="button" class="tool" data-p="add">+1 MIN</button>';
  else if (other) h += '<p class="pnote">OUTRO TIMER EM ANDAMENTO (' + esc(T.lbl) + '). ZERE AQUELE PARA USAR ESTE.</p>';
  else if (run) h += '<button type="button" class="tool pbig" data-p="pause">PAUSAR</button><button type="button" class="tool" data-p="add">+1 MIN</button><button type="button" class="tool" data-p="reset">ZERAR</button>';
  else if (mine) h += '<button type="button" class="tool pbig" data-p="start">CONTINUAR</button><button type="button" class="tool" data-p="reset">ZERAR</button>';
  else h += '<button type="button" class="tool pbig" data-p="start">INICIAR ' + durTxt(s.d) + '</button>';
  return h + '</div></div>';
}
function render() {
  if (!box || box.hidden) return;
  var p = proto(), i = Math.min(st.i || 0, p.steps.length - 1), s = p.steps[i], T = st.timer, n = p.steps.length;
  document.documentElement.style.setProperty('--acc', p.acc);
  var cats = [], sel = '';
  P.forEach(function (x) { if (cats.indexOf(x.cat) < 0) cats.push(x.cat); });
  cats.forEach(function (c) {
    sel += '<optgroup label="' + esc(c) + '">';
    P.forEach(function (x) { if (x.cat === c) sel += '<option value="' + x.id + '"' + (x.id === p.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; });
    sel += '</optgroup>';
  });
  var h = '<section aria-labelledby="hp1"><h2 class="stage-h" id="hp1"><span class="lv">FASE 1</span> ESCOLHA O PROTOCOLO</h2>' +
    '<label class="sel" for="psel"><select id="psel" aria-label="Protocolo">' + sel + '</select></label><p class="selsub">' + esc(p.sub || '') + '</p></section>';
  if (T && !(T.pid === p.id && T.step === i)) {
    var tp = P.filter(function (x) { return x.id === T.pid; })[0];
    h += '<button type="button" class="pbanner px' + (T.ring ? ' ring' : '') + '" data-p="goto">⏱ ' + esc(T.lbl) + ' · <span' + (T.ring ? '' : ' data-clock') + '>' + (T.ring ? 'TEMPO!' : mmss(left(T))) + '</span>' + (T.endAt || T.ring ? '' : ' (PAUSADO)') + '<small>' + esc(tp ? tp.name : '') + ' · etapa ' + (T.step + 1) + ' · TOQUE PARA VER</small></button>';
  }
  h += '<section aria-labelledby="hp2"><h2 class="stage-h" id="hp2"><span class="lv">ETAPA ' + (i + 1) + '/' + n + '</span> MISSÃO ATUAL</h2>';
  h += '<div class="pcard px"><div class="bar" aria-hidden="true">' + p.steps.map(function (x, k) { return '<i' + (k <= i ? ' class="on"' : '') + '></i>'; }).join('') + '</div>';
  h += '<p class="ptext">' + esc(s.t) + '</p>' + timerHtml(p, i);
  h += '<div class="pnav"><button type="button" class="tool" data-p="prev"' + (i === 0 ? ' disabled' : '') + '>◀ ANTERIOR</button>' +
    (i < n - 1 ? '<button type="button" class="tool pbig" data-p="next">PRÓXIMA ▶</button>' : '<button type="button" class="tool pbig" data-p="restart">FIM! RECOMEÇAR</button>') + '</div></div></section>';
  h += '<section aria-labelledby="hp3"><h2 class="stage-h" id="hp3"><span class="lv">MAPA</span> TODAS AS ETAPAS</h2><ol class="steps psteps">' +
    p.steps.map(function (x, k) {
      return '<li class="px' + (k === i ? ' cur' : k < i ? ' past' : '') + '" data-go="' + k + '">' + esc(x.t) + (x.d ? ' <b>⏱ ' + durTxt(x.d) + '</b>' : '') + '</li>';
    }).join('') + '</ol></section>';
  box.innerHTML = h;
}

function onClick(e) {
  var b = e.target.closest('[data-p]');
  if (b) {
    var a = b.getAttribute('data-p'), i = st.i || 0;
    if (a === 'next') go(i + 1);
    else if (a === 'prev') go(i - 1);
    else if (a === 'restart') go(0);
    else if (a === 'start') start(i);
    else if (a === 'pause') pause();
    else if (a === 'reset') reset();
    else if (a === 'add') addMin();
    else if (a === 'ack') ack();
    else if (a === 'goto' && st.timer) { st.id = st.timer.pid; go(st.timer.step); }
    return;
  }
  var li = e.target.closest('[data-go]');
  if (li) go(+li.getAttribute('data-go'));
}

export async function initProto(el) {
  box = el;
  var r = await fetch('./data/protocolos.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  P = await r.json();
  st = load();
  if (!P.some(function (p) { return p.id === st.id; })) { st.id = P[0].id; st.i = 0; }
  box.addEventListener('click', onClick);
  box.addEventListener('change', function (e) {
    if (e.target.id !== 'psel') return;
    st.id = e.target.value; st.i = 0; save(); render();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || !st.timer) return;
    if (st.timer.endAt) { wake(true); update(); }
  });
  // alarme que venceu com o app fechado ou em segundo plano
  if (st.timer) {
    if (st.timer.endAt && left(st.timer) <= 0) { st.timer.endAt = null; st.timer.left = 0; st.timer.ring = true; save(); }
    if (st.timer.ring) ring(); else if (st.timer.endAt) loop();
  }
}
export function renderProto() { render(); }
