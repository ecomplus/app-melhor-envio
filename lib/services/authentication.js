const sql = require('./sql')
const rq = require('request')
const ENTITY = 'app_auth'
const logger = require('console-files')

const getAppInfor = async (app, sotreId) => {
  let find = await sql.select({ application_app_id: app.application.app_id }, ENTITY).catch(e => logger.log(e))
  let params = {
    application_id: app.application._id,
    application_app_id: app.application.app_id,
    application_title: app.application.title,
    authentication_id: app.authentication._id,
    authentication_permission: JSON.stringify(app.authentication.permissions),
    store_id: sotreId
  }
  if (!find) {
    sql.insert(params, ENTITY).then(r => {
      getAppToken(app)
    }).catch(e => logger.log(e))
  } else {
    let where = { application_app_id: app.application.app_id }
    sql.update(params, where, ENTITY).then(r => {
      getAppToken(app)
    }).catch(e => logger.log(e))
  }
}

const getAppToken = (app, storeId) => {
  return rq.post({
    method: 'POST',
    uri: 'https://api.e-com.plus/v1/_callback.json',
    headers: {
      'Content-Type': 'application/json',
      'X-Store-ID': storeId
    },
    body: { '_id': app.authentication._id },
    json: true
  })
}

const setAppToken = (app, storeId) => {
  try {
    sql.update({ app_token: app.access_token }, { store_id: storeId, authentication_id: app.my_id }, ENTITY).then(r => {
      logger.log('Update Token')
    }).catch(e => logger.log(e))
  } catch (e) {
    return logger.log(e)
  }
}

const updateRefreshToken = () => {
  let query = 'SELECT authentication_id, store_id FROM ' + ENTITY + ' WHERE updated_at < datetime("now", "-8 hours")'
  let i = 0
  sql.each(query, (err, row) => {
    i++
    setTimeout(async () => {
      if (!err) {
        try {
          let app = {
            authentication: {
              id: row.authentication_id
            },
            store_id: row.store_id
          }
          getAppToken(app, row.store_id)
        } catch (error) {
          logger.log(new Error('Erro with auth request.', error))
        }
      }
    }, 1000 * i)
  })
}

const setAppAuthentication = (request, response) => {
  if (!request.body.access_token) {
    // Se não houver access_token
    // É registro de app
    getAppInfor(request.body, request.headers['x-store-id'])
    response.end()
  } else {
    // Se houver são os dados de autorização da aplicação
    setAppToken(request.body, request.headers['x-store-id'])
    response.end()
  }
}

module.exports = {
  setAppAuthentication,
  setAppToken,
  getAppInfor,
  getAppToken,
  updateRefreshToken
}
