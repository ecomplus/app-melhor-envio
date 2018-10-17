const dao = require('./service/sql')
const MelhorEnvio = require('melhor-envio')
const localStorage = require('localStorage')
const rq = require('request')
let routes = {
  callback: {
    post: (request, response) => {
      try {
        let requestBody = request.body
        switch (requestBody) {
          case requestBody.application.app_id:
            applicationCallback(request, response)
            break
          case requestBody.access_token:
            authenticationCallback(request, response)
            break
          default: break
        }
      } catch (e) {
        console.log(e)
        response.status(400)
        return response.send({ 'Erro: ': e })
      }
    },
    get: (request, response) => {
      const x_store_id = localStorage.getItem('x_store_id')

      if (!x_store_id) {
        response.status(400)
        return response.send('Erro: x_store_id not found.')
      }
      let query = request.query
      let code = query.code
      let me = new MelhorEnvio({
        client_id: 31,
        client_secret: 'KYaPyv6odJuPvSbBg8TdIg4EErK4gWNDD5rE8oqU',
        sandbox: true,
        redirect_uri: 'https://ecomplus-melhor-envio.herokuapp.com/callback',
        request_scope: 'cart-read'
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
      console.log(Buffer.from(request.query.data, 'base64').toString('ascii'))
      let query = Buffer.from(request.query.data, 'base64').toString('ascii')
      //query = JSON.parse()
      console.log(query)
      let me = new MelhorEnvio({
        client_id: 31,
        client_secret: 'KYaPyv6odJuPvSbBg8TdIg4EErK4gWNDD5rE8oqU',
        sandbox: true,
        redirect_uri: 'https://ecomplus-melhor-envio.herokuapp.com/callback',
        request_scope: 'cart-read'
      })

      localStorage.setItem('x_store_id', query.x_store_id)
      localStorage.setItem('x_access_token', query.x_token)
      localStorage.setItem('x_my_id', query.my_id)

      return response.redirect(301, me.auth.getToken())
    }
  },
  procedure: {
    new: (request, response) => {
      const x_store_id = localStorage.getItem('x_store_id')
      const x_access_token = localStorage.getItem('x_access_token')
      const x_my_id = localStorage.getItem('x_my_id')
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

      if (typeof x_store_id === 'undefined' && typeof x_access_token === 'undefined' && typeof x_my_id === 'undefined') {
        response.status(400)
        return response.send('Erro: x_store_id or x_access_token or x_my_id not found.')
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
  let storeId = request.headers['X-Store-ID']
  dao.update({ ecom_at: requestBody.access_token }, { store_id: storeId }, (res, e) => {
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
