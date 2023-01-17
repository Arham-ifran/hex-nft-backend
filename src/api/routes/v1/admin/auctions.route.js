const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/auctions.controller')

router.route('/list').get(controller.live)

module.exports = router