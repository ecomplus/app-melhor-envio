const config = require('./config')
const dao = require('./service/sql')
const MelhorEnvio = require('melhor-envio')
const rq = require('request')

// Instância do melhor envio
const me = new MelhorEnvio({
  client_id: config.ME_CLIENT_ID,
  client_secret: config.ME_CLIENT_SECRET,
  sandbox: config.ME_SANDBOX,
  redirect_uri: config.ME_REDIRECT_URI,
  request_scope: config.ME_SCOPE
})

// Rotas do app
let routes = {
  // Rotas para callback
  callback: {
    // Post: Recebidos da ecp api
    post: (request, response) => {
      if (!request.body) {
        response.status(400)
        return response.send({ erro: 'empty body' })
      }
      try {
        if (!request.body.access_token) {
          // Se não houver acess_token
          // É registro de app
          ecomAppCallback(request, response)
        } else {
          // Se houver são os dados de autorização da aplicação
          ecomSaveAppToken(request, response)
        }
      } catch (e) {
        console.log(e)
        response.status(400)
        return response.send({ 'Erro: ': e })
      }
    },
    // Get: Retorno do Oauth do melhor envio
    get: (request, response) => {
      // Recebe codigo de autorização e solicita token bearer
      me.auth.getToken(request.query.code, (body, res, err) => {
        if (err) {
          response.status(400)
          return response.send(err)
        }
        // Insere save refresh token
        dao.update({ me_refresh_token: body.refresh_token }, { store_id: request.body.state }, (res, err) => {
          if (err) {
            response.status(400)
            return response.send(err)
          }
          // tudo ok fecha a popup
          response.write('<script>window.close()</script>')
          return response.end()
        })
      })
    }
  },
  // Redirecionamentos
  redirect: {
    // Redireciona para oauth do melhor envio
    melhorenvio: (request, response) => {
      me.setState = request.headers['X-Store-Id']
      let url = me.auth.getAuth()
      return response.redirect(301, url)
    }
  },
  // Procedures
  procedure: {
    // Cria novo procedure e vinculando
    // ao determinado x-store-id enviado
    // no request.headers[]
    new: (request, response) => {
      if (!request.headers['X-Store-ID']) {
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
          'X-Store-ID': request.headers['X-Store-ID'],
          'X-Access-Token': request.body.access_token,
          'X-My-ID': request.body.my_id
        },
        body: params,
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
    // Recebe atualizações sobre as orders
    // vinculadas ao x-store-id setado
    // anteriomente no procedure
    orders: (request, response) => {
      orders(request, response)
    }
  },
  // Cotação de frete
  calculate: {
    post: (request, response) => {
      try {
        // Busca refresh token do melhor envio
        dao.select({ store_id: request.headers['x-store-id'] }, (retorno) => {
          if (typeof retorno === 'undefined') {
            response.status(400)
            return response.send('Token not found')
          }
          // atualiza o token
          me.auth.refreshToken(retorno.me_refresh_token, (respBody, resp, erro) => {
            if (erro) {
              response.status(400)
              return response.send(erro)
            }
            // salva novo refresh token
            dao.update({ me_refresh_token: respBody.refresh_token }, { store_id: request.headers['x-store-id'] })
            // seta bearer na instancia da classe
            me.setToken = respBody.access_token
            // Calcula o frete
            me.shipment.calculate(request.body, (respBody, resp, erro) => {
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
  }
}

// Parse das Orders para geração compra das etiquetas
let parseOrder = {
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

// Callback enviado pela api da ecp informando
// que o app foi registrado para determinado x-store-id
let ecomAppCallback = (request, response) => {
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
        return ecomGetAppToken(request.body.store_id, request.body.authentication._id)
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

// Solicita token do app na api da ecp
let ecomGetAppToken = (xStore, aId) => {
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

// Salva toke do app recebido da ecp
let ecomSaveAppToken = (request, response) => {
  console.log(request.body)
  dao.update({ ecom_at: request.body.access_token }, { store_id: request.headers['x-store-id'], application_id: request.body.my_id }, (res, e) => {
    if (e) {
      response.send({ 'Erro: ': e })
    }
    return response.end()
  })

  routes.procedure.new(request, response)
}

// Recebe post após qualquer alteração na order
let orders = (request, response) => {
  if (!request.body) {
  }

  try {
    dao.select({ store_id: request.headers['x-store-id'] }, (retorno) => {
      let options = {
        method: 'GET',
        uri: 'https://api.e-com.plus/v1/orders/' + request.body.resource_id + '.json',
        headers: {
          'Content-Type': 'application/json',
          'X-Store-ID': request.headers['x-store-id'],
          'X-Access-Token': retorno.ecom_at,
          'X-My-ID': retorno.authentication_id
        }
      }
      rq.get(options, (erro, res) => {
        if (erro) {
          response.status(400)
          return response.send('Failed E-com.plus API Request')
        }

        if (res.statusCode > 400) {
          response.status(400)
          return response.send(res.body)
        }

        if (typeof res.fulfillment_status !== 'undefined') {
          if (res.fulfillment_status.current === 'ready_for_shipping') {
            if (typeof res.shipping_lines[0].app !== 'undefined' && res.shipping_lines[0].app.service_code === '3') {
              if (res.shipping_lines[0].invoices[0].issuer_doc_number !== 'undefined') {
                cart(request, response)
              } else {
                return response.end()
              }
            } else {
              cart(request, response)
            }
          }
        }
        return response.end()
      })
    })
  } catch (error) {
    response.status(400)
    return response.send('Authorization not found.')
  }
}

// Gera carrinho e compra etiquetas no melhor envio
let cart = (request, response) => {
  try {
    dao.select({ store_id: request.headers['x-store-id'] }, (retorno) => {
      if (typeof retorno === 'undefined') {
        response.status(400)
        return response.send('Token not found')
      }
      // Atualiza Token melhor envio
      me.auth.refreshToken(retorno.me_refresh_token, (respBody, resp, erro) => {
        if (erro) {
          response.status(400)
          return response.send(erro)
        }
        // Salva novo refresh_token
        dao.update({ me_refresh_token: respBody.refresh_token }, { store_id: request.headers['x-store-id'] })
        // seta no token que não foi informado no construtor na instância da classe
        me.setToken = respBody.access_token
        // Faz parse da ordem recebida no body para o schema do melhor envio para inserir no carrinho
        let order = toMeSchema(request.body)
        // Insiro a Ordem no carrinho
        me.user.cart(order, (respBody, resp, erro) => {
          if (erro) {
            response.status(400)
            return response.send(erro)
          }
          // Se houver id na resposta o carrinho foi gerado
          if (respBody.id) {
            me.shipment.checkout((body, res, err) => {
              if (err) {
                response.status(400)
                return response.send(err)
              }
              // se houver atributo purchase na resposta a compra das etiquetas
              // a compra das etiquetas foi realiza com sucesso utilizando
              // saldo disponível na carteira do usuário no melhor envio.
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

// Parse da order para schema do melhor envio
let toMeSchema = (order, seller, service, agency) => {
  return {
    'service': service,
    'agency': agency,
    'from': parseOrder.from(seller),
    'to': parseOrder.to(order),
    'products': [parseOrder.products(order)],
    'package': parseOrder.package(order),
    'options': parseOrder.options(order)
  }
}

module.exports = routes
