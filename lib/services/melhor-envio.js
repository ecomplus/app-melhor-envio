const me = require('melhor-envio').config(require('../config').ME_API_CONFIG)
const { ecomAuth } = require('ecomplus-app-sdk')
const MelhorEnvioSdk = require('melhor-envio')
const logger = require('console-files')

const sql = require('./sql')
const { calculateRequest } = require('./schemas/calculate-request')
const { calculateResponse, isFreeShipping, sortBy } = require('./schemas/calculate-response')
const { generateLabel, saveLabel } = require('./schemas/generate-label')

/**
 * @description Retorna configuração do melhor envio salva no banco.
 * @param {Number} storeId User X-Store-Id
 */
const getMelhorEnvioAuth = async storeId => {
  return new Promise((resolve, reject) => {
    if (!storeId) {
      reject(new Error('X-Store-Id not sent.'))
    }

    sql.select({ store_id: storeId }, 'melhorenvio_app_auth').then(resolve).catch(reject)
  })
}

/**
 * @description Recebe body do módulo e realiza cálculo de frete
 * @param {Object} request request interface
 * @param {Object} response response interface
 * @returns {Array} Array de serviços de frete disponíveis
 */
const calculate = async (request, response) => {
  const { application, params } = request.body
  let storeId = request.headers['x-store-id']

  let melhorEnvioAuth = await getMelhorEnvioAuth(storeId)

  let schema = calculateRequest(application, params, melhorEnvioAuth.default_data)

  // se houver parse do schema
  // realizo o cálculo
  if (schema) {
    // seto access token no sdk
    // do melhor envio para as
    // próximas requisições
    me.setToken = melhorEnvioAuth.access_token
    // realizo o calculo
    me.shipment.calculate(schema)
      .then(services => {
        // Mesmo com resposta de sucesso
        // pode haver erros na requisição
        // para algum serviço específico
        if (services) {
          let err = services.find(ship => ship.error)
          // se houver
          if (err) {
            let erros = {
              code: 'calculate_shipping',
              message: 'Erro ao realizar o calculo do frete.',
              erro: err
            }
            // salvo log informado qual
            // serviço não pode ser calculado
            // e porque
            logger.error(new Error(JSON.stringify(erros)))
          }
        }
        // respondo 200 pois o calculo
        // foi realizado, mesmo contendo
        // erros na resposta
        response.status(200)

        // preparo objeto
        // para resposta do módulo
        let objResponse = {}

        // shipping_services
        objResponse.shipping_services = calculateResponse(services, application, params, schema.from)

        // free_shipping_from_value
        if (!(objResponse.free_shipping_from_value = isFreeShipping(application, params))) {
          delete objResponse.free_shipping_from_value
        }

        // orderna os serviços
        // se caso for configurado
        // sort no data do applicativo
        if (application.hasOwnProperty('data') && application.data.hasOwnProperty('sort')) {
          objResponse.shipping_services.sort(sortBy(application.data.sort.by))
        }
        // respondo com o objeto
        response.send(objResponse)
      })
  } else {
    // se não houver parse do schema
    // respondo com default
    // shipping_services vazio
    let responseDefault = {
      shipping_services: []
    }

    // free_shipping_from_value
    // se o desconto for aplicável
    // para faixa de cep informada
    // na requisição envia tambem
    if (!(responseDefault.free_shipping_from_value = isFreeShipping(application, params))) {
      delete responseDefault.free_shipping_from_value
    }

    // end
    response.status(200)
    return response.send(responseDefault)
  }
}

/**
 * @description Trata requisições de webhooks e verifica se alguma order está pronta para gerar etiqueta de envio.
 * @param {Object} request request interface
 * @param {Object} response response interface
 * @returns statusCode
 */
const notifications = async (request, response) => {
  const storeId = request.headers['x-store-id']
  const sdk = await ecomAuth.then()
  const appAuth = await sdk.getAuth(storeId)
  let resourceId = request.body.resource_id || request.body.inserted_id

  let order = await sdk.apiRequest(storeId, 'orders/' + resourceId, 'GET', null, appAuth).catch(e => console.log(e))

  const errors = (e, code) => {
    let err = {
      code: code,
      erro: e
    }
    logger.error(err)
    response.status(400)
    response.end()
  }

  const end = () => {
    response.status(204)
    response.end()
  }

  // existe order?
  if (order.response) {
    let { data } = order.response
    // verifica se pode gerar
    // etiqueta para a order
    if (labelCanBeGenerated(data)) {
      // se for possível
      // busco access_token
      // e seto na instancia
      // do sdk
      let melhorEnvioAuth = await getMelhorEnvioAuth(storeId)
      const me = new MelhorEnvioSdk({
        bearer: melhorEnvioAuth.access_token,
        sandbox: (process.env.ME_SANDBOX === 'true')
      })

      // informações do vendedor
      // ou comprador da etiqueta
      let seller = await me.user.me()

      // busco body publico do aplicativo
      let publicBody = await sdk.appPublicBody(storeId)

      // realizo parse da order
      // para schema do melhor envio
      let schema = generateLabel(data, seller, publicBody.response.data.data)

      // incluo a etiqueta no carrinho
      // do melhor envio
      me.user.cart(schema)
        .then(label => {
          // se a etiqueta
          // for gerada e incluida no
          // carrinho. Processo o pagamento.
          me.shipment.checkout()
            .then(() => {
              // pagamento da etiqueta realizado
              // salva a etiqueta no banco
              // para tracking e atualização
              // de status na order
              saveLabel(label, storeId, resourceId)
                .then(() => {
                  // etiqueta salva,
                  // atualizo hidden_metalfield
                  // da order
                  let params = {
                    field: 'melhor_envio_label_id',
                    value: label.id
                  }
                  sdk.apiRequest(storeId, 'orders/' + resourceId + '/hidden_metafields.json', 'POST', params, appAuth)
                    .then(() => end())
                    .catch(e => errors(e, 'update_order_metafields'))
                })
                .catch(e => errors(e, 'save_label_in_db'))
            })
            .catch(e => errors(e, 'save_label_in_db'))
        })
        .catch(e => errors(e, 'generate_label_cart'))
    } else {
      // se não for possível
      // response com 204
      end()
    }
  }
}

/**
 * @description Verifica qual serviço foi utilizado para compra de fretes da order. Se for o melhor envio, verifica se a order esta pronta para envio e realiza compra da etiqueta.
 * @param {Object} order Ecomplus Order
 * @return {Boolean}
 */
const labelCanBeGenerated = (order) => {
  if (order.hasOwnProperty('fulfillment_status') && order.fulfillment_status.hasOwnProperty('current')) {
    switch (order.fulfillment_status.current) {
      // quando a order está com
      // o status ready_for_shipping
      // está pronta pra gerar a etiqueta
      case 'ready_for_shipping':
        // verifica se o serviço
        // de envio começa com ME
        let shippingService = order.shipping_lines.find(shipping => shipping.hasOwnProperty('app') && shipping.app.service_code.startsWith('ME'))
        // se for o melhor envio
        if (shippingService) {
          // verifica se a order tem
          // as propriedades invoice
          if (shippingService.hasOwnProperty('invoices') && shippingService.invoices[0].hasOwnProperty('issuer') && shippingService.invoices[0].issuer.hasOwnProperty('doc_number')) {
            // se houver
            // os documentos fiscais da order
            // foram emitidos
            if (order.hasOwnProperty('hidden_metafields')) {
              // então verifico se já existe
              // hidden_metafields
              let label = order.hidden_metafields.find(hidden => hidden.field === 'melhor_envio_label_id')
              // se houver e for
              // houver etiqueta já comprada
              // retorna falso
              return !(label)
            }
            // se não houver etiqueta gerada
            return true
          }
        }
        break
      // se houver outro status diferente de ready_for_shipping
      // a rotina do app atualizará o status do etiqueta na order
      case 'invoice_issued':
      case 'in_production':
      case 'in_separation':
      case 'partially_shippend':
      case 'shipped':
      case 'partially_delivered':
      case 'returned_for_exchange':
      case 'received_for_exchange':
      case 'returned':
        return false
      default: break
    }
  }
  // order não tem propriedades obrigatórias
  // não está pronta para gerar a etiqueta
  return false
}

/**
 * @description Verifica status das etiquetas no melhor envio e atualiza na ecp api
 */
const verifyLabelStatus = async () => {
  let query = 'SELECT * FROM `melhorenvio_app_tracking` WHERE status = ? OR status = ? OR status = ? OR status = ? ORDER BY store_id'

  sql.db.all(query, ['pending', 'released', 'delivered', 'undelivered'], async function (erro, row) {
    // flopou
    if (erro) {
      return
    }

    const sdk = await ecomAuth.then()
    let lastStoreId
    let auth
    let melhorEnvioAuth

    const erros = (erro, code) => {
      let err = {
        code: code,
        erro: erro
      }
      logger.error(JSON.stringify(err))
    }

    row.forEach(async (label, index) => {
      // seto intervalor entre as requisição
      // para evitar timeout nas apis
      setTimeout(async () => {
        // verifico se a ultima X-Store-Id
        // é diferente da atual
        if (lastStoreId !== label.store_id) {
          // se for busco autenticações
          // referente ao X-Store-Id atual
          auth = await sdk.getAuth(label.store_id)
          melhorEnvioAuth = await getMelhorEnvioAuth(label.store_id)
          me.setToken = melhorEnvioAuth.access_token
        }

        // busco a etiqueta de envio no melhor envio
        let melhorEnvioLabel = await me.shipment.tracking({ orders: [label.label_id] }).catch(e => erros(e, 'melhorenvio_tracking_request'))

        // busco a order na ecp
        let apiRequest = await sdk.apiRequest(label.store_id, 'orders/' + label.resource_id, 'GET', null, auth).catch(e => erros(e, 'ecomplus_api_request'))
        let order = apiRequest.response.data

        // procuro a etiqueta no hidden_metafiel
        // que bata com a etiqueta que busquei no melhor envio
        let orderLabel = order.hidden_metafields.find(hidden => hidden.field === 'melhor_envio_label_id' && melhorEnvioLabel.hasOwnProperty(hidden.value))
        // comparo o status da etiqueta
        // com o shipping_lines.status da order

        let updateTo

        switch (melhorEnvioLabel[orderLabel.value].status) {
          case 'posted':
            if (order.shipping_lines[0].status.current !== 'shipped') {
              updateTo = 'shipped'
            }
            break
          case 'delivered':
            if (order.shipping_lines[0].status.current !== 'delivered') {
              updateTo = 'delivered'
            }
            break
          case 'undelivered':
            if (order.shipping_lines[0].status.current !== 'returned') {
              updateTo = 'undelivered'
            }
            break
          default:
            break
        }
        console.log(updateTo)
        // se houver status para atualizar
        if (updateTo) {
          // atualizo o status na ecp
          let body = {
            shipping_line_id: order.shipping_lines[0]._id,
            date_time: new Date().toISOString(),
            status: updateTo,
            notification_code: melhorEnvioLabel[orderLabel.value].tracking
          }
          sdk.apiRequest(label.store_id, 'orders/' + label.resource_id + '/fulfillments.json', 'POST', body, auth)
            .then(resp => {
              // então atualizo status no db
              let data = {
                updated_at: body.date_time,
                status: melhorEnvioLabel[orderLabel.value].status
              }
              let where = { label_id: label.label_id, resource_id: label.resource_id, store_id: label.store_id }
              sql.update(data, where, 'melhorenvio_app_tracking')
                .catch(e => erros(e, 'melhorenvio_app_tracking_update'))
            })
            .catch(e => erros(e, 'ecomplus_api_request'))
        } else {
          // Não tem? então glow.
          return
        }
        // seto lastStoreId com o store_id atual
        // para evitar solicitação dos mesmo
        // dados de autenticação a cada loop
        lastStoreId = label.store_id
      }, 1000 * index)
    })
  })
}

/**
 * @description Atualiza tokens do melhor envio
 */
const updateTokenMelhorEnvio = () => {
  let query = 'SELECT me_refresh_token, me_access_token, store_id FROM melhorenvio_app_auth'
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

module.exports = {
  getMelhorEnvioAuth,
  calculate,
  notifications,
  updateTokenMelhorEnvio,
  verifyLabelStatus
}
