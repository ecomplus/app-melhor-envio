const http = require('http');
const qs = require('querystring')
const dao = require('./service/sql')
const port = process.env.PORT || 3000

http.createServer(function (request, response) {

  let url = request.url

  switch (url) {
    case '/redirect':
      redirect(request, response);
      break;
    case '/callback':
      callback(request, response);
      break;
    default:
      break;
  }

}).listen(port);

let redirect = (request, response) => {
  if (request.method === 'POST') {
    request.on('data', (data) => {
      console.log(JSON.stringify(qs.parse(data)))
    })
    request.on('end', () => {
      console.log(qs.parse(body))
    })
  } else {

  }
}

let callback = (request, response) => {

  if (request.method === 'POST') {
    let requestBody = ''

    request.on('data', (data) => {
      requestBody += data
    })

    request.on('end', () => {
      requestBody = JSON.parse(requestBody)

      dao.select({ application_app_id: requestBody.application.app_id }, (res) => {
        if (typeof res === 'undefined') {
          let params = {
            application_id: requestBody.application._id,
            application_app_id: requestBody.application.app_id,
            application_title: requestBody.application.title,
            authentication_id: requestBody.authentication._id,
            authentication_permission: JSON.stringify(requestBody.authentication.permissions),
            store_id: requestBody.store_id
          }
          dao.insert(params)
        } else {
          let params = {
            application_id: requestBody.application._id ? requestBody.application._id : res.application_id,
            application_app_id: requestBody.application.app_id ? requestBody.application.app_id : res.application_app_id,
            application_title: requestBody.application.title ? requestBody.application.title : res.application_title,
            authentication_id: requestBody.authentication._id ? requestBody.authentication._id : res.authentication_id,
            authentication_permission: JSON.stringify(requestBody.authentication.permissions) ? JSON.stringify(requestBody.authentication.permissions) : res.authentication_permission,
            store_id: requestBody.store_id ? requestBody.store_id : res.store_id
          }

          dao.update(params, { application_app_id: requestBody.application.app_id })
        }
      });
    })

  } else {

  }

  response.write('Saved')
  response.end()
}

