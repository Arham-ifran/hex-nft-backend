const express = require('express');
const controller = require('../../../controllers/front/activity.controller');
const router = express.Router();

router.route('/list/:type').get(controller.list);

module.exports = router;