const sqlite = require('sqlite3').verbose()
const db = new sqlite.Database(process.env.ECOM_AUTH_DB)
// create necessary tables

const promise = new Promise(resolve => {
  return resolve({
    getAppConfig: require('./GetAppConfig')(db),
    insertAppConfig: require('./InsertAppConfig')(db),
    updateAppConfig: require('./UpdateAppConfig')(db),
    updateTokens: require('./UpdateTokens')(db),
    addNewLabel: require('./AddNewLabel')(db)
  })
})

module.exports = {
  appAuth: promise,
  internalApi: promise
}
