const serverless = require('serverless-http');
const app = require('../server');

// Export the serverless function
module.exports = serverless(app);
