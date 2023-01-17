const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/front/nfts.controller')
const { cpUpload, createNftUploads } = require('../../../utils/upload')

router.route('/create').post(createNftUploads, controller.create)
router.route('/unset').post(controller.delete)
router.route('/edit').put(cpUpload, controller.edit)
router.route('/get/:nftId').get(controller.get)
router.route('/list').get(controller.list)
router.route('/search/:name').get(controller.search)
router.route('/unset-selling-config').put(controller.unsetSellingConfig)
router.route('/auto-sell').put(controller.autoSell) // API to sell to the highest bidder OR with fixed or declining price
router.route('/update-token-ids').put(cpUpload, controller.updateTokenIds) // API to update tokenIds for given NFTs - special case
router.route('/history').get(controller.getHistory)
router.route('/update-metadata').post(controller.updateMetadata)
router.route('/cancel-listing').put(controller.cancelListing)
router.route('/verify-ownership').get(controller.verifyOwnership)
router.route('/transfer-ownership').put(controller.transferOwnership) // API to transfer ownership instantly (e.g. if user tranferred NFT to another user through bscscan.com then after transfer update NFT detail in db)
router.route('/buy-with-paypal').post(controller.buyWithPayPal)
router.route('/buy').post(controller.buy)
router.route('/homepage-nfts').get(controller.getHomePageNfts)

module.exports = router