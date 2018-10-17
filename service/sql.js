const sqlite = require('sqlite3').verbose()
const path = require('path')
const dbPath = path.resolve(__dirname, '../db/me.db')
const TABLE = 'auth_callback'

const db = new sqlite.Database(dbPath, (err) => {
  if (err) {
    return console.error(err.message)
  }
  create()
})

function insert (data, callback) {
  let keys = []
  let values = []
  let binds = []

  for (let key in data) {
    if (!data.hasOwnProperty(key)) continue
    keys.push(key)
    values.push(data[key])
    binds.push('?')
  }

  let query = 'INSERT INTO ' + TABLE + ' (' + keys.join(',') + ') VALUES (' + binds.join(',') + ')'
  db.run(query, values, function (err) {
    if (err) {
      return console.error(err.message)
    }
    console.log(`Rows insert ${this.changes}`)
    if (callback) {
      return callback(this.changes, err)
    }

    return this
  })
}

function select (data, callback) {
  let key, value
  for (const index in data) {
    if (data.hasOwnProperty(index)) {
      key = index
      value = data[index]
    }
  }

  let query = 'SELECT * FROM ' + TABLE + ' WHERE ' + key + ' = ?'

  db.get(query, value, (err, row) => {
    if (err) {
      return console.error(err.message)
    }

    if (callback) {
      callback(row)
      return this
    }
    return row
  })
}

function update (data, clause, callback) {
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

  let query = 'UPDATE ' + TABLE + ' SET ' + sets.join(', ') + (where.length > 0 ? ' WHERE ' + where.join(' AND ') : '')

  db.run(query, values, function (err) {
    if (err) {
      return console.error(err.message)
    }
    console.log(`Rows updated ${this.changes}`)
    if (callback) {
      return callback(this.changes, err)
    }

    return this
  })
}

function create () {
  let sql = `CREATE TABLE IF NOT EXISTS auth_callback (
      id                        INTEGER  PRIMARY KEY
                                         UNIQUE
                                         NOT NULL,
      created_at                DATETIME NOT NULL
                                         DEFAULT CURRENT_TIMESTAMP,
      application_id            INTEGER  NOT NULL,
      application_app_id        INTEGER  NOT NULL,
      application_title         VARCHAR  NOT NULL,
      authentication_id         INTEGER  NOT NULL,
      authentication_permission TEXT,
      me_refresh_token          TEXT,
      store_id                  INTEGER  NOT NULL
  )`
  db.run(sql)
}

module.exports = {
  insert,
  select,
  update,
  create
}
