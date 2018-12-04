'use strict'
const melhorenvio = require('./melhor-envio')
const authentication = require('./authentication')
/**
 * Jobs
 */
// Verifica status das etiquetas a cada 30m
setInterval(melhorenvio.updateLabelStatus, 30 * 60 * 1000)

// Verifica o status do token ecomplus a cada 8hrs
setInterval(authentication.updateRefreshToken, 60 * 60 * 1000)

// Verifica a validade do token melhor envio a cada 24hrs
setInterval(melhorenvio.updateTokens, 1000 * 60 * 60 * 24)
