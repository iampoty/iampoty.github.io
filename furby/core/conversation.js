/* ==========================================================================
 * conversation.js — simulated "two Furbies talking" engine
 *
 * IMPORTANT — what is real vs. simulated here:
 *   REAL (from Hacksby / the README):
 *     - the wire format itself (via protocol.js + audio-engine.js)
 *     - command 820  "listen for ~60s"      (keep-alive, used by the official app)
 *     - command 813  "what's your personality?" -> reply 900..905
 *     - event   883  "tasty" / 884 "not tasty"   (Furby's real reaction codes
 *                                                   to being fed something)
 *   SIMULATED (invented here, NOT reverse-engineered — there is no public
 *   spec for Furby's internal decision-making):
 *     - FurbyPersona's mood/hunger state and its rule for WHEN to like or
 *       dislike a given food code, when to go idle, when to fall asleep, etc.
 *     - There is no per-device identity/pairing in this 2012 audio protocol
 *       (that's a different product, the Bluetooth "Furby Connect" from 2016).
 *       Any two Furbies in earshot react to any command — this sim mirrors
 *       that: personas don't "authenticate" each other, they just listen.
 *
 * Two FurbyPersona instances exchange real, fully-encoded/decoded audio
 * packets (run digitally through the real Decoder, and optionally played
 * out loud too) — only the *decision of what to say back* is simulated.
 * Requires protocol.js and audio-engine.js to be loaded first.
 * ========================================================================== */
(function (root) {
'use strict';

const F = root.Furby;
if (!F || !F.Packet || !F.Audio || !F.Decoder) throw new Error('conversation.js requires protocol.js + audio-engine.js loaded first');

const PERSONALITY_CODES = [901, 902, 903, 904, 905];     // princess, diva, warrior, joker, gossip queen
const FOOD_CODES = [350, 352, 353, 354, 355, 356, 358, 359, 360];
const TASTY_HINT = new Set([350, 352, 353, 354, 355]);    // per Command.pm notes: "tasty" stuff
const NOT_TASTY_HINT = new Set([356, 358, 359, 360]);     // per Command.pm notes: "not tasty" stuff
const IDLE_EVENTS = [700, 701, 702, 704, 710, 716, 717, 719];  // small self-emitted events (bored/burp/happy/etc.)

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ----------------------------  FurbyPersona  -------------------------------- */
// A small simulated "brain" that decides how to react to a decoded command.
// This ruleset is intentionally simple and clearly marked as invented.
class FurbyPersona {
  constructor(name, opts) {
    opts = opts || {};
    this.name = name;
    this.personality = opts.personality || pick(PERSONALITY_CODES);
    this.asleep = false;
    this.listening = false;          // true for ~60s after receiving 820, like the real keep-alive
    this._listenUntil = 0;
    this.log = [];                   // {t, dir:'tx'|'rx', command, meaning}
  }

  // Decide a reply to a received command. Returns a command number, or null
  // for "stay silent" (a real Furby doesn't answer every single packet either).
  react(cmd, now) {
    if (this.asleep && cmd !== 862 && cmd !== 718) {
      // still wake on being addressed directly in this sim, mirroring how a
      // real Furby can be roused by handling/sound — not a documented rule.
      if (Math.random() < 0.3) return null;
      this.asleep = false;
    }
    if (cmd === 820) { this.listening = true; this._listenUntil = now + 60; return null; } // real: no verbal reply
    if (cmd === 813) return this.personality;                                              // real: personality query
    if (FOOD_CODES.includes(cmd)) {
      const likes = TASTY_HINT.has(cmd) ? true : NOT_TASTY_HINT.has(cmd) ? false : Math.random() < 0.5;
      return likes ? 883 : 884;                                                             // real: tasty/not-tasty
    }
    if (cmd === 862) { this.asleep = true; return 718; }                                    // real: sleep -> yawn
    if (cmd === 863) return pick([855, 856, 850]);        // laugh-ish reactions (simulated pick)
    if (cmd === 864) return 701;                           // burp!
    if (cmd === 865) return 704;                           // fart!
    if (cmd === 866) return 891;                            // purr-ish
    if (cmd === 867) return 717;                            // achoo
    if (cmd === 868) return pick([760, 761, 763, 764]);     // sing a snippet (simulated pick)
    if (cmd === 869) return pick([870, 872, 890]);          // talk (simulated pick)
    if (cmd >= 900 && cmd <= 911) return null;               // personality/self-id broadcast, no reply
    if ([883, 884, 701, 704, 718, 717].includes(cmd)) return Math.random() < 0.4 ? pick(IDLE_EVENTS) : null;
    // unknown/unlisted command: small chance of an idle reaction, otherwise silence
    return Math.random() < 0.25 ? pick(IDLE_EVENTS) : null;
  }

  note(dir, cmd, extra) {
    this.log.push({ t: Date.now(), dir, command: cmd, meaning: F.Command.description(cmd) || F.Command.note(cmd) || '', extra: extra || '' });
  }
}

/* ----------------------------  Conversation  -------------------------------- */
// Orchestrates two personas exchanging real encoded/decoded audio. Each "turn"
// synthesizes the sender's command, feeds the samples straight into the
// receiver's Decoder (digital routing — reliable regardless of speakers/mic),
// and optionally also plays them audibly via a supplied AudioContext so a
// human can listen in. The receiver then decides a reply via FurbyPersona.react().
class Conversation {
  constructor(personaA, personaB, opts) {
    this.a = personaA; this.b = personaB;
    this.o = Object.assign({ fs: 44100, audible: true, volume: 0.4, turnGapMs: 250, maxTurns: 40 }, opts || {});
    this.ctx = null;
    this.turns = 0;
    this.stopped = false;
    this.onTurn = null;      // (ev) => {} — ev: {from,to,command,meaning,reply,replyMeaning}
    this.onDone = null;
  }
  _ctx() {
    if (this.o.audible && !this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    return this.ctx;
  }
  async _sendAndDecode(sender, receiver, cmd) {
    const fs = this.o.fs;
    const { samples } = F.Audio.synthCommand(cmd, fs, 1);
    sender.note('tx', cmd);

    // digital "ear": feed the exact same samples straight into the receiver's decoder
    let heard = null;
    const dec = new F.Decoder(fs, {}, { onEvent: ev => { if (ev.type === 'command') heard = ev.command; } });
    dec.push(samples); dec.push(new Float32Array(Math.round(fs * 0.05))); dec.flush();

    if (this.o.audible) {
      const ctx = this._ctx();
      if (ctx.state === 'suspended') await ctx.resume();
      const buf = ctx.createBuffer(1, samples.length, fs);
      buf.getChannelData(0).set(samples);
      const src = ctx.createBufferSource(); const g = ctx.createGain();
      g.gain.value = this.o.volume; src.buffer = buf; src.connect(g); g.connect(ctx.destination);
      await new Promise(res => { src.onended = res; src.start(); });
    } else {
      await new Promise(res => setTimeout(res, Math.min(400, samples.length / fs * 200)));
    }
    if (heard !== null) receiver.note('rx', heard);
    return heard;
  }

  async step(startCmd) {
    if (this.stopped || this.turns >= this.o.maxTurns) { if (this.onDone) this.onDone(); return false; }
    const [from, to] = this.turns % 2 === 0 ? [this.a, this.b] : [this.b, this.a];
    const cmd = startCmd != null ? startCmd : (pick([813, 820, ...FOOD_CODES, 863, 868, 869]));
    const now = Date.now() / 1000;
    const heard = await this._sendAndDecode(from, to, cmd);
    let reply = null;
    if (heard !== null) reply = to.react(heard, now);
    if (reply != null) await new Promise(res => setTimeout(res, this.o.turnGapMs));
    const ev = {
      turn: this.turns, from: from.name, to: to.name,
      command: cmd, heard, meaning: F.Command.description(cmd) || F.Command.note(cmd) || '',
      reply, replyMeaning: reply != null ? (F.Command.description(reply) || F.Command.note(reply) || '') : ''
    };
    this.turns++;
    if (this.onTurn) this.onTurn(ev);
    if (reply != null) {
      // queue the reply as next turn's starting command (role-reversed already by turns++ parity)
      this._queuedReply = reply;
    } else {
      this._queuedReply = null;
    }
    return true;
  }

  async run(openingCmd, opts) {
    opts = opts || {};
    this.stopped = false;
    let cmd = openingCmd != null ? openingCmd : 820;
    while (!this.stopped && this.turns < this.o.maxTurns) {
      const went = await this.step(cmd);
      if (!went) break;
      cmd = this._queuedReply != null ? this._queuedReply : pick([813, ...FOOD_CODES, 863, 868, 869, 820]);
      await new Promise(res => setTimeout(res, this.o.turnGapMs));
    }
    if (this.onDone) this.onDone();
  }
  stop() { this.stopped = true; }
}

/* ------------------------------  Export  ------------------------------------ */

root.Furby = root.Furby || {};
root.Furby.Persona = FurbyPersona;
root.Furby.Conversation = Conversation;
root.Furby.PERSONALITY_CODES = PERSONALITY_CODES;
root.Furby.FOOD_CODES = FOOD_CODES;

if (typeof module !== 'undefined' && module.exports) module.exports = root.Furby;

})(typeof window !== 'undefined' ? window : globalThis);
