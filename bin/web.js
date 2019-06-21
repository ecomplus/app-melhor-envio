#!/usr/bin/env node

'use strict'

// log to files
const logger = require('console-files')
// handle app authentication to Store API
// https://github.com/ecomclub/ecomplus-app-sdk
const { ecomAuth, ecomServerIps } = require('ecomplus-app-sdk')
// melhorenvio-sdk https://github.com/talissonf/melhor-envio-sdk#instance
const me = require('melhor-envio').config({
  client_id: 31, //process.env.ME_CLIENT_ID,
  client_secret: 'KYaPyv6odJuPvSbBg8TdIg4EErK4gWNDD5rE8oqU', //process.env.ME_CLIENT_SECRET,
  sandbox: (process.env.ME_SANDBOX === 'true'),
  redirect_uri: 'https://melhorenvio.ecomplus.biz/callback',//process.env.ME_REDIRECT_URI,
  request_scope: `cart-read cart-write companies-read coupons-read notifications-read products-read products-write purchases-read shipping-calculate shipping-cancel shipping-checkout shipping-companies shipping-generate shipping-preview shipping-print shipping-share shipping-tracking ecommerce-shipping transactions-read users-read webhooks-read webhooks-write`
})

// web server with Express
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const router = express.Router()
const port = process.env.PORT || 3000

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

// E-Com Plus Store ID from request header
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/ecom/') && process.env.NODE_ENV === 'production') {
    // check if request is comming from E-Com Plus servers
    if (ecomServerIps.indexOf(req.get('x-real-ip')) === -1) {
      res.status(403).send('Who are you? Unauthorized IP address')
    } else {
      // get store ID from request header
      req.storeId = parseInt(req.get('x-store-id'), 10)
      next()
    }
  } else {
    // bypass
    next()
  }
})

ecomAuth.then(appSdk => {
  // setup app routes
  const routes = './../routes'
  router.get('/', require(`${routes}/`)())

  // base routes for E-Com Plus Store API
  ;['auth-callback', 'webhook', 'modules/calculate'].forEach(endpoint => {
    let filename = `/ecom/${endpoint}`
    router.post(filename, require(`${routes}${filename}`)(appSdk, me))
  })

  /* Add custom app routes here */
  ;['auth-callback', 'request-auth'].forEach(endpoint => {
    let filename = `/melhorenvio/${endpoint}`
    router.get(filename, require(`${routes}${filename}`)(me))
  })

  // debug
  router.get('/redirect', require('./../routes/melhorenvio/request-auth')(me))
  router.get('/callback', require('./../routes/melhorenvio/auth-callback')(me))
  
  // add router and start web server
  app.use(router)
  app.listen(port)
  logger.log(`--> Starting web app on port :${port}`)
})

ecomAuth.catch(err => {
  logger.error(err)
  setTimeout(() => {
    // destroy Node process while Store API auth cannot be handled
    process.exit(1)
  }, 1100)
})
