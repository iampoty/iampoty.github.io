# Hacksby — Web/JavaScript port

Port of [iafan/Hacksby](https://github.com/iafan/Hacksby) (Perl, MIT License,
© 2013 Igor Afanasyev) — the reverse-engineered audio protocol for the 2012
Furby toy — to browser JavaScript. Open `index.html`, no build step, no server needed.

## Files

| File              | Contents                                                                 |
|-------------------|---------------------------------------------------------------------------|
| `index.html`      | Page structure only — no inline JS/CSS                                    |
| `style.css`       | All styling                                                                |
| `data.js`         | Raw data extracted verbatim from `Packet.pm` / `Command.pm` / `Dictionary.pm` — no logic |
| `protocol.js`     | Packet encode/decode + command lookups (pure logic, no audio)             |
| `audio-engine.js` | **AudioEngine** — WAV/tone synthesis (exact `Audio.pm` port) + streaming Goertzel decoder |
| `conversation.js` | Simulated two-Furby conversation engine (see honesty note below)          |
| `client.js`       | DOM wiring only — connects the UI to the modules above                    |

Load order (already set in `index.html`): `data.js` → `protocol.js` → `audio-engine.js` → `conversation.js` → `client.js`.

## What's real vs. simulated

**Verified against the real Perl source** (checked out from
`archive/refs/heads/master.zip`, cross-run against the actual Perl modules):
- `protocol.js`: encode/decode logic + the 64-entry checksum table, 152 named
  commands, and 352 Furbish phrases — byte-for-byte identical to the real files.
- `audio-engine.js` synthesis: sample count and waveform values match the real
  `Audio.pm` output to within ~3×10⁻⁸ (float rounding noise only).

**New, not in the original repo:**
- The streaming decoder in `audio-engine.js` (original decodes offline via
  `bin/furby-decode.pl` + `Math::FFT`).
- All of `conversation.js`. The 2012 audio protocol has **no device pairing /
  name-color-generation handshake** — that exists only in the separate
  Bluetooth "Furby Connect" (2016) product and app, which Hacksby doesn't cover.
  What *is* real here: command `813` ("what's your personality?" → reply
  `900`-`905`) and events `883`/`884` (tasty / not-tasty reactions to food).
  Everything else in `FurbyPersona.react()` — mood, sleep state, which food
  code is liked, idle chatter — is an invented simulation heuristic, not
  reverse-engineered behavior (there's no public spec for Furby's internal AI).

## Caution

Turn your device volume all the way down before testing with a real Furby —
these are loud high-pitched tones. Educational use only, no accuracy guarantee.

Not affiliated with Hasbro. Furby is a trademark of Hasbro, Inc.
