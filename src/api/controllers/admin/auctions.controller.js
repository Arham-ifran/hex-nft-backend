const NFT = require('../../models/nfts.model')
const moment = require('moment')
const { baseUrl, nftImgPlaceholder, userDefaultImage, colLogoPlaceholder } = require('../../../config/vars')

// API to get live auctions
exports.live = async (req, res, next) => {
    try {
        let { page, limit, collectionId } = req.query
        const userId = req.user

        let filter = {
            sellingMethod: 2, // timed auctions only
            auctionStartDate: { $lte: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')) },
            auctionEndDate: { $gte: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')) }
        }

        // get auctions for given collection 
        if (collectionId)
            filter.collectionId = ObjectId(collectionId)

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        const total = await NFT.countDocuments(filter)

        const auctions = await NFT.aggregate([
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $skip: limit * (page - 1) },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    foreignField: '_id',
                    localField: 'ownerId',
                    as: 'owner'
                }
            },
            {
                $unwind: '$owner'
            },
            {
                $lookup: {
                    from: 'users',
                    foreignField: '_id',
                    localField: 'creatorId',
                    as: 'creator'
                }
            },
            {
                $unwind: '$creator'
            },
            {
                $lookup: {
                    from: 'collections',
                    foreignField: '_id',
                    localField: 'collectionId',
                    as: 'collection'
                }
            },
            {
                $unwind: '$collection'
            },
            {
                $project: {
                    _id: 1, name: 1,
                    image: { $ifNull: [{ $concat: [baseUrl, '$imageLocal'] }, nftImgPlaceholder] },
                    copies: 1, currentPrice: 1, auctionEndDate: 1, currency: 1,
                    sellingMethod: 1, status: 1, type: 1,
                    owner: {
                        _id: '$owner._id',
                        username: '$owner.username',
                        profileImage: { $ifNull: [{ $concat: [baseUrl, '$owner.profileImageLocal'] }, userDefaultImage] }
                    },
                    creator: {
                        _id: '$creator._id',
                        username: '$creator.username',
                        profileImage: { $ifNull: [{ $concat: [baseUrl, '$creator.profileImageLocal'] }, userDefaultImage] }
                    },
                    collection: {
                        _id: '$collection._id',
                        name: '$collection.name',
                        logo: { $ifNull: [{ $concat: [baseUrl, '$collection.logoLocal'] }, colLogoPlaceholder] }
                    }
                }
            }
        ])

        return res.send({
            success: true, message: 'Auctions fetched successfully',
            data: {
                auctions,
                pagination: {
                    page, limit, total,
                    pages: Math.ceil(total / limit) <= 0 ? 1 : Math.ceil(total / limit)
                }
            }
        })
    } catch (error) {
        return next(error)
    }
}