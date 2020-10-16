const logger = require('console-files')
const sqlite = require('sqlite3').verbose()
// create necessary tables
const dbFilename = process.env.ECOM_AUTH_DB || './db.sqlite'
const db = new sqlite.Database(dbFilename, err => {
  const error = err => {
    // debug and destroy Node process
    logger.error(err)
    process.exit(1)
  }

  if (err) {
    error(err)
  } else {
    // try to run first query creating table
    db.run(
      `CREATE TABLE IF NOT EXISTS melhorenvio_app_auth
      (
          id            INTEGER not null
              primary key autoincrement,
          access_token  STRING  not null,
          refresh_token STRING  not null,
          created_at    DATETIME default CURRENT_TIMESTAMP,
          updated_at    DATETIME default CURRENT_TIMESTAMP not null,
          store_id      INTEGER not null,
          default_data  TEXT
      );`, err => {
        if (err) {
          error(err)
        }
      })
    //
    db.run(
      `CREATE TABLE IF NOT EXISTS melhorenvio_app_tracking
      (
          id          INTEGER not null
              primary key autoincrement,
          label_id    STRING  not null,
          status      STRING  not null,
          resource_id STRING  not null,
          store_id    INTEGER not null,
          created_at  DATETIME default CURRENT_TIMESTAMP not null,
          updated_at  DATETIME
      );`, err => {
        if (err) {
          error(err)
        }
      })
  }
})

module.exports = {
  db,

  searchLabel: resourceId => {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM melhorenvio_app_tracking WHERE resource_id = ? LIMIT 1'
      db.get(query, [resourceId], (err, row) => {
        if (err) {
          reject(err)
        } else {
          // resolve with label or empty
          resolve(row)
        }
      })
    })
  },

  saveLabel: (labelId, labelStatus, resourceId, storeId) => {
    return new Promise((resolve, reject) => {
      const query = 'INSERT INTO melhorenvio_app_tracking (label_id, status, resource_id, store_id) VALUES(?, ?, ?, ?)'
      db.run(query, [labelId, labelStatus, resourceId, storeId], (err) => {
        if (err) {
          reject(err)
        }
        resolve()
      })
    })
  },

  getAllLabels: () => {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM melhorenvio_app_tracking'
      db.all(query, (err, row) => {
        if (err) {
          reject(err)
        } else if (row) {
          // found with success
          // resolve the promise returning respective store and order IDs
          resolve(row)
        } else {
          let err = new Error('No label')
          err.code = 'noLabel'
          reject(err)
        }
      })
    })
  },

  updateLabel: (status, labelId) => {
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
  },

  deleteLabel: id => {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM melhorenvio_app_tracking WHERE id = ?'
      db.run(query, [id], (err) => {
        if (err) {
          reject(err)
        }
        resolve()
      })
    })
  }
}
