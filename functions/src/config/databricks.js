const DURATION_ENDPOINT =
  "https://dbc-77c403ba-f198.cloud.databricks.com/serving-endpoints/masterfrete_duracao/invocations";
const PRICE_ENDPOINT =
  "https://dbc-77c403ba-f198.cloud.databricks.com/serving-endpoints/masterfrete_preco/invocations";

function getToken() {
  const token = process.env.DATABRICKS_TOKEN;

  if (!token) {
    const error = new Error(
      "Configure o secret DATABRICKS_TOKEN (firebase functions:secrets:set)."
    );
    error.status = 503;
    throw error;
  }

  return token;
}

module.exports = {
  DURATION_ENDPOINT,
  PRICE_ENDPOINT,
  getToken
};
