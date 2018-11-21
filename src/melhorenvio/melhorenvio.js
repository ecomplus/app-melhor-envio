const config = require('./../config')
const sql = require('./sql')
const MelhorEnvioSDK = require('melhor-envio')
const rq = require('request')
const ENTITY = 'app_auth'
const logger = require('logger-files')

class MelhorEnvioApp {
  constructor() {
    this.me = new MelhorEnvioSDK({
      client_id: config.ME_CLIENT_ID,
      client_secret: config.ME_CLIENT_SECRET,
      sandbox: config.ME_SANDBOX,
      redirect_uri: config.ME_REDIRECT_URI,
      request_scope: config.ME_SCOPE
    })

    this.parseOrder = {
      from: async (xstoreId, hiddenData) => {
        let seller = await this.getSellerInfor(xstoreId).catch(e => logger.error(new Error('Seller não encontrado.')))
        seller = JSON.parse(seller)
        return {
          'name': seller.firstname + seller.lastname,
          'phone': seller.phone.phone,
          'email': seller.email, // email (opcional)
          'document': seller.document, // cpf (opcional)
          // 'company_document': '89794131000100', // cnpj (obrigatório se não for Correios)
          // 'state_register': '123456', // inscrição estadual (obrigatório se não for Correios) pode ser informado 'isento'
          'address': seller.address.address,
          'complement': seller.address.complement,
          'number': seller.address.number,
          'district': seller.address.district,
          'city': seller.address.city.city,
          'state_abbr': seller.address.city.state.state_abbr,
          'country_id': seller.address.city.state.country.id,
          'postal_code': seller.address.postal_code
        }
      },
      to: (order) => {
        return { // destinatário
          'name': order.shipping_lines[0].to.name,
          'phone': order.shipping_lines[0].to.phone.number, // telefone com ddd (obrigatório se não for Correios)
          'email': order.buyers[0].main_email,
          'document': order.buyers[0].doc_number, // obrigatório se for transportadora e não for logística reversa
          // 'company_document': '89794131000100', // (opcional) (a menos que seja transportadora e logística reversa)
          // 'state_register': '123456', // (opcional) (a menos que seja transportadora e logística reversa)
          'address': order.shipping_lines[0].to.street,
          'complement': order.shipping_lines[0].to.complement,
          'number': order.shipping_lines[0].to.number,
          'district': order.shipping_lines[0].to.borough,
          'city': order.shipping_lines[0].to.city,
          'state_abbr': order.shipping_lines[0].to.province_code,
          'country_id': order.shipping_lines[0].to.country_code,
          'postal_code': order.shipping_lines[0].to.zip,
          'note': order.shipping_lines[0].to.near_to // (opcional) impresso na etiqueta
        }
      },
      products: (items) => {
        let products = {}
        items.forEach(element => {
          products = {
            'name': element.name, // nome do produto (max 255 caracteres)
            'quantity': element.quantity, // quantidade de items desse produto
            'unitary_value': element.price // R$ 4,50 valor do produto
          }
        }, products)
        return products
      },
      package: (packages) => {
        return {
          'weight': packages.weight,
          'width': packages.dimensions.width.value,
          'height': packages.dimensions.height.value,
          'length': packages.dimensions.length.value
        }
      },
      options: (order) => {
        return { // opções
          'insurance_value': order.shipping_lines[0].declared_value, // valor declarado/segurado
          'receipt': false, // aviso de recebimento
          'own_hand': false, // mão pŕopria
          'collect': false, // coleta
          'reverse': false, // logística reversa (se for reversa = true, ainda sim from será o remetente e to o destinatário)
          'non_commercial': false, // envio de objeto não comercializável (flexibiliza a necessidade de pessoas júridicas para envios com transportadoras como Latam Cargo, porém se for um envio comercializável a mercadoria pode ser confisca pelo fisco)
          'invoice': { // nota fiscal (opcional se for Correios)
            'number': order.shipping_lines[0].invoices[0].number, // número da nota
            'key': order.shipping_lines[0].invoices[0].access_key // chave da nf-e
          }
        }
      }
    }
  }

  requestOAuth(xstoreId) {
    return this.me.auth.getAuth() + '&state=' + xstoreId
  }

  setToken(token, xstoreId) {
    return this.me.auth.getToken(token)
      .then(retorno => {
        logger.log(retorno)
        let update = { me_refresh_token: retorno.refresh_token, me_access_token: retorno.access_token }
        let where = { store_id: xstoreId }
        sql.update(update, where, ENTITY).catch(erro => logger.error(new Error('Erro ao atualizar Refresh Token do melhor envio | Erro: '), erro))
      })
      .catch(e => {
        logger.error(new Error('Erro ao solicitar Token ao Melhor Envio. | Erro: '), e)
      })
  }

  meCalculateSchema(payload, hidden) {
    if (!payload.params || !payload.application.hidden_data) {
      return false
    }
    return {
      'from': {
        'postal_code': payload.application.hidden_data.from.zip,
        'address': payload.application.hidden_data.from.street,
        'number': payload.application.hidden_data.from.number
      },
      'to': {
        'postal_code': payload.params.to.zip,
        'address': payload.params.to.street,
        'number': payload.params.to.number
      },
      'products': this.meCalculateSchemaProducts(payload.params.items),
      'options': {
        'receipt': false,
        'own_hand': false,
        'collect': false
      }
    }
  }

  meCalculateSchemaProducts(itens) {
    let products = []
    products = itens.map(element => {
      let p = {
        id: element.product_id,
        weight: element.dimensions.weight,
        width: element.dimensions.width.value,
        height: element.dimensions.height.value,
        length: element.dimensions.length.value,
        insurance_value: element.final_price
      }
      return p
    })
    return products
  }

  ecpReponseSchema(payload, from, to, pkgRequest) {
    // logger.log(payload)
    if (typeof payload !== 'undefined') {
      let retorno = []
      retorno = payload.filter(service => {
        if (service.error) {
          return false
        }
        return true
      }).map(service => {
        if (!service.error) {
          return {
            label: service.name,
            carrier: service.company.name,
            service_name: service.name,
            service_code: service.id,
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
              discount: service.discount,
              posting_deadline: {
                days: service.delivery_time
              },
              delivery_time: {
                days: service.delivery_time
              },
              price: this.discount(pkgRequest, service),
              custom_fields: [
                {
                  field: 'by_melhor_envio',
                  value: 'true'
                },
                {
                  field: 'jadlog_agency',
                  value: 1
                }
              ]
            }
          }
        }
      })
      return retorno
    }
  }

  async calculate(payload, xstoreId) {
    return new Promise(async (resolve, reject) => {
      let meTokens = await this.getAppinfor(xstoreId)
      if (meTokens) {
        this.me.setToken = meTokens.me_access_token
        if (typeof payload.params.items === 'undefined') {
          if (typeof payload.application.hidden_data !== 'undefined' && typeof payload.application.hidden_data.shipping_discount !== 'undefined') {
            if (payload.application.hidden_data.shipping_discount[0].minimum_subtotal !== 'undefined') {
              resolve({ free_shipping_from_value: payload.application.hidden_data.shipping_discount[0].minimum_subtotal })
            }
          } else {
            resolve({ shipping_services: [] })
          }
        }
        let schema = this.meCalculateSchema(payload)
        if (!schema) {
          resolve({ shipping_services: [] })
          //reject(new Error('Formato inválido.'))
        }
        this.me.shipment.calculate(schema)
          .then(resp => resolve(JSON.stringify(this.ecpReponseSchema(resp, schema.from, schema.to, payload))))
          .catch(e => reject(new Error(e)))
      } else {
        reject(new Error('Não existe access_token vinculado ao x-store-id informado, realize outra autenticação.'))
      }
    })
  }

  async cart(payload, xstoreId) {
    return new Promise(async (resolve, reject) => {
      let order = await this.meCartSchema(payload, xstoreId)
      let meTokens = await this.getAppinfor(xstoreId)
      if (meTokens) {
        this.me.setToken = meTokens.me_access_token
        this.me.user.cart(order)
          .then(resp => {
            // logger.log(resp)
            this.registerLabel(resp, xstoreId, payload._id)
            this.me.shipment.checkout()
              .then(resp => {
                resolve(resp)
              })
              .catch(erro => reject(new Error('Erro ao processar checkout do carrinho de frete | Erro: ' + erro)))
          })
          .catch(erro => reject(new Error('Erro ao inserir cotação no carrinho de frete | Erro: ' + erro)))
      } else {
        reject(new Error('Não existe access_token vinculado ao x-store-id informado, realize outra autenticação.'))
      }
    })
  }

  async meCartSchema(payload, xstoreId) {
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

  async getSellerInfor(xstoreId) {
    let meTokens = await this.getAppinfor(xstoreId)
    this.me.setToken = meTokens.me_access_token
    return this.me.user.me().catch(e => logger.error(new Error('Não existe access_token vinculado ao x-store-id informado, realize outra autenticação.'), e))
  }

  async registerLabel(label, xstoreId, resourceId) {
    let params = {
      label_id: label.id,
      status: label.status,
      resource_id: resourceId,
      store_id: xstoreId
    }
    sql.insert(params, 'me_tracking')
      .then(r => {
        logger.log('Label Registrada.')
        let Ecomplus = require('./ecomplus')
        let controller = new Ecomplus()
        controller.updateMetafields(label, resourceId, xstoreId)
          .then(v => {
            logger.log('Hidden Metafields atualizado.')
            logger.log(v)
          })
          .catch(e => {
            logger.log(new Error('Erro: '), e)
          })
      })
      .catch(e => logger.log(e))
  }

  async getAppinfor(xstoreId) {
    return sql.select({ store_id: xstoreId }, ENTITY).catch(erro => logger.error(new Error('Erro buscar dados do aplicativo vinculado ao x-store-id informado. | Erro: '), erro))
  }

  async getAppHiddenData(app) {
    return new Promise((resolve, reject) => {
      let options = {
        uri: 'https://api.e-com.plus/v1/applications/' + app.application_id + '/hidden_data.json',
        headers: {
          'Content-Type': 'application/json',
          'X-Store-ID': app.store_id,
          'X-Access-Token': app.app_token,
          'X-My-ID': app.authentication_id
        }
      }
      rq.get(options, (erro, resp, body) => {
        if (resp.statusCode >= 400) {
          reject(resp.body)
        }
        resolve(body)
      })
    })
  }

  discount(payload, calculate) {
    logger.log(payload)
    logger.log(calculate)
    if (typeof payload.application.hidden_data !== 'undefined' && typeof payload.application.hidden_data.shipping_discount !== 'undefined') {
      if (payload.params.subtotal >= payload.application.hidden_data.shipping_discount[0].minimum_subtotal) {
        let states = payload.application.hidden_data.shipping_discount[0].states.find(state => {
          if (payload.params.to.zip >= state.from && state.to <= payload.params.to.zip) {
            return true
          }
          return false
        })
        if (states) {
          let total
          if (typeof payload.application.hidden_data.shipping_discount[0].fixed_value !== 'undefined') {
            total = calculate.price - payload.application.hidden_data.shipping_discount[0].fixed_value
          }
          if (typeof payload.application.hidden_data.shipping_discount[0].percent_value !== 'undefined') {
            total -= (total * payload.application.hidden_data.shipping_discount[0].percent_value)
          }
          return Math.sign(total) === 1 ? parseFloat(total) : 0
        }
      } else {
        return parseFloat(calculate.price)
      }
    } else {
      return parseFloat(calculate.price)
    }
  }

  async getLabel(xstoreId, id) {
    let meTokens = await this.getAppinfor(xstoreId)
    this.me.setToken = meTokens.me_access_token
    let ids = {
      orders: [id]
    }
    return this.me.shipment.tracking(ids)
  }

  updateTokens() {
    let query = 'SELECT me_refresh_token, me_access_token, store_id FROM ' + ENTITY
    sql.each(query, (err, row) => {
      if (!err) {
        try {
          this.me.setToken = row.me_access_token
          this.me.auth.refreshToken(row.me_refresh_token)
            .then(resp => {
              if (resp) {
                let data = {
                  me_access_token: resp.access_token,
                  me_refresh_token: resp.refresh_token
                }
                let where = { store_id: row.store_id }
                sql.update(data, where, ENTITY).catch(e => logger.error(new Error('Erro with melhor envio refresh token')))
              }
            })
        } catch (error) {
          logger.error(new Error('Erro with auth request.', error))
        }
      }
    })
  }
}

module.exports = MelhorEnvioApp
