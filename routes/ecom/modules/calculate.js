'use strict'
// log on files
const logger = require('console-files')

// read configured internal app data
// like melhor-envio access_token, user from, etc.
const { getAppConfig } = require('./../../../lib/Api/Api')

// parse calculate body from modules API to melhor-envio model
const meSchema = require('./../../../lib/calculate-shipping-request')

// parse response body from melhor-envio API to ecomplus modules
const moduleSchema = require('./../../../lib/calculate-shipping-response')

// check if sh
const freeShippingFromValue = (application, params) => {
  let is
  if (application.hasOwnProperty('hidden_data') &&
    application.hidden_data.hasOwnProperty('shipping_discount') &&
    application.hidden_data.shipping_discount !== null) {
    if (params.hasOwnProperty('to') && params.hasOwnProperty('subtotal')) {
      application.hidden_data.shipping_discount.every(discount => {
        if (discount.hasOwnProperty('minimum_subtotal') && params.subtotal >= discount.minimum_subtotal) {
          discount.states.some(state => {
            if ((parseInt(params.to.zip.replace('-', '')) >= parseInt(state.from.replace('-', '')))
              && (parseInt(params.to.zip.replace('-', '')) <= state.to.replace('-', ''))) {
              is = discount.minimum_subtotal
            }
          })
        }
      })
    } else {
      application.hidden_data.shipping_discount.every(discount => {
        if (discount.hasOwnProperty('minimum_subtotal')) {
          is = discount.minimum_subtotal
        }
      })
    }
  }
  return is
}

module.exports = (appSdk, me) => {
  return (req, res) => {
    let schema = {}
    const { application, params } = req.body
    const { storeId } = req

    const response = {
      shipping_services: [],
      free_shipping_from_value: freeShippingFromValue(application, params)
    }

    if (params.hasOwnProperty('to') && params.hasOwnProperty('subtotal')) {
      getAppConfig(storeId)

        .then(auth => {

          schema = meSchema(application, params, auth.default_data)

          if (!schema) {
            return res.send(response)
          }

          me.setToken = auth.access_token
          return me.shipment.calculate(schema)
        })

        .then(services => {
          // shipping services
          response.shipping_services = moduleSchema(services, application, params, schema.from)
          // response
          return res.send(response)
        })

        .catch(error => {
          logger.error('CALCULATE_SHIPPING_ERR', error)
          res.status(400)
          return res.send({
            error: 'CALCULATE_SHIPPING_ERR',
            message: 'Unexpected Error Try Later'
          })
        })
    } else {
      return res.send(response)
    }
  }
}
