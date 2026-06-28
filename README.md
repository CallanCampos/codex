# Pokemon Size Journey

 Neal-style size exploration for Pokemon, powered by PokeAPI metadata and Project Pokemon model-render assets, rendered as a static React app.

## Stack
- React + TypeScript + Vite
- Tailwind CSS
- Framer Motion
- Three.js + `@react-three/fiber` + `@react-three/drei` (scaffold only)
- Web Audio API layered soundtrack
- Vitest + React Testing Library
- Playwright (Chromium)

## Features
- Intro gate and wheel/arrow-key journey navigation
- True side-by-side scale viewport with shared baseline and accurate relative heights
- Continuous zoom-out as Pokemon heights increase
- Auto zoom that keeps scale comparisons readable
- Jump-to-any-Pokemon search from anywhere in the journey
- Hash deep links (`/#pikachu`)
- Dynamic background blending by log(height)
- Pokemon dataset pipeline from PokeAPI plus Project Pokemon model URL mapping for the full Pokedex
- Automatic fallback between image-backed and mesh-backed model rendering paths
- Layered background music that adds instruments as you progress
- Click any visible Pokemon to play its cry
- In-app music mute/unmute control

## Getting Started
Node.js `20.19+` is recommended (Vite 7 requirement).

Enable pnpm via Corepack (if needed):
```bash
corepack enable
```

1. Install dependencies:
```bash
pnpm install
```

2. Build Pokemon dataset:
```bash
pnpm data:build
```

3. Build local 3D model assets:
```bash
pnpm models:build
```

4. Run development server:
```bash
pnpm dev
```

## Scripts
- `pnpm dev` - start local dev server
- `pnpm build` - typecheck + production build
- `pnpm preview` - preview production build
- `pnpm lint` - run ESLint
- `pnpm typecheck` - run TypeScript checks (app + scripts)
- `pnpm test` - run unit + component tests with coverage
- `pnpm test:e2e` - run Playwright E2E (includes dataset build)
- `pnpm data:build` - fetch and generate `src/data/pokemon.sorted.json`
- `pnpm data:validate` - validate dataset against schema
- `pnpm models:build` - generate full Project Pokemon model mapping in `src/data/pokemon.models3d.json`

## Data Notes
- Species count is fetched dynamically from PokeAPI at build time.
- As of February 6, 2026, PokeAPI `pokemon-species` reports 1025 species.
- Model assets are sourced from Project Pokemon (`images/sprites-models/sv-sprites-home`).
- Model mapping is generated in `src/data/pokemon.models3d.json` for all species in the dataset.
- Output is sorted from smallest to largest by `heightMeters`.

## Audio Stems (Optional)
To use your own licensed Pokemon-compatible layered music, place stems in `public/audio/`:
- `pokemon-layer-1.ogg`
- `pokemon-layer-2.ogg`
- `pokemon-layer-3.ogg`
- `pokemon-layer-4.ogg`
- `pokemon-layer-5.ogg`

If those files are absent, the app uses the built-in synthesized fallback track.

## Deploy (GitHub Pages)
A workflow is included at `.github/workflows/deploy-pages.yml`.
It builds static assets and publishes them to the `gh-pages` branch.

The workflow sets `VITE_BASE_PATH` automatically to match repository pages path.

If deployment fails on first run, confirm repository settings:
1. In GitHub, open `Settings -> Pages`.
2. Set `Source` to `Deploy from a branch`.
3. Select branch `gh-pages` and folder `/ (root)`.

## Architecture
See `docs/ARCHITECTURE.md` for engine, data pipeline, and background details.


(async () => {
  /************************************************************
   * 1) PASTE YOUR EMPLOYEE IDS HERE
   *    You can paste one per line. No commas or quotes needed.
   ************************************************************/
  const IDS_TEXT = `
PT44821
PP71731
PT45276
`;

  /************************************************************
   * 2) SET PERIOD
   ************************************************************/
  const YEAR = "2026";
  const PERIOD = "06-JUN";

  /************************************************************
   * 3) SETTINGS
   ************************************************************/
  const MAX_WAIT_MS = 45000;          // max wait per employee before marking error
  const BETWEEN_EMPLOYEES_MS = 750;   // small pause between employees
  const DOWNLOAD_CSV = true;          // creates one CSV at the end
  const COPY_TO_CLIPBOARD = true;     // copies Excel-ready table at the end

  /************************************************************
   * 4) HELPERS
   ************************************************************/
  const IDS = [...new Set((IDS_TEXT.match(/[A-Z]{2}\d+/g) || []))];

  const clean = s =>
    String(s == null ? "" : s)
      .replace(/\s+/g, " ")
      .trim();

  const safe = s =>
    clean(s)
      .replace(/\t/g, " ")
      .replace(/\r?\n/g, " ");

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  function makeUrl(employeeId) {
    const u = new URL(location.href);
    u.searchParams.set("p_LogonID Picklist", employeeId);
    u.searchParams.set("p_Performance Period", `${YEAR}, ${PERIOD}`);
    return u.href;
  }

  function parseNumber(s) {
    return clean(s).replace(/[$,]/g, "");
  }

  function getRevenueRowData(doc) {
    const grids = Array.from(doc.querySelectorAll(".ag-root-wrapper, .ag-root"));

    for (const grid of grids) {
      const gridText = grid.innerText || "";

      if (
        !gridText.includes("Component") ||
        !gridText.includes("Revenue Credit") ||
        !gridText.includes("Payout Factor")
      ) {
        continue;
      }

      const row = Array.from(grid.querySelectorAll(".ag-row")).find(r =>
        (r.innerText || "").includes("Revenue Credit")
      );

      if (!row) continue;

      const cells = Array.from(row.querySelectorAll(".ag-cell"))
        .map(c => clean(c.innerText || c.textContent))
        .filter(Boolean);

      const hasTier = cells.some(x => /^Tier\s*\d/i.test(x));
      const hasRevenueNumber = cells.some(x => /^[\d,]+\.\d{2,4}$/.test(x) && !/^0\.\d+$/.test(x));
      const hasPayoutFactor = cells.some(x => /^0\.\d+$/i.test(x));
      const hasCalculatedIncentive = cells.some(x => /^\$[\d,]+\.\d{2}$/.test(x));

      if (cells.length >= 5 && hasTier && hasRevenueNumber && hasPayoutFactor && hasCalculatedIncentive) {
        return { grid, row, cells };
      }
    }

    return null;
  }

  function waitForRevenueData(doc, timeoutMs = MAX_WAIT_MS) {
    return new Promise((resolve, reject) => {
      let observer;
      let interval;
      let timeout;
      let scrollStep = 0;

      const cleanup = () => {
        if (observer) observer.disconnect();
        if (interval) clearInterval(interval);
        if (timeout) clearTimeout(timeout);
      };

      const check = () => {
        try {
          const found = getRevenueRowData(doc);

          if (found) {
            cleanup();
            resolve(found);
            return;
          }

          // Helps trigger lazy-rendered report sections inside the offscreen frame.
          const win = doc.defaultView;
          if (win && doc.body) {
            const scrollPoints = [0, 400, 800, 1200, 1600, 2000];
            win.scrollTo(0, scrollPoints[scrollStep % scrollPoints.length]);
            scrollStep++;
          }
        } catch (e) {
          // keep waiting
        }
      };

      observer = new MutationObserver(check);
      observer.observe(doc.body || doc.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });

      interval = setInterval(check, 300);

      timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for Revenue Credit data."));
      }, timeoutMs);

      check();
    });
  }

  async function loadEmployeeDoc(employeeId) {
    const frame = document.createElement("iframe");

    frame.style.position = "fixed";
    frame.style.left = "-5000px";
    frame.style.top = "0";
    frame.style.width = "2400px";
    frame.style.height = "3200px";
    frame.style.opacity = "0.01";
    frame.style.pointerEvents = "none";
    frame.setAttribute("aria-hidden", "true");

    document.body.appendChild(frame);

    await new Promise((resolve, reject) => {
      frame.onload = resolve;
      frame.onerror = reject;
      frame.src = makeUrl(employeeId);
    });

    await waitForRevenueData(frame.contentDocument);

    return {
      doc: frame.contentDocument,
      frame
    };
  }

  function scrapeEmployee(doc, fallbackId) {
    const txt = doc.body.innerText || "";
    const revenueData = getRevenueRowData(doc);

    if (!revenueData) {
      throw new Error("Could not find complete Revenue Credit row.");
    }

    const cells = revenueData.cells;

    const employeeText = clean(
      (txt.match(/\([A-Z]{2}\d+\)\s*[^\n\r]+/) || [fallbackId])[0]
    );

    const idMatch = employeeText.match(/[A-Z]{2}\d+/);
    const employeeId = idMatch ? idMatch[0] : fallbackId;

    let employeeName = clean(employeeText.replace(/^\([A-Z]{2}\d+\)\s*/, ""));
    let firstName = "";
    let lastName = "";

    if (employeeName.includes(",")) {
      const parts = employeeName.split(",");
      lastName = clean(parts[0]);
      firstName = clean(parts.slice(1).join(","));
    }

    let branch = clean((txt.match(/Branch:\s*([^\n\r]+)/) || [])[1] || "");
    branch = branch.replace(/\s+Traditional.*$/i, "");

    const jobTitle = clean(
      (txt.match(/Current Assignment\s*:\s*([^\n\r]+)/) || [])[1] || ""
    );

    const component = cells[0] || "Revenue Credit Production";
    const tier = cells.find(x => /^Tier\s*\d/i.test(x)) || "";

    const currency = cells.find(x => /^\$[\d,]+\.\d{2}$/.test(x)) || "";

    const payoutFactor = cells.find(x => /^0\.\d+$/i.test(x)) || "";

    const revenueNumbers = cells.filter(x =>
      /^[\d,]+\.\d{2,4}$/.test(x) && !/^0\.\d+$/.test(x)
    );

    const totalRevenueCredits = revenueNumbers[0] || "";

    return {
      Branch: branch,
      FirstName: firstName,
      LastName: lastName,
      JobTitle: jobTitle,
      TotalRevenueCredits: parseNumber(totalRevenueCredits),
      Comments: tier ? `Hit ${tier}` : "",
      HitTier: tier,
      CalculatedIncentive: parseNumber(currency),
      PayoutFactor: payoutFactor,
      EmployeeID: employeeId,
      EmployeeName: employeeName,
      Component: component,
      Period: `${YEAR} ${PERIOD}`
    };
  }

  function makeTSV(rows, headers) {
    return [
      headers.join("\t"),
      ...rows.map(row => headers.map(h => safe(row[h])).join("\t"))
    ].join("\n");
  }

  function makeCSV(rows, headers) {
    const csvEscape = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;

    return [
      headers.map(csvEscape).join(","),
      ...rows.map(row => headers.map(h => csvEscape(row[h])).join(","))
    ].join("\n");
  }

  /************************************************************
   * 5) MAIN RUN
   ************************************************************/
  if (!IDS.length) {
    alert("No employee IDs found in IDS_TEXT.");
    return;
  }

  const rows = [];
  const errors = [];

  console.log(`Starting Varicent scrape for ${IDS.length} employees...`);

  for (let index = 0; index < IDS.length; index++) {
    const id = IDS[index];
    let frame;

    try {
      console.log(`Loading ${index + 1}/${IDS.length}: ${id}`);

      const loaded = await loadEmployeeDoc(id);
      frame = loaded.frame;

      const row = scrapeEmployee(loaded.doc, id);
      rows.push(row);

      console.log(`Scraped ${id}:`, row);
    } catch (err) {
      console.error(`Failed ${id}:`, err.message);
      errors.push({
        EmployeeID: id,
        Error: err.message
      });
    } finally {
      if (frame) frame.remove();
    }

    await delay(BETWEEN_EMPLOYEES_MS);
  }

  const headers = [
    "Branch",
    "FirstName",
    "LastName",
    "JobTitle",
    "TotalRevenueCredits",
    "Comments",
    "HitTier",
    "CalculatedIncentive",
    "PayoutFactor",
    "EmployeeID",
    "EmployeeName",
    "Component",
    "Period"
  ];

  const tsv = makeTSV(rows, headers);
  const csv = makeCSV(rows, headers);

  if (COPY_TO_CLIPBOARD) {
    copy(tsv);
  }

  if (DOWNLOAD_CSV) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `varicent_all_employees_${YEAR}_${PERIOD}.csv`;
    a.click();
  }

  console.table(rows);

  if (errors.length) {
    console.warn("Errors:");
    console.table(errors);
  }

  alert(
    `Done.\n\nScraped: ${rows.length}\nFailed: ${errors.length}\n\n` +
    `The results were copied to clipboard${DOWNLOAD_CSV ? " and downloaded as CSV" : ""}.`
  );
})();