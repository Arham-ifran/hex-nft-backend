const express = require('express');
const controller = require('../../../controllers/gamification/collection.controller');
const router = express.Router();

router.route('/recent/:address').get(controller.getRecent); // API is to get the last 2 collections of a given user.

module.exports = router;