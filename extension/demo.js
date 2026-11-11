/**
 * Demo page: builds a made-up class in the look and markup of PowerTeacher
 * Pro's scoresheet. It ships with the extension but nothing links to it:
 * it's for Chrome Web Store reviewers (who can't sign in to PowerTeacher; the
 * test instructions give them its address), our own testing, and the store
 * screenshots (add ?shot to hide the demo banner).
 *
 * The class data is loaded with a real XMLHttpRequest on purpose: content.js
 * has already injected injected.js into this page, so the request goes through
 * the same XHR wrapper → points relay → highlight path as on PowerTeacher.
 */
(function () {
  // Icon spans only; their look (square or text tag) comes from CSS.
  const FLAG_ICON_CLASSES = Object.fromEntries(
    PTPSettings.FLAG_DEFINITIONS.map(def => [def.key, def.iconClass])
  );

  const head = document.getElementById('head');
  const rowsBody = document.getElementById('rows');
  const status = document.getElementById('demo-status');

  if (new URLSearchParams(location.search).has('shot')) document.body.classList.add('shot');

  // HCST-style scale: A+ … C-, then NP (no pass) below 70%.
  const LETTER_SCALE = [[97, 'A+'], [93, 'A'], [90, 'A-'], [87, 'B+'], [83, 'B'], [80, 'B-'],
    [77, 'C+'], [73, 'C'], [70, 'C-']];
  function letterFor(percent) {
    const match = LETTER_SCALE.find(([min]) => percent >= min);
    return match ? match[1] : 'NP';
  }

  function entryParts(entry) {
    return typeof entry === 'string' ? { score: entry, flags: [], note: false }
      : { flags: [], note: false, ...entry };
  }

  function el(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  // ── Statistics shown in the Mean / Median / Mode rows ─────────────────────
  function stats(values) {
    if (!values.length) return { mean: '', median: '', mode: '' };
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const counts = new Map();
    values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
    const [modeValue, modeCount] = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const format = n => String(Math.round(n * 1000) / 1000);
    return { mean: format(mean), median: format(median), mode: modeCount > 1 ? format(modeValue) : '' };
  }

  function coursePercent(student, assignments) {
    if (student.finalCode) return null;
    let earned = 0;
    let possible = 0;
    student.scores.forEach((entry, index) => {
      const { score, flags } = entryParts(entry);
      const value = parseFloat(score);
      if (flags.includes('exempt') || Number.isNaN(value)) return;
      earned += value;
      possible += assignments[index]._assignmentsections[0].scoreentrypoints;
    });
    return possible ? Math.round((earned / possible) * 100) : null;
  }

  // ── Header: metrics rows, then the column headers ─────────────────────────
  function renderHead(data, percents) {
    const scored = percents.filter(p => p !== null);
    const course = stats(scored);
    const columnStats = data.assignments.map((assignment, index) => stats(
      data.students
        .map(student => entryParts(student.scores[index]))
        .filter(({ score, flags }) => !flags.includes('exempt') && score !== '')
        .map(({ score }) => parseFloat(score))
        .filter(value => !Number.isNaN(value))
    ));

    [['Mean', 'mean'], ['Median', 'median'], ['Mode', 'mode']].forEach(([label, key]) => {
      const row = el('tr', 'metrics');
      row.append(el('th', 'text-right', label));
      const courseCell = el('th');
      const coursePart = el('span', 'course-metric');
      const value = course[key];
      coursePart.append(el('span', '', value === '' ? '' : letterFor(Number(value))),
        el('span', '', value === '' ? '' : `${Math.round(Number(value) * 10) / 10}%`));
      courseCell.append(coursePart);
      row.append(courseCell);
      columnStats.forEach(column => row.append(el('th', 'text-center', column[key])));
      head.append(row);
    });

    const header = el('tr', 'header-row fixed-height');
    header.append(el('th', 'student-col header', `Students (${data.students.length})`));
    header.append(el('th', 'course-grade-header text-center', 'Course Grade'));
    data.assignments.forEach(assignment => {
      const th = el('th', `text-center score-assignment-col category color-${assignment.category}`);
      th.title = assignment.name;
      th.append(el('span', 'assignment-name', assignment.name), el('span', 'sub-info', `(${assignment.date})`),
        el('span', 'chevron'));
      header.append(th);
    });
    head.append(header);
  }

  // ── Body rows ─────────────────────────────────────────────────────────────

  // Mirrors PowerTeacher's markup: every flag icon is rendered and the unset
  // ones carry ng-hide, which is what content.js checks. Exempt sits directly
  // in the link; the other flags live in span.flag-container.
  function flagIcon(key, activeFlags) {
    const icon = el('span', `ps-icon ${FLAG_ICON_CLASSES[key]}`);
    if (!activeFlags.includes(key)) icon.classList.add('ng-hide');
    return icon;
  }

  function assignmentCell(assignment, entry) {
    const { score, flags, note } = entryParts(entry);
    const cell = el('td', 'text-center score-assignment-col keypad-cell');
    cell.setAttribute('data-column-identifier', String(assignment.assignmentid));

    const link = el('a', 'keypad-link');
    if (flags.includes('exempt')) link.classList.add('exempt');
    // Comment bubble, like PowerTeacher's span.ps-notes-flag in the top-right.
    const comment = el('span', 'ps-icon ps-notes-flag corner-top-right');
    if (!note) comment.classList.add('ng-hide');
    const container = el('span', 'flag-container');
    ['missing', 'incomplete', 'absent', 'late'].forEach(key => container.append(flagIcon(key, flags)));
    link.append(el('var', '', score), comment, flagIcon('exempt', flags), container);
    cell.append(link);
    return cell;
  }

  // PowerTeacher shows "C+ 78% --" (letter, percent, points). A code like M
  // replaces the letter.
  function courseGradeCell(student, percent) {
    const cell = el('td', 'keypad-cell final-grade-info-cell text-center');
    cell.setAttribute('cell-col-id', 'courseGrade');
    const info = el('div', 'final-grade-info');
    const container = el('div', 'final-grade-grade-container');
    container.append(
      el('div', 'grade', student.finalCode || (percent === null ? '--' : letterFor(percent))),
      el('div', 'percent', percent === null ? '' : `${percent}%`)
    );
    info.append(container, el('div', 'points', '--'));
    const link = el('a', 'keypad-link');
    link.append(info);
    cell.append(link);
    return cell;
  }

  function render(data) {
    document.getElementById('ps-title').textContent = `Scoresheet - ${data.term}`;
    document.getElementById('term-label').textContent = data.term;

    const percents = data.students.map(student => coursePercent(student, data.assignments));
    const scored = percents.filter(p => p !== null);
    const classPercent = Math.round(scored.reduce((sum, p) => sum + p, 0) / scored.length);
    document.getElementById('class-grade').replaceChildren(letterFor(classPercent), el('span', 'divider', '|'),
      `${classPercent}%`, el('span', 'divider', '|'), '--');

    renderHead(data, percents);

    // Row markup matches PowerTeacher (tr#std<id>, th.student-col) so the
    // row hover and divider styles apply here too.
    data.students.forEach((student, index) => {
      const row = el('tr', 'fixed-height');
      row.id = `std${1000 + index}`;
      const name = el('th', 'student-col student-link');
      name.scope = 'row';
      name.append(el('var', 'student-sequence', `${index + 1}.`), el('span', 'student-name', student.name));
      row.append(name, courseGradeCell(student, percents[index]));
      data.assignments.forEach((assignment, column) => row.append(assignmentCell(assignment, student.scores[column])));
      rowsBody.append(row);
    });
  }

  function loadClass() {
    const request = new XMLHttpRequest();
    request.open('GET', 'demo-data.json');
    request.onload = () => {
      try {
        render(JSON.parse(request.responseText));
      } catch (error) {
        status.textContent = 'Could not load the sample class.';
        console.error('[Gradebook Enhancer] Demo data failed to load.', error);
      }
    };
    request.send();
  }

  document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Saves to the teacher's real settings (it's their explicit click), so the
  // options page and PowerTeacher show the same thing afterwards.
  document.getElementById('enable-all').addEventListener('click', async () => {
    const settings = await PTPSettings.load();
    settings.enabled = true;
    settings.finalGrade.include = true;
    settings.scoreCodes.forEach(entry => { entry.enabled = true; });
    try {
      await PTPSettings.save(settings);
      status.textContent = 'All highlight types are on';
    } catch (error) {
      status.textContent = 'Could not save — try again';
      console.error('[Gradebook Enhancer] Save failed.', error);
    }
  });

  // Wait for the page's load event so injected.js (added by content.js) is
  // already wrapping XMLHttpRequest when the class data is requested.
  if (document.readyState === 'complete') {
    loadClass();
  } else {
    window.addEventListener('load', loadClass, { once: true });
  }
})();
