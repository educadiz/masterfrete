# Master Frete

Aplicação local para estimar fretes com HTML, CSS e JavaScript puros no
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

O modelo de duração `masterfrete_duracao` recebe `dataframe_split` com as
colunas, nesta ordem: `hora`, `minuto`, `distancia_haversine`,
`latitude_origem`, `longitude_origem`, `latitude_destino` e
`longitude_destino`. A hora e o minuto usam o fuso `America/Sao_Paulo` e a
distância Haversine é enviada em quilômetros, sem arredondamento. A aplicação
interpreta a previsão retornada em `predictions[0]` como minutos.

O modelo de preço `masterfrete_preco` recebe `dataframe_split` com valores
numéricos finitos, nesta ordem: `dia`, `dia_semana`, `mes`, `hora`, `periodo`,
`distancia`, `latitude_origem`, `longitude_origem`, `latitude_destino` e
`longitude_destino`. A previsão em `predictions[0]` é apresentada em reais.
As codificações e unidades existentes são mantidas; confirme que também
correspondem ao treinamento do novo modelo antes de usar as previsões.

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
`MasterFrete/1.0`, mantém resultados geocodificados em cache na memória e serializa
as chamadas para limitar a frequência a no máximo uma por segundo. O cache é
reiniciado quando o backend para.

O mapa usa tiles públicos de `tile.openstreetmap.org` e exibe a atribuição
obrigatória ao OpenStreetMap. Nominatim (geocodificação) e os tiles do mapa são
serviços separados, ambos dependentes de conexão com a internet e sujeitos às
políticas de uso dos respectivos provedores. Para uso intenso ou em produção,
use provedores de mapa e geocodificação apropriados ao volume de tráfego.

Após estimar pelos endereços, arraste o marcador de origem ou destino para
recalcular a distância e as previsões com as coordenadas exatas selecionadas.
A linha no mapa continua sendo apenas ilustrativa, não uma rota viária. O
Nominatim tenta identificar o endereço do ponto; se falhar, as coordenadas
continuam visíveis e são usadas para a estimativa. Para voltar a selecionar
uma localização por endereço, edite o campo e clique em **Estimar frete**.

O endpoint existente `/api/corrida/estimar` também aceita `localizacao`
opcional com `origem` e/ou `destino`, cada um com `latitude` e `longitude`
numéricas. Pontos omitidos continuam sendo geocodificados pelo endereço.
`/api/corrida/geocodificacao-reversa` recebe uma coordenada e retorna
`endereco`; a falha dessa consulta não impede o cálculo pelas coordenadas.

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

Os testes locais verificam o cálculo de distância, a seleção por coordenadas,
a geocodificação reversa, os contratos dos modelos de
duração e preço, a requisição autenticada e a resposta da API. Os contratos de
duração e preço são testados nas implementações local e Firebase. A validação
real dos endpoints requer um token válido e acesso de rede.
