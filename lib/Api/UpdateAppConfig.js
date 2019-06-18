'use strict'
module.exports = (db) => {
  return (accessToken, refreshToken, storeId) => {
    return new Promise((resolve, reject) => {
      let query = `UPDATE melhorenvio_app_auth
                SET access_token = ? , refresh_token = ?
                WHERE store_id = ?`
      db.run(query, [accessToken, refreshToken, storeId], (err) => {
        if (err) {
          reject(err)
        }
        resolve()
      })
    })
  }
}
