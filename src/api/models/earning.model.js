const mongoose = require('mongoose')

/**
 * Earning Schema - This schema is top get owner earnings etc.
 * @private
 */
const EarningSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    nftId: { type: mongoose.Schema.Types.ObjectId, ref: 'NFT', required: true },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true },
    price: {  // fee earned by owner
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
    status: { type: Number, default: 1 }, // 1 = Pending, 2 = Transferred
}, { timestamps: true }
);

/**
 * @typedef Earning
 */

module.exports = mongoose.model('Earning', EarningSchema);