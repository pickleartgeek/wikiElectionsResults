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
function updateResultsTable(candidates, name, forceNoProjection = false) {
  tableTitle.textContent = name;
  tableBody.innerHTML = "";

  const totalRaw = Object.values(candidates)
    .filter(v => typeof v === "number")
    .reduce((s,v)=>s+Number(v||0),0);

  const total = totalRaw * (turnoutPercent / 100);

  const sorted = Object.entries(candidates)
    .filter(([p]) => p !== "called")
    .map(([p,v]) => [p, Number(v)||0])
    .sort((a,b)=>b[1]-a[1]);

  const winner = sorted[0]?.[0];

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
    const c = results[currentRace]?.[id];
    if (!c) return;

    currentCandidatesData = c;
    currentFeatureName = name;

    const totalRaw = Object.values(c).reduce((s,v)=>s+Number(v||0),0);

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
  const res = await fetch('results.json');
  results = await res.json();

  if (geojsonLayer) geojsonLayer.setStyle(style);

  showStatewideResults();
}

setInterval(loadResults, 10000);
loadResults();

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
