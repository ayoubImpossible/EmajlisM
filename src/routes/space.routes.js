'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/space.controller');
const feedCtrl = require('../controllers/feed.controller');
const { requireAuth } = require('../middleware/humhubAuth');

// Liste et détail : relais direct vers HumHub (17 espaces réels).
// À ne pas confondre avec /api/espaces, qui sert 8 espaces codés en dur.
router.get('/', requireAuth, feedCtrl.getSpaces);
router.get('/:id', requireAuth, feedCtrl.getSpace);

// Membres réels de l'espace — et non l'annuaire général.
router.get('/:id/members', requireAuth, ctrl.members);

// Pages personnalisées, avec le raccourci déjà résolu (drive / cfiles /
// recherche / lien), pour que le mobile n'ait qu'à router.
router.get('/:containerId/pages', requireAuth, ctrl.pages);

// Modules réellement activés dans l'espace : le menu doit être construit
// à partir de cette liste, jamais codé en dur.
router.get('/:containerId/modules', requireAuth, ctrl.modules);

// Fil de l'espace.
router.get('/:containerId/feed', requireAuth, feedCtrl.getSpaceFeed);

module.exports = router;
