'use strict'
const config = require('./../config')
const logger = require('console-files')
const MelhorEnvioSdk = require('melhor-envio')
const sql = require('./sql')
const schemas = require('./schemas')

const meConfig = {
  client_id: config.ME_CLIENT_ID,
  client_secret: config.ME_CLIENT_SECRET,
  sandbox: config.ME_SANDBOX,
  redirect_uri: config.ME_REDIRECT_URI,
  request_scope: 'cart-read cart-write companies-read coupons-read notifications-read products-read products-write purchases-read shipping-calculate shipping-cancel shipping-checkout shipping-companies shipping-generate shipping-preview shipping-print shipping-share shipping-tracking ecommerce-shipping transactions-read users-read webhooks-read webhooks-write'
}

const me = new MelhorEnvioSdk(meConfig)

const oauthRedirect = (request, response) => {
  let to = me.auth.getAuth() + '&state=' + request.query.x_store_id
  response.redirect(301, to)
}

const calculate = async (request, response) => {
  //
  let payload = request.body
  //
  if (!payload) {
    response.status(400)
    response.send({ erro: 'body empty' })
  }
  //
  payload = request.body
  //
  let schema = schemas.calculateRequest(payload)
  //
  if (schema) {
    //
    const appInfor = await getAppData(request.headers['x-store-id']).catch(e => logger.error(e))
    //
    if (!appInfor) {
      response.status(400)
      response.send('Não existe aplicativo vinculado ao X-Store-Id informado.')
    }
    me.setToken = appInfor.me_access_token
    me.shipment.calculate(schema)
      .then(calculate => {
        let obj = {}
        obj.shipping_services = schemas.calculateResponse(calculate, schema.from, schema.to, payload)
        if (typeof payload.application.hidden_data !== 'undefined' && typeof payload.application.hidden_data.minimum_subtotal !== 'undefined') {
          obj.free_shipping_from_value = payload.application.hidden_data.minimum_subtotal
        }
        response.status(200)
        response.send(obj)
      })
      .catch(erro => {
        response.status(400)
        logger.error('O cálculo de frete falhou devido a um erro. \nErro: - ' + erro)
      })
  } else {
    response.status(200)
    response.send(schemas.calculateDefault(payload))
  }
}

const resolveLabel = async (request, response) => {
  const ecom = require('./ecomplus')
  // storeId, appData
  let storeId = request.headers['x-store-id']
  //
  let app = await getAppData(storeId)
  //
  let resourceId = request.body.resource_id || request.body.inserted_id
  //
  let order = await ecom.getOrder(resourceId, app)
  // se a order já tiver etiqueta gerada
  // ignora e deixa o script task
  // verificar periodicamente a label
  // e atualizar na api
  if (ecom.orderHasLabel(order)) {
    response.status(200)
    response.write('Etiqueta já foi gerada para order')
  }
  // seta token melhor envio
  me.setToken = app.me_access_token
  // busca informações do vendedor
  let seller = await me.user.me().catch(e => {
    logger.error('Erro ao solicitar da conta ao melhor envio.')
  })
  //
  let appData = await ecom.getResource('applications', app.application_id, 'GET', { 'Content-Type': 'application/json', 'X-Store-ID': storeId })
  //
  if (!order) {
    response.status(400)
    response.send({ erro: 'Pedido não encontrado para o id informado.' })
  }
  order = JSON.parse(order)
  // parse do schema
  // carrinho do melhor envio
  let schema = schemas.buyLabel(order, seller, appData)
  me.user.cart(schema)
    .then(label => {
      // sava etiqueta no bd
      saveLabel(label, storeId, order._id, app)
      // realiza checkout
      me.shipment.checkout()
        // ok
        .then(resp => {
          response.status(200)
          response.send(resp)
        })
        // flopou
        .catch(erro => {
          response.status(400)
          response.end()
          logger.error('Erro com o pagamento da etiqueta.\n' + erro)
        })
    })
    // flopou
    .catch(erro => {
      response.status(400)
      response.end()
      logger.error('Erro ao solicitar etiquetas.\n' + erro)
    })
}

const saveLabel = (label, storeId, resourceId, application) => {
  let params = {
    label_id: label.id,
    status: label.status,
    resource_id: resourceId,
    store_id: storeId
  }
  sql.insert(params, 'me_tracking')
    .then(resp => {
      const ecomplus = require('./ecomplus')
      let body = {
        field: 'melhor_envio_label_id',
        value: label.id
      }
      ecomplus.updateMetafields(body, resourceId, application)
        .catch(e => {
          logger.log(new Error('Erro ao atualizar metafield da order ' + resourceId + ' com id da etiqueta gerada (' + label + ') no melhor envio'))
        })
    })
}

const getLabel = (labelId, app) => {
  //
  let ids = {
    orders: [labelId]
  }
  //
  me.setToken = app.me_access_token
  //
  return me.shipment.tracking(ids)
}

const getAppData = async (storeId) => {
  try {
    return sql.select({ store_id: storeId }, 'app_auth')
  } catch (erro) {
    logger.log('Não existe aplicação instalada para X-Store-Id informada.\n' + erro)
  }
}

module.exports = {
  oauthRedirect,
  calculate,
  resolveLabel,
  getAppData,
  getLabel
}
