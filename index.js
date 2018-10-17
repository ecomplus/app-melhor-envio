const bodyParser = require('body-parser')
const express = require('express')
const app = express()
const port = process.env.PORT || 3000
const routes = require('./routes')

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.post('/callback', routes.postCallback)
app.get('/callback', routes.getCallback)
app.get('/redirect', routes.redirect)

app.listen(port)
