const logger = require('console-files')
const meClient = require('./client')
const { getAllLabels, updateLabel, deleteLabel } = require('../database')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const errorHandling = require(process.cwd() + '/lib/store-api/error-handling')

module.exports = appSdk => {
  logger.log('>> Inciando rastreio de etiquetas')
  let lastStoreId, lastAppConfig

  const trackingCodes = () => new Promise((resolve, reject) => {
    getAllLabels().then(labels => {
      const checkStatus = async (labels, queue = 0) => {
        console.log(queue)
        const label = labels[queue]
        const next = () => {
          queue++
          return checkStatus(labels, queue)
        }

        if (!label || !label.store_id) {
          return resolve()
        }

        // evita buscar configuração do app para o mesmo storeId
        const storeId = label.store_id
        let appConfig
        if (lastStoreId === storeId && lastAppConfig) {
          appConfig = lastAppConfig
        } else {
          lastStoreId = storeId
          appConfig = await getConfig({ appSdk, storeId }, true)
        }
        if (appConfig.disable_tracking) {
          return next()
        }
        if (!appConfig.access_token) {
          return next()
        }

        let order
        try {
          order = await appSdk.apiRequest(label.store_id, `/orders/${label.resource_id}.json`).then(({ response }) => response.data)
        } catch (err) {
          errorHandling(err)
          if (err.response && err.response.status === 404) {
            deleteLabel(label.id).catch(logger.error)
          }
          return next()
        }

        const token = appConfig.access_token
        const sandbox = (appConfig.sandbox)

        meClient({
          url: '/shipment/tracking',
          method: 'post',
          data: {
            orders: [label.label_id]
          },
          token,
          sandbox
        }).then(({ data }) => {
          const orderLabel = order.hidden_metafields.find(metafield => metafield.field === 'melhor_envio_label_id' && data.hasOwnProperty(metafield.value))

          if (!orderLabel || !orderLabel.value) {
            return null
          }

          const tracking = data[orderLabel.value]
          const shippingLine = order.shipping_lines && order.shipping_lines
            .find(({ app }) => app && app.service_code && app.service_code.startsWith('ME'))
          if (!shippingLine) {
            return null
          }
          const shippingLineCurrentStatus = shippingLine.status
            ? shippingLine.status.current
            : order.fulfillment_status
              ? order.fulfillment_status.current : ''
          let updateTo

          switch (tracking.status) {
            case 'posted':
              if (shippingLineCurrentStatus !== 'shipped' && shippingLineCurrentStatus !== 'delivered') {
                updateTo = 'shipped'
              }
              break
            case 'delivered':
              if (shippingLineCurrentStatus !== 'delivered' && tracking.tracking) {
                updateTo = 'delivered'
              }
              break
            case 'undelivered':
              if (shippingLineCurrentStatus !== 'returned') {
                updateTo = 'returned'
              }
              break
          }

          const promises = []
          if (tracking.tracking && (!shippingLine.tracking_codes || !shippingLine.tracking_codes.length)) {
            let promise = appSdk.apiRequest(
              storeId,
              `/orders/${label.resource_id}/shipping_lines/${shippingLine._id}.json`,
              'PATCH',
              {
                tracking_codes: [{
                  code: tracking.tracking,
                  link: `https://www.melhorrastreio.com.br/rastreio/${tracking.tracking}`
                }]
              }
            ).then(() => {
              logger.log(`Tracking code para ${order._id} / Pro.: ${tracking.protocol} / #${storeId}`)
            })
            promises.push(promise)
          }

          if (updateTo) {
            let promise = appSdk.apiRequest(
              storeId,
              `/orders/${label.resource_id}/fulfillments.json`,
              'POST',
              {
                shipping_line_id: shippingLine._id,
                date_time: new Date().toISOString(),
                status: updateTo,
                notification_code: tracking.id
              }
            ).then(() => {
              logger.log(`Status do pedido ${order._id} alterado com sucesso para ${updateTo}`)
            })
            promises.push(promise)
          }

          return Promise.all(promises).then(() => {
            switch (tracking.status) {
              case 'delivered':
              case 'undelivered':
              case 'canceled':
                return deleteLabel(label.id)
            }
            return updateLabel(tracking.status, label.label_id)
          })
        }).then(next).catch(err => {
          if (err.isAxiosError) {
            const { response } = err
            if (response && response.status < 500) {
              const payload = {
                storeId: label.store_id,
                labelId: label.label_id,
                status: response.status,
                data: response.data,
                config: response.config
              }
              logger.error('Tracking_codes_err', JSON.stringify(payload, undefined, 4))
            }
          } else {
            err.libCode = 'Tracking_codes_err'
            logger.error(err)
          }

          return next()
        })
      }

      return checkStatus(labels)
    })
  })

  const start = () => trackingCodes().finally(() => setTimeout(() => start(), 2 * 60 * 1000))
  start()
}
