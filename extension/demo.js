/**
 * Demo page: builds a fake PowerTeacher Pro scoresheet so teachers (and
 * Chrome Web Store reviewers, who can't sign in to PowerTeacher) can see the
 * highlighting work.
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

  const headerRow = document.getElementById('header-row');
  const rowsBody = document.getElementById('rows');
  const status = document.getElementById('demo-status');

  function letterFor(percent) {
    if (percent >= 90) return 'A';
    if (percent >= 80) return 'B';
    if (percent >= 70) return 'C';
    if (percent >= 60) return 'D';
    return 'F';
  }

  // Mirrors PowerTeacher's markup: every flag icon is rendered and the unset
  // ones carry ng-hide, which is what content.js checks. Exempt sits directly
  // in the link; the other flags live in span.flag-container.
  function flagIcon(key, activeFlags) {
    const icon = document.createElement('span');
    icon.className = `ps-icon ${FLAG_ICON_CLASSES[key]}`;
    if (!activeFlags.includes(key)) icon.classList.add('ng-hide');
    return icon;
  }

  function flagIcons(activeFlags) {
    const container = document.createElement('span');
    container.className = 'flag-container';
    ['missing', 'incomplete', 'absent', 'late'].forEach(key => container.append(flagIcon(key, activeFlags)));
    return [flagIcon('exempt', activeFlags), container];
  }

  function assignmentCell(assignment, entry) {
    const { score, flags = [], note = false } = typeof entry === 'string' ? { score: entry } : entry;
    const cell = document.createElement('td');
    cell.className = 'score-assignment-col keypad-cell';
    cell.setAttribute('data-column-identifier', String(assignment.assignmentid));

    const link = document.createElement('a');
    link.className = 'keypad-link';
    if (flags.includes('exempt')) link.classList.add('exempt');
    const value = document.createElement('var');
    value.textContent = score;
    // Comment bubble, like PowerTeacher's span.ps-notes-flag in the top-right.
    const comment = document.createElement('span');
    comment.className = 'ps-icon ps-notes-flag corner-top-right';
    if (!note) comment.classList.add('ng-hide');
    link.append(value, comment, ...flagIcons(flags));
    cell.append(link);
    return cell;
  }

  // Final grade = earned ÷ possible over numeric, non-exempt scores, shown
  // the way PowerTeacher shows it ("B" + "84%"). A code like M replaces both.
  function finalGradeCell(student, assignments) {
    let earned = 0;
    let possible = 0;
    student.scores.forEach((entry, index) => {
      const { score, flags = [] } = typeof entry === 'string' ? { score: entry } : entry;
      const value = parseFloat(score);
      if (flags.includes('exempt') || Number.isNaN(value)) return;
      earned += value;
      possible += assignments[index]._assignmentsections[0].scoreentrypoints;
    });

    const percent = possible ? Math.round((earned / possible) * 100) : null;
    const cell = document.createElement('td');
    cell.className = 'final-grade-info-cell keypad-cell';
    cell.setAttribute('cell-col-id', 'courseGrade');

    const info = document.createElement('div');
    info.className = 'final-grade-info';
    const grade = document.createElement('span');
    grade.className = 'grade';
    grade.textContent = student.finalCode || (percent === null ? '--' : letterFor(percent));
    const percentText = document.createElement('span');
    percentText.className = 'percent';
    percentText.textContent = student.finalCode || percent === null ? '--' : `${percent}%`;
    info.append(grade, percentText);

    const link = document.createElement('a');
    link.className = 'keypad-link';
    link.append(info);
    cell.append(link);
    return cell;
  }

  function render(data) {
    data.assignments.forEach(assignment => {
      const th = document.createElement('th');
      const points = document.createElement('small');
      points.textContent = `${assignment._assignmentsections[0].scoreentrypoints} pts`;
      th.append(assignment.name, points);
      headerRow.append(th);
    });
    const finalHeader = document.createElement('th');
    finalHeader.textContent = 'Final grade';
    headerRow.append(finalHeader);

    // Row markup matches PowerTeacher (tr#std<id>, th.student-col) so the
    // row hover and divider styles apply here too.
    data.students.forEach((student, index) => {
      const row = document.createElement('tr');
      row.id = `std${1000 + index}`;
      const name = document.createElement('th');
      name.className = 'student-col';
      name.scope = 'row';
      name.textContent = student.name;
      row.append(name);
      data.assignments.forEach((assignment, index) => row.append(assignmentCell(assignment, student.scores[index])));
      row.append(finalGradeCell(student, data.assignments));
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
    Object.values(settings.flags).forEach(flag => { flag.enabled = true; });
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
