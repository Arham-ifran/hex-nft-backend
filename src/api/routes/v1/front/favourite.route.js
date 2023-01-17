const express = require('express')
const router = express.Router()
const controller = require('../../../controllers/front/favourite.controller')

// router.route('/list').get(controller.list)
router.route('/add-to-favourite').post(controller.addToFavourite)
router.route('/get-favourites').post(controller.getUserFavourites)
router.route('/remove-favourite').delete(controller.removeFromFavourites)



module.exports = router