// 0) Require le module dotenv
require('dotenv').config();
// 0)bis Require la connection
require('../models/connection');

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// 1) On créé les routes
var usersRouter = require('./routes/users');
var tweetsRouter = require('./routes/tweets');

var app = express();

const cors = require('cors');
app.use(cors());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 2) On monte un "middleware" (logiciel-tiers) sur le serveur express.js
app.use('/users', usersRouter);
app.use('/tweets', tweetsRouter);

module.exports = app;