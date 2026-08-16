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
const PHOTO = { x: -20, y: 205, w: 540, h: 600 };

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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
      if (data[(y * width + x) * 4 + 3] > 18) {
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
      loadImage("/design.png"),
      loadImage(cutoutUrl),
    ]);

    const work = document.createElement("canvas");
    work.width = cutout.naturalWidth || cutout.width;
    work.height = cutout.naturalHeight || cutout.height;

    const wctx = work.getContext("2d");
    wctx.drawImage(cutout, 0, 0);

    const bounds = alphaBounds(work) || {
      minX: 0,
      minY: 0,
      maxX: work.width - 1,
      maxY: work.height - 1,
    };

    const bw = bounds.maxX - bounds.minX + 1;
    const bh = bounds.maxY - bounds.minY + 1;

    // Make the person substantially larger, matching the approved
    // reference thumbnail: head near the upper-left forest area and
    // torso extending down toward the ribbon.
    const targetW = PHOTO.w * 1.02;
    const targetH = PHOTO.h * 1.02;
    const scale = Math.max(targetW / bw, targetH / bh);

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
      4 -
      bounds.minY * scale;

    const out = document.createElement("canvas");
    out.width = DESIGN_W;
    out.height = DESIGN_H;

    const ctx = out.getContext("2d");
    ctx.drawImage(design, 0, 0, DESIGN_W, DESIGN_H);

    // Rebuild the portrait area with clean forest/building sections from
    // the supplied design. IMPORTANT: do not copy the top-left of the
    // design because that area contains the school logo.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 265);
    ctx.quadraticCurveTo(90, 205, 260, 225);
    ctx.quadraticCurveTo(455, 205, 525, 285);
    ctx.lineTo(520, 790);
    ctx.quadraticCurveTo(370, 825, 170, 810);
    ctx.quadraticCurveTo(55, 800, 0, 745);
    ctx.closePath();
    ctx.clip();

    // Upper background: mountain/forest area, deliberately taken from
    // the middle of the design so the school logo never appears here.
    ctx.drawImage(
      design,
      500, 0, 520, 330,
      0, 205, 540, 350
    );

    // Lower background: school/trees area, again avoiding the logo.
    ctx.drawImage(
      design,
      500, 300, 520, 450,
      0, 555, 540, 255
    );

    // Blend the two sections so the portrait area looks like one natural
    // forest scene.
    const forestBlend = ctx.createLinearGradient(0, 210, 0, 810);
    forestBlend.addColorStop(0, "rgba(5,35,18,0.02)");
    forestBlend.addColorStop(0.55, "rgba(3,32,17,0.08)");
    forestBlend.addColorStop(1, "rgba(1,22,11,0.36)");
    ctx.fillStyle = forestBlend;
    ctx.fillRect(0, 205, 540, 605);

    ctx.restore();

    // Person cutout.
    ctx.save();
    ctx.imageSmoothingEnabled = true;
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

    // Keep the portrait area frameless: no white/grey box and no
    // dashed border. The supplied forest/building background should
    // continue naturally behind the person.

    return out.toDataURL("image/png", 1);
  } finally {
    URL.revokeObjectURL(sourceUrl);
    if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
  }
}

function App() {
  const [preview, setPreview] = useState("/design.png");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Pilih foto selfie atau foto dari galeri."
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
    if (preview === "/design.png" || busy) return;

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
            disabled={preview === "/design.png" || busy}
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
