const mongoose = require('mongoose');

/**
 * GiftCardLogs Schema
 * @private
 */
const GiftCardLogs = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId },
    nftId: { type: mongoose.Schema.Types.ObjectId },
    collectionId: { type: mongoose.Schema.Types.ObjectId },
    offerId: { type: mongoose.Schema.Types.ObjectId },
    bidId: { type: mongoose.Schema.Types.ObjectId },
    token: { type: String }, // voucher code
    paymentMethod: { type: Number }, // 1-> Buy Now, 2-> Buy with Paypal, 3-> Buy through Offer , 4-> Buy through Bid
    originalPrice: { type: Number },
    currency: { type: String }, // BNB, MYNT
    discountedPrice: { type: Number },
    discount: { type: Number }, // amount in percentage
    isGiftCardUsed : { type: Boolean }
}, { timestamps: true }
);

/**
 * @typedef GiftCardLogs
 */

module.exports = mongoose.model('GiftCardLogs', GiftCardLogs);