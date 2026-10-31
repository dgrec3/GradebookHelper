/**
 * PowerSchool Enhancer — PowerTeacher Pro grade highlighting
 *
 * Colors scoresheet cells using teacher-defined bands (min % / max % / color),
 * optional final-grade highlighting, optional score-code colors (e.g. M = Medical)
 * and optional flag colors (Exempt, Missing, Incomplete, Absent, Late).
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

  // ── Styles: one <style> tag, rebuilt whenever settings change ──────────────
  // Class names: ptp-a-<n> (assignment band n), ptp-f-<n> (final band n),
  // ptp-flag-<key>, ptp-code-<n> (score code n). The td.keypad-cell prefix keeps specificity at least as
  // high as v1.2.1's selectors so PowerTeacher's own styles don't win.
  function cssRule(className, color) {
    const textColor = PTPSettings.contrastTextColor(color);
    return `
      td.keypad-cell.${className} { background-color: ${color} !important; }
      td.keypad-cell.${className}, td.keypad-cell.${className} * { color: ${textColor} !important; }
    `;
  }

  function finalBands() {
    return settings.finalGrade.useAssignmentBands
      ? settings.assignmentBands
      : settings.finalGrade.bands;
  }

  function buildStyles() {
    const rules = [];
    settings.assignmentBands.forEach((band, index) => rules.push(cssRule(`ptp-a-${index}`, band.color)));
    finalBands().forEach((band, index) => rules.push(cssRule(`ptp-f-${index}`, band.color)));
    PTPSettings.FLAG_DEFINITIONS.forEach(def => {
      rules.push(cssRule(`ptp-flag-${def.key}`, settings.flags[def.key].color));
    });
    settings.scoreCodes.forEach((entry, index) => rules.push(cssRule(`ptp-code-${index}`, entry.color)));
    return rules.join('\n');
  }

  function applyStyles() {
    let style = document.getElementById(STYLE_ELEMENT_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ELEMENT_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = buildStyles();
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

  // ── 3. Decide which highlight class (if any) each cell gets ────────────────

  // PowerTeacher renders every flag icon in every cell and hides the unused
  // ones with Angular's ng-hide class, so "visible" means "flag is set".
  function visibleFlagKey(cell) {
    for (const def of PTPSettings.FLAG_DEFINITIONS) {
      if (!settings.flags[def.key].enabled) continue;
      if (cell.querySelector(`span.${def.iconClass}:not(.ng-hide)`)) return def.key;
      // Exempt final grades show as a class on the link rather than an icon.
      if (def.key === 'exempt' && cell.querySelector('a.keypad-link.exempt')) return def.key;
    }
    return null;
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

  function desiredClass(cell, isFinalGrade) {
    if (!settings.enabled) return null;
    if (isFinalGrade && !settings.finalGrade.include) return null;

    // Score codes come first: PowerTeacher also marks codes like "M" as exempt,
    // so checking flags first would hide the code's own color.
    const codeIndex = PTPSettings.matchScoreCode(displayedText(cell, isFinalGrade), settings.scoreCodes);
    if (codeIndex !== -1) return `ptp-code-${codeIndex}`;

    // Flags beat score bands: a flagged Missing 0 shows the Missing color.
    const flagKey = visibleFlagKey(cell);
    if (flagKey) return `ptp-flag-${flagKey}`;

    const percent = isFinalGrade ? finalGradePercent(cell) : assignmentPercent(cell);
    if (percent === null) return null;

    const bands = isFinalGrade ? finalBands() : settings.assignmentBands;
    const bandIndex = PTPSettings.matchBand(percent, bands);
    if (bandIndex === -1) return null;
    return `${isFinalGrade ? 'ptp-f' : 'ptp-a'}-${bandIndex}`;
  }

  // Only touch the DOM when a cell's class actually changes, so rescans stay
  // cheap and don't feed the MutationObserver.
  function setCellClass(cell, newClass) {
    const oldClass = cell.dataset.ptpHighlight || null;
    if (oldClass === newClass) return;
    if (oldClass) cell.classList.remove(oldClass);
    if (newClass) {
      cell.classList.add(newClass);
      cell.dataset.ptpHighlight = newClass;
    } else {
      delete cell.dataset.ptpHighlight;
    }
  }

  // ── 4. Highlight / un-highlight score cells ────────────────────────────────
  function highlightCells() {
    if (!settings) return;

    const counts = Object.create(null);
    const cells = document.querySelectorAll(ANY_GRADE_CELL_SELECTOR);

    cells.forEach(cell => {
      const isFinalGrade = cell.matches(FINAL_GRADE_CELL_SELECTOR);
      const className = desiredClass(cell, isFinalGrade);
      setCellClass(cell, className);
      if (className) counts[className] = (counts[className] || 0) + 1;
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
