'use strict'
const { updateTokenMelhorEnvio, verifyLabelStatus } = require('./melhor-envio')

// Verifica status das etiquetas a cada 30m
setInterval(verifyLabelStatus, 30 * 60 * 1000)

// Verifica a validade do token melhor envio a cada 24hrs
setInterval(updateTokenMelhorEnvio, 1000 * 60 * 60 * 24)
