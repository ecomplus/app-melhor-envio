'use strict'
module.exports = (db) => {
  return (labelId, labelStatus, resourceId, storeId) => {
    return new Promise((resolve, reject) => {
      let query = `INSERT INTO melhorenvio_app_tracking 
      (label_id, status, resource_id, store_id) 
      VALUES(?, ?, ?, ?)`
      db.run(query, [labelId, labelStatus, resourceId, storeId], (err) => {
        if (err) {
          reject(err)
        }
        resolve()
      })
    })
  }
}
