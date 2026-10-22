const buildContentRouter = require('./contentFactory');
module.exports = buildContentRouter('timeline', ['year', 'title', 'description'], {
  requiredFields: ['year', 'title'],
});
