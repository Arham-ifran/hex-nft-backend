const mongoose = require('mongoose');

/**
 * Category Schema
 * @private
 */
const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String },
    image: { type: String, required: true },
    imageLocal: { type: String, required: true },
    banner: { type: String },
    bannerLocal: { type: String },
    status: { type: Boolean, required: true, default: false }
}, { timestamps: true }
);

/**
 * @typedef Category
 */

module.exports = mongoose.model('Category', CategorySchema);