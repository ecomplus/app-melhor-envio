const config = require('./config')
const dao = require('./service/sql')
const MelhorEnvio = require('melhor-envio')
const rq = require('request')

let routes = {
  callback: {
    post: (request, response) => {
      if (!request.body) {
        response.status(400)
        return response.send({ erro: 'empty body' })
      }

      try {
        let requestBody = request.body
        if (!requestBody.access_token) {
          applicationCallback(request, response)
        } else {
          setEcomApiToken(request, response)
        }
      } catch (e) {
        console.log(e)
        response.status(400)
        return response.send({ 'Erro: ': e })
      }
    },
    get: (request, response) => {
      let me = new MelhorEnvio({
        client_id: config.ME_CLIENT_ID,
        client_secret: config.ME_CLIENT_SECRET,
        sandbox: config.ME_SANDBOX,
        redirect_uri: config.ME_REDIRECT_URI,
        request_scope: config.ME_SCOPE
      })

      me.auth.getToken(request.query.code, (body, res, err) => {
        if (err) {
          response.status(400)
          return response.send(err)
        }
        dao.update({ me_refresh_token: body.refresh_token }, { store_id: request.body.state }, (res, err) => {
          if (err) {
            response.status(400)
            return response.send(err)
          }
          response.write('<script>window.close()</script>')
          return response.end()
        })
      })
    }
  },
  redirect: {
    melhorenvio: (request, response) => {
      let me = new MelhorEnvio({
        client_id: config.ME_CLIENT_ID,
        client_secret: config.ME_CLIENT_SECRET,
        sandbox: config.ME_SANDBOX,
        redirect_uri: config.ME_REDIRECT_URI,
        request_scope: config.ME_SCOPE,
        state: request.query.x_store_id
      })
      let url = me.auth.getAuth()
      return response.redirect(301, url)
    }
  },
  procedure: {
    new: (request, response) => {
      let xStoreId = request.headers['X-Store-ID']
      if (!xStoreId) {
        response.status(400)
        return response.send('X-Store-id not sent.')
      }

      let params = {
        title: 'Melhor Envio Shipment Update',
        short_description: 'After received order, update melhor envio cart.',
        triggers: [
          {
            resource: 'orders'
          }
        ],
        conditionals: [
          {
            field: 'status',
            operator: 'str_not_equal',
            str_value: 'cancelled'
          }
        ],
        webhooks: [
          {
            api: {
              external_api: {
                uri: 'https://ecomplus-melhor-envio.herokuapp.com/procedure/orders'
              }
            },
            method: 'POST',
            send_body: true
          }
        ],
        tag: 'melhor_envio_orders'
      }

      let options = {
        method: 'POST',
        uri: 'https://sandbox.e-com.plus/v1/procedures.json',
        headers: {
          'Content-Type': 'application/json',
          'X-Store-ID': xStoreId,
          'X-Access-Token': request.body.access_token,
          'X-My-ID': request.body.my_id
        },
        form: params,
        json: true
      }
      rq.post(options, (erro) => {
        if (erro) {
          response.status(400)
          return response.send('Failed E-com.plus API Request')
        }
        return response.end()
      })
    },
    orders: (request, response) => {
      orders()
    }
  },
  calculate: {
    post: (request, response) => {
      let shipmentBody = request.body

      let me = new MelhorEnvio({
        client_id: config.ME_CLIENT_ID,
        client_secret: config.ME_CLIENT_SECRET,
        sandbox: config.ME_SANDBOX,
        redirect_uri: config.ME_REDIRECT_URI,
        request_scope: config.ME_SCOPE
      })

      try {
        dao.select({ store_id: request.headers['x-store-id'] }, (ret) => {
          if (typeof ret === 'undefined') {
            response.status(400)
            return response.send('Token not found')
          }

          me.auth.refreshToken(ret.me_refresh_token, (respBody, resp, erro) => {
            if (erro) {
              response.status(400)
              return response.send(erro)
            }

            dao.update({ me_refresh_token: respBody.refresh_token }, { store_id: request.headers['x-store-id'] })
            me.setToken = respBody.access_token
            me.shipment.calculate(shipmentBody, (respBody, resp, erro) => {
              console.log(resp)
              if (erro) {
                response.status(400)
                return response.send(erro)
              }
              return response.send(JSON.stringify(respBody))
            })
          })
        })
      } catch (error) {
        response.status(400)
        return response.send(error)
      }
    }
  },
  cart: {
    post: (request, response) => {
      cart(request, response)
    }
  }
}

let applicationCallback = (request, response) => {
  dao.select({ application_app_id: request.body.application.app_id }, (ret) => {
    if (typeof ret === 'undefined') {
      let params = {
        application_id: request.body.application._id,
        application_app_id: request.body.application.app_id,
        application_title: request.body.application.title,
        authentication_id: request.body.authentication._id,
        authentication_permission: JSON.stringify(request.body.authentication.permissions),
        store_id: request.body.store_id
      }
      dao.insert(params, (res, e) => {
        if (e) {
          response.status(400)
          return response.send({ 'Erro: ': e })
        }
        response.status(201)
        response.header('Content-Type', 'application/json')
        response.json({
          sucess: true,
          rows_inserted: res
        })
        return getEcomApiToken(request.body.store_id, request.body.authentication._id)
      })
    } else {
      let params = {
        application_id: request.body.application._id ? request.body.application._id : ret.application_id,
        application_app_id: request.body.application.app_id ? request.body.application.app_id : ret.application_app_id,
        application_title: request.body.application.title ? request.body.application.title : ret.application_title,
        authentication_id: request.body.authentication._id ? request.body.authentication._id : ret.authentication_id,
        authentication_permission: JSON.stringify(request.body.authentication.permissions) ? JSON.stringify(request.body.authentication.permissions) : ret.authentication_permission,
        store_id: request.body.store_id ? request.body.store_id : ret.store_id
      }

      dao.update(params, { application_app_id: request.body.application.app_id }, (res, e) => {
        if (e) {
          response.send({ 'Erro: ': e })
        }
        response.status(200)
        response.header('Content-Type', 'application/json')
        response.json({
          sucess: true,
          rows_updated: res
        })
      })
    }
  })
}

let setEcomApiToken = (request, response) => {
  dao.update({ ecom_at: request.body.access_token }, { store_id: request.headers['x-store-id'], application_id: request.body.my_id }, (res, e) => {
    if (e) {
      response.send({ 'Erro: ': e })
    }
    return response.end()
  })

  routes.procedure.new(request, response)
}

let getEcomApiToken = (xStore, aId) => {
  return rq.post({
    method: 'POST',
    uri: 'https://api.e-com.plus/v1/_callback.json',
    headers: {
      'Content-Type': 'application/json',
      'X-Store-ID': xStore
    },
    body: { '_id': aId },
    json: true
  })
}

let orders = (request, response) => {
  if (!request.body) {
  }

  dao.select({ store_id: request.headers['x-store-id'] }, (ret) => {
    let orderId = request.body.resource_id
    let options = {
      method: 'GET',
      uri: 'https://api.e-com.plus/v1/orders/' + orderId + '.json',
      headers: {
        'Content-Type': 'application/json',
        'X-Store-ID': request.headers['x-store-id'],
        'X-Access-Token': ret.ecom_at,
        'X-My-ID': ret.authentication_id
      }
    }
    rq.get(options, (erro, res) => {
      if (erro) {
        response.status(400)
        return response.send('Failed E-com.plus API Request')
      }
      let order = res
      if (order.fulfillment_status) {
        switch (order.fulfillment_status.current) {
          case 'ready_for_shipping':
            cart(request, response)
            break

          default:
            break
        }
      }
      return response.end()
    })
  })
}

let cart = (request, response) => {
  let shipmentBody = request.body

  let me = new MelhorEnvio({
    client_id: config.ME_CLIENT_ID,
    client_secret: config.ME_CLIENT_SECRET,
    sandbox: config.ME_SANDBOX,
    redirect_uri: config.ME_REDIRECT_URI,
    request_scope: config.ME_SCOPE
  })

  try {
    dao.select({ store_id: request.headers['x-store-id'] }, (ret) => {
      if (typeof ret === 'undefined') {
        response.status(400)
        return response.send('Token not found')
      }
      me.auth.refreshToken(ret.me_refresh_token, (respBody, resp, erro) => {
        if (erro) {
          response.status(400)
          return response.send(erro)
        }
        dao.update({ me_refresh_token: respBody.refresh_token }, { store_id: request.headers['x-store-id'] })

        me.setToken = respBody.access_token
        me.user.cart(shipmentBody, (respBody, resp, erro) => {
          if (erro) {
            response.status(400)
            return response.send(erro)
          }

          if (respBody.id) {
            let cart = respBody._id
            me.shipment.checkout(cart, (body, res, err) => {
              if (err) {
                response.status(400)
                return response.send(err)
              }

              if (body.purchase) {
                return response.send(body)
              }
            })
          }
        })
      })
    })
  } catch (error) {
    response.status(400)
    return response.send(error)
  }
}

let updateOrderStatus = (request, response) => {
}

let melhorEnvioCardSchema = (order, seller, service, agency) => {
  let schema = {
    'service': service,
    'agency': agency,
    'from': {
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
    },
    'to': { // destinatário
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
    },
    'products': [ // lista de produtos para preenchimento da declaração de conteúdo
      {
        'name': order.items.name, // nome do produto (max 255 caracteres)
        'quantity': order.items.quantity, // quantidade de items desse produto
        'unitary_value': order.items.price // R$ 4,50 valor do produto
      }
    ],
    'package': { // informações do pacote (volume) - ainda não é possível cadastrar volumes
      'weight': order.shipping_lines[0].package.weight,
      'width': order.shipping_lines[0].package.dimensions.width.value,
      'height': order.shipping_lines[0].package.dimensions.height.value,
      'length': order.shipping_lines[0].package.dimensions.length.value
    },
    'options': { // opções
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

let order = {
  from: (seller) => {
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
    products = {
      'name': order.items.name, // nome do produto (max 255 caracteres)
      'quantity': order.items.quantity, // quantidade de items desse produto
      'unitary_value': order.items.price // R$ 4,50 valor do produto
    }
  },
  package: (order) => {

  },
  options: (order) => {
  }
}

module.exports = routes
