const SQL = require('./sql')
const RQ = require('request')
const MelhorEnvioApp = require('./melhorenvio')
const ENTITY = 'app_auth'
class EcomPlus {
  constructor () {
    this.melhorEnvioApp = new MelhorEnvioApp()
  }

  async getNewOrder (payload, resource, xstoreid) {
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
    RQ.get(options, (erro, resp) => {
      if (resp.statusCode >= 400) {
        return false
      }
      if (typeof resp.fulfillment_status !== 'undefined') {
        if (resp.fulfillment_status.current === 'ready_for_shipping') {
          if (typeof resp.shipping_lines[0].app !== 'undefined' && resp.shipping_lines[0].app.service_code === '3') {
            if (resp.shipping_lines[0].invoices[0].issuer_doc_number !== 'undefined') {
              this.melhorEnvioApp.cart(resp, xstoreid)
            }
          } else {
            this.melhorEnvioApp.cart(resp, xstoreid)
          }
        }
      }
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
}
module.exports = EcomPlus
