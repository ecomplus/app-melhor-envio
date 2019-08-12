'use strict'
module.exports = (db) => {
  return () => {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM melhorenvio_app_tracking WHERE status = ? OR status = ? OR status = ? OR status = ? ORDER BY store_id`
      db.all(query, ['pending', 'released', 'delivered', 'undelivered'], (err, row) => {
        if (err) {
          reject(err)
        } else if (row) {
          // found with success
          // resolve the promise returning respective store and order IDs
          resolve(row)
        } else {
          let err = new Error('No label')
          reject(err)
        }
      })
    })
  }
}
