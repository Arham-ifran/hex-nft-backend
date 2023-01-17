const mongoose = require('mongoose');

/**
 * Offer Schema
 * @private
 */
const OfferSchema = new mongoose.Schema({
    offerBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // owner at time of offer
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
    isPriceDiscounted : { type: Boolean, default: false},
    txHash: { type: String },
    signature: { type: String }, // sign for making an offer
    acceptSign: { type: String }, // sign for accepting an offer
}, { timestamps: true }
);

/**
 * @typedef Offer
 */

module.exports = mongoose.model('Offer', OfferSchema);