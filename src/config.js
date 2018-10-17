'use strict'

require('dotenv').config()

const env = process.env

module.exports = {
  ME_CLIENT_ID: env.ME_CLIENT_ID,
  ME_CLIENT_SECRET: env.ME_CLIENT_SECRET,
  ME_SANDBOX: env.ME_SANDBOX,
  ME_REDIRECT_URI: env.ME_REDIRECT_URI,
  ME_SCOPE: env.ME_SCOPE,
  TABLE_NAME: env.TABLE_NAME,
  BD_PATH: env.BD_PATH
}
