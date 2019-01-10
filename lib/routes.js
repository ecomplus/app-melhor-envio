'use strict'
const router = require('express').Router()
const { requestCallback, melhorEnvio, ecomplus } = require('./services/callback')
const { calculate, notifications } = require('./services/melhor-envio')

router.route('/redirect')
  .get(requestCallback)

router.route('/callback')
  .get(melhorEnvio)
  .post(ecomplus)

router.route('/calculate')
  .post(calculate)

router.route('/notifications')
  .post(notifications)

module.exports = router
