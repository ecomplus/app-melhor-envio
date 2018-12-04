'use strict'
const router = require('express').Router()
const melhorenvio = require('./services/melhor-envio')

router.route('/redirect')
  .get(melhorenvio.oauthRedirect)

router.route('/callback')
  .get()
  .post()

router.route('/calculate')
  .post(melhorenvio.calculate)

router.route('/notifications')
  .post(melhorenvio.resolveLabel)

module.exports = router
