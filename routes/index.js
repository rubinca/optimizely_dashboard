var express = require('express');
var router = express.Router();
var Master = require('../models/models').Master;

router.use(function(req, res, next) {
	if (req.user) {
		next();
	}
	else {
		res.redirect('/login')
	}
});

router.get('/', function(req, res, next) {
  console.log('got here')
  Master.find({"approved": false}, function(err, masters) {
    console.log("THESE ARE THE MASTERS,", masters)
    res.render('index', {masters: masters})
  })
})

router.post('/', function(req, res, next) {
  var utils = require('../utils')
  //TODO this needs to be changed to incorporate master from form
  //find the master to UPDATE
  //change it's template to handlebars compiled code
  //change approved to true
  Master.findOne({'name': req.query.name})
        .then(utils.approve.bind(utils))
        .then(function(response) {
          console.log(response);
          console.log("all of this worked now im redirecting")
          //ASK: why is this not clearing when I redirect?
          res.redirect('/');
        })
        .catch(function(err) {
          console.log("Error at the end of /options", err)
        })
});

module.exports = router;
