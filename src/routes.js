const config = require('./config')
const dao = require('./service/sql')
const MelhorEnvio = require('melhor-envio')
const localStorage = require('localStorage')
const rq = require('request')

let routes = {
  callback: {
    post: (request, response) => {
      console.log(typeof request.body === 'undefined')
      if (!request.body) {
        response.status(400)
        return response.send({ erro: 'empty body' })
      }

      try {
        let requestBody = request.body
        if (!requestBody.access_token) {
          applicationCallback(request, response)
        } else {
          authenticationCallback(request, response)
        }
      } catch (e) {
        console.log(e)
        response.status(400)
        return response.send({ 'Erro: ': e })
      }
    },
    get: (request, response) => {

      let x_store_id = localStorage.getItem('x_store_id')
      
      if (!x_store_id) {
        response.status(400)
        return response.send('Erro: x_store_id not found.')
      }

      let code = query.code
      let me = new MelhorEnvio({
        client_id: config.ME_CLIENT_ID,
        client_secret: config.ME_CLIENT_SECRET,
        sandbox: config.ME_SANDBOX,
        redirect_uri: config.ME_REDIRECT_URI,
        request_scope: config.ME_SCOPE
      })
      me.auth.getAuth(code, (body, res, err) => {
        if (err) {
          response.status(400)
          return response.send(err)
        }
        dao.update({ me_refresh_token: body.refresh_token }, { store_id: x_store_id }, (res, err) => {
          if (err) {
            response.status(400)
            return response.send(err)
          }
          console.log(res)
          response.write('<script>window.close()</script>')
          return response.end()
        })
      })
    }
  },
  redirect: {
    melhorenvio: (request, response) => {
      if (!request.query.x_store_id) {
        response.status(400)
        return response.send('Erro: x_store_id not found.')
      }
      localStorage.setItem('x_store_id', request.query.x_store_id)
      let me = new MelhorEnvio({
        client_id: config.ME_CLIENT_ID,
        client_secret: config.ME_CLIENT_SECRET,
        sandbox: config.ME_SANDBOX,
        redirect_uri: config.ME_REDIRECT_URI,
        request_scope: config.ME_SCOPE
      })
      return response.redirect(301, me.auth.getToken())
    }
  },
  procedure: {
    new: (request, response) => {
      let params = {
        title: 'Melhor Envio Calculate',
        short_description: 'After receive order, reduce products available quantity to control stock',
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
          'X-Store-ID': x_store_id,
          'X-Access-Token': x_access_token,
          'X-My-ID': x_my_id
        },
        form: params,
        json: true
      }
      rq.post(options, (erro, res, body) => {
        if (erro) {
          response.status(400)
          return response.send('Failed E-com.plus API Request')
        }
        console.log(body)
      })
    },
    get: (request, response) => {

    }
  }
}

let applicationCallback = (request, response) => {
  let requestBody = request.body
  dao.select({ application_app_id: requestBody.application.app_id }, (ret) => {
    if (typeof ret === 'undefined') {
      let params = {
        application_id: requestBody.application._id,
        application_app_id: requestBody.application.app_id,
        application_title: requestBody.application.title,
        authentication_id: requestBody.authentication._id,
        authentication_permission: JSON.stringify(requestBody.authentication.permissions),
        store_id: requestBody.store_id
      }
      dao.insert(params, (res, e) => {
        if (e) {
          response.status(400)
          response.send({ 'Erro: ': e })
        }
        response.status(201)
        response.header('Content-Type', 'application/json')
        response.json({
          sucess: true,
          rows_inserted: res
        })
        requestAcessToken(requestBody.store_id, requestBody.authentication._id)
      })
    } else {
      let params = {
        application_id: requestBody.application._id ? requestBody.application._id : ret.application_id,
        application_app_id: requestBody.application.app_id ? requestBody.application.app_id : ret.application_app_id,
        application_title: requestBody.application.title ? requestBody.application.title : ret.application_title,
        authentication_id: requestBody.authentication._id ? requestBody.authentication._id : ret.authentication_id,
        authentication_permission: JSON.stringify(requestBody.authentication.permissions) ? JSON.stringify(requestBody.authentication.permissions) : ret.authentication_permission,
        store_id: requestBody.store_id ? requestBody.store_id : ret.store_id
      }

      dao.update(params, { application_app_id: requestBody.application.app_id }, (res, e) => {
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

let authenticationCallback = (request, response) => {
  let requestBody = request.body
  console.log(requestBody)
  let storeId = request.headers['x-store-id']
  dao.update({ ecom_at: requestBody.access_token }, { store_id: storeId, application_id: requestBody.my_id }, (res, e) => {
    if (e) {
      response.send({ 'Erro: ': e })
    }
    return response.end()
  })
}

let requestAcessToken = (xStore, aId) => {
  let options = {
    method: 'POST',
    uri: 'https://api.e-com.plus/v1/_callback.json',
    headers: {
      'Content-Type': 'application/json',
      'X-Store-ID': xStore
    },
    form: {
      _id: aId
    },
    json: true
  }
  rq.post(options)
}

module.exports = routes
