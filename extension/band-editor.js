/**
 * Renders an editable list of highlight bands (min / max / color) into a container.
 * Used by the options page for both assignment and final-grade bands.
 *
 * createBandEditor(container, onChange) → { render(bands) }
 * onChange receives a fresh copy of the band array after every edit.
 */
(function (global) {
  // getStrength() returns the current color strength so swatches match the gradebook.
  function createBandEditor(container, onChange, getStrength = () => 100) {
    let bands = [];

    function emit() {
      onChange(PTPSettings.cloneBands(bands));
    }

    function numberInput(value, placeholder, label, onInput) {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.placeholder = placeholder;
      input.value = value ?? '';
      input.setAttribute('aria-label', label);
      input.addEventListener('input', () => onInput(input.value === '' ? null : Number(input.value)));
      return input;
    }

    function iconButton(text, title, disabled, onClick) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'icon-button';
      button.textContent = text;
      button.title = title;
      button.setAttribute('aria-label', title);
      button.disabled = disabled;
      button.addEventListener('click', onClick);
      return button;
    }

    function updateSwatch(swatch, band) {
      PTPSettings.paintSwatch(swatch, band.color, getStrength());
      swatch.classList.toggle('muted', !band.enabled);
    }

    function render(newBands) {
      bands = PTPSettings.cloneBands(newBands);
      container.replaceChildren();

      const list = document.createElement('div');
      list.className = 'band-list';

      bands.forEach((band, index) => {
        const row = document.createElement('div');
        row.className = 'band-row';

        const enabled = document.createElement('input');
        enabled.type = 'checkbox';
        enabled.checked = band.enabled;
        enabled.setAttribute('aria-label', `Band ${index + 1} on`);

        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.textContent = '85';

        const minInput = numberInput(band.min, 'no min', `Band ${index + 1} minimum percent`, value => {
          band.min = value;
          refreshIssues();
          emit();
        });
        const maxInput = numberInput(band.max, 'no max', `Band ${index + 1} maximum percent`, value => {
          band.max = value;
          refreshIssues();
          emit();
        });

        const color = document.createElement('input');
        color.type = 'color';
        color.value = band.color;
        color.setAttribute('aria-label', `Band ${index + 1} color`);
        color.addEventListener('input', () => {
          band.color = color.value;
          updateSwatch(swatch, band);
          emit();
        });

        enabled.addEventListener('change', () => {
          band.enabled = enabled.checked;
          updateSwatch(swatch, band);
          refreshIssues();
          emit();
        });

        // Reordering changes which band wins on overlap, so it re-renders.
        const up = iconButton('↑', 'Move up', index === 0, () => move(index, -1));
        const down = iconButton('↓', 'Move down', index === bands.length - 1, () => move(index, 1));
        const remove = iconButton('✕', 'Delete band', false, () => {
          bands.splice(index, 1);
          render(bands);
          emit();
        });

        const range = document.createElement('span');
        range.className = 'range';
        range.append(minInput, document.createTextNode('% to '), maxInput, document.createTextNode('%'));

        updateSwatch(swatch, band);
        row.append(enabled, swatch, range, color, up, down, remove);
        list.append(row);
      });

      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'secondary';
      add.textContent = '+ Add band';
      add.disabled = bands.length >= PTPSettings.MAX_BANDS;
      add.addEventListener('click', () => {
        // Start the new band where the highest band ends so it rarely overlaps.
        const highestMax = bands.reduce((max, band) => Math.max(max, band.max ?? 0), 0);
        bands.push({ enabled: true, min: highestMax, max: null, color: '#4caf50' });
        render(bands);
        emit();
      });

      const issues = document.createElement('ul');
      issues.className = 'issues';

      container.append(list, add, issues);
      refreshIssues();

      function refreshIssues() {
        issues.replaceChildren(
          ...PTPSettings.describeBandIssues(bands).map(text => {
            const item = document.createElement('li');
            item.textContent = text;
            return item;
          })
        );
      }
    }

    function move(index, direction) {
      const [band] = bands.splice(index, 1);
      bands.splice(index + direction, 0, band);
      render(bands);
      emit();
    }

    return { render };
  }

  global.createBandEditor = createBandEditor;
})(globalThis);
