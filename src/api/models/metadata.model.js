const mongoose = require('mongoose')

/**
 * Metadata Schema - Model to add requests in pool for update metadata
 * @private
 */
const MetadataSchema = new mongoose.Schema({
    requestId: { type: Number },
    nftId: { type: mongoose.Schema.Types.ObjectId, ref: 'NFT', required: true },
    tokenId: { type: Number, required: true },
    address: { type: String, required: true },
    isSkipped: { type: Boolean, required: true, default: false } // flag to store req. status if it is skipped 'cause of some error
}, { timestamps: true }
)

/**
 * @typedef Metadata
 */

module.exports = mongoose.model('Metadata', MetadataSchema)