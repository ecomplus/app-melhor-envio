const sqlite = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'me.db')

const db = new sqlite.Database(dbPath, (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the in-memory SQlite database.');
});

function getData(id) {
  let query = `SELECT * FROM store_tokens WHERE store_id = ?`;
  db.get(query, id, (err, row) => {
    if (err) {
      return console.error(err.message);
    }
    return row ? row : false;
  });
  db.close();
}

function postData(data) {
  let query = `INSERT INTO auth_callback (application_id, application_app_id, application_title, authentication_id, authentication_permission, store_id) VALUES (?,?,?,?,?,?)`;
  
  data = JSON.parse(data)
  
  let params = [
      data.application._id,
      data.application.app_id,
      data.application.title,
      data.authentication._id,
      JSON.stringify(data.authentication.permissions),
      data.store_id
  ];

  db.run(query, params, function (err) {
      console.log(this.changes)
    if (err) {
      return console.error(err.message);
    }
    console.log(`Rows inserted ${this.changes}`);
  });
  // close the database connection
  db.close();
}

function putData(){

}

function create(){
    sql = `CREATE TABLE auth_callback ( id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, date DATETIME NOT NULL DEFAULT current_timestamp, application_id INTEGER NOT NULL, application_app_id INTEGER NOT NULL, application_title VARCHAR NOT NULL, authentication_id INTEGER NOT NULL, authentication_permission TEXT NOT NULL, me_refresh_token TEXT NOT NULL )`
    db.run(sql);
}

module.exports = {
    getData,
    postData,
    putData,
    create
}