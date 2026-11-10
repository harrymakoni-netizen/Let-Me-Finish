/**
 * A soft telephone ring for phone-call scenes, made with the Web Audio API
 * (no sound files, works offline). Returns a function that stops it early.
 */
export function ring(durationMs = 2600): () => void {
  if (typeof window === "undefined") return () => {};
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return () => {};
  let stopped = false;
  try {
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    const tones = [400, 450].map((frequency) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      osc.connect(gain);
      osc.start();
      return osc;
    });
    // Two short bursts, a gap, repeat — quiet enough not to startle.
    const level = 0.05;
    const start = ctx.currentTime + 0.05;
    for (let cycle = 0; cycle * 3000 < durationMs; cycle++) {
      const t = start + cycle * 3;
      gain.gain.setValueAtTime(level, t);
      gain.gain.setValueAtTime(0, t + 0.4);
      gain.gain.setValueAtTime(level, t + 0.6);
      gain.gain.setValueAtTime(0, t + 1.0);
    }
    const stop = () => {
      if (stopped) return;
      stopped = true;
      try {
        tones.forEach((o) => o.stop());
        void ctx.close();
      } catch {
        /* already closed */
      }
    };
    setTimeout(stop, durationMs);
    return stop;
  } catch {
    return () => {};
  }
}
