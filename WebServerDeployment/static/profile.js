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

function toast(msg) {
  const el = document.getElementById("toastish");
  if (!el) return showPopup(msg);
  el.textContent = msg;
  el.style.display = "block";
  el.style.opacity = "1";
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => {
      el.style.display = "none";
      el.style.opacity = "1";
    }, 900);
  }, 2000);
}

// ---------------- BASIC HELPERS ----------------

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// Minimal JWT payload decode (no verification; for display only)
function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ---------------- PROFILE LOGIN (NO STATUS/SESSION UI) ----------------

function requireLoginOrRedirect() {
  const raw = sessionStorage.getItem("user");
  const user = safeJsonParse(raw);

  const usernameEl = document.getElementById("profileUsername");
  const tokenStatusEl = document.getElementById("tokenFetchStatus");
  const tokenBox = document.getElementById("tokenBox");

  if (!user || !user.username) {
    if (usernameEl) usernameEl.textContent = "—";
    if (tokenStatusEl) tokenStatusEl.textContent = "Login required";
    if (tokenBox) tokenBox.value = "";
    disableCopyButton(true);
    setExpiryText("—", false);
    return null;
  }

  if (usernameEl) usernameEl.textContent = user.username;
  return user.username;
}

// ---------------- TOKEN MASKING + EXPIRY STATE ----------------

let __rawToken = null;       // actual token (never displayed)
let __expiresAt = null;      // epoch seconds from payload.expires
let __expiryInterval = null; // interval id

function maskToken(token) {
  if (!token) return "";
  const head = token.slice(0, 10);
  const tail = token.slice(-10);
  if (token.length <= 25) return token; // edge case
  return head + "*".repeat(token.length - 20) + tail;
}

function setExpiryText(text, expired) {
  const expiryEl = document.getElementById("profileExpiry");
  if (!expiryEl) return;
  expiryEl.textContent = text;
  if (expired) expiryEl.classList.add("token-expired");
  else expiryEl.classList.remove("token-expired");
}

function disableCopyButton(disabled) {
  const btn = document.getElementById("btnCopyToken");
  if (btn) btn.disabled = !!disabled;
}

function isTokenExpired() {
  if (!__expiresAt) return false;
  const now = Math.floor(Date.now() / 1000);
  return now >= __expiresAt;
}

function setExpiredUI() {
  setExpiryText("TOKEN EXPIRED", true);
  disableCopyButton(true);
}

function setValidUI() {
  if (__expiresAt) {
    const d = new Date(__expiresAt * 1000);
    setExpiryText(d.toLocaleString(), false);
  } else {
    setExpiryText("—", false);
  }
  disableCopyButton(false);
}

function startExpiryWatcher() {
  if (__expiryInterval) clearInterval(__expiryInterval);
  __expiryInterval = setInterval(() => {
    if (!__rawToken || !__expiresAt) return;
    if (isTokenExpired()) setExpiredUI();
  }, 1000);
}

function assignToken(token) {
  __rawToken = token || null;

  // display masked token only
  const tokenBox = document.getElementById("tokenBox");
  if (tokenBox) tokenBox.value = __rawToken ? maskToken(__rawToken) : "";

  // decode expires from payload.expires
  const payload = __rawToken ? decodeJwtPayload(__rawToken) : null;
  const exp = payload && payload.expires ? Number(payload.expires) : null;
  __expiresAt = Number.isFinite(exp) ? exp : null;

  if (!__rawToken) {
    setExpiryText("—", false);
    disableCopyButton(true);
    return;
  }

  // update UI based on expiry
  if (__expiresAt && isTokenExpired()) {
    setExpiredUI();
  } else {
    setValidUI();
  }

  startExpiryWatcher();
}

// Prevent copying token from textarea (must use Copy Token button)
function lockDownTokenBox() {
  const tokenBox = document.getElementById("tokenBox");
  if (!tokenBox) return;

  // block context menu
  tokenBox.addEventListener("contextmenu", (e) => e.preventDefault());

  // block copy/cut/paste
  tokenBox.addEventListener("copy", (e) => {
    e.preventDefault();
    toast("Use Copy Token button");
  });
  tokenBox.addEventListener("cut", (e) => e.preventDefault());
  tokenBox.addEventListener("paste", (e) => e.preventDefault());

  // prevent selection highlight behavior
  tokenBox.addEventListener("mousedown", (e) => {
    e.preventDefault();
    tokenBox.blur();
  });

  // block Ctrl/Cmd+C
  tokenBox.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      e.preventDefault();
      toast("Use Copy Token button");
    }
  });
}

// ---------------- TOKEN API CALLS ----------------

async function fetchToken(username) {
  const tokenStatusEl = document.getElementById("tokenFetchStatus");
  if (tokenStatusEl) tokenStatusEl.textContent = "Fetching…";

  const res = await fetch("/ptmkb/fetch_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  })
    .then((r) => r.json())
    .catch(() => null);

  const token = res && res.token ? res.token : null;

  if (!token) {
    if (tokenStatusEl) tokenStatusEl.textContent = "Failed to retrieve token";
    assignToken(null);
    return null;
  }

  if (tokenStatusEl) tokenStatusEl.textContent = "Loaded";
  assignToken(token);
  return token;
}

async function resetToken(username) {
  const res = await fetch("/ptmkb/reset_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  })
    .then((r) => r.json())
    .catch(() => null);

  if (!res || !res.reset || !res.token) {
    toast("Reset failed");
    return null;
  }

  assignToken(res.token);

  // Do NOT auto-copy anymore (user can only copy via button)
  toast("Token reset");
  return res.token;
}

// ---------------- HISTORY (UNCHANGED FROM YOUR FILE) ----------------

/**
 * REPLACE THIS ENTIRE OBJECT with the FULL `ptmColorMapping` from search.js
 * so the colors match your Search PTM Sequence tab exactly.
 */
const ptmColorMapping = {
  "Acetylation": "#D94F37",
  "Phosphorylation": "#1A7EC7",
  "Ubiquitination": "#2A8B2A",
  "Methylation": "#D33600",
  "Oxidation": "#D10000",
  "Sumoylation": "#1E6B1E",
  "Dephosphorylation": "#6A1DB0",
  "ADP-ribosylation": "#F28C9D",
  "Amidation": "#F13E9C",
  "AMPylation": "#E4007D",
  "Biotinylation": "#C085C7",
  "Blocked amino end": "#D16ED2",
  "Butyrylation": "#C155C0",
  "C-linked Glycosylation": "#A850C0",
  "Carbamidation": "#8826B9",
  "Carboxyethylation": "#7326B0",
  "Carboxylation": "#6A4FD5",
  "Cholesterol ester": "#3A5BAE",
  "Citrullination": "#6FA8D7",
  "Crotonylation": "#96BFE7",
  "D-glucuronoylation": "#A2C8D9",
  "Deamidation": "#9BDBDB",
  "Deamination": "#00B0A5",
  "Decanoylation": "#34D0BD",
  "Decarboxylation": "#3EACB2",
  "Disulfide bond": "#00BFBF",
  "Farnesylation": "#00E466",
  "Formation of an isopeptide bond": "#72E700",
  "Formylation": "#9BEB2F",
  "Gamma-carboxyglutamic acid": "#8CEB8C",
  "Geranylgeranylation": "#7ADA7A",
  "Glutarylation": "#00D98D",
  "Glutathionylation": "#2FB932",
  "GPI-anchor": "#329756",
  "Hydroxyceramide ester": "#58B69E",
  "Hydroxylation": "#1B9C91",
  "Iodination": "#7C9B86",
  "Lactoylation": "#D1F2D1",
  "Lactylation": "#D9F8F3",
  "Lipoylation": "#C2FFFF",
  "Malonylation": "#D1E8FF",
  "Myristoylation": "#E4E4E4",
  "N-carbamoylation": "#FFE3F0",
  "N-linked Glycosylation": "#F0C9D0",
  "N-palmitoylation": "#F7E68A",
  "Neddylation": "#F6E497",
  "Nitration": "#FFFFB3",
  "O-linked Glycosylation": "#E2C300",
  "O-palmitoleoylation": "#E1D45A",
  "O-palmitoylation": "#E2C300",
  "Octanoylation": "#F2D093",
  "Phosphatidylethanolamine amidation": "#F7E1DD",
  "Propionylation": "#F7D0D0",
  "Pyrrolidone carboxylic acid": "#E8C08D",
  "Pyrrolylation": "#F1C397",
  "Pyruvate": "#F4D0A9",
  "S-archaeol": "#D1E8FF",
  "S-carbamoylation": "#E1D45A",
  "S-Cyanation": "#C9A7D9",
  "S-cysteinylation": "#D1C9E6",
  "S-diacylglycerol": "#B8B8B8",
  "S-linked Glycosylation": "#A1B7D1",
  "S-nitrosylation": "#A3A3A3",
  "S-palmitoylation": "#A8A8A8",
  "Serotonylation": "#C7C7C7",
  "Stearoylation": "#F2F2F2",
  "Succinylation": "#E5E5E5",
  "Sulfation": "#A7C8D9",
  "Sulfhydration": "#C7C7C7",
  "Sulfoxidation": "#B8B8B8",
  "Thiocarboxylation": "#D9F8F3",
  "UMPylation": "#A3A3A3"
};

function splitSequence(sequence) {
  const chunks = [];
  for (let i = 0; i < sequence.length; i += 10) chunks.push(sequence.slice(i, i + 10));
  let total = 0;
  return chunks.map((s) => {
    total += s.length;
    return [s, total];
  });
}

function renderPTMSequence(seqContainerEl, sequence, ptms) {
  seqContainerEl.innerHTML = "";
  const blocks = splitSequence(sequence);

  blocks.forEach((block, blockIndex) => {
    const blockDiv = document.createElement("div");
    blockDiv.classList.add("sequence-block");

    const sequenceText = document.createElement("span");
    sequenceText.classList.add("sequence-text");

    const ptmsAtPositions = {};

    block[0].split("").forEach((char, index) => {
      const charSpan = document.createElement("span");
      charSpan.textContent = char;

      const charIndex = blockIndex * 10 + index; // 0-indexed

      for (const mod of ptms) {
        if (!Array.isArray(mod) || mod.length < 2) continue;

        const pos = mod[0];
        const typ = mod[1];

        if (pos === charIndex + 1) {
          if (!ptmsAtPositions[charIndex]) ptmsAtPositions[charIndex] = [];
          ptmsAtPositions[charIndex].push(typ);

          let existing = charSpan.getAttribute("data-ptm") || "";
          if (existing) {
            if (!existing.split(";").includes(typ)) existing += `;${typ}`;
          } else {
            existing = typ;
          }
          charSpan.setAttribute("data-ptm", existing);
        }
      }

      let ptmTypes = ptmsAtPositions[charIndex] || [];
      ptmTypes = Array.from(new Set(ptmTypes));

      if (ptmTypes.length > 0) {
        const colors = ptmTypes.map((t) => ptmColorMapping[t] || "#f39c12");
        charSpan.classList.add("highlighted");

        if (colors.length > 1) {
          const pct = 100 / colors.length;
          const gradient = colors
            .map((c, i) => `${c} ${i * pct}% ${(i + 1) * pct}%`)
            .join(", ");
          charSpan.style.background = `linear-gradient(to bottom, ${gradient})`;
          charSpan.style.backgroundSize = "100% 100%";
        } else {
          charSpan.style.backgroundColor = colors[0];
        }
      }

      sequenceText.appendChild(charSpan);
    });

    const blockNumber = document.createElement("span");
    blockNumber.classList.add("block-number");
    blockNumber.textContent = block[1];

    blockDiv.appendChild(sequenceText);
    blockDiv.appendChild(blockNumber);
    seqContainerEl.appendChild(blockDiv);
  });
}

function fmtDate(d) {
  const raw = d && typeof d === "object" && "$date" in d ? d.$date : d;
  const dt = new Date(raw);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleString();
}
 
function countRefs(refStr) {
  if (!refStr || typeof refStr !== "string") return 0;
  return refStr.split(";").filter(Boolean).length;
}

function makePtmColorDot(type) {
  const c = ptmColorMapping[type] || "#f39c12";
  const dot = document.createElement("span");
  dot.style.display = "inline-block";
  dot.style.width = "10px";
  dot.style.height = "10px";
  dot.style.borderRadius = "999px";
  dot.style.background = c;
  dot.style.marginRight = "8px";
  dot.style.border = "1px solid rgba(0,0,0,0.15)";
  return dot;
}

function renderRefLinks(refStr) {
  // PubMed links, spaced, WRAPS naturally, no scrolling, no truncation
  const frag = document.createDocumentFragment();

  const refs = String(refStr || "")
    .split(";")
    .map(s => s.trim())
    .filter(Boolean);

  refs.forEach((pmid, idx) => {
    const a = document.createElement("a");
    a.href = `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = pmid;

    // Keep it consistent with site links (don’t force nowrap)
    a.style.textDecoration = "none";

    frag.appendChild(a);

    // Add a separator with whitespace that can wrap
    if (idx !== refs.length - 1) {
      frag.appendChild(document.createTextNode(" \u00B7 ")); // " · "
    }
  });

  return frag;
}

function createHistoryAccordionItem(item) {
  const protein = item?.protein || item?.results?.["Accession Number"] || "Unknown";
  const when = item?.date || item?.timestamp || item?.created_at;

  const rawMode = String(item?.mode || "Web").trim();
  const modeLower = rawMode.toLowerCase();
  const modeText = modeLower === "api" ? "API" : "Web";
  const modeClass = modeLower === "api" ? "mode-api" : "mode-web";

  const btn = document.createElement("button");
  btn.className = "accordion";
  btn.type = "button";
  btn.style.width = "100%";
  btn.style.display = "block";

  // Theme accent for +/–
  const themeAccent = "#0388fc";

  btn.innerHTML = `
    <div class="d-flex justify-content-between align-items-center w-100">
      <div class="d-flex align-items-center flex-wrap" style="gap:10px;">
        <span class="mono">${fmtDate(when)}</span>
        <span style="font-weight:800;">${protein}</span>
      </div>

      <div class="d-flex align-items-center" style="gap:10px;">
        <span class="mode-badge ${modeClass}">${modeText}</span>
        <span class="plus" style="font-weight:900; font-size:18px; line-height:1; color:${themeAccent};">+</span>
      </div>
    </div>
  `;

  const panel = document.createElement("div");
  panel.className = "panel";
  panel.style.display = "none";

  const wrapper = document.createElement("div");
  wrapper.style.width = "100%";
  wrapper.appendChild(btn);
  wrapper.appendChild(panel);

  let rendered = false;

  btn.addEventListener("click", () => {
    const isOpen = panel.style.display === "block";
    panel.style.display = isOpen ? "none" : "block";

    const plus = btn.querySelector(".plus");
    if (plus) plus.textContent = isOpen ? "+" : "–";

    if (!rendered && !isOpen) {
      const ptms = item?.results?.PTMs || [];
      if (!Array.isArray(ptms) || ptms.length === 0) {
        panel.innerHTML = `
          <div class="alert alert-warning" style="margin:10px;">
            No PTM entries found for this history item.
          </div>
        `;
        rendered = true;
        return;
      }

      const sorted = [...ptms].sort((a, b) => (a?.[0] || 0) - (b?.[0] || 0));

      // Collect unique PTM types for this history item
      const typeSet = new Set();
      for (const row of sorted) {
        const typ = row?.[1];
        if (typ) typeSet.add(String(typ));
      }
      const types = Array.from(typeSet).sort((a, b) => a.localeCompare(b));

      const header = document.createElement("div");
      header.className = "muted";
      header.style.margin = "10px 10px 0";
      header.innerHTML = `<br><b>PTM entries</b> – ${sorted.length}`;

      // ---- Filter bar ----
      let activeType = null; // null = show all
      const filterBar = document.createElement("div");
      filterBar.style.margin = "10px 10px 0";
      filterBar.style.padding = "10px";
      filterBar.style.borderRadius = "10px";
      filterBar.style.border = "1px solid rgba(0,0,0,0.08)";
      filterBar.style.background = "rgba(216, 236, 255, 0.35)"; // matches your light theme blocks

      const filterTitle = document.createElement("div");
      filterTitle.className = "muted";
      filterTitle.style.fontWeight = "800";
      filterTitle.style.marginBottom = "8px";
      filterTitle.textContent = "Filter by PTM type (single-select):";
      filterBar.appendChild(filterTitle);

      const filterRow = document.createElement("div");
      filterRow.className = "d-flex flex-wrap";
      filterRow.style.gap = "10px";
      filterBar.appendChild(filterRow);

      // We'll keep refs to checkbox inputs so we can uncheck others
      const checkboxByType = new Map();

      // ---- Table ----
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      wrap.style.marginTop = "10px";

      const table = document.createElement("table");
      table.className = "table table-sm table-hover";
      table.style.marginBottom = "0";
      table.style.width = "100%";
      table.style.tableLayout = "fixed";

      table.innerHTML = `
        <thead>
          <tr>
            <th style="width:90px;">Pos</th>
            <th style="width:260px;">Type</th>
            <th>References</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;

      const tbody = table.querySelector("tbody");

      // Build all rows once, then filter by toggling display
      const rowEls = []; // { typ, tr }
      for (const row of sorted) {
        const pos = row?.[0];
        const typ = row?.[1] || "—";
        const refs = row?.[2] || "";

        const tr = document.createElement("tr");
        tr.setAttribute("data-ptm-type", String(typ));

        const tdPos = document.createElement("td");
        tdPos.className = "mono";
        tdPos.textContent = String(pos ?? "—");
        tr.appendChild(tdPos);

        const tdType = document.createElement("td");

        const dot = document.createElement("span");
        dot.style.display = "inline-block";
        dot.style.width = "12px";
        dot.style.height = "12px";
        dot.style.borderRadius = "999px";
        dot.style.marginRight = "8px";
        dot.style.border = "1px solid rgba(0,0,0,0.15)";
        dot.style.background = ptmColorMapping[typ] || "#f39c12";

        const label = document.createElement("span");
        label.textContent = typ;

        tdType.appendChild(dot);
        tdType.appendChild(label);
        tr.appendChild(tdType);

        const tdRefs = document.createElement("td");
        tdRefs.style.width = "auto";
        tdRefs.style.tableLayout = "fixed";

        const refsBlock = document.createElement("div");
        // refsBlock.className = "mono";
        refsBlock.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
        refsBlock.style.whiteSpace = "normal";
        refsBlock.style.overflow = "visible";
        refsBlock.style.textOverflow = "clip";
        refsBlock.style.overflowWrap = "anywhere";
        refsBlock.style.wordBreak = "break-word";

        if (!refs) {
          const muted = document.createElement("span");
          muted.className = "muted";
          muted.textContent = "—";
          refsBlock.appendChild(muted);
        } else {
          refsBlock.appendChild(renderRefLinks(refs));
        }

        tdRefs.appendChild(refsBlock);
        tr.appendChild(tdRefs);

        tbody.appendChild(tr);
        rowEls.push({ typ: String(typ), tr });
      }

      function applyFilter() {
        for (const { typ, tr } of rowEls) {
          tr.style.display = !activeType || typ === activeType ? "" : "none";
        }
      }

      // Create single-select checkbox chips
      for (const typ of types) {
        const id = `ptmflt_${Math.random().toString(36).slice(2)}_${typ.replace(/\W+/g, "_")}`;

        const holder = document.createElement("div");
        holder.className = "form-check";
        holder.style.display = "inline-flex";
        holder.style.alignItems = "center";
        holder.style.gap = "8px";
        holder.style.margin = "0";

        const input = document.createElement("input");
        input.className = "form-check-input";
        input.type = "checkbox";
        input.id = id;

        // handle single-select toggle behavior
        input.addEventListener("click", (e) => {
          // If clicking a different type, uncheck others
          const wasChecked = input.checked;

          // because click fires before state is final in some browsers,
          // we handle with a tiny microtask to read final state:
          queueMicrotask(() => {
            const nowChecked = input.checked;

            if (nowChecked) {
              // select this type and unselect all others
              activeType = typ;
              for (const [t, cb] of checkboxByType.entries()) {
                if (t !== typ) cb.checked = false;
              }
            } else {
              // unselect => show all
              activeType = null;
            }
            applyFilter();
          });
        });

        const label = document.createElement("label");
        label.className = "form-check-label";
        label.setAttribute("for", id);
        label.style.cursor = "pointer";
        label.style.fontWeight = "700";

        const dot = document.createElement("span");
        dot.style.display = "inline-block";
        dot.style.width = "12px";
        dot.style.height = "12px";
        dot.style.borderRadius = "999px";
        dot.style.marginRight = "8px";
        dot.style.border = "1px solid rgba(0,0,0,0.15)";
        dot.style.background = ptmColorMapping[typ] || "#f39c12";

        label.appendChild(dot);
        label.appendChild(document.createTextNode(typ));

        holder.appendChild(input);
        holder.appendChild(label);

        filterRow.appendChild(holder);
        checkboxByType.set(typ, input);
      }

      wrap.appendChild(table);

      panel.innerHTML = "";
      panel.appendChild(header);
      panel.appendChild(filterBar);
      panel.appendChild(wrap);

      // initial view: no filter
      applyFilter();

      rendered = true;
    }
  });

  return wrapper;
}

async function loadHistoryFromEndpoint(username) {
  const empty = document.getElementById("historyEmpty");
  const accordion = document.getElementById("historyAccordion");

  if (!empty || !accordion) return;

  empty.style.display = "none";
  accordion.innerHTML = "";

  const data = await fetch(`/ptmkb/history?username=${encodeURIComponent(username)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  })
    .then((r) => r.json())
    .catch(() => null);

  const histories = Array.isArray(data) ? data : data?.histories || [];

  if (!histories.length) {
    empty.style.display = "block";
    return;
  }

  // newest first
  histories.sort((a, b) => {
    const da = new Date((a?.date && a.date.$date) ? a.date.$date : a?.date || 0).getTime();
    const db = new Date((b?.date && b.date.$date) ? b.date.$date : b?.date || 0).getTime();
    return db - da;
  });

  for (const h of histories) {
    accordion.appendChild(createHistoryAccordionItem(h));
  }
}

// ---------------- BOOTSTRAP PAGE ----------------

document.addEventListener("DOMContentLoaded", async () => {
  // lock down token textarea
  lockDownTokenBox();

  // profile username
  const username = requireLoginOrRedirect();

  // Copy Token button copies REAL token only (not masked textarea value)
  document.getElementById("btnCopyToken")?.addEventListener("click", async () => {
    if (!__rawToken) return toast("No token to copy");

    if (isTokenExpired()) {
      setExpiredUI();
      return toast("Token expired");
    }

    try {
      await navigator.clipboard.writeText(__rawToken);
      toast("Token copied");
    } catch {
      toast("Copy failed");
    }
  });

  // Reset token
  document.getElementById("btnResetToken")?.addEventListener("click", async () => {
    if (!username) return toast("Login required");
    await resetToken(username);
  });

  // No Refresh button binding (removed in HTML)

  // load token + history
  if (username) {
    await fetchToken(username);
    await loadHistoryFromEndpoint(username);
  } else {
    const empty = document.getElementById("historyEmpty");
    if (empty) {
      empty.style.display = "block";
      empty.textContent = "Login required to view history.";
    }
  }
});
 