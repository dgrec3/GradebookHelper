/**
 * Palette color picker for the options page: a color button that opens 16
 * standard highlight colors, plus "More colors…" for the browser's full picker.
 * Teachers rarely want to hunt through hues, so the common choices are one
 * click away and the full picker is still there for anything custom.
 *
 * createColorPicker({ value, label, onChange }) → element
 *   value    "#rrggbb" starting color
 *   label    accessible name, e.g. "Band 1 color"
 *   onChange called with the new "#rrggbb" whenever a color is picked
 */
(function (global) {
  // Chosen to read well as cell highlights at the default 70% strength.
  // Includes the extension's defaults (red, yellow, green, Medical pink).
  const PALETTE = [
    ['#ff4d4d', 'Red'], ['#ff9800', 'Orange'], ['#ffc107', 'Amber'], ['#ffeb3b', 'Yellow'],
    ['#cddc39', 'Lime'], ['#8bc34a', 'Light green'], ['#4caf50', 'Green'], ['#009688', 'Teal'],
    ['#00bcd4', 'Cyan'], ['#03a9f4', 'Light blue'], ['#2196f3', 'Blue'], ['#3f51b5', 'Indigo'],
    ['#9c27b0', 'Purple'], ['#e91e63', 'Magenta'], ['#f48fb1', 'Pink'], ['#9e9e9e', 'Gray']
  ];

  // Only one palette is open at a time; opening another closes this one.
  let openPicker = null;

  function closeOpenPicker() {
    if (openPicker) openPicker.close();
  }

  document.addEventListener('click', event => {
    if (openPicker && !openPicker.root.contains(event.target)) closeOpenPicker();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && openPicker) {
      const { button } = openPicker;
      closeOpenPicker();
      button.focus();
    }
  });

  function createColorPicker({ value, label, onChange }) {
    let current = value.toLowerCase();

    const root = document.createElement('span');
    root.className = 'color-picker';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'color-button';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');

    const panel = document.createElement('div');
    panel.className = 'color-panel';
    panel.hidden = true;

    const grid = document.createElement('div');
    grid.className = 'color-grid';
    const chips = PALETTE.map(([hex, name]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'color-chip';
      chip.style.backgroundColor = hex;
      chip.title = name;
      chip.setAttribute('aria-label', name);
      chip.addEventListener('click', () => {
        choose(hex);
        picker.close();
        button.focus();
      });
      grid.append(chip);
      return { hex, chip };
    });

    // The browser's full picker, behind a "More colors…" button. The input
    // itself stays invisible; clicking the button opens its dialog.
    const custom = document.createElement('input');
    custom.type = 'color';
    custom.className = 'color-custom-input';
    custom.tabIndex = -1;
    custom.setAttribute('aria-hidden', 'true');
    custom.addEventListener('input', () => choose(custom.value));
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'color-more';
    more.textContent = 'More colors…';
    more.addEventListener('click', () => {
      custom.value = current;
      custom.click();
    });

    panel.append(grid, more, custom);
    root.append(button, panel);

    function paint() {
      button.style.backgroundColor = current;
      const named = PALETTE.find(([hex]) => hex === current);
      button.title = `${label}: ${named ? named[1] : current} (click to change)`;
      chips.forEach(({ hex, chip }) => chip.classList.toggle('selected', hex === current));
    }

    function choose(hex) {
      current = hex.toLowerCase();
      paint();
      onChange(current);
    }

    const picker = {
      root,
      button,
      open() {
        closeOpenPicker();
        panel.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        openPicker = picker;
        (chips.find(({ hex }) => hex === current)?.chip || chips[0].chip).focus();
      },
      close() {
        panel.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        if (openPicker === picker) openPicker = null;
      }
    };

    button.addEventListener('click', event => {
      event.stopPropagation(); // don't let the document listener close it again
      if (panel.hidden) picker.open(); else picker.close();
    });

    paint();
    return root;
  }

  global.createColorPicker = createColorPicker;
  global.COLOR_PALETTE = PALETTE.map(([hex]) => hex);
})(globalThis);
