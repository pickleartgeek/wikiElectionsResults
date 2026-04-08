// 🗺️ Create map
const map = L.map('map').setView([38.5, -82], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18
}).addTo(map);

let geojsonLayer;
let results = {};
let currentRace = "class 4";

// 🎨 Margin-based coloring
function getColor(d) {
  if (!d) return '#ccc';

  const dem = Number(d.dem);
  const rep = Number(d.rep);

  if (isNaN(dem) || isNaN(rep)) return '#ccc';

  const total = dem + rep;
  if (total === 0) return '#ccc';

  const margin = (dem - rep) / total;

  if (margin > 0) {
    if (margin > 0.4) return '#08306b';
    if (margin > 0.2) return '#2171b5';
    if (margin > 0.1) return '#6baed6';
    return '#c6dbef';
  } else {
    if (margin < -0.4) return '#67000d';
    if (margin < -0.2) return '#cb181d';
    if (margin < -0.1) return '#fb6a4a';
    return '#fcbba1';
  }
}

// 🎨 Style function
function style(feature) {
  const id = String(feature.properties.id);
  const d = results[currentRace]?.[id];

  return {
    fillColor: getColor(d),
    weight: 1,
    color: 'white',
    fillOpacity: 0.8
  };
}

// 🧾 Tooltip
function onEachFeature(feature, layer) {
  const id = String(feature.properties.id);
  const name = feature.properties.NAME;

  layer.on('mouseover', function () {
    const d = results[currentRace]?.[id];
    if (!d) return;

    const total = d.dem + d.rep;
    const demPct = ((d.dem / total) * 100).toFixed(1);
    const repPct = ((d.rep / total) * 100).toFixed(1);

    layer.bindTooltip(`
      <b>${name}</b><br><br>
      Worth-Cupcake: ${d.dem} (${demPct}%)<br>
      TyroniusTheIII: ${d.rep} (${repPct}%)
    `).openTooltip();
  });
}

// 🗺️ Load GeoJSON
fetch('your-geojson.geojson')
  .then(res => res.json())
  .then(data => {
    geojsonLayer = L.geoJSON(data, {
      style,
      onEachFeature
    }).addTo(map);

    map.fitBounds(geojsonLayer.getBounds());
  })
  .catch(err => console.error(err));

// 🔄 Load results + animate
async function loadResults() {
  const res = await fetch('results.json');
  const newResults = await res.json();

  if (geojsonLayer) {
    geojsonLayer.eachLayer(layer => {
      const id = String(layer.feature.properties.id);
      const d = newResults[currentRace]?.[id];

      if (!d) return;

      layer.setStyle({ fillOpacity: 0.3 });

      setTimeout(() => {
        layer.setStyle({
          fillColor: getColor(d),
          fillOpacity: 0.8
        });
      }, 200);
    });
  }

  results = newResults;
}

// 🔁 Auto refresh
setInterval(loadResults, 10000);
loadResults();

// 🎛️ Switch races
function switchRace(race) {
  currentRace = race;
  if (geojsonLayer) geojsonLayer.setStyle(style);
}