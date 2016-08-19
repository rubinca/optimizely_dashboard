var express = require('express');
var router = express.Router();
var Project = require('./models/models').Project;
var Master = require('./models/models').Master;
var Tag = require('./models/models').Tag;
var rp = require('request-promise');
var findOrCreate = require('mongoose-findorcreate')
var Handlebars = require('handlebars')

var utils = {
  category: null,
  approve: function(master) {
    //change approved to true
    master.approved = true;
    master.category = this.category;
    return master.save();
  }
}

class Utils {
  constructor() {
    return utils;
  }
}
module.exports = Utils;
