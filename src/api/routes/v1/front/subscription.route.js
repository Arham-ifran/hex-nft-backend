const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/front/subscription.controller')

router.route('/create').post(controller.createSubscription)

module.exports = router