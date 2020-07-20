const logger = require('console-files')
const meClient = require('./client')
const { getAllLabels, updateLabel } = require('../database')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const errorHandling = require(process.cwd() + '/lib/store-api/error-handling')
module.exports = appSdk => {
  logger.log('>> Tracking codes init')

  const trackingCodes = () => {
    return new Promise((resolve, reject) => {
      return getAllLabels()
        .then(data => {
          const recursive = async (labels, queue = 0) => {
            let appConfig
            const label = labels[queue]
            const next = () => {
              queue++
              return recursive(labels, queue)
            }

            if (!label || !label.store_id) {
              return resolve()
            }

            let storeId
            if (storeId !== label.store_id) {
              storeId = label.store_id
              appConfig = await getConfig({ appSdk, storeId }, true)
              if (!appConfig.access_token) {
                return next()
              }
            }

            const resource = `orders/${label.resource_id}`
            const method = 'GET'
            const order = await appSdk.apiRequest(label.store_id, resource, method).then(resp => resp.response.data)
            const token = appConfig.access_token
            const sandbox = (appConfig.sandbox)
            return meClient({
              url: '/shipment/tracking',
              method: 'post',
              data: {
                orders: [label.label_id]
              },
              token,
              sandbox
            })
              .then(({ data }) => {
                const meLabel = data
                const labelPurshed = order.hidden_metafields.find(metafield => metafield.field === 'melhor_envio_label_id' && meLabel.hasOwnProperty(metafield.value))                
                if (!labelPurshed || !labelPurshed.value) {
                  return null
                }

                const trackingStatus = meLabel[labelPurshed.value].status
                const trackingCode = meLabel[labelPurshed.value].tracking
                const shippingLinesStatus = order.shipping_lines[0].status.current
                let updateTo

                switch (trackingStatus) {
                  case 'posted':
                    if (shippingLinesStatus !== 'shipped') {
                      updateTo = 'shipped'
                    }
                    break
                  case 'delivered':
                    if (shippingLinesStatus !== 'delivered') {
                      updateTo = 'delivered'
                    }
                    break
                  case 'undelivered':
                    if (shippingLinesStatus !== 'returned') {
                      updateTo = 'undelivered'
                    }
                    break
                  default:
                    break
                }

                if (updateTo && trackingCode) {
                  const resource = `orders/${label.resource_id}/fulfillments.json`
                  const method = 'POST'
                  const bodyUpdate = {
                    shipping_line_id: order.shipping_lines[0]._id,
                    date_time: new Date().toISOString(),
                    status: updateTo,
                    notification_code: trackingCode
                  }
                  return appSdk.apiRequest(storeId, resource, method, bodyUpdate)
                    .then(() => {
                      logger.log(`--> [Tracking Code Services] Update Traking Code at Order: ${order._id} | to ${updateTo} | #${storeId}`)
                      return updateLabel(meLabel[labelPurshed.value].status, label.label_id)
                    })
                }

                return null
              })

              .then(() => next())

              .catch(err => {
                errorHandling(err)
                logger.error(`Tracking_codes_err: ${label.store_id} | ${label.label_id} | ${err}`)
                return next()
              })
          }
          return recursive(data)
        })
        .catch(reject)
    })
  }

  const start = () => trackingCodes().finally(() => setTimeout(() => start(), 30 * 60 * 1000))
  start()
}