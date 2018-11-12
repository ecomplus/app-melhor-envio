const SQL = require('./sql')
const RQ = require('request')
const MelhorEnvioApp = require('./melhorenvio')
const ENTITY = 'app_auth'
class EcomPlus {
  constructor () {
    this.melhorEnvioApp = new MelhorEnvioApp()
  }

  async verifyOrder (payload, resource, xstoreid) {
    let app = await SQL.select({ store_id: xstoreid }, ENTITY).catch(e => console.log(new Error('Erro ao buscar informações relacionadas ao X-Store-id informado | Erro: '), e))
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
                      resolve(this.melhorEnvioApp.cart(body, xstoreid))
                    }
                  }
                }
              }
            } else if (body.fulfillment_status.current === 'ready_for_shipping' ||
                      body.fulfillment_status.current === 'invoice_issued' ||
                      body.fulfillment_status.current === 'in_production' ||
                      body.fulfillment_status.current === 'in_separation' ||
                      body.fulfillment_status.current === 'partially_shippend' ||
                      body.fulfillment_status.current === 'shipped' ||
                      body.fulfillment_status.current === 'partially_delivered' ||
                      body.fulfillment_status.current === 'returned_for_exchange' ||
                      body.fulfillment_status.current === 'received_for_exchange' ||
                      body.fulfillment_status.current === 'returned'
            ) {
  
            }
          }
        }
      })
    })
  }

  async registerProcedure (xstoreid) {
    let app = await SQL.select({ store_id: xstoreid }, ENTITY).catch(e => console.log(new Error('Erro ao buscar informações relacionadas ao X-Store-id informado | Erro: '), e))
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

  async updateOrder () {

  }
}
module.exports = EcomPlus
