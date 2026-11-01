/**
 * AuditTrail AI — Atlassian Forge Root Resolver Entrypoint
 * Bridges to compiled resolver handlers in dist/index.js
 */

const resolver = require('./dist/index');

module.exports = {
  run: resolver.run,
};
