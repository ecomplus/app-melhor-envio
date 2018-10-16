const sqlite = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'me.db')
const TABLE = 'auth_callback'

const db = new sqlite.Database(dbPath, (err) => {
  if (err) {
    return console.error(err.message);
  }
});

function insert(data) {
  let keys = [];
  let values = []
  let binds = [];

  for (key in data) {
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
    console.log(`Rows inserted ${this.changes}`)
    return this.changes
  })
}

function select(data, callback) {
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

function update(data, clause) {
  let sets = [];
  let where = [];
  let values = [];
  for (key in data) {
    if (!data.hasOwnProperty(key)) continue;
    sets.push(key + ' = ?');
    values.push(data[key]);
  }
  for (key in clause) {
    if (!clause.hasOwnProperty(key)) continue;
    where.push(key + ' = ?');
    values.push(clause[key]);
  }

  let query = 'UPDATE ' + TABLE + ' SET ' + sets.join(', ') + (where.length > 0 ? ' WHERE ' + where.join(' AND ') : '')

  db.run(query, values, function (err) {
    if (err) {
      return console.error(err.message)
    }
    console.log(`Rows updated ${this.changes}`)
    return this.changes
  })
}

function create() {
  sql = `CREATE TABLE auth_callback ( id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, date DATETIME NOT NULL DEFAULT current_timestamp, application_id INTEGER NOT NULL, application_app_id INTEGER NOT NULL, application_title letCHAR NOT NULL, authentication_id INTEGER NOT NULL, authentication_permission TEXT NOT NULL, me_refresh_token TEXT NOT NULL )`
  db.run(sql);
}

module.exports = {
  insert,
  select,
  update,
  create
}