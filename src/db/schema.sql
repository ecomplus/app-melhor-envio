--
-- File generated with SQLiteStudio v3.2.1 on qua nov 21 08:46:15 2018
--
-- Text encoding used: UTF-8
--
PRAGMA foreign_keys = off;
BEGIN TRANSACTION;

-- Table: app_auth
DROP TABLE IF EXISTS app_auth;

CREATE TABLE app_auth (
    id                        INTEGER  PRIMARY KEY
                                       UNIQUE
                                       NOT NULL,
    created_at                DATETIME NOT NULL
                                       DEFAULT CURRENT_TIMESTAMP,
    updated_at                DATETIME DEFAULT (CURRENT_TIMESTAMP),
    application_app_id        INTEGER  NOT NULL,
    application_id            INTEGER  NOT NULL,
    application_title         VARCHAR  NOT NULL,
    authentication_id         INTEGER  NOT NULL,
    authentication_permission TEXT,
    me_refresh_token          TEXT,
    store_id                  INTEGER  NOT NULL,
    app_token                 TEXT,
    me_access_token           STRING
);


-- Table: me_tracking
DROP TABLE IF EXISTS me_tracking;

CREATE TABLE me_tracking (
    id          INTEGER  PRIMARY KEY AUTOINCREMENT
                         NOT NULL,
    created_at  DATETIME DEFAULT (CURRENT_TIMESTAMP) 
                         NOT NULL,
    label_id    STRING   NOT NULL,
    status      STRING   NOT NULL,
    resource_id STRING   NOT NULL,
    updated_at  DATETIME,
    store_id    INTEGER  NOT NULL
);


COMMIT TRANSACTION;
PRAGMA foreign_keys = on;
