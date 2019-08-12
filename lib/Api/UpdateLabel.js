'use strict'
module.exports = (db) => {
  return (status, labelId) => {
    return new Promise((resolve, reject) => {
      let query = `UPDATE melhorenvio_app_tracking
                SET status = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE label_id = ?`
      db.run(query, [status, labelId], (err) => {
        if (err) {
          reject(err)
        }
        resolve()
      })
    })
  }
}
