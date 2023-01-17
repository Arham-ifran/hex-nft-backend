const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/collection.controller')
const { collectionUpload } = require('../../../utils/upload')

router.route('/list').post(controller.list)
router.route('/get/:collectionId').get(controller.get)
router.route('/edit').put(collectionUpload, controller.edit)

module.exports = router