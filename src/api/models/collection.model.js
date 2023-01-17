const mongoose = require('mongoose')

/**
 * Collection Schema
 * @private
 */
const CollectionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    name: { type: String, required: true },
    address: { type: String },
    nameLower: { type: String, required: true, lowercase: true },

    // imgs. with ipfs path
    logo: { type: String },
    featuredImg: { type: String },
    banner: { type: String },

    // imgs. saved on server
    logoLocal: { type: String },
    featuredImgLocal: { type: String },
    bannerLocal: { type: String },

    url: { type: String, required: true, unique: true, lowercase: true }, // slug
    description: { type: String },
    siteLink: { type: String },
    discordLink: { type: String },
    instaLink: { type: String },
    mediumLink: { type: String },
    telegramLink: { type: String },

    bscType: { type: Number }, // 1 = BSC Mainnet, 2 = BSC Testnet
    show: { type: Boolean, default: false, required: true },
    lastFetched: { type: Number, default: 0 },
    autoColId: { type: Number },

    isNotableDrop: { type: Boolean, default: false }
}, { timestamps: true }
)

/**
 * @typedef Collection
 */

module.exports = mongoose.model('Collection', CollectionSchema)