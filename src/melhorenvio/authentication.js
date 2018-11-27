const sql = require('./sql')
const rq = require('request')
const ENTITY = 'app_auth'

class Authentication {
  async getAppInfor (app) {
    console.log(app)
    let find = await sql.selectAll({ application_app_id: app.application.app_id }, ENTITY).catch(e => console.log(e))
    let params = {
      application_id: app.application._id,
      application_app_id: app.application.app_id,
      application_title: app.application.title,
      authentication_id: app.authentication._id,
      authentication_permission: JSON.stringify(app.authentication.permissions),
      store_id: app.store_id
    }
    if (!find) {
      sql.insert(params, ENTITY).then(r => {
        console.log('Insert App info')
        this.getAppToken(app)
      }).catch(e => console.log(e))
    } else {
      console.log('Update App Info')
      let where = { application_app_id: app.application.app_id }
      sql.update(params, where, ENTITY).then(r => {
        this.getAppToken(app)
      }).catch(e => console.log(e))
    }
  }

  async getAppToken (app) {
    return rq.post({
      method: 'POST',
      uri: 'https://api.e-com.plus/v1/_callback.json',
      headers: {
        'Content-Type': 'application/json',
        'X-Store-ID': app.store_id
      },
      body: { '_id': app.authentication._id },
      json: true
    })
  }

  async setAppToken (app, xstoreid) {
    console.log(app)
    console.log(xstoreid)
    try {
      sql.update({ app_token: app.access_token }, { store_id: xstoreid, authentication_id: app.my_id }, ENTITY).then(r => {
        console.log('Update Token')
      }).catch(e => console.log(e))
    } catch (e) {
      return console.log(e)
    }
  }

  async updateRefreshToken () {
    let query = 'SELECT authentication_id, store_id FROM ' + ENTITY + ' WHERE updated_at < datetime("now", "-8 hours")'
    sql.each(query, (err, row) => {
      console.log(row)
      if (!err) {
        try {
          let app = {
            authentication: {
              id: row.authentication_id
            },
            store_id: row.store_id
          }
          this.getAppToken(app)
        } catch (error) {
          console.log(new Error('Erro with auth request.', error))
        }
      }
    })
  }
}

module.exports = Authentication