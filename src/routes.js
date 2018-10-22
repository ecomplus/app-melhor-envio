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
      me.auth.getAuth(request.query.code, (body, res, err) => {
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
      let url = me.auth.getToken()
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
            method: 'POST',
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
                uri: 'https://ecomplus-melhor-envio.herokuapp.com/procedure'
              }
            },
            method: 'POST',
            send_body: true
          }
        ],
        tag: 'new_order'
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
    get: (request, response) => {
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
              return response.json(erro)
            }

            dao.update({ me_refresh_token: respBody.refresh_token }, { store_id: request.headers['x-store-id'] })
            me.setToken = respBody.access_token
            me.shipment.calculate(shipmentBody, (respBody, resp, erro) => {
              if (erro) {
                response.status(400)
                return response.json(erro)
              }
              return response.json(respBody)
            })
          })
        })
      } catch (error) {
        response.status(400)
        return response.json(error)
      }
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

module.exports = routes
