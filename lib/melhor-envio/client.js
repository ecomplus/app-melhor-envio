const axios = require('axios')

const instance = axios.create({
  baseURL: 'https://melhorenvio.com.br/api/v2/me',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
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

  if (sandbox) {
    instance.defaults.baseURL = 'https://sandbox.melhorenvio.com.br/api/v2/me'
    console.log(instance)
  }

  return instance(config)
}
