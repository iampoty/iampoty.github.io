/* ==========================================================================
 * audio-engine.js — Furby 2012 protocol AUDIO ENGINE
 *
 * Two halves:
 *   1. Synthesis  — a line-by-line port of lib/Furby/Audio.pm (generate_wav /
 *      add_packet / add_raw_packet / add_sine / add_silence), verified sample
 *      -for-sample against the real Perl module (see project notes).
 *   2. Decoding   — NOT in the original repo (which decodes offline via
 *      bin/furby-decode.pl + Math::FFT). This is a new streaming Goertzel
 *      filter bank built to recognise the same packet grammar in real time,
 *      so it can listen to a live mic or to another simulated Furby.
 *
 * Requires protocol.js to be loaded first (window.Furby.Packet).
 * Pure signal processing — no DOM. See client.js / conversation.js for that.
 * ========================================================================== */
(function (root) {
'use strict';

const P = root.Furby && root.Furby.Packet;
if (!P) throw new Error('audio-engine.js requires protocol.js to be loaded first');
const TONES = P.TONES, SLOTS = P.SLOTS;

/* ============================  Synthesis  ================================= */
// Constants copied verbatim from Furby::Audio (all lengths in seconds):
const BASE_FREQ_LEN = 0.016, XFADE_LEN = 0.004, LEAD_LEN = 0.005;
const SILENCE_GAP_LEN = 0.5 - LEAD_LEN * 2;      // = 0.49s (total packet gap = 0.5s)
const XFADE_VOL_SAMPLES = 220;
const PI2 = (22 / 7) * 2;                        // Perl's `my $PI = (22/7)*2;` (not the real 2*pi)

// Port of add_sine(). `length` (in samples) is kept as a float exactly like
// Perl — both the iteration count *and* the hz-sweep denominator come from
// truncating/using this float the same way the original does.
function addSine(out, pos, hz1, hz2, length, fadeInSamp, fadeOutSamp, fs, volume) {
  volume = volume == null ? 1 : volume;
  hz2 = (hz1 + hz2) / 2;                         // Perl comment: "fft magic"
  const lengthSamples = length * fs;             // NOT floored — Perl's `$length *= $sample_rate`
  const n = Math.floor(lengthSamples);           // Perl range `0 .. $length-1` truncates both ends
  for (let i = 0; i < n; i++) {
    const t = i / fs;
    const hz = n > 1 ? (i / (lengthSamples - 1)) * (hz2 - hz1) + hz1 : hz1;
    const phase = PI2 * t * hz;
    let vol = volume;
    if (fadeInSamp > 0 && i < fadeInSamp) vol = (i / (fadeInSamp + 1)) * vol;
    if (fadeOutSamp > 0 && (lengthSamples - 1 - i) < fadeOutSamp) vol = ((lengthSamples - 1 - i) / (fadeOutSamp + 1)) * vol;
    out[pos + i] = Math.sin(phase) * vol;
  }
  return pos + n;
}
// Port of add_silence(): inclusive range `0..length`, one sample longer than
// add_sine's truncated-exclusive range for the same nominal length.
function addSilence(out, pos, length, fs) {
  const n = Math.floor(length * fs) + 1;
  for (let i = 0; i < n; i++) out[pos + i] = 0;
  return pos + n;
}
// Port of add_raw_packet(): iterates over an already-interleaved 25-symbol
// string (X d0 X d1 ... d11 X), each transition crossfaded.
function addRawPacket(out, pos, symbols, fs) {
  const a = symbols.split('');
  const topFreq = fs / 2;
  pos = addSine(out, pos, topFreq, TONES[a[0]], LEAD_LEN, fs * LEAD_LEN, XFADE_VOL_SAMPLES, fs);
  for (let i = 0; i < a.length; i++) {
    pos = addSine(out, pos, TONES[a[i]], TONES[a[i]], BASE_FREQ_LEN, XFADE_VOL_SAMPLES, XFADE_VOL_SAMPLES, fs);
    if (i < a.length - 1) pos = addSine(out, pos, TONES[a[i]], TONES[a[i + 1]], XFADE_LEN, XFADE_VOL_SAMPLES, XFADE_VOL_SAMPLES, fs);
  }
  pos = addSine(out, pos, TONES[a[a.length - 1]], topFreq, LEAD_LEN, XFADE_VOL_SAMPLES, fs * LEAD_LEN, fs);
  return pos;
}
// Port of add_packet(): 12 data digits -> interleave with 'X' ("0123" => "X0X1X2X3X").
function addPacket(out, pos, digits12, fs) {
  const symbols = 'X' + digits12.split('').join('X') + 'X';
  return addRawPacket(out, pos, symbols, fs);
}
function packetLenSamples(fs) {
  return Math.floor(LEAD_LEN * fs) * 2 + Math.floor(BASE_FREQ_LEN * fs) * SLOTS + Math.floor(XFADE_LEN * fs) * (SLOTS - 1);
}

// Port of generate_wav(): silence, packet1, silence, packet2, silence.
function synthCommand(cmd, fs, amp) {
  amp = amp == null ? 1 : amp;
  fs = fs || 44100;
  const [p1, p2] = P.encodeCommand(cmd);
  const leadSilence = Math.floor(LEAD_LEN * fs) + 1, gapSilence = Math.floor(SILENCE_GAP_LEN * fs) + 1;
  const total = leadSilence * 2 + packetLenSamples(fs) * 2 + gapSilence;
  const out = new Float32Array(total);
  let pos = addSilence(out, 0, LEAD_LEN, fs);
  pos = addPacket(out, pos, p1.digits, fs);
  pos = addSilence(out, pos, SILENCE_GAP_LEN, fs);
  pos = addPacket(out, pos, p2.digits, fs);
  pos = addSilence(out, pos, LEAD_LEN, fs);
  const trimmed = out.subarray(0, pos);
  if (amp !== 1) for (let i = 0; i < trimmed.length; i++) trimmed[i] *= amp;
  return { samples: trimmed, packets: [p1, p2] };
}
// Synthesize just one packet (used by the conversation engine to send single
// bytes back-to-back without the 0.5s inter-packet silence, when useful).
function synthPacket(digits, fs, amp) {
  amp = amp == null ? 1 : amp; fs = fs || 44100;
  const out = new Float32Array(packetLenSamples(fs));
  const end = addPacket(out, 0, digits, fs);
  const trimmed = out.subarray(0, end);
  if (amp !== 1) for (let i = 0; i < trimmed.length; i++) trimmed[i] *= amp;
  return trimmed;
}

// 16-bit mono PCM WAV, matching Audio::Wav's output format.
function toWav16(samples, fs) {
  const n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, fs, true); v.setUint32(28, fs * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7FFF, true);
  }
  return new Uint8Array(buf);
}

/* ============================  Decoding  =================================== */
// New addition: streaming Goertzel filter bank + run-length symbol reader.
// Recognises  X d X d ... X  (25 symbols) -> 12 quaternary digits -> verifies
// the '11' prefix + checksum table + '1032' footer -> pairs packets into commands.

class Decoder {
  constructor(fs, opts, cb) {
    this.fs = fs;
    this.o = Object.assign({ threshold: 0.003, ratio: 2, minRun: 2, frame: 512, hop: 128,
                             silenceMs: 60, pairMs: 3000 }, opts || {});
    this.cb = cb || {};
    const N = this.o.frame;
    this.win = new Float32Array(N);
    let sw = 0;
    for (let i = 0; i < N; i++) { this.win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)); sw += this.win[i]; }
    this.sumW = sw;
    this.keys = ['0', '1', 'X', '3', '2'];
    this.coef = this.keys.map(k => 2 * Math.cos(2 * Math.PI * TONES[k] / fs));
    this.buf = new Float32Array(0); this.frameNo = 0;
    this.runTone = undefined; this.runCount = 0; this.runStart = 0;
    this.seq = []; this.hi = null;
    this.levels = { '0': 0, '1': 0, 'X': 0, '3': 0, '2': 0 };
  }
  reset() { this.buf = new Float32Array(0); this.frameNo = 0; this.runTone = undefined; this.runCount = 0; this.seq = []; this.hi = null; }
  push(samples) {
    const nb = new Float32Array(this.buf.length + samples.length);
    nb.set(this.buf); nb.set(samples, this.buf.length);
    const N = this.o.frame, H = this.o.hop;
    let pos = 0;
    while (nb.length - pos >= N) { this._frame(nb, pos); pos += H; }
    this.buf = nb.slice(Math.min(pos, nb.length));
  }
  flush() { this._endRun(); this.runTone = undefined; this.runCount = 0; }
  _frame(x, p) {
    const N = this.o.frame, amps = {}, w = this.win;
    for (let t = 0; t < 5; t++) {
      const c = this.coef[t]; let s1 = 0, s2 = 0;
      for (let n = 0; n < N; n++) { const s0 = x[p + n] * w[n] + c * s1 - s2; s2 = s1; s1 = s0; }
      const pw = s1 * s1 + s2 * s2 - c * s1 * s2;
      amps[this.keys[t]] = 2 * Math.sqrt(Math.max(pw, 0)) / this.sumW;
    }
    this.levels = amps;
    if (this.cb.onLevels) this.cb.onLevels(amps);
    let best = null, bv = 0, sv = 0;
    for (const k of this.keys) {
      const a = amps[k];
      if (a > bv) { sv = bv; bv = a; best = k; } else if (a > sv) sv = a;
    }
    const tone = (best && bv >= this.o.threshold && bv >= this.o.ratio * sv) ? best : null;
    const t = (this.frameNo * this.o.hop + N / 2) / this.fs;
    this.frameNo++;
    if (tone === this.runTone) { this.runCount++; }
    else { this._endRun(); this.runTone = tone; this.runCount = 1; this.runStart = t; }
    this.lastT = t;
  }
  _endRun() {
    if (this.runTone === undefined) return;
    const dur = this.runCount * this.o.hop / this.fs * 1000;
    if (this.runTone === null) {
      if (dur >= this.o.silenceMs) this.seq = [];
    } else if (this.runCount >= this.o.minRun) {
      this._symbol(this.runTone);
    }
  }
  _symbol(s) {
    const q = this.seq;
    if (q.length && q[q.length - 1] === s) return;
    q.push(s); if (q.length > SLOTS) q.shift();
    if (q.length < SLOTS) return;
    for (let i = 0; i < SLOTS; i++) if ((i % 2 === 0) !== (q[i] === 'X')) return;
    const digits = q.filter((_, i) => i % 2 === 1).join('');
    this.seq = [];
    this._packet(digits);
  }
  _packet(digits) {
    const d = P.decodeDigits(digits), t = this.lastT || 0;
    d.time = t;
    const valid = d.prefixOk && d.footerOk && d.checksumOk;
    this._emit({ type: 'packet', valid, packet: d });
    if (!valid) return;
    if (d.flag === 0) { this.hi = { v: d.data5, t }; }
    else {
      if (this.hi && t - this.hi.t <= this.o.pairMs / 1000) {
        const cmd = (this.hi.v << 5) | d.data5;
        this._emit({ type: 'command', command: cmd, time: t });
      } else {
        this._emit({ type: 'partial', low: d.data5, time: t });
      }
      this.hi = null;
    }
  }
  _emit(ev) { if (this.cb.onEvent) this.cb.onEvent(ev); }
}

/* ------------------------------  Export  ------------------------------------ */

root.Furby = root.Furby || {};
root.Furby.Audio = { synthPacket, synthCommand, toWav16 };
root.Furby.Decoder = Decoder;

if (typeof module !== 'undefined' && module.exports) module.exports = root.Furby;

})(typeof window !== 'undefined' ? window : globalThis);
