const MelhorEnvioSDK = require('melhor-envio')
const logger = require('console-files')
const rq = require('request')
const config = require('../config')
const sql = require('./sql')
const AUTH_ENTITY = 'app_auth'

class MelhorEnvioApp {

  constructor (storeId) {
    // instancia sdk melhor envio
    this.me = new MelhorEnvioSDK({
      client_id: config.ME_CLIENT_ID,
      client_secret: config.ME_CLIENT_SECRET,
      sandbox: config.ME_SANDBOX,
      redirect_uri: config.ME_REDIRECT_URI,
      request_scope: 'cart-read cart-write companies-read coupons-read notifications-read products-read products-write purchases-read shipping-calculate shipping-cancel shipping-checkout shipping-companies shipping-generate shipping-preview shipping-print shipping-share shipping-tracking ecommerce-shipping transactions-read users-read webhooks-read webhooks-write'
    })
    // se o store_id for informado
    // na instancia da class
    // então as informações sobre
    // o aplicativo são setadas como access_token
    if (storeId) {
      this.storeId = storeId
    }
  }

  // seta access token se store_id for informado na instancia da class
  async init () {
    let meTokens = await this.getAppinfor(this.storeId)
    if (meTokens) {
      this.me.setToken = meTokens.me_access_token
    }
  }

  async setToken () {
    let meTokens = await this.getAppinfor(this.storeId)
    if (meTokens) {
      this.me.setToken = meTokens.me_access_token
    }
  }

  async getAppinfor (xstoreId) {
    return sql.select({ store_id: xstoreId }, AUTH_ENTITY)
      .catch(erro => {
        logger.log(new Error('Não existe aplicativo instalado para X-Store-Id informado' + xstoreId + ' - Erro #409 - ' + erro))
      })
  }

  requestOAuth (xstoreId) {
    let storeId = xstoreId || this.storeId
    return this.me.auth.getAuth() + '&state=' + storeId
  }

  setAppToken (token, storeId) {
    return this.me.auth.getToken(token)
      .then(ret => {
        let update = { me_refresh_token: ret.refresh_token, me_access_token: ret.access_token }
        let where = { store_id: storeId || this.storeId }
        sql.update(update, where, AUTH_ENTITY)
          .catch(erro => {
            logger.log(new Error('Erro ao salvar melhor envio access_token no banco | Erro #410 - ' + erro))
          })
      })
  }

  schemaCalculate (payload) {
    if (typeof payload.application.hidden_data.from === 'undefined') {
      logger.error(new Error('Propriedade hidden_data.from não informada - Erro #412'))
      return false
    }

    if (typeof payload.params.to === 'undefined') {
      logger.error(new Error('Propriedade params.to não informada - Erro #412'))
      return false
    }

    let calculateObj = {}
    calculateObj.from = {}
    calculateObj.from.postal_code = payload.application.hidden_data.from.zip
    calculateObj.from.address = payload.application.hidden_data.from.street
    calculateObj.from.number = payload.application.hidden_data.from.number

    calculateObj.to = {}
    calculateObj.to.postal_code = payload.params.to.zip
    calculateObj.to.address = payload.params.to.street
    calculateObj.to.number = payload.params.to.number

    calculateObj.products = this.schemaCalculateProducts(payload.params.items) || null
    
    calculateObj.options = {}
    calculateObj.options.receipt = false
    calculateObj.options.own_hand = false
    calculateObj.options.collect = false
    return calculateObj
  }

  schemaCalculateProducts (items) {
    if (items) {
      let products = []
      products = items.map(item => {
        let p = {
          id: item.product_id,
          weight: item.dimensions.weight,
          width: item.dimensions.width.value,
          height: item.dimensions.height.value,
          length: item.dimensions.length.value,
          insurance_value: item.final_price
        }
        return p
      })
      return products
    }
    return false
  }

  schemaCalculateResponse (payload, from, to, packageRequest) {
    let retorno = []
    retorno = payload.filter(servico => {
      if (servico.error) {
        return false
      }
      return true
    }).map(service => {
      return {
        label: service.name,
        carrier: service.company.name,
        service_name: service.name,
        service_code: 'ME ' + service.id,
        icon: service.company.picture,
        shipping_line: {
          package: {
            dimensions: {
              width: {
                value: service.packages[0].dimensions.width
              },
              height: {
                value: service.packages[0].dimensions.height
              },
              length: {
                value: service.packages[0].dimensions.length
              }
            },
            weight: {
              value: parseInt(service.packages[0].weight)
            }
          },
          from: {
            zip: from.postal_code,
            street: from.address,
            number: from.number
          },
          to: {
            zip: to.postal_code,
            street: to.address,
            number: to.number
          },
          discount: parseFloat(service.discount),
          posting_deadline: {
            days: service.delivery_time
          },
          delivery_time: {
            days: service.delivery_time
          },
          price: service.name === 'PAC' ? this.discount(packageRequest, service) : parseFloat(service.price),
          total_price: service.name === 'PAC' ? this.discount(packageRequest, service) : parseFloat(service.price),
          custom_fields: [
            {
              field: 'by_melhor_envio',
              value: 'true'
            },
            {
              field: 'jadlog_agency',
              value: '1'
            }
          ]
        }
      }
    })
    return retorno
  }

  async calculate (payload, storeId) {
    return new Promise(async (resolve, reject) => {
      // se não houve items
      // a requisição é para saber quao valor mínimo para desconto no frete
      // configurado no hidden_data do app
      if (typeof payload.params.items === 'undefined') {
        if (typeof payload.application.hidden_data !== 'undefined' && typeof payload.application.hidden_data.shipping_discount !== 'undefined') {
          if (payload.application.hidden_data.shipping_discount[0].minimum_subtotal !== 'undefined') {
            resolve({ free_shipping_from_value: payload.application.hidden_data.shipping_discount[0].minimum_subtotal })
          }
        } else {
          resolve({ shipping_services: [] })
        }
      }
      // se houver items a requisição
      // é para calculo do frete
      let schema = this.schemaCalculate(payload)
      // se o schema não for válido
      // retorna false e rejeita a promise
      // com o shipping_service vazio
      if (!schema) {
        resolve({ shipping_services: [] })
      }
      // se o schema for válido
      // realiza o calculo no melhor envio
      await this.setToken()
      this.me.shipment.calculate(schema)
        .then(resp => {
          let objResponse = {}
          objResponse.shipping_services = this.schemaCalculateResponse(resp, schema.from, schema.to, payload)
          // Se a propriedade hidden_data.shipping_discount[0].minimum_subtotal
          // estiver configurada no hidden_data do app retornamos ela também
          if (typeof payload.application.hidden_data !== 'undefined' && typeof payload.application.hidden_data.shipping_discount !== 'undefined') {
            if (typeof payload.application.hidden_data.shipping_discount[0].minimum_subtotal !== 'undefined') {
              objResponse.free_shipping_from_value = payload.application.hidden_data.shipping_discount[0].minimum_subtotal
            }
          }
          // tudo ok?
          // resolve com o payload no schema da ecom-plus-api
          resolve(JSON.stringify(objResponse))
        })
        .catch(e => {
          console.log(e)
          logger.error(new Error('Falha com a solicitação no Melhor Envio API | Erro: - ' + e))
          reject(new Error(e))
        })
    })
  }

  async cart (payload, xstoreId) {
    return new Promise(async (resolve, reject) => {
      this.me.user.cart(this.schemaCartMe(payload, xstoreId))
        .then(resp => {
          this.registerLabel(resp, xstoreId, payload._id)
          this.me.shipment.checkout()
            .then(resp => {
              resolve(resp)
            })
            .catch(e => {
              logger.error(new Error('Falha ao realizar pagamento da etiqueta no Melhor Envio API | Erro: - ' + e))
              reject(new Error(e))
            })
        })
        .catch(e => {
          logger.error(new Error('Falha ao solicitar compra da etiqueta no Melhor Envio API | Erro: - ' + e))
          reject(new Error(e))
        })
    })
  }

  async schemaCartMe (payload, xstoreId) {
    let app = await this.getAppinfor(xstoreId)
    let hiddenData = await this.getAppHiddenData(app)
    hiddenData = JSON.parse(hiddenData)
    return {
      'service': payload.shipping_lines[0].app.service_code,
      'agency': hiddenData.jadlog_agency,
      'from': await this.parseOrder.from(xstoreId, hiddenData),
      'to': this.parseOrder.to(payload),
      'products': [this.parseOrder.products(payload.items)],
      'package': this.parseOrder.package(payload.shipping_lines[0].package),
      'options': this.parseOrder.options(payload)
    }
  }

  async getAppHiddenData (application) {
    return new Promise((resolve, reject) => {
      let options = {
        uri: 'https://api.e-com.plus/v1/applications/' + application.application_id + '/hidden_data.json',
        headers: {
          'Content-Type': 'application/json',
          'X-Store-ID': application.store_id,
          'X-Access-Token': application.app_token,
          'X-My-ID': application.authentication_id
        }
      }
      rq.get(options, (erro, resp, body) => {
        if (resp.statusCode >= 400) {
          logger.error(new Error('Erro com a requisição na E-com-plus API | Erro : ' + resp.body))
          reject(resp.body)
        }
        resolve(body)
      })
    })
  }

  async getSellerInfor (xstoreId) {
    return this.me.user.me()
      .catch(e => {
        logger.log(new Error('Não existe access_token vinculado ao x-store-id informado, realize outra autenticação.'), e)
      })
  }

  async registerLabel (label, xstoreId, resourceId) {
    let params = {
      label_id: label.id,
      status: label.status,
      resource_id: resourceId,
      store_id: xstoreId
    }
    sql.insert(params, AUTH_ENTITY)
      .then(resp => {
        let Ecomplus = require('./ecomplus')
        let controller = new Ecomplus()
        controller.updateMetafields(label, resourceId, xstoreId)
          .catch(e => {
            logger.log(new Error('Erro ao atualizar metafield da order ' + resourceId + ' com id da etiqueta gerada (' + label + ') no melhor envio'))
          })
      })
  }

  async getLabel (xstoreId, id) {
    let ids = {
      orders: [id]
    }
    return this.me.shipment.tracking(ids)
  }

  discount (payload, calculate) {
    let finalPrince
    if (typeof payload.application.hidden_data !== 'undefined' && typeof payload.application.hidden_data.shipping_discount !== 'undefined') {
      if (payload.params.subtotal >= payload.application.hidden_data.shipping_discount[0].minimum_subtotal) {
        let states = payload.application.hidden_data.shipping_discount[0].states.find(state => {
          if (parseInt(payload.params.to.zip) <= parseInt(state.from) && parseInt(state.to) >= parseInt(payload.params.to.zip)) {
            return true
          }
          return false
        })
        if (typeof states !== 'undefined') {
          let total
          if (typeof payload.application.hidden_data.shipping_discount[0].fixed_value !== 'undefined') {
            total = calculate.price - payload.application.hidden_data.shipping_discount[0].fixed_value
          }
          if (typeof payload.application.hidden_data.shipping_discount[0].percent_value !== 'undefined') {
            total -= (total * payload.application.hidden_data.shipping_discount[0].percent_value)
          }
          finalPrince = Math.sign(total) === 1 ? parseFloat(total) : 0
        } else {
          finalPrince = parseFloat(calculate.price)
        }
      } else {
        finalPrince = parseFloat(calculate.price)
      }
    } else {
      finalPrince = parseFloat(calculate.price)
    }
    if (finalPrince > 0) {
      if (typeof payload.application.hidden_data !== 'undefined') {
        if (typeof payload.application.hidden_data.shipping_addition !== 'undefined') {
          if (payload.application.hidden_data.shipping_addition.type === 'percentage') {
            finalPrince += (finalPrince * payload.application.hidden_data.shipping_addition.value)
          } else if (payload.application.hidden_data.shipping_addition.type === 'fixed') {
            finalPrince += payload.application.hidden_data.shipping_addition.value
          }
        }
      }
      // desconto defualt
      finalPrince -= finalPrince * 0.5
      finalPrince = finalPrince <= 0 ? 0 : finalPrince
    }
    return finalPrince
  }
}

module.exports = MelhorEnvioApp