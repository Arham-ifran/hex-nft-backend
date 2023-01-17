const express = require('express');
const controller = require('../../../controllers/gamification/activity.controller');
const router = express.Router();

router.route('/recent/:address').get(controller.getRecent); // API to get 5 most recent activities of requested user

module.exports = router;