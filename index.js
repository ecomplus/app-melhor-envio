const http = require('http');
const qs = require('querystring')
const sqlite = require('./service/sql')
const port = process.env.PORT || 3000
const fs = require('fs')

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
    let body = ''
    request.on('data', (data) => {
      body += data
      //console.log(body)
    })
    request.on('end', () => {
      
      sqlite.postData(qs.parse(body));
      
      response.write('Saved')
      response.end()
    })

  } else {
    response.write('GET')
    response.end()
  }

}