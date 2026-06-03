const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const beforeCanvas = document.getElementById("beforeCanvas");
const beforeCtx = beforeCanvas.getContext("2d", { willReadFrequently: true });
const compareHandle = document.getElementById("compareHandle");
const canvasWrap = document.querySelector(".canvas-wrap");

const upload = document.getElementById("imageUpload");
const emptyState = document.getElementById("emptyState");
const statusText = document.getElementById("statusText");

const lossRange = document.getElementById("lossRange");
const tonerRange = document.getElementById("tonerRange");
const densityRange = document.getElementById("densityRange");
const dirtRange = document.getElementById("dirtRange");
const lineRange = document.getElementById("lineRange") || { value: 18, addEventListener: function(){} };
const skewRange = document.getElementById("skewRange");
const doubleRange = document.getElementById("doubleRange");
const edgeRange = document.getElementById("edgeRange");
const paperMode = document.getElementById("paperMode");
const borderMode = document.getElementById("borderMode");
const foldMode = document.getElementById("foldMode");
const foldIntensity = document.getElementById("foldIntensity");
const stampText = document.getElementById("stampText");
const stampStyle = document.getElementById("stampStyle");
const stampColor = document.getElementById("stampColor");
const stampOpacity = document.getElementById("stampOpacity");

// Preload a realistic crease texture. It is blended into fold modes so creases
// feel like physical paper instead of generated grey lines.  The user
// provided a new texture with more natural diagonal wrinkles, so load
// that version instead of the old one.  If the new file is not found
// the browser will fall back to the previous texture silently.
const creaseImg = new Image();
// Preload crease texture provided by the user.  This file contains
// natural-looking diagonal wrinkles and will be blended into fold
// effects.  If the file is missing the browser will silently skip it.
creaseImg.src = "crease_texture(1).png";

// Load a high-resolution paper overlay texture downloaded from
// Wikimedia Commons.  This texture adds realistic crinkles across the
// entire page.  The overlay will be drawn with low opacity and
// multiply blending, so the underlying artwork shows through.  See
// addPaperOverlay() below for details.
const paperOverlayImg = new Image();
paperOverlayImg.src = "paper_texture.jpg";

const randomizeBtn = document.getElementById("randomizeBtn");
const resetBtn = document.getElementById("resetBtn");
const downloadBtn = document.getElementById("downloadBtn");

let sourceImage = null;
let currentPreset = "firstgen";
let seed = Math.random() * 10000;
let compareX = 0.5;
let isComparing = false;

const presets = {
  firstgen: { loss: 18, toner: 22, density: 44, dirt: 22, lines: 8, skew: 2, double: 4, edge: 97 },
  fifthgen: { loss: 44, toner: 48, density: 56, dirt: 38, lines: 14, skew: 5, double: 12, edge: 98 },
  twentieth: { loss: 82, toner: 78, density: 74, dirt: 42, lines: 28, skew: -9, double: 22, edge: 100 },
  library: { loss: 32, toner: 30, density: 40, dirt: 52, lines: 10, skew: -12, double: 6, edge: 94 },
  office1998: { loss: 24, toner: 18, density: 34, dirt: 26, lines: 18, skew: 1, double: 5, edge: 95 },
  flyer1994: { loss: 68, toner: 70, density: 72, dirt: 62, lines: 18, skew: 10, double: 24, edge: 101 },
  artschool: { loss: 58, toner: 56, density: 54, dirt: 46, lines: 16, skew: -18, double: 35, edge: 102 },
  broken: { loss: 72, toner: 84, density: 82, dirt: 68, lines: 42, skew: 22, double: 30, edge: 100 },
  colourcopy: { loss: 46, toner: 58, density: 48, dirt: 45, lines: 14, skew: 3, double: 16, edge: 98 }
};

function getPaperAspect() {
  // When the user chooses "Fit to Image" and an image has been uploaded,
  // match the canvas aspect ratio to that of the source image.  This makes
  // the working page fit the uploaded artwork exactly instead of
  // defaulting to letter proportions.  Only fall back to preset paper
  // ratios when no image is loaded or the paperMode is a predefined size.
  if (paperMode.value === 'fitimage' && sourceImage) {
    return sourceImage.width / sourceImage.height;
  }

  const ratios = {
    letter: 8.5 / 11,
    a4: 210 / 297,
    tabloid: 11 / 17,
    square: 1,
    poster: 24 / 36,
    receipt: 3.2 / 8,
    zine: 5.5 / 8.5,
    flyer: 8.5 / 14
  };

  return ratios[paperMode.value] || ratios.letter;
}

function fitCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const aspect = getPaperAspect();
  const availableWidth = (canvasWrap.parentElement ? canvasWrap.parentElement.clientWidth : canvasWrap.clientWidth || 1000);
  const maxHeight = Math.max(320, window.innerHeight - 130);

  let width = availableWidth;
  let height = width / aspect;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }

  canvasWrap.style.width = `${Math.floor(width)}px`;
  canvasWrap.style.height = `${Math.floor(height)}px`;

  const rect = canvasWrap.getBoundingClientRect();

  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  beforeCanvas.width = canvas.width;
  beforeCanvas.height = canvas.height;
  beforeCtx.setTransform(ratio, 0, 0, ratio, 0, 0);

  updateCompareClip();
  render();
}

function W() {
  return canvas.width / (window.devicePixelRatio || 1);
}

function H() {
  return canvas.height / (window.devicePixelRatio || 1);
}

function loadImageFile(file) {
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = event => {
    const img = new Image();
    img.onload = () => {
      sourceImage = img;
      emptyState.style.display = "none";
      statusText.textContent = file.name;
      seed = Math.random() * 10000;
      // When a new image is loaded, resize the canvas to fit the selected
      // paper mode.  In particular, the "Fit to Image" mode uses the
      // intrinsic aspect ratio of the uploaded artwork to determine
      // canvas sizing.  Without calling fitCanvas() here the canvas
      // continues to use the previous ratio which is why Fit to Image
      // appeared to do nothing.  After resizing we redraw the page.
      fitCanvas();
      render();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function applyPreset(name) {
  currentPreset = name;
  const p = presets[name];

  lossRange.value = p.loss;
  tonerRange.value = p.toner;
  densityRange.value = p.density || 52;
  dirtRange.value = p.dirt;
  lineRange.value = p.lines || 18;
  skewRange.value = p.skew;
  doubleRange.value = p.double;
  edgeRange.value = p.edge;

  document.querySelectorAll(".preset").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.preset === name);
  });

  seed = Math.random() * 10000;
  render();
}

function getBorderPalette() {
  const palette = {
    dark: "#111111",
    light: "rgba(255,255,255,0.9)"
  };
  return palette;
}

function drawPlacedImage(targetCtx, w, h, edgeFill, skewAmount) {
  const imgRatio = sourceImage.width / sourceImage.height;
  const canvasRatio = w / h;

  let drawW;
  let drawH;

  if (imgRatio > canvasRatio) {
    drawH = h * edgeFill;
    drawW = drawH * imgRatio;
    if (drawW < w * edgeFill) {
      drawW = w * edgeFill;
      drawH = drawW / imgRatio;
    }
  } else {
    drawW = w * edgeFill;
    drawH = drawW / imgRatio;
    if (drawH < h * edgeFill) {
      drawH = h * edgeFill;
      drawW = drawH / imgRatio;
    }
  }

  targetCtx.save();
  targetCtx.translate(w / 2, h / 2);
  targetCtx.transform(1, 0, skewAmount, 1, 0, 0);
  targetCtx.drawImage(sourceImage, -drawW / 2, -drawH / 2, drawW, drawH);
  targetCtx.restore();
}

function render() {
  drawPaper();

  if (!sourceImage) {
    drawIdleTexture();
    return;
  }

  const w = W();
  const h = H();
  const edgeFill = Number(edgeRange.value) / 100;

  drawBeforeCanvas(edgeFill);

  const temp = document.createElement("canvas");
  temp.width = Math.floor(w);
  temp.height = Math.floor(h);
  const tctx = temp.getContext("2d", { willReadFrequently: true });

  tctx.fillStyle = "#fff";
  tctx.fillRect(0, 0, w, h);

  const skew = Number(skewRange.value) / 900;
  drawPlacedImage(tctx, w, h, edgeFill, skew);

  const processed = copyDegrade(temp);
  ctx.drawImage(processed, 0, 0, w, h);

  addDoubleExposure(processed);
  addTonerBloom();
  addSparseScannerDirt();
  addCopierGlassHair();
  addSubtleStreaks();
  addBookShadowIfNeeded();
  addCornerAndEdgeWear();
  addBorderStyle();
  // Fold creases and stamp overlays have been removed as per user request.
  addPaperTexture();
  // Overlay the high-resolution paper texture on top of everything.  This
  // comes after our procedural paper noise but before colour copy
  // artifacts so CMY contamination appears above the paper crinkles.
  // addPaperOverlay(); // Removed overlay; rely on procedural paper texture alone.
  addColourCopyArtifacts();
}

function copyDegrade(inputCanvas) {
  const w = inputCanvas.width;
  const h = inputCanvas.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d", { willReadFrequently: true });

  octx.drawImage(inputCanvas, 0, 0);

  const loss = Number(lossRange.value) / 100;
  const toner = Number(tonerRange.value) / 100;
  const density = Number(densityRange.value) / 100;

  let imageData = octx.getImageData(0, 0, w, h);
  let data = imageData.data;

  if (currentPreset === "colourcopy") {
    processColourCopy(imageData, loss, toner, density);
    octx.putImageData(imageData, 0, 0);

    const shifted = document.createElement("canvas");
    shifted.width = w;
    shifted.height = h;
    const sctx = shifted.getContext("2d");

    sctx.fillStyle = "#f7f1e5";
    sctx.fillRect(0, 0, w, h);

    // Subtle colour copier registration drift.
    sctx.globalCompositeOperation = "multiply";
    sctx.globalAlpha = 0.92;
    sctx.filter = `saturate(${95 + loss * 55}%) contrast(${102 + loss * 28}%) blur(${0.15 + loss * 0.45}px)`;
    sctx.drawImage(out, 0, 0);

    sctx.globalAlpha = 0.15 + toner * 0.16;
    sctx.filter = `blur(${0.4 + toner * 1.2}px)`;
    sctx.drawImage(out, 1.2 + loss * 2, -0.8, w, h);
    sctx.drawImage(out, -1.4, 1.1 + loss * 2, w, h);

    out.width = w;
    out.height = h;
    octx.drawImage(shifted, 0, 0);
    return out;
  }

  // First pass: grayscale, threshold, dirty whites, crushed blacks.
  for (let i = 0; i < data.length; i += 4) {
    const px = i / 4;
    const x = px % w;
    const y = Math.floor(px / w);

    let gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

    const paperNoise = (random(seed + x * 0.22 + y * 0.91) - 0.5) * (10 + loss * 44);
    const scannerBand = Math.sin(y * 0.022 + seed) * loss * 10;

    gray += paperNoise + scannerBand;

    const contrast = 1.15 + loss * 1.55;
    gray = ((gray - 128) * contrast) + 128;

    const threshold = 150 - loss * 42 + toner * 18 - density * 20;
    let v;

    if (gray < threshold) {
      v = 6 + random(seed + i) * 16 * (1 - loss) * (1 - density * 0.35);
      // Toner fill-in: dark areas thicken and lose detail.
      if (random(seed + i * 0.08) < toner * 0.11 + density * 0.08) v = 0;
    } else {
      v = 244 - loss * 28 - density * 12 + random(seed + i * 0.04) * loss * 22;
      // Dirty white background on later generations.
      if (random(seed + i * 0.13) < loss * 0.075) v -= 28 + random(seed + i * 0.4) * 42;
    }

    data[i] = clamp(v, 0, 255);
    data[i + 1] = clamp(v, 0, 255);
    data[i + 2] = clamp(v, 0, 255);
    data[i + 3] = 255;
  }

  octx.putImageData(imageData, 0, 0);

  // Repeated generation loss: blur, redraw, re-threshold.
  const generations = Math.floor(1 + loss * 5);
  for (let g = 0; g < generations; g++) {
    const copy = document.createElement("canvas");
    copy.width = w;
    copy.height = h;
    const cctx = copy.getContext("2d");

    cctx.fillStyle = "#f7f1e5";
    cctx.fillRect(0, 0, w, h);
    cctx.globalAlpha = 0.96;
    cctx.filter = `blur(${0.18 + loss * 0.85}px) contrast(${105 + loss * 45}%)`;
    cctx.drawImage(out, (random(seed + g) - 0.5) * loss * 5, (random(seed + g * 3) - 0.5) * loss * 5);

    out.width = w;
    out.height = h;
    octx.drawImage(copy, 0, 0);
  }

  return out;
}

function processColourCopy(imageData, loss, toner, density) {
  const data = imageData.data;
  const w = imageData.width;

  for (let i = 0; i < data.length; i += 4) {
    const px = i / 4;
    const x = px % w;
    const y = Math.floor(px / w);

    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    const gray = r * 0.299 + g * 0.587 + b * 0.114;

    // Dirtier colour-copy behaviour:
    // saturation gets pushed, colour balance warms, shadows clog, whites get contaminated.
    const sat = 1.18 + loss * 1.05 + density * 0.12;
    r = gray + (r - gray) * sat;
    g = gray + (g - gray) * sat;
    b = gray + (b - gray) * sat;

    const paperNoise = (random(seed + x * 0.31 + y * 0.73) - 0.5) * (16 + loss * 52);
    const horizontalBand = Math.sin(y * 0.026 + seed) * loss * 10;
    const colourCast = Math.sin(y * 0.011 + seed * 0.2) * loss * 14;

    r += paperNoise + horizontalBand + colourCast + 4;
    g += paperNoise * 0.82 + horizontalBand - colourCast * 0.15;
    b += paperNoise * 0.62 + horizontalBand - colourCast - 8;

    const contrast = 1.10 + loss * 0.95 + density * 0.20;
    r = ((r - 128) * contrast) + 128;
    g = ((g - 128) * contrast) + 128;
    b = ((b - 128) * contrast) + 128;

    // Toner dropout and speckling.
    if (random(seed + i * 0.17) < loss * 0.085) {
      const drop = 28 + random(seed + i * 0.81) * 70;
      r -= drop;
      g -= drop;
      b -= drop;
    }

    // Random colour toner flecks.
    if (random(seed + i * 0.21) < toner * 0.035) {
      const channel = Math.floor(random(seed + i * 0.99) * 3);
      if (channel === 0) r += 70;
      if (channel === 1) g += 45;
      if (channel === 2) b += 70;
    }

    // Dirty, warm paper whites.
    if (gray > 205) {
      r = r - loss * 20 + 12;
      g = g - loss * 28 + 2;
      b = b - loss * 42 - 10;
    }

    // Toner spread in dark coloured areas.
    if (gray < 110 && random(seed + i * 0.13) < toner * 0.11 + density * 0.07) {
      const crush = 0.62 - density * 0.12;
      r *= crush;
      g *= crush;
      b *= crush;
    }

    data[i] = clamp(r, 0, 255);
    data[i + 1] = clamp(g, 0, 255);
    data[i + 2] = clamp(b, 0, 255);
    data[i + 3] = 255;
  }
}

function addDoubleExposure(processed) {
  const amount = Number(doubleRange.value) / 100;
  if (amount <= 0.02) return;

  const w = W();
  const h = H();

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = amount * 0.38;

  const dx = (random(seed + 1200) - 0.5) * 14 * amount;
  const dy = (random(seed + 2300) - 0.5) * 14 * amount;

  ctx.drawImage(processed, dx, dy, w, h);
  ctx.restore();
}

function addTonerBloom() {
  const amount = Math.min(1, Number(tonerRange.value) / 100 + Number(densityRange.value) / 220);
  if (amount <= 0.02) return;

  const w = W();
  const h = H();

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = amount * 0.18;
  ctx.filter = `blur(${1.2 + amount * 2.6}px)`;
  ctx.drawImage(canvas, 0, 0, w, h);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = amount * 0.08;
  ctx.fillStyle = "#000";
  const specks = Math.floor(20 + amount * 140);
  for (let i = 0; i < specks; i++) {
    const x = random(seed + i * 91.5) * w;
    const y = random(seed + i * 31.7) * h;
    const r = 0.5 + random(seed + i * 61.9) * 2.5 * amount;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function addSparseScannerDirt() {
  const amount = Number(dirtRange.value) / 100;
  if (amount <= 0.01) return;

  const w = W();
  const h = H();
  const profile = getCleanlinessProfile();

  ctx.save();

  // V8: Scanner Dirt is visible again, but most of it is linear/organic:
  // fibres, hairs, edge grime, toner haze, and smears. Very few dots.
  const speckCount = Math.floor(profile.dustBase + amount * profile.dustScale);

  for (let i = 0; i < speckCount; i++) {
    const pos = edgeBiasedPosition(w, h, profile.edgeBias, i);
    const x = pos.x;
    const y = pos.y;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(random(seed + i * 30.1) * Math.PI);
    ctx.globalAlpha = 0.045 + amount * 0.12 * random(seed + i * 2.4);
    ctx.fillStyle = random(seed + i * 8.8) > 0.82 ? "#fff" : "#000";

    // Tiny irregular flakes/toner chips, not circular blobs.
    const len = 1.2 + random(seed + i * 11.2) * (2.8 + amount * 4.2);
    const thick = 0.45 + random(seed + i * 19.7) * (0.9 + amount * 1.2);
    ctx.fillRect(-len / 2, -thick / 2, len, thick);

    // Some paper crumbs get a rough second segment.
    if (random(seed + i * 4.4) > 0.72) {
      ctx.rotate((random(seed + i * 8.1) - 0.5) * 1.2);
      ctx.fillRect(-len * 0.35, -thick * 0.35, len * 0.7, thick * 0.7);
    }

    ctx.restore();
  }

  // Edge grime bands. This makes the slider obviously visible without ugly circles.
  const edgeStrength = amount * profile.edgeGrime;
  if (edgeStrength > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";

    const top = ctx.createLinearGradient(0, 0, 0, h * 0.18);
    top.addColorStop(0, `rgba(0,0,0,${edgeStrength * 0.20})`);
    top.addColorStop(0.45, `rgba(0,0,0,${edgeStrength * 0.07})`);
    top.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h * 0.18);

    const left = ctx.createLinearGradient(0, 0, w * 0.14, 0);
    left.addColorStop(0, `rgba(0,0,0,${edgeStrength * 0.16})`);
    left.addColorStop(0.55, `rgba(0,0,0,${edgeStrength * 0.05})`);
    left.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, w * 0.14, h);

    ctx.restore();
  }

  // Toner residue clouds, broad and faint.
  const residueCount = Math.ceil(amount * profile.residue);
  ctx.save();
  ctx.globalCompositeOperation = "multiply";

  for (let i = 0; i < residueCount; i++) {
    const pos = edgeBiasedPosition(w, h, 0.78, i + 2100);
    const rw = 100 + random(seed + i * 88.4) * (180 + 260 * amount);
    const rh = 22 + random(seed + i * 22.7) * (40 + 70 * amount);

    const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, rw);
    grad.addColorStop(0, `rgba(0,0,0,${0.020 + amount * 0.055})`);
    grad.addColorStop(0.42, `rgba(0,0,0,${0.010 + amount * 0.026})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate((random(seed + i * 61.2) - 0.5) * 0.75);
    ctx.fillStyle = grad;
    ctx.scale(1, rh / rw);
    ctx.beginPath();
    ctx.arc(0, 0, rw, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  // Fingerprint/grease smears. Noticeable only at medium/high dirt.
  const smearCount = Math.floor(amount * profile.smears);
  for (let i = 0; i < smearCount; i++) {
    const pos = edgeBiasedPosition(w, h, 0.38, i + 3400);
    drawFingerprintSmudge(pos.x, pos.y, 70 + random(seed + i * 19.2) * 140 * amount, amount, i);
  }

  ctx.restore();
}

function getCleanlinessProfile() {
  const profiles = {
    firstgen:   { dustBase: 6,  dustScale: 36, fibers: 5,  longHairs: 1, smears: 0, residue: 1, edgeBias: 0.42, edgeGrime: 0.10 },
    fifthgen:   { dustBase: 8,  dustScale: 46, fibers: 7,  longHairs: 2, smears: 1, residue: 2, edgeBias: 0.50, edgeGrime: 0.16 },
    twentieth:  { dustBase: 14, dustScale: 70, fibers: 10, longHairs: 3, smears: 2, residue: 4, edgeBias: 0.68, edgeGrime: 0.28 },
    library:    { dustBase: 18, dustScale: 86, fibers: 14, longHairs: 4, smears: 3, residue: 4, edgeBias: 0.74, edgeGrime: 0.36 },
    office1998: { dustBase: 9,  dustScale: 40, fibers: 6,  longHairs: 2, smears: 1, residue: 2, edgeBias: 0.46, edgeGrime: 0.16 },
    flyer1994:  { dustBase: 20, dustScale: 95, fibers: 16, longHairs: 5, smears: 3, residue: 5, edgeBias: 0.78, edgeGrime: 0.44 },
    artschool:  { dustBase: 16, dustScale: 82, fibers: 13, longHairs: 4, smears: 2, residue: 4, edgeBias: 0.70, edgeGrime: 0.34 },
    broken:     { dustBase: 24, dustScale: 110, fibers: 20, longHairs: 6, smears: 4, residue: 6, edgeBias: 0.82, edgeGrime: 0.54 },
    colourcopy: { dustBase: 10, dustScale: 48, fibers: 7,  longHairs: 2, smears: 1, residue: 2, edgeBias: 0.48, edgeGrime: 0.18 }
  };

  return profiles[currentPreset] || profiles.firstgen;
}

function edgeBiasedPosition(w, h, edgeBias, i) {
  if (random(seed + i * 17.9) < edgeBias) {
    const side = Math.floor(random(seed + i * 21.1) * 4);
    const depth = Math.pow(random(seed + i * 31.6), 2) * 0.22;

    if (side === 0) return { x: random(seed + i * 41.2) * w, y: depth * h };
    if (side === 1) return { x: random(seed + i * 51.2) * w, y: h - depth * h };
    if (side === 2) return { x: depth * w, y: random(seed + i * 61.2) * h };
    return { x: w - depth * w, y: random(seed + i * 71.2) * h };
  }

  return {
    x: random(seed + i * 13.1) * w,
    y: random(seed + i * 15.7) * h
  };
}

function drawFingerprintSmudge(x, y, radius, amount, index) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((random(seed + index * 4.2) - 0.5) * 1.8);
  ctx.globalCompositeOperation = "multiply";

  const rings = 8 + Math.floor(amount * 10);

  for (let r = 0; r < rings; r++) {
    ctx.beginPath();
    const rr = radius * (0.18 + r / rings * 0.78);
    const points = 86;

    for (let i = 0; i <= points; i++) {
      const a = i / points * Math.PI * 2;
      const wobble =
        Math.sin(a * 3 + r + seed) * radius * 0.026 +
        Math.sin(a * 9 + index) * radius * 0.013;

      const px = Math.cos(a) * (rr + wobble) * (0.85 + amount * 0.14);
      const py = Math.sin(a) * (rr + wobble) * (0.28 + amount * 0.16);

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.globalAlpha = 0.008 + amount * 0.020;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 0.55;
    ctx.stroke();
  }

  ctx.restore();
}

function drawBeforeCanvas(edgeFill) {
  const w = W();
  const h = H();

  beforeCtx.fillStyle = "#f7f1e5";
  beforeCtx.fillRect(0, 0, w, h);

  if (!sourceImage) return;

  drawPlacedImage(beforeCtx, w, h, edgeFill, 0);
}

function updateCompareClip() {
  const pct = Math.max(0, Math.min(1, compareX)) * 100;
  beforeCanvas.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  compareHandle.style.left = `${pct}%`;
}

function setCompareFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  compareX = (clientX - rect.left) / rect.width;
  updateCompareClip();
}

function addCopierGlassHair() {
  const amount = Number(dirtRange.value) / 100;
  const profile = getCleanlinessProfile();

  if (amount < 0.04) return;

  const w = W();
  const h = H();

  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#000";

  // Long scanner hairs/fibres. These are the main visible dirt effect.
  const longHairCount = Math.floor(1 + amount * profile.longHairs);

  for (let i = 0; i < longHairCount; i++) {
    const pos = edgeBiasedPosition(w, h, profile.edgeBias * 0.82, i + 5000);
    const len = 90 + random(seed + i * 19.1) * (180 + amount * 420);
    const angle = (random(seed + i * 25.5) - 0.5) * Math.PI * 1.45;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.055 + amount * 0.105;
    ctx.lineWidth = 0.45 + random(seed + i * 4.1) * (0.8 + amount * 0.8);

    ctx.beginPath();
    for (let s = 0; s < 34; s++) {
      const t = s / 33;
      const xx = (t - 0.5) * len;
      const yy =
        Math.sin(t * Math.PI * 2.2 + seed + i) * (2 + amount * 7) +
        Math.sin(t * Math.PI * 7.1 + i) * (0.6 + amount * 2.2);

      if (s === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();

    // Light side highlight makes it feel embedded on glass, not painted.
    if (random(seed + i * 88.2) > 0.45) {
      ctx.translate(1.1, 0.8);
      ctx.globalAlpha = 0.018 + amount * 0.035;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
      ctx.strokeStyle = "#000";
    }

    ctx.restore();
  }

  // Short paper fibres, more numerous but still subtle.
  const fiberCount = Math.floor(amount * profile.fibers * 2.4);

  for (let i = 0; i < fiberCount; i++) {
    const pos = edgeBiasedPosition(w, h, profile.edgeBias, i + 6000);
    const len = 10 + random(seed + i * 91.3) * (24 + amount * 68);
    const angle = random(seed + i * 17.3) * Math.PI * 2;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.045 + amount * 0.11;
    ctx.lineWidth = 0.35 + random(seed + i * 5.7) * 0.75;

    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.quadraticCurveTo(
      0,
      (random(seed + i * 8.9) - 0.5) * (7 + amount * 12),
      len / 2,
      (random(seed + i * 9.2) - 0.5) * (3 + amount * 4)
    );
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}

function addSubtleStreaks() {
  const amount = Number(lineRange.value) / 100;
  const brokenBoost = currentPreset === "broken" ? 0.35 : 0;
  const total = Math.min(1, amount + brokenBoost);

  if (total < 0.04) return;

  const w = W();
  const h = H();

  ctx.save();
  ctx.globalCompositeOperation = "multiply";

  // Scanner lines are now their own controlled effect:
  // sparse vertical defects, not general dirt.
  const streaks = total > 0.6 ? 2 : 1;

  for (let i = 0; i < streaks; i++) {
    const x = random(seed + i * 931.8) * w;
    const width = 1.2 + random(seed + i * 11.2) * (3 + total * 9);
    const alpha = 0.025 + total * 0.12;

    const grad = ctx.createLinearGradient(x - width * 2, 0, x + width * 2, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, `rgba(0,0,0,${alpha})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = grad;
    ctx.fillRect(x - width * 2, 0, width * 4, h);
  }

  const hairlines = Math.floor(total * 4);
  ctx.globalAlpha = 0.025 + total * 0.03;
  ctx.fillStyle = "#000";
  for (let i = 0; i < hairlines; i++) {
    const x = random(seed + i * 1221.4) * w;
    ctx.fillRect(x, 0, 0.6, h);
  }

  ctx.restore();
}

function addBookShadowIfNeeded() {
  if (currentPreset !== "library") return;

  const w = W();
  const h = H();

  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, w * 0.2, 0);
  grad.addColorStop(0, "rgba(0,0,0,0.38)");
  grad.addColorStop(0.35, "rgba(0,0,0,0.18)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w * 0.28, h);

  const curve = ctx.createRadialGradient(w * 0.05, h * 0.5, 0, w * 0.05, h * 0.5, h * 0.55);
  curve.addColorStop(0, "rgba(255,255,255,0.12)");
  curve.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = curve;
  ctx.fillRect(0, 0, w * 0.35, h);
  ctx.restore();
}

function addCornerAndEdgeWear() {
  const amount = Number(lossRange.value) / 100;
  const w = W();
  const h = H();

  ctx.save();

  // Slight off-white scanner bed/copy edge falloff.
  const edge = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(1, `rgba(0,0,0,${0.05 + amount * 0.16})`);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);

  // Worn borders, not fake scratches across the image.
  ctx.globalAlpha = 0.04 + amount * 0.13;
  ctx.fillStyle = "#000";
  const marks = Math.floor(12 + amount * 46);

  for (let i = 0; i < marks; i++) {
    const side = Math.floor(random(seed + i * 33.7) * 4);
    const x = random(seed + i * 72.2) * w;
    const y = random(seed + i * 91.4) * h;
    const len = 10 + random(seed + i * 101.3) * 56 * amount;
    const thick = 1 + random(seed + i * 89.1) * 5 * amount;

    if (side === 0) ctx.fillRect(x, 0, len, thick);
    if (side === 1) ctx.fillRect(x, h - thick, len, thick);
    if (side === 2) ctx.fillRect(0, y, thick, len);
    if (side === 3) ctx.fillRect(w - thick, y, thick, len);
  }

  ctx.restore();
}

function addPaperTexture() {
  const amount = Number(lossRange.value) / 100;
  const w = W();
  const h = H();
  const count = Math.floor(w * h * (0.04 + amount * 0.22) / 9000);

  ctx.save();

  for (let i = 0; i < count; i++) {
    const x = random(seed + i * 9.1) * w;
    const y = random(seed + i * 7.7) * h;
    ctx.globalAlpha = random(seed + i) * (0.06 + amount * 0.05);
    ctx.fillStyle = random(seed + i * 2) > 0.5 ? "#000" : "#fff";
    ctx.fillRect(x, y, 1, 1);
  }

  ctx.restore();
}

function drawPaper() {
  const w = W();
  const h = H();
  let tone = "#f7f1e5";

  if (currentPreset === "office1998") tone = "#f5f3ed";
  if (currentPreset === "library") tone = "#eee6d5";
  if (currentPreset === "flyer1994") tone = "#f0eadc";
  if (currentPreset === "twentieth") tone = "#e4ddcf";
  if (currentPreset === "colourcopy") tone = "#f4eddf";
  if (paperMode.value === "receipt") tone = "#efe6d0";

  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, w, h);
}

function addColourCopyArtifacts() {
  if (currentPreset !== "colourcopy") return;

  const w = W();
  const h = H();
  const loss = Number(lossRange.value) / 100;
  const dirt = Number(dirtRange.value) / 100;

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.09 + loss * 0.13;

  const colors = ["#00aeef", "#ec008c", "#fff200"];
  const gap = 6;

  // CMY toner-dot contamination.
  colors.forEach((color, idx) => {
    ctx.fillStyle = color;
    for (let y = idx * 2; y < h; y += gap * 7) {
      for (let x = idx * 3; x < w; x += gap * 7) {
        if (random(seed + x * 0.21 + y * 0.44 + idx) > 0.22) {
          ctx.beginPath();
          ctx.arc(x, y, 0.45 + loss * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });

  ctx.restore();

  // Subtle colour cast patches and dirty scanner bed haze.
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  const patches = 3 + Math.floor(dirt * 5);

  for (let i = 0; i < patches; i++) {
    const x = random(seed + i * 728.1) * w;
    const y = random(seed + i * 129.4) * h;
    const r = 90 + random(seed + i * 19.2) * 280;
    const color = i % 3 === 0 ? "rgba(236,0,140,0.08)" : i % 3 === 1 ? "rgba(0,174,239,0.07)" : "rgba(255,242,0,0.08)";
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
}

// Blend a paper overlay texture on top of the current canvas.  This
// function uses the high-resolution paperOverlayImg loaded above to
// introduce authentic crinkles and wrinkles across the page.  The
// overlay is scaled to fill the canvas and drawn with multiply
// blending so darker creases subtly darken the artwork.  The alpha
// depends on the generation loss (lossRange) to increase texture
// visibility on later copies.
function addPaperOverlay() {
  if (!paperOverlayImg.complete || !paperOverlayImg.width) return;
  const w = W();
  const h = H();
  const amount = Number(lossRange.value) / 100;
  // Compute aspect ratio and scaling to cover the canvas.
  const texRatio = paperOverlayImg.width / paperOverlayImg.height;
  let drawW = w;
  let drawH = h;
  if (texRatio > w / h) {
    // Texture is wider than canvas; fit width and crop top/bottom.
    drawH = w / texRatio;
  } else {
    // Texture is taller; fit height and crop left/right.
    drawW = h * texRatio;
  }
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  // Scale alpha based on generation loss; stronger texture on high loss.
  ctx.globalAlpha = 0.12 + amount * 0.28;
  // Draw the texture centered on the canvas.  Use drawImage with
  // destination size only; letting the browser scale the image down.
  ctx.drawImage(
    paperOverlayImg,
    0, 0, paperOverlayImg.width, paperOverlayImg.height,
    (w - drawW) / 2,
    (h - drawH) / 2,
    drawW,
    drawH
  );
  ctx.restore();
}


function addBorderStyle() {
  const mode = borderMode.value;
  if (mode === "none") return;

  const w = W();
  const h = H();
  const p = getBorderPalette();

  ctx.save();

  if (mode === "slight") {
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, w - 4, h - 4);

    const gTop = ctx.createLinearGradient(0, 0, 0, h * 0.04);
    gTop.addColorStop(0, "rgba(0,0,0,0.10)");
    gTop.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gTop;
    ctx.fillRect(0, 0, w, h * 0.04);
  }

  if (mode === "blackedge") {
    ctx.fillStyle = p.dark;
    const top = 4 + random(seed + 1) * 12;
    const left = 3 + random(seed + 2) * 10;
    const right = 3 + random(seed + 3) * 10;
    const bottom = 3 + random(seed + 4) * 10;
    ctx.fillRect(0, 0, w, top);
    ctx.fillRect(0, 0, left, h);
    ctx.fillRect(w - right, 0, right, h);
    ctx.fillRect(0, h - bottom, w, bottom);
  }

  if (mode === "crooked") {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = p.dark;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.08, 0);
    ctx.lineTo(0, h * 0.16);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(w, h);
    ctx.lineTo(w * 0.92, h);
    ctx.lineTo(w, h * 0.84);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.24)";
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, w - 12, h - 12);
  }

  if (mode === "book") {
    const leftShadow = ctx.createLinearGradient(0, 0, w * 0.16, 0);
    leftShadow.addColorStop(0, "rgba(0,0,0,0.42)");
    leftShadow.addColorStop(0.35, "rgba(0,0,0,0.16)");
    leftShadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = leftShadow;
    ctx.fillRect(0, 0, w * 0.22, h);

    ctx.strokeStyle = "rgba(0,0,0,0.14)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.75, 0.75, w - 1.5, h - 1.5);
  }

  if (mode === "misaligned") {
    ctx.fillStyle = p.dark;
    ctx.fillRect(0, 0, w, 6);
    ctx.fillRect(0, 0, 6, h);

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(w - 16, 0, 16, h);
    ctx.fillRect(0, h - 12, w, 12);

    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(5, 5, w - 22, h - 17);
  }

  ctx.restore();
}

function addFoldCrease() {
  const mode = foldMode.value;
  const amount = Number(foldIntensity.value) / 100;
  if (mode === "none" || amount <= 0.01) return;

  const w = W();
  const h = H();

  const source = document.createElement("canvas");
  source.width = Math.floor(w);
  source.height = Math.floor(h);
  const sctx = source.getContext("2d");
  sctx.drawImage(canvas, 0, 0, w, h);

  ctx.clearRect(0, 0, w, h);

  function localClamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function verticalWarp(creases, widthFactor = 1, strengthFactor = 1) {
    const band = (18 + amount * 66) * widthFactor;
    const strength = (5 + amount * 16) * strengthFactor;

    for (let x = 0; x < w; x++) {
      let disp = 0;
      for (const c of creases) {
        const d = x - c;
        const ad = Math.abs(d);
        if (ad < band) {
          const t = 1 - ad / band;
          const ripple = Math.sin((x * 0.055) + seed * 0.003) * amount * 0.55;
          disp += Math.sign(d || 1) * t * t * strength + ripple * t;
        }
      }
      const sx = localClamp(x + disp, 0, w - 1);
      ctx.drawImage(source, sx, 0, 1, h, x, 0, 1, h);
    }
  }

  function horizontalWarp(creases, widthFactor = 1, strengthFactor = 1) {
    const band = (18 + amount * 66) * widthFactor;
    const strength = (5 + amount * 16) * strengthFactor;

    for (let y = 0; y < h; y++) {
      let disp = 0;
      for (const c of creases) {
        const d = y - c;
        const ad = Math.abs(d);
        if (ad < band) {
          const t = 1 - ad / band;
          const ripple = Math.sin((y * 0.055) + seed * 0.003) * amount * 0.55;
          disp += Math.sign(d || 1) * t * t * strength + ripple * t;
        }
      }
      const sy = localClamp(y + disp, 0, h - 1);
      ctx.drawImage(source, 0, sy, w, 1, 0, y, w, 1);
    }
  }

  function shadeVertical(x, bandScale = 1) {
    const band = (22 + amount * 64) * bandScale;
    const grad = ctx.createLinearGradient(x - band, 0, x + band, 0);
    // Reduce contrast on crease highlights/shadows.  The previous
    // implementation was too harsh, making the fold look like a drawn
    // line rather than a natural depression.  Lower highlight alpha and
    // dark alpha values give a more subtle fold.
    grad.addColorStop(0.00, "rgba(255,255,255,0)");
    grad.addColorStop(0.30, `rgba(255,255,255,${0.018 + amount * 0.030})`);
    grad.addColorStop(0.49, `rgba(0,0,0,${0.06 + amount * 0.16})`);
    grad.addColorStop(0.54, `rgba(255,255,255,${0.026 + amount * 0.060})`);
    grad.addColorStop(1.00, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - band, 0, band * 2, h);

    ctx.strokeStyle = `rgba(0,0,0,${0.02 + amount * 0.08})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + Math.sin(seed) * amount * 3, h);
    ctx.stroke();
  }

  function shadeHorizontal(y, bandScale = 1) {
    const band = (22 + amount * 64) * bandScale;
    const grad = ctx.createLinearGradient(0, y - band, 0, y + band);
    // Softer highlights and shadows for horizontal creases.
    grad.addColorStop(0.00, "rgba(255,255,255,0)");
    grad.addColorStop(0.30, `rgba(255,255,255,${0.018 + amount * 0.030})`);
    grad.addColorStop(0.49, `rgba(0,0,0,${0.06 + amount * 0.16})`);
    grad.addColorStop(0.54, `rgba(255,255,255,${0.026 + amount * 0.060})`);
    grad.addColorStop(1.00, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - band, w, band * 2);

    ctx.strokeStyle = `rgba(0,0,0,${0.02 + amount * 0.08})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + Math.cos(seed) * amount * 3);
    ctx.stroke();
  }

  function blendTexture(alpha = 0.18, rotate = 0) {
    if (!creaseImg.complete || !creaseImg.naturalWidth) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "multiply";
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rotate);
    ctx.drawImage(creaseImg, -w / 2, -h / 2, w, h);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha * 0.22;
    ctx.globalCompositeOperation = "screen";
    ctx.translate(w / 2, h / 2);
    ctx.rotate(rotate);
    ctx.drawImage(creaseImg, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  if (mode === "vertical") {
    const x = w * 0.5 + (random(seed + 441) - 0.5) * amount * 32;
    verticalWarp([x], 1.05, 0.95);
    shadeVertical(x, 1.05);
    // Blend the crease texture more strongly so folds pick up real
    // paper wrinkles.  Increase the base alpha and growth so the texture
    // overlay becomes more visible at higher intensities.
    blendTexture(0.18 + amount * 0.28, 0);
    return;
  }

  if (mode === "horizontal") {
    const y = h * 0.5 + (random(seed + 442) - 0.5) * amount * 32;
    horizontalWarp([y], 1.05, 0.95);
    shadeHorizontal(y, 1.05);
    blendTexture(0.18 + amount * 0.28, Math.PI / 2);
    return;
  }

  if (mode === "trifold") {
    const a = w / 3 + (random(seed + 443) - 0.5) * amount * 26;
    const b = w * 2 / 3 + (random(seed + 444) - 0.5) * amount * 26;
    verticalWarp([a, b], 0.92, 0.82);
    shadeVertical(a, 0.90);
    shadeVertical(b, 0.90);
    blendTexture(0.16 + amount * 0.25, 0);
    return;
  }

  if (mode === "book") {
    const x = w * 0.5;
    verticalWarp([x], 1.35, 1.1);
    shadeVertical(x, 1.45);
    blendTexture(0.20 + amount * 0.25, 0);
    return;
  }

  if (mode === "corner") {
    // Instead of a small corner fold, draw a strong diagonal crease across
    // the page.  This produces a large fold similar to the reference
    // image: a diagonal crease from bottom-left to top-right with soft
    // shading and texture overlay.  There is no paper curl; instead
    // shading is drawn via a diagonal gradient and a dark crease line.
    ctx.drawImage(source, 0, 0, w, h);
    // The diagonal band width scales with fold intensity and canvas size.
    const band = Math.sqrt(w * w + h * h) * (0.12 + amount * 0.35);
    // Create a diagonal gradient from bottom-left to top-right.
    const grad = ctx.createLinearGradient(0, h, w, 0);
    grad.addColorStop(0.00, 'rgba(255,255,255,0)');
    grad.addColorStop(0.35, `rgba(0,0,0,${0.06 + amount * 0.14})`);
    grad.addColorStop(0.50, `rgba(255,255,255,${0.04 + amount * 0.08})`);
    grad.addColorStop(0.65, `rgba(0,0,0,${0.06 + amount * 0.14})`);
    grad.addColorStop(1.00, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = grad;
    // Extend gradient fill region beyond canvas to fully cover rotated diagonal.
    ctx.translate(-band * 0.5, -band * 0.5);
    ctx.fillRect(0, 0, w + band, h + band);
    ctx.restore();
    // Draw the dark crease line along the diagonal.
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.strokeStyle = `rgba(0,0,0,${0.08 + amount * 0.18})`;
    ctx.lineWidth = 1 + amount * 1.0;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w, 0);
    ctx.stroke();
    ctx.restore();
    // Overlay crease texture aligned with the diagonal to bring out
    // realistic paper wrinkles.  Increase alpha to make the texture
    // visible at higher intensities.
    blendTexture(0.22 + amount * 0.30, -Math.PI / 4);
    return;
  }

  ctx.drawImage(source, 0, 0, w, h);
}
function addStampOverlay() {
  const text = (stampText.value || "").trim();
  if (!text) return;

  const w = W();
  const h = H();
  const opacity = Number(stampOpacity.value) / 100;
  if (opacity <= 0.01) return;

  const colorMap = {
    red: "rgba(150, 18, 18, OP)",
    blue: "rgba(26, 62, 145, OP)",
    black: "rgba(20, 20, 20, OP)"
  };

  const style = stampStyle.value;
  const colorTemplate = colorMap[stampColor.value] || colorMap.red;
  const stampAlpha = 0.16 + opacity * 0.34;
  const fillAlpha = 0.035 + opacity * 0.10;
  const strokeColor = colorTemplate.replace("OP", stampAlpha.toFixed(3));
  const fillColor = colorTemplate.replace("OP", fillAlpha.toFixed(3));

  function roundedRectPath(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  ctx.save();
  ctx.translate(w * 0.5, h * 0.5);
  ctx.rotate((-18 + random(seed + 77) * 10) * Math.PI / 180);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (style === "stamp") {
    // Multi-line support for stamp text.  Split on newlines and draw
    // successive lines with decreasing size.  Measure text widths to
    // size the border box appropriately.  We draw two nested
    // rectangles to mimic the double-border style of vintage stamps.
    const lines = text.toUpperCase().split(/\n+/);
    // Choose a base size based on canvas width; scale smaller on
    // narrow canvases.  The first line is largest; subsequent lines
    // are 60% height.
    const baseSize = Math.max(24, w * 0.06);
    const lineSizes = [];
    let maxWidth = 0;

    // Precompute each line size and measured width.
    lines.forEach((ln, idx) => {
      const size = baseSize * (idx === 0 ? 1 : 0.55);
      lineSizes.push(size);
      ctx.font = `900 ${size}px Arial Black, Helvetica, sans-serif`;
      const metrics = ctx.measureText(ln);
      const width = metrics.width;
      if (width > maxWidth) maxWidth = width;
    });

    // Compute bounding box with some padding.
    const paddingX = baseSize * 0.5;
    const paddingY = baseSize * 0.4;
    const rectW = maxWidth + paddingX * 2;
    const rectH = lineSizes.reduce((sum, s) => sum + s * 1.2, 0) + paddingY * 2;

    // Draw outer border rectangle.
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(1.5, w * 0.003);
    roundedRectPath(-rectW / 2, -rectH / 2, rectW, rectH, rectH * 0.10);
    ctx.stroke();
    ctx.restore();

    // Draw inner border rectangle slightly inset to create a double line.
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(1, w * 0.002);
    const inset = Math.max(2, w * 0.004);
    roundedRectPath(-rectW / 2 + inset, -rectH / 2 + inset, rectW - inset * 2, rectH - inset * 2, (rectH - inset * 2) * 0.10);
    ctx.stroke();
    ctx.restore();

    // Draw text lines.  No fill rectangle behind the text; this allows
    // the stamp to blend naturally with the page.  Use multiply mode
    // so the colour interacts with the background like ink.
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.78;
    let yOffset = -rectH / 2 + paddingY;
    lines.forEach((ln, idx) => {
      const size = lineSizes[idx];
      ctx.font = `900 ${size}px Arial Black, Helvetica, sans-serif`;
      ctx.fillStyle = strokeColor;
      ctx.fillText(ln, 0, yOffset + size * 0.8);
      yOffset += size * 1.2;
    });
    ctx.restore();

    // Light screen highlight to soften edges.
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.06 + opacity * 0.04;
    ctx.translate(1.4, 1.4);
    yOffset = -rectH / 2 + paddingY;
    lines.forEach((ln, idx) => {
      const size = lineSizes[idx];
      ctx.font = `900 ${size}px Arial Black, Helvetica, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillText(ln, 0, yOffset + size * 0.8);
      yOffset += size * 1.2;
    });
    ctx.restore();
  }

  if (style === "watermark") {
    ctx.font = `900 ${Math.max(38, w * 0.085)}px Arial Black, Helvetica, sans-serif`;

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.10 + opacity * 0.22;
    ctx.fillStyle = colorTemplate.replace("OP", "0.22");
    ctx.fillText(text.toUpperCase(), 0, 0);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.04 + opacity * 0.08;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.translate(1.4, 1.4);
    ctx.fillText(text.toUpperCase(), 0, 0);
    ctx.restore();
  }

  if (style === "archive") {
    ctx.translate(-w * 0.16, -h * 0.24);
    ctx.rotate(-12 * Math.PI / 180);
    ctx.font = `900 ${Math.max(18, w * 0.032)}px Arial Black, Helvetica, sans-serif`;

    const rectW = w * 0.28;
    const rectH = h * 0.07;

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = fillColor;
    roundedRectPath(-rectW / 2, -rectH / 2, rectW, rectH, rectH * 0.10);
    ctx.fill();

    ctx.lineWidth = Math.max(1.2, w * 0.0012);
    ctx.strokeStyle = strokeColor;
    roundedRectPath(-rectW / 2, -rectH / 2, rectW, rectH, rectH * 0.10);
    ctx.stroke();

    ctx.fillStyle = strokeColor;
    ctx.fillText(text.toUpperCase(), 0, 0);
    ctx.restore();
  }

  ctx.restore();
}
function drawIdleTexture() {
  addPaperTexture();
  addSparseScannerDirt();
  addCornerAndEdgeWear();
}

function resetControls() {
  applyPreset(currentPreset);
}

function randomizeControls() {
  lossRange.value = Math.floor(Math.random() * 100);
  tonerRange.value = Math.floor(Math.random() * 100);
  densityRange.value = Math.floor(20 + Math.random() * 80);
  dirtRange.value = Math.floor(15 + Math.random() * 70);
  lineRange.value = Math.floor(Math.random() * 45);
  skewRange.value = Math.floor(-25 + Math.random() * 50);
  doubleRange.value = Math.floor(Math.random() * 45);
  edgeRange.value = Math.floor(90 + Math.random() * 14);
  foldIntensity.value = Math.floor(Math.random() * 70);
  stampOpacity.value = Math.floor(15 + Math.random() * 50);
  seed = Math.random() * 10000;
  render();
}

function downloadImage() {
  const link = document.createElement("a");
  // Name downloads after the new app title.  Renaming here prevents the
  // exported file from still saying "xeroxlab" even though the tool is
  // now branded as Xeroxizer.
  link.download = `xeroxizer-${currentPreset}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function random(n) {
  const x = Math.sin(n * 999.123) * 10000;
  return x - Math.floor(x);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

document.querySelectorAll(".preset").forEach(btn => {
  btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
});

// Removed fold and stamp controls from the event listener array.  Only
// basic degradation and layout controls remain.
[lossRange, tonerRange, densityRange, dirtRange, lineRange, skewRange, doubleRange, edgeRange, paperMode, borderMode].forEach(input => {
  if (input && input.addEventListener) {
    const eventName = (input.tagName === "SELECT" || input.type === "text") ? "input" : "input";
    input.addEventListener(eventName, () => {
      if (input === paperMode) fitCanvas();
      else render();
    });
  }
});

upload.addEventListener("change", e => loadImageFile(e.target.files[0]));
randomizeBtn.addEventListener("click", randomizeControls);
resetBtn.addEventListener("click", resetControls);
downloadBtn.addEventListener("click", downloadImage);

["dragenter", "dragover"].forEach(eventName => {
  window.addEventListener(eventName, event => {
    event.preventDefault();
    document.body.classList.add("dragging");
  });
});

["dragleave", "drop"].forEach(eventName => {
  window.addEventListener(eventName, event => {
    event.preventDefault();
    document.body.classList.remove("dragging");
  });
});

window.addEventListener("drop", event => {
  event.preventDefault();
  loadImageFile(event.dataTransfer.files[0]);
});



canvasWrap.addEventListener("pointerdown", event => {
  isComparing = true;
  setCompareFromEvent(event);
});

window.addEventListener("pointermove", event => {
  if (!isComparing) return;
  setCompareFromEvent(event);
});

window.addEventListener("pointerup", () => {
  isComparing = false;
});

canvasWrap.addEventListener("touchstart", event => {
  isComparing = true;
  setCompareFromEvent(event);
}, { passive: true });

canvasWrap.addEventListener("touchmove", event => {
  if (!isComparing) return;
  setCompareFromEvent(event);
}, { passive: true });


window.addEventListener("resize", fitCanvas);

fitCanvas();
applyPreset("firstgen");
