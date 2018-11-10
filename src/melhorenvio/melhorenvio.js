const config = require('./../config')
const sql = require('./sql')
const MelhorEnvioSDK = require('melhor-envio')
const ENTITY = 'app_auth'

class MelhorEnvioApp {
  constructor () {
    this.me = new MelhorEnvioSDK({
      client_id: config.ME_CLIENT_ID,
      client_secret: config.ME_CLIENT_SECRET,
      sandbox: config.ME_SANDBOX,
      redirect_uri: config.ME_REDIRECT_URI,
      request_scope: config.ME_SCOPE
    })

    this.parseOrder = {
      from: async (xstoreId) => {
        let seller = await this.getSellerInfor(xstoreId).catch(e => console.log(new Error('Seller não encontrado.')))
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
          'state_abbr': seller.address.state.state_abbr,
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
      products: (order) => {
        let products = {}
        order.forEach(element => {
          products = {
            'name': element.items.name, // nome do produto (max 255 caracteres)
            'quantity': element.items.quantity, // quantidade de items desse produto
            'unitary_value': element.items.price // R$ 4,50 valor do produto
          }
        }, products)
        return products
      },
      package: (order) => {
        return {
          'weight': order.shipping_lines[0].package.weight,
          'width': order.shipping_lines[0].package.dimensions.width.value,
          'height': order.shipping_lines[0].package.dimensions.height.value,
          'length': order.shipping_lines[0].package.dimensions.length.value
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
            'number': '12345', // número da nota
            'key': 'nf-e' // chave da nf-e
          }
        }
      }
    }
  }

  requestOAuth (xstoreId) {
    return this.me.auth.getAuth() + '&state=' + xstoreId
  }

  setToken (token, xstoreId) {
    return this.me.auth.getToken(token)
      .then(retorno => {
        console.log(retorno)
        let update = { me_refresh_token: retorno.refresh_token }
        let where = { store_id: xstoreId }
        sql.update(update, where, ENTITY).catch(erro => console.log(new Error('Erro ao atualizar Refresh Token do melhor envio | Erro: '), erro))
      })
      .catch(e => {
        console.log(new Error('Erro ao solicitar Token ao Melhor Envio. | Erro: '), e)
      })
  }

  async calculate (payload, xstoreId) {
    let app = await sql.select({ store_id: xstoreId }, ENTITY).catch(erro => console.log(new Error('Erro buscar dados do aplicativo vinculado ao x-store-id informado. | Erro: '), erro))
    if (app) {
      return new Promise(async (resolve, reject) => {
        let meTokens = await this.me.auth.refreshToken(app.me_refresh_token).catch(e => reject(new Error(e)))
        if (meTokens) {
          let update = { me_refresh_token: meTokens.refresh_token }
          let where = { store_id: xstoreId }
          sql.update(update, where, ENTITY).catch(erro => console.log(new Error('Erro ao atualizar Refresh Token do melhor envio | Erro: '), erro))

          this.me.setToken = meTokens.access_token

          let schema = this.meCalculateSchema(payload)
          if (!schema) {
            reject(new Error('Formato inválido.'))
          }

          this.me.shipment.calculate(schema)
            .then(resp => resolve(JSON.stringify(this.ecpReponseSchema(resp, schema.from, schema.to))))
            .catch(e => reject(new Error(e)))
        }
      })
    }
  }

  meCalculateSchema (payload) {
    if (!payload.params) {
      return false
    }
    return {
      'from': {
        'postal_code': payload.params.from.zip,
        'address': payload.params.from.street,
        'number': payload.params.from.number
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

  meCalculateSchemaProducts (itens) {
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

  ecpReponseSchema (payload, from, to) {
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
                weight: service.packages[0].weight
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
            price: parseFloat(service.price),
            discount: service.discount,
            posting_deadline: {
              days: service.delivery_time
            },
            delivery_time: {
              days: service.delivery_time
            },
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
      })
      return retorno
    }
  }

  async cart (payload, xstoreId) {
    let app = await sql.select({ store_id: xstoreId }).catch(erro => console.log(new Error('Erro buscar dados do aplicativo vinculado ao x-store-id informado. | Erro: '), erro))
    if (app) {
      let meTokens = this.me.auth.refreshToken().catch(e => console.log(new Error(e)))
      this.me.setToken = meTokens.access_token

      let update = { me_refresh_token: meTokens.refresh_token }
      let where = { store_id: xstoreId }
      sql.update(update, where, ENTITY).catch(erro => console.log(new Error('Erro ao atualizar Refresh Token do melhor envio | Erro: '), erro))
    }

    let order = this.meCartSchema(payload)

    this.me.user.cart(order)
      .then(resp => {
        this.me.shipment.checkout()
          .then(resp => {
            return resp.purchase
          })
          .catch(erro => console.log(new Error('Erro ao processar checkout do carrinho de frete | Erro: '), erro))
      })
      .catch(erro => console.log(new Error('Erro ao inserir cotação no carrinho de frete | Erro: '), erro))
  }

  meCartSchema (payload, order, service, agency) {
    return {
      'service': service,
      'agency': agency,
      'from': this.parseOrder.from(payload),
      'to': this.parseOrder.to(order),
      'products': [this.parseOrder.products(order)],
      'package': this.parseOrder.package(order),
      'options': this.parseOrder.options(order)
    }
  }

  async getSellerInfor (xstoreId) {
    let app = await sql.select({ store_id: xstoreId }).catch(e => console.log(new Error('Erro ao buscar seller | Error: '), e))
    let meTokens = await this.me.auth.refreshToken(app.me_refresh_token).catch(e => console.log(new Error(e)))
    let update = { me_refresh_token: meTokens.refresh_token }
    let where = { store_id: xstoreId }
    sql.update(update, where, ENTITY).catch(erro => console.log(new Error('Erro ao atualizar Refresh Token do melhor envio | Erro: '), erro))
    this.me.setToken = meTokens.access_token
    return this.me.user.me().catch(e => console.log(new Error('Erro ao buscar seller | Error: '), e))
  }
}

module.exports = MelhorEnvioApp
