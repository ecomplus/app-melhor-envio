'use strict'
const logger = require('console-files')
const me = require('melhor-envio').config({
  client_id: process.env.ME_CLIENT_ID,
  client_secret: process.env.ME_CLIENT_SECRET,
  sandbox: (process.env.ME_SANDBOX === 'true'),
  redirect_uri: process.env.ME_REDIRECT_URI,
  request_scope: `cart-read cart-write companies-read coupons-read notifications-read products-read products-write purchases-read shipping-calculate shipping-cancel shipping-checkout shipping-companies shipping-generate shipping-preview shipping-print shipping-share shipping-tracking ecommerce-shipping transactions-read users-read webhooks-read webhooks-write`
})

const { getLabels, getAppConfig, updateLabel } = require('./../lib/Api/Api')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

module.exports = (appSdk) => {
  logger.log('--> Start running tracking code services')
  // prevent erro 429
  const sleep = ms => {
    return (new Promise(function (resolve, reject) {
      setTimeout(function () { resolve() }, ms)
    }))
  }

  const tracking = async () => {
    let codes = await getLabels()

    let update = codes.map(async label => {
      await sleep(2000)

      // saves storeId to prevent the same authentication to be fetched each loop
      let currentStoreId = null
      let accessToken = null
      if (label.store_id !== currentStoreId) {
        let appConfig = await getConfig({ appSdk, storeId: label.store_id }, true)
        if (!appConfig.access_token) {
          let authConfig = await getAppConfig(label.store_id)
          accessToken = authConfig.access_token
        } else {
          accessToken = appConfig.access_token
        }
      }
      me.setToken = accessToken
      let find = {
        orders: [
          label.label_id
        ]
      }

      currentStoreId = label.store_id
      // search label data
      await me.shipment.tracking([find])
        // search the order in the API
        // checks if label has had its status changed on melhor-envio
        // updates order shipping_lines and tracking_code at API
        .then(async result => {
          let resource = `orders/${label.resource_id}`
          let method = 'GET'
          let request = await appSdk.apiRequest(label.store_id, resource, method)
          let order = request.response.data

          let labelAtOrder = order.hidden_metafields.find(metafield => metafield.field === 'melhor_envio_label_id' && result.hasOwnProperty(metafield.value))
          let updateTo

          switch (result[labelAtOrder.value].status) {
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

          if (updateTo && result[labelAtOrder.value].tracking) {
            let resource = `orders/${label.resource_id}/fulfillments.json`
            let method = 'POST'
            let bodyUpdate = {
              shipping_line_id: order.shipping_lines[0]._id,
              date_time: new Date().toISOString(),
              status: updateTo,
              notification_code: result[labelAtOrder.value].tracking
            }
            await appSdk.apiRequest(label.store_id, resource, method, bodyUpdate)
              .then(() => {
                logger.log('--> [Tracking Code Services] Update Traking Code at Order:', order._id)
                return updateLabel(result[labelAtOrder.value].status, label.label_id)
              })
          }
        })
    })

    await Promise.all(update)
      .catch(error => {
        logger.error('TRACKING_CODE_SERVICES_ERR', error)
      })
      .finally(() => {
        let interval = 1 * 60 * 1000
        setTimeout(tracking, interval)
      })
  }

  // run
  tracking()
}
