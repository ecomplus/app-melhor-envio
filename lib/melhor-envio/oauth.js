'use strict'

// Melhor Envio OAuth helpers
// https://docs.melhorenvio.com.br/reference/aplicativo-autenticacao

const crypto = require('crypto')
const axios = require('axios')

const CLIENT_ID = process.env.ME_CLIENT_ID
const CLIENT_SECRET = process.env.ME_CLIENT_SECRET
const REDIRECT_URI = process.env.ME_REDIRECT_URI
const SCOPE = process.env.ME_SCOPE
const SANDBOX = process.env.ME_SANDBOX === 'true'
// required by Melhor Envio on every request: "Aplicação (email para contato técnico)"
const USER_AGENT = process.env.ME_USER_AGENT || 'E-Com Plus (https://e-com.plus)'

const baseUrl = SANDBOX
  ? 'https://sandbox.melhorenvio.com.br'
  : 'https://melhorenvio.com.br'

// OAuth state is only issued to a validated store admin (see routes/melhor-envio/authorize.js)
// it carries storeId and expiration, signed to not be forged or reused later
const STATE_TTL = 15 * 60 * 1000

const hmac = payload => crypto
  .createHmac('sha256', String(CLIENT_SECRET))
  .update(payload)
  .digest('hex')
  .slice(0, 32)

const signState = storeId => {
  const payload = `${storeId}.${Date.now() + STATE_TTL}`
  return `${payload}.${hmac(payload)}`
}

const verifyState = state => {
  const [storeId, expiresAt, signature] = String(state).split('.')
  const expected = hmac(`${storeId}.${expiresAt}`)
  if (
    signature && signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) &&
    parseInt(expiresAt, 10) > Date.now()
  ) {
    return parseInt(storeId, 10) || null
  }
  return null
}

// check request credentials belong to an admin of the store
// https://developers.e-com.plus/docs/api/#/store/authentications/
const isStoreAdmin = (storeId, myId, accessToken) => {
  if (!storeId || !myId || !accessToken) {
    return Promise.resolve(false)
  }
  return axios.get('https://api.e-com.plus/v1/authentications/me.json', {
    headers: {
      'X-Store-ID': storeId,
      'X-My-ID': myId,
      'X-Access-Token': accessToken
    }
  })
    .then(({ data }) => Boolean(data && data.store_id === storeId))
    .catch(err => {
      if (err.response && err.response.status < 500) {
        return false
      }
      throw err
    })
}

const authorizeUrl = storeId => `${baseUrl}/oauth/authorize?` + new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPE,
  state: signState(storeId)
})

// token expiration from JWT payload (access_token is valid for 30 days)
const getTokenExpiration = accessToken => {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString())
    return payload.exp ? new Date(payload.exp * 1000) : null
  } catch (e) {
    return null
  }
}

const requestToken = body => axios.post(`${baseUrl}/oauth/token`, {
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  ...body
}, {
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT
  }
}).then(({ data }) => data)

const exchangeCode = code => requestToken({
  grant_type: 'authorization_code',
  redirect_uri: REDIRECT_URI,
  code
})

const refreshToken = refreshToken => requestToken({
  grant_type: 'refresh_token',
  refresh_token: refreshToken
})

module.exports = {
  SANDBOX,
  USER_AGENT,
  signState,
  verifyState,
  isStoreAdmin,
  authorizeUrl,
  getTokenExpiration,
  exchangeCode,
  refreshToken
}
