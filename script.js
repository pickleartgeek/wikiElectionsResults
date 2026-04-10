const map = L.map('map').setView([38.5, -82], 7);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18
}).addTo(map);

// =====================
//turnout
// =====================
const TURNOUT_PERCENT = 62;
const REPORTING_PERCENT = 87;

// =====================
// DATA STATE
// =====================
let geojsonLayer;
let results = {};
let currentRace = "class 4";
let currentCandidatesData = null;
let currentFeatureName = "";

// =====================
// PARTY CONFIG (YOUR CUSTOM)
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
// UI ELEMENTS
// =====================
const tableBody = document.querySelector("#resultsTable tbody");
const tableTitle = document.getElementById("tableTitle");

// TOP BANNERS (must exist in HTML)
const winnerBanner = document.getElementById("winnerBanner");
const reportingBar = document.getElementById("reportingBarFill");
const reportingText = document.getElementById("reportingText");

// =====================
// UI HELPERS
// =====================
function format(n){ return n.toLocaleString(); }

// =====================
// TURNOUT / REPORTING (NO SLIDER)
// =====================
function getTurnoutMultiplier() {
  return TURNOUT_PERCENT / 100;
}

function getReportingMultiplier() {
  return REPORTING_PERCENT / 100;
}

// =====================
// WINNER LOGIC
// =====================
function getWinner(c) {
  let max = -1, winner = null;

  for (const p in c) {
    const v = Number(c[p]) || 0;
    if (v > max) {
      max = v;
      winner = p;
    }
  }

  return winner;
}

function checkIfCalled(c) {
  const total = Object.values(c).reduce((s,v)=>s+Number(v||0),0);

  for (const p in c) {
    if (Number(c[p]) / total > 0.5) return true;
  }

  return false;
}

// =====================
// PROJECTED WINNER BANNER
// =====================
function updateWinnerBanner(candidates) {
  const winner = getWinner(candidates);

  if (!winnerBanner) return;

  winnerBanner.textContent =
    "PROJECTED WINNER: " + (partyNames[winner] || winner.toUpperCase());

  winnerBanner.style.background = partyColors[winner];
}

// =====================
// REPORTING BAR
// =====================
function updateReportingBar() {
  if (!reportingBar || !reportingText) return;

  reportingBar.style.width = REPORTING_PERCENT + "%";
  reportingText.textContent = REPORTING_PERCENT + "% Reporting";
}

// =====================
// SORTED TABLE RENDER
// =====================
function updateResultsTable(candidates, name, called=false) {
  tableTitle.textContent = name + (called ? " (CALLED)" : "");
  tableBody.innerHTML = "";

  const turnoutMul = getTurnoutMultiplier();

  const totalRaw = Object.values(candidates).reduce((s,v)=>s+Number(v||0),0);
  const total = totalRaw * turnoutMul;

  // SORT CANDIDATES (BIG FIX)
  const sorted = Object.entries(candidates)
    .sort((a,b)=>b[1]-a[1]);

  const winner = sorted[0]?.[0];

  for (const [p, val] of sorted) {
    const raw = Number(val) || 0;
    const votes = Math.round(raw * turnoutMul);
    const pct = total ? ((votes/total)*100).toFixed(1) : 0;

    const row = document.createElement("tr");

    if (p === winner) row.classList.add("winner-row");

    row.innerHTML = `
      <td style="color:${partyColors[p]}">
        ${partyNames[p] || p.toUpperCase()}
        <div class="bar-bg">
          <div class="bar-fill" style="
            width:${pct}%;
            background:${partyColors[p]};
          "></div>
        </div>
      </td>
      <td>${format(votes)}</td>
      <td>${pct}%</td>
    `;

    tableBody.appendChild(row);
  }

  updateWinnerBanner(candidates);
}

// =====================
// STATEWIDE TOTAL
// =====================
function showStatewideResults() {
  const raceData = results[currentRace];
  if (!raceData) return;

  const totals = {};

  for (const district in raceData) {
    for (const p in raceData[district]) {
      totals[p] = (totals[p] || 0) + Number(raceData[district][p] || 0);
    }
  }

  currentCandidatesData = totals;
  currentFeatureName = "STATEWIDE TOTAL";

  updateResultsTable(totals, "Statewide Total", checkIfCalled(totals));
}

// =====================
// MAP COLORING (MARGIN BASED)
// =====================
function getColor(c) {
  if (!c) return "#ccc";

  const vals = Object.values(c).map(Number);
  const total = vals.reduce((a,b)=>a+b,0);

  const sorted = Object.entries(c).sort((a,b)=>b[1]-a[1]);
  const winner = sorted[0][0];
  const second = sorted[1]?.[1] || 0;

  const margin = (sorted[0][1] - second) / total;

  const base = partyColors[winner] || "#ccc";

  // stronger margin = darker
  if (margin > 0.4) return base;
  if (margin > 0.2) return base + "cc";
  if (margin > 0.1) return base + "99";

  return base + "66";
}

function style(feature) {
  const id = String(feature.properties.id);
  const c = results[currentRace]?.[id];

  return {
    fillColor: getColor(c),
    weight: 1,
    color: "white",
    fillOpacity: 0.85
  };
}

// =====================
// GEOJSON
// =====================
function onEachFeature(feature, layer) {
  const id = String(feature.properties.id);
  const name = feature.properties.NAME;

  layer.on("mouseover", () => {
    const c = results[currentRace]?.[id];
    if (!c) return;

    currentCandidatesData = c;
    currentFeatureName = name;

    updateResultsTable(c, name, checkIfCalled(c));
  });

  layer.on("mouseout", () => {
    showStatewideResults();
  });
}

// =====================
// LOAD MAP DATA
// =====================
fetch('your-geojson.geojson')
  .then(r=>r.json())
  .then(data=>{
    geojsonLayer = L.geoJSON(data, { style, onEachFeature }).addTo(map);
    map.fitBounds(geojsonLayer.getBounds());
  });

// =====================
// LOAD RESULTS
// =====================
async function loadResults() {
  const res = await fetch('results.json');
  results = await res.json();

  if (geojsonLayer) geojsonLayer.setStyle(style);

  updateReportingBar();
  showStatewideResults();
}

setInterval(loadResults, 10000);
loadResults();

// =====================
// RACE SWITCH
// =================
