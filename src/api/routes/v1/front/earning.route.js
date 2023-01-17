const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/front/earning.controller')

router.route('/owner-earnings').post(controller.list)

module.exports = router