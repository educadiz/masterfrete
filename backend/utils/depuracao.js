function registrarRequisicaoModelo(nomeModelo, url, payload) {
  console.log(
    `[${nomeModelo}] Requisição POST ${url}\n${JSON.stringify(payload, null, 2)}`
  );
}

function registrarRespostaModelo(nomeModelo, status, corpo) {
  console.log(`[${nomeModelo}] Resposta HTTP ${status}: ${corpo}`);
}

module.exports = { registrarRequisicaoModelo, registrarRespostaModelo };
