'use strict'
module.exports = (me) => {
  return (req, res) => {
    // request oauth
    let to = me.auth.getAuth() + '&state=' + req.query.x_store_id
    return res.redirect(301, to)
  }
}
