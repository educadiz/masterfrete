const test = require("node:test");
const assert = require("node:assert/strict");
const { haversineKm } = require("../utils/haversine");
const {
  converterDistanciaPreco,
  obterCamposTemporais,
  prepararDadosModeloPreco
} = require("../config/codificacaoModeloPreco");

const ORIGEM = { latitude: -23.513742609587695, longitude: -46.62327810242303 };
const DESTINO = {
  latitude: -23.483853341186528,
  longitude: -46.648585835169115
};
const COLUNAS = [
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
];

test("calcula distância em quilômetros entre coordenadas de São Paulo", () => {
  const distance = haversineKm(ORIGEM, DESTINO);

  assert.ok(Math.abs(distance - 4.2) < 0.1);
});

test("prepara o payload do Modelo 2 na ordem do contrato, com inteiros temporais", () => {
  // 15/10/2018 (segunda-feira), 14h em Brasília.
  const payload = prepararDadosModeloPreco(
    ORIGEM,
    DESTINO,
    4.207852363586426,
    new Date("2018-10-15T14:00:00-03:00")
  );

  assert.deepEqual(payload.dataframe_split.columns, COLUNAS);
  assert.deepEqual(payload.dataframe_split.data, [
    [
      15,
      2,
      10,
      14,
      2,
      4.207852363586426,
      ORIGEM.latitude,
      ORIGEM.longitude,
      DESTINO.latitude,
      DESTINO.longitude
    ]
  ]);
});

test("usa o fuso de Brasília e codifica os limites dos períodos", () => {
  const casos = [
    ["2018-10-14T04:59:00-03:00", 1, 3],
    ["2018-10-14T05:00:00-03:00", 1, 1],
    ["2018-10-14T11:59:00-03:00", 1, 1],
    ["2018-10-14T12:00:00-03:00", 1, 2],
    ["2018-10-14T17:59:00-03:00", 1, 2],
    ["2018-10-14T18:00:00-03:00", 1, 3],
    ["2018-10-20T23:30:00-03:00", 7, 3],
    ["2018-10-21T02:30:00Z", 7, 3]
  ];

  for (const [instante, diaSemana, periodo] of casos) {
    const campos = obterCamposTemporais(new Date(instante));
    assert.equal(campos.dia_semana, diaSemana, instante);
    assert.equal(campos.periodo, periodo, instante);
  }
});

test("converte a distância Haversine em km sem arredondar", () => {
  assert.equal(converterDistanciaPreco(4.207852363586426), 4.207852363586426);
  assert.throws(() => converterDistanciaPreco(-1), TypeError);
});

for (const [ambiente, caminho] of [
  ["local", "../services/modeloPreco"],
  ["Firebase", "../../functions/src/services/modeloPreco"]
]) {
test(`estimarPreco (${ambiente}) envia o contrato numérico autenticado`, async () => {
  const { estimarPreco } = require(caminho);
  const fetchOriginal = global.fetch;
  const tokenOriginal = process.env.DATABRICKS_TOKEN;
  let requisicao;
  process.env.DATABRICKS_TOKEN = "token-de-teste";
  global.fetch = async (url, options) => {
    requisicao = { url, options };
    return new Response(JSON.stringify({ predictions: [18.5] }), {
      status: 200
    });
  };

  try {
    const preco = await estimarPreco(
      ORIGEM,
      DESTINO,
      4.2,
      new Date("2018-10-15T14:00:00-03:00")
    );
    const corpo = JSON.parse(requisicao.options.body);

    assert.equal(preco, 18.5);
    assert.equal(
      requisicao.url,
      "https://dbc-77c403ba-f198.cloud.databricks.com/serving-endpoints/masterfrete_preco/invocations"
    );
    assert.equal(requisicao.options.method, "POST");
    assert.equal(
      requisicao.options.headers.Authorization,
      "Bearer token-de-teste"
    );
    assert.deepEqual(corpo.dataframe_split.columns, COLUNAS);
    assert.deepEqual(corpo.dataframe_split.data, [[
      15, 2, 10, 14, 2, 4.2,
      ORIGEM.latitude, ORIGEM.longitude, DESTINO.latitude, DESTINO.longitude
    ]]);
    assert.ok(corpo.dataframe_split.data[0].every(Number.isFinite));
    assert.equal(requisicao.options.headers["Content-Type"], "application/json");
    const primeiraRequisicao = requisicao;
    for (const invalido of ["-23.5", null, NaN, Infinity]) {
      await assert.rejects(
        estimarPreco({ ...ORIGEM, latitude: invalido }, DESTINO, 4.2),
        /números finitos/
      );
      assert.equal(requisicao, primeiraRequisicao);
    }

    for (const [body, status] of [
      [JSON.stringify({ predictions: [-1] }), 200],
      [JSON.stringify({ predictions: [] }), 200],
      ["não é JSON", 200],
      [JSON.stringify({ error: "falha" }), 500]
    ]) {
      global.fetch = async () => new Response(body, { status });
      await assert.rejects(
        estimarPreco(ORIGEM, DESTINO, 4.2),
        (error) => error.status === 502
      );
    }
  } finally {
    global.fetch = fetchOriginal;
    if (tokenOriginal === undefined) {
      delete process.env.DATABRICKS_TOKEN;
    } else {
      process.env.DATABRICKS_TOKEN = tokenOriginal;
    }
  }
});
}

for (const [ambiente, caminho] of [
  ["local", "../services/modeloDuracao"],
  ["Firebase", "../../functions/src/services/modeloDuracao"]
]) {
  test(`modelo de duração (${ambiente}) envia o contrato autenticado`, async () => {
    const { estimarDuracao, obterCamposTemporaisDuracao } = require(caminho);
    const fetchOriginal = global.fetch;
    const tokenOriginal = process.env.DATABRICKS_TOKEN;
    let requisicao;
    process.env.DATABRICKS_TOKEN = "token-de-teste";
    global.fetch = async (url, options) => {
      requisicao = { url, options };
      return new Response(JSON.stringify({ predictions: [12.5] }), { status: 200 });
    };

    try {
      const duracao = await estimarDuracao(
        ORIGEM,
        DESTINO,
        4.207852363586426,
        new Date("2018-10-15T17:35:00Z")
      );

      assert.equal(duracao, 12.5);
      assert.equal(
        requisicao.url,
        "https://dbc-77c403ba-f198.cloud.databricks.com/serving-endpoints/masterfrete_duracao/invocations"
      );
      assert.equal(requisicao.options.method, "POST");
      assert.equal(requisicao.options.headers.Authorization, "Bearer token-de-teste");
      assert.equal(requisicao.options.headers["Content-Type"], "application/json");
      assert.deepEqual(JSON.parse(requisicao.options.body), {
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
          data: [[
            14,
            35,
            4.207852363586426,
            ORIGEM.latitude,
            ORIGEM.longitude,
            DESTINO.latitude,
            DESTINO.longitude
          ]]
        }
      });
      assert.deepEqual(
        obterCamposTemporaisDuracao(new Date("2018-10-15T02:05:00Z")),
        { hora: 23, minuto: 5 }
      );
      assert.throws(() => obterCamposTemporaisDuracao(new Date("inválida")), TypeError);
    } finally {
      global.fetch = fetchOriginal;
      if (tokenOriginal === undefined) {
        delete process.env.DATABRICKS_TOKEN;
      } else {
        process.env.DATABRICKS_TOKEN = tokenOriginal;
      }
    }
  });

  test(`modelo de duração (${ambiente}) rejeita falhas e previsões inválidas`, async () => {
    const { estimarDuracao } = require(caminho);
    const fetchOriginal = global.fetch;
    const tokenOriginal = process.env.DATABRICKS_TOKEN;
    process.env.DATABRICKS_TOKEN = "token-de-teste";

    try {
      for (const [body, status] of [
        [JSON.stringify({ predictions: [-1] }), 200],
        [JSON.stringify({ predictions: [] }), 200],
        ["não é JSON", 200],
        [JSON.stringify({ error: "falha" }), 500]
      ]) {
        global.fetch = async () => new Response(body, { status });
        await assert.rejects(
          estimarDuracao(ORIGEM, DESTINO, 4.2),
          (error) => error.status === 502
        );
      }
    } finally {
      global.fetch = fetchOriginal;
      if (tokenOriginal === undefined) {
        delete process.env.DATABRICKS_TOKEN;
      } else {
        process.env.DATABRICKS_TOKEN = tokenOriginal;
      }
    }
  });
}
