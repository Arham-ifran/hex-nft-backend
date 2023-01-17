const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/creator.controller')
const { cpUpload } = require('../../../utils/upload')

router.route('/edit').put(cpUpload, controller.edit)
router.route('/delete/:creatorId').delete(controller.delete)
router.route('/get/:creatorId').get(controller.get)
router.route('/list').get(controller.list)

module.exports = router