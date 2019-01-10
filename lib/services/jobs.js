'use strict'
const sqlite = require('sqlite3')
const logger = require('console-files')

const { updateTokenMelhorEnvio, verifyLabelStatus } = require('./melhor-envio')

const databaseGenerate = () => {
  const db = new sqlite.Database(process.env.ECOM_AUTH_DB, err => {
    if (err) {
      logger.error(err)
    } else {
      db.run(`CREATE TABLE IF NOT EXISTS melhorenvio_app_auth (
          id            INTEGER  PRIMARY KEY AUTOINCREMENT
                                 NOT NULL,
          access_token  STRING   NOT NULL,
          refresh_token STRING   NOT NULL,
          created_at    DATETIME DEFAULT (CURRENT_TIMESTAMP),
          updated_at    DATETIME DEFAULT (CURRENT_TIMESTAMP) 
                                 NOT NULL,
          store_id      INTEGER  NOT NULL,
          default_data  TEXT
        );`)
      //
      db.run(`CREATE TABLE IF NOT EXISTS melhorenvio_app_tracking (
        id          INTEGER  PRIMARY KEY AUTOINCREMENT
                             NOT NULL,
        label_id    STRING   NOT NULL,
        status      STRING   NOT NULL,
        resource_id STRING   NOT NULL,
        store_id    INTEGER  NOT NULL,
        created_at  DATETIME DEFAULT (CURRENT_TIMESTAMP) 
                             NOT NULL,
        updated_at  DATETIME
      );`)
    }
  })
}

//
databaseGenerate()

// Verifica status das etiquetas a cada 30m
setInterval(verifyLabelStatus, 30 * 60 * 1000)

// Verifica a validade do token melhor envio a cada 24hrs
setInterval(updateTokenMelhorEnvio, 1000 * 60 * 60 * 24)
