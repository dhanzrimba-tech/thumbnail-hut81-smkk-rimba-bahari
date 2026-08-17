import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { removeBackground } from "@imgly/background-removal";
import {
  Camera,
  Download,
  ImagePlus,
  Scissors,
  Sparkles,
  UserRound,
  ShieldCheck,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import "./style.css";

const DESIGN_W = 1672;
const DESIGN_H = 941;
const DESIGN_URL = "/design.png?v=20260817-04";
const PHOTO = { x: 20, y: 260, w: 500, h: 520 };

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const ALPHA_CUTOFF = 28;

function cleanTransparentHaze(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Background-removal models can leave very faint alpha pixels over a
  // rectangular area. Those pixels are invisible on white, but can look like
  // a translucent frame when composited over the dark-green thumbnail.
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] <= ALPHA_CUTOFF) {
      data[i - 3] = 0;
      data[i - 2] = 0;
      data[i - 1] = 0;
      data[i] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function alphaBounds(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_CUTOFF) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

async function makeThumbnail(file) {
  const sourceUrl = URL.createObjectURL(file);
  let cutoutUrl = "";

  try {
    const cutoutBlob = await removeBackground(sourceUrl, {
      output: { format: "image/png", type: "foreground" },
    });

    cutoutUrl = URL.createObjectURL(cutoutBlob);

    const [design, cutout] = await Promise.all([
      loadImage(DESIGN_URL),
      loadImage(cutoutUrl),
    ]);

    const work = document.createElement("canvas");
    work.width = cutout.naturalWidth || cutout.width;
    work.height = cutout.naturalHeight || cutout.height;

    const wctx = work.getContext("2d");
    wctx.drawImage(cutout, 0, 0);
    cleanTransparentHaze(work);

    const bounds = alphaBounds(work) || {
      minX: 0,
      minY: 0,
      maxX: work.width - 1,
      maxY: work.height - 1,
    };

    const bw = bounds.maxX - bounds.minX + 1;
    const bh = bounds.maxY - bounds.minY + 1;

    const targetW = PHOTO.w * 0.88;
    const targetH = PHOTO.h * 0.94;
    const scale = Math.min(targetW / bw, targetH / bh);

    const drawW = bw * scale;
    const drawH = bh * scale;

    const dx =
      PHOTO.x +
      (PHOTO.w - drawW) / 2 -
      bounds.minX * scale;

    const dy =
      PHOTO.y +
      PHOTO.h -
      drawH -
      10 -
      bounds.minY * scale;

    const out = document.createElement("canvas");
    out.width = DESIGN_W;
    out.height = DESIGN_H;

    const ctx = out.getContext("2d");
    ctx.drawImage(design, 0, 0, DESIGN_W, DESIGN_H);

    // IMPORTANT: do not redraw the old placeholder area here.
    // The current /public/design.png is the source of truth, so the
    // newest forest/tree artwork remains visible exactly as designed.

    // Person cutout only. Do not draw any rectangular overlay, vignette,
    // dashed frame, or translucent placeholder on top of the uploaded photo.
    // A silhouette shadow is safe because it follows the cutout alpha only.
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.shadowColor = "rgba(0,0,0,.38)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 8;
    ctx.drawImage(
      work,
      0,
      0,
      work.width,
      work.height,
      dx,
      dy,
      work.width * scale,
      work.height * scale
    );
    ctx.restore();

    return out.toDataURL("image/png", 1);
  } finally {
    URL.revokeObjectURL(sourceUrl);
    if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
  }
}

function App() {
  const [preview, setPreview] = useState(DESIGN_URL);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Pilih foto selfie atau ambil foto dari galeri."
  );
  const [error, setError] = useState("");

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  useEffect(() => {
    document.title = "Thumbnail HUT ke-81 — SMK Kehutanan Rimba Bahari";
  }, []);

  async function processFile(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("File yang dipilih harus berupa gambar.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage(
      "Sedang memotong foto dan menghapus background di perangkat Anda..."
    );

    try {
      const result = await makeThumbnail(file);
      setPreview(result);
      setMessage(
        "Berhasil! Foto sudah menyatu dengan desain. Silakan download."
      );
    } catch (err) {
      console.error("Thumbnail error:", err);
      setError(
        "Gagal memproses foto. Coba foto lain dengan wajah dan badan bagian atas terlihat jelas."
      );
      setMessage("");
    } finally {
      setBusy(false);

      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  function handleCamera(e) {
    processFile(e.target.files?.[0]);
  }

  function handleGallery(e) {
    processFile(e.target.files?.[0]);
  }

  function download() {
    if (preview === DESIGN_URL || busy) return;

    const a = document.createElement("a");
    a.href = preview;
    a.download =
      "Thumbnail-HUT-ke-81-SMK-Kehutanan-Rimba-Bahari.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <main className="page">
      <section className="app">
        <div className="intro">
          <div className="brand">
            <span className="flag">🇮🇩</span>
            <div>
              <h1>Thumbnail HUT ke-81</h1>
              <p className="school">
                SMK Kehutanan Rimba Bahari Sumedang
              </p>
            </div>
          </div>

          <p className="desc">
            Buat thumbnail pribadi untuk guru dan siswa. Pilih foto
            selfie atau foto dari galeri. Sistem otomatis memotong foto,
            menghapus background, lalu menempatkannya pada desain
            kehutanan.
          </p>

          <div className="action-grid">
            <button
              className="primary"
              onClick={() => cameraRef.current?.click()}
              disabled={busy}
              type="button"
            >
              {busy ? <Loader2 className="spin" /> : <Camera />}
              {busy ? "SEDANG MEMPROSES..." : "AMBIL FOTO SELFIE"}
            </button>

            <button
              className="primary"
              onClick={() => galleryRef.current?.click()}
              disabled={busy}
              type="button"
            >
              {busy ? <Loader2 className="spin" /> : <ImagePlus />}
              PILIH DARI GALERI
            </button>
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleCamera}
            hidden
          />

          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            onChange={handleGallery}
            hidden
          />

          <button
            className="download"
            onClick={download}
            disabled={preview === DESIGN_URL || busy}
            type="button"
          >
            <Download />
            DOWNLOAD THUMBNAIL
          </button>

          <div className="privacy">
            <ShieldCheck />
            <span>
              Foto diproses langsung di browser. Foto tidak dikirim
              ke server aplikasi.
            </span>
          </div>

          <div className="tips">
            <h3>Tips Foto Terbaik</h3>
            <p>
              <CheckCircle2 /> Gunakan foto dengan wajah dan badan bagian
              atas terlihat
            </p>
            <p>
              <CheckCircle2 /> Cahaya cukup dan wajah tidak tertutup
            </p>
            <p>
              <CheckCircle2 /> Kamera fokus dan foto tidak terlalu jauh
            </p>
            <p>
              <CheckCircle2 /> Hindari background yang terlalu ramai
            </p>
          </div>

          {error && <div className="error">❌ {error}</div>}
          {message && !error && (
            <div className="status">{message}</div>
          )}
        </div>

        <div className="preview">
          <div className="preview-head">
            <h2>Preview Thumbnail</h2>
            <span>{busy ? "Memproses..." : "Siap digunakan"}</span>
          </div>

          <div className="canvas-wrap">
            <img
              src={preview}
              alt="Preview thumbnail HUT ke-81"
            />
          </div>
        </div>
      </section>

      <section className="steps">
        {[
          [ImagePlus, "Pilih Foto", "Pilih foto selfie atau galeri"],
          [Scissors, "Otomatis Crop", "Sistem menyesuaikan posisi foto"],
          [Sparkles, "Hapus Background", "Background dihapus otomatis"],
          [UserRound, "Masukkan Desain", "Foto ditempatkan pada desain kehutanan"],
          [Download, "Download", "Thumbnail siap dibagikan"],
        ].map(([Icon, title, text], i) => (
          <div className="step" key={title}>
            <div className="num">{i + 1}</div>
            <div className="step-icon">
              <Icon />
            </div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </section>

      <footer>© 2026 SMK Kehutanan Rimba Bahari Sumedang</footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
