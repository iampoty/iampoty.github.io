/* ==========================================================================
 * protocol.js — Furby 2012 audio-protocol packet/command logic
 * Ported from lib/Furby/Packet.pm and lib/Furby/Command.pm
 * (https://github.com/iafan/Hacksby, Perl, MIT License, Copyright (C) 2013 Igor Afanasyev)
 *
 * Pure protocol layer: turns a command number into the 12-quaternary-digit
 * packets and back. No Web Audio, no DOM — see audio-engine.js for that.
 * Requires data.js to be loaded first (window.FurbyData).
 * ========================================================================== */
(function (root) {
'use strict';

const D = root.FurbyData;
if (!D) throw new Error('protocol.js requires data.js to be loaded first');

const TONES  = { '0': 16386, '1': 16943, 'X': 17500, '3': 18057, '2': 18614 };
const FOOTER = '1032';
const SLOTS  = 25;                 // X d0 X d1 ... d11 X  (25 symbols per packet)

const CHK = D.CHECKSUMS_64;        // 64 checksums: [0..31] 1st packet, [32..63] 2nd

function toQuad(n, len) {
  let s = '';
  for (let i = 0; i < len; i++) { s = (n & 3) + s; n >>= 2; }
  return s;
}

/* ----------------------------  Packet  ------------------------------------ */

// Port of Furby::Packet::make() — one packet = 12 quaternary digits:
//   [ 11 <6-bit value> ] [ checksum ] [ 1032 ]
function encodeByte(v6) {
  if (!(v6 >= 0 && v6 < 64)) throw new RangeError('v6 must be 0..63');
  const chk = CHK[v6];
  const dataQuad = toQuad(0xC0 | v6, 4);
  return {
    v6, flag: v6 >> 5, data5: v6 & 31,
    dataQuad, checksumQuad: chk, footer: FOOTER,
    digits: dataQuad + chk + FOOTER
  };
}

// Same split as Furby::Packet::make: packet1 = cmd>>5, packet2 = (cmd&31)+32
function splitCommand(cmd) { return [cmd >> 5, (cmd & 31) + 32]; }

function encodeCommand(cmd) {
  cmd = Number(cmd);
  if (!Number.isInteger(cmd) || cmd < 0 || cmd > 1023) throw new RangeError('command must be an integer 0..1023');
  const [a, b] = splitCommand(cmd);
  return [encodeByte(a), encodeByte(b)];
}

// Port of Furby::Packet::parse()
function decodeDigits(d) {
  const dataQuad = d.slice(0, 4), chk = d.slice(4, 8), foot = d.slice(8, 12);
  const byte = parseInt(dataQuad, 4);
  const v6 = byte & 63;
  return {
    digits: d, dataQuad, checksumQuad: chk, footer: foot, byte,
    prefixOk: (byte & 192) === 192, v6, flag: v6 >> 5, data5: v6 & 31,
    checksumOk: CHK[v6] === chk,
    footerOk: foot === FOOTER
  };
}

// ASCII spectrum diagram, identical layout to the one in the Hacksby README
function diagram(digits) {
  const seq = [];
  for (let i = 0; i < 12; i++) { seq.push('X'); seq.push(digits[i]); }
  seq.push('X');
  return ['2', '3', 'X', '1', '0'].map(row => {
    const line = new Array(54).fill('-');
    seq.forEach((t, j) => { if (t === row) { line[2 + 2 * j] = '#'; line[3 + 2 * j] = '#'; } });
    return row + '  ' + line.join('');
  }).join('\n');
}

/* ----------------------------  Command  ------------------------------------ */

const CMD_MAP = new Map(D.CMD_LIST.map(r => [r[0], r]));

// sub description { $description->{$command} || Dictionary::description($command) }
function description(code) {
  const r = CMD_MAP.get(Number(code));
  const desc = r && r[1];
  return desc || D.DICTIONARY[String(code)] || '';
}
function note(code) { const r = CMD_MAP.get(Number(code)); return r ? r[2] : ''; }
function inApp(code) { const r = CMD_MAP.get(Number(code)); return !!(r && r[3]); }
function inDictionary(code) { return D.DICTIONARY.hasOwnProperty(String(code)); }
function allCodes() {
  const s = new Set(D.CMD_LIST.map(r => r[0]));
  Object.keys(D.DICTIONARY).forEach(k => s.add(Number(k)));
  return Array.from(s).sort((a, b) => a - b);
}
function list() { return D.CMD_LIST.slice(); }
function dictionary() { return Object.assign({}, D.DICTIONARY); }

/* ------------------------------  Export  ------------------------------------ */

root.Furby = root.Furby || {};
root.Furby.Packet = { TONES, FOOTER, SLOTS, toQuad, encodeByte, splitCommand, encodeCommand, decodeDigits, diagram, getChecksums: () => CHK.slice() };
root.Furby.Command = { list, description, note, inApp, inDictionary, allCodes, dictionary };

if (typeof module !== 'undefined' && module.exports) module.exports = root.Furby;

})(typeof window !== 'undefined' ? window : globalThis);
