'use strict';

var stylus   = require('stylus')
var express  = require('express')
var app      = express()

var bodyParser   = require('body-parser')
var path         = require('path')

var config       = require('./config.js')

// --- app configuration
app.use(bodyParser.urlencoded({  extended: true }))
app.use(bodyParser.json())
app.use(stylus.middleware(path.join(__dirname, 'public')))

app.use(express.static(__dirname + '/public'))

// --- route initialization
require('./private/routes.js')(app)

// --- server and https setup
app.listen(config.port)
console.log("Listens on Port " + config.port)