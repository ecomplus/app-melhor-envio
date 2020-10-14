'use strict'

const logger = require('console-files')

// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const errorHandling = require(process.cwd() + '/lib/store-api/error-handling')
const orderIsValid = require('../../lib/melhor-envio/order-is-valid')
const newLabel = require('../../lib/melhor-envio/new-label')
const { saveLabel } = require('../../lib/database')
const meClient = require('../../lib/melhor-envio/client')

const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'

module.exports = appSdk => {
  return (req, res) => {
    /*
    Treat E-Com Plus trigger body here
    // https://developers.e-com.plus/docs/api/#/store/triggers/
    const trigger = req.body
    */
    const { storeId } = req
    if (req.body.resource !== 'orders') {
      return res.send(ECHO_SKIP)
    }
    const resourceId = req.body.resource_id || req.body.inserted_id
    logger.log(`Webhook #${storeId} ${resourceId}`)

    // get app configured options
    return getConfig({ appSdk, storeId }, true)

      .then(async configObj => {
        /* Do the stuff */
        const token = configObj.access_token
        const sandbox = configObj.sandbox
        if (!token) {
          return res.send(ECHO_SKIP)
        }

        return appSdk
          .apiRequest(storeId, `/orders/${resourceId}.json`, 'GET')
          .then(async ({ response }) => {
            const order = response.data

            if (!configObj.enabled_label_purchase || !orderIsValid(order, configObj)) {
              return res.send(ECHO_SKIP)
            }

            const merchantData = await meClient({
              url: '/',
              method: 'get',
              token,
              sandbox
            }).then(({ data }) => data)

            const label = newLabel(order, configObj, merchantData)
            logger.log(`>> Comprando etiquetas #${storeId} ${order._id}`)
            return meClient({
              url: '/cart',
              method: 'post',
              token,
              sandbox,
              data: label
            })
              .then(({ data }) => {
                logger.log(`>> Etiqueta inserida no carrinho com sucesso #${data.id}`)
                return meClient({
                  url: '/shipment/checkout',
                  method: 'post',
                  token,
                  sandbox,
                  data: {
                    orders: [data.id]
                  }
                }).then(() => data)
              })

              .then(data => {
                logger.log(`>> Carrinho finalizado com sucesso #${data.id}`)
                return saveLabel(data.id, data.status, resourceId, storeId).then(() => data)
              })

              .then(data => {
                logger.log(`>> Etiquetas salvas no db para futuros rastreio #${storeId} ${resourceId}`)
                // updates hidden_metafields with the generated tag id
                return appSdk.apiRequest(
                  storeId,
                  `/orders/${resourceId}/hidden_metafields.json`,
                  'POST',
                  {
                    namespace: 'app-melhor-envio',
                    field: 'melhor_envio_label_id',
                    value: data.id
                  }
                ).then(() => data)
              })

              .then(data => {
                if (typeof data.tracking === 'string' && data.tracking.length) {
                  let shippingLine = order.shipping_lines
                    .find(({ app }) => app && app.service_code && app.service_code.startsWith('ME'))
                  if (!shippingLine) {
                    shippingLine = order.shipping_lines[0]
                  }
                  if (shippingLine) {
                    const trackingCodes = shippingLine.tracking_codes || []
                    trackingCodes.push({
                      code: data.tracking,
                      link: `https://www.melhorrastreio.com.br/rastreio/${data.tracking}`
                    })
                    return appSdk.apiRequest(
                      storeId,
                      `/orders/${resourceId}/shipping_lines/${shippingLine._id}.json`,
                      'PATCH',
                      { tracking_codes: trackingCodes }
                    )
                  }
                } else {
                  logger.log(data)
                }
                return null
              })

              .then(() => {
                logger.log(`>> 'hidden_metafields' do pedido ${order._id} atualizado com sucesso!`)
                // done
                res.send(ECHO_SUCCESS)
              })
          })
      })

      .catch(err => {
        if (err.name === SKIP_TRIGGER_NAME) {
          // trigger ignored by app configuration
          res.send(ECHO_SKIP)
        } else {
          // treat error
          if (err.response && err.isAxiosError) {
            const { data } = err.response

            if (data) {
              // update order hidden_metafields
              appSdk.apiRequest(storeId, `/orders/${resourceId}/hidden_metafields.json`, 'POST', {
                namespace: 'app-melhor-envio',
                field: 'melhor_envio_label_error',
                value: JSON.stringify(data).substring(0, 255)
              })
              if (
                data.error === 'Os documentos (CPFs) dos participantes do frete não podem ser iguais' ||
                data.error.startsWith('Seu saldo de R$ ')
              ) {
                // ignoring known ME/merchant errors
                return res.send(`ME: ${data.error}`)
              }
            }

            logger.error('BuyLabelErr:', JSON.stringify({
              storeId,
              data,
              status: err.response.status,
              config: err.response.config
            }, null, 4))
          } else {
            errorHandling(err)
          }

          // request to Store API with error response
          // return error status code
          res.status(500)
          let { message } = err
          res.send({
            error: ECHO_API_ERROR,
            message
          })
        }
      })
  }
}
