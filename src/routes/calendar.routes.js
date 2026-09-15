'use strict';

const express = require('express');
const router  = express.Router();

const calCtrl        = require('../controllers/calendar.controller');
const { optionalAuth, requireAdmin } = require('../middleware/humhubAuth');

// Public read – GET /api/calendar  or  /api/calendar/events
router.get('/',         optionalAuth, calCtrl.list);
router.get('/events',   optionalAuth, calCtrl.list);
router.get('/:id',      optionalAuth, calCtrl.show);

// Admin write
router.post('/',        requireAdmin, calCtrl.create);
router.put('/:id',      requireAdmin, calCtrl.update);
router.delete('/:id',   requireAdmin, calCtrl.destroy);

module.exports = router;
