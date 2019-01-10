'use strict'

require('dotenv').config()

const env = process.env
let sandbox = (env.ME_SANDBOX === 'true')

module.exports = {
  ME_CLIENT_ID: env.ME_CLIENT_ID,
  ME_CLIENT_SECRET: env.ME_CLIENT_SECRET,
  ME_SANDBOX: sandbox,
  ME_REDIRECT_URI: env.ME_REDIRECT_URI,
  ME_SCOPE: 'cart-read cart-write companies-read coupons-read notifications-read products-read products-write purchases-read shipping-calculate shipping-cancel shipping-checkout shipping-companies shipping-generate shipping-preview shipping-print shipping-share shipping-tracking ecommerce-shipping transactions-read users-read webhooks-read webhooks-write',
  TABLE_NAME: env.TABLE_NAME,
  BD_PATH: env.ECOM_AUTH_DB,
  ME_API_CONFIG: {
    client_id: env.ME_CLIENT_ID,
    client_secret: env.ME_CLIENT_SECRET,
    sandbox: sandbox,
    redirect_uri: env.ME_REDIRECT_URI,
    request_scope: 'cart-read cart-write companies-read coupons-read notifications-read products-read products-write purchases-read shipping-calculate shipping-cancel shipping-checkout shipping-companies shipping-generate shipping-preview shipping-print shipping-share shipping-tracking ecommerce-shipping transactions-read users-read webhooks-read webhooks-write'
  }
}
