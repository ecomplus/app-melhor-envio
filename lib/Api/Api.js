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
      );
    `, err => {
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
      );
    `, err => {
        if (err) {
          error(err)
        }
      })
  }
})

const promise = new Promise(resolve => {
  return resolve({
    getAppConfig: require('./GetAppConfig')(db),
    insertAppConfig: require('./InsertAppConfig')(db),
    updateAppConfig: require('./UpdateAppConfig')(db),
    addNewLabel: require('./AddNewLabel')(db),
    updateLabel: require('./UpdateLabel')
  })
})

module.exports = {
  appAuth: promise,
  internalApi: promise,
  getAppConfig: require('./GetAppConfig')(db),
  insertAppConfig: require('./InsertAppConfig')(db),
  updateAppConfig: require('./UpdateAppConfig')(db),
  addNewLabel: require('./AddNewLabel')(db),
  getLabels: require('./GetLabels')(db),
  updateLabel: require('./UpdateLabel')(db)
}
