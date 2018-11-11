const MelhorEnvioApp = require('./melhorenvio/melhorenvio')
const Authentication = require('./melhorenvio/authentication')
const EcomPlus = require('./melhorenvio/ecomplus')

// Rotas do app
let routes = {
  // Rotas para callback
  callback: { // ok
    // Post: Recebidos da ecp api
    post: (request, response) => {
      if (!request.body) {
        response.status(400)
        return response.send({ erro: 'empty body' })
      }
      let auth = new Authentication()
      if (!request.body.access_token) {
        // Se não houver acess_token
        // É registro de app
        auth.getAppInfor(request.body)
        response.end()
      } else {
        // Se houver são os dados de autorização da aplicação
        auth.setAppToken(request.body, request.headers['x-store-id'])
        response.end()
      }
    },
    // Get: Retorno do Oauth do melhor envio
    get: (request, response) => { // ok
      let meController = new MelhorEnvioApp()
      meController.setToken(request.query.code, request.query.state)
        .then(r => {
          routes.procedure.new(request, response)
        })
        .catch(e => {
          response.status(400)
          return response.send(e)
        })
    }
  },
  // Redirecionamentos
  redirect: { // ok
    // Redireciona para oauth do melhor envio
    melhorenvio: (request, response) => {
      let meController = new MelhorEnvioApp()
      let url = meController.requestOAuth() + '&state=' + request.query.x_store_id
      console.log(url)
      return response.redirect(301, url)
    }
  },
  // Procedures
  procedure: { // ok
    // Cria novo procedure e vinculando
    // ao determinado x-store-id enviado
    // no request.headers[]
    new: (request, response) => {
      if (!request.query.state) {
        response.status(400)
        return response.send('X-Store-id not sent.')
      }
      let eComController = new EcomPlus()
      eComController.registerProcedure(request.query.state)
        .then(r => {
          console.log('Procedure registrado. ', r)
          response.write('<script>window.close()</script>')
          response.end()
        })
        .catch(e => {
          console.log(e)
          response.status(400)
          return response.send(e)
        })
    },
    // Recebe atualizações sobre as orders
    // vinculadas ao x-store-id setado
    // anteriomente no procedure
    orders: (request, response) => {
      console.log(request.body)
      let resource
      if (request.method === 'POST') {
        resource = request.body.resource_id
      } else if (request.method === 'PATCH') {
        resource = request.body.inserted_id
      }
      let eComController = new EcomPlus()
      eComController.getNewOrder(request.body, resource, request.headers['x-store-id'])
    }
  },
  // Cotação de frete
  calculate: {
    post: (request, response) => { // ok
      let meController = new MelhorEnvioApp()
      meController.calculate(request.body, request.headers['x-store-id'])
        .then(resp => {
          response.status(200)
          return response.send(resp)
        })
        .catch(e => {
          console.log(e)
          response.status(400)
          return response.send(e)
        })
    }
  }
}

module.exports = routes
