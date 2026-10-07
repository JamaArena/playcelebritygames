// Sound for Naija City, all synthesised in the browser (no audio files, nothing to license):
// a looping background tune, Sims-style gibberish voices for speech bubbles, expression sounds and little UI chimes.
// Browsers only allow audio after a tap or key press, so everything starts on the first interaction.

const PREFS_KEY = 'cg.sound';
const prefs = (() => { try { return { music: true, voices: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { music: true, voices: true }; } })();
const save = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {} };

let ctx = null, master, musicBus, sfxBus, noise;
function audio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  try { ctx = new AudioContext(); } catch { return null; }
  master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = prefs.music ? .055 : 0; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.voices ? .45 : 0; sfxBus.connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

// ---------- Background music: a bouncy four-chord loop with drums, bass, chords and a lead ----------
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
// Two moods: daytime (bright major) and party (minor groove, a bit faster).
const SONGS = {
  day: { bpm: 108, chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], bass: [48, 43, 45, 41],
    lead: [72, null, 76, 74, 72, null, 67, null, 71, null, 74, 72, 71, 69, 67, null, 69, null, 72, 71, 69, null, 64, null, 65, 67, 69, null, 72, null, 71, null] },
  party: { bpm: 118, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: [45, 41, 36, 43],
    lead: [69, null, 72, 69, 76, null, 74, 72, 69, null, 65, null, 67, 69, 72, null, 67, null, 64, 67, 72, null, 71, 67, 71, null, 74, 72, 71, null, 67, null] },
};
let mood = 'day', step = 0, nextAt = 0, timer = null;
function blip(t, freq, len, type, gain, bus = musicBus) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .01); g.gain.exponentialRampToValueAtTime(.0008, t + len);
  o.connect(g).connect(bus); o.start(t); o.stop(t + len + .05);
}
function hit(t, kind) {
  if (kind === 'kick') { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .12); g.gain.setValueAtTime(1.2, t); g.gain.exponentialRampToValueAtTime(.001, t + .22); o.connect(g).connect(musicBus); o.start(t); o.stop(t + .25); return; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise;
  f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
  const len = kind === 'hat' ? .05 : .16; g.gain.setValueAtTime(kind === 'hat' ? .25 : .55, t); g.gain.exponentialRampToValueAtTime(.001, t + len);
  s.connect(f).connect(g).connect(musicBus); s.start(t); s.stop(t + len + .02);
}
function schedule() {
  const song = SONGS[mood], eighth = 60 / song.bpm / 2;
  while (nextAt < ctx.currentTime + .25) {
    const t = nextAt, bar = Math.floor(step / 8) % 4, beat = step % 8;
    if (beat % 4 === 0) hit(t, 'kick'); if (mood === 'party' && beat % 2 === 0 && beat % 4) hit(t, 'kick');
    if (beat === 2 || beat === 6) hit(t, 'snare'); hit(t, 'hat');
    if (beat % 2 === 0) blip(t, NOTE(song.bass[bar] + (beat === 6 ? 7 : 0)), eighth * 1.6, 'triangle', .55);
    if (beat === 0 || beat === 3 || beat === 6) for (const n of song.chords[bar]) blip(t, NOTE(n), eighth * 2.2, 'sine', .12);
    const note = song.lead[step % song.lead.length]; if (note) blip(t, NOTE(note), eighth * 1.4, 'square', .07);
    step++; nextAt += eighth;
  }
}
function startMusic() { if (!audio() || timer) return; nextAt = ctx.currentTime + .1; timer = setInterval(schedule, 90); }
function stopMusic() { clearInterval(timer); timer = null; }
export function setMood(place) { mood = ['nightclub', 'eventHall', 'lounge', 'stadium'].includes(place) ? 'party' : 'day'; }

// ---------- Voices: soft, cute "blip" speech (think Animal Crossing), pitched per character ----------
const PENTA = [0, 2, 4, 7, 9, 12];
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export function voiceFor(id, hint) { const h = hash(id || 'me'); const high = hint === 'high' || (hint !== 'low' && h % 2); return { pitch: (high ? 330 : 210) * (1 + (h % 7 - 3) * .03), wobble: 1 }; }
// One rounded note: a triangle wave through a gentle low-pass, quick fade in and out.
function tone(t, freq, len, { glide = 1, gain = .18, vibrato = 0, type = 'triangle' } = {}) {
  const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (glide !== 1) o.frequency.exponentialRampToValueAtTime(freq * glide, t + len);
  if (vibrato) { const v = ctx.createOscillator(), vg = ctx.createGain(); v.frequency.value = vibrato; vg.gain.value = freq * .025; v.connect(vg).connect(o.frequency); v.start(t); v.stop(t + len + .05); }
  lp.type = 'lowpass'; lp.frequency.value = Math.min(4000, freq * 3.2); lp.Q.value = .6;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .012); g.gain.setValueAtTime(gain, t + len * .55); g.gain.exponentialRampToValueAtTime(.001, t + len);
  o.connect(lp).connect(g).connect(sfxBus); o.start(t); o.stop(t + len + .05);
}
const semis = (base, n) => base * Math.pow(2, n / 12);
// "Bla bla": a short blip per syllable, its note picked from the letters, so the same words always sound the same.
export function babble(text, voice = voiceFor('me')) {
  if (!prefs.voices || !audio()) return;
  const clean = String(text).replace(/[^\p{L}\p{N}?!.\s]/gu, '').trim(); if (!clean) return;
  const words = clean.split(/\s+/).slice(0, 10), ask = /\?\s*$/.test(clean), shout = /!\s*$/.test(clean);
  let t = ctx.currentTime + .02, k = 0;
  for (const word of words) {
    const syl = Math.max(1, Math.min(3, Math.round(word.length / 3)));
    for (let i = 0; i < syl; i++, k++) {
      const last = k === words.length * 2, step = PENTA[hash(word + i) % PENTA.length];
      tone(t, semis(voice.pitch, step), .065, { gain: shout ? .2 : .16 }); t += .085;
    }
    t += .04;
  }
  if (ask) tone(t, semis(voice.pitch, 7), .16, { glide: 1.25, gain: .15 });
  else if (shout) tone(t, semis(voice.pitch, 12), .12, { gain: .17 });
}
// Expressions for emotes and reactions.
export function express(kind, voice = voiceFor('me')) {
  if (!prefs.voices || !audio()) return;
  const t0 = ctx.currentTime + .02, p = voice.pitch, seq = (list) => { let t = t0; for (const [st, len, opts = {}, gap = .03] of list) { tone(t, semis(p, st), len, opts); t += len + gap; } };
  switch (kind) {
    case 'laugh': seq([[12, .07, {}, .04], [9, .07, {}, .04], [12, .07, {}, .04], [9, .07, {}, .04], [7, .12, { vibrato: 9 }]]); break;
    case 'huh': seq([[0, .22, { glide: 1.4 }]]); break;
    case 'hmm': seq([[2, .26, { glide: .94, gain: .13, vibrato: 5 }]]); break;
    case 'wow': seq([[0, .12, { glide: 1.35 }, 0], [5, .26, { glide: .8 }]]); break;
    case 'yay': seq([[0, .07, {}, .02], [4, .07, {}, .02], [7, .07, {}, .02], [12, .24, { vibrato: 7 }]]); break;
    case 'cry': seq([[7, .26, { glide: .88, vibrato: 7, gain: .14 }, .06], [5, .26, { glide: .86, vibrato: 7, gain: .14 }, .06], [2, .34, { glide: .8, vibrato: 7, gain: .13 }]]); break;
    case 'ugh': seq([[-5, .24, { glide: .82, gain: .15 }]]); break;
    case 'hey': seq([[4, .08, {}, .03], [9, .16, { glide: 1.08 }]]); break;
    case 'cheese': seq([[12, .26, { vibrato: 6 }]]); click(t0 + .32); break;
    case 'woo': seq([[0, .3, { glide: 1.6 }]]); break;
  }
}
function click(t) { const s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noise; lp.type = 'lowpass'; lp.frequency.value = 2500; g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .04); s.connect(lp).connect(g).connect(sfxBus); s.start(t); s.stop(t + .05); }
export const EMOTE_SOUNDS = { laugh: 'laugh', cry: 'cry', facepalm: 'ugh', victory: 'yay', wave: 'hey', selfie: 'cheese', dance: 'woo', shoki: 'woo', huh: 'huh', wow: 'wow' };

// ---------- UI chimes ----------
export function chime(kind) {
  if (!prefs.voices || !audio()) return;
  const t = ctx.currentTime + .01;
  if (kind === 'reward') [72, 76, 79, 84].forEach((n, i) => blip(t + i * .09, NOTE(n), .35, 'triangle', .35, sfxBus));
  else if (kind === 'coin') { blip(t, NOTE(88), .08, 'square', .18, sfxBus); blip(t + .07, NOTE(93), .3, 'square', .18, sfxBus); }
  else if (kind === 'ding') blip(t, NOTE(84), .5, 'sine', .3, sfxBus);
  else if (kind === 'pop') blip(t, NOTE(79), .06, 'sine', .25, sfxBus);
}

// ---------- Settings ----------
export function soundPrefs() { return { ...prefs }; }
export function setSound(key, on) {
  prefs[key] = on; save(); if (!audio()) return;
  if (key === 'music') { musicBus.gain.setTargetAtTime(on ? .055 : 0, ctx.currentTime, .2); on ? startMusic() : stopMusic(); }
  if (key === 'voices') sfxBus.gain.setTargetAtTime(on ? .45 : 0, ctx.currentTime, .05);
}
// Start on the first tap or key press (browsers block sound before that).
const wake = () => { if (!audio()) return; if (prefs.music) startMusic(); removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); };
addEventListener('pointerdown', wake); addEventListener('keydown', wake);
