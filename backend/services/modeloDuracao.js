const { DURATION_ENDPOINT, getToken } = require("../config/databricks");
const {
  registrarRequisicaoModelo,
  registrarRespostaModelo
} = require("../utils/depuracao");

async function estimarDuracao(origin, destination, distanceKm) {
  const payload = {
    dataframe_split: {
      columns: [
        "latitude_origem",
        "longitude_origem",
        "latitude_destino",
        "longitude_destino",
        "distancia_haversine"
      ],
      data: [
        [
          origin.latitude,
          origin.longitude,
          destination.latitude,
          destination.longitude,
          distanceKm
        ]
      ]
    }
  };

  registrarRequisicaoModelo("duracao", DURATION_ENDPOINT, payload);
  const response = await fetch(DURATION_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000)
  });

  const body = await parseResponse(response, "duração");
  const prediction = body.predictions?.[0];
  if (!Number.isFinite(prediction) || prediction < 0) {
    const error = new Error(
      "O modelo de duração retornou uma previsão inválida."
    );
    error.status = 502;
    throw error;
  }

  return prediction;
}

async function parseResponse(response, nomeModelo) {
  const responseText = await response.text();
  registrarRespostaModelo(nomeModelo, response.status, responseText);
  let body;

  try {
    body = JSON.parse(responseText);
  } catch {
    const error = new Error(
      `O modelo de ${nomeModelo} retornou uma resposta que não é JSON válido.`
    );
    error.status = 502;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      `O modelo de ${nomeModelo} respondeu com HTTP ${response.status}.`
    );
    error.status = 502;
    throw error;
  }

  return body;
}

module.exports = { estimarDuracao, parseResponse };
