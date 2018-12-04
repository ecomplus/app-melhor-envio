'use strict'
const authentication = require('./services/authentication')
const router = require('express').Router()
const melhorenvio = require('./services/melhor-envio')

router.route('/redirect')
  .get(melhorenvio.oauthRedirect)

router.route('/callback')
  .get(melhorenvio.setAppToken)
  .post(authentication.setAppAuthentication)

router.route('/calculate')
  .post(melhorenvio.calculate)

router.route('/notifications')
  .post(melhorenvio.resolveLabel)

module.exports = router
