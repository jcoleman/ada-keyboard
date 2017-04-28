const register = require('babel-register');
register({
  ignore: /node_modules\/(?!openjscad)/,
});
