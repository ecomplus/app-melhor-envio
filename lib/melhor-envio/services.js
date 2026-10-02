'use strict'

const meClient = require('./client')

// Melhor Envio quotes only a default service for OAuth app tokens when `services` is not set,
// while personal (panel) tokens quote all services, so app tokens must request them explicitly

// personal tokens generated on Melhor Envio panel are issued for client 1
const isAppToken = token => {
  try {
    const { aud } = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
    return Boolean(aud) && String(aud) !== '1'
  } catch (e) {
    return false
  }
}

const CACHE_TTL = 12 * 60 * 60 * 1000
const cache = {}

// comma separated ids of all services from all shipping companies
const getAllServices = (token, sandbox) => {
  const env = sandbox ? 'sandbox' : 'production'
  if (cache[env] && cache[env].expiresAt > Date.now()) {
    return Promise.resolve(cache[env].services)
  }
  return meClient({
    url: '/shipment/companies',
    method: 'get',
    token,
    sandbox
  }).then(({ data }) => {
    const services = data
      .reduce((ids, company) => ids.concat((company.services || []).map(({ id }) => id)), [])
      .join(',')
    if (services) {
      cache[env] = { services, expiresAt: Date.now() + CACHE_TTL }
    }
    return services
  })
}

module.exports = {
  isAppToken,
  getAllServices
}
