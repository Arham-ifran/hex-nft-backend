const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/categories.controller.js')
const { categoryUpload } = require('../../../utils/upload')

router.route('/create').post(categoryUpload, controller.create)
router.route('/edit').put(categoryUpload, controller.edit)
router.route('/delete/:categoryId').delete(controller.delete)
router.route('/get/:categoryId').get(controller.get)
router.route('/list').post(controller.list)

module.exports = router