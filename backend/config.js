'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

module.exports = {
  port: parseInt(process.env.PORT || '3001', 10)
};
