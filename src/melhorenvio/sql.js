const config = require('../config')
const sqlite = require('sqlite3').verbose()
const path = require('path')
const fs = require('fs')
const dbPath = path.resolve(__dirname, config.BD_PATH)

const db = new sqlite.Database(dbPath)

db.serialize(async () => {
  if (!fs.existsSync(dbPath)) {
    console.log("Can't find a SQLite database, creating one now...")
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
      store_id                  INTEGER      NOT NULL,
      procedure_id              VARCHAR (24),
      app_token                 TEXT
    );`
    db.run(auth)
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

let setectAll = async (data, entity) => {
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
  update
}