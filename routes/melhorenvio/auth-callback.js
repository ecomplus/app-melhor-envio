'use strict'

// log on files
const logger = require('console-files')
const { insertAppConfig } = require('./../../lib/Api/Api')

module.exports = (me) => {
  return (req, res) => {
    const { code, state } = req.query

    if (!code || !state) {
      res.status(400)
      return res.send({
        error: 'AUTH_CALLBACK',
        message: 'Missing required fields'
      })
    }

    // get melhor envio token
    me.auth.getToken(code)

      // get seller data
      .then(async auth => {
        me.setToken = auth.access_token
        let seller = await me.user.me()
        return { auth, seller }
      })

      // parse seller data to save
      .then(({ auth, seller }) => {
        seller = JSON.parse(seller)
        let schema = {
          'name': (seller.firstname + ' ' + seller.lastname) || '',
          'phone': seller.phone.phone || '',
          'email': seller.email || '',
          'document': seller.document || '',
          'address': seller.address.address || '',
          'complement': seller.address.complement || '',
          'number': seller.address.number || '',
          'district': seller.address.district || '',
          'city': seller.address.city.city || '',
          'state_abbr': seller.address.city.state.state_abbr || '',
          'country_id': seller.address.city.state.country.id || '',
          'postal_code': seller.address.postal_code || ''
        }

        seller = JSON.stringify(schema)

        return { auth, seller }
      })

      // save
      .then(({ auth, seller }) => {
        let accessToken = auth.access_token
        let refreshToken = auth.refresh_token
        let storeId = state

        return insertAppConfig(accessToken, refreshToken, storeId, seller)
      })

      // close window
      .then(() => {
        res.status(200)
        res.write('<script>window.close()</script>')
        res.end()
      })

      .catch(error => {
        logger.error('AUTH_CALLBACK', error.message)
        res.status(400)
        return res.send({
          error: 'AUTH_CALLBACK',
          message: 'Unexpected Error Try Later'
        })
      })
  }
}
