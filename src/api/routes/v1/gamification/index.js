const express = require('express')
const activityRoutes = require('./activity.route')
const nftsRoutes = require('./nfts.route')
const usersRoutes = require('./users.route')
const collectionRoutes = require('./collection.route')
const router = express.Router()

router.use('/activity', activityRoutes)
router.use('/nfts', nftsRoutes)
router.use('/users', usersRoutes)
router.use('/collection', collectionRoutes)

module.exports = router
