const express = require("express");
const { geocodificar, geocodificarReverso } = require("../services/geolocalizacao");
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
    const { origem, destino, localizacao } = request.body ?? {};
    validarEndereco(origem, "origem");
    validarEndereco(destino, "destino");

    if (localizacao !== undefined &&
        (!localizacao || typeof localizacao !== "object" || Array.isArray(localizacao))) {
      const error = new Error("Informe coordenadas válidas.");
      error.status = 400;
      throw error;
    }
    const coordenadaOrigem = await resolverLocalizacao(origem, localizacao?.origem, "origem");
    const coordenadaDestino = await resolverLocalizacao(destino, localizacao?.destino, "destino");
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

router.post("/geocodificacao-reversa", async (request, response, next) => {
  try {
    validarCoordenada(request.body, "localização");
    const endereco = await geocodificarReverso(request.body);
    response.json({ endereco });
  } catch (error) {
    next(error);
  }
});

async function resolverLocalizacao(endereco, coordenada, nomeCampo) {
  if (coordenada === undefined) {
    return geocodificar(endereco);
  }
  validarCoordenada(coordenada, nomeCampo);
  return { latitude: coordenada.latitude, longitude: coordenada.longitude, displayName: endereco };
}

function validarCoordenada(coordenada, nomeCampo) {
  if (!coordenada || typeof coordenada !== "object" || Array.isArray(coordenada) ||
      !Number.isFinite(coordenada.latitude) || coordenada.latitude < -90 ||
      coordenada.latitude > 90 || !Number.isFinite(coordenada.longitude) ||
      coordenada.longitude < -180 || coordenada.longitude > 180) {
    const error = new Error(`Informe coordenadas válidas para ${nomeCampo}.`);
    error.status = 400;
    throw error;
  }
}

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
