'use strict'
const config = require('./../config')
const logger = require('console-files')
const MelhorEnvioSdk = require('melhor-envio')
const ecomplus = require('./ecomplus')
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
  logger.log(JSON.stringify(payload))
  //
  if (!payload) {
    response.status(400)
    response.send({ erro: 'body empty' })
  }
  //
  const appInfor = await getAppData(request.headers['x-store-id']).catch(e => logger.error(e))
  //
  if (!appInfor) {
    response.status(400)
    response.send('Não existe aplicativo vinculado ao X-Store-Id informado.')
  }
  //
  let schema = schemas.calculateRequest(payload, appInfor)
  //
  if (schema) {
    //
    me.setToken = appInfor.me_access_token
    me.shipment.calculate(schema)
      .then(calculate => {
        // console.log(calculate)
        if (calculate) {
          let erros = calculate.find(calc => calc.error)
          if (erros) {
            logger.log('Erro ao realizar o calculo do frete.\nErros: ' + JSON.stringify(calculate, 'undefined', 4))
          }
        }
        let obj = {}
        obj.shipping_services = schemas.calculateResponse(calculate, schema.from, schema.to, payload)
        // free_shipping
        let freeShippingFromValue = isFreeShipping(payload)
        if (freeShippingFromValue) {
          obj.free_shipping_from_value = freeShippingFromValue
        }
        // sort
        if (payload.application.hasOwnProperty('data') && payload.application.data.hasOwnProperty('sort')) {
          obj.shipping_services.sort(sortBy(payload.application.data.sort.by))
        }
        response.status(200)
        response.send(obj)
      })
      .catch(erro => {
        console.log(erro)
        logger.error('O cálculo de frete falhou devido ao erro: \n\t- ' + erro)
        response.status(400)
        response.send('' + erro)
      })
  } else {
    response.status(200)
    response.send(schemas.calculateDefault(payload))
  }
}

const isFreeShipping = payload => {
  let is = ''
  if (payload.application.hasOwnProperty('hidden_data') && payload.application.hidden_data.hasOwnProperty('shipping_discount')) {
    payload.application.hidden_data.shipping_discount.every(discount => {
      if (discount.hasOwnProperty('minimum_subtotal') && payload.params.subtotal >= discount.minimum_subtotal) {
        discount.states.some(state => {
          if (parseInt(payload.params.to.zip.replace('-', '')) <= parseInt(state.from.replace('-', '')) &&
            parseInt(state.to.replace('-', '')) >= parseInt(payload.params.to.zip.replace('-', ''))) {
            console.log(discount.minimum_subtotal)
            is = discount.minimum_subtotal
          }
        })
      }
    })
  }
  return is
}

const sortBy = sortOrder => {
  switch (sortOrder) {
    case 'price':
      return function (a, b) {
        return a.shipping_line.total_price < b.shipping_line.total_price
      }
    case '-price':
      return function (a, b) {
        return a.shipping_line.total_price > b.shipping_line.total_price
      }
    case 'delivery':
      return function (a, b) {
        return a.shipping_line.delivery_time.days < b.shipping_line.delivery_time.days
      }
    case '-delivery':
      return function (a, b) {
        return a.shipping_line.delivery_time.days > b.shipping_line.delivery_time.days
      }
    default: break
  }
}

const resolveLabel = async (request, response) => {
  const ecomplus = require('./ecomplus')
  // storeId, appData
  let storeId = request.headers['x-store-id']
  //
  let app = await getAppData(storeId).catch(e => logger.error(e))
  //
  let resourceId = request.body.resource_id || request.body.inserted_id
  //
  let order = await ecomplus.getOrder(resourceId, app).catch(e => logger.error(e))
  //
  if (order) {
    //
    order = JSON.parse(order)
    // se a order já tiver etiqueta gerada
    // ignora e deixa o script task
    // verificar periodicamente a label
    // e atualizar na api
    if (ecomplus.orderHasLabel(order)) {
      response.status(200)
      response.write('Etiqueta já foi gerada para order')
      return response.end()
    }
    // seta token melhor envio
    me.setToken = app.me_access_token
    // busca informações do vendedor
    let seller = await me.user.me().catch(e => {
      logger.error('Erro ao solicitar conta ao melhor envio.')
    })
    //
    let appData = await ecomplus.getResource('applications', app.application_id, 'GET', { 'Content-Type': 'application/json', 'X-Store-ID': storeId })
      .catch(e => {
        console.log(e)
      })
    //
    if (!order) {
      response.status(400)
      response.send({ erro: 'Pedido não encontrado para o id informado.' })
    }
    // parse do schema
    // carrinho do melhor envio
    console.log(appData)
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
  } else {
    response.status(404)
    response.send('Order não encontrada : ' + resourceId)
    logger.log('Order não encontrada : ' + resourceId)
    return response.end()
  }
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
          logger.log('Erro ao atualizar metafield da order ' + resourceId + ' com id da etiqueta gerada (' + label + ') no melhor envio')
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

const setAppToken = async (request, response) => {
  let token = request.query.code
  let storeId = request.query.state

  let app = await getAppData(storeId)
  me.setToken = app.me_access_token
  return me.auth.getToken(token)
    .then(ret => {
      let update = { me_refresh_token: ret.refresh_token, me_access_token: ret.access_token }
      let where = { store_id: storeId }
      sql.update(update, where, 'app_auth')
        .then(() => {
          const ecomplus = require('./ecomplus')
          ecomplus.registerProcedure(app).catch(e => logger.error(e))
        })
        .catch(erro => {
          logger.log('Erro ao salvar melhor envio access_token no banco | Erro #410 - ' + erro)
        })
      //
      setDefaultFrom(app)
      //
      response.write('<script>window.close()</script>')
      response.end()
    })
}

const updateTokens = () => {
  let query = 'SELECT me_refresh_token, me_access_token, store_id FROM app_auth'
  sql.each(query, (err, row) => {
    if (!err) {
      try {
        me.setToken = row.me_access_token
        me.auth.refreshToken(row.me_refresh_token)
          .then(resp => {
            if (resp) {
              let data = {
                me_access_token: resp.access_token,
                me_refresh_token: resp.refresh_token
              }
              let where = { store_id: row.store_id }
              sql.update(data, where, 'app_auth').catch(e => logger.log(new Error('Erro with melhor envio refresh token')))
            }
          })
      } catch (error) {
        logger.error(new Error('Erro with auth request.', error))
      }
    }
  })
}

const updateLabelStatus = async () => {
  let query = 'SELECT * FROM `me_tracking` WHERE status = ? OR status = ? OR status = ? OR status = ? ORDER BY store_id'
  sql.db.all(query, ['pending', 'released', 'delivered', 'undelivered'], function (erro, row) {
    if (erro) {
      return
    }
    let storeId
    let app
    row.forEach(async (label, index) => {
      setTimeout(async () => {
        // guardo o x_store_id
        if (storeId !== label.store_id) {
          app = await getAppData(label.store_id)
        }
        //
        let meLabel = await getLabel(label.label_id, app).catch(e => console.log(e))
        //
        let order = await ecomplus.getOrder(label.resource_id, app).catch(e => console.log(e))
        //
        ecomplus.orderHasSameStatus(order, meLabel, app)
        //
        storeId = label.store_id
      }, 1000 * index)
    })
  })
}

const setDefaultFrom = async (app) => {
  me.setToken = app.me_access_token
  let data = await me.user.me()
  if (data) {
    data = JSON.parse(data)
    let defaults = {
      postal_code: data.address.postal_code,
      address: data.address.address,
      number: data.address.number
    }
    let update = { me_default_set: JSON.stringify(defaults) }
    let where = { store_id: app.store_id }
    sql.update(update, where, 'app_auth').catch(erro => {
      logger.log('Erro ao salvar opções default no bd.' + erro)
    })
  }
}

module.exports = {
  oauthRedirect,
  calculate,
  resolveLabel,
  getAppData,
  getLabel,
  setAppToken,
  updateTokens,
  updateLabelStatus
}
