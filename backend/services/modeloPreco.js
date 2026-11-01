const { PRICE_ENDPOINT, getToken } = require("../config/databricks");
const {
  prepararDadosModeloPreco
} = require("../config/codificacaoModeloPreco");
const { parseResponse } = require("./modeloDuracao");
const { registrarRequisicaoModelo } = require("../utils/depuracao");

async function estimarPreco(
  origin,
  destination,
  distanciaHaversineKm,
  dataHora = new Date()
) {
  const payload = prepararDadosModeloPreco(
    origin,
    destination,
    distanciaHaversineKm,
    dataHora
  );
  registrarRequisicaoModelo("preco", PRICE_ENDPOINT, payload);
  const response = await fetch(PRICE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000)
  });

  const body = await parseResponse(response, "preço");
  const prediction = body.predictions?.[0];
  if (!Number.isFinite(prediction) || prediction < 0) {
    const error = new Error("O modelo de preço retornou uma previsão inválida.");
    error.status = 502;
    throw error;
  }

  return prediction;
}

module.exports = { estimarPreco };
