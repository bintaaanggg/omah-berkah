const buildContentRouter = require('./contentFactory');
module.exports = buildContentRouter('programs', ['title', 'description', 'image', 'icon', 'target_amount'], {
  requiredFields: ['title', 'description'],
  withRaised: true,
});
