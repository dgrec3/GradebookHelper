/**
 * Gradebook Enhancer for PowerTeacher Pro — grade highlighting
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

  // Text tags: turn each visible PowerTeacher flag square into a small text tag
  // (M, L, I, A or the words MISS, LATE…) on the cell's left edge, so the score
  // stays centered. CSS only, switched by classes on <html>, so no nodes are
  // added to PowerTeacher's Angular-owned cells.
  // PowerTeacher markup (confirmed 2026-11-10): Missing/Incomplete/Absent/Late
  // are 8x8 colored spans positioned absolutely inside span.flag-container,
  // which is stretched over the cell. Exempt sits directly in a.keypad-link.
  // The container becomes a fixed 2x2 mini-grid of 8px slots (rows are only
  // 18px tall), and each flag always lands in the same slot (the teacher's
  // layout), so several flags never pile onto each other or the score:
  //     Missing    | Incomplete
  //     Late       | Absent
  // Exempt usually stands alone on a blank score, so it sits centered on the
  // left edge. Earlier layouts that failed: inline after the score (pushed
  // the score off-center), flex wrap and auto-flow grids (4 tags spilled over
  // the score). See STRATEGIES_THAT_WONT_WORK.md.
  const FLAG_TAGS_ROOT_CLASS = 'ptp-flag-tags';
  const FLAG_TAGS_FILLED_CLASS = 'ptp-flag-tags-filled';
  const FLAG_TAGS_WORD_CLASS = 'ptp-flag-tags-word';
  // 8px slots: two stacked = 16px, leaving 1px above and below inside the
  // 18px row (9px slots touched the cell border and the tops got clipped).
  const FLAG_SLOT_PX = 8;
  const FLAG_SLOTS = {
    missing: 'grid-row: 1; grid-column: 1;',
    incomplete: 'grid-row: 1; grid-column: 2;',
    late: 'grid-row: 2; grid-column: 1;',
    absent: 'grid-row: 2; grid-column: 2;'
  };
  // Letter tags fill one slot exactly (border-box); 7px bold letters on a 6px
  // line fit inside the 1px border.
  const TAG_BOX = `font: 700 7px/6px Arial, sans-serif !important; text-transform: uppercase;
      text-align: center; box-sizing: border-box !important;
      width: ${FLAG_SLOT_PX}px !important; height: ${FLAG_SLOT_PX}px !important; padding: 0 !important;
      border: 1px solid currentColor !important; border-radius: 2px !important;`;
  const FLAG_CONTAINER_CSS = `
    html.${FLAG_TAGS_ROOT_CLASS} td.keypad-cell span.flag-container {
      /* 1px from the cell border: narrow columns (sidebar open) need every pixel. */
      position: absolute !important; top: 0 !important; bottom: 0 !important;
      left: 1px !important; right: auto !important; width: auto !important; height: auto !important;
      display: grid !important;
      grid-template-rows: ${FLAG_SLOT_PX}px ${FLAG_SLOT_PX}px !important;
      /* Fixed widths keep empty slots open, so a lone Absent still sits in
         the bottom-right slot instead of sliding left. */
      grid-template-columns: ${FLAG_SLOT_PX}px ${FLAG_SLOT_PX}px !important;
      align-content: center !important; justify-items: start !important;
      gap: 0 1px !important; pointer-events: none;
    }
    html.${FLAG_TAGS_ROOT_CLASS} td.keypad-cell a.keypad-link > span.ps-exempt-flag-purple:not(.ng-hide) {
      position: absolute !important; left: 1px !important; right: auto !important;
      top: 50% !important; bottom: auto !important; transform: translateY(-50%);
    }
    /* Word tags (MISS, LATE…) keep the slot height but size to their text,
       so their columns size to content. Doubled classes out-rank the
       per-flag ::before rules. */
    html.${FLAG_TAGS_WORD_CLASS} td.keypad-cell span.flag-container {
      grid-template-columns: max-content max-content !important;
    }
    html.${FLAG_TAGS_ROOT_CLASS}.${FLAG_TAGS_WORD_CLASS} td.keypad-cell span.ps-icon.ps-icon:not(.ng-hide)::before {
      width: auto !important; padding: 0 2px !important; font-size: 6px !important;
    }`;
  const FLAG_TAG_CSS = FLAG_CONTAINER_CSS + PTPSettings.FLAG_DEFINITIONS.map(def => {
    const icon = `html.${FLAG_TAGS_ROOT_CLASS} td.keypad-cell span.ps-icon.${def.iconClass}:not(.ng-hide)`;
    const slot = FLAG_SLOTS[def.key] || '';
    return `
    ${icon} {
      background: none !important; width: auto !important; height: auto !important;
      min-width: 0 !important; min-height: 0 !important; overflow: visible !important;
      display: block !important; font-size: 0 !important; line-height: 0 !important;
      margin: 0 !important; z-index: 1;
    }
    html.${FLAG_TAGS_ROOT_CLASS} td.keypad-cell span.flag-container > span.ps-icon.${def.iconClass}:not(.ng-hide) {
      position: static !important; ${slot}
    }
    ${icon} > * , ${icon}::after { display: none !important; }
    html.${FLAG_TAGS_WORD_CLASS} td.keypad-cell span.ps-icon.${def.iconClass}:not(.ng-hide)::before {
      content: '${def.tag}' !important;
    }
    ${icon}::before {
      content: '${def.letter}'; display: block !important;
      position: static !important;
      background: none !important; color: inherit !important;
      ${TAG_BOX}
    }`;
  }).join('') + `
    /* One-letter Incomplete tag: a serif "I" has bars on top and bottom, so it
       can't be mistaken for a lowercase l or a 1. Doubled classes out-rank the
       per-flag font shorthand; word mode ("INC") keeps the normal font. */
    html.${FLAG_TAGS_ROOT_CLASS}:not(.${FLAG_TAGS_WORD_CLASS}) td.keypad-cell span.ps-icon.ps-incomplete-flag.ps-incomplete-flag:not(.ng-hide)::before {
      font-family: Georgia, 'Times New Roman', serif !important;
    }
    /* Filled style: white text on a dark pill reads on every cell color.
       Doubled classes out-rank the per-flag ::before rules (background: none). */
    html.${FLAG_TAGS_ROOT_CLASS}.${FLAG_TAGS_FILLED_CLASS} td.keypad-cell span.ps-icon.ps-icon:not(.ng-hide)::before {
      background: #2f3b48 !important; color: #ffffff !important;
      border-color: #2f3b48 !important; text-shadow: none !important;
    }`;

  // Row tracking aids. PowerTeacher puts each student in tr#std<id> (name in
  // th.student-col, then grade cells) and shades every other row with a
  // translucent gray on the <tr>. Hover outlines the row; dividers are bottom
  // borders (a heavier one every 5 rows helps counting down the list).
  const ROW_HOVER_CLASS = 'ptp-row-hover';
  const ROW_LINES_CLASS = 'ptp-row-lines';
  const ROW_FIVES_CLASS = 'ptp-row-fives';
  const STUDENT_ROW = 'table.gridTable tr[id^="std"]';
  const ROW_CSS = `
    html.${ROW_LINES_CLASS} ${STUDENT_ROW} > td,
    html.${ROW_LINES_CLASS} ${STUDENT_ROW} > th {
      border-bottom: 1px solid rgba(0, 0, 0, 0.18) !important;
    }
    html.${ROW_FIVES_CLASS} ${STUDENT_ROW}:nth-child(5n) > td,
    html.${ROW_FIVES_CLASS} ${STUDENT_ROW}:nth-child(5n) > th {
      border-bottom: 2px solid rgba(0, 0, 0, 0.5) !important;
    }
    html.${ROW_HOVER_CLASS} ${STUDENT_ROW}:hover > td,
    html.${ROW_HOVER_CLASS} ${STUDENT_ROW}:hover > th {
      box-shadow: inset 0 2px 0 #0b5cad, inset 0 -2px 0 #0b5cad !important;
    }
    html.${ROW_HOVER_CLASS} ${STUDENT_ROW}:hover > th {
      background-color: rgba(11, 92, 173, 0.14) !important;
    }`;

  // Comment badge: PowerTeacher's comment bubble (span.ps-notes-flag, a 12px
  // sprite in the cell's top-right, drawn at 60% opacity) fades into colored
  // cells. Keep the same icon but at full opacity on a white badge with a navy
  // ring so it stands out on any color.
  const COMMENT_BADGE_CLASS = 'ptp-comment-badge';
  const COMMENT_CSS = `
    html.${COMMENT_BADGE_CLASS} td.keypad-cell span.ps-notes-flag:not(.ng-hide) {
      background-color: #ffffff !important; border-radius: 3px; opacity: 1 !important;
      box-shadow: 0 0 0 1px #ffffff, 0 0 0 2px #1f3a5f, 0 1px 3px rgba(0, 0, 0, 0.45);
      top: 1px !important; right: 1px !important; z-index: 2;
    }`;

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
    style.textContent = HIGHLIGHT_CSS + FLAG_TAG_CSS + ROW_CSS + COMMENT_CSS;
    (document.head || document.documentElement).appendChild(style);
  }

  // ── 1. Inject XHR interceptor into the page context ────────────────────────
  function injectInterceptor() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  // ── 2. Merge points relayed from injected.js ───────────────────────────────
  // injected.js already reduced each response to { assignmentId: points }, so
  // no student data reaches this script. Values are re-checked because any
  // page script could dispatch this event.
  function mergePoints(points) {
    if (!points || typeof points !== 'object') return;
    for (const [assignmentId, pts] of Object.entries(points)) {
      if (typeof pts === 'number' && Number.isFinite(pts)) {
        pointsMap[String(assignmentId)] = pts;
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

  // colors are "#rrggbb" settings colors; strength (percent) makes them
  // translucent so the row's own gray shading still shows through.
  function applyHighlight(cell, colors, strength) {
    // Only touch the DOM when a cell's colors actually change, so rescans stay
    // cheap and don't feed the MutationObserver.
    const key = colors.length ? `${colors.join(',')}@${strength}` : '';
    const oldKey = cell.dataset.ptpHighlight || '';
    if (oldKey === key) return;

    if (!key) {
      cell.classList.remove('ptp-hl');
      ['--ptp-bg', '--ptp-fg', '--ptp-shadow'].forEach(name => cell.style.removeProperty(name));
      delete cell.dataset.ptpHighlight;
      return;
    }

    // Text color is judged on what the translucent color looks like on white.
    const textColors = new Set(colors.map(color =>
      PTPSettings.contrastTextColor(PTPSettings.blendOverWhite(color, strength))));
    const mixed = textColors.size > 1;

    cell.style.setProperty('--ptp-bg', backgroundFor(colors.map(color => PTPSettings.withStrength(color, strength))));
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
      applyHighlight(cell, colors, settings.colorStrength);
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
    mergePoints(e.detail?.points);
    scheduleHighlight();
  });

  // ── 6. Re-highlight after relevant DOM changes ─────────────────────────────
  const observer = new MutationObserver((mutations) => {
    if (mutations.some(mutationLooksRelevant)) scheduleHighlight();
  });

  // ── 7. Settings: load once, then react live to popup/options edits ─────────
  // Tags and row aids are switched by classes on <html>. They follow the
  // master on/off switch but not flag colors or split highlighting.
  function applyRootClasses() {
    const root = document.documentElement.classList;
    const tagsOn = settings.enabled && settings.flagTags;
    root.toggle(FLAG_TAGS_ROOT_CLASS, tagsOn);
    root.toggle(FLAG_TAGS_FILLED_CLASS, tagsOn && settings.flagTagStyle === 'filled');
    root.toggle(FLAG_TAGS_WORD_CLASS, tagsOn && settings.flagTagLength === 'word');
    root.toggle(ROW_HOVER_CLASS, settings.enabled && settings.rowHover);
    root.toggle(ROW_LINES_CLASS, settings.enabled && ['every', 'both'].includes(settings.rowDividers));
    root.toggle(ROW_FIVES_CLASS, settings.enabled && ['five', 'both'].includes(settings.rowDividers));
    root.toggle(COMMENT_BADGE_CLASS, settings.enabled && settings.commentBadge);
  }

  function useSettings(newSettings) {
    settings = newSettings;
    applyStyles();
    applyRootClasses();
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
    applyRootClasses();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scheduleHighlight, { once: true });
    } else {
      scheduleHighlight();
    }
  });
})();
