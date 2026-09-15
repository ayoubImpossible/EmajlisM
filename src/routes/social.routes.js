'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/social.controller');
const { requireAuth } = require('../middleware/humhubAuth');

// Commentaires — montés sur /api/comments
const comments = express.Router();
comments.get('/content/:contentId', requireAuth, ctrl.listComments);
comments.post('/', requireAuth, ctrl.createComment);
comments.delete('/:id', requireAuth, ctrl.deleteComment);

// Likes — montés sur /api/likes
const likes = express.Router();
likes.get('/status', requireAuth, ctrl.likeStatus);
likes.post('/', requireAuth, ctrl.like);
likes.delete('/', requireAuth, ctrl.unlike);

module.exports = { comments, likes };
