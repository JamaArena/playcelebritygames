// Sound for Palm City, all synthesised in the browser (no audio files, nothing to license):
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
  sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.voices ? .5 : 0; sfxBus.connect(master);
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

// ---------- Voices: vowel-shaped gibberish, pitched per character ----------
// Formant pairs for a, e, i, o, u: a buzzing tone through two band-pass filters sounds like a vowel.
const VOWELS = { a: [800, 1200], e: [500, 1900], i: [320, 2300], o: [520, 900], u: [330, 800] };
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export function voiceFor(id, hint) { const h = hash(id || 'me'); const high = hint === 'high' || (hint !== 'low' && h % 2); return { pitch: (high ? 205 : 118) * (1 + (h % 7 - 3) * .035), wobble: .9 + (h % 5) * .05 }; }
function syllable(t, vowel, pitch, len, { glide = 0, gain = .5, breath = .12 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain(), [f1, f2] = VOWELS[vowel] || VOWELS.a;
  o.type = 'sawtooth'; o.frequency.setValueAtTime(pitch, t); if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(60, pitch * glide), t + len);
  const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 6; vg.gain.value = pitch * .02; vib.connect(vg).connect(o.frequency);
  const mixOut = ctx.createGain(); mixOut.gain.value = 1;
  for (const [f, q, lvl] of [[f1, 7, 1], [f2, 9, .55]]) { const bp = ctx.createBiquadFilter(), lg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; lg.gain.value = lvl; o.connect(bp).connect(lg).connect(mixOut); }
  if (breath) { const n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = noise; nf.type = 'bandpass'; nf.frequency.value = f2; ng.gain.value = breath; n.connect(nf).connect(ng).connect(mixOut); n.start(t); n.stop(t + len + .05); }
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .025); g.gain.setValueAtTime(gain, t + len * .6); g.gain.exponentialRampToValueAtTime(.001, t + len);
  mixOut.connect(g).connect(sfxBus); o.start(t); o.stop(t + len + .05); vib.start(t); vib.stop(t + len + .05);
}
// "Bla bla": one babble syllable per couple of letters, with a question lilting up and an exclamation punching.
export function babble(text, voice = voiceFor('me')) {
  if (!prefs.voices || !audio()) return;
  const clean = String(text).replace(/[^\p{L}\p{N}?!.\s]/gu, '').trim(); if (!clean) return;
  const n = Math.max(2, Math.min(9, Math.round(clean.length / 5))), ask = /\?\s*$/.test(clean), shout = /!\s*$/.test(clean), keys = Object.keys(VOWELS);
  let t = ctx.currentTime + .02;
  for (let i = 0; i < n; i++) {
    const last = i === n - 1, len = .085 + ((hash(clean) >> i) % 4) * .02, p = voice.pitch * voice.wobble * (1 + (((hash(clean + i) % 9) - 4) * .04)) * (last && ask ? 1.25 : 1) * (shout ? 1.12 : 1);
    syllable(t, keys[hash(clean.slice(i * 2) + i) % keys.length], p, last ? len * 1.5 : len, { glide: last ? (ask ? 1.35 : shout ? .9 : .85) : 1, gain: shout ? .62 : .5 });
    t += len + .03 + (i % 3 === 2 ? .05 : 0);
  }
}
// Expressions, by emote or reaction.
export function express(kind, voice = voiceFor('me')) {
  if (!prefs.voices || !audio()) return;
  const t = ctx.currentTime + .02, p = voice.pitch;
  const run = (list) => { let at = t; for (const [v, mul, len, opts, gap = .02] of list) { syllable(at, v, p * mul, len, opts); at += len + gap; } };
  switch (kind) {
    case 'laugh': run([[ 'a', 1.3, .1, { breath: .35 }, .05], ['a', 1.22, .1, { breath: .35 }, .05], ['a', 1.15, .1, { breath: .35 }, .05], ['a', 1.08, .1, { breath: .35 }, .05], ['a', 1, .16, { breath: .4, glide: .85 }]]); break;
    case 'huh': run([['u', .95, .28, { glide: 1.5 }]]); break;
    case 'wow': run([['u', .9, .1, {}, 0], ['o', 1.15, .32, { glide: .82 }]]); break;
    case 'yay': run([['e', 1.25, .12, {}, .03], ['a', 1.5, .3, { glide: 1.12 }]]); break;
    case 'cry': run([['u', 1.1, .3, { glide: .8, breath: .3 }, .08], ['u', 1.05, .3, { glide: .78, breath: .3 }, .08], ['u', 1, .4, { glide: .7, breath: .35 }]]); break;
    case 'ugh': run([['u', .8, .3, { glide: .75, breath: .25 }]]); break;
    case 'hey': run([['e', 1.2, .14, {}, .02], ['i', 1.35, .2, { glide: 1.08 }]]); break;
    case 'cheese': run([['i', 1.3, .35, { glide: 1.02 }]]); click(t + .45); break;
    case 'woo': run([['u', 1.3, .35, { glide: 1.4 }]]); break;
  }
}
function click(t) { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = noise; g.gain.setValueAtTime(.6, t); g.gain.exponentialRampToValueAtTime(.001, t + .04); s.connect(g).connect(sfxBus); s.start(t); s.stop(t + .05); }
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
  if (key === 'voices') sfxBus.gain.setTargetAtTime(on ? .5 : 0, ctx.currentTime, .05);
}
// Start on the first tap or key press (browsers block sound before that).
const wake = () => { if (!audio()) return; if (prefs.music) startMusic(); removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); };
addEventListener('pointerdown', wake); addEventListener('keydown', wake);
