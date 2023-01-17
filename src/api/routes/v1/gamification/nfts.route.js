const express = require('express');
const controller = require('../../../controllers/gamification/nfts.controller');
const router = express.Router();

router.route('/recent/:address').get(controller.getRecent); // API to get 5 most recent created NFTs of requested user
router.route('/collectibles/:address').get(controller.getRecentCollectibles); // API is to get the last 6 collectibles (i.e. created NFTs) of a given user.

module.exports = router;