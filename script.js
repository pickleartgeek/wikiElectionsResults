const map = L.map('map').setView([38.5, -82], 7);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18
}).addTo(map);

let geojsonLayer;
let results = {};
let currentRace = "class 4";

// EDIT THESE ONLY
const TURNOUT_PERCENT = 62;
const REPORTING_PERCENT = 87;

// PARTY CONFIG (YOUR CUSTOM)
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

// STATE
let currentCandidatesData = null;
let currentFeatureName = "";

// =====================
// SAFE NUMBER HELPERS
// =====================
const turnoutMul = TURNOUT_PERCENT / 100;

// =====================
// WINNER
// =====================
function getWinner(c) {
  let max = -1, win = null;
  for (const p in c) {
    const v = Number(c[p]) || 0;
    if (v > max) {
      max = v;
      win = p;
    }
  }
  return win;
}

// =====================
// TABLE
// =====================
const tableBody = document.querySelector("#resultsTable tbody");
const tableTitle = document.getElementById("tableTitle");
const winnerBanner = document.getElementById("winnerBanner");
const reportingBar = document.getElementById("reportingBarFill");
const reportingText = document.getElementById("reportingText");

function updateUI(candidates, name) {
  if (!candidates) return;

  tableBody.innerHTML = "";

  const totalRaw = Object.values(candidates)
    .reduce((a,b)=>a+Number(b||0),0);

  const total = totalRaw * turnoutMul;

  const sorted = Object.entries(candidates)
    .sort((a,b)=>b[1]-a[1]);

  const winner = sorted[0]?.[0];

  tableTitle.textContent = name;

  winnerBanner.textContent =
    "PROJECTED WINNER: " + (partyNames[winner] || winner);

  winnerBanner.style.background = partyColors[winner] || "#ffcc00";

  reportingBar.style.width = REPORTING_PERCENT + "%";
  reportingText.textContent = REPORTING_PERCENT + "% Reporting";

  for (const [p,v] of sorted) {
    const votes = Math.round(Number(v) * turnoutMul);
    const pct = total ? ((votes/total)*100).toFixed(1) : 0;

    const row = document.createElement("tr");
    if (p === winner) row.classList.add("winner-row");

    row.innerHTML = `
      <td style="color:${partyColors[p]}">
        ${partyNames[p] || p}
        <div class="bar-bg">
          <div class="bar-fill" style="width:${pct}%; background:${partyColors[p]}"></div>
        </div>
      </td>
      <td>${votes}</td>
      <td>${pct}%</td>
    `;

    tableBody.appendChild(row);
  }
}

// =====================
// STATEWIDE
// =====================
function showStatewide() {
  const race = results[currentRace];
  if (!race) return;

  const totals = {};

  for (const d in race) {
    for (const p in race[d]) {
      totals[p] = (totals[p] || 0) + Number(race[d][p] || 0);
    }
  }

  currentCandidatesData = totals;
  currentFeatureName = "STATEWIDE";

  updateUI(totals, "Statewide Total");
}

// =====================
// MAP STYLE (SAFE)
// =====================
function getColor(c) {
  if (!c) return "#ccc";

  const sorted = Object.entries(c).sort((a,b)=>b[1]-a[1]);
  const win = sorted[0]?.[0];

  return partyColors[win] || "#ccc";
}

function style(feature) {
  const id = String(feature.properties.id);
  return {
    fillColor: getColor(results[currentRace]?.[id]),
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

    updateUI(c, name);
  });

  layer.on("mouseout", showStatewide);
}

// =====================
// LOAD DATA (IMPORTANT)
// =====================
fetch("your-geojson.geojson")
  .then(r=>r.json())
  .then(data=>{
    geojsonLayer = L.geoJSON(data,{style,onEachFeature}).addTo(map);
    map.fitBounds(geojsonLayer.getBounds());
  });

async function loadResults() {
  const res = await fetch("results.json");
  results = await res.json();

  if (geojsonLayer) geojsonLayer.setStyle(style);

  showStatewide();
}

setInterval(loadResults, 10000);
loadResults();

// =====================
// RACE SWITCH
// =====================
document.getElementById("raceSelect").addEventListener("change", e => {
  currentRace = e.target.value;
  if (geojsonLayer) geojsonLayer.setStyle(style);
  showStatewide();
});
