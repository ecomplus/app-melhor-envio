'use strict'
require('dotenv').config()
const config = require('../config')
const me = require('melhor-envio').config(config.ME_API_CONFIG)
const { ecomAuth } = require('ecomplus-app-sdk')
const { logger } = require('console-files')
const sql = require('./sql')
const { getMelhorEnvioAuth } = require('./melhor-envio')

/**
 * Handle ecomplus callback
 */
module.exports.ecomplus = async (request, response) => {
  logger.log(JSON.stringify(request.body))
  ecomAuth.then(sdk => {
    let storeId = parseInt(request.headers['x-store-id'], 10)
    let body = request.body
    sdk.handleCallback(storeId, body).then(() => {
      // just respond first
      response.status(204)
      return response.end()
    })
      .catch(err => {
        if (typeof err.code === 'string' && !err.code.startsWith('SQLITE_CONSTRAINT')) {
          // debug SQLite errors
          logger.error(err)
        }
        response.status(500)
        return response.send({ erro: 'melhorenvio_callback_erro', message: err.message })
      })
  })
    .catch(e => console.log('Erro', e))
}
/**
 * Handle melhorenvio callback
 */
module.exports.melhorEnvio = async (request, response) => {
  let { code, state } = request.query
  let storeId = state

  let melhorEnvio = await me.auth.getToken(code)

  if (melhorEnvio) {
    let params = {
      access_token: melhorEnvio.access_token,
      refresh_token: melhorEnvio.refresh_token,
      store_id: storeId
    }

    const successResponse = () => {
      response.status(200)
      response.write('<script>window.close()</script>')
      return response.end()
    }

    const erroResponse = (e) => {
      let msg = 'Erro ao setar tokens para melhorenvio.\n'
      logger.error(msg + e)
      response.status(400)
      return response.send(msg)
    }

    let melhorEnvioAuth = await getMelhorEnvioAuth(storeId)

    //
    if (!melhorEnvioAuth) {
      sql.insert(params, 'melhorenvio_app_auth')
        .then(() => {
          // registra procedure
          ecomAuth.then(async sdk => {
            let auth = await sdk.getAuth(storeId)
            let params = {
              title: 'Melhor Envio Shipment Update',
              short_description: 'After received order, update melhor envio cart.',
              triggers: [
                {
                  resource: 'orders'
                }
              ],
              webhooks: [
                {
                  api: {
                    external_api: {
                      uri: 'https://melhorenvio.ecomplus.biz/notifications'
                    }
                  },
                  method: 'POST',
                  send_body: true
                }
              ],
              tag: 'melhor_envio_orders'
            }
            sdk.apiRequest(storeId, '/procedures.json', 'POST', params, auth)
          })
        })
        .catch(e => console.log(e))
      // set algumas informações
      // default do usuário no db
      let melhorEnvioAuth = await getMelhorEnvioAuth(storeId)
      //
      setMelhorEnvioFrom(melhorEnvioAuth)
    } else {
      sql.update(params, { store_id: storeId }, 'melhorenvio_app_auth')
        .then(() => successResponse())
        .catch(e => erroResponse(e))
    }
  }
}
/**
 * Redireciona para oauth
 */
module.exports.requestCallback = async (request, response) => {
  let to = me.auth.getAuth() + '&state=' + request.query.x_store_id
  response.redirect(301, to)
}

const setMelhorEnvioFrom = async melhorEnvioAuth => {
  me.setToken = melhorEnvioAuth.access_token
  let seller = await me.user.me()
  if (seller) {
    seller = JSON.parse(seller)
    let defaults = {
      'name': seller.firstname + ' ' + seller.lastname,
      'phone': seller.phone.phone,
      'email': seller.email,
      'document': seller.document,
      'address': seller.address.address,
      'complement': seller.address.complement,
      'number': seller.address.number,
      'district': seller.address.district,
      'city': seller.address.city.city,
      'state_abbr': seller.address.city.state.state_abbr,
      'country_id': seller.address.city.state.country.id,
      'postal_code': seller.address.postal_code
    }
    return sql.update({ default_data: JSON.stringify(defaults) }, { store_id: melhorEnvioAuth.store_id }, 'melhorenvio_app_auth')
  }
}
