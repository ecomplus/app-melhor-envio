const logger = require('console-files')
const meClient = require('./client')
const { getAllLabels, updateLabel } = require('../database')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

module.exports = appSdk => {
  logger.log('--> Tracking codes init')

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
            const order = await appSdk.apiRequest(label.store_id, resource, method).then(({ data }) => data)

            return meClient({
              url: '/shipment/tracking',
              method: 'post',
              data: {
                orders: [label.label_id]
              }
            })
              .then(({ response }) => {
                const meLabel = response.data
                const labelPurshed = order.hidden_metafields.find(metafield => metafield.field === 'melhor_envio_label_id' && meLabel.hasOwnProperty(metafield.value))
                let updateTo
                switch (meLabel[labelPurshed.value].status) {
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

                if (updateTo && meLabel[labelPurshed.value].tracking) {
                  const resource = `orders/${label.resource_id}/fulfillments.json`
                  const method = 'POST'
                  const bodyUpdate = {
                    shipping_line_id: order.shipping_lines[0]._id,
                    date_time: new Date().toISOString(),
                    status: updateTo,
                    notification_code: meLabel[labelPurshed.value].tracking
                  }
                  return appSdk.apiRequest(storeId, resource, method, bodyUpdate)
                    .then(() => {
                      logger.log(`--> [Tracking Code Services] Update Traking Code at Order: ${order._id} | to ${updateTo}`)
                      return updateLabel(meLabel[labelPurshed.value].status, label.label_id)
                    })
                }

                return null
              })

              .then(() => next())

              .catch(err => {
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