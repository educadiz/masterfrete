const NOMINATIM_SEARCH_URL =
  "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Bicitaxi/1.0 (local ride estimation app)";
const CACHE_LIMIT = 500;
const geocodeCache = new Map();

let requestQueue = Promise.resolve();
let nextRequestAt = 0;

async function geocodificar(endereco) {
  const chave = endereco.trim().toLocaleLowerCase("pt-BR");
  const cached = geocodeCache.get(chave);
  if (cached) {
    return cached;
  }

  const coordenadas = await enfileirarRequisicao(async () => {
    const url = new URL(NOMINATIM_SEARCH_URL);
    url.searchParams.set("q", endereco);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "pt-BR,pt;q=0.9"
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const error = new Error(
        `O serviço de geocodificação respondeu com HTTP ${response.status}.`
      );
      error.status = 502;
      throw error;
    }

    const resultados = await response.json();
    const primeiroResultado = resultados[0];
    if (!primeiroResultado) {
      const error = new Error(`Endereço não encontrado: "${endereco}".`);
      error.status = 422;
      throw error;
    }

    const latitude = Number(primeiroResultado.lat);
    const longitude = Number(primeiroResultado.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      const error = new Error(
        "O serviço de geocodificação retornou coordenadas inválidas."
      );
      error.status = 502;
      throw error;
    }

    return {
      latitude,
      longitude,
      displayName: primeiroResultado.display_name
    };
  });

  if (geocodeCache.size >= CACHE_LIMIT) {
    const primeiraChave = geocodeCache.keys().next().value;
    geocodeCache.delete(primeiraChave);
  }
  geocodeCache.set(chave, coordenadas);
  return coordenadas;
}

async function enfileirarRequisicao(requisicao) {
  let liberarFila;
  const anterior = requestQueue;
  requestQueue = new Promise((resolve) => {
    liberarFila = resolve;
  });

  await anterior;
  try {
    const espera = Math.max(0, nextRequestAt - Date.now());
    if (espera > 0) {
      await new Promise((resolve) => setTimeout(resolve, espera));
    }
    nextRequestAt = Date.now() + 1000;
    return await requisicao();
  } finally {
    liberarFila();
  }
}

module.exports = { geocodificar };
