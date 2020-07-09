'use strict'
const logger = require('console-files')
// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'

//
const orderIsValid = require('../../lib/melhor-envio/order-is-valid')
const newLabel = require('../../lib/melhor-envio/new-label')
const { saveLabel } = require('../../lib/database')
const meClient = require('../../lib/melhor-envio/client')

module.exports = appSdk => {
  return (req, res) => {
    /*
    Treat E-Com Plus trigger body here
    // https://developers.e-com.plus/docs/api/#/store/triggers/
    const trigger = req.body
    */
    const { storeId } = req
    const resourceId = req.body.resource_id || req.body.inserted_id

    // get app configured options
    return getConfig({ appSdk, storeId }, true)

      .then(async configObj => {
        /* Do the stuff */
        const token = configObj.access_token
        const sandbox = configObj.sandbox
        if (!token) {
          return res.send(ECHO_SKIP)
        }

        let resource = `orders/${resourceId}`
        let method = 'GET'

        return appSdk
          .apiRequest(storeId, resource, method)
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

            return meClient({
              url: '/cart',
              method: 'post',
              token,
              sandbox,
              data: label
            })
              .then(({ data }) => {
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
                return saveLabel(data.id, data.status, resourceId, storeId).then(() => data)
              })

              .then(data => {
                logger.log('--> Label purchased for order:', order._id)
                // updates hidden_metafields with the generated tag id
                const resource = `orders/${resourceId}/hidden_metafields.json`
                const method = 'POST'
                const params = {
                  field: 'melhor_envio_label_id',
                  value: data.id
                }
                return appSdk.apiRequest(storeId, resource, method, params)
              })

              .then(() => {
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
          //errorHandling(err)
          // treat error
          const { response } = err
          if (response && err.isAxiosError) {
            const payload = {
              status: response.status,
              data: response.data,
              config: response.config
            }

            const dataStringfy = JSON.stringify(response.data)
            logger.error('BuyLabelErr: ', JSON.stringify(payload, undefined, 4))

            // update order hidden_metafields
            const url = `orders/${resourceId}/hidden_metafields.json`
            const metafields = {
              namespace: 'app-melhor-envio',
              field: 'Compra de etiqueta | Erro',
              value: dataStringfy.substring(0, 255)
            }

            appSdk.apiRequest(storeId, url, 'post', metafields)
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
