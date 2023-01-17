const mongoose = require('mongoose');

/**
 * Activity Schema
 * @private
 */
const ActivitySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nftId: { type: mongoose.Schema.Types.ObjectId, ref: 'NFT' },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
    type: { type: Number }, // 1 == Creation, 2 == Offers, 3 == Bids, 4 == Accept Offer, 5 == Accept Bid, 6 == Listing, 7 == Sales, 8 = Staked
    price: { type: Number },
    currency: { type: String }
}, { timestamps: true }
);

/**
 * @typedef Activities
 */

module.exports = mongoose.model('Activities', ActivitySchema);