const mongoose = require('mongoose');

/**
 * Stats Schema
 * @private
 */
const StatsSchema = new mongoose.Schema({
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
    volume: { type: Number, default: 0 }, // all time
    owners: { type: Number, default: 0 },
    assets: { type: Number, default: 0 },
    p24h: { type: String }, // 24h% for display
    p7d: { type: String }, // 7d% for display
    p30d: { type: String }, // 30d% for display
    v24h: { type: Number, default: 0 }, // value 24h%
    v7d: { type: Number, default: 0 }, // value 7d%
    v30d: { type: Number, default: 0 }, // value 30d%
}, { timestamps: true }
);

/**
 * @typedef Stats
 */

module.exports = mongoose.model('Stats', StatsSchema);