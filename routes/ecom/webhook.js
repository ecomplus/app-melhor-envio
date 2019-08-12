'use strict'
const logger = require('console-files')
// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'

//
const { getAppConfig, addNewLabel } = require('./../../lib/Api/Api')
const labelCanBeGenereted = require('./../../lib/label-can-be-generated')
const generateLabelSchema = require('./../../lib/generate-label-request')

module.exports = (appSdk, me) => {
  return (req, res) => {
    /*
    Treat E-Com Plus trigger body here
    // https://developers.e-com.plus/docs/api/#/store/triggers/
    const trigger = req.body
    */
    const { storeId } = req
    const resourceId = req.body.resource_id || req.body.inserted_id

    // get app configured options
    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        /* Do the stuff */
        return getAppConfig(storeId)

          .then(auth => {
            let resource = `orders/${resourceId}`
            let method = 'GET'

            // get order ecomplus
            return appSdk.apiRequest(storeId, resource, method)

              .then(async result => {
                const order = result.response.data

                // Checks if the order has the properties required to purchase the tag and binds it to order
                if (!labelCanBeGenereted(order)) {
                  return res.send(ECHO_SKIP)
                }

                // sdk
                me.setToken = auth.access_token // set token
                let seller = await me.user.me() // get seller address current

                // create a schema valid to
                // generate label at melhor-envio
                let schema = generateLabelSchema(order, seller, configObj)

                // insert schema at cart
                await me.user.cart(schema)

                  .then(async label => {
                    // request checkout at melhor-envio
                    return me.shipment.checkout([label.id])

                      .then(() => {
                        // saves the tag to the database for later tracking
                        return addNewLabel(label.id, label.status, resourceId, storeId)
                      })

                      .then(() => {
                        logger.log('--> Label purchased for order:', order._id)
                        // updates hidden_metafields with the generated tag id
                        let resource = `orders/${resourceId}/hidden_metafields.json`
                        let method = 'POST'
                        let params = {
                          field: 'melhor_envio_label_id',
                          value: label.id
                        }
                        return appSdk.apiRequest(storeId, resource, method, params)
                      })

                      .then(() => {
                        // done
                        res.send(ECHO_SUCCESS)
                      })
                  })
              })
          })
      })

      .catch(err => {
        if (err.name === SKIP_TRIGGER_NAME) {
          // trigger ignored by app configuration
          res.send(ECHO_SKIP)
        } else {
          logger.error('--> WEBHOOK_ERR', err)
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
