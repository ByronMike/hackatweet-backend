var express = require('express');
var router = express.Router();

require('../models/connection');
const User = require('../models/users');
const { checkBody } = require('../modules/checkBody');
// 0) On importe le module bcrypt pour hacher le mot de passe
const bcrypt = require('bcrypt');
// 0)bis On importe le module uid2 pour générer des tokens uniques pour chaque user
const uid2 = require('uid2');

// 1) Route signup
router.post('/signup', (req, res) => {
  if (!checkBody(req.body, ['firstName', 'username', 'password'])) {
    res.json({ result: false, error: 'Missing or empty fields' });
    return;
  }

  // 1.1) Check if the user has not already been registered
  // Commentaire - $regex: On utilise les fonctionnalités intégrées de mongoDB avec $regex
  // Commentaire - new : Il s'agit d'une méthode "constructor" pour crééer et initialiser une classe 
  User.findOne({ username: { $regex: new RegExp(req.body.username, 'i') } }).then(data => {
    if (data === null) {
      const hash = bcrypt.hashSync(req.body.password, 10);

      // 1.2) 
      const newUser = new User({
        firstName: req.body.firstName,
        username: req.body.username,
        password: hash,
        token: uid2(32),
        canBookmark: true,
      });

      newUser.save().then(newDoc => {
        res.json({ result: true, token: newDoc.token });
      });
    } else {
      // User already exists in database
      res.json({ result: false, error: 'User already exists' });
    }
  });
});

router.post('/signin', (req, res) => {
  if (!checkBody(req.body, ['username', 'password'])) {
    res.json({ result: false, error: 'Missing or empty fields' });
    return;
  }

  User.findOne({ username: { $regex: new RegExp(req.body.username, 'i') } }).then(data => {
    if (bcrypt.compareSync(req.body.password, data.password)) {
      res.json({ result: true, token: data.token, username: data.username, firstName: data.firstName });
    } else {
      res.json({ result: false, error: 'User not found or wrong password' });
    }
  });
});

module.exports = router;
