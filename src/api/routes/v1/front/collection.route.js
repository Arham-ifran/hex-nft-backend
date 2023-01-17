const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/front/collection.controller')
const { collectionUpload } = require('../../../utils/upload')

router.route('/create').post(collectionUpload, controller.create)
router.route('/edit').put(collectionUpload, controller.edit)
router.route('/delete/:collectionId').delete(controller.delete)
router.route('/get/:collectionId').get(controller.get)
router.route('/list').get(controller.list)
router.route('/integrate').post(controller.integrate)
router.route('/fetchCustomNfts').post(controller.fetchCollectionsNFTs)
router.route('/sync-metadata').post(controller.syncMetadata) // API for CRON to sync. metadata
router.route('/notable-drops').get(controller.getNotableDrops)

module.exports = router