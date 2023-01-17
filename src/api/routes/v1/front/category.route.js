const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/front/category.contoller')

router.route('/get').post(controller.get)
router.route('/list').get(controller.list)

module.exports = router