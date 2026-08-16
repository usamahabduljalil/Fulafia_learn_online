import { pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

async function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
      device: "gpu" in navigator ? "webgpu" : "wasm",
      dtype: "q8",
    }) as Promise<AutomaticSpeechRecognitionPipeline>;
  }
  return transcriberPromise;
}

self.addEventListener("message", async (event: MessageEvent<{ id: number; audio: Float32Array }>) => {
  try {
    const transcriber = await getTranscriber();
    const output = await transcriber(event.data.audio) as { text?: string };
    const wordCount = output.text?.trim() ? output.text.trim().split(/\s+/).length : 0;
    self.postMessage({ id: event.data.id, wordCount });
  } catch (error) {
    self.postMessage({ id: event.data.id, wordCount: 0, error: error instanceof Error ? error.message : "Transcription unavailable" });
  }
});
