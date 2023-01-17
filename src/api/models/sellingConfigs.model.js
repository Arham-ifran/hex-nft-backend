const mongoose = require('mongoose');

/**
 * SellingConfig Schema
 * @private
 */
const sellingConfigSchema = new mongoose.Schema({
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nftId: { type: mongoose.Schema.Types.ObjectId, ref: 'NFT', required: true },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
    sellingMethod: { type: Number }, // 1 = Fixed Price, 2 = Timed Auction
    sellingConfig: { type: Object },
    auctionStartDate: { type: Date }, // start date for auction or fixed price
    auctionEndDate: { type: Date }, // end date for auction or fixed price
    auctionStartTime: { type: String },
    auctionEndTime: { type: String },
    currency: { type: String },
    currentPrice: { type: Number },
}, { timestamps: true }
);

/**
 * @typedef SellingConfig
 */

module.exports = mongoose.model('SellingConfigs', sellingConfigSchema);