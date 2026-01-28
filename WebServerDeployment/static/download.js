let tables = null;

const mapping = {
  "Frequency": "freq",
  "Log Odd (base e)": "log-e",
};

function el(id) {
  return document.getElementById(id);
}

function showPopup(text) {
  const popup = document.createElement("div");
  popup.textContent = text;
  popup.style.position = "fixed";
  popup.style.bottom = "80px";
  popup.style.left = "100px";
  popup.style.transform = "translateX(-50%)";
  popup.style.backgroundColor = "rgba(0, 0, 0, 1)";
  popup.style.color = "white";
  popup.style.padding = "10px 20px";
  popup.style.borderRadius = "5px";
  popup.style.fontSize = "20px";
  popup.style.display = "none";
  popup.style.opacity = "1";
  popup.style.transition = "opacity 1s ease-out";
  popup.style.userSelect = "none";
  popup.style.zIndex = "9999";
  document.body.appendChild(popup);

  popup.style.display = "block";
  setTimeout(() => {
    popup.style.opacity = "0";
    setTimeout(() => popup.remove(), 1000);
  }, 2500);
}

function ensurePlaceholder(selectEl, text) {
  if (!selectEl) return;
  const first = selectEl.options[0];
  if (!first || first.value !== "") {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = text;
    selectEl.insertBefore(opt, selectEl.firstChild);
  }
  selectEl.value = "";
}

function setDisabled(id, disabled) {
  const node = el(id);
  if (!node) return;
  node.disabled = !!disabled;
}

function clearInner(id) {
  const node = el(id);
  if (!node) return;
  node.innerHTML = "";
}

function populateTableOptions() {
  const tableSelect = el("tableSelect");
  if (!tableSelect) return;

  tableSelect.innerHTML = "";

  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "Select table type";
  tableSelect.appendChild(ph);

  ["Frequency", "Log Odd (base e)"].forEach((label) => {
    const opt = document.createElement("option");
    opt.value = label;
    opt.textContent = label;
    tableSelect.appendChild(opt);
  });

  tableSelect.value = "";
}

function populateDownloadOptions() {
  const downloadSelect = el("downloadSelect");
  if (!downloadSelect) return;

  downloadSelect.innerHTML = "";

  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = "Select download format";
  downloadSelect.appendChild(ph);

  ["csv", "json", 'pdf', 'png', 'svg'].forEach((fmt) => {
    const opt = document.createElement("option");
    opt.value = fmt;
    opt.textContent = fmt.toUpperCase();
    downloadSelect.appendChild(opt);
  });

  downloadSelect.value = "";
}

async function saveFile() {
  const ptm = el("ptmSelect")?.value || "";
  const aa = el("aaSelect")?.value || "";
  const tableLabel = el("tableSelect")?.value || "";
  const format = el("downloadSelect")?.value || "";

  if (!ptm) return showPopup("Select a PTM first");
  if (!aa) return showPopup("Select an amino acid");
  if (!tableLabel) return showPopup("Select a table type");
  if (!format) return showPopup("Select a format");

  const tableKey = mapping[tableLabel] || tableLabel;

  fetch("/ptmkb/download", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      ptm,
      aa,
      table: tableKey,
      format,
      rounded: true,
    }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Download failed");
      return res.blob();
    })
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ptm}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch(() => showPopup("Download failed"));
}

function getSelectedTableData() {
  const ptm = el("ptmSelect")?.value || "";
  const aa = el("aaSelect")?.value || "";
  const tableLabel = el("tableSelect")?.value || "";
  if (!ptm || !aa || !tableLabel) return null;

  const tableKey = mapping[tableLabel] || tableLabel;
  return tables?.[ptm]?.[aa]?.[tableKey] || null;
}

function displayTable(data) {
  const tableLabel = el("tableSelect")?.value || "Frequency";
  const mode = mapping[tableLabel] || "freq";

  let colorMapping = () => "";
  if (mode === "freq") {
    colorMapping = (value) => {
      value = Math.min(Math.max(value, 0), 1);
      return `rgba(255, 0, 0, ${Math.min(1, value)})`;
    };
  } else if (mode === "log-e") {
    colorMapping = (value) => {
      let v = Math.exp(value);
      v = Math.min(Math.max(v, 0), 1);
      return `rgba(255, 0, 0, ${Math.min(1, v)})`;
    };
  }

  const container = el("ptmTable");
  if (!container) return;
  container.innerHTML = "";

  const table = document.createElement("table");
  table.classList.add("table", "table-bordered");
  table.style.width = "100%";
  table.style.tableLayout = "fixed";
  table.style.fontSize = "11px";
  table.style.textAlign = "center";
  table.style.marginBottom = "0";

  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  const AA = "A C D E F G H I K L M N P Q R S T V W Y".split(" ");
  const KEYS = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b));

  const headerRow = document.createElement("tr");

  const aaHeader = document.createElement("th");
  aaHeader.textContent = "Amino Acid";
  aaHeader.style.background = "#D0E0E3";
  aaHeader.style.border = "1px solid #000";
  aaHeader.style.width = "28px";
  aaHeader.style.padding = "2px";
  headerRow.appendChild(aaHeader);

  let siteIndex = 0;
  const colWidth = `${Math.floor(100 / (KEYS.length + 1))}%`;

  KEYS.forEach((key, idx) => {
    const th = document.createElement("th");
    th.textContent = key;
    th.style.background = "#A0C4FF";
    th.style.border = "1px solid #000";
    th.style.padding = "2px";
    th.style.width = colWidth;
    th.style.whiteSpace = "nowrap";
    if (parseInt(key) === 0) siteIndex = idx + 1;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);

  AA.forEach((aa) => {
    const row = document.createElement("tr");

    const rowHeader = document.createElement("th");
    rowHeader.textContent = aa;
    rowHeader.style.background = "#D0E0E3";
    rowHeader.style.border = "1px solid #000";
    rowHeader.style.padding = "2px";
    rowHeader.style.width = "28px";
    row.appendChild(rowHeader);

    KEYS.forEach((key, idx) => {
      const cell = document.createElement("td");
      const value = data[key]?.[aa];

      cell.textContent =
        typeof value === "number" ? value.toFixed(2) : "-inf";

      cell.style.border = "1px solid #000";
      cell.style.padding = "2px";
      cell.style.fontWeight = "600";
      cell.style.whiteSpace = "nowrap";
      cell.style.overflow = "hidden";
      cell.style.textOverflow = "ellipsis";

      if (idx + 1 === siteIndex) {
        cell.style.borderLeft = "2px solid #000";
        cell.style.borderRight = "2px solid #000";
      }

      if (typeof value === "number") {
        cell.style.backgroundColor = colorMapping(value);
      } else {
        cell.style.backgroundColor = "rgba(0,0,255,0.1)";
      }

      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  container.appendChild(table);
}

async function populateAminoAcids(ptm) {
  const aaSelect = el("aaSelect");
  if (!aaSelect) return;

  aaSelect.innerHTML = "";
  ensurePlaceholder(aaSelect, "Select amino acid");

  if (!ptm || !tables || !tables[ptm]) return;

  Object.keys(tables[ptm]).sort().forEach((aa) => {
    const opt = document.createElement("option");
    opt.value = aa;
    opt.textContent = aa;
    aaSelect.appendChild(opt);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!el("ptmSelect") || !el("aaSelect") || !el("tableSelect") || !el("downloadSelect") || !el("downloadButton")) {
    return;
  }

  ensurePlaceholder(el("ptmSelect"), "Select PTM");
  ensurePlaceholder(el("aaSelect"), "Select amino acid");
  ensurePlaceholder(el("tableSelect"), "Select table type");
  ensurePlaceholder(el("downloadSelect"), "Select download format");

  setDisabled("aaSelect", true);
  setDisabled("tableSelect", true);
  setDisabled("downloadSelect", true);
  setDisabled("downloadButton", true);

  tables = await fetch("/ptmkb/all_ptms_tables")
    .then((res) => res.json())
    .catch(() => null);

  if (!tables) {
    showPopup("Failed to load PTM tables");
    return;
  }

  const ptmSelect = el("ptmSelect");
  Object.keys(tables).forEach((ptm) => {
    const opt = document.createElement("option");
    opt.value = ptm;
    opt.textContent = ptm;
    ptmSelect.appendChild(opt);
  });
  ptmSelect.value = "";

  ptmSelect.onchange = async () => {
    clearInner("ptmTable");

    const ptm = ptmSelect.value || "";
    await populateAminoAcids(ptm);

    setDisabled("aaSelect", false);

    // el("tableSelect").innerHTML = "";
    ensurePlaceholder(el("tableSelect"), "Select table type");
    setDisabled("tableSelect", true);

    el("downloadSelect").innerHTML = "";
    ensurePlaceholder(el("downloadSelect"), "Select download format");
    setDisabled("downloadSelect", true);

    setDisabled("downloadButton", true);
  };

  el("aaSelect").onchange = () => {
    clearInner("ptmTable");

    populateTableOptions();
    setDisabled("tableSelect", false);

    el("downloadSelect").innerHTML = "";
    populateDownloadOptions();
    setDisabled("downloadSelect", true);

    setDisabled("downloadButton", true);
  };

  el("tableSelect").onchange = async () => {
    clearInner("ptmTable");

    populateDownloadOptions();
    setDisabled("downloadSelect", false);

    const data = getSelectedTableData();
    if (data) displayTable(data);
    else el("ptmTable").innerHTML = `<div class="alert alert-warning">No table data found.</div>`;

    setDisabled("downloadButton", true);
  };

  el("downloadSelect").onchange = () => {
    const ok =
      !!el("ptmSelect")?.value &&
      !!el("aaSelect")?.value &&
      !!el("tableSelect")?.value &&
      !!el("downloadSelect")?.value;
    setDisabled("downloadButton", !ok);
  };

  el("downloadButton").onclick = saveFile;
});