const FUSO_HORARIO = "America/Sao_Paulo";
const CODIFICACAO_PRECO_CONFIRMADA = true;
const DISTANCIA_PRECO_CONFIRMADA = true;
const CRITERIO_DISTANCIA_PRECO = "haversine";
const UNIDADE_DISTANCIA_PRECO = "km";

// Domingo = 1 ... Sábado = 7, conforme informado para o treinamento.
const MAPEAMENTO_DIAS_SEMANA = Object.freeze({
  Sunday: 1,
  Monday: 2,
  Tuesday: 3,
  Wednesday: 4,
  Thursday: 5,
  Friday: 6,
  Saturday: 7
});

// Faixas [inicio, fim) em horas; a noite atravessa a meia-noite.
const FAIXAS_PERIODOS = Object.freeze([
  Object.freeze({ codigo: 1, nome: "Manhã", inicio: 5, fim: 12 }),
  Object.freeze({ codigo: 2, nome: "Tarde", inicio: 12, fim: 18 }),
  Object.freeze({ codigo: 3, nome: "Noite", inicio: 18, fim: 5 })
]);

const MENSAGEM_CODIFICACAO_PENDENTE =
  "Estimativa de preço temporariamente indisponível: codificação das variáveis periodo e dia_semana ainda não confirmada.";
const MENSAGEM_PRECO_PENDENTE =
  "A estimativa de preço será disponibilizada após a confirmação das codificações utilizadas no treinamento do modelo.";

class PreparacaoPrecoPendenteError extends Error {
  constructor(message) {
    super(message);
    this.name = "PreparacaoPrecoPendenteError";
  }
}

function obterCamposTemporais(dataHora) {
  if (!CODIFICACAO_PRECO_CONFIRMADA) {
    throw new PreparacaoPrecoPendenteError(
      MENSAGEM_CODIFICACAO_PENDENTE
    );
  }

  if (!(dataHora instanceof Date) || Number.isNaN(dataHora.getTime())) {
    throw new TypeError("A data/hora da solicitação é inválida.");
  }

  const campos = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO_HORARIO,
    weekday: "long",
    day: "numeric",
    month: "numeric",
    hour: "numeric",
    hourCycle: "h23"
  }).formatToParts(dataHora);
  const valores = Object.fromEntries(
    campos.map(({ type, value }) => [type, value])
  );
  const diaSemana = MAPEAMENTO_DIAS_SEMANA[valores.weekday];

  if (!Number.isInteger(diaSemana)) {
    throw new PreparacaoPrecoPendenteError(
      MENSAGEM_CODIFICACAO_PENDENTE
    );
  }

  const hora = Number(valores.hour);
  const faixa = FAIXAS_PERIODOS.find(({ inicio, fim }) => {
    if (!Number.isInteger(inicio) || !Number.isInteger(fim)) {
      return false;
    }

    return inicio < fim
      ? hora >= inicio && hora < fim
      : hora >= inicio || hora < fim;
  });
  if (!faixa || !Number.isInteger(faixa.codigo)) {
    throw new PreparacaoPrecoPendenteError(
      MENSAGEM_CODIFICACAO_PENDENTE
    );
  }

  return {
    dia: Number(valores.day),
    dia_semana: diaSemana,
    mes: Number(valores.month),
    hora,
    periodo: faixa.codigo
  };
}

function converterDistanciaPreco(distanciaHaversineKm) {
  if (!DISTANCIA_PRECO_CONFIRMADA) {
    throw new PreparacaoPrecoPendenteError(
      "Estimativa de preço temporariamente indisponível: unidade e critério da variável distancia ainda não confirmados."
    );
  }

  if (!Number.isFinite(distanciaHaversineKm) || distanciaHaversineKm < 0) {
    throw new TypeError("A distância recebida para o preço é inválida.");
  }

  if (CRITERIO_DISTANCIA_PRECO !== "haversine") {
    throw new PreparacaoPrecoPendenteError(
      "Estimativa de preço temporariamente indisponível: ajuste o conversor ao critério de distancia confirmado no treinamento."
    );
  }

  if (UNIDADE_DISTANCIA_PRECO === "km") {
    return distanciaHaversineKm;
  }
  if (UNIDADE_DISTANCIA_PRECO === "m") {
    return distanciaHaversineKm * 1000;
  }

  throw new PreparacaoPrecoPendenteError(
    "Estimativa de preço temporariamente indisponível: unidade da variável distancia não confirmada."
  );
}

function prepararDadosModeloPreco(
  origin,
  destination,
  distanciaHaversineKm,
  dataHora = new Date()
) {
  const temporal = obterCamposTemporais(dataHora);
  const distancia = converterDistanciaPreco(distanciaHaversineKm);

  return {
    dataframe_split: {
      columns: [
        "dia",
        "dia_semana",
        "mes",
        "hora",
        "periodo",
        "distancia",
        "latitude_origem",
        "longitude_origem",
        "latitude_destino",
        "longitude_destino"
      ],
      data: [
        [
          temporal.dia,
          temporal.dia_semana,
          temporal.mes,
          temporal.hora,
          temporal.periodo,
          distancia,
          origin.latitude,
          origin.longitude,
          destination.latitude,
          destination.longitude
        ]
      ]
    }
  };
}

module.exports = {
  CODIFICACAO_PRECO_CONFIRMADA,
  CRITERIO_DISTANCIA_PRECO,
  DISTANCIA_PRECO_CONFIRMADA,
  FAIXAS_PERIODOS,
  FUSO_HORARIO,
  MAPEAMENTO_DIAS_SEMANA,
  MENSAGEM_CODIFICACAO_PENDENTE,
  MENSAGEM_PRECO_PENDENTE,
  PreparacaoPrecoPendenteError,
  UNIDADE_DISTANCIA_PRECO,
  converterDistanciaPreco,
  obterCamposTemporais,
  prepararDadosModeloPreco
};
