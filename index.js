const bodyParser = require('body-parser')
const express = require('express')
const app = express()
const port = process.env.PORT || 3000
const routes = require('./src/routes')

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

process.on('uncaughtException', (err) => {
  // fatal error
  // log to file before exit
  let msg = '\n[' + new Date().toString() + ']\n'
  if (err) {
    if (err.hasOwnProperty('stack')) {
      msg += err.stack
    } else if (err.hasOwnProperty('message')) {
      msg += err.message
    } else {
      msg += err.toString()
    }
    msg += '\n'
  }

  let fs = require('fs')
  fs.appendFile('_stderr', msg, () => {
    process.exit(1)
  })
})

app.get('/redirect', routes.redirect.melhorenvio)

app.post('/callback', routes.callback.post)
app.get('/callback', routes.callback.get)

app.post('/calculate', routes.calculate.post)

app.post('/notifications', routes.procedure.orders)
app.listen(port)

require('./src/tasks')
