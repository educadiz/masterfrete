const { DURATION_ENDPOINT, getToken } = require("../config/databricks");
const { FUSO_HORARIO } = require("../config/codificacaoModeloPreco");
const {
  registrarRequisicaoModelo,
  registrarRespostaModelo
} = require("../utils/depuracao");

function obterCamposTemporaisDuracao(dataHora) {
  if (!(dataHora instanceof Date) || Number.isNaN(dataHora.getTime())) {
    throw new TypeError("A data/hora da solicitação é inválida.");
  }

  const valores = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: FUSO_HORARIO,
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23"
    })
      .formatToParts(dataHora)
      .map(({ type, value }) => [type, value])
  );

  return {
    hora: Number(valores.hour),
    minuto: Number(valores.minute)
  };
}

async function estimarDuracao(
  origin,
  destination,
  distanceKm,
  dataHora = new Date()
) {
  const temporal = obterCamposTemporaisDuracao(dataHora);
  const payload = {
    dataframe_split: {
      columns: [
        "hora",
        "minuto",
        "distancia_haversine",
        "latitude_origem",
        "longitude_origem",
        "latitude_destino",
        "longitude_destino"
      ],
      data: [
        [
          temporal.hora,
          temporal.minuto,
          distanceKm,
          origin.latitude,
          origin.longitude,
          destination.latitude,
          destination.longitude
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

module.exports = { estimarDuracao, obterCamposTemporaisDuracao, parseResponse };
