
'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();

const membresController = require('../controllers/membres.controller');
const validate = require('../middleware/validate');
const { requireAuth, requireAdmin } = require('../middleware/humhubAuth');

// ─── Public ───────────────────────────────────────────────────────────────────
router.get('/', membresController.list);
router.get('/:id',
  [param('id').isInt({ min: 1 }), validate],
  membresController.show,
);

// ─── Admin ────────────────────────────────────────────────────────────────────
const memberBodyRules = [
  body('nom_fr').notEmpty().withMessage('nom_fr est requis'),
  body('prenom_fr').optional(),
  body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
  body('bureau').optional().isBoolean(),
  body('gstfc').optional().isBoolean(),
  body('president_commission').optional().isBoolean(),
  body('rapporteur_commission').optional().isBoolean(),
];

router.post('/', requireAdmin, memberBodyRules, validate, membresController.create);
router.put('/:id', requireAdmin,
  [param('id').isInt({ min: 1 }), ...memberBodyRules, validate],
  membresController.update,
);
router.delete('/:id', requireAdmin,
  [param('id').isInt({ min: 1 }), validate],
  membresController.destroy,
);

module.exports = router;
