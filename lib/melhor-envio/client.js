const axios = require('axios')
const { USER_AGENT } = require('./oauth')

const instance = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT
  }
})

module.exports = ({
  url,
  method,
  token,
  data,
  sandbox
}) => {
  const config = {
    url,
    method,
    headers: {
      'Authorization': `Bearer ${token}`
    },
    data
  }

  if (sandbox === true) {
    instance.defaults.baseURL = 'https://sandbox.melhorenvio.com.br/api/v2/me'
  } else {
    instance.defaults.baseURL = 'https://melhorenvio.com.br/api/v2/me'
  }

  return instance(config)
}
