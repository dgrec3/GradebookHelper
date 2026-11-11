/**
 * Shared settings model for Gradebook Enhancer for PowerTeacher Pro.
 *
 * Loaded by the content script, the toolbar popup and the options page so all
 * three agree on defaults, validation and band matching.
 * Exposes a single global: PTPSettings.
 */
(function (global) {
  if (global.PTPSettings) return;

  const STORAGE_KEY = 'settings';
  // 2 = bands stored as a ladder (see toLadder); 1 = free-form bands.
  const SCHEMA_VERSION = 2;

  // PowerTeacher's flags. They have no colors of their own (an earlier build
  // colored and split cells by flag); the text tags show them more clearly.
  // `tag` / `letter` replace PowerTeacher's icon when text tags are on; the
  // single letter (default) leaves room in narrow cells for the comment icon.
  const FLAG_DEFINITIONS = [
    { key: 'exempt',     label: 'Exempt',     iconClass: 'ps-exempt-flag-purple', tag: 'Exc',  letter: 'E' },
    { key: 'missing',    label: 'Missing',    iconClass: 'ps-missing-flag',       tag: 'Miss', letter: 'M' },
    { key: 'incomplete', label: 'Incomplete', iconClass: 'ps-incomplete-flag',    tag: 'Inc',  letter: 'I' },
    { key: 'absent',     label: 'Absent',     iconClass: 'ps-absent-flag',        tag: 'Abs',  letter: 'A' },
    { key: 'late',       label: 'Late',       iconClass: 'ps-late-flag',          tag: 'Late', letter: 'L' }
  ];

  // Default bands (chosen 2026-11-10): red below 70%, yellow 70% up to 80%,
  // green 80% and up, so every graded cell gets a color out of the box.
  const DEFAULT_BANDS = [
    { enabled: true, min: 0,  max: 70,   color: '#ff4d4d' },
    { enabled: true, min: 70, max: 80,   color: '#ffeb3b' },
    { enabled: true, min: 80, max: null, color: '#4caf50' }
  ];

  // Special grade-scale codes are defined per district (HCST: X, M, I, WP, WF),
  // so they're an editable list rather than fixed. M = Medical is pre-filled.
  const DEFAULT_SCORE_CODES = [
    { enabled: false, code: 'M', label: 'Medical', color: '#f48fb1' }
  ];

  const MAX_BANDS = 20; // keeps the stored object far below the 8 KB sync quota
  const MAX_SCORE_CODES = 20;
  const MAX_CODE_LENGTH = 6;
  const MAX_LABEL_LENGTH = 40;
  // Highlight colors are drawn semi-transparent so PowerTeacher's alternating
  // row shading shows through colored cells (keeps rows easy to follow).
  const MIN_COLOR_STRENGTH = 30;
  const MAX_COLOR_STRENGTH = 100;
  const DEFAULT_COLOR_STRENGTH = 70;
  const ROW_DIVIDER_MODES = ['off', 'every', 'five', 'both'];
  // Row line darkness, as percent black. Kept to a modest range on purpose;
  // 18 matches the lines before the slider existed.
  const MIN_LINE_DARKNESS = 10;
  const MAX_LINE_DARKNESS = 40;
  const DEFAULT_LINE_DARKNESS = 18;
  const FLAG_TAG_STYLES = ['filled', 'outlined'];
  const FLAG_TAG_LENGTHS = ['letter', 'word'];

  function getDefaults() {
    return {
      schemaVersion: SCHEMA_VERSION,
      enabled: true,
      assignmentBands: cloneBands(DEFAULT_BANDS),
      finalGrade: {
        include: true,
        useAssignmentBands: true,
        bands: cloneBands(DEFAULT_BANDS)
      },
      scoreCodes: cloneBands(DEFAULT_SCORE_CODES),
      // Replace PowerTeacher's small flag icons with readable text tags
      // (M, L, I, A, E or MISS, LATE…). Independent of the cell color.
      flagTags: true,
      // 'filled' = white text on a dark pill (readable on any color);
      // 'outlined' = text and border in the cell's own text color.
      flagTagStyle: 'filled',
      // 'letter' = L/M/I/A/E (compact), 'word' = LATE/MISS/INC/ABS/EXC.
      flagTagLength: 'letter',
      // Percent opacity of highlight colors (100 = solid, as before 1.0).
      colorStrength: DEFAULT_COLOR_STRENGTH,
      // Row tracking aids on the scoresheet.
      rowHover: true,
      rowDividers: 'every',
      lineDarkness: DEFAULT_LINE_DARKNESS,
      // Put PowerTeacher's comment bubble on a white badge so it shows on colors.
      commentBadge: true
    };
  }

  // Shallow-copies a list of plain objects (bands or score codes).
  function cloneBands(bands) {
    return bands.map(band => ({ ...band }));
  }

  // Codes are compared case-insensitively against the cell's displayed text.
  function normalizeCode(value) {
    return typeof value === 'string' ? value.trim().toUpperCase().slice(0, MAX_CODE_LENGTH) : '';
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  // Anything stored could be stale or hand-edited, so every value is checked and
  // replaced with a safe default rather than trusted.

  function isHexColor(value) {
    return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  }

  // Blank / null means "no limit" on that side of the band.
  function toLimit(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeBands(rawBands, fallbackBands) {
    if (!Array.isArray(rawBands)) return cloneBands(fallbackBands);

    return rawBands.slice(0, MAX_BANDS).map(raw => ({
      enabled: raw?.enabled !== false,
      min: toLimit(raw?.min),
      max: toLimit(raw?.max),
      color: isHexColor(raw?.color) ? raw.color.toLowerCase() : '#ff4d4d'
    }));
  }

  function normalizeScoreCodes(rawCodes) {
    if (!Array.isArray(rawCodes)) return cloneBands(DEFAULT_SCORE_CODES);

    return rawCodes.slice(0, MAX_SCORE_CODES).map(raw => ({
      enabled: raw?.enabled === true,
      code: normalizeCode(raw?.code),
      label: typeof raw?.label === 'string' ? raw.label.slice(0, MAX_LABEL_LENGTH) : '',
      color: isHexColor(raw?.color) ? raw.color.toLowerCase() : '#f48fb1'
    }));
  }

  function normalize(raw) {
    const defaults = getDefaults();
    if (!raw || typeof raw !== 'object') return defaults;

    const migrated = migrate(raw);
    const assignmentBands = normalizeBands(migrated.assignmentBands, defaults.assignmentBands);
    const rawFinal = migrated.finalGrade || {};

    return {
      schemaVersion: SCHEMA_VERSION,
      enabled: migrated.enabled !== false,
      assignmentBands,
      finalGrade: {
        // A missing value takes the default (on); a saved choice is kept.
        include: typeof rawFinal.include === 'boolean' ? rawFinal.include : defaults.finalGrade.include,
        useAssignmentBands: rawFinal.useAssignmentBands !== false,
        // Separate final-grade bands start as a copy of the assignment bands.
        bands: normalizeBands(rawFinal.bands, assignmentBands)
      },
      // Settings saved by earlier builds may still hold `flags` (flag colors)
      // and `multiHighlight` (split cells); those features were removed, so
      // the keys are simply not carried over.
      scoreCodes: normalizeScoreCodes(migrated.scoreCodes),
      // Missing in settings saved before tags existed → on, matching the default.
      flagTags: migrated.flagTags !== false,
      flagTagStyle: FLAG_TAG_STYLES.includes(migrated.flagTagStyle) ? migrated.flagTagStyle : 'filled',
      flagTagLength: FLAG_TAG_LENGTHS.includes(migrated.flagTagLength) ? migrated.flagTagLength : 'letter',
      colorStrength: clampInteger(migrated.colorStrength, MIN_COLOR_STRENGTH, MAX_COLOR_STRENGTH, DEFAULT_COLOR_STRENGTH),
      rowHover: migrated.rowHover !== false,
      rowDividers: ROW_DIVIDER_MODES.includes(migrated.rowDividers) ? migrated.rowDividers : 'every',
      lineDarkness: clampInteger(migrated.lineDarkness, MIN_LINE_DARKNESS, MAX_LINE_DARKNESS, DEFAULT_LINE_DARKNESS),
      commentBadge: migrated.commentBadge !== false
    };
  }

  function clampInteger(value, min, max, fallback) {
    const number = Math.round(Number(value));
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  // Returns the index of the first enabled code whose text equals the cell's
  // displayed score/grade (e.g. "M"), or -1.
  function matchScoreCode(displayText, scoreCodes) {
    const text = normalizeCode(displayText);
    if (!text) return -1;
    return scoreCodes.findIndex(entry => entry.enabled && entry.code && entry.code === text);
  }

  // Bands are a ladder, lowest first: band 1 starts at 0 and every later band
  // starts exactly where the previous one ends, so there are no gaps or
  // overlaps to explain. A range the teacher wants uncolored is a band that's
  // switched off. The editor keeps this shape; toLadder converts bands saved
  // before the ladder existed (schema 1):
  //   - sorted by start (lowest first)
  //   - an old gap becomes a switched-off band, so it stays uncolored
  //   - an overlap is trimmed so each band ends where the next one starts
  //   - band 1 starts at 0; each later start = previous end
  const GAP_FILLER_COLOR = '#b0bec5';

  function toLadder(bands) {
    if (bands.length === 0) return [];
    const sorted = [...bands].sort((a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity));
    const ladder = [];
    sorted.forEach((band, index) => {
      const next = sorted[index + 1];
      const step = { ...band };
      if (next && next.min !== null) {
        if (step.max === null || step.max > next.min) step.max = next.min;
      }
      ladder.push(step);
      if (next && next.min !== null && step.max !== null && step.max < next.min) {
        ladder.push({ enabled: false, min: step.max, max: next.min, color: GAP_FILLER_COLOR });
      }
    });
    ladder.forEach((band, index) => { band.min = index === 0 ? 0 : ladder[index - 1].max; });
    return ladder;
  }

  function migrate(raw) {
    if ((raw.schemaVersion ?? 1) >= 2) return raw;
    const migrated = { ...raw };
    if (Array.isArray(raw.assignmentBands)) {
      migrated.assignmentBands = toLadder(normalizeBands(raw.assignmentBands, DEFAULT_BANDS));
    }
    if (Array.isArray(raw.finalGrade?.bands)) {
      migrated.finalGrade = { ...raw.finalGrade, bands: toLadder(normalizeBands(raw.finalGrade.bands, DEFAULT_BANDS)) };
    }
    return migrated;
  }

  // ── Band logic ──────────────────────────────────────────────────────────────

  // A band is usable only when it is on and its range is not empty/backwards.
  function bandProblem(band) {
    if (band.min !== null && band.max !== null && band.min >= band.max) {
      return 'Min must be less than max';
    }
    return null;
  }

  // min is inclusive, max is exclusive, so 70 lands in a 70–80 band, not 0–70.
  // Bands are checked top to bottom and the first match wins.
  function matchBand(percent, bands) {
    for (let index = 0; index < bands.length; index += 1) {
      const band = bands[index];
      if (!band.enabled || bandProblem(band)) continue;
      const aboveMin = band.min === null || percent >= band.min;
      const belowMax = band.max === null || percent < band.max;
      if (aboveMin && belowMax) return index;
    }
    return -1;
  }

  // ── Band analysis for the options page ───────────────────────────────────────
  // Everything the band editor shows besides the inputs: a plain-English
  // "covers" line per band, per-band warnings (a middle band with no end, or
  // an end not above the start) and the segments of the 0–100% bar.
  // Warnings never block saving; a broken band is just skipped by matchBand.

  // 69.99 for a max of 70: the highest score a band with an exclusive max holds,
  // shown to two decimals so "up to, but not including, 70" reads as 69.99.
  function justBelow(value) {
    return formatPercent(Math.round((value - 0.01) * 100) / 100);
  }

  function formatPercent(value) {
    return `${Number(value.toFixed(2))}%`;
  }

  function describeCoverage(band) {
    if (!band.enabled) {
      if (band.min === null || band.max === null) return 'Off: this range gets no color';
      return `Off: ${formatPercent(band.min)} – ${justBelow(band.max)} gets no color`;
    }
    if (bandProblem(band)) return 'Skipped (see below)';
    if (band.min === null && band.max === null) return 'Covers every score';
    if (band.min === null) return `Covers everything below ${formatPercent(band.max)}`;
    if (band.max === null) return `Covers ${formatPercent(band.min)} and up`;
    return `Covers ${formatPercent(band.min)} – ${justBelow(band.max)}`;
  }

  function analyzeBands(bands) {
    const active = bands
      .map((band, index) => ({ ...band, index }))
      .filter(band => band.enabled && !bandProblem(band));
    const low = band => band.min ?? -Infinity;
    const high = band => band.max ?? Infinity;

    // Ladder rules: every band but the last needs an end (the next band starts
    // there), and each end must be above its band's start.
    const warnings = bands.map((band, index) => {
      const isLast = index === bands.length - 1;
      if (band.max === null && !isLast) {
        return ['Enter where this band ends; the next band starts there.'];
      }
      if (band.max !== null && band.min !== null && band.max <= band.min) {
        return [`Must end above ${formatPercent(band.min)} (where this band starts), so this band is skipped.`];
      }
      return [];
    });

    // Bar segments over 0–100%: split at every band edge, then ask which bands
    // cover each piece. Neighbors with the same result are merged.
    const edges = new Set([0, 100]);
    active.forEach(band => {
      [band.min, band.max].forEach(edge => { if (edge !== null && edge > 0 && edge < 100) edges.add(edge); });
    });
    const points = [...edges].sort((a, b) => a - b);
    const segments = [];
    for (let k = 0; k < points.length - 1; k += 1) {
      const from = points[k];
      const to = points[k + 1];
      const middle = (from + to) / 2;
      const covering = active.filter(band => middle >= low(band) && middle < high(band));
      const winner = covering[0] || null; // list order = priority
      const segment = { from, to, winnerIndex: winner ? winner.index : -1, color: winner ? winner.color : null, overlap: covering.length > 1 };
      const last = segments[segments.length - 1];
      if (last && last.winnerIndex === segment.winnerIndex && last.overlap === segment.overlap) {
        last.to = to;
      } else {
        segments.push(segment);
      }
    }

    return {
      coverage: bands.map(describeCoverage),
      warnings,
      segments,
      edges: points
    };
  }

  // ── Readability ─────────────────────────────────────────────────────────────

  // "#rrggbb" + percent → "rgba(r, g, b, a)" for semi-transparent highlights.
  function withStrength(hexColor, strength) {
    const [r, g, b] = [1, 3, 5].map(offset => parseInt(hexColor.slice(offset, offset + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${(strength / 100).toFixed(2)})`;
  }

  // The color a semi-transparent highlight actually shows over a white cell,
  // as "#rrggbb". Used to pick black/white text and for preview swatches.
  function blendOverWhite(hexColor, strength) {
    const alpha = strength / 100;
    return '#' + [1, 3, 5].map(offset => {
      const value = parseInt(hexColor.slice(offset, offset + 2), 16);
      return Math.round(value * alpha + 255 * (1 - alpha)).toString(16).padStart(2, '0');
    }).join('');
  }

  // Paints a preview swatch the way the gradebook will show the color: the
  // translucent highlight over a white cell, with matching black/white text.
  function paintSwatch(element, hexColor, strength) {
    const shown = blendOverWhite(hexColor, strength);
    element.style.backgroundColor = shown;
    element.style.color = contrastTextColor(shown);
  }

  // WCAG relative luminance; 0.179 is the point where black and white text
  // have equal contrast against the background.
  function contrastTextColor(hexColor) {
    const channels = [1, 3, 5].map(offset => {
      const value = parseInt(hexColor.slice(offset, offset + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    return luminance > 0.179 ? '#000000' : '#ffffff';
  }

  // ── Storage ─────────────────────────────────────────────────────────────────

  async function load() {
    try {
      const stored = await chrome.storage.sync.get(STORAGE_KEY);
      return normalize(stored[STORAGE_KEY]);
    } catch (error) {
      // Extension context can be invalidated after an update; fall back safely.
      console.debug('[Gradebook Enhancer] Could not load settings; using defaults.', error);
      return getDefaults();
    }
  }

  async function save(settings) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: normalize(settings) });
  }

  function onChange(callback) {
    try {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' && changes[STORAGE_KEY]) {
          callback(normalize(changes[STORAGE_KEY].newValue));
        }
      });
    } catch (error) {
      console.debug('[Gradebook Enhancer] Could not watch settings.', error);
    }
  }

  global.PTPSettings = {
    FLAG_DEFINITIONS,
    MAX_BANDS,
    MAX_SCORE_CODES,
    MAX_CODE_LENGTH,
    MAX_LABEL_LENGTH,
    MIN_COLOR_STRENGTH,
    MAX_COLOR_STRENGTH,
    MIN_LINE_DARKNESS,
    MAX_LINE_DARKNESS,
    ROW_DIVIDER_MODES,
    getDefaults,
    normalize,
    cloneBands,
    bandProblem,
    matchBand,
    matchScoreCode,
    analyzeBands,
    toLadder,
    formatPercent,
    contrastTextColor,
    withStrength,
    blendOverWhite,
    paintSwatch,
    load,
    save,
    onChange
  };
})(globalThis);
