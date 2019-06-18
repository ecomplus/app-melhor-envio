'use strict'
module.exports = (db) => {
  return (accessToken, refreshToken, storeId, defaultData) => {
    return new Promise((resolve, reject) => {
      let query = `INSERT INTO melhorenvio_app_auth 
      (access_token, refresh_token, store_id, default_data) 
      VALUES(?, ?, ?, ?)`
      db.run(query, [accessToken, refreshToken, storeId, defaultData], (err) => {
        if (err) {
          reject(err)
        }
        resolve()
      })
    })
  }
}
