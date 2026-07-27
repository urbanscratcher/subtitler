import { env, pipeline } from "/node_modules/@huggingface/transformers/dist/transformers.web.js";

const MODEL_ID = "onnx-community/whisper-base";
const WASM_PATH = "/node_modules/onnxruntime-web/dist/";

env.backends.onnx.wasm.wasmPaths = WASM_PATH;

let transcriberPromise = null;
let lastDownloadProgress = -1;

function post(requestId, type, data = {}) {
  self.postMessage({ requestId, type, ...data });
}

function progressCallback(requestId, progress) {
  const value = Number(progress?.progress);
  if (!Number.isFinite(value)) return;
  const rounded = Math.max(0, Math.min(100, Math.round(value)));
  if (rounded === lastDownloadProgress) return;
  lastDownloadProgress = rounded;
  post(requestId, "model-progress", { progress: rounded });
}

async function createTranscriber(requestId, useWebGpu) {
  const options = useWebGpu
    ? {
        device: "webgpu",
        dtype: { encoder_model: "fp16", decoder_model_merged: "q4" },
        progress_callback: progress => progressCallback(requestId, progress)
      }
    : {
        device: "wasm",
        dtype: { encoder_model: "q8", decoder_model_merged: "q4" },
        progress_callback: progress => progressCallback(requestId, progress)
      };

  return pipeline("automatic-speech-recognition", MODEL_ID, options);
}

async function getTranscriber(requestId) {
  if (!transcriberPromise) {
    const useWebGpu = Boolean(self.navigator?.gpu);
    transcriberPromise = createTranscriber(requestId, useWebGpu).catch(async error => {
      if (!useWebGpu) throw error;
      post(requestId, "model-fallback");
      lastDownloadProgress = -1;
      return createTranscriber(requestId, false);
    });
  }
  return transcriberPromise;
}

self.addEventListener("message", async event => {
  if (event.data?.type !== "transcribe") return;

  const { requestId, audio, audioLength } = event.data;
  try {
    post(requestId, "model-loading");
    const transcriber = await getTranscriber(requestId);
    post(requestId, "transcribing");
    const result = await transcriber(new Float32Array(audio, 0, audioLength), {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      task: "transcribe"
    });
    post(requestId, "result", { chunks: result.chunks || [] });
  } catch (error) {
    transcriberPromise = null;
    post(requestId, "error", { message: error?.message || String(error) });
  }
});
