// =====================
// MAP
// =====================
const map = L.map('map').setView([38.5, -82], 7);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18
}).addTo(map);

let geojsonLayer;
let results = {};
let currentRace = "class 4";

// =====================
// PARTY CONFIG
// =====================
const partyColors = {
  wc:"#2171b5",
  qtw:"#b71212",
  rf:"#b71212",
  gsx:"#691391",
  dvwb:"#F0B27A"
};

const partyNames = {
  wc:"Worth-Cupcake",
  qtw:"TyroniusTheIII",
  rf:"Representative-Fee65",
  gsx:"gunsmokexeon",
  dvwb:"Disguised_VW_Beetle"
};

// =====================
// DOM
// =====================
const tableBody = document.querySelector("#resultsTable tbody");
const tableTitle = document.getElementById("tableTitle");
const winnerBanner = document.getElementById("winnerBanner");

const turnoutValue = document.getElementById("turnoutValue");
const turnoutBarFill = document.getElementById("turnoutBarFill");
const estVotesText = document.getElementById("estVotesText");

// =====================
// TURNOUT
// =====================
let turnoutPercent = 100;
let currentCandidatesData = null;
let currentFeatureName = "";

function updateTurnoutUI(totalVotesRaw = 0) {
  turnoutValue.textContent = turnoutPercent + "%";
  turnoutBarFill.style.width = turnoutPercent + "%";

  const estVotes = Math.round(totalVotesRaw * (turnoutPercent / 100));
  estVotesText.textContent = "Est. Votes: " + estVotes.toLocaleString();
}

// =====================
// TABLE + PROJECTION
// =====================
function updateResultsTable(candidates, name, called=false) {
  tableTitle.textContent = name;
  tableBody.innerHTML = "";

  // 🚨 HARD SAFETY: reject bad data early
  if (!candidates || typeof candidates !== "object") {
    tableBody.innerHTML = "<tr><td>NO DATA</td></tr>";
    return;
  }

  const cleanEntries = Object.entries(candidates)
    .filter(([p,v]) =>
      p !== "called" &&
      typeof v !== "undefined" &&
      !isNaN(Number(v))
    )
    .map(([p,v]) => [p, Number(v)]);

  if (cleanEntries.length === 0) {
    tableBody.innerHTML = "<tr><td>NO VALID VOTES</td></tr>";
    return;
  }

  const totalRaw = cleanEntries.reduce((s,[p,v]) => s + v, 0);
  const total = totalRaw * (turnoutPercent / 100);

  const sorted = cleanEntries.sort((a,b)=>b[1]-a[1]);
  const winner = sorted[0][0];

  let calledParty = null;

  if (called) calledParty = candidates.called || null;
  else if (sorted[0][1] / totalRaw > 0.5) calledParty = winner;

  winnerBanner.textContent = calledParty
    ? "PROJECTED WINNER: " + (partyNames[calledParty] || calledParty)
    : "No Projection";

  for (const [p,raw] of sorted) {
    const votes = Math.round(raw * (turnoutPercent / 100));
    const pct = total ? ((votes / total) * 100).toFixed(1) : 0;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="color:${partyColors[p] || '#000'}">
        ${partyNames[p] || p}
        <div class="bar-bg">
          <div class="bar-fill" style="width:${pct}%; background:${partyColors[p] || '#999'}"></div>
        </div>
      </td>
      <td>${votes.toLocaleString()}</td>
      <td>${pct}%</td>
    `;
    tableBody.appendChild(row);
  }

  updateTurnoutUI(totalRaw);
}

  // =====================
  // CALL LOGIC (SAFE JSON)
  // =====================
  let calledParty = null;

  if (!forceNoProjection) {
    if (typeof candidates.called === "string" && candidates.called !== "") {
      calledParty = candidates.called;
    } else if (sorted[0] && sorted[0][1] / totalRaw > 0.5) {
      calledParty = winner;
    }
  }

  winnerBanner.textContent = calledParty
    ? "PROJECTED WINNER: " + (partyNames[calledParty] || calledParty.toUpperCase())
    : "No Projection";

  // =====================
  // RENDER TABLE
  // =====================
  for (const [p,raw] of sorted) {
    const votes = Math.round(raw * (turnoutPercent / 100));
    const pct = total ? ((votes / total) * 100).toFixed(1) : 0;

    const row = document.createElement("tr");

    if (calledParty && p === winner) {
      row.classList.add("called");
    }

    row.innerHTML = `
      <td style="color:${partyColors[p]}">
        ${partyNames[p] || p.toUpperCase()}
        <div class="bar-bg">
          <div class="bar-fill" style="width:${pct}%; background:${partyColors[p]}"></div>
        </div>
      </td>
      <td>${votes.toLocaleString()}</td>
      <td>${pct}%</td>
    `;

    tableBody.appendChild(row);
  }

  updateTurnoutUI(totalRaw);
}

// =====================
// STATEWIDE
// =====================
function showStatewideResults() {
  const raceData = results[currentRace];
  if (!raceData) return;

  const totals = {};

  for (const district in raceData) {
    const cands = raceData[district];

    for (const p in cands) {
      if (p === "called") continue;
      totals[p] = (totals[p] || 0) + Number(cands[p]) || 0;
    }
  }

  currentCandidatesData = totals;
  currentFeatureName = "Statewide Total";

  const metaCall = raceData._meta?.called;

  if (metaCall) {
    totals.called = metaCall;
    updateResultsTable(totals, "Statewide Total");
  } else {
    updateResultsTable(totals, "Statewide Total", true);
  }
}

// =====================
// STYLE
// =====================
function getColor(c) {
  if (!c) return "#ccc";

  let max = -1, winner = null;
  for (const p in c) {
    const v = Number(c[p]) || 0;
    if (v > max) {
      max = v;
      winner = p;
    }
  }

  return partyColors[winner] || "#ccc";
}

function style(feature) {
  const id = String(feature.properties.id);
  const c = results[currentRace]?.[id];

  return {
    fillColor: getColor(c),
    weight: 1,
    color: "white",
    fillOpacity: 0.8
  };
}

// =====================
// CLICK HANDLER (MOBILE FIX)
// =====================
function onEachFeature(feature, layer) {
  const id = String(feature.properties.id);
  const name = feature.properties.NAME;

  layer.on("click", function(e) {
    const raceData = results[currentRace];

    if (!raceData) {
      console.log("NO RACE DATA");
      return;
    }

    const c = raceData[id];

    if (!c) {
      console.log("NO DISTRICT DATA FOR ID:", id);
      updateResultsTable({}, name);
      return;
    }

    currentCandidatesData = c;
    currentFeatureName = name;

    const totalRaw = Object.values(c)
      .filter(v => typeof v === "number" || !isNaN(Number(v)))
      .reduce((s,v)=>s+Number(v||0),0);

    updateTurnoutUI(totalRaw);
    updateResultsTable(c, name);

    e.originalEvent.stopPropagation();
  });
}

// =====================
// LOAD GEOJSON
// =====================
fetch('your-geojson.geojson')
  .then(r => r.json())
  .then(data => {
    geojsonLayer = L.geoJSON(data, {
      style,
      onEachFeature
    }).addTo(map);

    map.fitBounds(geojsonLayer.getBounds());
  });

// =====================
// LOAD RESULTS
// =====================
async function loadResults() {
  try {
    const res = await fetch('./results.json?v=' + Date.now());
    results = await res.json();

    if (geojsonLayer) geojsonLayer.setStyle(style);

    // 🚨 safety check (prevents "nothing showing")
    if (!results[currentRace]) {
      console.warn("Race not found:", currentRace);

      // fallback to first available race so app still works
      currentRace = Object.keys(results)[0];
    }

    showStatewideResults();

  } catch (e) {
    console.error("Results failed to load:", e);
  }
}

// =====================
// MAP RESET
// =====================
map.on("click", showStatewideResults);

// =====================
// RACE SWITCH
// =====================
document.getElementById("raceSelect").addEventListener("change", e => {
  currentRace = e.target.value;

  if (geojsonLayer) geojsonLayer.setStyle(style);

  showStatewideResults();
});
