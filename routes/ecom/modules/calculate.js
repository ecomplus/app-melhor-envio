'use strict'
// log on files
const logger = require('console-files')

// read configured internal app data
// like melhor-envio access_token, user from, etc.
const { internalApi } = require(process.cwd() + '/lib/Api/Api')

// parse calculate body from modules API to melhor-envio model
const calculateRequest = require(process.cwd() + '/lib/calculate-shipping-request')

// parse response body from melhor-envio API to ecomplus modules
const calculateResponse = require(process.cwd() + '/lib/calculate-shipping-response')

// check if sh
const freeShippingFromValue = (application, params) => {
  let is
  if (application.hasOwnProperty('hidden_data') && application.hidden_data.hasOwnProperty('shipping_discount') && application.hidden_data.shipping_discount !== null) {
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
  }
  return is
}

module.exports = (appSdk, me) => {
  return (req, res) => {
    let schema = {}
    logger.log(JSON.stringify(req.body))
    const { application, params } = req.body
    const { storeId } = req
    const moduleResponse = {
      shipping_services: [],
      free_shipping_from_value: freeShippingFromValue(application, params)
    }

    internalApi
      .then(api => {
        // get melhor envio access_token
        api.getAppConfig(storeId)
          .then(data => {
            // credentials melhor envio 
            const { access_token, default_data } = data

            // parse calculate body from modules API to melhor-envio model
            schema = calculateRequest(application, params, default_data)

            // if is a not valid schema to request a calculate
            // send empty object to module
            if (!schema) {
              return res.status(200).send(moduleResponse)
            }

            // if is valid
            // do the calcule
            me.setToken = access_token
            return me.shipment.calculate(schema)
          })
          .then(services => {
            logger.log('--> Calculate Shipping')
            // shipping services
            moduleResponse.shipping_services = calculateResponse(services, application, params, schema.from)
            // response
            return res.status(200).send(moduleResponse)
          })
          .catch(e => logger.error(e))
      })
      .catch(e => logger.error(e))
  }
}
