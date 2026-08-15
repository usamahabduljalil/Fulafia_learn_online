import { useCallback, useEffect, useRef } from "react";

export interface SpeechWindow { speakingSeconds: number; speakingTurns: number; wordCount: number; transcriptionAvailable: boolean; }

function downsample(buffer: Float32Array, sourceRate: number, targetRate = 16_000) {
  if (sourceRate === targetRate) return buffer;
  const ratio = sourceRate / targetRate;
  const output = new Float32Array(Math.round(buffer.length / ratio));
  for (let index = 0; index < output.length; index += 1) output[index] = buffer[Math.min(buffer.length - 1, Math.round(index * ratio))];
  return output;
}

export function useSpeechParticipation(stream: MediaStream | null, enabled: boolean) {
  const metricsRef = useRef<SpeechWindow>({ speakingSeconds: 0, speakingTurns: 0, wordCount: 0, transcriptionAvailable: true });

  useEffect(() => {
    if (!stream || !enabled || !stream.getAudioTracks().length) return;
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const silentGain = context.createGain(); silentGain.gain.value = 0;
    const worker = new Worker(new URL("../workers/speech.worker.ts", import.meta.url), { type: "module" });
    let chunks: Float32Array[] = [];
    let samples = 0;
    let speaking = false;
    let speakingSamples = 0;
    let requestId = 0;

    worker.onmessage = (event: MessageEvent<{ wordCount: number; error?: string }>) => {
      metricsRef.current.wordCount += event.data.wordCount;
      if (event.data.error) metricsRef.current.transcriptionAvailable = false;
    };
    processor.onaudioprocess = (event) => {
      const input = new Float32Array(event.inputBuffer.getChannelData(0));
      chunks.push(input); samples += input.length;
      let squareSum = 0; for (const sample of input) squareSum += sample * sample;
      const voiceActive = Math.sqrt(squareSum / input.length) > 0.018;
      if (voiceActive) speakingSamples += input.length;
      if (voiceActive && !speaking) metricsRef.current.speakingTurns += 1;
      speaking = voiceActive;
      if (samples >= context.sampleRate * 10) {
        const merged = new Float32Array(samples); let offset = 0;
        for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
        metricsRef.current.speakingSeconds += Math.round(speakingSamples / context.sampleRate);
        if (speakingSamples > context.sampleRate) worker.postMessage({ id: requestId++, audio: downsample(merged, context.sampleRate) }, [merged.buffer]);
        chunks = []; samples = 0; speakingSamples = 0;
      }
    };
    source.connect(processor); processor.connect(silentGain); silentGain.connect(context.destination);
    return () => { processor.disconnect(); source.disconnect(); silentGain.disconnect(); worker.terminate(); void context.close(); };
  }, [enabled, stream]);

  return useCallback(() => {
    const current = { ...metricsRef.current };
    metricsRef.current = { speakingSeconds: 0, speakingTurns: 0, wordCount: 0, transcriptionAvailable: current.transcriptionAvailable };
    return current;
  }, []);
}
