/**
 * Renders an editable band ladder (lowest band first) into a container.
 * Used by the options page for both assignment and final-grade bands.
 *
 * createBandEditor(container, onChange, options) → { render(bands) }
 * onChange receives a fresh copy of the band array after every edit.
 * options.getStrength() → current color strength, so swatches and the bar
 * match the gradebook. Colors use createColorPicker (color-picker.js).
 *
 * Ladder rules (see toLadder in settings.js): band 1 starts at 0, and each
 * band starts where the previous one ends. The teacher only types where each
 * band ends; the next band's start fills in as they type. A range that should
 * stay uncolored is a band that's switched off.
 *
 * Besides the inputs, the editor shows (recomputed on every keystroke without
 * re-rendering, so the field being typed in keeps focus):
 *   - a 0–100% bar with each band's color and switched-off ranges striped gray
 *   - a "Covers 0% – 69.99%" line and any warnings under each band
 *   - an example score in each swatch (the highest whole score the band colors)
 */
(function (global) {
  // Colors offered for new bands, in order, after the default red/yellow/green.
  const NEW_BAND_COLORS = ['#2196f3', '#9c27b0', '#ff9800', '#00bcd4', '#3f51b5'];

  function createBandEditor(container, onChange, options = {}) {
    const getStrength = options.getStrength || (() => 100);
    let bands = [];

    function emit() {
      onChange(PTPSettings.cloneBands(bands));
    }

    // Band 1 starts at 0; every other band starts at the previous band's end.
    function restack() {
      bands.forEach((band, index) => { band.min = index === 0 ? 0 : bands[index - 1].max; });
    }

    function el(tag, className, text) {
      const element = document.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    }

    function numberInput(value, placeholder, label) {
      const input = el('input');
      input.type = 'number';
      input.step = 'any';
      input.placeholder = placeholder;
      input.value = value ?? '';
      input.setAttribute('aria-label', label);
      return input;
    }

    function iconButton(text, title, onClick) {
      const button = el('button', 'icon-button', text);
      button.type = 'button';
      button.title = title;
      button.setAttribute('aria-label', title);
      button.addEventListener('click', onClick);
      return button;
    }

    // The highest whole score the band colors: 69 for "up to, but not
    // including, 70"; the starting score for a band with no top (80 for "80%
    // and up"). Falls back to the start when the band is narrower than 1%.
    function exampleScore(band) {
      if (band.max === null) return band.min === null ? 'All' : String(Math.ceil(band.min));
      const top = Math.ceil(band.max) - 1;
      if (band.min !== null && top < band.min) return String(band.min);
      return String(top);
    }

    function render(newBands) {
      bands = PTPSettings.cloneBands(newBands);
      restack();
      container.replaceChildren();

      // ── 0–100% bar ──────────────────────────────────────────────────────
      const bar = el('div', 'band-bar');
      const ticks = el('div', 'band-ticks');
      const barWrap = el('div', 'band-bar-wrap');
      barWrap.setAttribute('aria-hidden', 'true'); // the row text says the same in words
      barWrap.append(bar, ticks);

      // ── Band rows, lowest first ─────────────────────────────────────────
      const list = el('div', 'band-list');
      const rows = []; // per band: { item, swatch, minInput, maxInput, coverage, warnings }

      bands.forEach((band, index) => {
        const isLast = index === bands.length - 1;
        const item = el('div', 'band-item');
        const row = el('div', 'band-row');

        const enabled = el('input');
        enabled.type = 'checkbox';
        enabled.checked = band.enabled;
        enabled.title = 'Uncheck to leave this range uncolored';
        enabled.setAttribute('aria-label', `Band ${index + 1} colored`);

        const swatch = el('span', 'swatch');
        swatch.title = 'Example score this band colors';

        // Starts are filled in for the teacher: read-only, gray.
        const minInput = numberInput(band.min, '', `Band ${index + 1} starts at this percent (set by the band above)`);
        minInput.readOnly = true;
        minInput.tabIndex = -1;
        minInput.classList.add('auto-start');
        minInput.title = index === 0 ? 'The lowest band always starts at 0%' : 'Starts where the band above ends';

        const maxInput = numberInput(band.max, isLast ? 'and up' : 'end',
          `Band ${index + 1}: up to, but not including, this percent`);
        maxInput.addEventListener('input', () => {
          band.max = maxInput.value === '' ? null : Number(maxInput.value);
          restack();
          bands.forEach((other, i) => { rows[i].minInput.value = other.min ?? ''; });
          refresh();
          emit();
        });

        const color = createColorPicker({
          value: band.color,
          label: `Band ${index + 1} color`,
          onChange: hex => {
            band.color = hex;
            refresh();
            emit();
          }
        });

        enabled.addEventListener('change', () => {
          band.enabled = enabled.checked;
          refresh();
          emit();
        });

        // Deleting a band hands its range to the band above it (the next band
        // now starts where the band above ends). The last band left can't go.
        const remove = iconButton('✕', 'Delete band', () => {
          bands.splice(index, 1);
          render(bands);
          emit();
        });
        remove.disabled = bands.length === 1;

        // "From [0]% up to, but not including, [70]%".
        const range = el('span', 'range');
        range.append(el('span', 'range-word', 'From'), minInput,
          el('span', 'range-word', '% up to, but not including,'), maxInput, el('span', 'range-word', '%'));

        row.append(enabled, swatch, range, color, remove);

        const coverage = el('div', 'band-coverage');
        const warnings = el('ul', 'band-warnings');
        item.append(row, coverage, warnings);
        list.append(item);
        rows.push({ item, swatch, minInput, maxInput, coverage, warnings });
      });

      // New bands go on top of the ladder. If the top band was "and up", it
      // gets an end 10 points higher (capped at 100) so the new band can start there.
      const add = el('button', 'secondary', '+ Add band');
      add.type = 'button';
      add.disabled = bands.length >= PTPSettings.MAX_BANDS;
      add.addEventListener('click', () => {
        const top = bands[bands.length - 1];
        if (top && top.max === null) top.max = Math.min(100, (top.min ?? 0) + 10);
        const color = NEW_BAND_COLORS[Math.max(0, bands.length - 3) % NEW_BAND_COLORS.length];
        bands.push({ enabled: true, min: top ? top.max : 0, max: null, color });
        render(bands);
        emit();
      });

      container.append(barWrap, list, add);
      refresh();

      // Recomputes everything derived from the bands. Called on every edit.
      function refresh() {
        const strength = getStrength();
        const analysis = PTPSettings.analyzeBands(bands);

        bands.forEach((band, index) => {
          const parts = rows[index];
          PTPSettings.paintSwatch(parts.swatch, band.color, strength);
          parts.swatch.textContent = exampleScore(band);
          parts.swatch.classList.toggle('muted', !band.enabled);
          parts.coverage.textContent = analysis.coverage[index];
          parts.warnings.replaceChildren(...analysis.warnings[index].map(text => el('li', '', text)));
          parts.item.classList.toggle('has-warning', analysis.warnings[index].length > 0);
          parts.item.classList.toggle('band-off', !band.enabled);
        });

        bar.replaceChildren(...analysis.segments.map(segment => {
          const piece = el('span', 'band-segment');
          piece.style.width = `${segment.to - segment.from}%`;
          const span = `${PTPSettings.formatPercent(segment.from)} – ${segment.to >= 100 ? '100%+' : PTPSettings.formatPercent(segment.to)}`;
          if (segment.winnerIndex === -1) {
            piece.classList.add('gap');
            piece.title = `${span}: no color`;
          } else {
            piece.style.backgroundColor = PTPSettings.blendOverWhite(segment.color, strength);
            piece.title = `${span}: band ${segment.winnerIndex + 1}`;
          }
          return piece;
        }));

        ticks.replaceChildren(...analysis.edges.map(edge => {
          const tick = el('span', 'band-tick', edge >= 100 ? '100' : String(Number(edge.toFixed(2))));
          tick.style.left = `${edge}%`;
          if (edge <= 0) tick.classList.add('first');
          if (edge >= 100) tick.classList.add('last');
          return tick;
        }));
      }
    }

    return { render };
  }

  global.createBandEditor = createBandEditor;
})(globalThis);
