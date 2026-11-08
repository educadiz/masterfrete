# Master Frete

Aplicação web acadêmica para estimar a distância, a duração e o preço de uma
corrida a partir dos endereços de origem e destino. A estimativa de preço e
duração é consultada em modelos de aprendizado de máquina hospedados no
Databricks.

## Publicação

**Aplicação:** [https://masterfrete-c4a5d.web.app/](https://masterfrete-c4a5d.web.app/)

<img width="573" height="556" alt="image" src="https://github.com/user-attachments/assets/b5b17d26-4118-4906-9590-951923294eb9" />


## Tecnologias

- **Frontend:** HTML, CSS, JavaScript e Leaflet.
- **Mapa e geocodificação:** OpenStreetMap e Nominatim.
- **API:** Node.js, Express e Cloud Functions for Firebase.
- **Modelos de previsão:** Databricks Model Serving.
- **Hospedagem:** Firebase Hosting.

## Endereços da API

Os endpoints abaixo recebem requisições `POST` com conteúdo JSON:

| Endpoint | URL |
| --- | --- |
| Estimar corrida | `https://masterfrete-c4a5d.web.app/api/corrida/estimar` |
| Geocodificação reversa | `https://masterfrete-c4a5d.web.app/api/corrida/geocodificacao-reversa` |

`/estimar` recebe os endereços de origem e destino e retorna a distância,
a duração estimada e o preço, quando disponível. `/geocodificacao-reversa`
recebe latitude e longitude e retorna o endereço correspondente.

## Executar localmente

Requer Node.js 20 ou superior e um token autorizado do Databricks. Configure
`DATABRICKS_TOKEN` em `backend/.env` usando `backend/.env.example` como modelo
e execute na raiz do projeto:

```powershell
npm --prefix backend ci
npm --prefix backend start
```

A aplicação local fica disponível em [http://localhost:3000](http://localhost:3000).
