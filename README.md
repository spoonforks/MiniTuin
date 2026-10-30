# MiniTuin

A little interactive backyard, made with plain HTML, CSS, JavaScript, and photographic cutouts.

## Open the garden

Download or copy this folder, then double-click **`index.html`** in a modern browser. Keep `assets/`, `styles.css`, `layout.js`, and `app.js` alongside it. No installation, build, internet connection, or backend is needed.

The button in the upper-right corner opens the controls. Adjust animal and plant counts, temperature, ground wetness, rain, and daylight. **Randomize variables** picks fresh values for all six sliders within their ranges and updates the scene immediately. Temperature and the local 24-hour clock can each be hidden; randomizing preserves these visibility preferences. Trees are included in the plant count and grow only in the back row. A bee occasionally flies across independently of the controls.

The background fills the window and crops at the sides or top as needed. Sprites shrink together in crowded scenes to preserve spacing. Reloading restores the initial garden: 4 animals, 5 plants, 20°C, dry ground, no rain, and full daylight.

Controls work with a keyboard: Tab to the control button, Enter to open, Tab between controls, arrow keys to adjust sliders, Space to toggle switches, and Escape to close. Reduced-motion preferences disable animal and bee movement and show rain as a still overlay. Animations pause when the page is hidden.

## Development and checks

There is no application build step. `layout.js` contains the pure placement geometry; `app.js` handles controls, rendering, weather, and animation.

Run the geometry tests with Node.js 20 or later:

```sh
node tests/layout.test.cjs
```

Browser checks use Playwright (tested with 1.62.1) and Chromium. If they are not already installed, install test tooling separately from the application:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node tests/browser.cjs
```

The browser suite opens the application through `file://` by default. Set `BROWSER_EXECUTABLE` to use an existing Chromium installation. In managed environments whose browser policy blocks local file URLs, use the explicit HTTP fallback:

```sh
BROWSER_EXECUTABLE=/usr/bin/chromium node tests/browser.cjs --http
```

That flag starts a temporary loopback server for the test and shuts it down afterward. It validates the application but does **not** establish that `file://` works under the managed browser's policy. Screenshots from the browser suite are written to the system temporary directory.

The tests cover all 121 count combinations, placement and motion bounds at six viewport sizes, resizing and count changes, control interactions, weather, a complete bee flight, clock updates, reduced motion, visibility pause/resume, reload defaults, and absence of external requests.

## Artwork

The nine original PNGs in `assets/` are copied unchanged from the supplied `Dboard/UseThese` folder. `bee.png` is an additional generated realistic cutout. Reference compositions, the Photoshop source, and source photographs are not required at runtime.
