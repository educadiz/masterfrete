# Bicitaxi

Aplicação local para estimar corridas com HTML, CSS e JavaScript puros no
frontend e Node.js/Express no backend.

## Arquitetura

- `frontend/`: interface estática servida pelo Express.
- `backend/routes/`: endpoint REST para estimar uma corrida.
- `backend/services/`: geocodificação Nominatim e clientes dos modelos
  Databricks.
- `backend/utils/`: cálculo de distância e regras auxiliares.
- `backend/config/`: URLs dos endpoints e codificações do modelo de preço.
- `backend/config/codificacaoModeloPreco.js`: confirmação, mapas temporais,
  faixas horárias e conversão isolada da distância para o Modelo 2.
- O frontend usa Leaflet para exibir um mapa com origem, destino e o trajeto
  aproximado entre as coordenadas geocodificadas.

O fluxo recebe origem e destino, geocodifica os endereços, calcula a distância
Haversine e consulta o modelo de duração. O endpoint do modelo de preço está
integrado e usa as codificações confirmadas para o treinamento (ver
"Codificações do Modelo 2").

## Requisitos

- Node.js 20 ou superior.
- Acesso à internet para Nominatim e Databricks Model Serving.
- Token autorizado para invocar os endpoints.

## Configuração e execução

1. Copie `backend/.env.example` para `backend/.env`.
2. Preencha `DATABRICKS_TOKEN` com o token Databricks localmente. Não o
   compartilhe nem o versione.
3. No terminal, execute:

   ```powershell
   cd backend
   npm install
   npm start
   ```

4. Acesse `http://localhost:3000`.

O arquivo `.env` está ignorado pelo Git. As chamadas Databricks usam
Authorization Bearer. O backend não inicia chamadas aos modelos até que uma
estimativa seja solicitada.

## Nominatim

A aplicação usa o serviço público de busca do Nominatim com identificador
`Bicitaxi/1.0`, mantém resultados geocodificados em cache na memória e serializa
as chamadas para limitar a frequência a no máximo uma por segundo. O cache é
reiniciado quando o backend para.

O mapa usa tiles públicos de `tile.openstreetmap.org` e exibe a atribuição
obrigatória ao OpenStreetMap. Nominatim (geocodificação) e os tiles do mapa são
serviços separados, ambos dependentes de conexão com a internet e sujeitos às
políticas de uso dos respectivos provedores. Para uso intenso ou em produção,
use provedores de mapa e geocodificação apropriados ao volume de tráfego.

## Codificações do Modelo 2

O módulo `backend/config/codificacaoModeloPreco.js` centraliza os mapeamentos
de `dia_semana`, `periodo`, as faixas horárias e a conversão isolada da
distância. Regras confirmadas (fuso `America/Sao_Paulo`):

- `dia_semana`: Domingo = 1 ... Sábado = 7.
- `periodo`: 1 = Manhã (5h–11h59), 2 = Tarde (12h–17h59), 3 = Noite
  (18h–4h59).
- `distancia`: distância Haversine em km, sem arredondamento.

Para voltar a bloquear a consulta, defina `CODIFICACAO_PRECO_CONFIRMADA` ou
`DISTANCIA_PRECO_CONFIRMADA` como `false`: a API devolve
`preco_estimado: null` e `status_preco: "pendente_validacao"` sem afetar a
duração. O frontend não permite alterar as codificações. Recomenda-se comparar
as previsões com registros reais do dataset de treinamento. Se a consulta de
preço falhar, a API informa `falha_consulta` mantendo a duração.

## Testes

Na pasta `backend`, execute:

```powershell
npm test
```

Os testes locais verificam o cálculo de distância, a preparação do payload do
preço (codificações e fuso), a requisição autenticada e a resposta da API. A
validação real dos endpoints requer um token válido e acesso de rede.
