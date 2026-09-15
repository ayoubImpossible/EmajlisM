'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/humhubAuth');

// POST /api/auth/login   — relais vers HumHub, renvoie jeton + utilisateur
router.post('/login', ctrl.login);

// GET  /api/auth/me      — utilisateur courant
router.get('/me', requireAuth, ctrl.me);

// Profil : PUT est la forme correcte ; POST est conservé, l'application
// l'utilise encore.
router.put('/profile', requireAuth, ctrl.updateProfile);
router.post('/profile', requireAuth, ctrl.updateProfile);

module.exports = router;
