const express = require('express')
const categoryRoutes = require('./categories.route')
const userRoutes = require('./users.route')
const adminRoutes = require('./admin.route')
const roleRoutes = require('./roles.route')
const collectionRoutes = require('./collection.route')
const creatorRoutes = require('./creator.route')
const nftsRoutes = require('./nfts.route')
const auctionsRoutes = require('./auctions.route')
const emailRoutes = require('./email.route')
const settingsRoutes = require('./settings.route')
const faqRoutes = require('./faq.route')
const contactRoutes = require('./contact.route')
const cmsRoutes = require('./cms.routes')
const activityRoutes = require('./activity.route')
const reportsRoutes = require('./reports.route')
const subscriptionRoutes = require('./subscription.route')
const router = express.Router()

/**
 * GET v1/admin
 */
router.use('/staff', adminRoutes)
router.use('/role', roleRoutes)
router.use('/category', categoryRoutes)
router.use('/user', userRoutes)
router.use('/collection', collectionRoutes)
router.use('/creator', creatorRoutes)
router.use('/nfts', nftsRoutes)
router.use('/auctions', auctionsRoutes)
router.use('/email', emailRoutes)
router.use('/settings', settingsRoutes)
router.use('/faq', faqRoutes)
router.use('/contacts', contactRoutes)
router.use('/content', cmsRoutes)
router.use('/activity', activityRoutes)
router.use('/reports', reportsRoutes)
router.use('/subscriptions', subscriptionRoutes)

module.exports = router