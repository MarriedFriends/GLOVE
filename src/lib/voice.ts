/**
 * Voice-message processing. Browser-only (Web Audio API) — import from
 * Client Components.
 *
 * Anonymity by design: the recording is pitch-shifted HERE, on the user's
 * device, before it is uploaded. The unmodified voice never leaves the
 * browser.
 */

export const MAX_RECORD_SECONDS = 30;

/** >1 raises pitch (helium-style disguise); <1 would lower it. */
const MODULATION_RATE = 1.35;
/** Mono 22.05kHz keeps a 30s clip around ~1.3MB as WAV. */
const OUTPUT_SAMPLE_RATE = 22050;

/** Pitch-shift a recorded clip and return it as a WAV blob. */
export async function modulateVoice(recording: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(await recording.arrayBuffer());

    const outFrames = Math.ceil(
      (decoded.duration / MODULATION_RATE) * OUTPUT_SAMPLE_RATE,
    );
    const offline = new OfflineAudioContext(1, outFrames, OUTPUT_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.playbackRate.value = MODULATION_RATE;
    source.connect(offline.destination);
    source.start();

    const rendered = await offline.startRendering();
    return encodeWav(rendered);
  } finally {
    await ctx.close();
  }
}

/** Minimal 16-bit PCM mono WAV encoder. */
function encodeWav(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const frameCount = samples.length;
  const sampleRate = buffer.sampleRate;

  const wav = new ArrayBuffer(44 + frameCount * 2);
  const view = new DataView(wav);
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + frameCount * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, frameCount * 2, true);

  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return new Blob([wav], { type: "audio/wav" });
}
