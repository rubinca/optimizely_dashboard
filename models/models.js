var mongoose = require('mongoose');
var findOrCreate = require('mongoose-findorcreate');

var masterSchema = mongoose.Schema({
  name: String,
  displayName: String,
  tokens: Array,
  tagDescription: String,
  hasCallback: Boolean,
  approved: Boolean,
  callbackCode: String,
  template: String,
  category: String
});

var userSchema = mongoose.Schema({
  username: String,
  password: String
});

masterSchema.plugin(findOrCreate);
module.exports = {
  'Master': mongoose.model('Master', masterSchema),
  'User': mongoose.model('User', userSchema)
};
