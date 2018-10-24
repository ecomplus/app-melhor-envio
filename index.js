const bodyParser = require('body-parser')
const express = require('express')
const app = express()
const port = process.env.PORT || 4000
const routes = require('./src/routes')

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.post('/callback', routes.callback.post)
app.get('/callback', routes.callback.get)
app.get('/redirect', routes.redirect.melhorenvio)
app.post('/calculate', routes.calculate.post)
app.post('/procedure/orders', routes.procedure.orders)
app.listen(port)
