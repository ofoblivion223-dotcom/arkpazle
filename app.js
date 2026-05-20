"use strict";

const state = {
  colors: [
    { id: "green", label: "緑", hex: "#a7e900" },
    { id: "blue", label: "青", hex: "#39a9f2" },
  ],
  board: { width: 6, height: 6, cells: [] },
  requirements: { rows: {}, columns: {} },
  requirementLocks: { rows: {}, columns: {} },
  requirementSources: { rows: {}, columns: {} },
  pieces: [],
  pieceCandidatesByCard: [],
  tool: { type: "empty", color: null },
  referenceImage: {
    src: "",
    zoom: 100,
    selecting: false,
    selectionMode: "board",
    boardRect: null,
    gridX: null,
    gridY: null,
    manualBoardRect: false,
    firstPoint: null,
    debug: false,
    debugItems: [],
    advanced: false,
    mode: "completed",
    barMode: "shape",
  },
  imageBitmap: null,
  analysis: {
    lastReport: "",
    cvReady: false,
    board: null,
    bars: null,
    pieces: null,
    inferredBars: null,
  },
  solutions: [],
  solutionIndex: 0,
  solutionMode: "requirements",
  inferredRequirementCandidates: [],
  inferredRequirementIndex: 0,
};

const $ = (id) => document.getElementById(id);

function newEmptyCells(width, height) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => "empty"));
}

function ensureRequirements() {
  if (!state.requirementSources) state.requirementSources = { rows: {}, columns: {} };
  for (const color of state.colors) {
    if (!state.requirements.rows[color.id]) state.requirements.rows[color.id] = Array(state.board.height).fill(0);
    if (!state.requirements.columns[color.id]) state.requirements.columns[color.id] = Array(state.board.width).fill(0);
    if (!state.requirementLocks.rows[color.id]) state.requirementLocks.rows[color.id] = Array(state.board.height).fill(false);
    if (!state.requirementLocks.columns[color.id]) state.requirementLocks.columns[color.id] = Array(state.board.width).fill(false);
    if (!state.requirementSources.rows[color.id]) state.requirementSources.rows[color.id] = Array(state.board.height).fill("empty");
    if (!state.requirementSources.columns[color.id]) state.requirementSources.columns[color.id] = Array(state.board.width).fill("empty");
    state.requirements.rows[color.id] = resizeArray(state.requirements.rows[color.id], state.board.height);
    state.requirements.columns[color.id] = resizeArray(state.requirements.columns[color.id], state.board.width);
    state.requirementLocks.rows[color.id] = resizeArray(state.requirementLocks.rows[color.id], state.board.height).map(Boolean);
    state.requirementLocks.columns[color.id] = resizeArray(state.requirementLocks.columns[color.id], state.board.width).map(Boolean);
    state.requirementSources.rows[color.id] = resizeSourceArray(state.requirementSources.rows[color.id], state.board.height);
    state.requirementSources.columns[color.id] = resizeSourceArray(state.requirementSources.columns[color.id], state.board.width);
    state.requirementSources.rows[color.id] = state.requirementSources.rows[color.id].map((source, index) =>
      state.requirementLocks.rows[color.id][index] ? "user" : source,
    );
    state.requirementSources.columns[color.id] = state.requirementSources.columns[color.id].map((source, index) =>
      state.requirementLocks.columns[color.id][index] ? "user" : source,
    );
  }
}

function resizeArray(arr, length) {
  const next = arr.slice(0, length);
  while (next.length < length) next.push(0);
  return next;
}

function resizeSourceArray(arr = [], length) {
  const next = arr.slice(0, length).map((source) => source || "empty");
  while (next.length < length) next.push("empty");
  return next;
}

function initBoard(width = 6, height = 6) {
  state.board = { width, height, cells: newEmptyCells(width, height) };
  ensureRequirements();
}

function serializableState() {
  return {
    colors: state.colors,
    board: state.board,
    requirements: state.requirements,
    requirementLocks: state.requirementLocks,
    requirementSources: state.requirementSources,
    pieces: state.pieces,
    pieceCandidatesByCard: state.pieceCandidatesByCard,
  };
}

function saveState() {
  try {
    localStorage.setItem("endfieldPuzzleState", JSON.stringify(serializableState()));
  } catch {
    // Ignore storage quota/private mode failures.
  }
}

function clearSavedState() {
  try {
    localStorage.removeItem("endfieldPuzzleState");
  } catch {
    // Ignore storage quota/private mode failures.
  }
}

function loadSavedState() {
  try {
    const saved = localStorage.getItem("endfieldPuzzleState");
    if (!saved) return false;
    const data = JSON.parse(saved);
    if (!data?.board?.width || !data?.board?.height) return false;
    state.colors = data.colors || state.colors;
    state.board = data.board;
    state.requirements = data.requirements || { rows: {}, columns: {} };
    state.requirementLocks = data.requirementLocks || { rows: {}, columns: {} };
    state.requirementSources = data.requirementSources || { rows: {}, columns: {} };
    state.pieces = data.pieces || [];
    state.pieceCandidatesByCard = data.pieceCandidatesByCard || [];
    $("widthInput").value = String(state.board.width);
    $("heightInput").value = String(state.board.height);
    ensureRequirements();
    return true;
  } catch {
    return false;
  }
}

function colorById(id) {
  return state.colors.find((color) => color.id === id);
}

function fixedColor(cell) {
  return cell.startsWith("fixed:") ? cell.slice(6) : null;
}

function render() {
  renderColors();
  renderTools();
  renderBoard();
  renderRequirements();
  renderPieces();
  renderDiagnostics();
  renderReferenceImage();
  renderSolution();
  renderBarCandidatePanel();
  saveState();
}

function boardAssistSuggestion() {
  if (!state.referenceImage.src) return "スクショを読み込むと、デルタ解析を始められます。";
  if (!state.referenceImage.boardRect) return "まずデルタ解析を押します。黄色い枠がずれた時だけ、左上1マスで補正してください。";
  if (state.referenceImage.manualBoardRect) return "盤面は補正済みです。もう一度デルタ解析を押すと、バーとピースを読み直します。";
  return "黄色い枠が盤面に合っていれば、そのままピース確認へ進めます。ずれていたら左上1マスで補正します。";
}

function renderRecognitionGuide() {
  const guide = $("recognitionGuide");
  if (!guide) return;
  const hasImage = Boolean(state.referenceImage.src);
  const hasBoard = Boolean(state.referenceImage.boardRect);
  const manual = Boolean(state.referenceImage.manualBoardRect);
  const barsOk = state.analysis.bars?.length ? state.analysis.bars.every((entry) => entry.ok) : false;
  const piecesOk = state.analysis.pieces?.cardCount ? state.pieces.length > 0 : false;
  const steps = [
    { label: "画像", state: hasImage ? "done" : "todo" },
    { label: "盤面", state: manual ? "manual" : hasBoard ? "auto" : "todo" },
    { label: "バー", state: barsOk ? "done" : state.analysis.bars ? "warn" : "todo" },
    { label: "ピース", state: piecesOk ? "done" : state.analysis.pieces ? "warn" : "todo" },
  ];
  guide.innerHTML = `
    <div class="guide-steps">
      ${steps
        .map(
          (step) => `
            <span class="guide-step ${step.state}">
              <strong>${escapeHtml(step.label)}</strong>
              <small>${guideStateLabel(step.state)}</small>
            </span>
          `,
        )
        .join("")}
    </div>
    <div class="guide-message">${escapeHtml(boardAssistSuggestion())}</div>
  `;
}

function guideStateLabel(stateName) {
  if (stateName === "done") return "OK";
  if (stateName === "manual") return "手動OK";
  if (stateName === "auto") return "自動候補";
  if (stateName === "warn") return "要確認";
  return "未";
}

function clearAnalysisReport() {
  state.analysis.board = null;
  state.analysis.bars = null;
  state.analysis.rawBarCandidates = null;
  state.analysis.pieces = null;
  state.analysis.inferredBars = null;
  state.analysis.lastReport = "";
  state.inferredRequirementCandidates = [];
  state.inferredRequirementIndex = 0;
}

function resetAllState() {
  state.colors = [
    { id: "green", label: "緑", hex: "#a7e900" },
    { id: "blue", label: "青", hex: "#39a9f2" },
  ];
  state.board = { width: 6, height: 6, cells: newEmptyCells(6, 6) };
  state.requirements = emptyCounts();
  state.requirementLocks = emptyLocks();
  state.requirementSources = emptySources();
  state.pieces = [];
  state.pieceCandidatesByCard = [];
  state.tool = { type: "empty", color: null };
  state.referenceImage = {
    src: "",
    zoom: 100,
    selecting: false,
    selectionMode: "board",
    boardRect: null,
    gridX: null,
    gridY: null,
    manualBoardRect: false,
    firstPoint: null,
    debug: false,
    debugItems: [],
    advanced: false,
    mode: "completed",
    barMode: "shape",
  };
  state.imageBitmap = null;
  clearAnalysisReport();
  state.solutions = [];
  state.solutionIndex = 0;
  state.solutionMode = "requirements";
  state.inferredRequirementCandidates = [];
  state.inferredRequirementIndex = 0;
  $("widthInput").value = "6";
  $("heightInput").value = "6";
  $("imageZoom").value = "100";
  $("barModeSelect").value = "shape";
  $("imageInput").value = "";
  clearSavedState();
  addPiece([[1, 1], [0, 1]], "green");
}

function clearRecognizedPuzzleState() {
  state.board.cells = newEmptyCells(state.board.width, state.board.height);
  state.requirements = emptyCounts();
  state.requirementLocks = emptyLocks();
  state.requirementSources = emptySources();
  state.pieces = [];
  state.pieceCandidatesByCard = [];
  state.solutions = [];
  state.solutionIndex = 0;
  state.inferredRequirementCandidates = [];
  state.inferredRequirementIndex = 0;
}

function clearReferenceBoardDetection() {
  state.referenceImage.boardRect = null;
  state.referenceImage.gridX = null;
  state.referenceImage.gridY = null;
  state.referenceImage.manualBoardRect = false;
  state.referenceImage.debugItems = [];
  state.referenceImage.debug = false;
}

function setBoardGridFromRect(rect) {
  state.referenceImage.gridX = lineSetFromRect(rect.x, rect.width, state.board.width);
  state.referenceImage.gridY = lineSetFromRect(rect.y, rect.height, state.board.height);
}

function currentBoardGrid() {
  const rect = state.referenceImage.boardRect;
  if (!rect) return null;
  const gridX =
    state.referenceImage.gridX?.length === state.board.width + 1
      ? state.referenceImage.gridX
      : lineSetFromRect(rect.x, rect.width, state.board.width);
  const gridY =
    state.referenceImage.gridY?.length === state.board.height + 1
      ? state.referenceImage.gridY
      : lineSetFromRect(rect.y, rect.height, state.board.height);
  return { rect, gridX, gridY };
}

function renderReferenceImage() {
  const viewport = $("referenceViewport");
  const empty = $("referenceEmpty");
  const image = $("referenceImage");
  const stage = $("referenceStage");
  const overlay = $("boardOverlay");
  const hint = $("referenceHint");
  const advanced = $("advancedReferenceActions");
  if (!viewport || !empty || !image) return;
  if (!state.referenceImage.src) {
    viewport.hidden = true;
    empty.hidden = false;
    image.removeAttribute("src");
    if (overlay) overlay.hidden = true;
    renderRecognitionGuide();
    return;
  }
  empty.hidden = true;
  viewport.hidden = false;
  image.src = state.referenceImage.src;
  stage.style.transform = `scale(${state.referenceImage.zoom / 100})`;
  stage.classList.toggle("selecting", state.referenceImage.selecting);
  if (hint) {
    hint.textContent = state.referenceImage.selecting
      ? state.referenceImage.firstPoint
        ? state.referenceImage.selectionMode === "cell"
          ? "次に、左上1マスの右下をクリックしてください。"
          : "次に、盤面全体の右下をクリックしてください。"
        : state.referenceImage.selectionMode === "cell"
          ? "黄色い枠を合わせるため、まず左上1マスの左上をクリックしてください。"
          : "盤面全体の左上をクリックしてください。"
      : "スクショを読み込んだら、デルタ解析で盤面を探します。";
    if (!state.referenceImage.selecting) {
      hint.textContent = state.referenceImage.boardRect
        ? state.referenceImage.manualBoardRect
          ? "盤面は補正済みです。ずれていなければデルタ解析でバーとピースを読み直します。"
          : "黄色い枠が盤面に合っていればOKです。ずれている時だけ「左上1マスで補正」を使います。"
        : "まずデルタ解析を押します。ずれた時だけ、左上1マスで盤面を補正します。";
    }
  }
  if (advanced) advanced.hidden = !state.referenceImage.advanced;
  renderRecognitionGuide();
  renderBoardOverlay();
}

async function autoAnalyze() {
  if (!state.referenceImage.src) {
    $("statusBox").className = "status error";
    $("statusBox").textContent = "先にスクショを読み込んでください。";
    return;
  }
  renderExternalLibraryNotice();
  clearAnalysisReport();
  if (!state.referenceImage.manualBoardRect) {
    state.referenceImage.boardRect = null;
    state.referenceImage.gridX = null;
    state.referenceImage.gridY = null;
  }
  if (!state.referenceImage.boardRect) {
    $("statusBox").className = "status";
    $("statusBox").textContent = "デルタが盤面の黄色い枠を探しています。";
    const found = await autoDetectBoardGrid();
    if (!found.ok) {
      $("statusBox").className = "status error";
      $("statusBox").textContent = found.message || "盤面を見つけられませんでした。スクショ内の黄色い枠が見えているか確認してください。";
      state.referenceImage.advanced = true;
      renderReferenceImage();
      return;
    }
  }
  detectBoardCells({ fixedColors: true });
  detectRequirementBars();
  state.pieces = [];
  state.pieceCandidatesByCard = [];
  state.analysis.pieces = null;
  detectPieces();
  const inferred = solveSmart();
  renderDiagnostics();
  renderBarCandidatePanel();
  if (!inferred.ok) {
    state.solutions = [];
    $("statusBox").className = "status error";
    $("statusBox").textContent = `${inferred.message}${state.referenceImage.manualBoardRect ? "" : " 黄色い枠がずれている時は、左上1マスで補正してからもう一度デルタ解析してください。"}`;
    renderSolution();
    return;
  }
  $("statusBox").className = "status";
  $("statusBox").textContent = inferred.message;
  renderSolution();
}

async function autoDetectBoardGrid() {
  const cvStatus = await waitForOpenCv(3500);
  if (cvStatus.ok) {
    const cvResult = detectBoardGridWithOpenCv();
    if (cvResult.ok) return cvResult;
    const fallback = autoDetectBoardGridLegacy();
    if (fallback.ok) {
      fallback.message = "盤面候補を見つけました。黄色い枠が合っているか確認してください。";
      return fallback;
    }
    return {
      ok: false,
      message: "盤面を見つけられませんでした。黄色い枠が見えるスクショか、盤面サイズが合っているか確認してください。",
    };
  }
  const fallback = autoDetectBoardGridLegacy();
  if (fallback.ok) {
    fallback.message = cvStatus.reason === "load-failed"
      ? "OpenCV.jsを読み込めなかったため、簡易解析で盤面候補を見つけました。黄色い枠が合っているか必ず確認してください。"
      : "盤面候補を見つけました。黄色い枠が合っているか確認してください。";
    return fallback;
  }
  return {
    ok: false,
    message: cvStatus.reason === "load-failed"
      ? "OpenCV.jsを読み込めなかったため、画像解析の精度が下がっています。ネットワークを確認するか、黄色い枠がはっきり見えるスクショで試してください。"
      : "盤面を見つけられませんでした。黄色い枠が見えるスクショか、盤面サイズが合っているか確認してください。",
  };
}

function waitForOpenCv(timeoutMs = 3500) {
  const started = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      if (window.__opencvLoadFailed) {
        state.analysis.cvReady = false;
        resolve({ ok: false, reason: "load-failed" });
        return;
      }
      if (window.cv && cv.Mat) {
        if (cv.getBuildInformation) {
          state.analysis.cvReady = true;
          resolve({ ok: true });
          return;
        }
        if (typeof cv.onRuntimeInitialized === "function") {
          const previous = cv.onRuntimeInitialized;
          cv.onRuntimeInitialized = () => {
            previous();
            state.analysis.cvReady = true;
            resolve({ ok: true });
          };
          return;
        }
        state.analysis.cvReady = true;
        resolve({ ok: true });
        return;
      }
      if (performance.now() - started > timeoutMs) {
        resolve({ ok: false, reason: "timeout" });
        return;
      }
      setTimeout(tick, 80);
    };
    tick();
  });
}

function renderExternalLibraryNotice() {
  const notice = $("libraryNotice");
  if (!notice) return;
  if (window.__opencvLoadFailed) {
    notice.hidden = false;
    notice.textContent = "画像解析ライブラリを読み込めませんでした。簡易解析で続行しますが、黄色い枠・ピース形状・バー本数をいつもより慎重に確認してください。";
    return;
  }
  notice.hidden = true;
  notice.textContent = "";
}

function detectBoardGridWithOpenCv() {
  if (!state.imageBitmap) return { ok: false, message: "画像が読み込まれていません。" };
  const canvas = imageToCanvas();
  let src;
  let rgb;
  let hsv;
  let mask;
  let kernel;
  let closed;
  let edges;
  let lines;
  let lower;
  let upper;
  try {
    src = cv.imread(canvas);
    rgb = new cv.Mat();
    hsv = new cv.Mat();
    mask = new cv.Mat();
    closed = new cv.Mat();
    edges = new cv.Mat();
    cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
    cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV);

    lower = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [24, 55, 55, 0]);
    upper = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [58, 255, 255, 255]);
    cv.inRange(hsv, lower, upper, mask);

    kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.morphologyEx(mask, closed, cv.MORPH_CLOSE, kernel);
    cv.dilate(closed, closed, kernel, new cv.Point(-1, -1), 1);
    cv.Canny(closed, edges, 40, 120, 3, false);

    lines = new cv.Mat();
    const minLineLength = Math.max(16, Math.min(canvas.width, canvas.height) * 0.025);
    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 20, minLineLength, 8);

    const vertical = [];
    const horizontal = [];
    for (let i = 0; i < lines.rows; i++) {
      const x1 = lines.data32S[i * 4];
      const y1 = lines.data32S[i * 4 + 1];
      const x2 = lines.data32S[i * 4 + 2];
      const y2 = lines.data32S[i * 4 + 3];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < minLineLength) continue;
      if (Math.abs(dx) <= Math.max(3, Math.abs(dy) * 0.18)) vertical.push({ pos: (x1 + x2) / 2, weight: len, min: Math.min(y1, y2), max: Math.max(y1, y2) });
      if (Math.abs(dy) <= Math.max(3, Math.abs(dx) * 0.18)) horizontal.push({ pos: (y1 + y2) / 2, weight: len, min: Math.min(x1, x2), max: Math.max(x1, x2) });
    }

    const sourceCtx = canvas.getContext("2d", { willReadFrequently: true });
    const lineResult = buildLineGridCandidates(vertical, horizontal, mask, canvas, sourceCtx, lines.rows);
    const textureCandidates = buildTextureBoardCandidates(sourceCtx, canvas.width, canvas.height);
    const candidates = [...textureCandidates, ...lineResult.candidates].sort((a, b) => a.score - b.score);
    if (!candidates.length) {
      return {
        ok: false,
        message: "盤面候補を作れませんでした。黄色い枠がはっきり見えるスクショか、盤面サイズが合っているか確認してください。",
      };
    }
    const best = candidates[0];
    const refinedBest = refineBoardRectFromAnchor(best, sourceCtx, canvas.width, canvas.height);
    const gridFit = fitBoardGridFromBars(sourceCtx, refinedBest.rect);
    const rect = gridFit.rect;
    state.referenceImage.boardRect = rect;
    state.referenceImage.gridX = gridFit.gridX;
    state.referenceImage.gridY = gridFit.gridY;
    state.referenceImage.manualBoardRect = false;
    state.analysis.board = {
      confidence: gridFit.confidence,
      source: refinedBest.source,
      notes: gridFit.notes,
    };
    state.referenceImage.debug = true;
    state.referenceImage.debugItems = [
      ...gridCandidateDebugItems([{ ...refinedBest, rect }, ...candidates.filter((candidate) => candidate !== best).slice(0, 2)]),
      ...boardGridLineDebugItems(gridFit.gridX, gridFit.gridY, rect),
    ];
    renderReferenceImage();
    $("statusBox").className = "status";
    $("statusBox").textContent = "盤面候補を見つけました。黄色い枠が合っていれば、そのまま進めます。";
    return { ok: true, message: "盤面候補を見つけました。" };
  } catch (error) {
    return { ok: false, message: "盤面を読み取れませんでした。スクショを読み直して、もう一度デルタ解析してください。" };
  } finally {
    for (const mat of [src, rgb, hsv, mask, kernel, closed, edges, lines, lower, upper]) {
      if (mat && typeof mat.delete === "function") mat.delete();
    }
  }
}

function imageToCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = state.imageBitmap.naturalWidth;
  canvas.height = state.imageBitmap.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(state.imageBitmap, 0, 0);
  return canvas;
}

function clusterLinePositions(lines, tolerance) {
  if (!lines.length) return [];
  const sorted = lines.slice().sort((a, b) => a.pos - b.pos);
  const clusters = [];
  for (const line of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(line.pos - last.center) > tolerance) {
      clusters.push({ center: line.pos, weight: line.weight });
    } else {
      last.center = (last.center * last.weight + line.pos * line.weight) / (last.weight + line.weight);
      last.weight += line.weight;
    }
  }
  return clusters.map((cluster) => Math.round(cluster.center));
}

function projectionLinesFromMask(mask, imageWidth, imageHeight) {
  const xScores = Array(imageWidth).fill(0);
  const yScores = Array(imageHeight).fill(0);
  for (let y = 0; y < imageHeight; y += 2) {
    for (let x = 0; x < imageWidth; x += 2) {
      if (mask.ucharPtr(y, x)[0] > 0) {
        xScores[x]++;
        yScores[y]++;
      }
    }
  }
  return {
    xLines: clusterProjectionByPercentile(xScores, 0.985, 10),
    yLines: clusterProjectionByPercentile(yScores, 0.985, 10),
  };
}

function clusterProjectionByPercentile(scores, percentile, tolerance) {
  const sortedScores = scores.slice().sort((a, b) => a - b);
  const threshold = Math.max(4, sortedScores[Math.floor(sortedScores.length * percentile)] || 0);
  const raw = [];
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] >= threshold) raw.push({ pos: i, weight: scores[i] });
  }
  return clusterLinePositions(raw, tolerance);
}

function mergeLinePositions(lines, tolerance) {
  if (!lines.length) return [];
  return clusterLinePositions(
    lines
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b)
      .map((value) => ({ pos: value, weight: 1 })),
    tolerance,
  );
}

function buildLineGridCandidates(vertical, horizontal, mask, canvas, ctx, houghLineCount) {
  const houghXLines = clusterLinePositions(vertical, 7);
  const houghYLines = clusterLinePositions(horizontal, 7);
  const maskLines = projectionLinesFromMask(mask, canvas.width, canvas.height);
  const xLines = mergeLinePositions([...houghXLines, ...maskLines.xLines], 7);
  const yLines = mergeLinePositions([...houghYLines, ...maskLines.yLines], 7);
  const candidates = buildGridCandidates(xLines, yLines, canvas.width, canvas.height, ctx).map((candidate) => ({
    ...candidate,
    source: "line",
  }));
  return { candidates, houghXLines, houghYLines, xLines, yLines, houghLineCount };
}

function buildTextureBoardCandidates(ctx, imageWidth, imageHeight) {
  const candidates = [];
  const expectedAspect = state.board.width / state.board.height;
  const minSide = Math.min(imageWidth, imageHeight);
  const minCell = Math.max(24, minSide * 0.04);
  const maxCell = minSide * 0.16;
  const likelyBounds = {
    minX: imageWidth * 0.2,
    maxX: imageWidth * 0.68,
    minY: imageHeight * 0.18,
    maxY: imageHeight * 0.9,
  };
  for (let cell = minCell; cell <= maxCell; cell += Math.max(4, minCell * 0.18)) {
    const width = cell * state.board.width;
    const height = width / expectedAspect;
    if (height < minCell * state.board.height * 0.75 || height > imageHeight * 0.75) continue;
    const stepX = Math.max(10, cell * 0.5);
    const stepY = Math.max(10, cell * 0.5);
    for (let y = likelyBounds.minY; y <= Math.min(likelyBounds.maxY, imageHeight - height); y += stepY) {
      for (let x = likelyBounds.minX; x <= Math.min(likelyBounds.maxX, imageWidth - width); x += stepX) {
        const rect = { x, y, width, height };
        const candidate = scoreRectCandidate(rect, imageWidth, imageHeight, ctx, "texture");
        if (!candidate.rejected) candidates.push(candidate);
      }
    }
  }
  return candidates.sort((a, b) => a.score - b.score).slice(0, 8);
}

function refineBoardRectFromAnchor(candidate, ctx, imageWidth, imageHeight) {
  if (!candidate || !candidate.rect) return candidate;
  const base = candidate.rect;
  const baseCell = Math.min(base.width / state.board.width, base.height / state.board.height);
  const minImageSide = Math.min(imageWidth, imageHeight);
  const minCell = Math.max(18, minImageSide * 0.035);
  const maxCell = minImageSide * 0.18;
  const options = [candidate];
  const expectedAspect = state.board.width / state.board.height;

  for (let scale = 0.85; scale <= 2.15; scale += 0.05) {
    const cell = baseCell * scale;
    if (cell < minCell || cell > maxCell) continue;
    const width = cell * state.board.width;
    const height = width / expectedAspect;
    if (base.x + width > imageWidth || base.y + height > imageHeight) continue;
    const rect = { x: base.x, y: base.y, width, height };
    const option = scoreRectCandidate(rect, imageWidth, imageHeight, ctx, `${candidate.source}+左上補正`);
    const sizeRatio = width / Math.max(1, base.width);
    const lowerRightEvidence = boardLowerRightEvidence(ctx, rect);
    const expansionBonus = sizeRatio > 1 ? Math.min(34, (sizeRatio - 1) * 28) : 0;
    option.score -= expansionBonus;
    option.score -= lowerRightEvidence * 24;
    option.details.anchorScale = scale;
    option.details.lowerRightEvidence = lowerRightEvidence;
    if (sizeRatio > 1.12) option.reasons.push("左上固定で拡張");
    if (!option.rejected) options.push(option);
  }

  return options.sort((a, b) => a.score - b.score)[0];
}

function boardLowerRightEvidence(ctx, rect) {
  if (!ctx) return 0;
  const right = sampleRectFeatures(
    ctx,
    rect.x + rect.width * 0.72,
    rect.y + rect.height * 0.08,
    rect.width * 0.24,
    rect.height * 0.84,
    5,
  );
  const bottom = sampleRectFeatures(
    ctx,
    rect.x + rect.width * 0.08,
    rect.y + rect.height * 0.72,
    rect.width * 0.84,
    rect.height * 0.24,
    5,
  );
  return Math.min(1, right.dark + right.diagonal + bottom.dark + bottom.diagonal);
}

function fitBoardGridFromBars(ctx, rect) {
  const fallback = {
    rect,
    gridX: lineSetFromRect(rect.x, rect.width, state.board.width),
    gridY: lineSetFromRect(rect.y, rect.height, state.board.height),
    confidence: "低",
    notes: ["矩形均等割り"],
  };
  if (!ctx) return fallback;
  const cellW = rect.width / state.board.width;
  const cellH = rect.height / state.board.height;
  const topRegion = {
    x: Math.max(0, rect.x - cellW * 0.75),
    y: Math.max(0, rect.y - cellH * 1.35),
    width: rect.width + cellW * 1.5,
    height: cellH * 1.25,
  };
  const leftRegion = {
    x: Math.max(0, rect.x - cellW * 1.35),
    y: Math.max(0, rect.y - cellH * 0.75),
    width: cellW * 1.25,
    height: rect.height + cellH * 1.5,
  };
  const topCenters = collectRequirementBarCenters(ctx, topRegion, "columns");
  const leftCenters = collectRequirementBarCenters(ctx, leftRegion, "rows");
  const xFit = fitAxisFromObservedCenters(fallback.gridX, topCenters, cellW);
  const yFit = fitAxisFromObservedCenters(fallback.gridY, leftCenters, cellH);
  const gridX = xFit.lines || fallback.gridX;
  const gridY = yFit.lines || fallback.gridY;
  const nextRect = {
    x: gridX[0],
    y: gridY[0],
    width: gridX[gridX.length - 1] - gridX[0],
    height: gridY[gridY.length - 1] - gridY[0],
  };
  const confidenceScore = (xFit.score || 0) + (yFit.score || 0);
  return {
    rect: nextRect,
    gridX,
    gridY,
    confidence: confidenceScore >= 4 ? "高" : confidenceScore >= 2 ? "中" : "低",
    notes: [
      `列バー${topCenters.length}件:${xFit.note}`,
      `行バー${leftCenters.length}件:${yFit.note}`,
    ],
  };
}

function collectRequirementBarCenters(ctx, region, axis) {
  const centers = [];
  for (const color of state.colors) {
    const components = collectColorComponentsInRegion(ctx, color, region, 1);
    for (const component of components) {
      const box = component.bounds;
      const w = box.maxX - box.minX + 1;
      const h = box.maxY - box.minY + 1;
      if (component.points.length < 8 || w > 32 || h > 32 || w < 3 || h < 3) continue;
      if (axis === "columns" && h > w * 2.4) continue;
      if (axis === "rows" && w > h * 2.4) continue;
      centers.push(axis === "columns" ? (box.minX + box.maxX) / 2 : (box.minY + box.maxY) / 2);
    }
  }
  return clusterNumericCenters(centers, axis === "columns" ? region.width * 0.04 : region.height * 0.04);
}

function collectColorComponentsInRegion(ctx, color, region, step = 1) {
  const mask = new Set();
  const rgb = hexToRgb(color.hex);
  const target = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const startX = Math.max(0, Math.floor(region.x));
  const startY = Math.max(0, Math.floor(region.y));
  const endX = Math.min(ctx.canvas.width, Math.ceil(region.x + region.width));
  const endY = Math.min(ctx.canvas.height, Math.ceil(region.y + region.height));
  for (let y = startY; y < endY; y += step) {
    for (let x = startX; x < endX; x += step) {
      const data = ctx.getImageData(x, y, 1, 1).data;
      const hsv = rgbToHsv(data[0], data[1], data[2]);
      const hueDistance = Math.min(Math.abs(hsv.h - target.h), 360 - Math.abs(hsv.h - target.h));
      if (hueDistance < 34 && hsv.s > 0.32 && hsv.v > 0.24) mask.add(key(x, y));
    }
  }
  return connectedComponents(mask, step).map((points) => ({ color: color.id, points, bounds: componentBounds(points), area: points.length * step * step }));
}

function clusterNumericCenters(values, tolerance) {
  if (!values.length) return [];
  const sorted = values.slice().sort((a, b) => a - b);
  const clusters = [];
  for (const value of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(value - last.center) > tolerance) {
      clusters.push({ center: value, count: 1 });
    } else {
      last.center = (last.center * last.count + value) / (last.count + 1);
      last.count++;
    }
  }
  return clusters.map((cluster) => cluster.center);
}

function fitAxisFromObservedCenters(defaultLines, observedCenters, defaultPitch) {
  if (!observedCenters.length) return { lines: null, score: 0, note: "バーなし" };
  const defaultCenters = defaultLines.slice(0, -1).map((line, index) => (line + defaultLines[index + 1]) / 2);
  const pairs = [];
  for (const center of observedCenters) {
    let best = null;
    defaultCenters.forEach((expected, index) => {
      const distance = Math.abs(center - expected);
      if (!best || distance < best.distance) best = { index, center, distance };
    });
    if (best && best.distance <= defaultPitch * 0.55) pairs.push(best);
  }
  const grouped = new Map();
  for (const pair of pairs) {
    if (!grouped.has(pair.index)) grouped.set(pair.index, []);
    grouped.get(pair.index).push(pair.center);
  }
  const uniquePairs = [...grouped.entries()].map(([index, centers]) => ({ index, center: average(centers) }));
  if (uniquePairs.length >= 3) {
    const n = uniquePairs.length;
    const sumI = sum(uniquePairs.map((pair) => pair.index));
    const sumC = sum(uniquePairs.map((pair) => pair.center));
    const sumII = sum(uniquePairs.map((pair) => pair.index * pair.index));
    const sumIC = sum(uniquePairs.map((pair) => pair.index * pair.center));
    const denom = n * sumII - sumI * sumI;
    if (denom) {
      const pitch = (n * sumIC - sumI * sumC) / denom;
      const origin = (sumC - pitch * sumI) / n;
      const residual = average(uniquePairs.map((pair) => Math.abs(pair.center - (origin + pair.index * pitch))));
      const ratio = pitch / defaultPitch;
      const candidateLines = Array.from({ length: defaultLines.length }, (_, index) => origin - pitch / 2 + index * pitch);
      const maxShift = Math.max(...candidateLines.map((line, index) => Math.abs(line - defaultLines[index])));
      if (ratio > 0.88 && ratio < 1.12 && residual < defaultPitch * 0.14 && maxShift <= defaultPitch * 0.25) {
        return {
          lines: candidateLines,
          score: 2,
          note: `${uniquePairs.length}列/行で補正`,
        };
      }
    }
  }
  return { lines: null, score: 0, note: "補正不採用" };
}

function buildGridCandidates(xLines, yLines, imageWidth, imageHeight, ctx) {
  const xSets = consecutiveLineSets(xLines, state.board.width + 1);
  const ySets = consecutiveLineSets(yLines, state.board.height + 1);
  const candidates = [];
  for (const xSet of xSets) {
    for (const ySet of ySets) {
      const candidate = scoreGridCandidate(xSet, ySet, imageWidth, imageHeight, ctx);
      if (!candidate.rejected) candidates.push(candidate);
    }
  }
  return candidates.sort((a, b) => a.score - b.score);
}

function consecutiveLineSets(lines, count) {
  if (lines.length < count) return [];
  const sorted = lines.slice().sort((a, b) => a - b);
  const sets = [];
  for (let i = 0; i <= sorted.length - count; i++) sets.push(sorted.slice(i, i + count));
  return sets;
}

function scoreGridCandidate(xSet, ySet, imageWidth, imageHeight, ctx) {
  const rect = {
    x: xSet[0],
    y: ySet[0],
    width: xSet[xSet.length - 1] - xSet[0],
    height: ySet[ySet.length - 1] - ySet[0],
  };
  const candidate = scoreRectCandidate(rect, imageWidth, imageHeight, ctx, "line");
  const uniformity = gridScore(xSet, ySet);
  candidate.xSet = xSet;
  candidate.ySet = ySet;
  candidate.score += uniformity * 3;
  candidate.details.uniformity = uniformity;
  return candidate;
}

function scoreRectCandidate(rect, imageWidth, imageHeight, ctx, source) {
  const reasons = [];
  const expectedAspect = state.board.width / state.board.height;
  const actualAspect = rect.width / Math.max(1, rect.height);
  const aspectRatio = actualAspect / expectedAspect;
  const cellW = rect.width / state.board.width;
  const cellH = rect.height / state.board.height;
  const cellRatio = cellW / Math.max(1, cellH);
  const features = ctx ? gridCandidateImageFeatures(ctx, rect) : { texture: 0, pieceColor: 0, barEvidence: 0 };
  const aspectPenalty = Math.abs(actualAspect - expectedAspect) * 45;
  const wideAspectPenalty = aspectRatio > 1.35 ? (aspectRatio - 1.35) * 180 : 0;
  const cellRatioPenalty = cellRatio < 0.75 || cellRatio > 1.35 ? Math.abs(Math.log(cellRatio)) * 160 : 0;
  const rightPenalty = rect.x + rect.width > imageWidth * 0.7 ? 35 : 0;
  const rightPanelPenalty = rect.x > imageWidth * 0.62 || rect.x + rect.width / 2 > imageWidth * 0.72 ? 160 : 0;
  const tooShortPenalty = rect.height < Math.min(imageWidth, imageHeight) * 0.12 ? 80 : 0;
  const tinyCellPenalty = Math.min(rect.width / state.board.width, rect.height / state.board.height) < 18 ? 70 : 0;
  const imageRelativeCellPenalty = Math.min(cellW, cellH) < Math.min(imageWidth, imageHeight) * 0.035 ? 95 : 0;
  const hugeWidthPenalty = rect.width > imageWidth * 0.55 ? 45 : 0;
  const texturePenalty = features.texture < 0.16 ? (0.16 - features.texture) * 220 : -Math.min(28, features.texture * 60);
  const pieceColorPenalty = features.pieceColor > 0.08 ? features.pieceColor * 360 : 0;
  const noBarEvidencePenalty = features.barEvidence < 0.035 ? 45 : 0;
  const barEvidenceBonus = -Math.min(22, features.barEvidence * 80);
  const upperLeftBonus = (rect.x / imageWidth) * 12 + (rect.y / imageHeight) * 8;
  if (wideAspectPenalty) reasons.push("横長");
  if (cellRatioPenalty) reasons.push("セル比率異常");
  if (rightPenalty) reasons.push("右側に寄りすぎ");
  if (rightPanelPenalty) reasons.push("右パネル領域");
  if (tooShortPenalty) reasons.push("高さが小さい");
  if (tinyCellPenalty) reasons.push("セルが小さい");
  if (imageRelativeCellPenalty) reasons.push("セルが画像比で小さい");
  if (hugeWidthPenalty) reasons.push("横に広すぎ");
  if (texturePenalty > 0) reasons.push("盤面テクスチャ不足");
  if (pieceColorPenalty) reasons.push("右側ピース混入");
  if (noBarEvidencePenalty) reasons.push("バー周辺証拠なし");
  if (features.barEvidence > 0.08) reasons.push("バー周辺証拠あり");
  const score =
    aspectPenalty +
    wideAspectPenalty +
    cellRatioPenalty +
    rightPenalty +
    rightPanelPenalty +
    tooShortPenalty +
    tinyCellPenalty +
    imageRelativeCellPenalty +
    hugeWidthPenalty +
    texturePenalty +
    pieceColorPenalty +
    noBarEvidencePenalty +
    barEvidenceBonus +
    upperLeftBonus;
  return {
    source,
    xSet: lineSetFromRect(rect.x, rect.width, state.board.width),
    ySet: lineSetFromRect(rect.y, rect.height, state.board.height),
    rect,
    score,
    rejected:
      tooShortPenalty >= 80 ||
      tinyCellPenalty >= 70 ||
      imageRelativeCellPenalty >= 95 ||
      rightPanelPenalty >= 160 ||
      aspectRatio > 1.6 ||
      cellRatio < 0.55 ||
      cellRatio > 1.8,
    reasons: reasons.length ? reasons : ["下書き"],
    details: {
      uniformity: 0,
      aspectRatio,
      cellRatio,
      texture: features.texture,
      pieceColor: features.pieceColor,
      barEvidence: features.barEvidence,
    },
  };
}

function lineSetFromRect(start, length, cellCount) {
  return Array.from({ length: cellCount + 1 }, (_, index) => start + (length / cellCount) * index);
}

function gridCandidateImageFeatures(ctx, rect) {
  const inner = sampleRectFeatures(ctx, rect.x, rect.y, rect.width, rect.height, 8);
  const cellLike = inner.dark + inner.diagonal;
  const texture = Math.min(1, cellLike);
  const top = sampleRectFeatures(ctx, rect.x, Math.max(0, rect.y - rect.height * 0.22), rect.width, rect.height * 0.2, 5);
  const left = sampleRectFeatures(ctx, Math.max(0, rect.x - rect.width * 0.22), rect.y, rect.width * 0.2, rect.height, 5);
  return {
    texture,
    pieceColor: inner.pieceColor,
    barEvidence: top.pieceColor + left.pieceColor,
  };
}

function sampleRectFeatures(ctx, x, y, width, height, stepCount) {
  let total = 0;
  let dark = 0;
  let diagonal = 0;
  let pieceColor = 0;
  const xStep = Math.max(1, width / stepCount);
  const yStep = Math.max(1, height / stepCount);
  for (let py = y; py < y + height; py += yStep) {
    for (let px = x; px < x + width; px += xStep) {
      const ix = Math.max(0, Math.min(ctx.canvas.width - 1, Math.round(px)));
      const iy = Math.max(0, Math.min(ctx.canvas.height - 1, Math.round(py)));
      const data = ctx.getImageData(ix, iy, 1, 1).data;
      const hsv = rgbToHsv(data[0], data[1], data[2]);
      total++;
      if (hsv.v < 0.28) dark++;
      if (hsv.v >= 0.28 && hsv.v < 0.55 && hsv.s < 0.35) diagonal++;
      if (isPuzzleColorHsv(hsv)) pieceColor++;
    }
  }
  return {
    dark: total ? dark / total : 0,
    diagonal: total ? diagonal / total : 0,
    pieceColor: total ? pieceColor / total : 0,
  };
}

function isPuzzleColorHsv(hsv) {
  const isGreen = hsv.h >= 62 && hsv.h <= 100 && hsv.s > 0.35 && hsv.v > 0.25;
  const isBlue = hsv.h >= 185 && hsv.h <= 220 && hsv.s > 0.30 && hsv.v > 0.25;
  return isGreen || isBlue;
}

function gridCandidateDebugItems(candidates) {
  const colors = ["#b5f21b", "#ff4d8d", "#5ee0ff"];
  return candidates.flatMap((candidate, index) => {
    const color = colors[index] || "#ffffff";
    return [
      { type: "region", x: candidate.rect.x, y: candidate.rect.y, width: candidate.rect.width, height: candidate.rect.height, count: candidate.score.toFixed(0), color, label: index === 0 ? "採" : "候" },
      ...candidate.xSet.map((x) => ({ type: "region", x: x - 1, y: candidate.rect.y, width: 2, height: candidate.rect.height, count: "", color, label: "" })),
      ...candidate.ySet.map((y) => ({ type: "region", x: candidate.rect.x, y: y - 1, width: candidate.rect.width, height: 2, count: "", color, label: "" })),
    ];
  });
}

function boardGridLineDebugItems(gridX, gridY, rect) {
  if (!gridX || !gridY || !rect) return [];
  return [
    ...gridX.map((x) => ({ type: "region", x: x - 0.75, y: gridY[0], width: 1.5, height: gridY[gridY.length - 1] - gridY[0], count: "", color: "#b5f21b", label: "" })),
    ...gridY.map((y) => ({ type: "region", x: gridX[0], y: y - 0.75, width: gridX[gridX.length - 1] - gridX[0], height: 1.5, count: "", color: "#b5f21b", label: "" })),
  ];
}

function averageCellSize(lines) {
  if (!lines || lines.length < 2) return 1;
  const gaps = [];
  for (let i = 1; i < lines.length; i++) gaps.push(lines[i] - lines[i - 1]);
  return average(gaps);
}

function barAnalysis(stats = {}) {
  ensureRequirements();
  return state.colors.map((color) => {
    const rowTotal = sum(state.requirements.rows[color.id] || []);
    const columnTotal = sum(state.requirements.columns[color.id] || []);
    return {
      color: color.id,
      label: color.label,
      rowTotal,
      columnTotal,
      diff: rowTotal - columnTotal,
      ok: rowTotal === columnTotal,
      topBars: stats[color.id]?.topBars ?? null,
      leftBars: stats[color.id]?.leftBars ?? null,
      assignedColumns: stats[color.id]?.assignedColumns ?? null,
      assignedRows: stats[color.id]?.assignedRows ?? null,
    };
  });
}

function barStatusMessage(analysis) {
  const bad = (analysis || []).filter((entry) => !entry.ok);
  if (!bad.length) return "画像から読んだバーを参考値として入れました。合っている場所だけクリックして確定してください。";
  return `画像バーは参考値です。${bad.map((entry) => `${entry.label}は左バー${entry.leftBars ?? "?"}本/上バー${entry.topBars ?? "?"}本、行${entry.rowTotal}/列${entry.columnTotal}`).join("、")} で合計が合いません。合っている場所だけ確定し、残りは補完します。`;
}

function candidateSummary(candidates) {
  return candidates
    .map((candidate, index) => {
      const d = candidate.details || {};
      const anchor = d.anchorScale ? ` 拡${Number(d.anchorScale).toFixed(2)}` : "";
      const lowerRight = d.lowerRightEvidence ? ` 右下${Number(d.lowerRightEvidence).toFixed(2)}` : "";
      return `${index + 1}) ${candidate.source} ${candidate.score.toFixed(1)} ${candidate.rect.width.toFixed(0)}x${candidate.rect.height.toFixed(0)} ${candidate.reasons.join("/")} 比${Number(d.cellRatio || 0).toFixed(2)} 横${Number(d.aspectRatio || 0).toFixed(2)} 盤${Number(d.texture || 0).toFixed(2)} 色${Number(d.pieceColor || 0).toFixed(2)}${anchor}${lowerRight}`;
    })
    .join(" / ");
}

function gridScore(xSet, ySet) {
  const xGaps = [];
  const yGaps = [];
  for (let i = 1; i < xSet.length; i++) xGaps.push(xSet[i] - xSet[i - 1]);
  for (let i = 1; i < ySet.length; i++) yGaps.push(ySet[i] - ySet[i - 1]);
  const xAvg = average(xGaps);
  const yAvg = average(yGaps);
  return average(xGaps.map((gap) => Math.abs(gap - xAvg))) + average(yGaps.map((gap) => Math.abs(gap - yAvg)));
}

function autoDetectBoardGridLegacy() {
  if (!state.imageBitmap) return { ok: false, message: "スクショの読み込みがまだ終わっていません。少し待ってからもう一度押してください。" };
  const canvas = document.createElement("canvas");
  canvas.width = state.imageBitmap.naturalWidth;
  canvas.height = state.imageBitmap.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(state.imageBitmap, 0, 0);
  const greenPixels = [];
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const data = ctx.getImageData(x, y, 1, 1).data;
      const hsv = rgbToHsv(data[0], data[1], data[2]);
      if (hsv.h >= 62 && hsv.h <= 95 && hsv.s > 0.45 && hsv.v > 0.32) {
        greenPixels.push({ x, y });
      }
    }
  }
  if (greenPixels.length < 120) {
    return {
      ok: false,
      message: "盤面の黄色い枠を見つけられませんでした。画像が暗い、盤面が小さい、盤面サイズが違う可能性があります。",
    };
  }

  const xScores = projectionScores(greenPixels, "x", canvas.width);
  const yScores = projectionScores(greenPixels, "y", canvas.height);
  const xLines = clusterProjection(xScores, 8);
  const yLines = clusterProjection(yScores, 8);
  const xSet = bestLineSet(xLines, state.board.width + 1);
  const ySet = bestLineSet(yLines, state.board.height + 1);
  if (!xSet || !ySet) {
    return {
      ok: false,
      message: `盤面らしい枠は見つかりましたが、${state.board.width} x ${state.board.height} のマス数に合いませんでした。盤面サイズを確認してください。`,
    };
  }

  const roughRect = {
    x: xSet[0],
    y: ySet[0],
    width: xSet[xSet.length - 1] - xSet[0],
    height: ySet[ySet.length - 1] - ySet[0],
  };
  const gridFit = fitBoardGridFromBars(ctx, roughRect);
  state.referenceImage.boardRect = gridFit.rect;
  state.referenceImage.gridX = gridFit.gridX;
  state.referenceImage.gridY = gridFit.gridY;
  state.referenceImage.manualBoardRect = false;
  state.analysis.board = { confidence: gridFit.confidence, source: "legacy", notes: gridFit.notes };
  state.referenceImage.debug = true;
  state.referenceImage.debugItems = boardGridLineDebugItems(gridFit.gridX, gridFit.gridY, gridFit.rect);
  renderReferenceImage();
  $("statusBox").className = "status";
  $("statusBox").textContent = "盤面候補を見つけました。黄色い枠が合っているか確認してください。";
  return { ok: true };
}

function projectionScores(points, axis, length) {
  const scores = Array(length).fill(0);
  for (const point of points) scores[axis === "x" ? point.x : point.y]++;
  return scores;
}

function clusterProjection(scores, minScore) {
  const clusters = [];
  let current = null;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i] >= minScore) {
      if (!current) current = { start: i, end: i, weight: 0 };
      current.end = i;
      current.weight += scores[i];
    } else if (current) {
      clusters.push(current);
      current = null;
    }
  }
  if (current) clusters.push(current);
  return clusters
    .filter((cluster) => cluster.end - cluster.start <= 8)
    .map((cluster) => Math.round((cluster.start + cluster.end) / 2));
}

function bestLineSet(lines, count) {
  if (lines.length < count) return null;
  let best = null;
  const candidates = [];
  for (let i = 0; i <= lines.length - count; i++) {
    const subset = lines.slice(i, i + count);
    const gaps = [];
    for (let j = 1; j < subset.length; j++) gaps.push(subset[j] - subset[j - 1]);
    const avg = average(gaps);
    if (avg < 18) continue;
    const variance = average(gaps.map((gap) => Math.abs(gap - avg)));
    const score = variance - avg * 0.02;
    if (!best || score < best.score) best = { subset, score };
  }
  return best?.subset || null;
}

function renderBoardOverlay() {
  const overlay = $("boardOverlay");
  const stage = $("referenceStage");
  if (!overlay || !stage) return;
  stage.querySelectorAll(".selection-point").forEach((node) => node.remove());
  const rect = state.referenceImage.boardRect;
  if (!rect) {
    overlay.hidden = true;
    if (state.referenceImage.firstPoint) addSelectionPoint(state.referenceImage.firstPoint);
    return;
  }
  overlay.hidden = false;
  overlay.className = `board-overlay ${state.referenceImage.manualBoardRect ? "manual" : "auto"}`;
  overlay.style.left = `${rect.x}px`;
  overlay.style.top = `${rect.y}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.backgroundSize = `${rect.width / state.board.width}px ${rect.height / state.board.height}px`;
  renderDebugOverlay();
}

function renderDebugOverlay() {
  const overlay = $("debugOverlay");
  if (!overlay) return;
  overlay.innerHTML = "";
  if (!state.referenceImage.debug || !state.referenceImage.debugItems.length) {
    overlay.hidden = true;
    return;
  }
  overlay.hidden = false;
  for (const item of state.referenceImage.debugItems) {
    if (item.type === "point") {
      const dot = document.createElement("div");
      dot.className = "debug-point";
      dot.style.left = `${item.x}px`;
      dot.style.top = `${item.y}px`;
      overlay.appendChild(dot);
    }
    if (item.type === "region") {
      const region = document.createElement("div");
      region.className = "debug-region";
      if (item.color) {
        region.style.borderColor = item.color;
        region.style.background = `${item.color}22`;
      }
      region.style.left = `${item.x}px`;
      region.style.top = `${item.y}px`;
      region.style.width = `${item.width}px`;
      region.style.height = `${item.height}px`;
      overlay.appendChild(region);
      const label = document.createElement("div");
      label.className = "debug-label";
      label.textContent = `${item.label ? item.label[0] : ""}${item.count}`;
      if (item.color) label.style.background = item.color;
      label.style.left = `${item.x + item.width / 2}px`;
      label.style.top = `${item.y + item.height / 2}px`;
      overlay.appendChild(label);
    }
  }
}

function addSelectionPoint(point) {
  const stage = $("referenceStage");
  const dot = document.createElement("div");
  dot.className = "selection-point";
  dot.style.left = `${point.x}px`;
  dot.style.top = `${point.y}px`;
  stage.appendChild(dot);
}

function imagePointFromEvent(event) {
  const image = $("referenceImage");
  const rect = image.getBoundingClientRect();
  const zoom = state.referenceImage.zoom / 100;
  return {
    x: (event.clientX - rect.left) / zoom,
    y: (event.clientY - rect.top) / zoom,
  };
}

function handleReferenceClick(event) {
  if (!state.referenceImage.selecting || !state.referenceImage.src) return;
  const point = imagePointFromEvent(event);
  if (!state.referenceImage.firstPoint) {
    state.referenceImage.firstPoint = point;
  } else {
    const first = state.referenceImage.firstPoint;
    const cellRect = {
      x: Math.min(first.x, point.x),
      y: Math.min(first.y, point.y),
      width: Math.abs(first.x - point.x),
      height: Math.abs(first.y - point.y),
    };
    state.referenceImage.boardRect =
      state.referenceImage.selectionMode === "cell"
        ? {
            x: cellRect.x,
            y: cellRect.y,
            width: cellRect.width * state.board.width,
            height: cellRect.height * state.board.height,
          }
        : cellRect;
    setBoardGridFromRect(state.referenceImage.boardRect);
    state.referenceImage.manualBoardRect = true;
    state.analysis.board = { confidence: "手動", notes: ["手動指定"] };
    state.referenceImage.firstPoint = null;
    state.referenceImage.selecting = false;
    $("statusBox").className = "status";
    $("statusBox").textContent =
      state.referenceImage.selectionMode === "cell"
        ? "左上1マスで盤面を補正しました。次は「デルタ解析」でバーとピースを読み直してください。"
        : "盤面範囲を補正しました。次は「デルタ解析」でバーとピースを読み直してください。";
  }
  renderReferenceImage();
}

function renderColors() {
  $("colorList").innerHTML = "";
  for (const color of state.colors) {
    const item = document.createElement("div");
    item.className = "color-item";
    item.innerHTML = `
      <span class="swatch" style="background:${color.hex}"></span>
      <input value="${escapeHtml(color.label)}" aria-label="色名" />
      <button>削除</button>
    `;
    const input = item.querySelector("input");
    input.addEventListener("input", () => {
      color.label = input.value;
      renderTools();
      renderPieces();
    });
    item.querySelector("button").addEventListener("click", () => {
      if (state.colors.length <= 1) return;
      state.colors = state.colors.filter((entry) => entry.id !== color.id);
      delete state.requirements.rows[color.id];
      delete state.requirements.columns[color.id];
      delete state.requirementLocks.rows[color.id];
      delete state.requirementLocks.columns[color.id];
      delete state.requirementSources.rows[color.id];
      delete state.requirementSources.columns[color.id];
      state.pieces = state.pieces.filter((piece) => piece.color !== color.id);
      render();
    });
    $("colorList").appendChild(item);
  }
}

function renderTools() {
  const tools = [
    { type: "empty", label: "空マス" },
    { type: "blocked", label: "置けないマス" },
    ...state.colors.map((color) => ({ type: "fixed", color: color.id, label: `固定: ${color.label}` })),
  ];
  $("toolList").innerHTML = "";
  for (const tool of tools) {
    const button = document.createElement("button");
    const active = state.tool.type === tool.type && state.tool.color === (tool.color || null);
    button.className = `tool-button${active ? " active" : ""}`;
    button.textContent = tool.label;
    button.addEventListener("click", () => {
      state.tool = { type: tool.type, color: tool.color || null };
      renderTools();
    });
    $("toolList").appendChild(button);
  }
}

function renderBoard() {
  $("boardSizeLabel").textContent = `${state.board.width} x ${state.board.height}`;
  const grid = $("boardGrid");
  grid.style.gridTemplateColumns = `repeat(${state.board.width}, var(--cell))`;
  grid.innerHTML = "";
  for (let y = 0; y < state.board.height; y++) {
    for (let x = 0; x < state.board.width; x++) {
      const cell = state.board.cells[y][x];
      const div = document.createElement("div");
      div.className = `cell ${cell === "blocked" ? "blocked" : ""} ${fixedColor(cell) ? "fixed" : ""}`;
      const color = fixedColor(cell);
      if (color) div.style.background = colorById(color)?.hex || "#ddd";
      div.addEventListener("click", () => {
        if (state.tool.type === "empty") state.board.cells[y][x] = "empty";
        if (state.tool.type === "blocked") state.board.cells[y][x] = "blocked";
        if (state.tool.type === "fixed") state.board.cells[y][x] = `fixed:${state.tool.color}`;
        renderBoard();
      });
      grid.appendChild(div);
    }
  }
}

function renderRequirements() {
  ensureRequirements();
  renderBulkRequirements();
  const cols = $("columnRequirements");
  cols.style.gridTemplateColumns = "";
  cols.innerHTML = "";
  for (const color of state.colors) {
    const row = document.createElement("div");
    row.className = "req-axis-row";
    row.style.gridTemplateColumns = `repeat(${state.board.width}, var(--cell)) max-content`;
    for (let x = 0; x < state.board.width; x++) {
      row.appendChild(requirementInput("columns", color.id, x));
    }
    row.appendChild(requirementAxisColorLockButton("columns", color.id));
    cols.appendChild(row);
  }

  const rows = $("rowRequirements");
  rows.style.gridTemplateRows = "";
  rows.innerHTML = "";
  for (const color of state.colors) {
    const column = document.createElement("div");
    column.className = "req-axis-column";
    column.style.gridTemplateRows = `repeat(${state.board.height}, var(--cell)) max-content`;
    for (let y = 0; y < state.board.height; y++) {
      column.appendChild(requirementInput("rows", color.id, y));
    }
    column.appendChild(requirementAxisColorLockButton("rows", color.id));
    rows.appendChild(column);
  }
}

function renderBulkRequirements() {
  const wrap = $("bulkRequirements");
  wrap.innerHTML = "";
  for (const color of state.colors) {
    const card = document.createElement("div");
    card.className = "bulk-req-card";
    card.innerHTML = `
      <strong style="color:${color.hex}">${escapeHtml(color.label)}</strong>
      <label>行条件<input data-axis="rows" value="${state.requirements.rows[color.id].join(",")}" /></label>
      <label>列条件<input data-axis="columns" value="${state.requirements.columns[color.id].join(",")}" /></label>
      <button>反映</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      for (const axis of ["rows", "columns"]) {
        const input = card.querySelector(`[data-axis="${axis}"]`);
        const expected = axis === "rows" ? state.board.height : state.board.width;
        const values = parseCountList(input.value, expected);
        state.requirements[axis][color.id] = values;
        state.requirementLocks[axis][color.id] = Array(expected).fill(true);
        state.requirementSources[axis][color.id] = Array(expected).fill("user");
      }
      renderRequirements();
      renderDiagnostics();
      renderBarCandidatePanel();
    });
    wrap.appendChild(card);
  }
}

function requirementInput(axis, colorId, index) {
  const button = document.createElement("button");
  const max = axis === "rows" ? state.board.width : state.board.height;
  const color = colorById(colorId);
  const value = state.requirements[axis][colorId][index] || 0;
  const locked = Boolean(state.requirementLocks[axis][colorId]?.[index]);
  const source = requirementSource(axis, colorId, index);
  button.type = "button";
  button.className = `req-chip ${requirementSourceClass(source, locked)}`;
  button.style.borderColor = color?.hex || "";
  button.style.setProperty("--req-color", color?.hex || "#fffa00");
  button.textContent = String(value);
  button.title = `${colorLabel(colorId)} ${axis === "rows" ? "行" : "列"} ${index + 1} / ${requirementSourceLabel(source, locked)}。クリックで+1、Shiftクリック/右クリックで-1。触ると確定します。`;
  button.addEventListener("click", (event) => {
    adjustRequirementChip(axis, colorId, index, event.shiftKey ? -1 : 1, max);
  });
  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    adjustRequirementChip(axis, colorId, index, -1, max);
  });
  return button;
}

function requirementAxisColorLockButton(axis, colorId) {
  const button = document.createElement("button");
  const locked = requirementAxisColorLocked(axis, colorId);
  const color = colorById(colorId);
  button.type = "button";
  button.className = `req-axis-lock ${locked ? "locked" : ""}`;
  button.style.borderColor = color?.hex || "";
  button.style.setProperty("--req-color", color?.hex || "#fffa00");
  button.textContent = `${colorLabel(colorId)}${axis === "rows" ? "行確定" : "列確定"}`;
  button.title = `${colorLabel(colorId)}の${axis === "rows" ? "行条件" : "列条件"}をまとめて${locked ? "未確定に戻す" : "確定する"}`;
  button.addEventListener("click", () => toggleRequirementAxisColorLock(axis, colorId));
  return button;
}

function requirementAxisColorLocked(axis, colorId) {
  ensureRequirements();
  const length = axis === "rows" ? state.board.height : state.board.width;
  return Array.from({ length }, (_, index) => Boolean(state.requirementLocks[axis][colorId]?.[index])).every(Boolean);
}

function toggleRequirementAxisColorLock(axis, colorId) {
  ensureRequirements();
  const nextLocked = !requirementAxisColorLocked(axis, colorId);
  const length = axis === "rows" ? state.board.height : state.board.width;
  for (let index = 0; index < length; index++) {
    state.requirementLocks[axis][colorId][index] = nextLocked;
    state.requirementSources[axis][colorId][index] = nextLocked ? "user" : "detected";
  }
  state.inferredRequirementCandidates = [];
  state.inferredRequirementIndex = 0;
  state.solutions = [];
  state.solutionIndex = 0;
  state.analysis.inferredBars = {
    ok: false,
    reason: nextLocked ? "axis_color_locked" : "axis_color_unlocked",
    message: `${colorLabel(colorId)}の${axis === "rows" ? "行条件" : "列条件"}を${nextLocked ? "確定" : "未確定に戻"}しました。`,
  };
  renderRequirements();
  renderDiagnostics();
  renderBarCandidatePanel();
  renderSolution();
  const box = $("statusBox");
  if (box) {
    box.className = "status";
    box.textContent = `${colorLabel(colorId)}の${axis === "rows" ? "行" : "列"}を${nextLocked ? "ロック" : "未確定に戻"}しました。準備ができたら「RUN PROTOCOL」を押してください。`;
  }
}

function adjustRequirementChip(axis, colorId, index, delta, max) {
  ensureRequirements();
  state.requirements[axis][colorId][index] = Math.max(0, Math.min(max, (state.requirements[axis][colorId][index] || 0) + delta));
  state.requirementLocks[axis][colorId][index] = true;
  state.requirementSources[axis][colorId][index] = "user";
  state.inferredRequirementCandidates = [];
  state.inferredRequirementIndex = 0;
  state.solutions = [];
  state.solutionIndex = 0;
  state.analysis.inferredBars = { ok: false, reason: "locked_adjust", message: "ロックしたバーを変更しました。" };
  renderRequirements();
  renderDiagnostics();
  renderBarCandidatePanel();
  renderSolution();
  const box = $("statusBox");
  if (box) {
    box.className = "status";
    box.textContent = "このバーをロックしました。準備ができたら「RUN PROTOCOL」を押してください。";
  }
}

function renderPieces() {
  const list = $("pieceList");
  list.innerHTML = "";
  for (const piece of state.pieces) {
    const pieceNumber = state.pieces.indexOf(piece) + 1;
    const candidateCard = state.pieceCandidatesByCard?.find((entry) => entry.pieceId === piece.id);
    const card = document.createElement("div");
    card.className = "piece-card";
    card.innerHTML = `
      <span class="piece-index">ピース ${pieceNumber}</span>
      <div class="piece-head">
        <label>色<select></select></label>
        <button>削除</button>
      </div>
      <div class="piece-source-preview"></div>
      <div class="piece-grid"></div>
      <div class="piece-candidate-tools"></div>
      <div class="piece-tools">
        <button data-action="wider">横+1</button>
        <button data-action="taller">縦+1</button>
        <button data-action="add">ピースを追加</button>
      </div>
    `;
    const select = card.querySelector("select");
    for (const color of state.colors) {
      const option = document.createElement("option");
      option.value = color.id;
      option.textContent = color.label;
      option.selected = color.id === piece.color;
      select.appendChild(option);
    }
    select.addEventListener("change", () => {
      piece.color = select.value;
      renderPieces();
    });
    card.querySelector(".piece-head button").addEventListener("click", () => {
      state.pieces = state.pieces.filter((entry) => entry !== piece);
      renderPieces();
    });
    renderPieceSourcePreview(card.querySelector(".piece-source-preview"), candidateCard);
    renderPieceGrid(card.querySelector(".piece-grid"), piece);
    renderPieceCandidateTools(card.querySelector(".piece-candidate-tools"), candidateCard);
    card.querySelector('[data-action="wider"]').addEventListener("click", () => {
      piece.cells.forEach((row) => row.push(0));
      renderPieces();
    });
    card.querySelector('[data-action="taller"]').addEventListener("click", () => {
      piece.cells.push(Array(piece.cells[0].length).fill(0));
      renderPieces();
    });
    card.querySelector('[data-action="add"]').addEventListener("click", () => addPiece());
    list.appendChild(card);
  }
  renderDiagnostics();
}

function renderPieceSourcePreview(container, candidateCard) {
  if (!candidateCard?.crop) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  container.innerHTML = `
    <span>画像</span>
    <img src="${candidateCard.crop}" alt="検出元のピース切り取り" />
  `;
}

function renderPieceCandidateTools(container, candidateCard) {
  container.hidden = true;
  container.innerHTML = "";
}

function switchPieceCandidate(cardId, delta) {
  const card = state.pieceCandidatesByCard.find((entry) => entry.cardId === cardId);
  if (!card || !card.candidates.length) return;
  card.selectedIndex = (card.selectedIndex + delta + card.candidates.length) % card.candidates.length;
  card.locked = true;
  applyPieceCandidatesToState();
  state.solutions = [];
  state.solutionIndex = 0;
  renderPieces();
  renderDiagnostics();
  renderSolution();
}

function renderPieceGrid(container, piece) {
  container.style.gridTemplateColumns = `repeat(${piece.cells[0].length}, 28px)`;
  for (let y = 0; y < piece.cells.length; y++) {
    for (let x = 0; x < piece.cells[0].length; x++) {
      const cell = document.createElement("div");
      cell.className = `piece-cell ${piece.cells[y][x] ? "" : "off"}`;
      if (piece.cells[y][x]) cell.style.background = colorById(piece.color)?.hex || "#ddd";
      cell.addEventListener("click", () => {
        piece.cells[y][x] = piece.cells[y][x] ? 0 : 1;
        renderPieces();
      });
      container.appendChild(cell);
    }
  }
}

function renderSolution() {
  $("solutionLabel").textContent = `${state.solutions.length ? state.solutionIndex + 1 : 0} / ${state.solutions.length}`;
  const grid = $("solutionGrid");
  grid.innerHTML = "";
  grid.style.gridTemplateColumns = `repeat(${state.board.width}, var(--cell))`;
  const solution = state.solutions[state.solutionIndex];
  const pieceAt = (x, y) => solution?.board[y]?.[x]?.pieceKey || null;
  for (let y = 0; y < state.board.height; y++) {
    for (let x = 0; x < state.board.width; x++) {
      const div = document.createElement("div");
      div.className = "solution-cell";
      const base = state.board.cells[y][x];
      if (base === "blocked") div.classList.add("blocked");
      const fixed = fixedColor(base);
      if (fixed) {
        div.classList.add("fixed");
        div.style.background = colorById(fixed)?.hex || "#ddd";
      }
      if (solution?.board[y][x]?.color) {
        div.classList.add("placed");
        div.style.background = colorById(solution.board[y][x].color)?.hex || "#ddd";
        const currentPiece = pieceAt(x, y);
        if (currentPiece) {
          if (pieceAt(x, y - 1) !== currentPiece) div.classList.add("edge-top");
          if (pieceAt(x + 1, y) !== currentPiece) div.classList.add("edge-right");
          if (pieceAt(x, y + 1) !== currentPiece) div.classList.add("edge-bottom");
          if (pieceAt(x - 1, y) !== currentPiece) div.classList.add("edge-left");
        }
      }
      grid.appendChild(div);
    }
  }
}

function renderDiagnostics() {
  const box = $("diagnosticsBox");
  if (!box) return;
  ensureRequirements();
  const rows = [];
  if (state.analysis.board) {
    rows.push(`
      <div class="diagnostic-row diagnostic-wide">
        <strong>盤面</strong>
        <span>信頼度 ${state.analysis.board.confidence || "不明"} / 不可 ${state.analysis.board.blockedCount ?? "-"} / 固定 ${state.analysis.board.fixedCount ?? "-"}${state.analysis.board.notes?.length ? ` / ${escapeHtml(state.analysis.board.notes.join(" / "))}` : ""}</span>
      </div>
    `);
  }
  for (const color of state.colors) {
    const rowTotal = sum(state.requirements.rows[color.id] || []);
    const columnTotal = sum(state.requirements.columns[color.id] || []);
    const pieceTotal = state.pieces
      .filter((piece) => piece.color === color.id)
      .reduce((acc, piece) => acc + sum(piece.cells.flat()), 0);
    const fixedTotal = state.board.cells.flat().filter((cell) => fixedColor(cell) === color.id).length;
    const requiredPieceTotal = Math.max(0, rowTotal - fixedTotal);
    const barDiff = rowTotal - columnTotal;
    const pieceDiff = requiredPieceTotal - pieceTotal;
    const ok = barDiff === 0 && pieceDiff === 0;
    rows.push(`
      <div class="diagnostic-row ${ok ? "ok" : "warn"}">
        <strong style="color:${color.hex}">${escapeHtml(color.label)}</strong>
        <span>${ok ? "OK" : "要確認"} / 行 ${rowTotal} / 列 ${columnTotal}${barDiff ? ` / バー差 ${barDiff > 0 ? "+" : ""}${barDiff}` : ""} / 固定 ${fixedTotal} / 必要ピース ${requiredPieceTotal} / ピース合計 ${pieceTotal}${pieceDiff && !barDiff ? ` / ピース差 ${pieceDiff > 0 ? "+" : ""}${pieceDiff}` : ""}</span>
      </div>
    `);
  }
  const guide = correctionGuide();
  if (guide.length) {
    rows.push(`
      <div class="diagnostic-row diagnostic-wide warn">
        <strong>次</strong>
        <span>${escapeHtml(guide.join(" / "))}</span>
      </div>
    `);
  }
  if (state.analysis.bars?.length) {
    const detail = state.analysis.bars
      .map((entry) => `${entry.label}:上${entry.topBars ?? "-"}本/左${entry.leftBars ?? "-"}本`)
      .join("、");
    rows.push(`
      <div class="diagnostic-row diagnostic-wide">
        <strong>バー</strong>
        <span>${escapeHtml(detail)}</span>
      </div>
    `);
  }
  if (state.analysis.inferredBars) {
    const inferred = state.analysis.inferredBars;
    const text = inferred.ok
      ? `採用 ${inferred.adoptedIndex}/${inferred.candidateCount} / 確認 ${inferred.searched} / スコア ${Number(inferred.score || 0).toFixed(1)}`
      : inferred.solvedCandidateCount
        ? `答えあり ${inferred.solvedCandidateCount} / 下書き ${inferred.candidateCount}`
      : inferred.candidateCount
        ? `下書き ${inferred.candidateCount} / 確認 ${inferred.searched || 0} / ${inferred.reason || "未採用"}`
        : inferred.message || inferred.reason || "下書きなし";
    rows.push(`
      <div class="diagnostic-row diagnostic-wide ${inferred.ok ? "ok" : "warn"}">
        <strong>バー補完</strong>
        <span>${escapeHtml(text)}</span>
      </div>
    `);
  }
  if (state.analysis.pieces) {
    const suspicious = Object.entries(state.analysis.pieces.byColor || {})
      .map(([colorId, entry]) => {
        const color = colorById(colorId);
        if (!entry.pieces) return null;
        return `${color?.label || colorId}:${entry.pieces}個/${entry.cells}マス${entry.lowConfidence ? `/要確認${entry.lowConfidence}` : ""}`;
      })
      .filter(Boolean)
      .join("、");
    rows.push(`
      <div class="diagnostic-row diagnostic-wide">
        <strong>ピース</strong>
        <span>カード ${state.analysis.pieces.cardCount} / ${escapeHtml(suspicious || "読み取りなし")}${state.analysis.pieces.skipped?.length ? ` / 読み飛ばし ${state.analysis.pieces.skipped.length}` : ""}</span>
      </div>
    `);
  }
  const lockedSummary = lockedRequirementSummary();
  if (lockedSummary) {
    rows.push(`
      <div class="diagnostic-row diagnostic-wide ok">
        <strong>確定</strong>
        <span>${escapeHtml(lockedSummary)}</span>
      </div>
    `);
  }
  box.innerHTML = rows.join("");
}

function lockedRequirementSummary() {
  ensureRequirements();
  const parts = [];
  for (const color of state.colors) {
    const rowLocked = (state.requirementLocks.rows[color.id] || []).reduce((acc, locked) => acc + (locked ? 1 : 0), 0);
    const colLocked = (state.requirementLocks.columns[color.id] || []).reduce((acc, locked) => acc + (locked ? 1 : 0), 0);
    if (rowLocked || colLocked) parts.push(`${color.label}:行${rowLocked}/列${colLocked}`);
  }
  return parts.join("、");
}

function correctionGuide() {
  ensureRequirements();
  const guides = [];
  for (const color of state.colors) {
    const target = targetRequirementTotal(color.id);
    const rowTotal = sum(state.requirements.rows[color.id] || []);
    const columnTotal = sum(state.requirements.columns[color.id] || []);
    const rowLockedTotal = sum((state.requirements.rows[color.id] || []).map((value, index) => (state.requirementLocks.rows[color.id]?.[index] ? value : 0)));
    const columnLockedTotal = sum((state.requirements.columns[color.id] || []).map((value, index) => (state.requirementLocks.columns[color.id]?.[index] ? value : 0)));
    if (rowLockedTotal > target) {
      guides.push(`${color.label}: 確定済みの行が${rowLockedTotal - target}多い`);
      continue;
    }
    if (columnLockedTotal > target) {
      guides.push(`${color.label}: 確定済みの列が${columnLockedTotal - target}多い`);
      continue;
    }
    const rowNeed = target - rowTotal;
    const columnNeed = target - columnTotal;
    if (rowNeed || columnNeed) {
      const parts = [];
      if (rowNeed) parts.push(`行側${signedCount(rowNeed)}`);
      if (columnNeed) parts.push(`列側${signedCount(columnNeed)}`);
      guides.push(`${color.label}: ${parts.join("、")}で目標${target}`);
    }
  }
  return guides;
}

function signedCount(value) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function targetRequirementTotal(colorId) {
  const fixedTotal = state.board.cells.flat().filter((cell) => fixedColor(cell) === colorId).length;
  const pieceTotal = state.pieces
    .filter((piece) => piece.color === colorId)
    .reduce((acc, piece) => acc + sum(piece.cells.flat()), 0);
  return fixedTotal + pieceTotal;
}

function requirementSource(axis, colorId, index) {
  ensureRequirements();
  if (state.requirementLocks[axis][colorId]?.[index]) return "user";
  return state.requirementSources[axis][colorId]?.[index] || "empty";
}

function requirementSourceClass(source, locked) {
  if (locked || source === "user") return "locked user";
  if (source === "detected") return "detected";
  if (source === "inferred") return "inferred";
  return "auto empty";
}

function requirementSourceLabel(source, locked) {
  if (locked || source === "user") return "ユーザー確定";
  if (source === "detected") return "画像参考";
  if (source === "inferred") return "自動補完";
  return "未確定";
}

function renderBarCandidatePanel() {
  const panel = $("barCandidatePanel");
  if (!panel) return;
  if (state.solutionMode === "placements" && state.solutions.some((solution) => solution.requirements)) {
    const current = state.solutions[state.solutionIndex];
    panel.innerHTML = `
      <div class="bar-candidate-head">
        <strong>解候補から生成したバー</strong>
        <div class="bar-candidate-nav">
          <button data-action="solution-prev" ${state.solutions.length <= 1 ? "disabled" : ""}>前</button>
          <span>${state.solutions.length ? `${state.solutionIndex + 1} / ${state.solutions.length}` : "0 / 0"}</span>
          <button data-action="solution-next" ${state.solutions.length <= 1 ? "disabled" : ""}>次</button>
        </div>
      </div>
      <div class="bar-candidate-note">${escapeHtml(current?.note || "盤面とピースだけから配置候補を作り、バーを後から計算しました。")}</div>
      <div class="bar-editor">
        ${state.colors.map((color) => renderBarEditorColor(color)).join("")}
      </div>
    `;
    panel.querySelector('[data-action="solution-prev"]')?.addEventListener("click", () => moveSolution(-1));
    panel.querySelector('[data-action="solution-next"]')?.addEventListener("click", () => moveSolution(1));
    panel.querySelectorAll("[data-bar-axis]").forEach((button) => {
      button.addEventListener("click", () => {
        const axis = button.dataset.barAxis;
        const color = button.dataset.barColor;
        const index = Number(button.dataset.barIndex);
        const delta = Number(button.dataset.barDelta);
        adjustRequirementCount(axis, color, index, delta);
      });
    });
    return;
  }
  const hasRequirements = state.colors.some((color) => sum(state.requirements.rows[color.id] || []) || sum(state.requirements.columns[color.id] || []));
  if (!hasRequirements) {
    panel.innerHTML = "";
    return;
  }
  const candidateCount = state.inferredRequirementCandidates.length;
  const currentIndex = candidateCount ? state.inferredRequirementIndex : -1;
  panel.innerHTML = `
    <div class="bar-candidate-head">
      <strong>バー候補</strong>
      <div class="bar-candidate-nav">
        <button data-action="candidate-prev" ${candidateCount <= 1 ? "disabled" : ""}>前</button>
        <span>${candidateCount ? `${currentIndex + 1} / ${candidateCount}` : "手動"}</span>
        <button data-action="candidate-next" ${candidateCount <= 1 ? "disabled" : ""}>次</button>
      </div>
    </div>
    <div class="bar-candidate-note">${escapeHtml(candidateCount ? state.inferredRequirementCandidates[currentIndex]?.note || "" : "バーを直接補正できます。")}</div>
    <div class="bar-editor">
      ${state.colors.map((color) => renderBarEditorColor(color)).join("")}
    </div>
  `;
  panel.querySelector('[data-action="candidate-prev"]')?.addEventListener("click", () => {
    if (!candidateCount) return;
    const next = (state.inferredRequirementIndex - 1 + candidateCount) % candidateCount;
    applyInferredRequirementCandidate(next);
  });
  panel.querySelector('[data-action="candidate-next"]')?.addEventListener("click", () => {
    if (!candidateCount) return;
    const next = (state.inferredRequirementIndex + 1) % candidateCount;
    applyInferredRequirementCandidate(next);
  });
  panel.querySelectorAll("[data-bar-axis]").forEach((button) => {
    button.addEventListener("click", () => {
      const axis = button.dataset.barAxis;
      const color = button.dataset.barColor;
      const index = Number(button.dataset.barIndex);
      const delta = Number(button.dataset.barDelta);
      adjustRequirementCount(axis, color, index, delta);
    });
  });
}

function renderBarEditorColor(color) {
  const rows = state.requirements.rows[color.id] || [];
  const columns = state.requirements.columns[color.id] || [];
  const rowTotal = sum(rows);
  const columnTotal = sum(columns);
  const diff = rowTotal - columnTotal;
  const target = targetRequirementTotal(color.id);
  return `
    <div class="bar-editor-color ${diff ? "warn" : "ok"}">
      <div class="bar-editor-title">
        <strong style="color:${color.hex}">${escapeHtml(color.label)}</strong>
        <span>行${rowTotal} / 列${columnTotal} / 目標${target}${diff ? ` / 差${diff > 0 ? "+" : ""}${diff}` : ""}</span>
      </div>
      <div class="bar-axis-block">
        <span>行</span>
        ${rows.map((value, index) => renderBarCountControl("rows", color, index, value)).join("")}
      </div>
      <div class="bar-axis-block">
        <span>列</span>
        ${columns.map((value, index) => renderBarCountControl("columns", color, index, value)).join("")}
      </div>
    </div>
  `;
}

function renderBarCountControl(axis, color, index, value) {
  const locked = Boolean(state.requirementLocks[axis][color.id]?.[index]);
  const source = requirementSource(axis, color.id, index);
  return `
    <div class="bar-count-control ${requirementSourceClass(source, locked)}" title="${color.label} ${axis === "rows" ? "行" : "列"}${index + 1} / ${requirementSourceLabel(source, locked)}">
      <button data-bar-axis="${axis}" data-bar-color="${color.id}" data-bar-index="${index}" data-bar-delta="-1">-</button>
      <strong style="color:${color.hex}">${value}</strong>
      <button data-bar-axis="${axis}" data-bar-color="${color.id}" data-bar-index="${index}" data-bar-delta="1">+</button>
    </div>
  `;
}

function adjustRequirementCount(axis, colorId, index, delta) {
  ensureRequirements();
  const max = axis === "rows" ? state.board.width : state.board.height;
  const list = state.requirements[axis][colorId];
  list[index] = Math.max(0, Math.min(max, (list[index] || 0) + delta));
  state.requirementLocks[axis][colorId][index] = true;
  state.requirementSources[axis][colorId][index] = "user";
  state.inferredRequirementCandidates = [];
  state.inferredRequirementIndex = 0;
  state.analysis.inferredBars = {
    ok: false,
    reason: "manual_adjust",
    message: "バーを手動補正しました。",
  };
  state.solutions = [];
  state.solutionIndex = 0;
  renderRequirements();
  renderDiagnostics();
  renderBarCandidatePanel();
  $("statusBox").className = "status";
  $("statusBox").textContent = "バーを補正しました。準備ができたら「RUN PROTOCOL」を押してください。";
  renderSolution();
}


function recognitionHealth() {
  ensureRequirements();
  const barBad = [];
  const pieceBad = [];
  const lowPieces = [];
  for (const color of state.colors) {
    const rowTotal = sum(state.requirements.rows[color.id] || []);
    const columnTotal = sum(state.requirements.columns[color.id] || []);
    const fixedTotal = state.board.cells.flat().filter((cell) => fixedColor(cell) === color.id).length;
    const requiredPieceTotal = Math.max(0, rowTotal - fixedTotal);
    const pieceTotal = state.pieces
      .filter((piece) => piece.color === color.id)
      .reduce((acc, piece) => acc + sum(piece.cells.flat()), 0);
    const pieceEntry = state.analysis.pieces?.byColor?.[color.id];
    const barEntry = state.analysis.bars?.find((entry) => entry.color === color.id);
    if (rowTotal !== columnTotal) barBad.push(`${color.label}: 左バー${barEntry?.leftBars ?? "?"}本/上バー${barEntry?.topBars ?? "?"}本、行${rowTotal}/列${columnTotal}`);
    if (rowTotal === columnTotal && requiredPieceTotal !== pieceTotal) pieceBad.push(`${color.label}: 必要${requiredPieceTotal}/ピース${pieceTotal}`);
    if (pieceEntry?.lowConfidence) lowPieces.push(`${color.label}:${pieceEntry.lowConfidence}個`);
  }
  if (barBad.length) {
    return {
      ok: false,
      message: `バーの数字が合っていないようです。${barBad.join("、")}。黄色い枠の位置と、上バー・左バーの数字を見直してください。`,
    };
  }
  if (pieceBad.length) {
    return {
      ok: false,
      message: `ピースの合計がバーの数字と合っていません。${pieceBad.join("、")}。右側カードの形や小さいピースの見落としを確認してください。`,
    };
  }
  if (lowPieces.length) {
    return {
      ok: false,
      message: `形があいまいなピースがあります。${lowPieces.join("、")}。STEP5で形を見直して、違っていたらマスをクリックして直してください。`,
    };
  }
  return { ok: true, message: "デルタ解析の下書きは、そのまま実行できる状態です。" };
}

function addColor() {
  const index = state.colors.length + 1;
  const id = `color${index}`;
  state.colors.push({ id, label: `色${index}`, hex: randomColor(index) });
  ensureRequirements();
  render();
}

function addPiece(cells = createEmptyMatrix(3, 3), color = state.colors[0].id) {
  state.pieces.push({
    id: nextPieceId(),
    color,
    cells,
    rotation: true,
    mirror: false,
  });
  renderPieces();
}

function applyPieceCandidatesToState() {
  if (!state.pieceCandidatesByCard?.length) return;
  state.pieces = state.pieceCandidatesByCard.map((card, index) => {
    const candidate = card.candidates[card.selectedIndex] || card.candidates[0];
    const pieceId = card.pieceId || `auto-${index + 1}`;
    card.pieceId = pieceId;
    return {
      id: pieceId,
      color: candidate.color,
      cells: candidate.cells,
      rotation: true,
      mirror: false,
    };
  });
}

function createEmptyMatrix(width, height) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
}

function nextPieceId() {
  return `piece-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function solvePuzzle() {
  const started = performance.now();
  state.solutionMode = "requirements";
  try {
    const normalized = normalizePuzzle();
    const result = search(normalized, 100);
    state.solutions = result.solutions;
    state.solutionIndex = 0;
    $("statusBox").className = "status";
    $("statusBox").textContent = result.solutions.length
      ? `答えを ${result.solutions.length} 件見つけました。下の「演算結果」で確認できます。`
      : "答えが見つかりませんでした。バーの数字、固定マス、ピースの形をもう一度見直してください。";
  } catch (error) {
    state.solutions = [];
    $("statusBox").className = "status error";
    $("statusBox").textContent = error.message;
  }
  renderSolution();
  renderDiagnostics();
  renderBarCandidatePanel();
}

function solveSmart() {
  const started = performance.now();
  const pieceCandidateResult = solveWithPieceCandidateSets(started);
  if (pieceCandidateResult) return pieceCandidateResult;
  const inferred = solveWithInferredBars();
  renderRequirements();
  renderSolution();
  renderDiagnostics();
  renderBarCandidatePanel();
  if (inferred.ok) {
    $("statusBox").className = "status";
    $("statusBox").textContent = inferred.message;
    return inferred;
  }
  const guide = correctionGuide();
  if (guide.length) {
    const message = `まだ答えまで届いていません。次は ${guide.join(" / ")} を見直してください。`;
    $("statusBox").className = "status error";
    $("statusBox").textContent = message;
    return { ok: false, message };
  }

  const placementResult = solvePlacementsWithoutBars({
    limit: 40,
    collectLimit: 100,
    timeLimitMs: 1800,
    nodeLimit: 60000,
  });
  if (placementResult.ok && placementResult.solutions.length) {
    state.solutionMode = "placements";
    state.solutions = placementResult.solutions;
    state.solutionIndex = 0;
    applySolutionRequirements(0, false);
    state.analysis.inferredBars = {
      ok: true,
      reason: "placement_fallback",
      candidateCount: placementResult.solutions.length,
      searched: placementResult.nodes,
      score: placementResult.solutions[0].rankScore || 0,
      note: placementResult.solutions[0].note || "",
    };
    $("statusBox").className = "status";
    $("statusBox").textContent = `バーの数字が少し不安なので、ピース配置から答えを ${placementResult.solutions.length} 件作りました。演算結果で合いそうなものを確認してください。`;
    renderRequirements();
    renderSolution();
    renderDiagnostics();
    renderBarCandidatePanel();
    return { ok: true, message: $("statusBox").textContent };
  }
  const message = "答えが見つかりませんでした。盤面の黄色い枠、バーの数字、ピースの形を順番に見直してください。";
  $("statusBox").className = "status error";
  $("statusBox").textContent = message;
  return { ok: false, message };
}

function runSolveWithLoading() {
  const button = $("solveMainBtn");
  const box = $("statusBox");
  if (button) {
    button.disabled = true;
    button.classList.add("loading");
  }
  if (box) {
    box.className = "status loading";
    box.textContent = "デルタが配置を試しています。ピースが多い時は少しだけ待ってね。";
  }
  window.setTimeout(() => {
    try {
      solveSmart();
    } finally {
      if (button) {
        button.disabled = false;
        button.classList.remove("loading");
      }
    }
  }, 30);
}

function runAutoAnalyzeWithLoading() {
  const buttons = [$("autoAnalyzeInlineBtn"), $("autoAnalyzeBtn")].filter(Boolean);
  const box = $("statusBox");
  for (const button of buttons) {
    button.disabled = true;
    button.classList.add("loading");
  }
  if (box) {
    box.className = "status loading";
    box.textContent = "スクショを解析中です。盤面、バー、右側のピースを順番に読んでいます。";
  }
  window.setTimeout(() => {
    try {
      autoAnalyze();
    } finally {
      for (const button of buttons) {
        button.disabled = false;
        button.classList.remove("loading");
      }
    }
  }, 30);
}

function solveWithPieceCandidateSets(started = performance.now()) {
  const cards = state.pieceCandidatesByCard || [];
  if (!cards.length || !cards.some((card) => card.candidates.length > 1 && !card.locked)) return null;
  const originalPieces = state.pieces.map((piece) => ({ ...piece, cells: piece.cells.map((row) => row.slice()) }));
  const originalSelections = cards.map((card) => card.selectedIndex);
  const candidateSets = buildPieceCandidateSets(cards, 80);
  let tried = 0;
  for (const selection of candidateSets) {
    cards.forEach((card, index) => {
      if (!card.locked) card.selectedIndex = selection[index];
    });
    applyPieceCandidatesToState();
    const result = solveWithInferredBars();
    tried++;
    if (result.ok) {
      renderPieces();
      renderRequirements();
      renderDiagnostics();
      renderBarCandidatePanel();
      renderSolution();
      $("statusBox").className = "status";
      $("statusBox").textContent = `ピースの読み取りを ${tried} 通り試して、答えを見つけました。演算結果を確認してください。`;
      return { ok: true, message: $("statusBox").textContent };
    }
  }
  cards.forEach((card, index) => {
    card.selectedIndex = originalSelections[index] || 0;
  });
  state.pieces = originalPieces;
  return null;
}

function buildPieceCandidateSets(cards, limit) {
  const result = [];
  const current = cards.map((card) => card.selectedIndex || 0);
  function dfs(index, score) {
    if (result.length >= limit) return;
    if (index >= cards.length) {
      result.push({ selection: current.slice(), score });
      return;
    }
    const card = cards[index];
    if (card.locked) {
      current[index] = card.selectedIndex || 0;
      dfs(index + 1, score);
      return;
    }
    const order = card.candidates
      .map((candidate, candidateIndex) => ({ candidateIndex, score: candidate.score || 0 }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 4);
    for (const entry of order) {
      current[index] = entry.candidateIndex;
      dfs(index + 1, score + entry.score);
      if (result.length >= limit) return;
    }
  }
  dfs(0, 0);
  return result.sort((a, b) => a.score - b.score).slice(0, limit).map((entry) => entry.selection);
}

function solveWithInferredBars() {
  const started = performance.now();
  const originalRequirements = cloneRequirements(state.requirements);
  state.solutionMode = "requirements";
  try {
    const inference = inferRequirementsFromPiecesAndBars();
    if (!inference.ok) {
      state.analysis.inferredBars = inference;
      return inference;
    }
    const attempts = inference.candidates.slice(0, 200);
    let searched = 0;
    for (const candidate of attempts) {
      state.requirements = mergeRequirementsWithCurrentLocks(candidate.requirements);
      let normalized;
      try {
        normalized = normalizePuzzle();
      } catch {
        continue;
      }
      const result = search(normalized, 100);
      searched++;
      candidate.nodes = result.nodes;
      candidate.solutionCount = result.solutions.length;
      if (result.solutions.length) {
        applyRequirementsPreservingUsers(candidate.requirements, "inferred");
        state.solutions = result.solutions;
        state.solutionIndex = 0;
        state.analysis.inferredBars = {
          ok: true,
          adoptedIndex: 1,
          candidateCount: inference.candidates.length,
          searched,
          score: candidate.score,
          note: candidate.note,
        };
        collectAdditionalSolvedRequirementCandidates(attempts, searched, started);
        return {
          ok: true,
          message: `答えを見つけました。バーの読み取りが足りないところは、ピースの合計からデルタが補っています。演算結果を確認してください。`,
        };
      }
    }
    state.requirements = originalRequirements;
    state.solutions = [];
    state.solutionIndex = 0;
    state.analysis.inferredBars = {
      ok: false,
      candidateCount: inference.candidates.length,
      searched,
      reason: "no_solution",
    };
    state.inferredRequirementCandidates = attempts.slice(0, 12).map((candidate) => ({
      requirements: cloneRequirements(candidate.requirements),
      score: candidate.score,
      note: candidate.note,
      solutionCount: candidate.solutionCount || 0,
      nodes: candidate.nodes || 0,
    }));
    state.inferredRequirementIndex = 0;
    if (state.inferredRequirementCandidates.length) applyRequirementsPreservingUsers(state.inferredRequirementCandidates[0].requirements, "inferred");
    return {
      ok: false,
      message: `答えが見つかりませんでした。バーの数字、ピースの形、置けないマスを見直してから、もう一度「RUN PROTOCOL」を押してください。`,
    };
  } catch (error) {
    state.requirements = originalRequirements;
    state.solutions = [];
    state.solutionIndex = 0;
    state.analysis.inferredBars = { ok: false, reason: "error", message: error.message };
    return { ok: false, message: error.message };
  }
}

function solvePlacementsWithoutBars(options = {}) {
  const started = performance.now();
  const limit = options.limit || 100;
  const collectLimit = options.collectLimit || limit * 3;
  const timeLimitMs = options.timeLimitMs || 4000;
  const nodeLimit = options.nodeLimit || 120000;
  let puzzle;
  try {
    puzzle = normalizePlacementPuzzle();
  } catch (error) {
    return { ok: false, solutions: [], nodes: 0, message: error.message };
  }
  const occupied = new Set([...puzzle.blocked]);
  for (let y = 0; y < puzzle.height; y++) {
    for (let x = 0; x < puzzle.width; x++) {
      if (fixedColor(puzzle.fixedCells[y][x])) occupied.add(key(x, y));
    }
  }
  const boardMarks = Array.from({ length: puzzle.height }, (_, y) =>
    Array.from({ length: puzzle.width }, (_, x) => {
      const fixed = fixedColor(puzzle.fixedCells[y][x]);
      return fixed ? { color: fixed, pieceId: "fixed" } : null;
    }),
  );
  const solutions = [];
  const seen = new Set();
  let nodes = 0;
  const pieces = puzzle.pieces.map((piece, index) => ({ ...piece, index }));

  function dfs(remainingPieces) {
    nodes++;
    if (solutions.length >= collectLimit) return;
    if (nodes > nodeLimit || performance.now() - started > timeLimitMs) return;
    if (!remainingPieces.length) {
      const board = boardMarks.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
      const signature = solutionSignature(board);
      if (seen.has(signature)) return;
      const requirements = deriveRequirementsFromSolution({ board });
      if (!requirementsMatchLocks(requirements)) return;
      seen.add(signature);
      solutions.push({
        board,
        requirements,
        rankScore: rankSolutionByBarImage(requirements),
      });
      return;
    }
    const options = remainingPieces.map((piece) => ({
      piece,
      placements: placementsForNoBars(piece, puzzle, occupied),
    }));
    options.sort((a, b) => a.placements.length - b.placements.length);
    const chosen = options[0];
    if (!chosen || !chosen.placements.length) return;
    const nextPieces = remainingPieces.filter((piece) => piece !== chosen.piece);
    for (const placement of chosen.placements) {
      applyPlacementNoBars(placement, chosen.piece, occupied, boardMarks, -1);
      dfs(nextPieces);
      applyPlacementNoBars(placement, chosen.piece, occupied, boardMarks, 1);
      if (solutions.length >= collectLimit || nodes > nodeLimit || performance.now() - started > timeLimitMs) break;
    }
  }

  dfs(pieces);
  solutions.sort((a, b) => a.rankScore - b.rankScore);
  const ranked = solutions.slice(0, limit).map((solution, index) => ({
    ...solution,
    note: `候補${index + 1}: バー画像との差 ${solution.rankScore.toFixed(1)}`,
  }));
  return {
    ok: Boolean(ranked.length),
    solutions: ranked,
    nodes,
    message: ranked.length
      ? ""
      : "答え候補を作れませんでした。盤面、置けないマス、ピースの形を見直してください。",
  };
}

function normalizePlacementPuzzle() {
  ensureRequirements();
  const colors = new Set(state.colors.map((color) => color.id));
  const blocked = new Set();
  let emptyCells = 0;
  for (let y = 0; y < state.board.height; y++) {
    for (let x = 0; x < state.board.width; x++) {
      const cell = state.board.cells[y][x];
      if (cell === "blocked") blocked.add(key(x, y));
      else if (!fixedColor(cell)) emptyCells++;
    }
  }
  const pieces = state.pieces.map((piece) => {
    if (!colors.has(piece.color)) throw new Error(`登録されていない色のピースがあります: ${piece.color}`);
    if (!piece.cells.flat().some(Boolean)) throw new Error("空のピースがあります。形を入れるか削除してください。");
    return { ...piece, rotations: rotations(piece.cells) };
  });
  const pieceCells = pieces.reduce((acc, piece) => acc + sum(piece.cells.flat()), 0);
  if (pieceCells > emptyCells) {
    throw new Error(`ピース合計 ${pieceCells} マスが、置ける空きマス ${emptyCells} マスを超えています。`);
  }
  return {
    width: state.board.width,
    height: state.board.height,
    blocked,
    fixedCells: state.board.cells,
    pieces,
  };
}

function placementsForNoBars(piece, puzzle, occupied) {
  const result = [];
  for (const rotation of piece.rotations) {
    for (let y = 0; y <= puzzle.height - rotation.length; y++) {
      for (let x = 0; x <= puzzle.width - rotation[0].length; x++) {
        const cells = matrixCells(rotation).map((cell) => ({ x: x + cell.x, y: y + cell.y }));
        if (cells.some((cell) => occupied.has(key(cell.x, cell.y)))) continue;
        result.push({ cells, key: placementKey(piece.color, cells) });
      }
    }
  }
  return result;
}

function applyPlacementNoBars(placement, piece, occupied, boardMarks, sign) {
  for (const cell of placement.cells) {
    if (sign < 0) {
      occupied.add(key(cell.x, cell.y));
      boardMarks[cell.y][cell.x] = { color: piece.color, pieceKey: placement.key };
    } else {
      occupied.delete(key(cell.x, cell.y));
      boardMarks[cell.y][cell.x] = null;
    }
  }
}

function deriveRequirementsFromSolution(solution) {
  const requirements = emptyCounts();
  for (let y = 0; y < state.board.height; y++) {
    for (let x = 0; x < state.board.width; x++) {
      const fixed = fixedColor(state.board.cells[y][x]);
      const color = solution.board?.[y]?.[x]?.color || fixed;
      if (!color || !requirements.rows[color]) continue;
      requirements.rows[color][y]++;
      requirements.columns[color][x]++;
    }
  }
  return requirements;
}

function rankSolutionByBarImage(requirements) {
  let score = 0;
  for (const color of state.colors) {
    for (const axis of ["rows", "columns"]) {
      const values = requirements[axis][color.id] || [];
      const observed = observedRequirementValues(axis, color.id, values.length);
      const locks = resizeArray(state.requirementLocks[axis][color.id] || [], values.length).map(Boolean);
      for (let index = 0; index < values.length; index++) {
        if (locks[index] && values[index] !== (state.requirements[axis][color.id][index] || 0)) return Number.POSITIVE_INFINITY;
        const diff = values[index] - (observed[index] || 0);
        score += diff * diff;
      }
    }
  }
  return score;
}

function observedRequirementValues(axis, colorId, length) {
  const raw = state.analysis.rawBarCandidates?.[axis]?.[colorId];
  if (raw) return resizeArray(raw, length);
  return resizeArray(state.requirements[axis]?.[colorId] || [], length);
}

function requirementsMatchLocks(requirements) {
  for (const color of state.colors) {
    for (const axis of ["rows", "columns"]) {
      const values = requirements[axis][color.id] || [];
      const locks = resizeArray(state.requirementLocks[axis][color.id] || [], values.length).map(Boolean);
      for (let index = 0; index < values.length; index++) {
        if (locks[index] && values[index] !== (state.requirements[axis][color.id][index] || 0)) return false;
      }
    }
  }
  return true;
}

function applySolutionRequirements(index, renderAll = true) {
  const solution = state.solutions[index];
  if (!solution?.requirements) return;
  state.solutionIndex = index;
  applyRequirementsPreservingUsers(solution.requirements, "inferred");
  if (renderAll) {
    renderRequirements();
    renderSolution();
    renderDiagnostics();
    renderBarCandidatePanel();
  }
}

function moveSolution(delta) {
  if (!state.solutions.length) return;
  const next = (state.solutionIndex + delta + state.solutions.length) % state.solutions.length;
  if (state.solutionMode === "placements" && state.solutions[next]?.requirements) {
    applySolutionRequirements(next);
    return;
  }
  state.solutionIndex = next;
  renderSolution();
  renderBarCandidatePanel();
}

function collectAdditionalSolvedRequirementCandidates(attempts, alreadySearched, started) {
  const solved = [];
  for (const candidate of attempts) {
    if (candidate.solutionCount > 0) {
      solved.push(candidate);
      continue;
    }
    if (solved.length >= 8 || performance.now() - started > 4200) break;
    let normalized;
    try {
      normalized = normalizePuzzle(candidate.requirements);
    } catch {
      continue;
    }
    const result = search(normalized, 20);
    candidate.nodes = result.nodes;
    candidate.solutionCount = result.solutions.length;
    if (result.solutions.length) {
      candidate.previewSolutions = result.solutions;
      solved.push(candidate);
    }
  }
  solved.sort((a, b) => a.score - b.score);
  state.inferredRequirementCandidates = solved.slice(0, 12).map((candidate) => ({
    requirements: cloneRequirements(candidate.requirements),
    score: candidate.score,
    note: candidate.note,
    solutionCount: candidate.solutionCount || 0,
    nodes: candidate.nodes || 0,
  }));
  state.inferredRequirementIndex = 0;
  if (state.inferredRequirementCandidates.length) {
    applyRequirementsPreservingUsers(state.inferredRequirementCandidates[0].requirements, "inferred");
    try {
      const normalized = normalizePuzzle(state.requirements);
      const result = search(normalized, 100);
      state.solutions = result.solutions;
      state.solutionIndex = 0;
      state.inferredRequirementCandidates[0].solutionCount = result.solutions.length;
      state.inferredRequirementCandidates[0].nodes = result.nodes;
    } catch {
      state.solutions = [];
      state.solutionIndex = 0;
    }
  }
  state.analysis.inferredBars = {
    ...(state.analysis.inferredBars || {}),
    ok: Boolean(state.inferredRequirementCandidates.length),
    adoptedIndex: 1,
    candidateCount: attempts.length,
    solvedCandidateCount: state.inferredRequirementCandidates.length,
    searched: alreadySearched,
  };
}

function applyInferredRequirementCandidate(index, solve = true) {
  const candidate = state.inferredRequirementCandidates[index];
  if (!candidate) return;
  state.inferredRequirementIndex = index;
  applyRequirementsPreservingUsers(candidate.requirements, "inferred");
  state.solutions = [];
  state.solutionIndex = 0;
  if (solve) solvePuzzle();
  renderRequirements();
  renderDiagnostics();
  renderBarCandidatePanel();
}

function mergeRequirementsWithCurrentLocks(candidateRequirements) {
  ensureRequirements();
  const merged = cloneRequirements(candidateRequirements);
  for (const color of state.colors) {
    for (const axis of ["rows", "columns"]) {
      const values = resizeArray(merged[axis][color.id] || [], state.requirements[axis][color.id].length);
      merged[axis][color.id] = values.map((value, index) =>
        state.requirementLocks[axis][color.id]?.[index] ? state.requirements[axis][color.id][index] || 0 : value || 0,
      );
    }
  }
  return merged;
}

function applyRequirementsPreservingUsers(candidateRequirements, source = "inferred") {
  ensureRequirements();
  state.requirements = mergeRequirementsWithCurrentLocks(candidateRequirements);
  for (const color of state.colors) {
    for (const axis of ["rows", "columns"]) {
      const values = resizeArray(candidateRequirements[axis]?.[color.id] || [], state.requirements[axis][color.id].length);
      for (let index = 0; index < values.length; index++) {
        state.requirementSources[axis][color.id][index] = state.requirementLocks[axis][color.id]?.[index] ? "user" : source;
      }
    }
  }
}

function normalizePuzzle(requirements = state.requirements) {
  ensureRequirements();
  const colors = new Set(state.colors.map((color) => color.id));
  const fixedCounts = emptyCounts();
  const blocked = new Set();
  for (let y = 0; y < state.board.height; y++) {
    for (let x = 0; x < state.board.width; x++) {
      const cell = state.board.cells[y][x];
      if (cell === "blocked") blocked.add(key(x, y));
      const color = fixedColor(cell);
      if (color) {
        if (!colors.has(color)) throw new Error(`不明な固定色: ${colorLabel(color)}`);
        fixedCounts.rows[color][y]++;
        fixedCounts.columns[color][x]++;
      }
    }
  }
  const remaining = emptyCounts();
  for (const color of colors) {
    for (let y = 0; y < state.board.height; y++) {
      remaining.rows[color][y] = (requirements.rows[color]?.[y] || 0) - fixedCounts.rows[color][y];
      if (remaining.rows[color][y] < 0) throw new Error(`${colorLabel(color)} の行${y + 1}は固定マスが条件を超えています`);
    }
    for (let x = 0; x < state.board.width; x++) {
      remaining.columns[color][x] = (requirements.columns[color]?.[x] || 0) - fixedCounts.columns[color][x];
      if (remaining.columns[color][x] < 0) throw new Error(`${colorLabel(color)} の列${x + 1}は固定マスが条件を超えています`);
    }
  }
  for (const piece of state.pieces) {
    if (!colors.has(piece.color)) throw new Error(`登録されていない色のピースがあります。`);
    if (!piece.cells.flat().some(Boolean)) throw new Error(`空のピースがあります。形を1マス以上塗るか、削除してください。`);
  }
  for (const color of colors) {
    const needed = sum(remaining.rows[color]);
    const byColumns = sum(remaining.columns[color]);
    const pieceCells = state.pieces.filter((piece) => piece.color === color).reduce((acc, piece) => acc + sum(piece.cells.flat()), 0);
    if (pieceCells > 0 && needed === 0 && byColumns === 0) {
      throw new Error(`${colorLabel(color)} の行・列条件が未入力です。図形モードのバー本数を行条件/列条件に入れてください。`);
    }
    if (needed !== byColumns) {
      throw new Error(`${colorLabel(color)} のバー本数が行と列で合っていません。行は合計 ${needed} マス、列は合計 ${byColumns} マスです。どちらかのバーを ${Math.abs(needed - byColumns)} マス分読み違えている可能性があります。`);
    }
    if (needed !== pieceCells) {
      const diff = needed - pieceCells;
      const direction = diff > 0 ? `${diff}マス分のピースが足りません` : `${Math.abs(diff)}マス分ピースが多いです`;
      throw new Error(`${colorLabel(color)} は条件では ${needed} マス必要ですが、入力されたピースは合計 ${pieceCells} マスです。${direction}。横棒などの小さいピースの入れ忘れ、またはバー本数の読み違いを確認してください。`);
    }
  }
  return {
    width: state.board.width,
    height: state.board.height,
    blocked,
    fixedCells: state.board.cells,
    remaining,
    pieces: state.pieces.map((piece) => ({ ...piece, rotations: rotations(piece.cells) })),
  };
}

function inferRequirementsFromPiecesAndBars() {
  ensureRequirements();
  const fixedCounts = fixedCountsByColor();
  const perColor = [];
  for (const color of state.colors) {
    const pieceTotal = state.pieces
      .filter((piece) => piece.color === color.id)
      .reduce((acc, piece) => acc + sum(piece.cells.flat()), 0);
    const fixedTotal = sum(fixedCounts.rows[color.id] || []);
    const total = pieceTotal + fixedTotal;
    if (pieceTotal === 0 && total === 0) {
      perColor.push({
        color: color.id,
        rows: [{ counts: Array(state.board.height).fill(0), score: 0 }],
        columns: [{ counts: Array(state.board.width).fill(0), score: 0 }],
        total,
      });
      continue;
    }
    const emptyCapacityRows = axisEmptyCapacities("rows");
    const emptyCapacityColumns = axisEmptyCapacities("columns");
    const rowMinimums = fixedCounts.rows[color.id] || Array(state.board.height).fill(0);
    const columnMinimums = fixedCounts.columns[color.id] || Array(state.board.width).fill(0);
    const rowMax = rowMinimums.map((min, index) => min + emptyCapacityRows[index]);
    const columnMax = columnMinimums.map((min, index) => min + emptyCapacityColumns[index]);
    const observedRows = resizeArray(state.requirements.rows[color.id] || [], state.board.height);
    const observedColumns = resizeArray(state.requirements.columns[color.id] || [], state.board.width);
    const lockedRows = resizeArray(state.requirementLocks.rows[color.id] || [], state.board.height).map(Boolean);
    const lockedColumns = resizeArray(state.requirementLocks.columns[color.id] || [], state.board.width).map(Boolean);
    const lockedRowTotal = sum(observedRows.map((value, index) => (lockedRows[index] ? value : 0)));
    const lockedColumnTotal = sum(observedColumns.map((value, index) => (lockedColumns[index] ? value : 0)));
    if (lockedRowTotal > total || lockedColumnTotal > total) {
      return {
        ok: false,
        message: `${color.label} の確定バーが多すぎます。必要総数 ${total} に対して、確定済みは行 ${lockedRowTotal} / 列 ${lockedColumnTotal} です。確定バーを減らしてください。`,
      };
    }
    const rowCandidates = generateCountCandidates(observedRows, total, state.board.height, state.board.width, rowMinimums, rowMax, lockedRows).slice(0, 40);
    const columnCandidates = generateCountCandidates(observedColumns, total, state.board.width, state.board.height, columnMinimums, columnMax, lockedColumns).slice(0, 40);
    if (!rowCandidates.length || !columnCandidates.length) {
      return {
        ok: false,
        message: `${color.label} のバーを補えませんでした。ピース合計、固定マス、空きマスのどれかが合っていない可能性があります。`,
      };
    }
    perColor.push({ color: color.id, rows: rowCandidates, columns: columnCandidates, total });
  }

  let candidates = [{ requirements: emptyCounts(), score: 0, notes: [] }];
  for (const entry of perColor) {
    const pairs = [];
    for (const rowCandidate of entry.rows) {
      for (const columnCandidate of entry.columns) {
        pairs.push({
          rows: rowCandidate.counts,
          columns: columnCandidate.counts,
          score: rowCandidate.score + columnCandidate.score,
          note: `${colorLabel(entry.color)} 行${rowCandidate.score.toFixed(1)}/列${columnCandidate.score.toFixed(1)} 総${entry.total}`,
        });
      }
    }
    pairs.sort((a, b) => a.score - b.score);
    const next = [];
    for (const base of candidates) {
      for (const pair of pairs.slice(0, 80)) {
        const requirements = cloneRequirements(base.requirements);
        requirements.rows[entry.color] = pair.rows.slice();
        requirements.columns[entry.color] = pair.columns.slice();
        next.push({
          requirements,
          score: base.score + pair.score,
          notes: [...base.notes, pair.note],
        });
      }
    }
    next.sort((a, b) => a.score - b.score);
    candidates = next.slice(0, 200);
  }

  return {
    ok: true,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      note: candidate.notes.join(" / "),
    })),
  };
}

function generateCountCandidates(observed, total, length, maxPerLine, fixedMinimums, maxValues, lockedValues = []) {
  const normalizedObserved = resizeArray(observed || [], length).map((value) => Math.max(0, Math.min(maxPerLine, Number(value) || 0)));
  const minimums = resizeArray(fixedMinimums || [], length).map((value) => Math.max(0, Number(value) || 0));
  const maximums = resizeArray(maxValues || [], length).map((value, index) => Math.max(minimums[index], Math.min(maxPerLine, Number(value) || maxPerLine)));
  const locks = resizeArray(lockedValues || [], length).map(Boolean);
  for (let index = 0; index < length; index++) {
    if (!locks[index]) continue;
    const value = normalizedObserved[index];
    if (value < minimums[index] || value > maximums[index]) return [];
    minimums[index] = value;
    maximums[index] = value;
  }
  if (total < sum(minimums) || total > sum(maximums)) return [];
  let beam = [{ counts: [], total: 0, score: 0 }];
  for (let index = 0; index < length; index++) {
    const next = [];
    for (const stateCandidate of beam) {
      const remainingSlots = length - index - 1;
      const minRemaining = sum(minimums.slice(index + 1));
      const maxRemaining = sum(maximums.slice(index + 1));
      for (let value = minimums[index]; value <= maximums[index]; value++) {
        const nextTotal = stateCandidate.total + value;
        if (nextTotal + minRemaining > total) continue;
        if (nextTotal + maxRemaining < total) continue;
        next.push({
          counts: [...stateCandidate.counts, value],
          total: nextTotal,
          score:
            stateCandidate.score +
            scoreCountValue(value, normalizedObserved[index], maxPerLine) +
            (remainingSlots ? 0 : Math.abs(total - nextTotal) * 1000),
        });
      }
    }
    next.sort((a, b) => a.score - b.score);
    beam = next.slice(0, 160);
  }
  return beam
    .filter((candidate) => candidate.total === total)
    .map((candidate) => ({
      counts: candidate.counts,
      score: scoreCountCandidate(candidate.counts, normalizedObserved),
    }))
    .sort((a, b) => a.score - b.score);
}

function scoreCountValue(value, observed, maxPerLine) {
  const diff = Math.abs(value - observed);
  const zeroFlipPenalty = (value === 0) !== (observed === 0) ? 1.6 : 0;
  const extremePenalty = value === maxPerLine && observed < maxPerLine - 1 ? 0.6 : 0;
  return diff * diff + zeroFlipPenalty + extremePenalty;
}

function scoreCountCandidate(candidate, observed) {
  return candidate.reduce((acc, value, index) => acc + scoreCountValue(value, observed[index] || 0, Math.max(...candidate, ...observed, 1)), 0);
}

function fixedCountsByColor() {
  const counts = emptyCounts();
  for (let y = 0; y < state.board.height; y++) {
    for (let x = 0; x < state.board.width; x++) {
      const color = fixedColor(state.board.cells[y][x]);
      if (!color || !counts.rows[color]) continue;
      counts.rows[color][y]++;
      counts.columns[color][x]++;
    }
  }
  return counts;
}

function axisEmptyCapacities(axis) {
  if (axis === "rows") {
    return state.board.cells.map((row) => row.filter((cell) => cell === "empty").length);
  }
  return Array.from({ length: state.board.width }, (_, x) => {
    let count = 0;
    for (let y = 0; y < state.board.height; y++) {
      if (state.board.cells[y][x] === "empty") count++;
    }
    return count;
  });
}

function cloneRequirements(requirements) {
  return {
    rows: Object.fromEntries(Object.entries(requirements.rows || {}).map(([color, values]) => [color, values.slice()])),
    columns: Object.fromEntries(Object.entries(requirements.columns || {}).map(([color, values]) => [color, values.slice()])),
  };
}

function parseCountList(value, expectedLength) {
  const parts = value
    .split(/[,\s、]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => Math.max(0, Number(part) || 0));
  if (parts.length !== expectedLength) {
    throw new Error(`${expectedLength}個の数字を入力してください`);
  }
  return parts;
}

function colorLabel(id) {
  return colorById(id)?.label || id;
}

function emptyCounts() {
  const rows = {};
  const columns = {};
  for (const color of state.colors) {
    rows[color.id] = Array(state.board.height).fill(0);
    columns[color.id] = Array(state.board.width).fill(0);
  }
  return { rows, columns };
}

function emptyLocks() {
  const rows = {};
  const columns = {};
  for (const color of state.colors) {
    rows[color.id] = Array(state.board.height).fill(false);
    columns[color.id] = Array(state.board.width).fill(false);
  }
  return { rows, columns };
}

function emptySources(source = "empty") {
  const rows = {};
  const columns = {};
  for (const color of state.colors) {
    rows[color.id] = Array(state.board.height).fill(source);
    columns[color.id] = Array(state.board.width).fill(source);
  }
  return { rows, columns };
}

function search(puzzle, limit) {
  const occupied = new Set([...puzzle.blocked]);
  for (let y = 0; y < puzzle.height; y++) {
    for (let x = 0; x < puzzle.width; x++) {
      if (fixedColor(puzzle.fixedCells[y][x])) occupied.add(key(x, y));
    }
  }
  const solutions = [];
  const solutionKeys = new Set();
  let nodes = 0;
  const remainingPieces = puzzle.pieces.map((piece, index) => ({ ...piece, index }));
  const boardMarks = Array.from({ length: puzzle.height }, (_, y) =>
    Array.from({ length: puzzle.width }, (_, x) => {
      const fixed = fixedColor(puzzle.fixedCells[y][x]);
      return fixed ? { color: fixed, pieceId: "固定" } : null;
    }),
  );

  function dfs(pieces, counts) {
    nodes++;
    if (solutions.length >= limit) return;
    if (pieces.length === 0) {
      if (allZero(counts)) {
        const board = boardMarks.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
        const signature = solutionSignature(board);
        if (!solutionKeys.has(signature)) {
          solutionKeys.add(signature);
          solutions.push({ board });
        }
      }
      return;
    }
    const options = pieces.map((piece) => ({ piece, placements: placementsFor(piece, puzzle, occupied, counts) }));
    options.sort((a, b) => a.placements.length - b.placements.length);
    const chosen = options[0];
    if (chosen.placements.length === 0) return;
    const nextPieces = pieces.filter((piece) => piece !== chosen.piece);
    for (const placement of chosen.placements) {
      applyPlacement(placement, chosen.piece, occupied, boardMarks, -1, counts);
      if (canStillSatisfy(nextPieces, counts)) dfs(nextPieces, counts);
      applyPlacement(placement, chosen.piece, occupied, boardMarks, 1, counts);
    }
  }

  dfs(remainingPieces, cloneCounts(puzzle.remaining));
  return { solutions, nodes };
}

function solutionSignature(board) {
  return board
    .map((row) =>
      row
        .map((cell) => {
          if (!cell) return ".";
          if (!cell.pieceKey) return `fixed:${cell.color}`;
          return cell.color;
        })
        .join(","),
    )
    .join("|");
}

function placementsFor(piece, puzzle, occupied, counts) {
  const result = [];
  for (const rotation of piece.rotations) {
    for (let y = 0; y <= puzzle.height - rotation.length; y++) {
      for (let x = 0; x <= puzzle.width - rotation[0].length; x++) {
        const cells = matrixCells(rotation).map((cell) => ({ x: x + cell.x, y: y + cell.y }));
        if (cells.some((cell) => occupied.has(key(cell.x, cell.y)))) continue;
        if (cells.some((cell) => counts.rows[piece.color][cell.y] <= 0 || counts.columns[piece.color][cell.x] <= 0)) continue;
        result.push({ cells, key: placementKey(piece.color, cells) });
      }
    }
  }
  return result;
}

function placementKey(color, cells) {
  return `${color}:${cells.map((cell) => key(cell.x, cell.y)).sort().join(";")}`;
}

function applyPlacement(placement, piece, occupied, boardMarks, sign, counts) {
  for (const cell of placement.cells) {
    if (sign < 0) {
      occupied.add(key(cell.x, cell.y));
      boardMarks[cell.y][cell.x] = { color: piece.color, pieceKey: placement.key };
      counts.rows[piece.color][cell.y]--;
      counts.columns[piece.color][cell.x]--;
    } else {
      occupied.delete(key(cell.x, cell.y));
      boardMarks[cell.y][cell.x] = null;
      counts.rows[piece.color][cell.y]++;
      counts.columns[piece.color][cell.x]++;
    }
  }
}

function canStillSatisfy(pieces, counts) {
  for (const color of Object.keys(counts.rows)) {
    if (counts.rows[color].some((value) => value < 0) || counts.columns[color].some((value) => value < 0)) return false;
  }
  const cellsByColor = {};
  for (const piece of pieces) cellsByColor[piece.color] = (cellsByColor[piece.color] || 0) + sum(piece.cells.flat());
  for (const color of Object.keys(counts.rows)) {
    if (sum(counts.rows[color]) !== (cellsByColor[color] || 0)) return false;
  }
  return true;
}

function rotations(matrix) {
  const seen = new Set();
  const result = [];
  let current = trimMatrix(matrix);
  for (let i = 0; i < 4; i++) {
    const trimmed = trimMatrix(current);
    const signature = JSON.stringify(trimmed);
    if (!seen.has(signature)) {
      seen.add(signature);
      result.push(trimmed);
    }
    current = rotate90(current);
  }
  return result;
}

function rotate90(matrix) {
  const h = matrix.length;
  const w = matrix[0].length;
  return Array.from({ length: w }, (_, y) => Array.from({ length: h }, (_, x) => matrix[h - 1 - x][y]));
}

function trimMatrix(matrix) {
  let top = 0;
  let bottom = matrix.length - 1;
  let left = 0;
  let right = matrix[0].length - 1;
  while (top <= bottom && matrix[top].every((v) => !v)) top++;
  while (bottom >= top && matrix[bottom].every((v) => !v)) bottom--;
  while (left <= right && matrix.every((row) => !row[left])) left++;
  while (right >= left && matrix.every((row) => !row[right])) right--;
  if (top > bottom || left > right) return [[0]];
  return matrix.slice(top, bottom + 1).map((row) => row.slice(left, right + 1));
}

function matrixCells(matrix) {
  const cells = [];
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[0].length; x++) {
      if (matrix[y][x]) cells.push({ x, y });
    }
  }
  return cells;
}

function allZero(counts) {
  return Object.values(counts.rows).every((arr) => arr.every((value) => value === 0)) &&
    Object.values(counts.columns).every((arr) => arr.every((value) => value === 0));
}

function cloneCounts(counts) {
  return {
    rows: Object.fromEntries(Object.entries(counts.rows).map(([color, arr]) => [color, arr.slice()])),
    columns: Object.fromEntries(Object.entries(counts.columns).map(([color, arr]) => [color, arr.slice()])),
  };
}

function exportJson() {
  $("jsonBox").value = JSON.stringify(
    {
      version: 1,
      colors: state.colors,
      board: state.board,
      requirements: state.requirements,
      requirementSources: state.requirementSources,
      requirementLocks: state.requirementLocks,
      pieces: state.pieces,
    },
    null,
    2,
  );
}

function importJson() {
  const data = JSON.parse($("jsonBox").value);
  state.colors = data.colors;
  state.board = data.board;
  state.requirements = data.requirements;
  state.requirementLocks = data.requirementLocks || { rows: {}, columns: {} };
  state.requirementSources = data.requirementSources || { rows: {}, columns: {} };
  state.pieces = data.pieces;
  state.pieceCandidatesByCard = data.pieceCandidatesByCard || [];
  state.solutions = [];
  ensureRequirements();
  render();
}

function handleImageFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.referenceImage.src = String(reader.result || "");
    clearReferenceBoardDetection();
    clearRecognizedPuzzleState();
    clearAnalysisReport();
    loadReferenceBitmap(state.referenceImage.src);
    renderReferenceImage();
    renderBoard();
    renderRequirements();
    renderPieces();
  renderSolution();
  renderDiagnostics();
  renderBarCandidatePanel();
  $("imageInput").value = "";
  });
  reader.readAsDataURL(file);
}

function loadReferenceBitmap(src) {
  const image = new Image();
  image.addEventListener("load", () => {
    state.imageBitmap = image;
  });
  image.src = src;
}

function detectBoardCells(options = { fixedColors: true }) {
  if (!state.imageBitmap || !state.referenceImage.boardRect) {
    $("statusBox").className = "status error";
    $("statusBox").textContent = "先に画像を読み込み、盤面範囲を指定してください。";
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = state.imageBitmap.naturalWidth;
  canvas.height = state.imageBitmap.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(state.imageBitmap, 0, 0);
  const grid = currentBoardGrid();
  const rect = grid.rect;
  const nextCells = newEmptyCells(state.board.width, state.board.height);
  let blockedCount = 0;
  let fixedCount = 0;
  const debugItems = [];

  for (let y = 0; y < state.board.height; y++) {
    for (let x = 0; x < state.board.width; x++) {
      const cx = (grid.gridX[x] + grid.gridX[x + 1]) / 2;
      const cy = (grid.gridY[y] + grid.gridY[y + 1]) / 2;
      debugItems.push({ type: "point", x: cx, y: cy });
      const sample = sampleRegion(ctx, cx, cy, Math.max(4, Math.min(grid.gridX[x + 1] - grid.gridX[x], grid.gridY[y + 1] - grid.gridY[y]) * 0.18));
      let cell = classifySample(sample);
      if (!options.fixedColors && fixedColor(cell)) cell = "empty";
      nextCells[y][x] = cell;
      if (cell === "blocked") blockedCount++;
      if (fixedColor(cell)) fixedCount++;
    }
  }

  state.referenceImage.debugItems = [...boardGridLineDebugItems(grid.gridX, grid.gridY, rect), ...debugItems];
  state.board.cells = nextCells;
  state.analysis.board = {
    ...(state.analysis.board || {}),
    blockedCount,
    fixedCount,
    confidence: state.analysis.board?.confidence || "低",
  };
  state.solutions = [];
  $("statusBox").className = "status";
  $("statusBox").textContent = options.fixedColors
    ? `盤面の下書きを反映しました。置けないマス ${blockedCount} / 固定マス ${fixedCount}。違っていたら盤面の微調整で直してください。`
    : `置けないマスだけ反映しました。置けないマス ${blockedCount}。完成済み画像を読む時に使います。`;
  render();
}

function detectRequirementBars() {
  if (!state.imageBitmap || !state.referenceImage.boardRect) {
    $("statusBox").className = "status error";
    $("statusBox").textContent = "先に画像を読み込み、盤面範囲を指定してください。";
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = state.imageBitmap.naturalWidth;
  canvas.height = state.imageBitmap.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(state.imageBitmap, 0, 0);
  const grid = currentBoardGrid();
  const rect = grid.rect;
  ensureRequirements();

  const result =
    state.referenceImage.barMode === "number"
      ? detectNumericRequirementBars(ctx, grid)
      : detectRequirementBarsByClusters(ctx, grid);
  for (const color of state.colors) {
    state.requirements.columns[color.id] = mergeRequirementsPreservingLocks("columns", color.id, result.columns[color.id], "detected");
    state.requirements.rows[color.id] = mergeRequirementsPreservingLocks("rows", color.id, result.rows[color.id], "detected");
  }

  state.analysis.bars = barAnalysis(result.stats);
  state.analysis.rawBarCandidates = {
    rows: cloneRequirements({ rows: result.rows, columns: {} }).rows,
    columns: cloneRequirements({ rows: {}, columns: result.columns }).columns,
    stats: result.stats,
  };
  state.referenceImage.debugItems = [...boardGridLineDebugItems(grid.gridX, grid.gridY, rect), ...result.debugItems];
  state.referenceImage.debug = false;
  $("statusBox").className = "status";
  $("statusBox").textContent =
    state.referenceImage.barMode === "number"
      ? `${barStatusMessage(state.analysis.bars)} 数字モードはOCR補助なので、読み違いがあれば表示中のバーをクリックで直してください。`
      : barStatusMessage(state.analysis.bars);
  render();
}

function mergeRequirementsPreservingLocks(axis, colorId, detectedValues, source = "detected") {
  ensureRequirements();
  const current = state.requirements[axis][colorId] || [];
  const locks = state.requirementLocks[axis][colorId] || [];
  return resizeArray(detectedValues || [], current.length).map((value, index) => {
    if (locks[index]) {
      state.requirementSources[axis][colorId][index] = "user";
      return current[index] || 0;
    }
    state.requirementSources[axis][colorId][index] = source;
    return value || 0;
  });
}

function detectRequirementBarsByClusters(ctx, grid) {
  const rect = grid.rect;
  const cellW = averageCellSize(grid.gridX);
  const cellH = averageCellSize(grid.gridY);
  const topRegion = {
    x: Math.max(0, grid.gridX[0] - cellW * 0.35),
    y: Math.max(0, grid.gridY[0] - cellH * 1.25),
    width: grid.gridX[grid.gridX.length - 1] - grid.gridX[0] + cellW * 0.7,
    height: Math.max(1, cellH * 1.08),
  };
  const leftRegion = {
    x: Math.max(0, grid.gridX[0] - cellW * 1.18),
    y: Math.max(0, grid.gridY[0] - cellH * 0.18),
    width: Math.max(1, cellW * 1.05),
    height: grid.gridY[grid.gridY.length - 1] - grid.gridY[0] + cellH * 0.36,
  };
  const rows = {};
  const columns = {};
  const stats = {};
  const debugItems = [
    { type: "region", x: topRegion.x, y: topRegion.y, width: topRegion.width, height: topRegion.height, count: "", color: "#ffffff", label: "上" },
    { type: "region", x: leftRegion.x, y: leftRegion.y, width: leftRegion.width, height: leftRegion.height, count: "", color: "#ffffff", label: "左" },
  ];

  for (const color of state.colors) {
    const topBars = collectBarComponents(ctx, color, topRegion, "columns", rect);
    const leftBars = collectBarComponents(ctx, color, leftRegion, "rows", rect);
    columns[color.id] = assignBarsToAxis(topBars, grid.gridX, "columns");
    rows[color.id] = assignBarsToAxis(leftBars, grid.gridY, "rows");
    stats[color.id] = {
      topBars: topBars.length,
      leftBars: leftBars.length,
      assignedColumns: sum(columns[color.id]),
      assignedRows: sum(rows[color.id]),
    };
    for (const bar of [...topBars, ...leftBars]) {
      debugItems.push({
        type: "region",
        x: bar.bounds.minX,
        y: bar.bounds.minY,
        width: bar.bounds.maxX - bar.bounds.minX + 1,
        height: bar.bounds.maxY - bar.bounds.minY + 1,
        count: "",
        color: color.hex,
        label: color.label,
      });
    }
  }

  return { rows, columns, stats, debugItems };
}

function detectNumericRequirementBars(ctx, grid) {
  const rect = grid.rect;
  const cellW = averageCellSize(grid.gridX);
  const cellH = averageCellSize(grid.gridY);
  const topRegion = {
    x: Math.max(0, grid.gridX[0] - cellW * 0.35),
    y: Math.max(0, grid.gridY[0] - cellH * 1.1),
    width: grid.gridX[grid.gridX.length - 1] - grid.gridX[0] + cellW * 0.7,
    height: Math.max(1, cellH * 0.95),
  };
  const leftRegion = {
    x: Math.max(0, grid.gridX[0] - cellW * 1.0),
    y: Math.max(0, grid.gridY[0] - cellH * 0.18),
    width: Math.max(1, cellW * 0.88),
    height: grid.gridY[grid.gridY.length - 1] - grid.gridY[0] + cellH * 0.36,
  };
  const rows = {};
  const columns = {};
  const stats = {};
  const debugItems = [
    { type: "region", x: topRegion.x, y: topRegion.y, width: topRegion.width, height: topRegion.height, count: "", color: "#ffffff", label: "数字 上" },
    { type: "region", x: leftRegion.x, y: leftRegion.y, width: leftRegion.width, height: leftRegion.height, count: "", color: "#ffffff", label: "数字 左" },
  ];

  for (const color of state.colors) {
    const topDigits = collectDigitComponents(ctx, color, topRegion, rect, "columns");
    const leftDigits = collectDigitComponents(ctx, color, leftRegion, rect, "rows");
    columns[color.id] = assignDigitsToAxis(topDigits, grid.gridX, "columns");
    rows[color.id] = assignDigitsToAxis(leftDigits, grid.gridY, "rows");
    stats[color.id] = {
      topBars: topDigits.length,
      leftBars: leftDigits.length,
      assignedColumns: sum(columns[color.id]),
      assignedRows: sum(rows[color.id]),
    };
    for (const digit of [...topDigits, ...leftDigits]) {
      debugItems.push({
        type: "region",
        x: digit.bounds.minX,
        y: digit.bounds.minY,
        width: digit.bounds.maxX - digit.bounds.minX + 1,
        height: digit.bounds.maxY - digit.bounds.minY + 1,
        count: digit.value,
        color: color.hex,
        label: `${color.label}${digit.value}`,
      });
    }
  }
  return { rows, columns, stats, debugItems };
}

function collectDigitComponents(ctx, color, region, boardRect, orientation) {
  return collectColorComponentsInRegion(ctx, color, region, 1)
    .map((component) => {
      const bounds = component.bounds;
      const w = bounds.maxX - bounds.minX + 1;
      const h = bounds.maxY - bounds.minY + 1;
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const density = component.points.length / Math.max(1, w * h);
      const value = classifyDigitComponent(component);
      return { ...component, w, h, centerX, centerY, density, value };
    })
    .filter((component) => {
      if (component.value == null) return false;
      if (component.points.length < 8 || component.density < 0.12) return false;
      if (component.w < 3 || component.h < 6 || component.w > 24 || component.h > 28) return false;
      if (orientation === "columns" && component.centerY >= boardRect.y - 1) return false;
      if (orientation === "rows" && component.centerX >= boardRect.x - 1) return false;
      return true;
    });
}

function assignDigitsToAxis(components, gridLines, axis) {
  const values = Array.from({ length: gridLines.length - 1 }, () => 0);
  const cellSize = averageCellSize(gridLines);
  const centers = gridLines.slice(0, -1).map((line, index) => (line + gridLines[index + 1]) / 2);
  for (const component of components) {
    const position = axis === "columns" ? component.centerX : component.centerY;
    let bestIndex = -1;
    let bestDistance = Infinity;
    centers.forEach((center, index) => {
      const distance = Math.abs(position - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0 && bestDistance <= cellSize * 0.52) values[bestIndex] = Math.max(values[bestIndex], component.value);
  }
  return values;
}

function classifyDigitComponent(component) {
  const normalized = normalizedComponentBitmap(component.points, 12, 16);
  const templates = digitTemplates();
  let best = null;
  for (const template of templates) {
    const distance = bitmapDistance(normalized, template.bitmap);
    if (!best || distance < best.distance) best = { value: template.value, distance };
  }
  return best && best.distance < 0.42 ? best.value : null;
}

function normalizedComponentBitmap(points, width, height) {
  const bounds = componentBounds(points);
  const sourceW = Math.max(1, bounds.maxX - bounds.minX + 1);
  const sourceH = Math.max(1, bounds.maxY - bounds.minY + 1);
  const bitmap = Array.from({ length: height }, () => Array.from({ length: width }, () => 0));
  for (const point of points) {
    const [x, y] = point.split(",").map(Number);
    const nx = Math.max(0, Math.min(width - 1, Math.floor(((x - bounds.minX) / sourceW) * width)));
    const ny = Math.max(0, Math.min(height - 1, Math.floor(((y - bounds.minY) / sourceH) * height)));
    bitmap[ny][nx] = 1;
  }
  return bitmap;
}

function digitTemplates() {
  if (digitTemplates.cache) return digitTemplates.cache;
  const width = 12;
  const height = 16;
  digitTemplates.cache = Array.from({ length: 10 }, (_, value) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.font = "bold 15px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), width / 2, height / 2 + 0.5);
    const data = ctx.getImageData(0, 0, width, height).data;
    const bitmap = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => (data[(y * width + x) * 4 + 3] > 40 ? 1 : 0)),
    );
    return { value, bitmap };
  });
  return digitTemplates.cache;
}

function bitmapDistance(a, b) {
  let diff = 0;
  let total = 0;
  for (let y = 0; y < a.length; y++) {
    for (let x = 0; x < a[y].length; x++) {
      diff += a[y][x] === b[y][x] ? 0 : 1;
      total++;
    }
  }
  return diff / Math.max(1, total);
}

function collectBarComponents(ctx, color, region, orientation, boardRect) {
  const components = collectColorComponentsInRegion(ctx, color, region, 1);
  const candidates = components
    .map((component) => {
      const box = component.bounds;
      const w = box.maxX - box.minX + 1;
      const h = box.maxY - box.minY + 1;
      const density = component.points.length / Math.max(1, w * h);
      const centerX = (box.minX + box.maxX) / 2;
      const centerY = (box.minY + box.maxY) / 2;
      return { ...component, w, h, density, centerX, centerY };
    })
    .filter((component) => isBarLikeComponent(component, orientation, boardRect))
    .sort((a, b) => (orientation === "columns" ? a.centerX - b.centerX || a.centerY - b.centerY : a.centerY - b.centerY || a.centerX - b.centerX));
  return mergeBarFragments(candidates, orientation);
}

function mergeBarFragments(components, orientation) {
  const result = [];
  const sorted = components.slice().sort((a, b) => {
    const primary = orientation === "columns" ? a.centerX - b.centerX : a.centerY - b.centerY;
    const secondary = orientation === "columns" ? a.centerY - b.centerY : a.centerX - b.centerX;
    return primary || secondary;
  });
  for (const component of sorted) {
    const existing = result.find((entry) => barFragmentsBelongTogether(entry, component, orientation));
    if (!existing) {
      result.push({ ...component });
      continue;
    }
    existing.bounds = {
      minX: Math.min(existing.bounds.minX, component.bounds.minX),
      maxX: Math.max(existing.bounds.maxX, component.bounds.maxX),
      minY: Math.min(existing.bounds.minY, component.bounds.minY),
      maxY: Math.max(existing.bounds.maxY, component.bounds.maxY),
    };
    existing.points = [...existing.points, ...component.points];
    existing.w = existing.bounds.maxX - existing.bounds.minX + 1;
    existing.h = existing.bounds.maxY - existing.bounds.minY + 1;
    existing.centerX = (existing.bounds.minX + existing.bounds.maxX) / 2;
    existing.centerY = (existing.bounds.minY + existing.bounds.maxY) / 2;
    existing.area += component.area;
    existing.density = existing.points.length / Math.max(1, existing.w * existing.h);
  }
  return result;
}

function barFragmentsBelongTogether(a, b, orientation) {
  const sameAxis = orientation === "columns" ? Math.abs(a.centerX - b.centerX) <= 4 : Math.abs(a.centerY - b.centerY) <= 4;
  const nearOtherAxis = orientation === "columns" ? Math.abs(a.centerY - b.centerY) <= 5 : Math.abs(a.centerX - b.centerX) <= 5;
  const expandedOverlap =
    Math.max(a.bounds.minX - 3, b.bounds.minX - 3) <= Math.min(a.bounds.maxX + 3, b.bounds.maxX + 3) &&
    Math.max(a.bounds.minY - 3, b.bounds.minY - 3) <= Math.min(a.bounds.maxY + 3, b.bounds.maxY + 3);
  return sameAxis && (nearOtherAxis || expandedOverlap);
}

function isBarLikeComponent(component, orientation, boardRect) {
  const { bounds, w, h, density, centerX, centerY } = component;
  if (component.points.length < 8 || density < 0.34) return false;
  if (w > 38 || h > 38 || w < 3 || h < 2) return false;
  if (orientation === "columns") {
    if (centerY >= boardRect.y - 1) return false;
    if (w < 7 || w > 32 || h < 2 || h > 10) return false;
    if (w / Math.max(1, h) < 1.4) return false;
  } else {
    if (centerX >= boardRect.x - 1) return false;
    if (h < 7 || h > 32 || w < 2 || w > 10) return false;
    if (h / Math.max(1, w) < 1.4) return false;
  }
  return bounds.maxX <= boardRect.x - 1 || orientation === "columns";
}

function assignBarsToAxis(components, gridLines, axis) {
  const buckets = Array.from({ length: gridLines.length - 1 }, () => []);
  const cellSize = averageCellSize(gridLines);
  const centers = gridLines.slice(0, -1).map((line, index) => (line + gridLines[index + 1]) / 2);
  for (const component of components) {
    const value = axis === "columns" ? component.centerX : component.centerY;
    let bestIndex = -1;
    let bestDistance = Infinity;
    centers.forEach((center, index) => {
      const distance = Math.abs(value - center);
      if (distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    });
    if (bestIndex >= 0 && bestDistance <= cellSize * 0.48) buckets[bestIndex].push(component);
  }
  const counts = buckets.map((bucket) => countStackedBarsInBucket(bucket, axis, cellSize));
  return counts;
}

function countStackedBarsInBucket(components, axis, cellSize) {
  if (!components.length) return 0;
  const secondaryValues = components
    .map((component) => (axis === "columns" ? component.centerY : component.centerX))
    .sort((a, b) => a - b);
  const tolerance = Math.max(5, Math.min(12, cellSize * 0.16));
  const clusters = [];
  for (const value of secondaryValues) {
    const current = clusters[clusters.length - 1];
    if (!current || Math.abs(value - current.avg) > tolerance) {
      clusters.push({ values: [value], avg: value });
      continue;
    }
    current.values.push(value);
    current.avg = average(current.values);
  }
  return clusters.length;
}

function detectPiecesOld() {
  if (!state.imageBitmap || !state.referenceImage.boardRect) {
    $("statusBox").className = "status error";
    $("statusBox").textContent = "先にスクショを読み込み、デルタ解析で盤面を確認してください。";
    return [];
  }
  const canvas = imageToCanvas();
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const rect = state.referenceImage.boardRect;
  const startX = Math.min(canvas.width - 1, rect.x + rect.width + Math.max(30, rect.width * 0.18));
  const candidates = [];
  const debugItems = [];

  for (const color of state.colors) {
    const mask = new Set();
    const rgb = hexToRgb(color.hex);
    const target = rgbToHsv(rgb.r, rgb.g, rgb.b);
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = Math.max(0, Math.floor(startX)); x < canvas.width; x += 2) {
        const data = ctx.getImageData(x, y, 1, 1).data;
        const hsv = rgbToHsv(data[0], data[1], data[2]);
        const hueDistance = Math.min(Math.abs(hsv.h - target.h), 360 - Math.abs(hsv.h - target.h));
        if (hueDistance < 32 && hsv.s > 0.35 && hsv.v > 0.25) mask.add(key(x, y));
      }
    }
    for (const component of connectedComponents(mask)) {
      if (component.length < 20) continue;
      const box = componentBounds(component);
      const w = box.maxX - box.minX + 1;
      const h = box.maxY - box.minY + 1;
      if (w < 12 || h < 12 || w > 180 || h > 180) continue;
      if (box.minX < startX) continue;
      const shape = componentToPieceMatrix(component, color.id);
      if (!shape || shape.cells.flat().filter(Boolean).length < 2) continue;
      candidates.push({ color: color.id, cells: shape.cells });
      debugItems.push({ type: "region", x: box.minX, y: box.minY, width: w, height: h, count: shape.cells.flat().filter(Boolean).length, color: color.hex, label: color.label });
    }
  }

  state.referenceImage.debug = false;
  state.referenceImage.debugItems = debugItems;
  if (candidates.length) {
    state.pieces = candidates.map((candidate, index) => ({
      id: `auto-${index + 1}`,
      color: candidate.color,
      cells: candidate.cells,
      rotation: true,
      mirror: false,
    }));
    $("statusBox").className = "status";
    $("statusBox").textContent = `ピースを ${candidates.length} 個読み取りました。形が違う時はSTEP5で直してください。`;
    render();
  } else {
    $("statusBox").className = "status error";
    $("statusBox").textContent = "ピースを読み取れませんでした。右側のピースパネルがスクショに入っているか確認してください。";
    renderReferenceImage();
  }
  return candidates;
}

function componentToPieceMatrixOld(component, colorId) {
  const box = componentBounds(component);
  const w = box.maxX - box.minX + 1;
  const h = box.maxY - box.minY + 1;
  const area = component.length * 4;
  const estimatedCell = Math.sqrt(Math.max(1, area / 3));
  const cols = Math.max(1, Math.min(5, Math.round(w / estimatedCell)));
  const rows = Math.max(1, Math.min(5, Math.round(h / estimatedCell)));
  const matrix = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  const points = component.map((point) => point.split(",").map(Number));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x1 = box.minX + (col / cols) * w;
      const x2 = box.minX + ((col + 1) / cols) * w;
      const y1 = box.minY + (row / rows) * h;
      const y2 = box.minY + ((row + 1) / rows) * h;
      const count = points.filter(([x, y]) => x >= x1 && x < x2 && y >= y1 && y < y2).length;
      if (count >= 5) matrix[row][col] = 1;
    }
  }
  const trimmed = trimMatrix(matrix);
  return trimmed.flat().some(Boolean) ? trimmed : null;
}

function detectPieces() {
  if (!state.imageBitmap || !state.referenceImage.boardRect) {
    $("statusBox").className = "status error";
    $("statusBox").textContent = "先にスクショを読み込み、デルタ解析で盤面を確認してください。";
    return [];
  }
  const canvas = imageToCanvas();
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const panel = detectPiecePanelRegion(canvas, ctx);
  const cards = detectPieceCards(ctx, panel);
  const candidates = [];
  const skipped = [];
  const debugItems = [{ type: "region", x: panel.x, y: panel.y, width: panel.width, height: panel.height, count: cards.length, color: "#ffffff", label: "ピース欄" }];

  for (const card of cards) {
    debugItems.push({ type: "region", x: card.x, y: card.y, width: card.width, height: card.height, count: "", color: "#5ee0ff", label: "カード" });
    const detected = detectPieceShapeFromCard(ctx, card);
    if (!detected.ok) {
      skipped.push(detected.reason);
      debugItems.push({ type: "region", x: card.x, y: card.y, width: card.width, height: card.height, count: "", color: "#ff4d8d", label: detected.reason });
      continue;
    }
    const cardIndex = candidates.length;
    const previousCard = state.pieceCandidatesByCard?.[cardIndex];
    const pieceId = previousCard?.pieceId || `auto-${cardIndex + 1}`;
    const selectedIndex = previousCard?.locked
      ? Math.max(0, detected.candidates.findIndex((candidate) => candidate.key === previousCard.candidates[previousCard.selectedIndex]?.key))
      : 0;
    const candidateCard = {
      cardId: `card-${cardIndex + 1}`,
      pieceId,
      candidates: detected.candidates,
      selectedIndex: selectedIndex >= 0 ? selectedIndex : 0,
      locked: Boolean(previousCard?.locked),
      crop: cropReferenceRegion(ctx, card),
    };
    const selected = candidateCard.candidates[candidateCard.selectedIndex];
    const normalized = normalizePieceMatrix(selected.cells);
    candidates.push({
      color: selected.color,
      cells: normalized.cells,
      key: selected.key,
      shapeKey: normalized.key,
      confidence: selected.confidence,
      score: selected.score,
      grid: selected.grid,
      cardState: candidateCard,
    });
    debugItems.push({
      type: "region",
      x: detected.bounds.minX,
      y: detected.bounds.minY,
      width: detected.bounds.maxX - detected.bounds.minX + 1,
      height: detected.bounds.maxY - detected.bounds.minY + 1,
      count: selected.cellCount,
      color: detected.confidence === "低" ? "#ffb000" : colorById(detected.color)?.hex || "#ffffff",
      label: `${colorById(detected.color)?.label || detected.color}${detected.confidence === "低" ? "?" : ""}`,
    });
  }

  state.referenceImage.debug = false;
  state.referenceImage.debugItems = debugItems;
  state.analysis.pieces = pieceAnalysis(candidates, cards.length, skipped);
  if (candidates.length) {
    state.pieceCandidatesByCard = candidates.map((candidate) => candidate.cardState);
    applyPieceCandidatesToState();
    $("statusBox").className = "status";
    $("statusBox").textContent = pieceDetectionMessage(candidates, cards.length, skipped);
    render();
  } else {
    $("statusBox").className = "status error";
    $("statusBox").textContent = `ピースを読み取れませんでした。右側のピースパネルがスクショに入っているか確認してください。読み取れそうなカード ${cards.length} 件 / 読み飛ばし ${skipped.length} 件。`;
    renderReferenceImage();
  }
  return candidates;
}

function cropReferenceRegion(ctx, rect) {
  const pad = 4;
  const x = Math.max(0, Math.floor(rect.x - pad));
  const y = Math.max(0, Math.floor(rect.y - pad));
  const width = Math.max(1, Math.min(ctx.canvas.width - x, Math.ceil(rect.width + pad * 2)));
  const height = Math.max(1, Math.min(ctx.canvas.height - y, Math.ceil(rect.height + pad * 2)));
  const canvas = document.createElement("canvas");
  const maxSide = 96;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const cropCtx = canvas.getContext("2d");
  cropCtx.drawImage(ctx.canvas, x, y, width, height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

function detectPiecePanelRegion(canvas, ctx) {
  const rect = state.referenceImage.boardRect;
  const cellW = rect.width / state.board.width;
  const cellH = rect.height / state.board.height;
  const fallbackX = Math.max(0, Math.min(canvas.width - 1, rect.x + rect.width + Math.max(cellW * 0.8, 24)));
  const fallbackY = Math.max(0, rect.y - cellH * 1.7);
  const minPanelX = Math.min(canvas.width - 1, rect.x + rect.width + Math.max(cellW * 0.95, 42));
  const broadRegion = {
    x: Math.max(canvas.width * 0.52, minPanelX),
    y: 0,
    width: Math.max(1, canvas.width - Math.max(canvas.width * 0.52, minPanelX)),
    height: canvas.height,
  };
  const components = ctx ? collectPieceColorComponents(ctx, broadRegion).filter((component) => {
    const w = component.bounds.maxX - component.bounds.minX + 1;
    const h = component.bounds.maxY - component.bounds.minY + 1;
    const centerX = (component.bounds.minX + component.bounds.maxX) / 2;
    return centerX > minPanelX && w >= 12 && h >= 12;
  }) : [];
  if (components.length) {
    const minX = Math.min(...components.map((component) => component.bounds.minX));
    const maxX = Math.max(...components.map((component) => component.bounds.maxX));
    const minY = Math.min(...components.map((component) => component.bounds.minY));
    const maxY = Math.max(...components.map((component) => component.bounds.maxY));
    const padX = Math.max(28, (maxX - minX + 1) * 0.45);
    const padY = Math.max(34, Math.max(...components.map((component) => component.bounds.maxY - component.bounds.minY + 1)) * 1.35);
    const x = Math.max(minPanelX, minX - padX);
    const y = Math.max(0, minY - padY);
    return {
      x,
      y,
      width: Math.max(1, Math.min(canvas.width, maxX + padX) - x),
      height: Math.max(1, Math.min(canvas.height, maxY + padY) - y),
    };
  }
  const x = fallbackX;
  const y = fallbackY;
  return {
    x,
    y,
    width: Math.max(1, canvas.width - x),
    height: Math.max(1, Math.min(canvas.height - y, rect.height + cellH * 3.2)),
  };
}

function detectPieceCards(ctx, panel) {
  const components = collectPieceColorComponents(ctx, panel);
  const expectedCardSide = estimatePieceCardSide(panel, components);
  const cards = components
    .map((component) => {
      const box = component.bounds;
      const w = box.maxX - box.minX + 1;
      const h = box.maxY - box.minY + 1;
      const pad = Math.max(18, Math.min(expectedCardSide * 0.42, Math.max(w, h) * 0.75));
      const x = Math.max(panel.x, box.minX - pad);
      const y = Math.max(panel.y, box.minY - pad);
      return {
        x,
        y,
        width: Math.min(panel.x + panel.width, box.maxX + pad) - x,
        height: Math.min(panel.y + panel.height, box.maxY + pad) - y,
        component,
      };
    })
    .filter((card) => card.width >= 28 && card.height >= 28)
    .filter((card) => card.x >= panel.x - 1 && card.x + card.width <= panel.x + panel.width + 1)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  return mergeOverlappingPieceCards(cards);
}

function estimatePieceCardSide(panel, components) {
  if (components.length >= 2) {
    const centers = components.map((component) => ({
      x: (component.bounds.minX + component.bounds.maxX) / 2,
      y: (component.bounds.minY + component.bounds.maxY) / 2,
    }));
    const distances = [];
    for (let i = 0; i < centers.length; i++) {
      for (let j = i + 1; j < centers.length; j++) {
        const dx = Math.abs(centers[i].x - centers[j].x);
        const dy = Math.abs(centers[i].y - centers[j].y);
        const distance = Math.hypot(dx, dy);
        if (distance > 24 && distance < Math.min(panel.width, panel.height) * 0.75) distances.push(distance);
      }
    }
    distances.sort((a, b) => a - b);
    if (distances.length) return clampNumber(distances[0] * 0.82, 54, 140);
  }
  return clampNumber(Math.min(panel.width / 2.2, panel.height / 3.2), 54, 140);
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function collectPieceColorComponents(ctx, region) {
  const all = [];
  for (const color of state.colors) {
    for (const component of collectPieceComponentsInRegion(ctx, color, region, 2)) {
      if (component.points.length < 24) continue;
      const bounds = component.bounds;
      const w = bounds.maxX - bounds.minX + 1;
      const h = bounds.maxY - bounds.minY + 1;
      const thinHorizontalPiece = w >= 18 && h >= 4 && w / Math.max(1, h) >= 2.2;
      const thinVerticalPiece = h >= 18 && w >= 4 && h / Math.max(1, w) >= 2.2;
      if ((!thinHorizontalPiece && !thinVerticalPiece && (w < 12 || h < 12)) || w > 170 || h > 170) continue;
      const density = component.points.length / Math.max(1, (w * h) / 4);
      if (density < 0.16) continue;
      all.push(component);
    }
  }
  return all.sort((a, b) => b.area - a.area);
}

function collectPieceComponentsInRegion(ctx, color, region, step = 2) {
  const mask = new Set();
  const rgb = hexToRgb(color.hex);
  const target = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const startX = Math.max(0, Math.floor(region.x));
  const startY = Math.max(0, Math.floor(region.y));
  const endX = Math.min(ctx.canvas.width, Math.ceil(region.x + region.width));
  const endY = Math.min(ctx.canvas.height, Math.ceil(region.y + region.height));
  for (let y = startY; y < endY; y += step) {
    for (let x = startX; x < endX; x += step) {
      const data = ctx.getImageData(x, y, 1, 1).data;
      const hsv = rgbToHsv(data[0], data[1], data[2]);
      const hueDistance = Math.min(Math.abs(hsv.h - target.h), 360 - Math.abs(hsv.h - target.h));
      if (hueDistance < 40 && hsv.s > 0.24 && hsv.v > 0.18) mask.add(key(x, y));
    }
  }
  return connectedComponents(mask, step).map((points) => ({ color: color.id, points, bounds: componentBounds(points), area: points.length * step * step }));
}

function mergeOverlappingPieceCards(cards) {
  const result = [];
  for (const card of cards) {
    const existing = result.find((entry) => rectOverlapRatio(entry, card) > 0.35);
    if (!existing) {
      result.push(card);
    } else if ((card.component?.area || 0) > (existing.component?.area || 0)) {
      Object.assign(existing, card);
    }
  }
  return result;
}

function rectOverlapRatio(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const overlap = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const smaller = Math.min(a.width * a.height, b.width * b.height);
  return smaller ? overlap / smaller : 0;
}

function detectPieceShapeFromCard(ctx, card) {
  const component = card.component || collectPieceColorComponents(ctx, card)[0];
  if (!component) return { ok: false, reason: "空" };
  const candidates = componentToPieceMatrixCandidates(component.points, card, 5)
    .map((result) => {
      const normalized = normalizePieceMatrix(result.cells);
      return {
        color: component.color,
        cells: normalized.cells,
        cellCount: sum(normalized.cells.flat()),
        score: result.score,
        confidence: result.confidence,
        grid: result.grid,
        key: `${component.color}:${normalized.key}`,
      };
    })
    .filter((candidate) => candidate.cellCount >= 1);
  if (!candidates.length) return { ok: false, reason: "形推定失敗" };
  return { ok: true, color: component.color, candidates, bounds: component.bounds };
  if (!result) return { ok: false, reason: "形推定失敗" };
  if (sum(result.cells.flat()) < 1) return { ok: false, reason: "色不足" };
  return { ok: true, color: component.color, cells: result.cells, bounds: component.bounds, confidence: result.confidence, score: result.score, grid: result.grid };
}

function componentToPieceMatrix(component, card = null) {
  return componentToPieceMatrixCandidates(component, card, 1)[0] || null;
}

function componentToPieceMatrixCandidates(component, card = null, limit = 5) {
  const box = componentBounds(component);
  const w = box.maxX - box.minX + 1;
  const h = box.maxY - box.minY + 1;
  const points = component.map((point) => point.split(",").map(Number));
  const overallDensity = component.length / Math.max(1, (w * h) / 4);
  const validCard = card && Number.isFinite(card.x) && Number.isFinite(card.y) && card.width > 0 && card.height > 0;
  let best = null;
  const candidates = [];
  for (let rows = 1; rows <= 5; rows++) {
    for (let cols = 1; cols <= 5; cols++) {
      const boxes = [{ ...box, source: "component", penalty: 0 }];
      if (validCard) boxes.push(...pieceCardGridBoxes(box, card, rows, cols));
      for (const candidateBox of boxes) {
      const candidateW = candidateBox.maxX - candidateBox.minX + 1;
      const candidateH = candidateBox.maxY - candidateBox.minY + 1;
      const cellW = candidateW / cols;
      const cellH = candidateH / rows;
      const cellRatio = cellW / Math.max(1, cellH);
      if (cellRatio < 0.45 || cellRatio > 2.2) continue;
      const densities = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
      const matrix = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
      let score = Math.abs(Math.log(cellRatio)) * 12 + rows * cols * 0.08 + candidateBox.penalty;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x1 = candidateBox.minX + (col / cols) * candidateW;
          const x2 = candidateBox.minX + ((col + 1) / cols) * candidateW;
          const y1 = candidateBox.minY + (row / rows) * candidateH;
          const y2 = candidateBox.minY + ((row + 1) / rows) * candidateH;
          const count = points.filter(([x, y]) => x >= x1 && x < x2 && y >= y1 && y < y2).length;
          const density = count / Math.max(1, ((x2 - x1) * (y2 - y1)) / 4);
          densities[row][col] = density;
        }
      }
      const flatDensities = densities.flat();
      const maxDensity = Math.max(...flatDensities);
      const threshold = Math.max(0.2, maxDensity * 0.38);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (densities[row][col] > threshold) matrix[row][col] = 1;
          score += Math.abs(densities[row][col] - (matrix[row][col] ? Math.max(0.42, maxDensity * 0.72) : Math.min(0.08, threshold * 0.45)));
        }
      }
      const normalized = normalizePieceMatrix(matrix);
      if (!normalized.cells.flat().some(Boolean)) continue;
      const filledCells = sum(normalized.cells.flat());
      const totalCells = normalized.cells.length * normalized.cells[0].length;
      const expectedArea = filledCells * cellW * cellH;
      const coverage = (component.length * 4) / Math.max(1, expectedArea);
      const fillRatio = filledCells / Math.max(1, totalCells);
      const onDensities = flatDensities.filter((density) => density > threshold);
      const offDensities = flatDensities.filter((density) => density <= threshold);
      const contrast = (onDensities.length ? average(onDensities) : 0) - (offDensities.length ? average(offDensities) : 0);
        if (candidateBox.source === "card") {
          const expansionRatio = (candidateW * candidateH) / Math.max(1, w * h);
          score += Math.max(0, Math.log(expansionRatio)) * 6;
        }
        if (candidateBox.source === "card" && filledCells <= 3 && component.length > 90) score += 5.5;
        if (candidateBox.source === "component" && validCard && filledCells <= 3 && Math.max(w, h) > Math.min(card.width, card.height) * 0.48) score += 4.5;
        if (candidateBox.source === "card" && filledCells >= 5 && contrast >= 0.18 && overallDensity > 0.72) score -= 1.2;
      if (filledCells === totalCells && overallDensity < 0.92) score += (0.92 - overallDensity) * 48;
      if (filledCells === 1 && overallDensity < 0.88) score += (0.88 - overallDensity) * 34;
      if (fillRatio > 0.85 && overallDensity < 0.72) score += (0.72 - overallDensity) * 30;
      if (coverage < 0.48) score += (0.48 - coverage) * 28;
      if (coverage > 1.25) score += (coverage - 1.25) * 16;
      if (contrast < 0.18) score += (0.18 - contrast) * 18;
      score += disconnectedPenalty(normalized.cells) * 20;
      if (!best || score < best.score) {
        best = {
          score,
          cells: normalized.cells,
          grid: `${normalized.cells[0].length}x${normalized.cells.length}`,
          confidence: score < 12 && contrast >= 0.16 ? "高" : score < 22 ? "中" : "低",
        };
      }
      candidates.push({
        score,
        cells: normalized.cells,
        grid: `${normalized.cells[0].length}x${normalized.cells.length}`,
        confidence: score < 12 && contrast >= 0.16 ? "high" : score < 22 ? "medium" : "low",
      });
      }
    }
  }
  const unique = new Map();
  for (const candidate of candidates.sort((a, b) => a.score - b.score)) {
    const normalized = normalizePieceMatrix(candidate.cells);
    const keyValue = `${normalized.key}:${sum(normalized.cells.flat())}`;
    if (!unique.has(keyValue)) unique.set(keyValue, { ...candidate, cells: normalized.cells });
  }
  return [...unique.values()].slice(0, limit);
}

function pieceCardGridBoxes(componentBox, card, rows, cols) {
  const cx = (componentBox.minX + componentBox.maxX) / 2;
  const cy = (componentBox.minY + componentBox.maxY) / 2;
  const componentW = componentBox.maxX - componentBox.minX + 1;
  const componentH = componentBox.maxY - componentBox.minY + 1;
  const minCardSide = Math.min(card.width, card.height);
  if (Math.max(componentW, componentH) < minCardSide * 0.48 && Math.min(componentW, componentH) < minCardSide * 0.4) {
    return [];
  }
  const innerPad = Math.max(8, minCardSide * 0.1);
  const inner = {
    minX: card.x + innerPad,
    maxX: card.x + card.width - innerPad,
    minY: card.y + innerPad,
    maxY: card.y + card.height - innerPad,
  };
  const boxes = [];
  const baseCell = Math.max(componentW / Math.max(1, cols), componentH / Math.max(1, rows), minCardSide / 4.8);
  for (const scale of [1, 1.14, 1.28]) {
    const cell = baseCell * scale;
    const candidate = clampBoxToBounds({
      minX: cx - (cell * cols) / 2,
      maxX: cx + (cell * cols) / 2,
      minY: cy - (cell * rows) / 2,
      maxY: cy + (cell * rows) / 2,
    }, inner);
    if (candidate.maxX - candidate.minX < cols * 8 || candidate.maxY - candidate.minY < rows * 8) continue;
    boxes.push({ ...candidate, source: "card", penalty: 1.8 + (scale - 1) * 2 });
  }
  return boxes;
}

function clampBoxToBounds(box, bounds) {
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  let minX = box.minX;
  let minY = box.minY;
  if (minX < bounds.minX) minX = bounds.minX;
  if (minY < bounds.minY) minY = bounds.minY;
  if (minX + width > bounds.maxX) minX = bounds.maxX - width;
  if (minY + height > bounds.maxY) minY = bounds.maxY - height;
  minX = Math.max(bounds.minX, minX);
  minY = Math.max(bounds.minY, minY);
  return {
    minX,
    maxX: Math.min(bounds.maxX, minX + width),
    minY,
    maxY: Math.min(bounds.maxY, minY + height),
  };
}

function normalizePieceMatrix(matrix) {
  const cells = trimMatrix(matrix);
  return { cells, key: cells.map((row) => row.join("")).join("/") };
}

function disconnectedPenalty(matrix) {
  const cells = matrixCells(matrix);
  if (cells.length <= 1) return 0;
  const remaining = new Set(cells.map((cell) => key(cell.x, cell.y)));
  const first = remaining.values().next().value;
  const stack = [first];
  remaining.delete(first);
  while (stack.length) {
    const current = stack.pop();
    const [x, y] = current.split(",").map(Number);
    for (const next of [key(x + 1, y), key(x - 1, y), key(x, y + 1), key(x, y - 1)]) {
      if (remaining.has(next)) {
        remaining.delete(next);
        stack.push(next);
      }
    }
  }
  return remaining.size;
}

function pieceDetectionMessage(candidates, cardCount, skipped) {
  const byColor = {};
  for (const candidate of candidates) {
    const label = colorById(candidate.color)?.label || candidate.color;
    byColor[label] = byColor[label] || { pieces: 0, cells: 0, low: 0, shapes: {} };
    byColor[label].pieces++;
    byColor[label].cells += sum(candidate.cells.flat());
    if (candidate.confidence === "低") byColor[label].low++;
    const shape = `${candidate.shapeKey}=${sum(candidate.cells.flat())}`;
    byColor[label].shapes[shape] = (byColor[label].shapes[shape] || 0) + 1;
  }
  const summary = Object.entries(byColor)
    .map(([label, value]) => {
      const shapes = Object.entries(value.shapes).map(([shape, count]) => `${shape}x${count}`).join(" ");
      const low = value.low ? ` / 要確認${value.low}個` : "";
      return `${label}${value.pieces}個/${value.cells}マス${low}（${shapes}）`;
    })
    .join("、");
  const skippedText = skipped.length ? ` 無視したカード: ${skipped.join("、")}。` : "";
  return `ピースを ${candidates.length} 個読み取りました。${summary || "色付きピースなし"}。カード ${cardCount} 件。${skippedText}形が違う時はSTEP5で直してください。`;
}

function pieceAnalysis(candidates, cardCount, skipped) {
  const byColor = {};
  for (const color of state.colors) byColor[color.id] = { pieces: 0, cells: 0, lowConfidence: 0, shapes: {} };
  for (const candidate of candidates) {
    const entry = byColor[candidate.color] || (byColor[candidate.color] = { pieces: 0, cells: 0, lowConfidence: 0, shapes: {} });
    entry.pieces++;
    entry.cells += sum(candidate.cells.flat());
    if (candidate.confidence === "低") entry.lowConfidence++;
    entry.shapes[candidate.shapeKey] = (entry.shapes[candidate.shapeKey] || 0) + 1;
  }
  return { byColor, cardCount, skipped };
}

function countBarsInRegion(ctx, color, x, y, width, height, orientation) {
  const mask = new Set();
  const rgb = hexToRgb(color.hex);
  const target = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(ctx.canvas.width, Math.ceil(x + width));
  const endY = Math.min(ctx.canvas.height, Math.ceil(y + height));
  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      const data = ctx.getImageData(px, py, 1, 1).data;
      const hsv = rgbToHsv(data[0], data[1], data[2]);
      const hueDistance = Math.min(Math.abs(hsv.h - target.h), 360 - Math.abs(hsv.h - target.h));
      if (hueDistance < 32 && hsv.s > 0.35 && hsv.v > 0.28) {
        mask.add(key(px, py));
      }
    }
  }
  if (!mask.size) return 0;
  const components = connectedComponents(mask);
  return components.filter((component) => {
    const box = componentBounds(component);
    const w = box.maxX - box.minX + 1;
    const h = box.maxY - box.minY + 1;
    if (component.length < 8) return false;
    const density = component.length / Math.max(1, w * h);
    if (density < 0.35) return false;
    if (orientation === "vertical") {
      const maxBarW = Math.min(34, width * 0.72);
      const maxBarH = Math.min(12, height * 0.42);
      return w >= 7 && w <= maxBarW && h >= 2 && h <= maxBarH;
    }
    const maxBarW = Math.min(12, width * 0.42);
    const maxBarH = Math.min(34, height * 0.72);
    return h >= 7 && h <= maxBarH && w >= 2 && w <= maxBarW;
  }).length;
}

function connectedComponents(mask, step = 1) {
  const components = [];
  const visited = new Set();
  const neighbors = [
    [step, 0],
    [-step, 0],
    [0, step],
    [0, -step],
  ];
  for (const pointKey of mask) {
    if (visited.has(pointKey)) continue;
    const stack = [pointKey];
    const component = [];
    visited.add(pointKey);
    while (stack.length) {
      const current = stack.pop();
      component.push(current);
      const [x, y] = current.split(",").map(Number);
      for (const [dx, dy] of neighbors) {
        const next = key(x + dx, y + dy);
        if (mask.has(next) && !visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function componentBounds(component) {
  const xs = [];
  const ys = [];
  for (const point of component) {
    const [x, y] = point.split(",").map(Number);
    xs.push(x);
    ys.push(y);
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function sampleRegion(ctx, cx, cy, radius) {
  const points = [];
  for (let dy = -radius; dy <= radius; dy += Math.max(1, radius / 2)) {
    for (let dx = -radius; dx <= radius; dx += Math.max(1, radius / 2)) {
      const px = Math.round(cx + dx);
      const py = Math.round(cy + dy);
      const data = ctx.getImageData(px, py, 1, 1).data;
      points.push(rgbToHsv(data[0], data[1], data[2]));
    }
  }
  points.sort((a, b) => b.v - a.v);
  const bright = points.slice(0, Math.max(1, Math.ceil(points.length * 0.35)));
  return {
    h: average(bright.map((p) => p.h)),
    s: average(bright.map((p) => p.s)),
    v: average(bright.map((p) => p.v)),
  };
}

function classifySample(sample) {
  const matchedColor = nearestColor(sample);
  if (matchedColor && sample.s > 0.38 && sample.v > 0.32) return `fixed:${matchedColor.id}`;
  if (sample.v > 0.18 && sample.v < 0.46 && sample.s < 0.22) return "blocked";
  return "empty";
}

function nearestColor(sample) {
  let best = null;
  for (const color of state.colors) {
    const rgb = hexToRgb(color.hex);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    const hueDistance = Math.min(Math.abs(sample.h - hsv.h), 360 - Math.abs(sample.h - hsv.h)) / 180;
    const score = hueDistance * 2 + Math.abs(sample.s - hsv.s) + Math.abs(sample.v - hsv.v) * 0.4;
    if (!best || score < best.score) best = { color, score };
  }
  return best && best.score < 0.85 ? best.color : null;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

function average(values) {
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function loadSample() {
  state.colors = [{ id: "green", label: "緑", hex: "#a7e900" }];
  state.board = { width: 3, height: 3, cells: newEmptyCells(3, 3) };
  state.requirements = { rows: { green: [2, 1, 2] }, columns: { green: [1, 3, 1] } };
  state.pieces = [
    { id: "p1", color: "green", cells: [[1, 1], [0, 1]], rotation: true, mirror: false },
    { id: "p2", color: "green", cells: [[1], [1]], rotation: true, mirror: false },
  ];
  state.solutions = [];
  render();
}

function loadDeltaSixOnePreset() {
  state.colors = [
    { id: "green", label: "緑", hex: "#a7e900" },
    { id: "blue", label: "青", hex: "#39a9f2" },
  ];
  state.board = { width: 5, height: 7, cells: newEmptyCells(5, 7) };
  state.board.cells[3][0] = "blocked";
  state.board.cells[3][4] = "blocked";
  state.requirements = {
    rows: {
      green: [0, 0, 0, 1, 1, 3, 5],
      blue: [3, 5, 5, 2, 0, 0, 0],
    },
    columns: {
      green: [2, 1, 4, 1, 2],
      blue: [3, 3, 3, 3, 3],
    },
  };
  state.pieces = [
    { id: "g1", color: "green", cells: [[1, 1], [1, 0]], rotation: true, mirror: false },
    { id: "g2", color: "green", cells: [[1, 1], [1, 0]], rotation: true, mirror: false },
    { id: "g3", color: "green", cells: [[1, 1, 1]], rotation: true, mirror: false },
    { id: "b1", color: "blue", cells: [[1, 0], [1, 1], [1, 0], [1, 0]], rotation: true, mirror: false },
    { id: "b2", color: "blue", cells: [[1, 0, 1], [1, 1, 1]], rotation: true, mirror: false },
    { id: "b3", color: "blue", cells: [[0, 1, 0], [1, 1, 1]], rotation: true, mirror: false },
  ];
  state.solutions = [];
  state.solutionIndex = 0;
  $("widthInput").value = "5";
  $("heightInput").value = "7";
  $("statusBox").className = "status";
  $("statusBox").textContent = "六つ目 1/2 のテスト値を読み込みました。";
  render();
}

function randomColor(index) {
  const palette = ["#ffb000", "#ff5d8f", "#9b7cff", "#30d5c8", "#f2f2f2"];
  return palette[(index - 1) % palette.length];
}

function sum(arr) {
  return arr.reduce((acc, value) => acc + Number(value || 0), 0);
}

function key(x, y) {
  return `${x},${y}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function showBoardCreateFeedback(width, height) {
  const button = $("resizeBtn");
  const feedback = $("boardCreateFeedback");
  button.classList.add("created");
  feedback.textContent = `盤面 ${width} x ${height} をセットしました。次は STEP 3 デルタ解析です。`;
  window.clearTimeout(showBoardCreateFeedback.timer);
  showBoardCreateFeedback.timer = window.setTimeout(() => {
    button.classList.remove("created");
  }, 1400);
}

$("resizeBtn").addEventListener("click", () => {
  const width = Math.max(1, Math.min(14, Number($("widthInput").value) || 6));
  const height = Math.max(1, Math.min(14, Number($("heightInput").value) || 6));
  initBoard(width, height);
  state.referenceImage.gridX = null;
  state.referenceImage.gridY = null;
  if (state.referenceImage.boardRect) setBoardGridFromRect(state.referenceImage.boardRect);
  clearAnalysisReport();
  state.solutions = [];
  render();
  showBoardCreateFeedback(width, height);
});
$("addColorBtn").addEventListener("click", addColor);
$("addPieceBtn").addEventListener("click", () => addPiece());
$("solveBtn").addEventListener("click", runSolveWithLoading);
$("solveMainBtn").addEventListener("click", runSolveWithLoading);
$("deltaPresetBtn").addEventListener("click", loadDeltaSixOnePreset);
$("sampleBtn").addEventListener("click", loadSample);
$("resetBtn").addEventListener("click", () => {
  resetAllState();
  render();
});
$("prevSolutionBtn").addEventListener("click", () => {
  moveSolution(-1);
});
$("nextSolutionBtn").addEventListener("click", () => {
  moveSolution(1);
});
$("exportBtn").addEventListener("click", exportJson);
$("importBtn").addEventListener("click", importJson);
$("imageInput").addEventListener("change", (event) => handleImageFile(event.target.files?.[0]));
const opencvScript = $("opencvScript");
if (opencvScript) {
  opencvScript.addEventListener("error", () => {
    window.__opencvLoadFailed = true;
    renderExternalLibraryNotice();
  });
}
$("imageModeSelect").addEventListener("change", () => {
  state.referenceImage.mode = $("imageModeSelect").value;
});
$("barModeSelect").addEventListener("change", () => {
  state.referenceImage.barMode = $("barModeSelect").value;
  const note = state.referenceImage.barMode === "number"
    ? "数字モードにしました。数字OCRは補助扱いなので、読み違いがあれば表示中のバーをクリックで直してください。"
    : "図形バーの読み取りに戻しました。";
  $("statusBox").className = "status";
  $("statusBox").textContent = note;
});
$("imageZoom").addEventListener("input", () => {
  state.referenceImage.zoom = Number($("imageZoom").value) || 100;
  renderReferenceImage();
});
$("selectBoardBtn").addEventListener("click", () => {
  state.referenceImage.selecting = true;
  state.referenceImage.selectionMode = "board";
  state.referenceImage.firstPoint = null;
  renderReferenceImage();
});
$("autoAnalyzeBtn").addEventListener("click", runAutoAnalyzeWithLoading);
$("autoAnalyzeInlineBtn").addEventListener("click", runAutoAnalyzeWithLoading);
$("toggleAdvancedBtn").addEventListener("click", () => {
  state.referenceImage.advanced = !state.referenceImage.advanced;
  renderReferenceImage();
});
$("selectCellBtn").addEventListener("click", () => {
  state.referenceImage.selecting = true;
  state.referenceImage.selectionMode = "cell";
  state.referenceImage.firstPoint = null;
  renderReferenceImage();
});
$("clearBoardSelectionBtn").addEventListener("click", () => {
  clearReferenceBoardDetection();
  state.referenceImage.firstPoint = null;
  state.referenceImage.selecting = false;
  state.referenceImage.selectionMode = "board";
  state.analysis.board = null;
  renderReferenceImage();
});
$("detectCellsBtn").addEventListener("click", () => detectBoardCells({ fixedColors: true }));
$("detectBlockedBtn").addEventListener("click", () => detectBoardCells({ fixedColors: false }));
$("detectBarsBtn").addEventListener("click", detectRequirementBars);
$("detectPiecesBtn").addEventListener("click", detectPieces);
$("toggleDebugBtn").addEventListener("click", () => {
  state.referenceImage.debug = !state.referenceImage.debug;
  renderDebugOverlay();
});
$("clearImageBtn").addEventListener("click", () => {
  state.referenceImage.src = "";
  state.imageBitmap = null;
  clearReferenceBoardDetection();
  state.referenceImage.firstPoint = null;
  state.referenceImage.selecting = false;
  state.referenceImage.selectionMode = "board";
  state.referenceImage.debugItems = [];
  state.referenceImage.debug = false;
  clearRecognizedPuzzleState();
  clearAnalysisReport();
  $("imageInput").value = "";
  render();
});
$("referenceStage").addEventListener("click", handleReferenceClick);

if (!loadSavedState()) {
  initBoard();
  addPiece([[1, 1], [0, 1]], "green");
}
render();
