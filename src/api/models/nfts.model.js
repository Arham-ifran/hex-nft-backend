const mongoose = require('mongoose');

/**
 * NFT Schema
 * @private
 */
const NFTSchema = new mongoose.Schema({
    name: { type: String },
    description: { type: String },
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
    currentPrice: { type: Number },
    currency: { type: String },
    txHash: { type: String },
    copies: { type: Number, default: 0 },
    status: { type: Number, default: 1 }, // 1 = Idle, 2 = On Sale
    sellingMethod: { type: Number }, // 1 = Fixed Price, 2 = Timed Auction
    sellingConfig: { type: Object },
    auctionStartDate: { type: Date }, // start date for auction or fixed price
    auctionEndDate: { type: Date }, // end date for auction or fixed price
    auctionStartTime: { type: String },
    auctionEndTime: { type: String },
    metaData: { type: String }, // ipfs link
    tokenId: { type: Number },
    attributes: { type: Array, default: [] },
    isCustom: { type: Boolean, default: false },
    address: { type: String },
    autoNftId: { type: Number },
    ownerVerification: { type: Boolean, default: false },
    stakeSign: { type: String }, // sign for staking NFT
    unstakeSign: { type: String }, // sign for unstaking NFT
    createdSign: { type: String }, // sign for creating NFT
    sellingSign: { type: String }, // sign for selling NFT
    cancelListingSign: { type: String }, // sign for cancel listing NFT
    mediaType: { type: Number, default: 1 }, // 1 = Images, setting default for images

    image: { type: String }, // thumbnails for media (images, pdfs, ppts..etc) saved with ipfs
    imageLocal: { type: String }, // thumbnails saved on server

    file: { type: String }, // nft files ( audio, video, pdfs,.etc) save with ipfs
    fileLocal: { type: String }, // nft files saved on server

    type: { type: Number, default: 1, required: true }, // 1 = Simple NFT, 2 = NFTC

    belongsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'NFT' }, // it represents original NFT Id. This is not for Simple NFT

    platformShare: { type: Number }, // platform share for future sale of simple NFT
    commissions: { type: Array }, // other sellers commissions stored in sorted manner i.e. [cT1, cT2, ..., cTn]
    nftcId: { type: Number }, // NFTC Id to sort NFTCs of same NFT i.e. 1, 2, ..., n

    isStaked: { type: Boolean, default: false }, // represents that NFT is of NFTD type
    stakingDate: { type: Date }, // date for staking a NFT
    stakingDays: { type: Number }, // no. of days for staking a NFT
    stakingPrice: { type: String },
    stakeTxHash: { type: String },
    unstakeTxHash: { type: String },
    stakeId: { type: String },

    showInHomePage: { type: Boolean, default: false },

    rights: { type: Number } // rights management, 1 = Contribution, 2 = Exclusivity, 3 = Non-Exclusive
}, { timestamps: true }
);

/**
 * @typedef NFT
 */

module.exports = mongoose.model('NFT', NFTSchema);