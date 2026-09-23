'use strict'

const logger = require('console-files')
const { refreshToken, getTokenExpiration } = require('./oauth')
const { getAllAuths, saveAuth, deleteAuth } = require('./../database')

// access_token lasts 30 days and refresh_token 45 days
// renew tokens expiring in less than 10 days
const RENEW_BEFORE = 10 * 24 * 60 * 60 * 1000

module.exports = appSdk => {
  const refreshTokens = async () => {
    const auths = await getAllAuths()
    for (const auth of auths) {
      const { store_id: storeId } = auth
      const expiresAt = getTokenExpiration(auth.access_token)
      if (expiresAt && expiresAt.getTime() - Date.now() > RENEW_BEFORE) {
        continue
      }

      try {
        // only renew token still in use, merchant may have replaced it manually on app config
        const { response } = await appSdk.apiApp(storeId, null, 'GET', {})
        const currentToken = response.data.hidden_data && response.data.hidden_data.access_token
        if (currentToken !== auth.access_token) {
          await deleteAuth(storeId)
          continue
        }

        const data = await refreshToken(auth.refresh_token)
        const newExpiresAt = getTokenExpiration(data.access_token)
        await appSdk.apiApp(storeId, 'hidden_data', 'PATCH', {
          access_token: data.access_token,
          token_expires_at: newExpiresAt ? newExpiresAt.toISOString() : undefined
        })
        await saveAuth(storeId, data.access_token, data.refresh_token)
        logger.log(`>> Token Melhor Envio renovado #${storeId}`)
      } catch (err) {
        const { response } = err
        logger.error('RefreshTokenErr', storeId, response ? response.data : err)
        if (response && (response.status === 400 || response.status === 401)) {
          // refresh_token expired or revoked, merchant must authorize again
          await deleteAuth(storeId).catch(logger.error)
        }
      }
    }
  }

  const start = () => {
    refreshTokens().catch(logger.error).finally(() => {
      setTimeout(start, 12 * 60 * 60 * 1000)
    })
  }
  start()
}
