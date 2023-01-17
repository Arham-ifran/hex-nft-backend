const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/front/cms.controller')


router.route('/get-content-page/:slug').get(controller.get)
router.route('/list').get(controller.list)

module.exports = router