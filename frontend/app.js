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
const inputs = {
  origem: document.querySelector("#origin"),
  destino: document.querySelector("#destination")
};
let map;
let routeLayer;
let routeLine;
let markers = {};
let locations = {};
let requestVersion = 0;
const reverseRequests = {};
const reverseWarnings = {};

form.addEventListener("reset", () => {
  invalidateRequest();
  for (const side of ["origem", "destino"]) {
    cancelReverse(side);
    delete reverseWarnings[side];
  }
  locations = {};
  markers = {};
  routeLine = undefined;
  results.hidden = true;
  statusMessage.textContent = "";
  mapStatus.textContent = "";
  priceNote.hidden = true;
  if (routeLayer) {
    routeLayer.clearLayers();
  }
  inputs.origem.focus();
});

for (const side of ["origem", "destino"]) {
  inputs[side].addEventListener("input", () => {
    delete locations[side];
    cancelReverse(side);
    delete reverseWarnings[side];
    updateMapStatus();
    invalidateRequest();
    if (!results.hidden) {
      clearEstimate();
      statusMessage.textContent = "Endereço alterado. Clique em Estimar frete para atualizar.";
    }
  });
}

const loadingModal = document.querySelector("#loading-modal");
const loadingText = document.querySelector("#loading-text");
const loadingSteps = [...document.querySelectorAll("#loading-steps li")];
const cancelButton = document.querySelector("#cancel-button");
const errorModal = document.querySelector("#error-modal");
const errorMessage = document.querySelector("#error-message");
const errorCloseButton = document.querySelector("#error-close-button");
const STEP_MESSAGES = [
  "Buscando as coordenadas no OpenStreetMap...",
  "Medindo o trajeto entre origem e destino...",
  "Consultando os modelos de previsão..."
];
let stepTimer;
let currentRequest;

function invalidateRequest() {
  requestVersion += 1;
  if (currentRequest) {
    currentRequest.abort();
    currentRequest = undefined;
  }
  hideLoading();
  submitButton.disabled = false;
}

function cancelReverse(side) {
  if (reverseRequests[side]) {
    reverseRequests[side].abort();
    delete reverseRequests[side];
  }
}

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

errorCloseButton.addEventListener("click", () => errorModal.close());
errorModal.addEventListener("close", () => {
  if (!errorModal.open) {
    submitButton.focus();
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

form.addEventListener("submit", (event) => {
  event.preventDefault();
  estimateRide(false);
});

async function estimateRide(fromDrag) {
  if (!form.reportValidity()) {
    statusMessage.textContent = "Informe origem e destino válidos para atualizar a estimativa.";
    return;
  }
  invalidateRequest();
  const version = requestVersion;
  const controller = new AbortController();
  currentRequest = controller;
  statusMessage.textContent = "";
  if (fromDrag) {
    clearEstimate();
    statusMessage.textContent = "Atualizando a estimativa do frete...";
  } else {
    results.hidden = true;
    submitButton.disabled = true;
    showLoading();
  }
  let popupMessage;

  const formData = new FormData(form);
  const requestedLocations = { ...locations };
  try {
    const response = await fetch("/api/corrida/estimar", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origem: formData.get("origem"),
        destino: formData.get("destino"),
        localizacao: requestedLocations
      })
    });

    let body;
    try {
      body = await response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw error;
      }
      throw new Error("A consulta retornou uma resposta inválida. Tente novamente.");
    }
    if (!response.ok) {
      throw new Error(body.error || "Não foi possível estimar o frete.");
    }

    if (version !== requestVersion) return;
    locations = body.localizacao;
    for (const side of ["origem", "destino"]) {
      if (!requestedLocations[side]) {
        body[side] = body[side] || inputs[side].value;
      } else {
        body[side] = inputs[side].value;
      }
    }
    routeSummary.textContent = `${body.origem} → ${body.destino}`;
    results.hidden = false;
    renderMap(body, !fromDrag);
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
    if (body.status_preco === "falha_consulta") {
      popupMessage = body.mensagem_preco ||
        "Não foi possível consultar o preço. A duração foi estimada normalmente.";
    }
    statusMessage.textContent = "";
  } catch (error) {
    if (version !== requestVersion) return;
    if (error.name === "AbortError") {
      statusMessage.textContent = "Consulta cancelada.";
    } else if (fromDrag) {
      statusMessage.textContent = error instanceof TypeError
        ? "Não foi possível atualizar a estimativa. Verifique sua conexão e tente novamente."
        : error.message || "Não foi possível atualizar a estimativa. Tente novamente.";
    } else {
      popupMessage = error instanceof TypeError
        ? "Não foi possível concluir a consulta. Verifique sua conexão e tente novamente."
        : error.message || "Não foi possível concluir a consulta. Tente novamente.";
    }
  } finally {
    if (version === requestVersion) {
      hideLoading();
      currentRequest = undefined;
      submitButton.disabled = false;
      if (popupMessage) {
        errorMessage.textContent = popupMessage;
        errorModal.showModal();
        errorCloseButton.focus();
      } else if (!fromDrag) {
        submitButton.focus();
      }
    }
  }
}

function clearEstimate() {
  distanceResult.textContent = "Aguardando atualização";
  durationResult.textContent = "Aguardando atualização";
  priceResult.textContent = "Aguardando atualização";
  priceNote.hidden = true;
}

function updateMapStatus() {
  mapStatus.textContent = Object.values(reverseWarnings).join(" ");
}

async function reverseGeocode(side, coordinate) {
  cancelReverse(side);
  const controller = new AbortController();
  reverseRequests[side] = controller;
  delete reverseWarnings[side];
  updateMapStatus();
  try {
    const response = await fetch("/api/corrida/geocodificacao-reversa", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(coordinate)
    });
    const body = await response.json();
    if (!response.ok || typeof body.endereco !== "string" || body.endereco.trim().length < 3) {
      throw new Error(body.error || "Endereço não encontrado.");
    }
    if (reverseRequests[side] !== controller) return;
    inputs[side].value = body.endereco.trim().slice(0, 200);
    updateMapLabels();
  } catch (error) {
    if (error.name !== "AbortError" && reverseRequests[side] === controller) {
      reverseWarnings[side] =
        `Não foi possível identificar o endereço de ${side}; as coordenadas serão usadas.`;
      updateMapStatus();
    }
  } finally {
    if (reverseRequests[side] === controller) delete reverseRequests[side];
  }
}

function updateMapLabels() {
  routeSummary.textContent = `${inputs.origem.value} → ${inputs.destino.value}`;
  for (const side of ["origem", "destino"]) {
    if (markers[side]) {
      const label = side === "origem" ? "Origem" : "Destino";
      markers[side].setPopupContent(`<strong>${label}</strong><br>${escapeHtml(inputs[side].value)}`);
    }
  }
}

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

function renderMap(ride, fitBounds = true) {
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
  const originIcon = createMapIcon(
    "O",
    "origem",
    locations.destino.longitude < locations.origem.longitude
  );
  const destinationIcon = createMapIcon("D", "destino");
  markers.origem = window.L.marker(origin, { draggable: true, title: "Origem" })
    .setIcon(originIcon)
    .bindPopup(`<strong>Origem</strong><br>${escapeHtml(ride.origem)}`)
    .addTo(routeLayer);
  markers.destino = window.L.marker(destination, { draggable: true, title: "Destino" })
    .setIcon(destinationIcon)
    .bindPopup(`<strong>Destino</strong><br>${escapeHtml(ride.destino)}`)
    .addTo(routeLayer);
  routeLine = window.L.polyline([origin, destination], {
    color: "#1e5fb4",
    weight: 4,
    opacity: 0.8,
    dashArray: "8 8"
  }).addTo(routeLayer);

  for (const side of ["origem", "destino"]) {
    preventMapTouch(markers[side]);
    markers[side].on("dragstart", () => {
      invalidateRequest();
      cancelReverse(side);
      clearEstimate();
      statusMessage.textContent = "Solte o marcador para atualizar a estimativa.";
    });
    markers[side].on("drag", () => {
      routeLine.setLatLngs([markers.origem.getLatLng(), markers.destino.getLatLng()]);
    });
    markers[side].on("dragend", () => {
      const point = markers[side].getLatLng().wrap();
      markers[side].setLatLng(point);
      locations[side] = { latitude: point.lat, longitude: point.lng };
      routeLine.setLatLngs([markers.origem.getLatLng(), markers.destino.getLatLng()]);
      inputs[side].value = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
      updateMapLabels();
      reverseGeocode(side, locations[side]);
      estimateRide(true);
    });
  }

  map.invalidateSize();
  if (fitBounds) {
    const fitOptions = window.matchMedia("(pointer: coarse)").matches
      ? { paddingTopLeft: [80, 95], paddingBottomRight: [36, 36], maxZoom: 15 }
      : { padding: [28, 28], maxZoom: 15 };
    map.fitBounds(routeLayer.getBounds(), fitOptions);
  }
  updateMapStatus();
}

function preventMapTouch(marker) {
  const attach = () => {
    window.L.DomEvent.on(marker.getElement(), "touchstart", (event) => {
      if (event.touches.length === 1) {
        window.L.DomEvent.stopPropagation(event);
      }
    });
  };
  if (marker.getElement()) {
    attach();
  } else {
    marker.once("add", attach);
  }
}

const TRUCK_SVG =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true">' +
  '<path d="M1 5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v2h3.4a1 1 0 0 1 .8.4l3 4a1 1 0 0 1 .2.6V17a1 1 0 0 1-1 1h-1.1a3 3 0 0 1-5.8 0H9.9a3 3 0 0 1-5.8 0H3a1 1 0 0 1-1-1V5zm13 4v3h5.5L17.3 9H14zM7 16a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm10 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>' +
  "</svg>";

function createMapIcon(label, location, facingLeft = false) {
  const truck = facingLeft
    ? TRUCK_SVG.replace("<svg ", '<svg style="transform:scaleX(-1)" ')
    : TRUCK_SVG;
  return window.L.divIcon({
    className: `map-marker-icon map-marker-${location}`,
    html: `<span>${location === "origem" ? truck : label}</span>`,
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
