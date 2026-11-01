require("dotenv").config();

const express = require("express");
const path = require("node:path");
const corridaRouter = require("./routes/corrida");

const app = express();
const PORT = 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.resolve(__dirname, "..", "frontend")));
app.use("/api/corrida", corridaRouter);

app.use((error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) {
    console.error(error.message);
  }

  response.status(status).json({
    error: status === 500 ? "Erro interno ao estimar a corrida." : error.message
  });
});

app.listen(PORT, () => {
  console.log(`Bicitaxi disponível em http://localhost:${PORT}`);
});
