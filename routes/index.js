var express = require('express');
var router = express.Router();
var Master = require('../models/models').Master;
var Utils = require('../utils');

router.use(function(req, res, next) {
	if (req.user) {
		next();
	}
	else {
		res.redirect('/login');
	}
});

router.get('/', function(req, res, next) {
  console.log('got here');
  Master.find({"approved": false}, function(err, masters) {
    console.log("THESE ARE THE MASTERS,", masters);
    res.render('index', {masters: masters});
  });
});

router.post('/', function(req, res, next) {
  var utils = new Utils();
	utils.category = req.query.category;
  Master.findOne({'name': req.query.name})
        .then(utils.approve.bind(utils))
        .then(function(response) {
          console.log(response);
          res.redirect('/');
        })
        .catch(function(err) {
          console.log("Error at the end of /options", err);
        });
});

module.exports = router;
