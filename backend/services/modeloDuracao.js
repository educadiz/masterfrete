const { DURATION_ENDPOINT, getToken } = require("../config/databricks");
const {
  FUSO_HORARIO,
  MAPEAMENTO_DIAS_SEMANA
} = require("../config/codificacaoModeloPreco");
const {
  registrarRequisicaoModelo,
  registrarRespostaModelo
} = require("../utils/depuracao");

// dia_semana segue a codificação confirmada: Domingo = 1 ... Sábado = 7.
function obterCamposTemporaisDuracao(dataHora) {
  if (!(dataHora instanceof Date) || Number.isNaN(dataHora.getTime())) {
    throw new TypeError("A data/hora da solicitação é inválida.");
  }

  const valores = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: FUSO_HORARIO,
      weekday: "long",
      year: "numeric",
      month: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23"
    })
      .formatToParts(dataHora)
      .map(({ type, value }) => [type, value])
  );

  return {
    ano: Number(valores.year),
    mes: Number(valores.month),
    hora: Number(valores.hour),
    minuto: Number(valores.minute),
    dia_semana: MAPEAMENTO_DIAS_SEMANA[valores.weekday]
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
        "ano",
        "mes",
        "hora",
        "minuto",
        "latitude_origem",
        "longitude_origem",
        "latitude_destino",
        "longitude_destino",
        "distancia_haversine",
        "dia_semana"
      ],
      data: [
        [
          temporal.ano,
          temporal.mes,
          temporal.hora,
          temporal.minuto,
          origin.latitude,
          origin.longitude,
          destination.latitude,
          destination.longitude,
          distanceKm,
          temporal.dia_semana
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
