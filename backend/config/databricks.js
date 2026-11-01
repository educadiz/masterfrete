const DURATION_ENDPOINT =
  "https://dbc-77c403ba-f198.cloud.databricks.com/serving-endpoints/bicitaxi-duracao-geo/invocations";
const PRICE_ENDPOINT =
  "https://dbc-77c403ba-f198.cloud.databricks.com/serving-endpoints/knn-price/invocations";

function getToken() {
  const token = process.env.DATABRICKS_TOKEN;

  if (!token) {
    const error = new Error(
      "Configure DATABRICKS_TOKEN no arquivo backend/.env."
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
