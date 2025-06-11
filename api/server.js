const serverless = require("serverless-http");
const app = require("../server");

// Configure serverless-http with options for better performance
const handler = serverless(app, {
  binary: ["image/*", "application/pdf", "font/*"],
  request: (request, event, context) => {
    // Set timeout context
    context.callbackWaitsForEmptyEventLoop = false;
  },
});

// Export the serverless function
module.exports = handler;
