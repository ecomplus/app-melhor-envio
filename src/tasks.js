const Auth = require('./melhorenvio/authentication')
const ME = require('./melhorenvio/melhorenvio')

let authentication = new Auth()
let melhorenvio = new ME()

//
setInterval(authentication.updateRefreshToken, 60 * 60 * 1000)
// authentication.updateRefreshToken()

//
setInterval(melhorenvio.updateTokens, 1000 * 60 * 60 * 24)
// melhorenvio.updateTokens()