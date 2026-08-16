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
  Loader2
} from "lucide-react";
import "./style.css";

const DESIGN_W = 1672;
const DESIGN_H = 941;
const PHOTO = { x: 20, y: 260, w: 500, h: 520 };

// Batasi ukuran foto sebelum background removal.
// Ini penting untuk HP agar RAM dan CPU tidak penuh.
const MAX_SOURCE_SIZE = 1280;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Mengecilkan foto terlebih dahulu supaya proses AI lebih ringan di HP.
async function preparePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;

    const scale = Math.min(1, MAX_SOURCE_SIZE / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(img, 0, 0, w, h);

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error("Gagal menyiapkan foto")),
        "image/jpeg",
        0.88
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function alphaBounds(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  // Sampling setiap 2 pixel agar pencarian foreground lebih ringan.
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] > 18) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;

  return { minX, minY, maxX, maxY };
}

async function makeThumbnail(file, setProgress) {
  const preparedBlob = await preparePhoto(file);
  const sourceUrl = URL.createObjectURL(preparedBlob);

  try {
    setProgress("Memuat mesin penghapus background...");

    const cutoutBlob = await removeBackground(sourceUrl, {
      output: {
        format: "image/png",
        type: "foreground"
      }
    });

    setProgress("Menyusun foto ke desain...");

    const cutoutUrl = URL.createObjectURL(cutoutBlob);

    try {
      const [design, cutout] = await Promise.all([
        loadImage("/design.png"),
        loadImage(cutoutUrl)
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
        maxY: work.height - 1
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

      // Desain utama
      ctx.drawImage(design, 0, 0, DESIGN_W, DESIGN_H);

      // Panel foto dengan background hutan dari desain.
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(24, 305);
      ctx.quadraticCurveTo(120, 250, 260, 270);
      ctx.quadraticCurveTo(440, 245, 505, 330);
      ctx.lineTo(500, 755);
      ctx.quadraticCurveTo(350, 805, 170, 795);
      ctx.quadraticCurveTo(60, 785, 24, 730);
      ctx.closePath();
      ctx.clip();

      ctx.globalAlpha = 0.98;
      ctx.drawImage(
        design,
        0,
        0,
        600,
        420,
        0,
        250,
        520,
        520
      );

      const grad = ctx.createLinearGradient(0, 250, 520, 780);
      grad.addColorStop(0, "rgba(4,35,20,0.08)");
      grad.addColorStop(0.72, "rgba(2,27,15,0.34)");
      grad.addColorStop(1, "rgba(2,18,10,0.62)");

      ctx.fillStyle = grad;
      ctx.fillRect(0, 250, 520, 540);
      ctx.restore();

      // Halo hutan di belakang orang.
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.45)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "rgba(13,64,39,.38)";
      ctx.beginPath();
      ctx.ellipse(260, 540, 205, 235, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Foto orang tanpa background.
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

      // Aksen bingkai.
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 5;
      ctx.setLineDash([18, 10]);
      ctx.beginPath();
      ctx.moveTo(28, 312);
      ctx.quadraticCurveTo(245, 250, 500, 315);
      ctx.stroke();
      ctx.restore();

      // Vignette ringan.
      const vignette = ctx.createRadialGradient(
        260,
        520,
        120,
        260,
        520,
        330
      );

      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,20,10,.32)");

      ctx.fillStyle = vignette;
      ctx.fillRect(20, 260, 500, 520);

      return out.toDataURL("image/png", 1);
    } finally {
      URL.revokeObjectURL(cutoutUrl);
    }
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function App() {
  const [preview, setPreview] = useState("/design.png");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Pilih foto selfie atau foto dari galeri."
  );
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  useEffect(() => {
    document.title =
      "Thumbnail HUT ke-81 — SMK Kehutanan Rimba Bahari";
  }, []);

  async function handleFile(e, source) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      setMessage("");
      e.target.value = "";
      return;
    }

    setBusy(true);
    setError("");
    setProgress("Menyiapkan foto...");
    setMessage(
      source === "galeri"
        ? "Foto galeri sedang diproses..."
        : "Foto selfie sedang diproses..."
    );

    // Beri browser kesempatan menggambar status loading sebelum AI bekerja.
    await new Promise(resolve => setTimeout(resolve, 80));

    try {
      const result = await makeThumbnail(file, setProgress);

      setPreview(result);
      setProgress("");
      setMessage(
        source === "galeri"
          ? "Berhasil! Foto dari galeri sudah masuk ke desain."
          : "Berhasil! Foto selfie sudah masuk ke desain."
      );
    } catch (err) {
      console.error(err);
      setProgress("");
      setError(
        "Proses foto gagal atau perangkat kehabisan memori. Coba foto yang lebih kecil."
      );
      setMessage("");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
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
            Buat thumbnail pribadi untuk guru dan siswa. Pilih
            foto selfie atau foto dari galeri. Sistem otomatis
            menghapus background dan menempatkan foto pada desain
            kehutanan.
          </p>

          <div className="photo-actions">
            <button
              className="primary"
              onClick={() => cameraInputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <Loader2 className="spin" /> : <Camera />}
              {busy
                ? "SEDANG MEMPROSES..."
                : "AMBIL FOTO SELFIE"}
            </button>

            <button
              className="gallery"
              onClick={() => galleryInputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <Loader2 className="spin" /> : <ImagePlus />}
              PILIH DARI GALERI
            </button>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={e => handleFile(e, "selfie")}
            hidden
          />

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={e => handleFile(e, "galeri")}
            hidden
          />

          <button
            className="download"
            onClick={download}
            disabled={preview === "/design.png" || busy}
          >
            <Download />
            DOWNLOAD THUMBNAIL
          </button>

          {busy && (
            <div className="processing">
              <Loader2 className="spin" />
              <div>
                <strong>Mohon tunggu...</strong>
                <span>
                  {progress ||
                    "Sedang memproses foto di perangkat."}
                </span>
                <small>
                  Foto besar otomatis diperkecil agar HP tidak
                  terlalu berat.
                </small>
              </div>
            </div>
          )}

          <div className="privacy">
            <ShieldCheck />
            <span>
              Foto diproses langsung di browser. Foto tidak
              dikirim ke server aplikasi.
            </span>
          </div>

          <div className="tips">
            <h3>Tips Foto Terbaik</h3>
            <p>
              <CheckCircle2 /> Wajah dan badan bagian atas terlihat
            </p>
            <p>
              <CheckCircle2 /> Cahaya cukup dan wajah tidak tertutup
            </p>
            <p>
              <CheckCircle2 /> Gunakan foto yang tidak terlalu besar
            </p>
            <p>
              <CheckCircle2 /> Background ramai tetap bisa diproses
            </p>
          </div>

          {error && <div className="error">❌ {error}</div>}
          {message && !error && !busy && (
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
          [
            Camera,
            "Selfie",
            "Ambil foto langsung menggunakan kamera"
          ],
          [
            ImagePlus,
            "Galeri",
            "Pilih foto yang sudah tersimpan"
          ],
          [
            Scissors,
            "Optimasi Foto",
            "Foto otomatis diperkecil agar ringan"
          ],
          [
            Sparkles,
            "Hapus Background",
            "Background dihapus otomatis"
          ],
          [
            UserRound,
            "Masukkan Desain",
            "Foto ditempatkan pada desain kehutanan"
          ],
          [
            Download,
            "Download",
            "Thumbnail siap dibagikan"
          ]
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

      <footer>
        © 2026 SMK Kehutanan Rimba Bahari Sumedang
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
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
  Loader2
} from "lucide-react";
import "./style.css";

const DESIGN_W = 1672;
const DESIGN_H = 941;
const PHOTO = { x: 20, y: 260, w: 500, h: 520 };

// Batasi ukuran foto sebelum background removal.
// Ini penting untuk HP agar RAM dan CPU tidak penuh.
const MAX_SOURCE_SIZE = 1280;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Mengecilkan foto terlebih dahulu supaya proses AI lebih ringan di HP.
async function preparePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;

    const scale = Math.min(1, MAX_SOURCE_SIZE / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(img, 0, 0, w, h);

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error("Gagal menyiapkan foto")),
        "image/jpeg",
        0.88
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function alphaBounds(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  // Sampling setiap 2 pixel agar pencarian foreground lebih ringan.
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] > 18) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;

  return { minX, minY, maxX, maxY };
}

async function makeThumbnail(file, setProgress) {
  const preparedBlob = await preparePhoto(file);
  const sourceUrl = URL.createObjectURL(preparedBlob);

  try {
    setProgress("Memuat mesin penghapus background...");

    const cutoutBlob = await removeBackground(sourceUrl, {
      output: {
        format: "image/png",
        type: "foreground"
      }
    });

    setProgress("Menyusun foto ke desain...");

    const cutoutUrl = URL.createObjectURL(cutoutBlob);

    try {
      const [design, cutout] = await Promise.all([
        loadImage("/design.png"),
        loadImage(cutoutUrl)
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
        maxY: work.height - 1
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

      // Desain utama
      ctx.drawImage(design, 0, 0, DESIGN_W, DESIGN_H);

      // Panel foto dengan background hutan dari desain.
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(24, 305);
      ctx.quadraticCurveTo(120, 250, 260, 270);
      ctx.quadraticCurveTo(440, 245, 505, 330);
      ctx.lineTo(500, 755);
      ctx.quadraticCurveTo(350, 805, 170, 795);
      ctx.quadraticCurveTo(60, 785, 24, 730);
      ctx.closePath();
      ctx.clip();

      ctx.globalAlpha = 0.98;
      ctx.drawImage(
        design,
        0,
        0,
        600,
        420,
        0,
        250,
        520,
        520
      );

      const grad = ctx.createLinearGradient(0, 250, 520, 780);
      grad.addColorStop(0, "rgba(4,35,20,0.08)");
      grad.addColorStop(0.72, "rgba(2,27,15,0.34)");
      grad.addColorStop(1, "rgba(2,18,10,0.62)");

      ctx.fillStyle = grad;
      ctx.fillRect(0, 250, 520, 540);
      ctx.restore();

      // Halo hutan di belakang orang.
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,.45)";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "rgba(13,64,39,.38)";
      ctx.beginPath();
      ctx.ellipse(260, 540, 205, 235, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Foto orang tanpa background.
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

      // Aksen bingkai.
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 5;
      ctx.setLineDash([18, 10]);
      ctx.beginPath();
      ctx.moveTo(28, 312);
      ctx.quadraticCurveTo(245, 250, 500, 315);
      ctx.stroke();
      ctx.restore();

      // Vignette ringan.
      const vignette = ctx.createRadialGradient(
        260,
        520,
        120,
        260,
        520,
        330
      );

      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,20,10,.32)");

      ctx.fillStyle = vignette;
      ctx.fillRect(20, 260, 500, 520);

      return out.toDataURL("image/png", 1);
    } finally {
      URL.revokeObjectURL(cutoutUrl);
    }
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function App() {
  const [preview, setPreview] = useState("/design.png");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Pilih foto selfie atau foto dari galeri."
  );
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  useEffect(() => {
    document.title =
      "Thumbnail HUT ke-81 — SMK Kehutanan Rimba Bahari";
  }, []);

  async function handleFile(e, source) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      setMessage("");
      e.target.value = "";
      return;
    }

    setBusy(true);
    setError("");
    setProgress("Menyiapkan foto...");
    setMessage(
      source === "galeri"
        ? "Foto galeri sedang diproses..."
        : "Foto selfie sedang diproses..."
    );

    // Beri browser kesempatan menggambar status loading sebelum AI bekerja.
    await new Promise(resolve => setTimeout(resolve, 80));

    try {
      const result = await makeThumbnail(file, setProgress);

      setPreview(result);
      setProgress("");
      setMessage(
        source === "galeri"
          ? "Berhasil! Foto dari galeri sudah masuk ke desain."
          : "Berhasil! Foto selfie sudah masuk ke desain."
      );
    } catch (err) {
      console.error(err);
      setProgress("");
      setError(
        "Proses foto gagal atau perangkat kehabisan memori. Coba foto yang lebih kecil."
      );
      setMessage("");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
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
            Buat thumbnail pribadi untuk guru dan siswa. Pilih
            foto selfie atau foto dari galeri. Sistem otomatis
            menghapus background dan menempatkan foto pada desain
            kehutanan.
          </p>

          <div className="photo-actions">
            <button
              className="primary"
              onClick={() => cameraInputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <Loader2 className="spin" /> : <Camera />}
              {busy
                ? "SEDANG MEMPROSES..."
                : "AMBIL FOTO SELFIE"}
            </button>

            <button
              className="gallery"
              onClick={() => galleryInputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <Loader2 className="spin" /> : <ImagePlus />}
              PILIH DARI GALERI
            </button>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={e => handleFile(e, "selfie")}
            hidden
          />

          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={e => handleFile(e, "galeri")}
            hidden
          />

          <button
            className="download"
            onClick={download}
            disabled={preview === "/design.png" || busy}
          >
            <Download />
            DOWNLOAD THUMBNAIL
          </button>

          {busy && (
            <div className="processing">
              <Loader2 className="spin" />
              <div>
                <strong>Mohon tunggu...</strong>
                <span>
                  {progress ||
                    "Sedang memproses foto di perangkat."}
                </span>
                <small>
                  Foto besar otomatis diperkecil agar HP tidak
                  terlalu berat.
                </small>
              </div>
            </div>
          )}

          <div className="privacy">
            <ShieldCheck />
            <span>
              Foto diproses langsung di browser. Foto tidak
              dikirim ke server aplikasi.
            </span>
          </div>

          <div className="tips">
            <h3>Tips Foto Terbaik</h3>
            <p>
              <CheckCircle2 /> Wajah dan badan bagian atas terlihat
            </p>
            <p>
              <CheckCircle2 /> Cahaya cukup dan wajah tidak tertutup
            </p>
            <p>
              <CheckCircle2 /> Gunakan foto yang tidak terlalu besar
            </p>
            <p>
              <CheckCircle2 /> Background ramai tetap bisa diproses
            </p>
          </div>

          {error && <div className="error">❌ {error}</div>}
          {message && !error && !busy && (
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
          [
            Camera,
            "Selfie",
            "Ambil foto langsung menggunakan kamera"
          ],
          [
            ImagePlus,
            "Galeri",
            "Pilih foto yang sudah tersimpan"
          ],
          [
            Scissors,
            "Optimasi Foto",
            "Foto otomatis diperkecil agar ringan"
          ],
          [
            Sparkles,
            "Hapus Background",
            "Background dihapus otomatis"
          ],
          [
            UserRound,
            "Masukkan Desain",
            "Foto ditempatkan pada desain kehutanan"
          ],
          [
            Download,
            "Download",
            "Thumbnail siap dibagikan"
          ]
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

      <footer>
        © 2026 SMK Kehutanan Rimba Bahari Sumedang
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
// MAIN.JSX UPDATE — Thumbnail HUT ke-81
// Fitur baru: AMBIL FOTO SELFIE + PILIH DARI GALERI.
// Tempel seluruh isi file ini menggantikan src/main.jsx.

import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { removeBackground } from "@imgly/background-removal";
import {
  Camera, Download, ImagePlus, Scissors, Sparkles, UserRound,
  ShieldCheck, CheckCircle2, Loader2
} from "lucide-react";
import "./style.css";

const DESIGN_W = 1672;
const DESIGN_H = 941;
const PHOTO = { x: 20, y: 260, w: 500, h: 520 };

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
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 18) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

async function makeThumbnail(file) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const cutoutBlob = await removeBackground(sourceUrl, {
      output: { format: "image/png", type: "foreground" }
    });
    const cutoutUrl = URL.createObjectURL(cutoutBlob);

    const [design, cutout] = await Promise.all([
      loadImage("/design.png"),
      loadImage(cutoutUrl)
    ]);

    const work = document.createElement("canvas");
    work.width = cutout.naturalWidth || cutout.width;
    work.height = cutout.naturalHeight || cutout.height;
    const wctx = work.getContext("2d");
    wctx.drawImage(cutout, 0, 0);

    const bounds = alphaBounds(work) || {
      minX: 0, minY: 0, maxX: work.width - 1, maxY: work.height - 1
    };
    const bw = bounds.maxX - bounds.minX + 1;
    const bh = bounds.maxY - bounds.minY + 1;

    const targetW = PHOTO.w * 0.88;
    const targetH = PHOTO.h * 0.94;
    const scale = Math.min(targetW / bw, targetH / bh);
    const drawW = bw * scale;
    const drawH = bh * scale;
    const dx = PHOTO.x + (PHOTO.w - drawW) / 2 - bounds.minX * scale;
    const dy = PHOTO.y + PHOTO.h - drawH - 10 - bounds.minY * scale;

    const out = document.createElement("canvas");
    out.width = DESIGN_W;
    out.height = DESIGN_H;
    const ctx = out.getContext("2d");

    ctx.drawImage(design, 0, 0, DESIGN_W, DESIGN_H);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(24, 305);
    ctx.quadraticCurveTo(120, 250, 260, 270);
    ctx.quadraticCurveTo(440, 245, 505, 330);
    ctx.lineTo(500, 755);
    ctx.quadraticCurveTo(350, 805, 170, 795);
    ctx.quadraticCurveTo(60, 785, 24, 730);
    ctx.closePath();
    ctx.clip();

    ctx.globalAlpha = 0.98;
    ctx.drawImage(design, 0, 0, 600, 420, 0, 250, 520, 520);

    const grad = ctx.createLinearGradient(0, 250, 520, 780);
    grad.addColorStop(0, "rgba(4,35,20,0.08)");
    grad.addColorStop(0.72, "rgba(2,27,15,0.34)");
    grad.addColorStop(1, "rgba(2,18,10,0.62)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 250, 520, 540);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "rgba(13,64,39,.38)";
    ctx.beginPath();
    ctx.ellipse(260, 540, 205, 235, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      work, 0, 0, work.width, work.height,
      dx, dy, work.width * scale, work.height * scale
    );
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.lineWidth = 5;
    ctx.setLineDash([18, 10]);
    ctx.beginPath();
    ctx.moveTo(28, 312);
    ctx.quadraticCurveTo(245, 250, 500, 315);
    ctx.stroke();
    ctx.restore();

    const vignette = ctx.createRadialGradient(260, 520, 120, 260, 520, 330);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,20,10,.32)");
    ctx.fillStyle = vignette;
    ctx.fillRect(20, 260, 500, 520);

    URL.revokeObjectURL(cutoutUrl);
    return out.toDataURL("image/png", 1);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function App() {
  const [preview, setPreview] = useState("/design.png");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Pilih foto selfie atau foto dari galeri dengan wajah dan badan bagian atas terlihat jelas."
  );
  const [error, setError] = useState("");

  // Dua input sengaja dipisahkan:
  // kamera memakai capture="user", sedangkan galeri TIDAK memakai capture.
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  useEffect(() => {
    document.title = "Thumbnail HUT ke-81 — SMK Kehutanan Rimba Bahari";
  }, []);

  async function handleFile(e, source = "foto") {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("File yang dipilih harus berupa gambar.");
      setMessage("");
      e.target.value = "";
      return;
    }

    setBusy(true);
    setError("");
    setMessage(
      source === "galeri"
        ? "Foto dari galeri sedang diproses. Background akan dihapus otomatis..."
        : "Foto selfie sedang diproses. Background akan dihapus otomatis..."
    );

    try {
      const result = await makeThumbnail(file);
      setPreview(result);
      setMessage(
        source === "galeri"
          ? "Berhasil! Foto dari galeri sudah menyatu dengan desain. Silakan download."
          : "Berhasil! Foto selfie sudah menyatu dengan desain. Silakan download."
      );
    } catch (err) {
      console.error(err);
      setError(
        "Gagal memproses foto. Coba foto lain dengan wajah dan badan bagian atas terlihat jelas."
      );
      setMessage("");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function download() {
    if (preview === "/design.png") return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = "Thumbnail-HUT-ke-81-SMK-Kehutanan-Rimba-Bahari.png";
    a.click();
  }

  return (
    <main className="page">
      <section className="app">
        <div className="intro">
          <div className="brand">
            <span className="flag">🇮🇩</span>
            <div>
              <h1>Thumbnail HUT ke-81</h1>
              <p className="school">SMK Kehutanan Rimba Bahari Sumedang</p>
            </div>
          </div>

          <p className="desc">
            Buat thumbnail pribadi untuk guru dan siswa. Pilih foto selfie
            atau foto dari galeri. Sistem otomatis memotong foto, menghapus
            background, lalu menempatkannya pada desain kehutanan.
          </p>

          {/* DUA PILIHAN: KAMERA DAN GALERI */}
          <div className="photo-actions">
            <button
              className="primary"
              onClick={() => cameraInputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <Loader2 className="spin" /> : <Camera />}
              {busy ? "SEDANG MEMPROSES..." : "AMBIL FOTO SELFIE"}
            </button>

            <button
              className="gallery"
              onClick={() => galleryInputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <Loader2 className="spin" /> : <ImagePlus />}
              PILIH DARI GALERI
            </button>
          </div>

          {/* KAMERA: memprioritaskan kamera depan di HP */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={(e) => handleFile(e, "selfie")}
            hidden
          />

          {/* GALERI: tanpa capture agar foto tersimpan bisa dipilih */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFile(e, "galeri")}
            hidden
          />

          <button
            className="download"
            onClick={download}
            disabled={preview === "/design.png" || busy}
          >
            <Download />
            DOWNLOAD THUMBNAIL
          </button>

          <div className="privacy">
            <ShieldCheck />
            <span>
              Foto diproses langsung di browser. Foto tidak dikirim ke server aplikasi.
            </span>
          </div>

          <div className="tips">
            <h3>Tips Foto Terbaik</h3>
            <p><CheckCircle2 /> Gunakan foto dengan wajah dan badan bagian atas terlihat</p>
            <p><CheckCircle2 /> Cahaya cukup dan wajah tidak tertutup</p>
            <p><CheckCircle2 /> Kamera fokus dan foto tidak terlalu jauh</p>
            <p><CheckCircle2 /> Background yang ramai tetap dapat diproses otomatis</p>
          </div>

          {error && <div className="error">❌ {error}</div>}
          {message && !error && <div className="status">{message}</div>}
        </div>

        <div className="preview">
          <div className="preview-head">
            <h2>Preview Thumbnail</h2>
            <span>{busy ? "Memproses..." : "Siap digunakan"}</span>
          </div>
          <div className="canvas-wrap">
            <img src={preview} alt="Preview thumbnail HUT ke-81" />
          </div>
        </div>
      </section>

      <section className="steps">
        {[
          [Camera, "Selfie", "Ambil foto langsung menggunakan kamera perangkat"],
          [ImagePlus, "Galeri", "Pilih foto yang sudah tersimpan di perangkat"],
          [Scissors, "Otomatis Crop", "Sistem menyesuaikan posisi foto"],
          [Sparkles, "Hapus Background", "Background dihapus otomatis"],
          [UserRound, "Masukkan Desain", "Foto ditempatkan pada desain kehutanan"],
          [Download, "Download", "Thumbnail siap dibagikan"]
        ].map(([Icon, title, text], i) => (
          <div className="step" key={title}>
            <div className="num">{i + 1}</div>
            <div className="step-icon"><Icon /></div>
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
