/**
 * PowerTeacher Pro Gradebook - Highlight Low Grades
 *
 * Red: below 70%
 * Yellow: 70% through 79.99%
 *
 * v1.2a performance/safety notes:
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

  const FAIL_THRESHOLD = 0.70;
  const YELLOW_MIN = 0.70;
  const YELLOW_MAX = 0.80;
  const HIGHLIGHT_DEBOUNCE_MS = 300;

  // assignmentId (string) → pointsPossible (number)
  const pointsMap = Object.create(null);

  function injectStylesOnce() {
    if (document.getElementById('ptp-grade-highlighter-styles')) return;

    const style = document.createElement('style');
    style.id = 'ptp-grade-highlighter-styles';
    style.textContent = `
      td.score-assignment-col.ptp-grade-low-red {
        background-color: #ff4d4d !important;
        color: #fff !important;
      }

      td.score-assignment-col.ptp-grade-low-yellow {
        background-color: #ffeb3b !important;
        color: #000 !important;
      }
    `;
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

  // ── 3. Highlight / un-highlight score cells ────────────────────────────────
  function highlightCells() {
    const cells = document.querySelectorAll(
      'td.score-assignment-col[data-column-identifier]'
    );

    let redCount = 0;
    let yellowCount = 0;

    cells.forEach(cell => {
      const colId = cell.getAttribute('data-column-identifier');
      const maxPts = pointsMap[colId];

      cell.classList.remove('ptp-grade-low-red', 'ptp-grade-low-yellow');

      if (maxPts == null || maxPts === 0) return;

      const varEl = cell.querySelector('a.keypad-link > var');
      if (!varEl) return;

      const score = parseFloat(varEl.textContent.trim());
      if (Number.isNaN(score)) return;

      const percent = score / maxPts;

      if (percent < FAIL_THRESHOLD) {
        cell.classList.add('ptp-grade-low-red');
        redCount += 1;
      } else if (percent >= YELLOW_MIN && percent < YELLOW_MAX) {
        cell.classList.add('ptp-grade-low-yellow');
        yellowCount += 1;
      }
    });

    console.debug(
      `[PTP Grade Highlighter] Scanned ${cells.length} cells. Red: ${redCount}. Yellow: ${yellowCount}.`
    );
  }

  let debounce = null;
  function scheduleHighlight() {
    clearTimeout(debounce);
    debounce = setTimeout(highlightCells, HIGHLIGHT_DEBOUNCE_MS);
  }

  function nodeLooksRelevant(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;

    return node.matches?.('td.score-assignment-col[data-column-identifier], a.keypad-link, var') ||
      node.querySelector?.('td.score-assignment-col[data-column-identifier], a.keypad-link > var');
  }

  // ── 4. Listen for XHR data relayed from injected.js ────────────────────────
  window.addEventListener('__ptp_xhr__', (e) => {
    extractPoints(e.detail.data);
    scheduleHighlight();
  });

  // ── 5. Re-highlight after relevant DOM changes ─────────────────────────────
  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some(mutation => {
      for (const node of mutation.addedNodes) {
        if (nodeLooksRelevant(node)) return true;
      }
      for (const node of mutation.removedNodes) {
        if (nodeLooksRelevant(node)) return true;
      }
      return false;
    });

    if (relevant) scheduleHighlight();
  });

  injectStylesOnce();
  injectInterceptor();

  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleHighlight, { once: true });
  } else {
    scheduleHighlight();
  }
})();
