const PREVIOUS_VOLUME = 0.4;
export const THEME_VOLUME = PREVIOUS_VOLUME * 0.7;
export const THEME_FADE_MS = 1400;

let bound = false;
let fadingOut = false;
let raf = 0;
let themeMusicMuted = true;

function themeAudio() {
  const el = document.getElementById("theme-music");
  return el instanceof HTMLAudioElement ? el : null;
}

function ramp(audio, to, then) {
  cancelAnimationFrame(raf);
  const from = audio.volume;
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / THEME_FADE_MS);
    const eased = t * t * (3 - 2 * t);
    audio.volume = from + (to - from) * eased;
    if (t < 1) {
      raf = requestAnimationFrame(step);
      return;
    }
    audio.volume = to;
    then?.();
  };
  raf = requestAnimationFrame(step);
}

function onTimeupdate(event) {
  const audio = event.currentTarget;
  if (!(audio instanceof HTMLAudioElement) || fadingOut) return;
  if (!Number.isFinite(audio.duration) || audio.duration <= THEME_FADE_MS / 500) return;
  if (audio.duration - audio.currentTime > THEME_FADE_MS / 1000) return;
  fadingOut = true;
  ramp(audio, 0);
}

function onEnded(event) {
  const audio = event.currentTarget;
  if (!(audio instanceof HTMLAudioElement)) return;
  if (themeMusicMuted) {
    audio.pause();
    return;
  }
  fadingOut = false;
  audio.currentTime = 0;
  audio.volume = 0;
  void audio.play().then(() => ramp(audio, THEME_VOLUME));
}

function onVisibility() {
  const audio = themeAudio();
  if (!audio || !bound) return;
  if (document.hidden) {
    ramp(audio, 0, () => audio.pause());
    return;
  }
  if (themeMusicMuted) return;
  void audio.play().then(() => ramp(audio, THEME_VOLUME));
}

function bind(audio) {
  if (bound) return;
  bound = true;
  audio.loop = false;
  audio.addEventListener("timeupdate", onTimeupdate);
  audio.addEventListener("ended", onEnded);
  document.addEventListener("visibilitychange", onVisibility);
}

export function startThemeMusic() {
  const audio = themeAudio();
  if (!audio) return;
  bind(audio);
  audio.muted = themeMusicMuted;
  if (themeMusicMuted) {
    audio.pause();
    return;
  }
  if (!audio.paused) return;
  audio.volume = 0;
  fadingOut = false;
  const kick = () => startThemeMusic();
  void audio.play().then(() => ramp(audio, THEME_VOLUME)).catch(() => {
    window.addEventListener("pointerdown", kick, { once: true });
  });
}

export function isThemeMusicMuted() {
  return themeMusicMuted;
}

export function setThemeMusicMuted(muted) {
  themeMusicMuted = muted;
  const audio = themeAudio();
  if (!audio) return themeMusicMuted;
  bind(audio);
  audio.muted = muted;
  if (muted) {
    cancelAnimationFrame(raf);
    audio.pause();
  } else {
    startThemeMusic();
  }
  return themeMusicMuted;
}

export function toggleThemeMusic() {
  return setThemeMusicMuted(!themeMusicMuted);
}
