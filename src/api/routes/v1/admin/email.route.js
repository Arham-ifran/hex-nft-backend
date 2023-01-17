const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/email.controller')
const { cpUpload } = require('../../../utils/upload')

router.route('/create').post(controller.create)
router.route('/edit').put(cpUpload, controller.edit)
router.route('/get/:emailId').get(controller.get)
router.route('/list').get(controller.list)

module.exports = router