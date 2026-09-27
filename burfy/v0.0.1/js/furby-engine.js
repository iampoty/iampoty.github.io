// furby-engine.js
class FurbyAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.BASE_FREQ = 17500;
    this.FREQ_STEP = 557;
    this.SYMBOL_DURATION = 0.0186;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playSymbols(symbols) {
    this.init();
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';

    symbols.forEach((symbol, index) => {
      const startTime = now + (index * this.SYMBOL_DURATION);
      const freq = this.BASE_FREQ + (symbol * this.FREQ_STEP);
      osc.frequency.setValueAtTime(freq, startTime);
    });

    const totalDuration = symbols.length * this.SYMBOL_DURATION;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.8, now + 0.005);
    gain.gain.setValueAtTime(0.8, now + totalDuration - 0.005);
    gain.gain.linearRampToValueAtTime(0, now + totalDuration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + totalDuration);
  }

  sendHexCommand(hexCmd) {
    // แปลง Hex เป็น Symbols
    const preamble = [0, 1, 2, 3, 0, 1, 2, 3]; 
    const payloadSymbols = [];
    let num = parseInt(hexCmd, 16);
    for (let i = 0; i < 8; i++) {
      payloadSymbols.unshift(num & 3);
      num >>= 2;
    }
    this.playSymbols([...preamble, ...payloadSymbols]);
  }
}