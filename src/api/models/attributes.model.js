const mongoose = require('mongoose');

/**
 * Attributes Schema
 * @private
 */
const AttributesSchema = new mongoose.Schema({
    trait_type: { type: String, required: true },
    value: { type: String, required: true },
    nftId: { type: mongoose.Schema.Types.ObjectId, ref: 'NFT', required: true },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection', required: true },
}, { timestamps: true }
);

/**
 * @typedef Attributes
 */

module.exports = mongoose.model('Attributes', AttributesSchema);