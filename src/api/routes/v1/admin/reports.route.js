const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/reports.controller')
const { uploadContentImage } = require('../../../utils/upload')

router.route('/create').post(controller.create)
router.route('/upload').post(uploadContentImage, controller.uploadReportImg)
router.route('/edit').put(controller.edit)
router.route('/delete/:reportId').delete(controller.delete)
router.route('/get/:reportId').get(controller.get)
router.route('/list').post(controller.list)
router.route('/add-report-response').post(controller.addReportResponse)
router.route('/get-report-messages').post(controller.getReportMessages)



module.exports = router