'use strict'

const logger = require('console-files')
const { SANDBOX, verifyState, exchangeCode, getTokenExpiration } = require('../../lib/melhor-envio/oauth')
const { saveAuth } = require('../../lib/database')

// exchanges OAuth "code" for an access_token and saves it on app hidden_data
// https://docs.melhorenvio.com.br/reference/aplicativo-autenticacao

module.exports = appSdk => {
  return (req, res) => {
    const { code, state, error } = req.query
    if (error) {
      return res.status(400).send(`Melhor Envio authorization error: ${error}`)
    }
    const storeId = verifyState(state)
    if (!code || !storeId) {
      return res.status(400).send('Missing code or invalid state')
    }

    exchangeCode(code)
      .then(data => {
        const expiresAt = getTokenExpiration(data.access_token)
        // same fields read by lib/melhor-envio/client.js consumers
        return appSdk.apiApp(storeId, 'hidden_data', 'PATCH', {
          access_token: data.access_token,
          token_expires_at: expiresAt ? expiresAt.toISOString() : undefined,
          sandbox: SANDBOX
        })
          // keep refresh_token only on app database for periodic renewal
          .then(() => saveAuth(storeId, data.access_token, data.refresh_token))
      })

      .then(() => {
        logger.log(`>> Melhor Envio conectado com sucesso #${storeId}`)
        res.send('Integração com Melhor Envio concluída, você já pode fechar esta janela.')
      })

      .catch(err => {
        logger.error('MelhorEnvioOauthErr', err.response ? err.response.data : err)
        res.status(500).send('Erro ao concluir autorização com Melhor Envio')
      })
  }
}
