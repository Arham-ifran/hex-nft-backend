const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/admin/nfts.controller')

router.route('/list').get(controller.list)
router.route('/get/:nftId').get(controller.get)
router.route('/edit').put(controller.edit)

module.exports = router