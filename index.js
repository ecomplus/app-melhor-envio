const http = require('http');
const qs = require('querystring')
const port = 3000
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
      //console.log(JSON.stringify(qs.parse(body)))
      fs.writeFile('request.json', JSON.stringify(qs.parse(body)) , function (err) {
        if (err) throw err;
        console.log('Saved!');
      });
    })

  } else {
    response.write('GET')
    response.end()
  }

}