const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

function substituirModulo(caminho, exports) {
  const id = require.resolve(caminho);
  const original = require.cache[id];
  require.cache[id] = { id, filename: id, loaded: true, exports };
  return () => {
    if (original) {
      require.cache[id] = original;
    } else {
      delete require.cache[id];
    }
  };
}

test("API retorna duração e preço calculado", async () => {
  const restaurarGeolocalizacao = substituirModulo(
    "../services/geolocalizacao",
    {
      geocodificar: async (endereco) =>
        endereco === "Origem"
          ? {
              latitude: -23.5,
              longitude: -46.6,
              displayName: "Origem, São Paulo"
            }
          : {
              latitude: -23.4,
              longitude: -46.7,
              displayName: "Destino, São Paulo"
            }
    }
  );
  const restaurarDuracao = substituirModulo("../services/modeloDuracao", {
    estimarDuracao: async () => 12.97
  });
  const restaurarPreco = substituirModulo("../services/modeloPreco", {
    estimarPreco: async () => 18.5
  });
  const routerId = require.resolve("../routes/corrida");
  const routerOriginal = require.cache[routerId];

  try {
    delete require.cache[routerId];
    const router = require("../routes/corrida");
    const app = express();
    app.use(express.json());
    app.use(router);
    const server = app.listen(0, "127.0.0.1");

    try {
      await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });

      const { port } = server.address();
      const response = await fetch(`http://127.0.0.1:${port}/estimar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origem: "Origem", destino: "Destino" })
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.sucesso, true);
      assert.equal(body.duracao_estimada_minutos, 12.97);
      assert.equal(body.preco_estimado, 18.5);
      assert.equal(body.status_preco, "calculado");
      assert.equal(body.mensagem_preco, null);
      assert.deepEqual(Object.keys(body.localizacao), ["origem", "destino"]);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  } finally {
    restaurarGeolocalizacao();
    restaurarDuracao();
    restaurarPreco();
    delete require.cache[routerId];
    if (routerOriginal) {
      require.cache[routerId] = routerOriginal;
    }
  }
});
