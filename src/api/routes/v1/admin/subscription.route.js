const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/subscription.controller')

router.route('/subscribed-users').get(controller.listSubscriptions)

module.exports = router