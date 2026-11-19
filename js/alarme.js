// Lab Arcade — som, vibração e tela acesa, compartilhados por PROTOCOLOS e TIMERS.
// Vários alarmes podem tocar juntos: cada um tem um id e um tom próprio.

var audio = null, active = {}, loop = null, cycles = 0, locks = {}, lock = null;

// Precisa ser chamado num toque do usuário (exigência do iPhone para liberar o som).
export function unlock() {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
  return audio;
}

export function beep(freq) {
  var a = unlock(); if (!a) return;
  freq = freq || 880;
  [0, 0.18, 0.36].forEach(function (t, i) {
    var o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + t;
    o.type = 'square'; o.frequency.value = i === 2 ? freq * 1.5 : freq;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + 0.15);
  });
}

function once() {
  var ids = Object.keys(active);
  if (!ids.length) return;
  ids.forEach(function (id, i) { setTimeout(function () { if (active[id]) beep(active[id]); }, i * 600); });
  try { if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]); } catch { /* ignora */ }
  if (++cycles >= 60) stopAll();   // para sozinho depois de ~90 s
}

export function ring(id, freq) {
  var isNew = !active[id];
  active[id] = freq || 880;
  if (isNew) cycles = 0;
  if (!loop) { once(); loop = setInterval(once, 1500); }
}

export function stop(id) {
  delete active[id];
  if (!Object.keys(active).length) stopAll();
}

function stopAll() {
  active = {};
  if (loop) clearInterval(loop);
  loop = null;
  try { if (navigator.vibrate) navigator.vibrate(0); } catch { /* ignora */ }
}

export function ringing(id) { return !!active[id]; }

// Tela acesa enquanto houver algum timer rodando (quem pediu: id).
function want() { return Object.keys(locks).length > 0; }
function sync() {
  try {
    if (want() && !lock && navigator.wakeLock) {
      navigator.wakeLock.request('screen').then(function (l) {
        lock = l; l.addEventListener('release', function () { lock = null; });
        if (!want()) { l.release(); }
      }, function () {});
    } else if (!want() && lock) { lock.release(); lock = null; }
  } catch { /* ignora */ }
}
export function wake(id, on) {
  if (on) locks[id] = true; else delete locks[id];
  sync();
}
// o sistema solta a trava quando o app vai para segundo plano; pede de novo ao voltar
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') sync(); });
