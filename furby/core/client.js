/* ==========================================================================
 * client.js — UI wiring only.
 * All protocol logic lives in protocol.js, all audio logic in audio-engine.js,
 * and the two-Furby simulation logic lives in conversation.js. This file just
 * connects DOM elements to those modules — no packet/audio math here.
 * ========================================================================== */
(function () {
'use strict';
const $ = s => document.querySelector(s);
const P = Furby.Packet, C = Furby.Command, A = Furby.Audio;

/* ---------- storage (best-effort) ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};

/* ---------- theme ---------- */
(function () {
  const t = store.get('hacksby.theme'); if (t) document.documentElement.dataset.theme = t;
  $('#themeBtn').onclick = () => {
    const cur = document.documentElement.dataset.theme ||
      (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
    const n = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = n; store.set('hacksby.theme', n);
  };
})();

/* ---------- logging ---------- */
function log(el, cls, text) {
  const d = document.createElement('div'); d.className = cls;
  const t = new Date().toLocaleTimeString([], { hour12: false });
  d.textContent = t + '  ' + text;
  el.appendChild(d);
  while (el.childNodes.length > 300) el.removeChild(el.firstChild);
  el.scrollTop = el.scrollHeight;
}
const sendLog = (c, t) => log($('#sendLog'), c, t);
const rxLog = (c, t) => log($('#rxLog'), c, t);

/* ---------- shared AudioContext ---------- */
let ctx = null;
function ensureCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!ctx) { try { ctx = new AC({ sampleRate: 44100 }); } catch (e) { ctx = new AC(); } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function playSamples(f32, gain) {
  const c = ensureCtx();
  const buf = c.createBuffer(1, f32.length, c.sampleRate); buf.getChannelData(0).set(f32);
  const src = c.createBufferSource(); src.buffer = buf;
  const g = c.createGain(); g.gain.value = gain == null ? 1 : gain;
  src.connect(g); g.connect(c.destination);
  return new Promise(res => { src.onended = res; src.start(); });
}

/* ==========================  00 Send panel  =============================== */
const vol = () => Math.pow($('#vol').value / 100, 2);
$('#vol').oninput = () => { $('#volTxt').textContent = $('#vol').value + '%'; };
$('#vol').oninput();

let last = null, busy = false;
const cmdVal = () => parseInt($('#cmd').value, 10);

function inspect(cmd, pkts) {
  $('#insp').hidden = false;
  const [a, b] = P.splitCommand(cmd);
  $('#inspHead').textContent = 'cmd ' + cmd + '  =  hi5 ' + a + ' | lo5 ' + (b - 32) + '   →   bytes ' + a + ', ' + b + '  (2nd packet = lo5 + 32)';
  const fmt = p => '<span class="d">' + p.dataQuad + '</span> <span class="c">' + p.checksumQuad + '</span> <span class="f">' + p.footer + '</span>';
  $('#inspQ').innerHTML = fmt(pkts[0]) + '  <span class="dim">·  0.5s  ·</span>  ' + fmt(pkts[1]);
  $('#inspDiag').textContent = 'packet 1\n' + P.diagram(pkts[0].digits) + '\n\npacket 2\n' + P.diagram(pkts[1].digits) +
    '\n\nX=17500 Hz   0=16386  1=16943  3=18057  2=18614 (Hz)';
}

async function sendCommand(cmd) {
  if (!Number.isInteger(cmd) || cmd < 0 || cmd > 1023) { sendLog('er', 'command ต้องเป็นจำนวนเต็ม 0..1023'); return; }
  if (busy) { sendLog('dm', '(กำลังเล่นอยู่ — รอให้จบก่อน)'); return; } busy = true;
  try {
    const c = ensureCtx();
    const { samples, packets } = A.synthCommand(cmd, c.sampleRate, 0.9);
    inspect(cmd, packets);
    const d = C.description(cmd);
    sendLog('tx', 'TX ' + cmd + '  ' + packets.map(p => p.dataQuad + ' ' + p.checksumQuad + ' ' + p.footer).join(' | ') + (d ? '  — ' + d : ''));
    last = cmd; if (!$('#inter').checked) $('#cmd').value = cmd;
    await playSamples(samples, vol());
  } catch (e) { sendLog('er', String(e.message || e)); }
  busy = false;
}

$('#btnPlay').onclick = () => sendCommand(cmdVal());
$('#btnNext').onclick = () => sendCommand((last == null ? cmdVal() : last) + 1);
$('#btnRepeat').onclick = () => sendCommand(last == null ? cmdVal() : last);
$('#btnWav').onclick = () => {
  const cmd = cmdVal();
  try {
    const { samples } = A.synthCommand(cmd, 44100, 0.9);
    const blob = new Blob([A.toWav16(samples, 44100)], { type: 'audio/wav' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'out.wav';
    document.body.appendChild(a); a.click(); a.remove();
    sendLog('dm', 'saved out.wav (44.1 kHz mono 16-bit) for command ' + cmd);
  } catch (e) { sendLog('er', String(e.message || e)); }
};
$('#inter').onchange = () => {
  const on = $('#inter').checked;
  $('#cmd').type = on ? 'text' : 'number';
  $('#cmd').placeholder = on ? 'Enter = next · number = play · r = repeat' : '';
  if (on) { $('#cmd').value = ''; $('#cmd').focus(); } else { $('#cmd').value = last == null ? 350 : last; }
};
$('#cmd').addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  if (!$('#inter').checked) { sendCommand(cmdVal()); return; }
  const raw = $('#cmd').value.trim();
  let target;
  if (last == null && raw === '') return;
  if (raw === '') target = last + 1;
  else if (/^\d+$/.test(raw)) target = parseInt(raw, 10);
  else target = last;
  $('#cmd').value = '';
  sendCommand(target);
});

// keep-alive: the official app sends 820 every ~40 s so Furby keeps listening
let keepT = null;
$('#keep').onchange = () => {
  clearInterval(keepT);
  if ($('#keep').checked) {
    sendCommand(820);
    keepT = setInterval(() => sendCommand(820), 40000);
    sendLog('dm', 'keep-alive ON: 820 ทุก 40 วินาที');
  } else sendLog('dm', 'keep-alive OFF');
};

const QUICK = [[820, 'listen (820)'], [813, 'personality? (813)'], [350, 'food (350)'], [862, 'sleep'], [863, 'laugh'],
  [864, 'burp'], [865, 'fart'], [866, 'purr'], [867, 'sneeze'], [868, 'sing'], [869, 'talk']];
$('#quick').innerHTML = QUICK.map(([c, l]) => '<button class="chip" data-c="' + c + '">' + l + '</button>').join('');
$('#quick').onclick = e => { const b = e.target.closest('button'); if (b) sendCommand(+b.dataset.c); };

/* ==========================  01 Listen panel  ============================== */
const KEYS = ['0', '1', 'X', '3', '2'];
$('#meters').innerHTML = KEYS.map(k =>
  '<span>' + k + ' <span class="dim">' + P.TONES[k] + ' Hz</span></span><div class="bar"><i id="m' + k + '"></i></div><span id="v' + k + '" class="dim">0.0000</span>').join('');
let levels = null;
function drawMeters() {
  if (levels) KEYS.forEach(k => {
    const a = levels[k]; const w = Math.max(0, Math.min(1, (Math.log10(a + 1e-9) + 4) / 4));
    const bar = $('#m' + k); bar.style.width = (w * 100) + '%'; bar.className = a >= threshold() ? 'on' : '';
    $('#v' + k).textContent = a.toFixed(4);
  });
  if (listening) requestAnimationFrame(drawMeters);
}
const threshold = () => Math.pow(10, -4 + 3 * $('#thr').value / 100);
let dec = null;
$('#thr').oninput = () => { $('#thrTxt').textContent = threshold().toExponential(1); if (dec) dec.o.threshold = threshold(); };
$('#thr').oninput();

function makeDecoder(fs) {
  return new Furby.Decoder(fs, { threshold: threshold() }, {
    onLevels: a => { levels = a; },
    onEvent: ev => {
      if (ev.type === 'packet') {
        const p = ev.packet;
        rxLog(ev.valid ? 'dm' : 'er', 'packet ' + p.dataQuad + ' ' + p.checksumQuad + ' ' + p.footer + '  [' + (p.flag ? '2nd' : '1st') + ' data=' + p.data5 + ']  ' +
          (ev.valid ? 'checksum ✓' : (!p.prefixOk ? 'bad prefix' : !p.footerOk ? 'bad footer' : 'checksum ✗')));
      } else if (ev.type === 'command') {
        const d = C.description(ev.command), n = C.note(ev.command);
        rxLog('rx', 'RX ' + ev.command + (d ? '  — ' + d : '') + (n ? '   # ' + n : ''));
      } else if (ev.type === 'partial') {
        rxLog('er', 'RX 2nd packet without 1st (lo5=' + ev.low + ')');
      }
    }
  });
}

let listening = false, micStream = null, micNodes = null;
$('#btnMic').onclick = async () => {
  if (listening) return;
  try {
    const c = ensureCtx();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    dec = makeDecoder(c.sampleRate);
    const src = c.createMediaStreamSource(micStream);
    const proc = c.createScriptProcessor(2048, 1, 1);
    const mute = c.createGain(); mute.gain.value = 0;
    proc.onaudioprocess = e => dec.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(proc); proc.connect(mute); mute.connect(c.destination);
    micNodes = { src, proc, mute };
    listening = true; $('#btnMic').disabled = true; $('#btnMicStop').disabled = false;
    rxLog('dm', 'listening @ ' + c.sampleRate + ' Hz');
    drawMeters();
  } catch (e) { rxLog('er', 'ไมค์ใช้ไม่ได้: ' + (e.message || e)); }
};
$('#btnMicStop').onclick = () => {
  listening = false;
  if (micNodes) { try { micNodes.src.disconnect(); micNodes.proc.disconnect(); micNodes.mute.disconnect(); } catch (e) {} micNodes = null; }
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  if (dec) dec.flush();
  $('#btnMic').disabled = false; $('#btnMicStop').disabled = true; rxLog('dm', 'stopped');
};

function feed(x, fs) {
  const d = makeDecoder(fs); dec = d;
  for (let i = 0; i < x.length; i += 4096) d.push(x.subarray(i, Math.min(i + 4096, x.length)));
  d.push(new Float32Array(Math.round(fs * 0.3))); d.flush();
}
$('#wavIn').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const c = ensureCtx();
    const ab = await f.arrayBuffer();
    const buf = await c.decodeAudioData(ab);
    rxLog('dm', f.name + ': ' + buf.sampleRate + ' Hz, ' + buf.duration.toFixed(2) + ' s, ' + buf.numberOfChannels + ' ch');
    feed(buf.getChannelData(0), buf.sampleRate);
    rxLog('dm', 'done');
  } catch (err) { rxLog('er', 'ถอดไฟล์ไม่ได้: ' + (err.message || err)); }
};
$('#btnSelf').onclick = () => {
  const cmd = Number.isInteger(cmdVal()) ? cmdVal() : 350, fs = 44100;
  try {
    const { samples } = A.synthCommand(cmd, fs, 0.5);
    const noisy = samples.map(v => v + (Math.random() * 2 - 1) * 0.01);
    rxLog('dm', 'self-test: encode ' + cmd + ' → decode (44.1 kHz, noise 1%)');
    feed(noisy, fs);
  } catch (e) { rxLog('er', String(e.message || e)); }
};

/* ==========================  02 Conversation panel  ========================= */
const PERSONALITY_LABEL = { 901: 'Princess', 902: 'Diva', 903: 'Warrior', 904: 'Joker', 905: 'Gossip Queen' };
[$('#persA'), $('#persB')].forEach((sel, i) => {
  sel.innerHTML = Furby.PERSONALITY_CODES.map(c => '<option value="' + c + '">' + c + ' — ' + PERSONALITY_LABEL[c] + '</option>').join('');
  sel.value = Furby.PERSONALITY_CODES[i === 0 ? 0 : 2]; // default: A=Princess, B=Warrior — an arbitrary demo pairing
});
$('#convVol').oninput = () => { $('#convVolTxt').textContent = $('#convVol').value + '%'; };
$('#convVol').oninput();

function convBubble(cls, html) {
  const el = $('#convo');
  const d = document.createElement('div'); d.className = 'bubble ' + cls; d.innerHTML = html;
  el.appendChild(d); el.scrollTop = el.scrollHeight;
}
function sysNote(text) { convBubble('sys', text); }

let activeConv = null;
function turnToHtml(ev) {
  const meaning = ev.meaning ? esc(ev.meaning) : (ev.heard === null ? '<span class="dim">ถอดรหัสไม่ได้ (สัญญาณเพี้ยน?)</span>' : '');
  let html = '<div class="who">' + esc(ev.from) + ' → ' + esc(ev.to) + '</div>' +
    '<div class="cmd">' + ev.command + '</div><div class="meaning">' + meaning + '</div>';
  return html;
}
function replyToHtml(ev) {
  const meaning = ev.replyMeaning ? esc(ev.replyMeaning) : '';
  return '<div class="who">' + esc(ev.to) + ' (ตอบกลับ)</div><div class="cmd">' + ev.reply + '</div><div class="meaning">' + meaning + '</div>';
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function buildConversation() {
  const a = new Furby.Persona('Furby A', { personality: +$('#persA').value });
  const b = new Furby.Persona('Furby B', { personality: +$('#persB').value });
  const conv = new Furby.Conversation(a, b, {
    audible: $('#convAudible').checked,
    volume: Math.pow($('#convVol').value / 100, 2),
    maxTurns: Math.max(1, Math.min(60, parseInt($('#turns').value, 10) || 12)),
    turnGapMs: 220
  });
  conv.onTurn = ev => {
    convBubble(ev.turn % 2 === 0 ? 'left' : 'right', turnToHtml(ev));
    if (ev.reply != null) convBubble(ev.turn % 2 === 0 ? 'right' : 'left', replyToHtml(ev));
    if (ev.heard === null) sysNote('⚠ ' + ev.from + ' ส่ง ' + ev.command + ' แต่ ' + ev.to + ' ถอดรหัสไม่ได้');
  };
  conv.onDone = () => {
    sysNote('— จบบทสนทนา (' + conv.turns + ' รอบ) —');
    $('#btnConvStart').disabled = false; $('#btnConvStep').disabled = false; $('#btnConvStop').disabled = true;
  };
  return conv;
}

$('#btnConvStart').onclick = async () => {
  $('#convo').innerHTML = '';
  sysNote('เริ่มบทสนทนา: A = ' + PERSONALITY_LABEL[+$('#persA').value] + ', B = ' + PERSONALITY_LABEL[+$('#persB').value]);
  activeConv = buildConversation();
  $('#btnConvStart').disabled = true; $('#btnConvStep').disabled = true; $('#btnConvStop').disabled = false;
  await activeConv.run(parseInt($('#openCmd').value, 10));
};
$('#btnConvStop').onclick = () => { if (activeConv) activeConv.stop(); };
$('#btnConvStep').onclick = async () => {
  if (!activeConv || activeConv.stopped) {
    $('#convo').innerHTML = '';
    sysNote('เริ่มบทสนทนา (ทีละรอบ): A = ' + PERSONALITY_LABEL[+$('#persA').value] + ', B = ' + PERSONALITY_LABEL[+$('#persB').value]);
    activeConv = buildConversation();
    $('#btnConvStop').disabled = false;
    await activeConv.step(parseInt($('#openCmd').value, 10));
  } else {
    const next = activeConv._queuedReply != null ? activeConv._queuedReply : parseInt($('#openCmd').value, 10);
    await activeConv.step(next);
  }
};

/* ==========================  03 Commands panel  ============================= */
function renderCmds() {
  const q = $('#q').value.trim().toLowerCase(), onlyApp = $('#onlyApp').checked;
  const rows = [];
  for (const code of C.allCodes()) {
    const d = C.description(code), n = C.note(code), app = C.inApp(code);
    if (onlyApp && !app) continue;
    if (q && !(String(code).includes(q) || d.toLowerCase().includes(q) || n.toLowerCase().includes(q))) continue;
    rows.push('<tr><td class="n">' + code + (app ? '<span class="badge">!</span>' : '') + '</td><td>' +
      esc(d || '') + (n ? '<div class="dim small"># ' + esc(n) + '</div>' : '') +
      '</td><td class="a"><button class="chip" data-c="' + code + '">▶</button></td></tr>');
  }
  $('#tbody').innerHTML = rows.join('');
  $('#cnt').textContent = rows.length + ' รายการ';
}
$('#q').oninput = renderCmds; $('#onlyApp').onchange = renderCmds;
$('#tbody').onclick = e => { const b = e.target.closest('button'); if (b) sendCommand(+b.dataset.c); };

renderCmds();
})();
