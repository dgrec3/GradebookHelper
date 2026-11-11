/**
 * Full settings page: band editors, final grade, score codes, row aids and
 * flag tag options.
 * Every edit saves automatically (debounced so dragging a color picker
 * doesn't hit chrome.storage.sync's write-rate limit).
 */
(async function () {
  const SAVE_DEBOUNCE_MS = 300;

  let settings = await PTPSettings.load();
  let saveTimer = null;

  const enabledInput = document.getElementById('enabled');
  const finalInclude = document.getElementById('final-include');
  const finalSame = document.getElementById('final-same');
  const finalOptions = document.getElementById('final-options');
  const finalBandsContainer = document.getElementById('final-bands');
  const scoreCodesContainer = document.getElementById('score-codes');
  const flagTags = document.getElementById('flag-tags');
  const flagTagStyle = document.getElementById('flag-tag-style');
  const flagTagLength = document.getElementById('flag-tag-length');
  const colorStrength = document.getElementById('color-strength');
  const colorStrengthValue = document.getElementById('color-strength-value');
  const rowHover = document.getElementById('row-hover');
  const rowDividers = document.getElementById('row-dividers');
  const lineDarkness = document.getElementById('line-darkness');
  const lineDarknessRow = document.getElementById('line-darkness-row');
  const commentBadge = document.getElementById('comment-badge');
  const saveStatus = document.getElementById('save-status');

  const assignmentEditor = createBandEditor(document.getElementById('assignment-bands'), bands => {
    settings.assignmentBands = bands;
    scheduleSave();
  }, { getStrength: () => settings.colorStrength });
  const finalEditor = createBandEditor(finalBandsContainer, bands => {
    settings.finalGrade.bands = bands;
    scheduleSave();
  }, { getStrength: () => settings.colorStrength });

  function scheduleSave() {
    saveStatus.textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      try {
        await PTPSettings.save(settings);
        saveStatus.textContent = 'Saved';
      } catch (error) {
        saveStatus.textContent = 'Could not save — try again';
        console.error('[Gradebook Enhancer] Save failed.', error);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  function renderScoreCodes() {
    scoreCodesContainer.replaceChildren();

    const list = document.createElement('div');
    list.className = 'band-list';

    settings.scoreCodes.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'band-row';

      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = entry.enabled;
      toggle.setAttribute('aria-label', `Score code ${index + 1} on`);

      // The swatch shows the code itself, as it will look in the gradebook.
      const swatch = document.createElement('span');
      swatch.className = 'swatch';

      const code = document.createElement('input');
      code.type = 'text';
      code.className = 'code-input';
      code.maxLength = PTPSettings.MAX_CODE_LENGTH;
      code.placeholder = 'Code';
      code.value = entry.code;
      code.setAttribute('aria-label', `Score code ${index + 1} code`);

      const label = document.createElement('input');
      label.type = 'text';
      label.className = 'label-input';
      label.maxLength = PTPSettings.MAX_LABEL_LENGTH;
      label.placeholder = 'Label (e.g. Medical)';
      label.value = entry.label;
      label.setAttribute('aria-label', `Score code ${index + 1} label`);

      // paint() is defined below; the picker only calls it after a click.
      const color = createColorPicker({
        value: entry.color,
        label: `Score code ${index + 1} color`,
        onChange: hex => {
          entry.color = hex;
          paint();
          scheduleSave();
        }
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-button';
      remove.textContent = '✕';
      remove.title = 'Delete code';
      remove.setAttribute('aria-label', 'Delete code');

      function paint() {
        swatch.textContent = entry.code.trim().toUpperCase() || '?';
        PTPSettings.paintSwatch(swatch, entry.color, settings.colorStrength);
        swatch.classList.toggle('muted', !entry.enabled);
      }

      toggle.addEventListener('change', () => {
        entry.enabled = toggle.checked;
        paint();
        scheduleSave();
      });
      code.addEventListener('input', () => {
        entry.code = code.value;
        paint();
        scheduleSave();
      });
      label.addEventListener('input', () => {
        entry.label = label.value;
        scheduleSave();
      });
      remove.addEventListener('click', () => {
        settings.scoreCodes.splice(index, 1);
        renderScoreCodes();
        scheduleSave();
      });

      paint();
      row.append(toggle, swatch, code, label, color, remove);
      list.append(row);
    });

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'secondary';
    add.textContent = '+ Add code';
    add.disabled = settings.scoreCodes.length >= PTPSettings.MAX_SCORE_CODES;
    add.addEventListener('click', () => {
      settings.scoreCodes.push({ enabled: true, code: '', label: '', color: '#b0bec5' });
      renderScoreCodes();
      scheduleSave();
    });

    scoreCodesContainer.append(list, add);
  }

  function renderFinalVisibility() {
    finalOptions.hidden = !settings.finalGrade.include;
    finalBandsContainer.hidden = settings.finalGrade.useAssignmentBands;
  }

  function renderAll() {
    enabledInput.checked = settings.enabled;
    flagTags.checked = settings.flagTags;
    flagTagStyle.value = settings.flagTagStyle;
    flagTagLength.value = settings.flagTagLength;
    colorStrength.value = String(settings.colorStrength);
    colorStrengthValue.textContent = `${settings.colorStrength}%`;
    rowHover.checked = settings.rowHover;
    rowDividers.value = settings.rowDividers;
    lineDarkness.value = String(settings.lineDarkness);
    // No lines → nothing to darken.
    lineDarkness.disabled = settings.rowDividers === 'off';
    lineDarknessRow.classList.toggle('muted-section', settings.rowDividers === 'off');
    commentBadge.checked = settings.commentBadge;
    finalInclude.checked = settings.finalGrade.include;
    finalSame.checked = settings.finalGrade.useAssignmentBands;
    assignmentEditor.render(settings.assignmentBands);
    finalEditor.render(settings.finalGrade.bands);
    renderScoreCodes();
    renderFinalVisibility();
  }

  enabledInput.addEventListener('change', () => {
    settings.enabled = enabledInput.checked;
    scheduleSave();
  });

  flagTagLength.addEventListener('change', () => {
    settings.flagTagLength = flagTagLength.value;
    scheduleSave();
  });

  flagTagStyle.addEventListener('change', () => {
    settings.flagTagStyle = flagTagStyle.value;
    scheduleSave();
  });

  // Re-render while dragging so every swatch previews the new strength.
  colorStrength.addEventListener('input', () => {
    settings.colorStrength = Number(colorStrength.value);
    renderAll();
    scheduleSave();
  });

  rowHover.addEventListener('change', () => {
    settings.rowHover = rowHover.checked;
    scheduleSave();
  });

  commentBadge.addEventListener('change', () => {
    settings.commentBadge = commentBadge.checked;
    scheduleSave();
  });

  rowDividers.addEventListener('change', () => {
    settings.rowDividers = rowDividers.value;
    lineDarkness.disabled = settings.rowDividers === 'off';
    lineDarknessRow.classList.toggle('muted-section', settings.rowDividers === 'off');
    scheduleSave();
  });

  // Saves while dragging (debounced), so an open scoresheet updates live.
  lineDarkness.addEventListener('input', () => {
    settings.lineDarkness = Number(lineDarkness.value);
    scheduleSave();
  });

  flagTags.addEventListener('change', () => {
    settings.flagTags = flagTags.checked;
    scheduleSave();
  });

  finalInclude.addEventListener('change', () => {
    settings.finalGrade.include = finalInclude.checked;
    renderFinalVisibility();
    scheduleSave();
  });

  finalSame.addEventListener('change', () => {
    settings.finalGrade.useAssignmentBands = finalSame.checked;
    // Switching to separate bands starts from a copy of the current assignment bands.
    if (!finalSame.checked) {
      settings.finalGrade.bands = PTPSettings.cloneBands(settings.assignmentBands);
      finalEditor.render(settings.finalGrade.bands);
    }
    renderFinalVisibility();
    scheduleSave();
  });

  document.getElementById('reset').addEventListener('click', () => {
    if (!confirm('Reset all highlight settings to the defaults?')) return;
    settings = PTPSettings.getDefaults();
    renderAll();
    scheduleSave();
  });

  // Keep this page in sync if the popup changes something while it's open.
  PTPSettings.onChange(newSettings => {
    if (saveTimer) return; // our own pending edit is newer
    // Our own saves echo back here too; re-rendering would steal focus for nothing.
    if (JSON.stringify(newSettings) === JSON.stringify(PTPSettings.normalize(settings))) return;
    const focused = document.activeElement;
    if (focused && focused.matches('input[type=number], input[type=text]')) return; // don't yank a field mid-typing
    settings = newSettings;
    renderAll();
  });

  renderAll();
})();
