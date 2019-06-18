'use strict'
module.exports = (db) => {
  return (storeId) => {
    return new Promise((resolve, reject) => {
      let query = `SELECT access_token, refresh_token, store_id, default_data FROM melhorenvio_app_auth WHERE store_id = ?`
      db.get(query, [storeId], (err, row) => {
        if (err) {
          reject(err)
        }
        resolve(row)
      })
    })
  }
}
