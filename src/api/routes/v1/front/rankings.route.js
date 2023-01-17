const express = require('express');
const controller = require('../../../controllers/front/rankings.controller');
const router = express.Router();

router.route('/create').post(controller.create);
router.route('/list').get(controller.list);
router.route('/trending-collections').get(controller.trendingCollections);
router.route('/top-collections').get(controller.topCollections);

module.exports = router;