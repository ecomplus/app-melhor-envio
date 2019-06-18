'use strict'

// log on files
const logger = require('console-files')
const { internalApi } = require('./../../lib/Api/Api')

module.exports = (me) => {
  return (req, res) => {
    const { code, state } = req.query
    const endSuccess = () => {
      res.status(200)
      res.write('<script>window.close()</script>')
      res.end()
    }

    const err = (e) => {
      console.log('' + e)
      logger.error(e)
      res.status(400)
      res.send(e)
    }

    me.auth.getToken(code)
      .then(params => {
        const storeId = state
        const accessToken = params.access_token
        const refreshToken = params.refresh_token

        // checks if has access_token in db
        internalApi.then(api => {
          api.getAppConfig(storeId)
            .then(result => {
              if (result) {
                // if has authentication for storeId
                // update token
                console.log('--> Update')
                api.updateAppConfig(accessToken, refreshToken, storeId)
                  .then(() => endSuccess())
                  .catch(e => logger.log(e))
              } else {
                // if is a new
                // insert like new request
                // parse seller infor to save at db
                const parserSellerFrom = seller => {
                  try {
                    seller = JSON.parse(seller)
                    return {
                      'name': seller.firstname + ' ' + seller.lastname,
                      'phone': seller.phone.phone,
                      'email': seller.email,
                      'document': seller.document,
                      'address': seller.address.address,
                      'complement': seller.address.complement,
                      'number': seller.address.number,
                      'district': seller.address.district,
                      'city': seller.address.city.city,
                      'state_abbr': seller.address.city.state.state_abbr,
                      'country_id': seller.address.city.state.country.id,
                      'postal_code': seller.address.postal_code
                    }
                  } catch (e) {
                    logger.error('Parse erro: ' + e)
                    return '{}'
                  }
                }
                me.setToken = accessToken
                me.user.me()
                  .then(seller => {
                    api.insertAppConfig(accessToken, refreshToken, storeId, JSON.stringify(parserSellerFrom(seller)))
                      .then(() => endSuccess())
                      .catch(e => err(e))
                  })
                  .catch(e => err(e))
              }
            })
            .catch(e => err(e))
        })
      })
      .catch(e => err(e))
  }
}
