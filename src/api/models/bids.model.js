const mongoose = require('mongoose');

/**
 * Bid Schema
 * @private
 */
const BidSchema = new mongoose.Schema({
    bidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nftId: { type: mongoose.Schema.Types.ObjectId, ref: 'NFT', required: true },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true },
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
    expiryDate: { type: Date, required: true },
    isAccepted: { type: Boolean, default: false, required: true },
    isExpired: { type: Boolean, default: false, required: true },
    txHash: { type: String },
    signature: { type: String }, // sign for placing a bid
    acceptSign: { type: String }, // sign for accepting a bid
}, { timestamps: true }
);

/**
 * @typedef Bid
 */

module.exports = mongoose.model('Bid', BidSchema);