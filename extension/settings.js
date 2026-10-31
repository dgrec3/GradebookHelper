/**
 * Shared settings model for PowerSchool Enhancer.
 *
 * Loaded by the content script, the toolbar popup and the options page so all
 * three agree on defaults, validation and band matching.
 * Exposes a single global: PTPSettings.
 */
(function (global) {
  if (global.PTPSettings) return;

  const STORAGE_KEY = 'settings';
  const SCHEMA_VERSION = 1;

  // Flag order doubles as precedence: when a cell has several visible flags,
  // the first enabled one in this list decides the color.
  const FLAG_DEFINITIONS = [
    { key: 'exempt',     label: 'Exempt',     iconClass: 'ps-exempt-flag-purple' },
    { key: 'missing',    label: 'Missing',    iconClass: 'ps-missing-flag' },
    { key: 'incomplete', label: 'Incomplete', iconClass: 'ps-incomplete-flag' },
    { key: 'absent',     label: 'Absent',     iconClass: 'ps-absent-flag' },
    { key: 'late',       label: 'Late',       iconClass: 'ps-late-flag' }
  ];

  // Defaults reproduce v1.2.1 exactly: red below 70%, yellow 70% up to 80%.
  const DEFAULT_BANDS = [
    { enabled: true, min: 0,  max: 70, color: '#ff4d4d' },
    { enabled: true, min: 70, max: 80, color: '#ffeb3b' }
  ];

  const DEFAULT_FLAG_COLORS = {
    exempt: '#c5b3e6',
    missing: '#ff9800',
    incomplete: '#90caf9',
    absent: '#a5d6a7',
    late: '#ffcc80'
  };

  // Special grade-scale codes are defined per district (HCST: X, M, I, WP, WF),
  // so they're an editable list rather than fixed. M = Medical is pre-filled.
  const DEFAULT_SCORE_CODES = [
    { enabled: false, code: 'M', label: 'Medical', color: '#f48fb1' }
  ];

  const MAX_BANDS = 20; // keeps the stored object far below the 8 KB sync quota
  const MAX_SCORE_CODES = 20;
  const MAX_CODE_LENGTH = 6;
  const MAX_LABEL_LENGTH = 40;
  const MIN_SPLIT_SEGMENTS = 2;
  const MAX_SPLIT_SEGMENTS = 3;

  function getDefaults() {
    const flags = {};
    FLAG_DEFINITIONS.forEach(def => {
      flags[def.key] = { enabled: false, color: DEFAULT_FLAG_COLORS[def.key] };
    });

    return {
      schemaVersion: SCHEMA_VERSION,
      enabled: true,
      assignmentBands: cloneBands(DEFAULT_BANDS),
      finalGrade: {
        include: false,
        useAssignmentBands: true,
        bands: cloneBands(DEFAULT_BANDS)
      },
      scoreCodes: cloneBands(DEFAULT_SCORE_CODES),
      // When a cell meets several conditions (e.g. 65% and Late), split it into
      // left-to-right stripes, one per condition, up to `max`.
      multiHighlight: { enabled: true, max: MAX_SPLIT_SEGMENTS },
      flags
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

    const flags = {};
    FLAG_DEFINITIONS.forEach(def => {
      const rawFlag = migrated.flags?.[def.key] || {};
      flags[def.key] = {
        enabled: rawFlag.enabled === true,
        color: isHexColor(rawFlag.color) ? rawFlag.color.toLowerCase() : DEFAULT_FLAG_COLORS[def.key]
      };
    });

    return {
      schemaVersion: SCHEMA_VERSION,
      enabled: migrated.enabled !== false,
      assignmentBands,
      finalGrade: {
        include: rawFinal.include === true,
        useAssignmentBands: rawFinal.useAssignmentBands !== false,
        // Separate final-grade bands start as a copy of the assignment bands.
        bands: normalizeBands(rawFinal.bands, assignmentBands)
      },
      scoreCodes: normalizeScoreCodes(migrated.scoreCodes),
      multiHighlight: {
        enabled: migrated.multiHighlight?.enabled !== false,
        max: clampInteger(migrated.multiHighlight?.max, MIN_SPLIT_SEGMENTS, MAX_SPLIT_SEGMENTS, MAX_SPLIT_SEGMENTS)
      },
      flags
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

  // Placeholder for future schema upgrades (v1 is the first stored schema).
  function migrate(raw) {
    return raw;
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

  // Human-readable overlap / gap warnings for the options page. These never
  // block saving because first-match-wins gives overlaps a defined meaning.
  function describeBandIssues(bands) {
    const issues = [];
    const active = bands
      .map((band, index) => ({ ...band, index }))
      .filter(band => band.enabled && !bandProblem(band));

    bands.forEach((band, index) => {
      const problem = bandProblem(band);
      if (problem) issues.push(`Band ${index + 1}: ${problem.toLowerCase()}; it will be skipped.`);
    });

    const sorted = [...active].sort((a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity));
    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      const previousMax = previous.max ?? Infinity;
      const currentMin = current.min ?? -Infinity;
      if (currentMin < previousMax) {
        issues.push(`Bands ${previous.index + 1} and ${current.index + 1} overlap; the one higher in the list wins.`);
      } else if (currentMin > previousMax) {
        issues.push(`Gap between ${formatPercent(previousMax)} and ${formatPercent(currentMin)}: those scores won't be highlighted.`);
      }
    }
    return issues;
  }

  function formatPercent(value) {
    return `${Number(value.toFixed(2))}%`;
  }

  // ── Readability ─────────────────────────────────────────────────────────────

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
      console.debug('[PowerSchool Enhancer] Could not load settings; using defaults.', error);
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
      console.debug('[PowerSchool Enhancer] Could not watch settings.', error);
    }
  }

  global.PTPSettings = {
    FLAG_DEFINITIONS,
    MAX_BANDS,
    MAX_SCORE_CODES,
    MAX_CODE_LENGTH,
    MAX_LABEL_LENGTH,
    MIN_SPLIT_SEGMENTS,
    MAX_SPLIT_SEGMENTS,
    getDefaults,
    normalize,
    cloneBands,
    bandProblem,
    matchBand,
    matchScoreCode,
    describeBandIssues,
    contrastTextColor,
    load,
    save,
    onChange
  };
})(globalThis);
