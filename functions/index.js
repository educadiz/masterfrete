const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const express = require("express");
const corridaRouter = require("./src/routes/corrida");

// Limita o número de containers simultâneos para controlar custos.
setGlobalOptions({maxInstances: 10, region: "southamerica-east1"});

// Token guardado no Secret Manager; exposto como process.env.DATABRICKS_TOKEN.
const databricksToken = defineSecret("DATABRICKS_TOKEN");

const app = express();
app.disable("x-powered-by");
app.use(express.json({limit: "10kb"}));
app.use("/api/corrida", corridaRouter);

// eslint-disable-next-line no-unused-vars
app.use((error, request, response, next) => {
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) {
    console.error(error.message);
  }
  response.status(status).json({
    error: status === 500 ? "Erro interno ao estimar o frete." : error.message,
  });
});

exports.api = onRequest({secrets: [databricksToken]}, app);
