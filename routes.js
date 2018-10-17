const dao = require('./service/sql')
const MelhorEnvio = require('melhor-envio')
const localStorage = require('localStorage')

let routes = {
  postCallback: (request, response) => {
    try {
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
    } catch (e) {
      console.log(e)
      response.status(400)
      return response.send({ 'Erro: ': e })
    }
  },
  getCallback: (request, response) => {

    let x_store_id = localStorage.getItem('x_store_id')

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
  },
  redirect: (request, response) => {
    let query = request.query

    let me = new MelhorEnvio({
      client_id: 31,
      client_secret: 'KYaPyv6odJuPvSbBg8TdIg4EErK4gWNDD5rE8oqU',
      sandbox: true,
      redirect_uri: 'https://ecomplus-melhor-envio.herokuapp.com/callback',
      request_scope: 'cart-read'
    })

    localStorage.setItem('x_store_id', query.x_store_id)
    return response.redirect(301, me.auth.getToken())
  },
  procedure: (request, response) => {
    
  }
}

module.exports = routes
