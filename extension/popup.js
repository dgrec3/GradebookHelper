/**
 * Toolbar popup: quick on/off toggles and a read-only band summary.
 * Detailed band editing lives on the options page.
 */
(async function () {
  let settings = await PTPSettings.load();

  const enabledInput = document.getElementById('enabled');
  const finalInclude = document.getElementById('final-include');
  const details = document.getElementById('details');
  const bandSummary = document.getElementById('band-summary');
  const flagsContainer = document.getElementById('flags');
  const scoreCodesContainer = document.getElementById('score-codes');

  async function persist() {
    try {
      await PTPSettings.save(settings);
    } catch (error) {
      console.error('[PowerSchool Enhancer] Save failed.', error);
    }
  }

  function describeRange(band) {
    if (band.min === null && band.max === null) return 'All scores';
    if (band.min === null) return `Below ${band.max}%`;
    if (band.max === null) return `${band.min}% and up`;
    return `${band.min}% to < ${band.max}%`;
  }

  function swatch(color, enabled) {
    const element = document.createElement('span');
    element.className = 'swatch small';
    element.style.backgroundColor = color;
    element.classList.toggle('muted', !enabled);
    return element;
  }

  function render() {
    enabledInput.checked = settings.enabled;
    finalInclude.checked = settings.finalGrade.include;
    details.classList.toggle('muted-section', !settings.enabled);

    bandSummary.replaceChildren();
    if (settings.assignmentBands.length === 0) {
      bandSummary.textContent = 'No bands yet.';
    }
    settings.assignmentBands.forEach(band => {
      const row = document.createElement('div');
      row.className = 'summary-row';
      const text = document.createElement('span');
      text.textContent = describeRange(band) + (band.enabled ? '' : ' (off)');
      row.append(swatch(band.color, band.enabled), text);
      bandSummary.append(row);
    });

    scoreCodesContainer.replaceChildren();
    if (settings.scoreCodes.length === 0) {
      scoreCodesContainer.textContent = 'No codes yet.';
    }
    settings.scoreCodes.forEach(entry => {
      scoreCodesContainer.append(toggleRow(entry, `${entry.code || '?'}${entry.label ? ` — ${entry.label}` : ''}`));
    });

    flagsContainer.replaceChildren();
    PTPSettings.FLAG_DEFINITIONS.forEach(def => {
      flagsContainer.append(toggleRow(settings.flags[def.key], def.label));
    });
  }

  // A checkbox + color swatch + name row that flips item.enabled and saves.
  function toggleRow(item, text) {
    const label = document.createElement('label');
    label.className = 'switch-row';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = item.enabled;
    toggle.addEventListener('change', () => {
      item.enabled = toggle.checked;
      render();
      persist();
    });
    const name = document.createElement('span');
    name.textContent = text;
    label.append(toggle, swatch(item.color, item.enabled), name);
    return label;
  }

  enabledInput.addEventListener('change', () => {
    settings.enabled = enabledInput.checked;
    render();
    persist();
  });

  finalInclude.addEventListener('change', () => {
    settings.finalGrade.include = finalInclude.checked;
    persist();
  });

  document.getElementById('open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  render();
})();
