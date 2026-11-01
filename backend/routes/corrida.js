const express = require("express");
const { geocodificar } = require("../services/geolocalizacao");
const { estimarDuracao } = require("../services/modeloDuracao");
const { estimarPreco } = require("../services/modeloPreco");
const {
  MENSAGEM_PRECO_PENDENTE,
  PreparacaoPrecoPendenteError
} = require("../config/codificacaoModeloPreco");
const { haversineKm } = require("../utils/haversine");

const router = express.Router();

router.post("/estimar", async (request, response, next) => {
  try {
    const { origem, destino } = request.body ?? {};
    validarEndereco(origem, "origem");
    validarEndereco(destino, "destino");

    const coordenadaOrigem = await geocodificar(origem);
    const coordenadaDestino = await geocodificar(destino);
    const distanciaKm = haversineKm(coordenadaOrigem, coordenadaDestino);
    const duracaoMinutos = await estimarDuracao(
      coordenadaOrigem,
      coordenadaDestino,
      distanciaKm
    );

    let precoEstimado = null;
    let statusPreco = "calculado";
    let mensagemPreco = null;
    try {
      precoEstimado = await estimarPreco(
        coordenadaOrigem,
        coordenadaDestino,
        distanciaKm
      );
    } catch (error) {
      if (error instanceof PreparacaoPrecoPendenteError) {
        statusPreco = "pendente_validacao";
        mensagemPreco = MENSAGEM_PRECO_PENDENTE;
      } else {
        statusPreco = "falha_consulta";
        mensagemPreco =
          "Não foi possível consultar o modelo de preço; a duração foi estimada normalmente.";
        console.error(`Falha na consulta ao modelo de preço: ${error.message}`);
      }
    }

    response.json({
      sucesso: true,
      origem: coordenadaOrigem.displayName,
      destino: coordenadaDestino.displayName,
      localizacao: {
        origem: {
          latitude: coordenadaOrigem.latitude,
          longitude: coordenadaOrigem.longitude
        },
        destino: {
          latitude: coordenadaDestino.latitude,
          longitude: coordenadaDestino.longitude
        }
      },
      distanciaKm,
      duracao_estimada_minutos: duracaoMinutos,
      preco_estimado: precoEstimado,
      status_preco: statusPreco,
      mensagem_preco: mensagemPreco
    });
  } catch (error) {
    next(error);
  }
});

function validarEndereco(endereco, nomeCampo) {
  if (
    typeof endereco !== "string" ||
    endereco.trim().length < 3 ||
    endereco.trim().length > 200
  ) {
    const error = new Error(
      `Informe um endereço de ${nomeCampo} com 3 a 200 caracteres.`
    );
    error.status = 400;
    throw error;
  }
}

module.exports = router;
