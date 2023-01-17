const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/front/reports.controller')
const { uploadContentImage } = require('../../../utils/upload')

router.route('/add-report').post(controller.create)
router.route('/upload').post(uploadContentImage, controller.uploadReportImg)
router.route('/get/:userId').post(controller.get)
router.route('/get-report/:reportId').get(controller.getReport)
router.route('/add-report-response').post(controller.addReportResponse)
router.route('/reported-nft-users').post(controller.getReportedNftUsers)//reported-nft-users

module.exports = router