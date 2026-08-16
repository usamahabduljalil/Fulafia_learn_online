import type * as FaceApi from "face-api.js";

const FACE_API_MODEL_URL = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";
let faceApiPromise: Promise<typeof FaceApi> | null = null;
let faceWorker: Worker | null = null;
let faceRequestId = 0;
const faceRequests = new Map<number, { resolve: (value: FaceWorkerResult) => void; reject: (error: Error) => void }>();

interface FaceWorkerResult { present: boolean; yaw: number; pitch: number; confidence: number; }

export function hasUsableVideoFrame(video: HTMLVideoElement) {
  return video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    && video.videoWidth > 0
    && video.videoHeight > 0;
}

export function waitForVideoFrame(video: HTMLVideoElement, timeoutMs = 8_000) {
  if (hasUsableVideoFrame(video)) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const events: Array<keyof HTMLMediaElementEventMap> = ["loadeddata", "canplay", "playing", "resize"];
    const cleanup = () => {
      clearTimeout(timeoutId);
      events.forEach((eventName) => video.removeEventListener(eventName, check));
    };
    const check = () => {
      if (!hasUsableVideoFrame(video)) return;
      cleanup();
      resolve();
    };
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("The camera did not produce a usable frame. Restart the camera and try again."));
    }, timeoutMs);

    events.forEach((eventName) => video.addEventListener(eventName, check));
    check();
  });
}

export async function loadFaceApi() {
  if (!faceApiPromise) {
    faceApiPromise = import("face-api.js").then(async (faceapi) => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API_MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(FACE_API_MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(FACE_API_MODEL_URL),
      ]);
      return faceapi;
    });
  }
  return faceApiPromise;
}

function getFaceWorker() {
  if (!faceWorker) {
    faceWorker = new Worker(new URL("../workers/face.worker.ts", import.meta.url), { type: "module" });
    faceWorker.onmessage = (event: MessageEvent<FaceWorkerResult & { id: number; error?: string }>) => {
      const request = faceRequests.get(event.data.id);
      if (!request) return;
      faceRequests.delete(event.data.id);
      if (event.data.error) request.reject(new Error(event.data.error));
      else request.resolve(event.data);
    };
  }
  return faceWorker;
}

async function analyzeFrame(video: HTMLVideoElement) {
  await waitForVideoFrame(video);
  const id = faceRequestId++;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Camera frame capture is unavailable in this browser.");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  let image: ImageBitmap;
  try {
    image = await createImageBitmap(canvas);
  } catch {
    throw new Error("The camera frame was not ready. Keep the camera open and try again.");
  }
  return new Promise<FaceWorkerResult>((resolve, reject) => {
    faceRequests.set(id, { resolve, reject });
    getFaceWorker().postMessage({ id, image }, [image]);
  });
}

export async function captureFaceDescriptor(video: HTMLVideoElement) {
  const [faceapi] = await Promise.all([loadFaceApi(), waitForVideoFrame(video)]);
  const [recognition, landmarks] = await Promise.all([
    faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 })).withFaceLandmarks().withFaceDescriptor(),
    analyzeFrame(video),
  ]);
  if (!recognition || !landmarks.present) throw new Error("Keep exactly one well-lit face in the frame.");
  return { descriptor: Array.from(recognition.descriptor), yaw: landmarks.yaw, detectionScore: recognition.detection.score };
}

export function averageDescriptors(descriptors: number[][]) {
  if (!descriptors.length) throw new Error("No face captures were supplied");
  return Array.from({ length: 128 }, (_, index) => descriptors.reduce((sum, descriptor) => sum + descriptor[index], 0) / descriptors.length);
}

export async function faceDistance(reference: number[], candidate: number[]) {
  const faceapi = await loadFaceApi();
  return faceapi.euclideanDistance(reference, candidate);
}

export async function analyzeFaceAttention(video: HTMLVideoElement) {
  const result = await analyzeFrame(video);
  if (!result.present) return { present: false, facingForward: false, confidence: 0 };
  const yaw = Math.abs(result.yaw);
  const pitch = Math.abs(result.pitch);
  const facingForward = yaw <= 25 && pitch <= 25;
  return { present: true, facingForward, confidence: facingForward ? 90 : 65 };
}
