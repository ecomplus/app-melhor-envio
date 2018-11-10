const SQL = require('./sql')
const RQ = require('request')
const MelhorEnvioApp = require('./melhorenvio')

class EcomPlus {
  constructor () {
    this.melhorEnvioApp = new MelhorEnvioApp()
  }
  async getNewOrder (payload, xstoreid) {
    let app = await SQL.select({ store_id: xstoreid }).catch(e => console.log(new Error('Erro ao buscar informações relacionadas ao X-Store-id informado | Erro: '), e))
    let options = {
      uri: 'https://api.e-com.plus/v1/orders/' + payload.resource_id + '.json',
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
}
module.exports = EcomPlus
