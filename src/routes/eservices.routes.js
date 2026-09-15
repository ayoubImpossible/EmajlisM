'use strict';

const express = require('express');
const router  = express.Router();

const esvCtrl  = require('../controllers/eservices.controller');
const { requireAuth } = require('../middleware/humhubAuth');
const upload   = require('../middleware/upload');

// Catalogue : types, statuts, champs par type, et `is_manager` pour
// l'utilisateur courant. Jamais mis en cache — l'habilitation est personnelle.
router.get('/catalog', requireAuth, esvCtrl.getCatalog);

// Formulaires historiques, conservés tant que les écrans mobiles les appellent.
router.post('/hebergement',   requireAuth, esvCtrl.submitHebergement);
router.post('/billet',        requireAuth, esvCtrl.submitBillet);
router.post('/documentation', requireAuth, upload.array('attachments', 5), esvCtrl.submitDocumentation);
router.post('/support',       requireAuth, esvCtrl.submitSupport);

// Demande unifiée.
router.post('/request',  requireAuth, esvCtrl.createRequest);
router.get('/request/:id', requireAuth, esvCtrl.getOne);
router.post('/request/:id/status', requireAuth, esvCtrl.updateStatus);

// Listes.
router.get('/requests',     requireAuth, esvCtrl.mesDemandes);
router.get('/mes-demandes', requireAuth, esvCtrl.mesDemandes);
router.get('/admin',        requireAuth, esvCtrl.adminList);

// Routes historiques placées en dernier : `/:id` capturerait sinon `/catalog`.
// PATCH /:id/status est appelé par AdminDemandesScreen ; il manquait, et l'écran
// recevait un 404 sans que rien ne le signale.
router.patch('/:id/status', requireAuth, esvCtrl.updateStatus);
router.get('/:id', requireAuth, esvCtrl.getOne);

module.exports = router;
