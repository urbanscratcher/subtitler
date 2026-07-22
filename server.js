const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;
const VIDEO_DIR = process.env.VIDEO_DIR || path.join(ROOT, "videos");
const BUNDLED_PYTHON = "/Users/joun/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const PYTHON = process.env.PYTHON || (fs.existsSync(BUNDLED_PYTHON) ? BUNDLED_PYTHON : "python3");

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 10_000_000) req.destroy();
    });
    req.on("end", () => {
      try { resolve(JSON.parse(body || "{}")); } catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function readBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    req.on("data", chunk => {
      chunks.push(chunk);
      length += chunk.length;
      if (length > 2_000_000_000) req.destroy();
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let out = "";
    child.stdout.on("data", data => { out += data; });
    child.stderr.on("data", data => { out += data; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(out) : reject(new Error(out || `${command} exited ${code}`)));
  });
}

function safeOutputName(name) {
  const clean = path.basename(name || "video-annotated.mp4").replace(/[^\w .()가-힣-]/g, "_");
  return clean.toLowerCase().endsWith(".mp4") ? clean : `${clean}.mp4`;
}

function safeVideoName(name) {
  const clean = path.basename(decodeURIComponent(name || "video.mp4")).replace(/[^\w .()가-힣-]/g, "_");
  return /\.(mp4|mov|m4v)$/i.test(clean) ? clean : `${clean}.mp4`;
}

function escapeFilterPath(filePath) {
  return filePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/,/g, "\\,");
}

function parseSrt(srt) {
  const entries = srt.trim().split(/\n\s*\n/).map(block => {
    const lines = block.split(/\r?\n/);
    const timeLine = lines.find(line => line.includes("-->"));
    const timeIndex = lines.indexOf(timeLine);
    if (!timeLine || timeIndex < 0) throw new Error("SRT 시간 형식을 읽을 수 없습니다.");
    const [startText, endText] = timeLine.split("-->").map(value => value.trim());
    return {
      start: parseSrtTime(startText),
      end: parseSrtTime(endText),
      text: lines.slice(timeIndex + 1).join("\n").trim()
    };
  }).filter(entry => entry.text && entry.end > entry.start);

  return entries.map((entry, index) => {
    const next = entries[index + 1];
    return next && next.start > entry.start
      ? { ...entry, end: Math.min(entry.end, next.start) }
      : entry;
  });
}

function parseSrtTime(value) {
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/);
  if (!match) throw new Error(`SRT 시간 형식 오류: ${value}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

async function getVideoWidth(videoPath) {
  const output = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width",
    "-of", "csv=p=0",
    videoPath
  ]);
  const width = Number(output.trim());
  return Number.isFinite(width) && width > 0 ? width : 1280;
}

function normalizeCaptionStyle(style) {
  const fill = style && style.fill === "#ffffff" ? "white" : "black";
  const stroke = style && style.stroke === "#000000" ? "black" : "white";
  return { fill, stroke };
}

async function makeCaptionImages(entries, workDir, width, captionStyle) {
  const jsonPath = path.join(workDir, "captions.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ width, entries, captionStyle }), "utf8");
  const output = await run(PYTHON, [path.join(ROOT, "render_captions.py"), jsonPath, workDir]);
  return JSON.parse(output);
}

function streamVideo(req, res, videoPath) {
  if (!videoPath || !fs.existsSync(videoPath)) return send(res, 404, "Video not found", "text/plain; charset=utf-8");
  const stat = fs.statSync(videoPath);
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, { "Content-Length": stat.size, "Content-Type": "video/mp4" });
    fs.createReadStream(videoPath).pipe(res);
    return;
  }
  const [startText, endText] = range.replace(/bytes=/, "").split("-");
  const start = Number(startText);
  const end = endText ? Number(endText) : stat.size - 1;
  res.writeHead(206, {
    "Content-Range": `bytes ${start}-${end}/${stat.size}`,
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Content-Type": "video/mp4"
  });
  fs.createReadStream(videoPath, { start, end }).pipe(res);
}

async function pickVideo(res) {
  if (process.platform !== "darwin") {
    return send(res, 400, { error: "Docker/Linux에서는 영상 경로를 직접 입력하세요. 예: /videos/input.mp4" });
  }
  const script = [
    'POSIX path of (choose file with prompt "자막을 입힐 영상을 선택하세요" of type {"public.movie", "mp4", "mov", "m4v"})'
  ];
  const selected = (await run("osascript", ["-e", script.join("\n")])).trim();
  send(res, 200, { path: selected });
}

async function uploadVideo(req, res) {
  const buffer = await readBuffer(req);
  if (!buffer.length) return send(res, 400, { error: "영상 파일이 비어 있습니다." });

  fs.mkdirSync(VIDEO_DIR, { recursive: true });

  const parsed = path.parse(safeVideoName(req.headers["x-file-name"]));
  const outputPath = path.join(VIDEO_DIR, `${parsed.name}-${Date.now()}${parsed.ext.toLowerCase()}`);
  fs.writeFileSync(outputPath, buffer);
  send(res, 200, { path: outputPath });
}

async function render(req, res) {
  const { videoPath, outputName, srt, captionStyle } = await readJson(req);
  if (!videoPath || !fs.existsSync(videoPath)) return send(res, 400, { error: "영상 경로를 찾을 수 없습니다." });
  if (!srt || !srt.trim()) return send(res, 400, { error: "자막 내용이 비어 있습니다." });

  const dir = path.dirname(videoPath);
  const outputPath = path.join(dir, safeOutputName(outputName));
  const baseName = path.parse(outputPath).name;
  const workDir = path.join(dir, `.${baseName}-captions`);
  fs.mkdirSync(workDir, { recursive: true });
  const srtPath = path.join(workDir, `${baseName}.srt`);
  fs.writeFileSync(srtPath, srt.trim() + "\n", "utf8");

  const entries = parseSrt(srt);
  const width = await getVideoWidth(videoPath);
  const images = await makeCaptionImages(entries, workDir, width, normalizeCaptionStyle(captionStyle));
  const args = ["-y", "-i", videoPath];
  images.forEach(image => args.push("-loop", "1", "-i", image.path));

  let input = "[0:v]";
  const filters = images.map((image, index) => {
    const caption = `[cap${index}]`;
    const output = index === images.length - 1 ? "[vout]" : `[v${index + 1}]`;
    const fadeOutStart = Math.max(image.start, image.end - 0.12);
    const enable = `between(t\\,${image.start}\\,${image.end})`;
    const filter = [
      `[${index + 1}:v]format=rgba,fade=t=in:st=${image.start}:d=0.12:alpha=1,fade=t=out:st=${fadeOutStart}:d=0.12:alpha=1${caption}`,
      `${input}${caption}overlay=x=0:y=H-h-32:shortest=1:enable='${enable}'${output}`
    ].join(";");
    input = output;
    return filter;
  }).join(";");

  args.push(
    "-filter_complex", filters,
    "-map", "[vout]",
    "-map", "0:a?",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-shortest",
    "-movflags", "+faststart",
    outputPath
  );
  try {
    const log = await run("ffmpeg", args);
    send(res, 200, { outputPath, srtPath, log: log.slice(-4000) });
  } catch (error) {
    send(res, 500, { error: error.message.slice(-4000) });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/") {
      return send(res, 200, fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), "text/html; charset=utf-8");
    }
    if (req.method === "GET" && url.pathname === "/video") return streamVideo(req, res, url.searchParams.get("path"));
    if (req.method === "POST" && url.pathname === "/pick-video") return await pickVideo(res);
    if (req.method === "POST" && url.pathname === "/upload-video") return await uploadVideo(req, res);
    if (req.method === "POST" && url.pathname === "/render") return await render(req, res);
    send(res, 404, { error: "Not found" });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}`);
});
