import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const MEDIAPIPE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

function getLandmarker() {
  if (!landmarkerPromise) {
    // This worker is bundled as an ES module. Select MediaPipe's ES module WASM
    // loader so it exposes ModuleFactory on the worker global before task setup.
    landmarkerPromise = FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL, true).then(async (files) => {
      const options = { runningMode: "IMAGE" as const, numFaces: 1, outputFacialTransformationMatrixes: true };
      try {
        return await FaceLandmarker.createFromOptions(files, { ...options, baseOptions: { modelAssetPath: LANDMARKER_MODEL_URL, delegate: "GPU" } });
      } catch {
        return FaceLandmarker.createFromOptions(files, { ...options, baseOptions: { modelAssetPath: LANDMARKER_MODEL_URL, delegate: "CPU" } });
      }
    });
  }
  return landmarkerPromise;
}

self.addEventListener("message", async (event: MessageEvent<{ id: number; image: ImageBitmap }>) => {
  try {
    const result = (await getLandmarker()).detect(event.data.image);
    event.data.image.close();
    if (result.faceLandmarks.length !== 1) {
      self.postMessage({ id: event.data.id, present: false, yaw: 0, pitch: 0, confidence: 0 });
      return;
    }
    const matrix = result.facialTransformationMatrixes?.[0]?.data;
    const yaw = matrix ? Math.atan2(Number(matrix[8]), Number(matrix[10])) * (180 / Math.PI) : 0;
    const pitch = matrix ? Math.atan2(-Number(matrix[9]), Math.hypot(Number(matrix[8]), Number(matrix[10]))) * (180 / Math.PI) : 0;
    self.postMessage({ id: event.data.id, present: true, yaw, pitch, confidence: 90 });
  } catch (error) {
    event.data.image.close();
    self.postMessage({ id: event.data.id, error: error instanceof Error ? error.message : "Face analysis unavailable" });
  }
});
