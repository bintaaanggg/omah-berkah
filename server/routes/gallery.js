const buildContentRouter = require('./contentFactory');
module.exports = buildContentRouter('gallery', ['image', 'caption'], {
  requiredFields: ['image'],
});
