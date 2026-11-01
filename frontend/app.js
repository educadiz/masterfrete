const form = document.querySelector("#ride-form");
const submitButton = document.querySelector("#submit-button");
const statusMessage = document.querySelector("#status");
const results = document.querySelector("#results");
const routeSummary = document.querySelector("#route-summary");
const distanceResult = document.querySelector("#distance-result");
const durationResult = document.querySelector("#duration-result");
const priceResult = document.querySelector("#price-result");
const priceNote = document.querySelector("#price-note");
const mapStatus = document.querySelector("#map-status");
let map;
let routeLayer;

form.addEventListener("reset", () => {
  results.hidden = true;
  statusMessage.textContent = "";
  mapStatus.textContent = "";
  priceNote.hidden = true;
  if (routeLayer) {
    routeLayer.clearLayers();
  }
  document.querySelector("#origin").focus();
});

const loadingModal = document.querySelector("#loading-modal");
const loadingText = document.querySelector("#loading-text");
const loadingSteps = [...document.querySelectorAll("#loading-steps li")];
const cancelButton = document.querySelector("#cancel-button");
const STEP_MESSAGES = [
  "Buscando as coordenadas no OpenStreetMap...",
  "Medindo o trajeto entre origem e destino...",
  "Consultando os modelos de previsão..."
];
let stepTimer;
let currentRequest;

// As etapas são indicativas: avançam por tempo, não por eventos do servidor.
function showLoading() {
  setLoadingStep(0);
  loadingModal.hidden = false;
  document.body.classList.add("modal-open");
  cancelButton.focus();
  let step = 0;
  stepTimer = setInterval(() => {
    step = Math.min(step + 1, STEP_MESSAGES.length - 1);
    setLoadingStep(step);
  }, 1800);
}

function setLoadingStep(step) {
  loadingText.textContent = STEP_MESSAGES[step];
  loadingSteps.forEach((item, index) => {
    item.classList.toggle("done", index < step);
    item.classList.toggle("active", index === step);
  });
}

function hideLoading() {
  clearInterval(stepTimer);
  loadingModal.hidden = true;
  document.body.classList.remove("modal-open");
}

cancelButton.addEventListener("click", () => {
  if (currentRequest) {
    currentRequest.abort();
  }
});

document.addEventListener("keydown", (event) => {
  if (loadingModal.hidden) {
    return;
  }
  if (event.key === "Escape" && currentRequest) {
    currentRequest.abort();
  } else if (event.key === "Tab") {
    event.preventDefault();
    cancelButton.focus();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusMessage.textContent = "";
  results.hidden = true;
  submitButton.disabled = true;
  currentRequest = new AbortController();
  showLoading();

  const formData = new FormData(form);
  try {
    const response = await fetch("/api/corrida/estimar", {
      method: "POST",
      signal: currentRequest.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origem: formData.get("origem"),
        destino: formData.get("destino")
      })
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "Não foi possível estimar a corrida.");
    }

    routeSummary.textContent = `${body.origem} → ${body.destino}`;
    results.hidden = false;
    renderMap(body);
    distanceResult.textContent = `${body.distanciaKm.toFixed(2)} km`;
    durationResult.textContent = formatDuration(body.duracao_estimada_minutos);
    priceResult.textContent =
      body.preco_estimado === null
        ? "Indisponível"
        : body.preco_estimado.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
          });
    priceNote.textContent = body.mensagem_preco || "";
    priceNote.hidden = !body.mensagem_preco;
    statusMessage.textContent = "";
  } catch (error) {
    statusMessage.textContent =
      error.name === "AbortError" ? "Consulta cancelada." : error.message;
  } finally {
    hideLoading();
    currentRequest = undefined;
    submitButton.disabled = false;
  }
});

// Converte minutos (ex.: 72.4) para hh:mm h (ex.: 01:12 h), arredondando ao minuto.
function formatDuration(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return "--:-- h";
  }

  const roundedMinutes = Math.round(totalMinutes);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} h`;
}

function renderMap(ride) {
  const locations = ride.localizacao;
  if (
    !locations ||
    !isValidCoordinate(locations.origem) ||
    !isValidCoordinate(locations.destino)
  ) {
    mapStatus.textContent = "Não foi possível exibir as coordenadas no mapa.";
    return;
  }

  if (!window.L) {
    mapStatus.textContent =
      "O mapa não carregou. Verifique sua conexão e tente novamente.";
    return;
  }

  const origin = [locations.origem.latitude, locations.origem.longitude];
  const destination = [locations.destino.latitude, locations.destino.longitude];

  if (!map) {
    map = window.L.map("ride-map");
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    routeLayer = window.L.featureGroup().addTo(map);
  }

  routeLayer.clearLayers();
  const originIcon = createMapIcon("O", "origem");
  const destinationIcon = createMapIcon("D", "destino");
  window.L.marker(origin)
    .setIcon(originIcon)
    .bindPopup(`<strong>Origem</strong><br>${escapeHtml(ride.origem)}`)
    .addTo(routeLayer);
  window.L.marker(destination)
    .setIcon(destinationIcon)
    .bindPopup(`<strong>Destino</strong><br>${escapeHtml(ride.destino)}`)
    .addTo(routeLayer);
  window.L.polyline([origin, destination], {
    color: "#287c4a",
    weight: 4,
    opacity: 0.8,
    dashArray: "8 8"
  }).addTo(routeLayer);

  map.invalidateSize();
  map.fitBounds(routeLayer.getBounds(), { padding: [28, 28], maxZoom: 15 });
  mapStatus.textContent = "";
}

function createMapIcon(label, location) {
  return window.L.divIcon({
    className: `map-marker-icon map-marker-${location}`,
    html: `<span>${label}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
}

function isValidCoordinate(point) {
  return (
    Number.isFinite(point?.latitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    Number.isFinite(point?.longitude) &&
    point.longitude >= -180 &&
    point.longitude <= 180
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });
}
