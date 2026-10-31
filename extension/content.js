/**
 * PowerSchool Enhancer — PowerTeacher Pro grade highlighting
 *
 * Colors scoresheet cells using teacher-defined bands (min % / max % / color),
 * optional final-grade highlighting, optional score-code colors (e.g. M = Medical)
 * and optional flag colors (Exempt, Missing, Incomplete, Absent, Late).
 * Cells meeting several conditions can be split into 2–3 left-to-right stripes.
 * Settings come from settings.js.
 *
 * v1.2a performance/safety notes (still apply):
 * - Guards against duplicate content-script setup.
 * - Uses CSS classes instead of repeatedly writing inline colors.
 * - Debounces DOM rescans.
 * - Only schedules rescans for mutations that look relevant to grade cells.
 */
(function () {
  if (window.__ptpGradeHighlighterLoaded) {
    console.debug('[PTP Grade Highlighter] Already loaded; skipping duplicate setup.');
    return;
  }
  window.__ptpGradeHighlighterLoaded = true;

  const HIGHLIGHT_DEBOUNCE_MS = 300;
  const STYLE_ELEMENT_ID = 'ptp-grade-highlighter-styles';

  const ASSIGNMENT_CELL_SELECTOR = 'td.score-assignment-col[data-column-identifier]';
  const FINAL_GRADE_CELL_SELECTOR = 'td.final-grade-info-cell';
  const ANY_GRADE_CELL_SELECTOR = `${ASSIGNMENT_CELL_SELECTOR}, ${FINAL_GRADE_CELL_SELECTOR}`;

  // assignmentId (string) → pointsPossible (number)
  const pointsMap = Object.create(null);

  // null until chrome.storage answers; no highlighting happens before that.
  let settings = null;

  // ── Styles: one static <style> tag ─────────────────────────────────────────
  // Every highlighted cell gets the ptp-hl class plus per-cell CSS variables
  // (--ptp-bg / --ptp-fg / --ptp-shadow). Variables instead of one class per
  // color are needed because split cells can combine any 2–3 colors.
  // The td.keypad-cell prefix keeps specificity at least as high as v1.2.1's
  // selectors so PowerTeacher's own styles don't win.
  const HIGHLIGHT_CSS = `
    td.keypad-cell.ptp-hl { background: var(--ptp-bg) !important; }
    td.keypad-cell.ptp-hl, td.keypad-cell.ptp-hl * {
      color: var(--ptp-fg) !important;
      text-shadow: var(--ptp-shadow) !important;
    }
  `;

  // Used when split segments disagree on black vs white text: black text with
  // a white halo stays readable across every segment.
  const MIXED_TEXT_SHADOW = '0 0 2px #fff, 0 0 2px #fff, 0 0 3px #fff';

  function finalBands() {
    return settings.finalGrade.useAssignmentBands
      ? settings.assignmentBands
      : settings.finalGrade.bands;
  }

  function applyStyles() {
    if (document.getElementById(STYLE_ELEMENT_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ELEMENT_ID;
    style.textContent = HIGHLIGHT_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  // ── 1. Inject XHR interceptor into the page context ────────────────────────
  function injectInterceptor() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  // ── 2. Recursively walk any JSON object looking for assignment records ─────
  function extractPoints(obj) {
    if (!obj || typeof obj !== 'object') return;

    // Found an assignment record — points live in _assignmentsections[0].scoreentrypoints
    if (obj.assignmentid != null &&
        Array.isArray(obj._assignmentsections) &&
        obj._assignmentsections.length > 0) {
      const pts = parseFloat(obj._assignmentsections[0].scoreentrypoints);
      if (!Number.isNaN(pts)) {
        pointsMap[String(obj.assignmentid)] = pts;
      }
    }

    for (const val of Object.values(obj)) {
      if (Array.isArray(val)) {
        val.forEach(extractPoints);
      } else if (val && typeof val === 'object') {
        extractPoints(val);
      }
    }
  }

  // ── 3. Decide which highlight colors (if any) each cell gets ───────────────

  // PowerTeacher renders every flag icon in every cell and hides the unused
  // ones with Angular's ng-hide class, so "visible" means "flag is set".
  // Returns every enabled, visible flag in precedence order.
  function visibleFlagKeys(cell) {
    return PTPSettings.FLAG_DEFINITIONS
      .filter(def => {
        if (!settings.flags[def.key].enabled) return false;
        if (cell.querySelector(`span.${def.iconClass}:not(.ng-hide)`)) return true;
        // Exempt final grades show as a class on the link rather than an icon.
        return def.key === 'exempt' && Boolean(cell.querySelector('a.keypad-link.exempt'));
      })
      .map(def => def.key);
  }

  function assignmentPercent(cell) {
    const maxPts = pointsMap[cell.getAttribute('data-column-identifier')];
    if (maxPts == null || maxPts === 0) return null;

    const varEl = cell.querySelector('a.keypad-link > var');
    if (!varEl) return null;

    const score = parseFloat(varEl.textContent.trim());
    return Number.isNaN(score) ? null : (score / maxPts) * 100;
  }

  // The final grade cell already shows the percent PowerTeacher calculated
  // (e.g. "57%"), so no points lookup is needed. "--" means no grade yet.
  function finalGradePercent(cell) {
    const percentEl = cell.querySelector('.final-grade-info .percent');
    if (!percentEl) return null;
    const percent = parseFloat(percentEl.textContent.trim());
    return Number.isNaN(percent) ? null : percent;
  }

  // The text PowerTeacher shows in the cell: the score for assignments, the
  // letter grade for the final grade. Special codes like "M" appear here.
  function displayedText(cell, isFinalGrade) {
    const element = isFinalGrade
      ? cell.querySelector('.final-grade-info .grade')
      : cell.querySelector('a.keypad-link > var');
    return element ? element.textContent : '';
  }

  // Flags that describe turn-in status get the second stripe in split cells.
  const STATUS_FLAG_KEYS = ['late', 'missing'];

  // Every condition the cell meets, as colors, ordered for display.
  //
  // Split on (teacher's chosen order, left to right):
  //   1. score band (the grade itself)
  //   2. Late / Missing
  //   3. everything else: score code, Exempt, Incomplete, Absent
  // Split off (one color): score code → flags → score band, so a lone
  // Missing 0 still reads as Missing rather than just red.
  function matchedColors(cell, isFinalGrade) {
    if (!settings.enabled) return [];
    if (isFinalGrade && !settings.finalGrade.include) return [];

    const codeIndex = PTPSettings.matchScoreCode(displayedText(cell, isFinalGrade), settings.scoreCodes);
    const codeColors = codeIndex === -1 ? [] : [settings.scoreCodes[codeIndex].color];

    // A matched code (e.g. "M") already implies exempt in PowerTeacher, so an
    // extra Exempt color would just repeat that information.
    const flagKeys = visibleFlagKeys(cell).filter(key => !(key === 'exempt' && codeIndex !== -1));
    const statusFlagColors = STATUS_FLAG_KEYS
      .filter(key => flagKeys.includes(key))
      .map(key => settings.flags[key].color);
    const otherFlagColors = flagKeys
      .filter(key => !STATUS_FLAG_KEYS.includes(key))
      .map(key => settings.flags[key].color);

    const bandColors = [];
    const percent = isFinalGrade ? finalGradePercent(cell) : assignmentPercent(cell);
    if (percent !== null) {
      const bands = isFinalGrade ? finalBands() : settings.assignmentBands;
      const bandIndex = PTPSettings.matchBand(percent, bands);
      if (bandIndex !== -1) bandColors.push(bands[bandIndex].color);
    }

    if (!settings.multiHighlight.enabled) {
      // Same single-color priority as before split highlighting existed.
      const allFlagColors = flagKeys.map(key => settings.flags[key].color);
      return [...codeColors, ...allFlagColors, ...bandColors].slice(0, 1);
    }

    return [...bandColors, ...statusFlagColors, ...codeColors, ...otherFlagColors]
      .slice(0, settings.multiHighlight.max);
  }

  // One color → solid fill. Two or three → equal vertical stripes, left to right,
  // with hard color stops so there's no blending between segments.
  function backgroundFor(colors) {
    if (colors.length === 1) return colors[0];
    const share = 100 / colors.length;
    const stops = colors.map((color, index) =>
      `${color} ${(index * share).toFixed(2)}% ${((index + 1) * share).toFixed(2)}%`
    );
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }

  function applyHighlight(cell, colors) {
    // Only touch the DOM when a cell's colors actually change, so rescans stay
    // cheap and don't feed the MutationObserver.
    const key = colors.join(',');
    const oldKey = cell.dataset.ptpHighlight || '';
    if (oldKey === key) return;

    if (!key) {
      cell.classList.remove('ptp-hl');
      ['--ptp-bg', '--ptp-fg', '--ptp-shadow'].forEach(name => cell.style.removeProperty(name));
      delete cell.dataset.ptpHighlight;
      return;
    }

    const textColors = new Set(colors.map(PTPSettings.contrastTextColor));
    const mixed = textColors.size > 1;

    cell.style.setProperty('--ptp-bg', backgroundFor(colors));
    cell.style.setProperty('--ptp-fg', mixed ? '#000000' : [...textColors][0]);
    cell.style.setProperty('--ptp-shadow', mixed ? MIXED_TEXT_SHADOW : 'none');
    cell.classList.add('ptp-hl');
    cell.dataset.ptpHighlight = key;
  }

  // ── 4. Highlight / un-highlight score cells ────────────────────────────────
  function highlightCells() {
    if (!settings) return;

    // counts[n] = cells with n colors (1 = solid, 2 = halves, 3 = thirds)
    const counts = Object.create(null);
    const cells = document.querySelectorAll(ANY_GRADE_CELL_SELECTOR);

    cells.forEach(cell => {
      const isFinalGrade = cell.matches(FINAL_GRADE_CELL_SELECTOR);
      const colors = matchedColors(cell, isFinalGrade);
      applyHighlight(cell, colors);
      if (colors.length) counts[colors.length] = (counts[colors.length] || 0) + 1;
    });

    console.debug(`[PTP Grade Highlighter] Scanned ${cells.length} cells.`, counts);
  }

  let debounce = null;
  function scheduleHighlight() {
    clearTimeout(debounce);
    debounce = setTimeout(highlightCells, HIGHLIGHT_DEBOUNCE_MS);
  }

  function nodeLooksRelevant(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;

    return node.matches?.(`${ANY_GRADE_CELL_SELECTOR}, a.keypad-link, var, .percent, .grade`) ||
      node.querySelector?.(`${ANY_GRADE_CELL_SELECTOR}, a.keypad-link > var`);
  }

  function mutationLooksRelevant(mutation) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (nodeLooksRelevant(node)) return true;
      }
      for (const node of mutation.removedNodes) {
        if (nodeLooksRelevant(node)) return true;
      }
      return false;
    }

    // Angular updates score/percent text in place instead of replacing nodes.
    if (mutation.type === 'characterData') {
      return Boolean(mutation.target.parentElement?.closest(ANY_GRADE_CELL_SELECTOR));
    }

    // A flag being set/cleared toggles ng-hide on its icon span. Our own class
    // changes land on the <td>, which this deliberately ignores.
    if (mutation.type === 'attributes') {
      const target = mutation.target;
      return target.matches?.('span.ps-icon, a.keypad-link') &&
        Boolean(target.closest(ANY_GRADE_CELL_SELECTOR));
    }

    return false;
  }

  // ── 5. Listen for XHR data relayed from injected.js ────────────────────────
  window.addEventListener('__ptp_xhr__', (e) => {
    extractPoints(e.detail.data);
    scheduleHighlight();
  });

  // ── 6. Re-highlight after relevant DOM changes ─────────────────────────────
  const observer = new MutationObserver((mutations) => {
    if (mutations.some(mutationLooksRelevant)) scheduleHighlight();
  });

  // ── 7. Settings: load once, then react live to popup/options edits ─────────
  function useSettings(newSettings) {
    settings = newSettings;
    applyStyles();
    highlightCells();
  }

  PTPSettings.onChange(useSettings);

  injectInterceptor();

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class']
  });

  PTPSettings.load().then(loaded => {
    settings = loaded;
    applyStyles();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scheduleHighlight, { once: true });
    } else {
      scheduleHighlight();
    }
  });
})();
