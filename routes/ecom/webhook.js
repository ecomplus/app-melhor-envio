'use strict'

// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'

//
const { internalApi } = require(process.cwd() + '/lib/Api/Api')
const labelCanBeGenereted = require(process.cwd() + '/lib/label-can-be-generated')
const generateLabelSchema = require(process.cwd() + '/lib/generate-label-request')

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
        return internalApi
          .then(iApi => {
            return {
              iApi,
              configObj
            }
          })
      })

      .then(({ iApi, configObj }) => {
        return iApi.getAppConfig(storeId)

          .then(data => {
            const { access_token } = data
            /* Do the stuff */
            let resource = 'orders/' + resourceId
            let method = 'GET'
            // get order
            return appSdk.apiRequest(storeId, resource, method)

              .then(async result => {
                let order = result.response.data
                
                // checks whether the order has required properties as fulfillment_status, service_code, invoices and issuer.doc_number
                // or checks if the order already has a label generated
                if (!labelCanBeGenereted(order)) {
                  return res.send(ECHO_SKIP)
                }

                // melhor-envio-sdk set access_token after instance
                me.setToken = access_token
                
                // get seller data
                let seller = await me.user.me()

                // parser order to melhor envio model
                let schema = generateLabelSchema(order, seller, configObj)

                // insert schema at melhor envio cart
                me.user.cart(schema)

                  .then(label => {
                    // try to pay the label genereted
                    me.shipment.checkout(label.id)

                      .then(() => {
                        // then save label at database
                        return iApi.addNewLabel(label.id, label.status, resourceId, storeId)
                          // then update order at ecomplus-api
                          .then(() => {
                            let resource = 'orders/' + resourceId + '/hidden_metafields.json'
                            let method = 'POST'
                            let params = {
                              field: 'melhor_envio_label_id',
                              value: label.id
                            }
                            //
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
      })
      .catch(err => {
        if (err.name === SKIP_TRIGGER_NAME) {
          // trigger ignored by app configuration
          res.send(ECHO_SKIP)
        } else {
          // logger.error(err)
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
