const SQL = require('./sql')
const RQ = require('request')
const MelhorEnvioApp = require('./melhorenvio_old')
const ENTITY = 'app_auth'
const logger = require('console-files')

class EcomPlus {
  constructor () {
    this.melhorEnvioApp = new MelhorEnvioApp()
  }

  async verifyOrder (payload, resource, xstoreid) {
    let app = await SQL.select({ store_id: xstoreid }, ENTITY).catch(e => logger.log(new Error('Erro ao buscar informações relacionadas ao X-Store-id informado | Erro: '), e))
    if (app) {
      let options = {
        uri: 'https://api.e-com.plus/v1/orders/' + resource + '.json',
        headers: {
          'Content-Type': 'application/json',
          'X-Store-ID': xstoreid,
          'X-Access-Token': app.app_token,
          'X-My-ID': app.authentication_id
        }
      }
      return new Promise((resolve, reject) => {
        RQ.get(options, async (erro, resp, body) => {
          if (resp.statusCode >= 400) {
            reject(resp.body)
          }
          body = JSON.parse(body)
          if (typeof body.fulfillment_status !== 'undefined') {
            if (typeof body.fulfillment_status.current !== 'undefined') {
              if (body.fulfillment_status.current === 'ready_for_shipping') {
                if (typeof body.shipping_lines !== 'undefined') {
                  if (typeof body.shipping_lines[0].app !== 'undefined' && body.shipping_lines[0].app.service_code === '3') {
                    if (typeof body.shipping_lines[0].invoices !== 'undefined') {
                      if (typeof body.shipping_lines[0].invoices[0].issuer.doc_number !== 'undefined') {
                        if (typeof body.hidden_metafields !== 'undefined') {
                          let label = body.hidden_metafields.find(hidden => hidden.field === 'melhor_envio_label_id')
                          if (!label) {
                            resolve(this.melhorEnvioApp.cart(body, xstoreid))
                          } else {
                            reject(new Error('Existe etiquetas vinculadas a order.'))
                          }
                        }
                      }
                    }
                  }
                }
              } else if (body.fulfillment_status.current === 'invoice_issued' ||
                        body.fulfillment_status.current === 'in_production' ||
                        body.fulfillment_status.current === 'in_separation' ||
                        body.fulfillment_status.current === 'partially_shippend' ||
                        body.fulfillment_status.current === 'shipped' ||
                        body.fulfillment_status.current === 'partially_delivered' ||
                        body.fulfillment_status.current === 'returned_for_exchange' ||
                        body.fulfillment_status.current === 'received_for_exchange' ||
                        body.fulfillment_status.current === 'returned'
              ) {
                logger.log('Update shipment status')
                resolve(this.orderHasSameStatus(xstoreid, body))
              }
            }
          }
        })
      })
    }
  }

  async orderHasSameStatus (xstoreId, order) {
    let orderLabel = order.hidden_metafields.find(hidden => hidden.field === 'melhor_envio_label_id')
    logger.log(orderLabel.value)
    if (orderLabel) {
      let melhorEnvioLabel = await this.melhorEnvioApp.getLabel(xstoreId, orderLabel.value)
      if (melhorEnvioLabel[orderLabel.value]) {
        melhorEnvioLabel = melhorEnvioLabel[orderLabel.value]
        if (melhorEnvioLabel.status === 'posted') {
          if (order.shipping_lines[0].status !== 'shipped') {
            logger.log('Update to shipped')
            return this.updateOrderStatus(xstoreId, order._id, 'shipped')
          }
        } else if (melhorEnvioLabel.status === 'delivered') {
          if (order.shipping_lines[0].status !== 'delivered') {
            logger.log('Update to delivered')
            return this.updateOrderStatus(xstoreId, order._id, 'delivered')
          }
        } else if (melhorEnvioLabel.status === 'undelivered') {
          if (order.shipping_lines[0].status !== 'returned') {
            logger.log('Update to undelivered')
            return this.updateOrderStatus(xstoreId, order._id, 'returned')
          }
        }
      }
      return false
    }
    return false
  }

  async registerProcedure (xstoreid) {
    let app = await SQL.select({ store_id: xstoreid }, ENTITY).catch(e => logger.log(new Error('Erro ao buscar informações relacionadas ao X-Store-id informado | Erro: '), e))
    let params = {
      title: 'Melhor Envio Shipment Update',
      short_description: 'After received order, update melhor envio cart.',
      triggers: [
        {
          resource: 'orders'
        }
      ],
      webhooks: [
        {
          api: {
            external_api: {
              uri: 'https://melhorenvio.ecomplus.biz/notifications'
            }
          },
          method: 'POST',
          send_body: true
        }
      ],
      tag: 'melhor_envio_orders'
    }
    let options = {
      uri: 'https://api.e-com.plus/v1/procedures.json',
      headers: {
        'Content-Type': 'application/json',
        'X-Store-ID': xstoreid,
        'X-Access-Token': app.app_token,
        'X-My-ID': app.authentication_id
      },
      body: params,
      json: true
    }
    return new Promise((resolve, reject) => {
      RQ.post(options, (erro, resp, body) => {
        if (resp.statusCode >= 400) {
          reject(resp.body)
        }
        resolve(body)
      })
    })
  }

  async updateOrderStatus (xstoreId, resource, status) {
    let app = await SQL.select({ store_id: xstoreId }, ENTITY).catch(e => logger.log(new Error('Erro ao buscar informações relacionadas ao X-Store-id informado | Erro: '), e))
    return new Promise((resolve, reject) => {
      let options = {
        uri: 'https://api.e-com.plus/v1/orders/' + resource + '.json',
        headers: {
          'Content-Type': 'application/json',
          'X-Store-ID': xstoreId,
          'X-Access-Token': app.app_token,
          'X-My-ID': app.authentication_id
        },
        body: {
          status: {
            current: status
          }
        },
        json: true
      }
      RQ.post(options, (erro, resp, body) => {
        if (resp.statusCode >= 400) {
          reject(new Error(JSON.stringify(resp.body)))
        }
        resolve(body)
      })
    })
  }

  async updateMetafields (label, resource, xstoreid) {
    let app = await SQL.select({ store_id: xstoreid }, ENTITY).catch(e => logger.log(new Error('Erro ao buscar informações relacionadas ao X-Store-id informado | Erro: '), e))
    return new Promise((resolve, reject) => {
      let options = {
        uri: 'https://api.e-com.plus/v1/orders/' + resource + '/hidden_metafields.json',
        headers: {
          'Content-Type': 'application/json',
          'X-Store-ID': xstoreid,
          'X-Access-Token': app.app_token,
          'X-My-ID': app.authentication_id
        },
        body: {
          field: 'melhor_envio_label_id',
          value: label.id
        },
        json: true
      }
      RQ.post(options, (erro, resp, body) => {
        if (resp.statusCode >= 400) {
          reject(new Error(JSON.stringify(resp.body)))
        }
        resolve(body)
      })
    })
  }
}
module.exports = EcomPlus
