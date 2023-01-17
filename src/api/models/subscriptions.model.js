const mongoose = require('mongoose');

/**
 * Stats Schema
 * @private
 */
const SubscriptionsSchema = new mongoose.Schema({
    userEmail: { type: String, required : true},
    ipAddress: { type: String }
}, { timestamps: true }
);

/**
 * @typedef Stats
 */

module.exports = mongoose.model('Subscriptions', SubscriptionsSchema);