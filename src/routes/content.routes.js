'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/content.controller');
const { requireAuth } = require('../middleware/humhubAuth');

router.get('/:id', requireAuth, ctrl.show);

module.exports = router;
