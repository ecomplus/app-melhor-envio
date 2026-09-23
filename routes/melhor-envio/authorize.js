'use strict'

const logger = require('console-files')
const { isStoreAdmin, authorizeUrl } = require('../../lib/melhor-envio/oauth')

// starts Melhor Envio OAuth flow for a store admin
// https://docs.melhorenvio.com.br/reference/aplicativo-autenticacao
// requested by E-Com Plus admin with session credentials on headers (never on URL),
// responds with Melhor Envio authorization URL to be opened by the merchant

const ALLOWED_ORIGINS = [
  'https://admin.e-com.plus',
  'https://app.e-com.plus'
]

const setCors = (req, res) => {
  const origin = req.get('origin')
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Vary', 'Origin')
    res.set('Access-Control-Allow-Methods', 'POST')
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Store-ID, X-My-ID, X-Access-Token')
  }
}

module.exports = () => {
  return (req, res) => {
    setCors(req, res)
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204)
    }

    const storeId = parseInt(req.get('x-store-id'), 10)
    const myId = req.get('x-my-id')
    const accessToken = req.get('x-access-token')

    isStoreAdmin(storeId, myId, accessToken)
      .then(isAdmin => {
        if (!isAdmin) {
          return res.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid store admin credentials' })
        }
        res.send({ url: authorizeUrl(storeId) })
      })
      .catch(err => {
        logger.error('MelhorEnvioAuthorizeErr', err.message)
        res.status(502).send({ error: 'STORE_API_ERR', message: 'Could not validate credentials, try again' })
      })
  }
}
