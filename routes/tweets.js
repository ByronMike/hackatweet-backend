var express = require('express');
var router = express.Router();

const User = require('../models/users');
const Tweet = require('../models/tweets');
const { checkBody } = require('../modules/checkBody');

// 1) Route pour publier des tweets
router.post('/', (req, res) => {
  // 1.1) check de l'input
  if (!checkBody(req.body, ['token', 'content'])) {
    res.json({ result: false, error: 'Missing or empty fields' });
    return;
  }
 
 // 1.2) Création du tweet (associé à un user par son token)
  User.findOne({ token: req.body.token }).then(user => {
    if (user === null) {
      res.json({ result: false, error: 'User not found' });
      return;
    }

    const newTweet = new Tweet({
      // Identification par l'id mongoDB
      author: user._id,
     // Contenu ajouté
      content: req.body.content,
      // Référence à la date de création
      createdAt: new Date(),
    });

    newTweet.save().then(newDoc => {
      res.json({ result: true, tweet: newDoc });
    });
  });
});

// 2) Route pour récupérer tous les tweets (le params :token permet de "populater"  tous les users avec les infos correspondantes)
// RAPPEL : populate : permet de remplacer le chemin spécifié dans le document (ex: ici le token passé en params), avec des documents d'autres collections (ex: author qui contiendra des informations liées d'autres collections)
router.get('/all/:token', (req, res) => {

  // 2.1) check existence user par le token
  User.findOne({ token: req.params.token }).then(user => {
    if (user === null) {
      res.json({ result: false, error: 'User not found' });
      return;
    }
     // 2.2) Récupération de tous les tweets, "populatés", et triés (time desc)
    Tweet.find() // Populate and select specific fields to return (for security purposes)
       // on populate le token par author (et on précisera uniquement le username et firstname)
      .populate('author', ['username', 'firstName'])
      // on populate le token par likes (et on précisera uniquement le username associé)
      .populate('likes', ['username'])
      // tri par ordre décroissant
      .sort({ createdAt: 'desc' })
      .then(tweets => {
        res.json({ result: true, tweets });
      });
  });
});

// 3) Route pour récupérer les # (et les compteurs de #)
router.get('/trends/:token', (req, res) => {
   // 3.1) check existence user par le token
  User.findOne({ token: req.params.token }).then(user => {
    if (user === null) {
      res.json({ result: false, error: 'User not found' });
      return;
    }
    
     // 3.2) on récupère tous les # de tous les contents
    Tweet.find({ content: { $regex: /#/ } })
      .then(tweets => {
        // préparation du tableau pour les pusher
        const hashtags = [];
        
        // 3.3) [A - récupération des #] on boucle sur tous les contents, on split pour distinguer chaque mot et on récupère les # (avec au moins une lettre) avec la méthode startsWith
        for (const tweet of tweets) {
          const filteredHashtags = tweet.content.split(' ').filter(word => word.startsWith('#') && word.length > 1);
          hashtags.push(...filteredHashtags);
        }

        // 3.4) [B - comptage des #] on boucle sur les # et on va chercher s'ils existent, si non (-1) on push dans le tableau trends si déjà existant on augmpente le compteur
        // préparation du tableau pour pusher les # ET compteur de likes
        const trends = [];
        for (const hashtag of hashtags) {
          const trendIndex = trends.findIndex(trend => trend.hashtag === hashtag);
          if (trendIndex === -1) {
            // commentaire: on push le hashtag et le compteur lié
            trends.push({ hashtag, count: 1 });
          } else {
            trends[trendIndex].count++;
          }
        }
         // Affichage des résultats par ordre décroissant
        res.json({ result: true, trends: trends.sort((a, b) => b.count - a.count) });
      });
  });
});

// 4) Route get pour récupérer les # par leur nom (:query => nom du #) et les informations liées
router.get('/hashtag/:token/:query', (req, res) => {
  // 4.1) check existence user par le token
  User.findOne({ token: req.params.token }).then(user => {
    if (user === null) {
      res.json({ result: false, error: 'User not found' });
      return;
    }

    // 4.2) on récupère les # selon leur nom (req.params.query) par regex (avec flag i)
    Tweet.find({ content: { $regex: new RegExp('#' + req.params.query, 'i') } }) // Populate and select specific fields to return (for security purposes)
      // on populate le content par author (et on précisera uniquement le username et firstname)
      .populate('author', ['username', 'firstName'])
      // on populate le content par les likes (et on précisera uniquement le username))
      .populate('likes', ['username'])
      // tri par ordre décroissant
      .sort({ createdAt: 'desc' })
      .then(tweets => {
        res.json({ result: true, tweets });
      });
  });
});

// 5) Route put : on cherche le tweet et on l'actualise en pushant/pullant le user selon s'il a déjà liké ou non (pour gérer le clic)
router.put('/like', (req, res) => {
// 5.1) check de l'input
  if (!checkBody(req.body, ['token', 'tweetId'])) {
    res.json({ result: false, error: 'Missing or empty fields' });
    return;
  }

  // 5.2) check existence user par le token
  User.findOne({ token: req.body.token }).then(user => {
    if (user === null) {
      res.json({ result: false, error: 'User not found' });
      return;
    }

   // 5.3) la fonctionnalité d'actualisation ...
    // 5.3.1) check existence du tweet (par l'id)
    Tweet.findById(req.body.tweetId).then(tweet => {
      if (!tweet) {
        res.json({ result: false, error: 'Tweet not found' });
        return;
      }

     // 5.3.2) si le tweet existe.. et ..
      if (tweet.likes.includes(user._id)) { // User already liked the tweet
        // 5.4) .. si user a déjà liké, on actualise le document du tweet en question en pullant (supprimant) le user du document du tweet
        Tweet.updateOne({ _id: tweet._id }, { $pull: { likes: user._id } }) // Remove user ID from likes
          .then(() => {
            res.json({ result: true });
          });
      // 5.5) Sinon, on actualise le document du tweet en question en pushant le user dans le document du tweet
      } else { // User has not liked the tweet
        Tweet.updateOne({ _id: tweet._id }, { $push: { likes: user._id } }) // Add user ID to likes
          .then(() => {
            res.json({ result: true });
          });
      }
    });
  });
});

// 6)Route delete 
router.delete('/', (req, res) => {
// 6.1) check de l'input
  if (!checkBody(req.body, ['token', 'tweetId'])) {
    res.json({ result: false, error: 'Missing or empty fields' });
    return;
  }

 // 6.2) check existence user par le token
  User.findOne({ token: req.body.token }).then(user => {
    if (user === null) {
      res.json({ result: false, error: 'User not found' });
      return;
    }

   // 6.3) fonctionnalité delete + check existence du tweet (par l'id)
    Tweet.findById(req.body.tweetId)
      // on populate le tweetId par author
      .populate('author')
      .then(tweet => {
        // si tweet pas trouvé..
        if (!tweet) {
          res.json({ result: false, error: 'Tweet not found' });
          return;
       // ..si l'auteur du tweet populaté (tweet.author._id) n'est pas l'user connecté
        } else if (String(tweet.author._id) !== String(user._id)) { // ObjectId needs to be converted to string (JavaScript cannot compare two objects)
          res.json({ result: false, error: 'Tweet can only be deleted by its author' });
          return;
        }

          // .. si oui, on le supprime
        Tweet.deleteOne({ _id: tweet._id }).then(() => {
          res.json({ result: true });
        });
      });
  });
});

module.exports = router;