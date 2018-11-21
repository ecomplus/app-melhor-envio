const config = require('../config')
const sqlite = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')
const dbPath = path.resolve(config.BD_PATH)
const db = new sqlite.Database(dbPath)
const logger = require('console-files')

db.serialize(async () => {
  if (!fs.existsSync(dbPath)) {
    logger.log("Can't find a SQLite database, creating one now...")
    let auth = `CREATE TABLE IF NOT EXISTS app_auth (
      id                        INTEGER      PRIMARY KEY
      UNIQUE  NOT NULL,
      created_at                DATETIME     NOT NULL
            DEFAULT CURRENT_TIMESTAMP,
      application_id            INTEGER      NOT NULL,
      application_app_id        INTEGER      NOT NULL,
      application_title         VARCHAR      NOT NULL,
      authentication_id         INTEGER      NOT NULL,
      authentication_permission TEXT,
      me_refresh_token          TEXT,
      store_id                  INTEGER  NOT NULL,
      app_token                 TEXT,
      me_access_token           STRING
    );`
    db.run(auth)

    let q2 = `CREATE TABLE IF NOT EXISTS me_tracking (
      id          INTEGER  PRIMARY KEY AUTOINCREMENT
                           NOT NULL,
      created_at  DATETIME DEFAULT (CURRENT_TIMESTAMP)
                           NOT NULL,
      label_id    STRING   NOT NULL,
      status      STRING   NOT NULL,
      resource_id STRING   NOT NULL,
      updated_at  DATETIME,
      store_id    INTEGER  NOT NULL
    ); `
    db.run(q2)
  }
})

let insert = async (data, entity) => {
  return new Promise((resolve, reject) => {
    let keys = []
    let values = []
    let binds = []

    for (let key in data) {
      if (!data.hasOwnProperty(key)) continue
      keys.push(key)
      values.push(data[key])
      binds.push('?')
    }

    let query = 'INSERT INTO ' + entity + ' (' + keys.join(',') + ') VALUES (' + binds.join(',') + ')'
    db.run(query, values, (err) => {
      if (err) {
        reject(new Error(err.message))
      } else {
        resolve(this.changes)
      }
    })
  })
}

let select = async (data, entity) => {
  return new Promise((resolve, reject) => {
    let key, value
    for (const index in data) {
      if (data.hasOwnProperty(index)) {
        key = index
        value = data[index]
      }
    }

    let query = 'SELECT * FROM ' + entity + ' WHERE ' + key + ' = ?'

    db.get(query, value, (err, row) => {
      if (err) {
        reject(new Error(err.message))
      } else {
        resolve(row || false)
      }
    })
  })
}

let selectAll = async (data, entity) => {
  return new Promise((resolve, reject) => {
    let key, value
    for (const index in data) {
      if (data.hasOwnProperty(index)) {
        key = index
        value = data[index]
      }
    }

    let query = 'SELECT * FROM ' + entity + ' WHERE ' + key + ' = ?'

    db.all(query, value, (err, row) => {
      if (err) {
        reject(new Error(err.message))
      } else {
        resolve(row || false)
      }
    })
  })
}

let each = (query, func) => {
  db.each(query, (err, row) => {
    if (!err) {
      func(err, row)
    }
  })
}

let update = async (data, clause, entity) => {
  return new Promise((resolve, reject) => {
    let sets = []
    let where = []
    let values = []
    for (let key in data) {
      if (!data.hasOwnProperty(key)) continue
      sets.push(key + ' = ?')
      values.push(data[key])
    }
    for (let key in clause) {
      if (!clause.hasOwnProperty(key)) continue
      where.push(key + ' = ?')
      values.push(clause[key])
    }

    let query = 'UPDATE ' + entity + ' SET ' + sets.join(', ') + (where.length > 0 ? ' WHERE ' + where.join(' AND ') : '')

    db.run(query, values, function (err) {
      if (err) {
        reject(new Error(err.message))
      } else {
        resolve(this.changes)
      }
    })
  })
}

module.exports = {
  insert,
  select,
  selectAll,
  update,
  each
}
