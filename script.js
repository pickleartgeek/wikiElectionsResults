// =====================
// SETTINGS (EDIT THESE)
// =====================
let turnoutPercent = 100;      // change in code only
let reportingPercent = 65;     // fake % reporting

const partyColors = {
  dem: "#2171b5",
  rep: "#cb181d",
  green: "#41ab5d",
  ind: "#ff7f00"
};

const partyNames = {
  dem: "Democratic",
  rep: "Republican",
  green: "Green",
  ind: "Independent"
};

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
// UI ELEMENTS
// =====================
const tableBody = document.querySelector("#resultsTable tbody");
const tableTitle = document.getElementById("tableTitle");
const winnerBanner = document.getElementById("winnerBanner");

const turnoutBar = document.getElementById("turnoutBar");
const turnoutValue = document.getElementById("turnoutValue");
const estVotesText = document.getElementById("estVotesText");

const reportingBar = document.getElementById("reportingBar");
const reportingValue = document.getElementById("reportingValue");

// =====================
// UI UPDATE
// =====================
function updateBars(totalVotesRaw) {
  turnoutBar.style.width = turnoutPercent + "%";
  turnoutValue.textContent = turnoutPercent + "%";

  reportingBar.style.width = reportingPercent + "%";
  reportingValue.textContent = reportingPercent + "%";

  const estVotes = Math.round(totalVotesRaw * (turnoutPercent/100));
  estVotesText.textContent = "Est. Votes: " + estVotes.toLocaleString();
}

// =====================
// TABLE (SORTED)
// =====================
function updateTable(candidates, name) {
  tableTitle.textContent = name;
  tableBody.innerHTML = "";

  const totalRaw = Object.values(candidates).reduce((s,v)=>s+Number(v||0),0);
  const total = totalRaw * (turnoutPercent/100);

  // SORT candidates
  const sorted = Object.entries(candidates)
    .map(([p,v]) => [p, Number(v)||0])
    .sort((a,b)=>b[1]-a[1]);

  const winner = sorted[0][0];

  // WINNER BANNER
  if (Number(sorted[0][1]) / totalRaw > 0.5) {
    winnerBanner.textContent = "PROJECTED WINNER: " + (partyNames[winner] || winner.toUpperCase());
  } else {
    winnerBanner.textContent = "No Projection";
  }

  for (const [p, raw] of sorted) {
    const votes = Math.round(raw * (turnoutPercent/100));
    const pct = total ? ((votes/total)*100).toFixed(1) : 0;

    const row = document.createElement("tr");
    row.className = "row";

    row.innerHTML = `
      <td>
        <div class="name" style="color:${partyColors[p]}">
          ${partyNames[p] || p}
        </div>
        <div class="vote-bar" style="
          width:${pct}%;
          background:${partyColors[p]};
        "></div>
      </td>
      <td>${votes.toLocaleString()}</td>
      <td>${pct}%</td>
    `;

    tableBody.appendChild(row);
  }

  updateBars(totalRaw);
}

// =====================
// STATEWIDE
// =====================
function showStatewide() {
  const raceData = results[currentRace];
  if (!raceData) return;

  const totals = {};

  for (const d in raceData) {
    for (const p in raceData[d]) {
      if (!totals[p]) totals[p] = 0;
      totals[p] += Number(raceData[d][p]) || 0;
    }
  }

  updateTable(totals, "Statewide");
}
// =====================
// MAP STYLE
// =====================
function getColor(c) {
  if (!c) return "#ccc";
  return partyColors[
    Object.entries(c).sort((a,b)=>b[1]-a[1])[0][0]
  ];
}

function style(feature) {
  const id = String(feature.properties.id);
  return {
    fillColor: getColor(results[currentRace]?.[id]),
    weight: 1,
    color: "white",
    fillOpacity: 0.8
  };
}

// =====================
// GEOJSON EVENTS
// =====================
function onEachFeature(feature, layer) {
  const id = String(feature.properties.id);
  const name = feature.properties.NAME;

  // Mobile-friendly: only tap/click to show per-group results
  layer.on("click", function(e) {
    const raceData = results[currentRace];
    if (!raceData) return;

    const c = raceData[id];
    if (!c) return;

    updateTable(c, name);

    // Stop click from propagating to map background
    e.originalEvent.stopPropagation();
  });
}
// =====================
// LOAD DATA
// =====================
fetch('your-geojson.geojson')
  .then(r=>r.json())
  .then(data=>{
    geojsonLayer = L.geoJSON(data,{style,onEachFeature}).addTo(map);
    map.fitBounds(geojsonLayer.getBounds());
  });

async function loadResults() {
  const res = await fetch('results.json');
  results = await res.json();

  if (geojsonLayer) geojsonLayer.setStyle(style);

  showStatewide();
}

setInterval(loadResults, 10000);
loadResults();

// =====================
// MAP CLICK RESET
// =====================
map.on("click", showStatewide);

// =====================
// RACE SWITCH
// =====================
document.getElementById("raceSelect").addEventListener("change", e => {
  currentRace = e.target.value;
  if (geojsonLayer) geojsonLayer.setStyle(style);
  showStatewide();
});
