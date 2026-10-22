const buildContentRouter = require('./contentFactory');
module.exports = buildContentRouter('testimonials', ['name', 'role', 'quote', 'image'], {
  requiredFields: ['name', 'quote'],
});
