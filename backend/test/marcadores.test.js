const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

for (const [ambiente, prefixo] of [
  ["local", ".."],
  ["Firebase", "../../functions/src"]
]) {
  test(`coordenadas e geocodificação reversa na API ${ambiente}`, async () => {
    const caminhos = {
      geo: require.resolve(`${prefixo}/services/geolocalizacao`),
      duracao: require.resolve(`${prefixo}/services/modeloDuracao`),
      preco: require.resolve(`${prefixo}/services/modeloPreco`),
      router: require.resolve(`${prefixo}/routes/corrida`)
    };
    const originais = Object.fromEntries(
      Object.entries(caminhos).map(([nome, id]) => [nome, require.cache[id]])
    );
    const buscas = [];
    const chamadasModelo = [];
    const substituir = (id, exports) => {
      require.cache[id] = { id, filename: id, loaded: true, exports };
    };
    substituir(caminhos.geo, {
      geocodificar: async (endereco) => {
        buscas.push(endereco);
        return { latitude: -8, longitude: -35, displayName: "Destino localizado" };
      },
      geocodificarReverso: async (coordenada) =>
        `Endereço ${coordenada.latitude}, ${coordenada.longitude}`
    });
    substituir(caminhos.duracao, {
      estimarDuracao: async (...args) => {
        chamadasModelo.push(args);
        return 12;
      }
    });
    substituir(caminhos.preco, {
      estimarPreco: async (...args) => {
        chamadasModelo.push(args);
        return 25;
      }
    });
    delete require.cache[caminhos.router];
    const app = express();
    app.use(express.json());
    app.use(require(caminhos.router));
    app.use((error, request, response, next) => {
      response.status(error.status || 500).json({ error: error.message });
    });
    const server = app.listen(0, "127.0.0.1");

    try {
      await new Promise((resolve) => server.once("listening", resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      const post = (path, body) => fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const origem = { latitude: -8.123456, longitude: -34.987654 };
      let response = await post("/estimar", {
        origem: "Origem selecionada",
        destino: "Destino digitado",
        localizacao: { origem }
      });
      const resultado = await response.json();
      assert.equal(response.status, 200);
      assert.deepEqual(buscas, ["Destino digitado"]);
      assert.deepEqual(resultado.localizacao.origem, origem);
      assert.equal(resultado.origem, "Origem selecionada");
      assert.equal(resultado.destino, "Destino localizado");
      assert.equal(chamadasModelo.length, 2);
      for (const [pontoOrigem, pontoDestino, distancia] of chamadasModelo) {
        assert.deepEqual(pontoOrigem, { ...origem, displayName: "Origem selecionada" });
        assert.equal(pontoDestino.latitude, -8);
        assert.ok(distancia > 0);
      }

      const destino = { latitude: -8.2, longitude: -35.1 };
      response = await post("/estimar", {
        origem: "Origem selecionada",
        destino: "Destino selecionado",
        localizacao: { origem, destino }
      });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).localizacao, { origem, destino });
      assert.deepEqual(buscas, ["Destino digitado"]);
      assert.deepEqual(chamadasModelo[2][1], { ...destino, displayName: "Destino selecionado" });

      response = await post("/geocodificacao-reversa", origem);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { endereco: "Endereço -8.123456, -34.987654" });

      for (const coordenada of [
        null, {}, { latitude: "0", longitude: 0 },
        { latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }
      ]) {
        response = await post("/estimar", {
          origem: "Origem", destino: "Destino", localizacao: { origem: coordenada }
        });
        assert.equal(response.status, 400);
        response = await post("/geocodificacao-reversa", coordenada);
        assert.equal(response.status, 400);
      }
      assert.equal(chamadasModelo.length, 4);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      for (const [nome, id] of Object.entries(caminhos)) {
        if (originais[nome]) require.cache[id] = originais[nome];
        else delete require.cache[id];
      }
    }
  });

  test(`Nominatim reverso usa coordenadas sem substituí-las (${ambiente})`, async () => {
    const { geocodificarReverso } = require(`${prefixo}/services/geolocalizacao`);
    const original = global.fetch;
    let url;
    global.fetch = async (requisicao) => {
      url = requisicao;
      return new Response(JSON.stringify({ display_name: "Recife, Pernambuco" }));
    };
    try {
      assert.equal(
        await geocodificarReverso({ latitude: -8.123456, longitude: -34.987654 }),
        "Recife, Pernambuco"
      );
      assert.equal(url.pathname, "/reverse");
      assert.equal(url.searchParams.get("lat"), "-8.123456");
      assert.equal(url.searchParams.get("lon"), "-34.987654");
    } finally {
      global.fetch = original;
    }
  });
}
