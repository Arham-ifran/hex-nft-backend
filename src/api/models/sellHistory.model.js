const mongoose = require('mongoose')

/**
 * Sell History Schema - This schema is top get top sellers etc.
 * @private
 */
const SellHistorySchema = new mongoose.Schema({
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nftId: { type: mongoose.Schema.Types.ObjectId, ref: 'NFT', required: true },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true },
    sold: { type: Boolean, default: false },
    price: {
        type: Object,
        default: {
            currency: {
                type: String, default: ''
            },
            amount: {
                type: Number, default: 0
            }
        },
        required: true
    },
    txHash: { type: String },
    buySign: { type: String }, // sign for buying a NFT
    paymentId: { type: String },
    paymentToken: { type: String },
    payerId: { type: String },
    paymentMethod: { type: Number, default: 1 }, // 1 = Simple buy, 2 = with PayPal
}, { timestamps: true }
);

/**
 * @typedef SellHistory
 */

module.exports = mongoose.model('SellHistory', SellHistorySchema);