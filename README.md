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