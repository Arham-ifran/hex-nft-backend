const mongoose = require('mongoose');

/**
 * Favourite Schema
 * @private
 */
const FavouriteSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId},
    nftId: { type: mongoose.Schema.Types.ObjectId},
}, { timestamps: true }
);

/**
 * @typedef Favourites
 */

module.exports = mongoose.model('Favourites', FavouriteSchema);