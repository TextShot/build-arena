import { useEffect, useRef, useState } from "react";

import {
  SPACE_LOAD_FALLBACK_MS,
  SPACE_LOAD_MID_AT_MS,
  SPACE_LOAD_MIN_MS,
  spaceLoadPercent,
  spaceLoadShouldDismiss,
} from "./space-load";

const FADE_AFTER_COMPLETE_MS = 280;
const UNMOUNT_AFTER_FADE_MS = 400;

type SpaceLoadOverlayProps = Readonly<{
  spaceReady: boolean;
}>;

export function SpaceLoadOverlay({ spaceReady }: SpaceLoadOverlayProps) {
  const startedAt = useRef(performance.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [gone, setGone] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const mark = (at: number) => setElapsedMs((current) => Math.max(current, at));
    const mid = window.setTimeout(() => mark(SPACE_LOAD_MID_AT_MS), SPACE_LOAD_MID_AT_MS);
    const min = window.setTimeout(() => mark(SPACE_LOAD_MIN_MS), SPACE_LOAD_MIN_MS);
    const fallback = window.setTimeout(() => mark(SPACE_LOAD_FALLBACK_MS), SPACE_LOAD_FALLBACK_MS);
    return () => {
      window.clearTimeout(mid);
      window.clearTimeout(min);
      window.clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (!spaceReady) return;
    setElapsedMs((current) => Math.max(current, performance.now() - startedAt.current));
  }, [spaceReady]);

  const percent = spaceLoadPercent(elapsedMs, spaceReady);
  const shouldDismiss = spaceLoadShouldDismiss(elapsedMs, spaceReady);

  useEffect(() => {
    if (!shouldDismiss) return;
    const audio = document.querySelector("#theme-music");
    if (!(audio instanceof HTMLAudioElement)) return;
    audio.volume = 0.4;
    const kick = () => { void audio.play(); };
    void audio.play().catch(() => {
      window.addEventListener("pointerdown", kick, { once: true });
    });
  }, [shouldDismiss]);

  useEffect(() => {
    if (!shouldDismiss || fading || gone) return;
    const fade = window.setTimeout(() => setFading(true), FADE_AFTER_COMPLETE_MS);
    return () => window.clearTimeout(fade);
  }, [fading, gone, shouldDismiss]);

  useEffect(() => {
    if (!fading) return;
    const unmount = window.setTimeout(() => setGone(true), UNMOUNT_AFTER_FADE_MS);
    return () => window.clearTimeout(unmount);
  }, [fading]);

  if (gone) return null;

  return (
    <div
      aria-busy="true"
      className="space-load-overlay"
      data-fading={fading ? "true" : "false"}
      onTransitionEnd={(event) => {
        if (event.propertyName !== "opacity") return;
        if (event.currentTarget.dataset.fading === "true") setGone(true);
      }}
    >
      <div
        aria-label="Loading space"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="space-load-bar"
        role="progressbar"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
