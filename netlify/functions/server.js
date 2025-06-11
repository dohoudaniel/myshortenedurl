const app = require("../../server");

exports.handler = async (event, context) => {
  return app.render(event, context);
}