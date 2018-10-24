'use strict'

require('dotenv').config()

const env = process.env
let sandbox = (env.ME_SANDBOX === 'true')

module.exports = {
  ME_CLIENT_ID: env.ME_CLIENT_ID,
  ME_CLIENT_SECRET: env.ME_CLIENT_SECRET,
  ME_SANDBOX: sandbox,
  ME_REDIRECT_URI: env.ME_REDIRECT_URI,
  ME_SCOPE: env.ME_SCOPE,
  TABLE_NAME: env.TABLE_NAME,
  BD_PATH: env.BD_PATH
}
