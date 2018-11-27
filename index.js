const bodyParser = require('body-parser')
const express = require('express')
const app = express()
const port = process.env.PORT || 3000
const routes = require('./src/routes')

require('console-files')

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.get('/redirect', routes.redirect.melhorenvio)

app.post('/callback', routes.callback.post)
app.get('/callback', routes.callback.get)

app.post('/calculate', routes.calculate.post)

app.post('/notifications', routes.procedure.orders)
app.listen(port)

require('./src/tasks')
