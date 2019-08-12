'use strict'
const sqlite = require('sqlite3').verbose()
const db = new sqlite.Database(process.env.ECOM_AUTH_DB)
const logger = require('console-files')
const me = require('melhor-envio').config({
  client_id: process.env.ME_CLIENT_ID,
  client_secret: process.env.ME_CLIENT_SECRET,
  sandbox: (process.env.ME_SANDBOX === 'true'),
  redirect_uri: process.env.ME_REDIRECT_URI,
  request_scope: `cart-read cart-write companies-read coupons-read notifications-read products-read products-write purchases-read shipping-calculate shipping-cancel shipping-checkout shipping-companies shipping-generate shipping-preview shipping-print shipping-share shipping-tracking ecommerce-shipping transactions-read users-read webhooks-read webhooks-write`
})

const { updateAppConfig } = require('./../lib/Api/Api')

module.exports = () => {
  logger.log('--> Start running melhor envio update tokens')
  const task = () => {
    let query = `SELECT refresh_token, access_token, store_id FROM melhorenvio_app_auth WHERE updated_at < datetime("now", "-24 hours") OR updated_at IS NULL`
    db.each(query, async (err, row) => {
      if (!err && row) {
        await me.auth.refreshToken(row.refresh_token)

          .then(async result => {
            let accessToken = result.access_token
            let refreshToken = result.refresh_token
            let storeId = row.store_id

            return updateAppConfig(accessToken, refreshToken, storeId)
          })

          .catch(error => {
            logger.error('MELHOR_ENVIO_UPDATE_TOKENS_ERR', error.message)
          })
      }
    })
  }

  // run
  task()
  let interval = 30 * 60 * 1000
  setInterval(task, interval)
}
