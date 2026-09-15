/**
 * Request validation middleware (express-validator)
 * Supports both:
 *   validate([rule1, rule2])           ← array form (used in route files)
 *   validate  as a single middleware   ← direct use after rules array
 */
'use strict';

const { validationResult } = require('express-validator');

// Called directly as a middleware after express-validator chains
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error:  'Données invalides.',
      fields: errors.array().map(e => ({ field: e.path || e.param, message: e.msg })),
    });
  }
  next();
}

module.exports = validate;
