const moment = require('moment')
const NFT = require('../../models/nfts.model')
const { baseUrl, nftImgPlaceholder } = require('../../../config/vars')
const ObjectId = require('mongoose').Types.ObjectId

// API to get live auctions
exports.live = async (req, res, next) => {
    try {
        let { page, limit } = req.query
        const userId = req.user

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 12

        const filter = {
            sellingMethod: 2, // timed auctions only
            auctionStartDate: { $lte: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')) },
            auctionEndDate: { $gte: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')) }
        }

        const total = await NFT.countDocuments(filter)

        const auctions = await NFT.aggregate([
            {
                $match: filter
            },
            {
                $lookup: {
                    from: 'favourites',
                    foreignField: 'nftId',
                    localField: '_id',
                    as: 'favourite'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    foreignField: '_id',
                    localField: 'ownerId',
                    as: 'owner'
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: limit * (page - 1) },
            { $limit: limit },
            {
                $project: await getKeys(userId)
            }
        ])

        return res.send({
            success: true, message: 'Live auctions retrieved successfully',
            data: {
                filter,
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

const getKeys = (userId) => {
    let keys = {
        _id: 1, name: 1,
        image: { $ifNull: [{ $concat: [baseUrl, '$imageLocal'] }, nftImgPlaceholder] },
        copies: 1, currentPrice: 1, auctionEndDate: 1, currency: 1,
        sellingMethod: 1, status: 1, type: 1, isStaked: 1,
        favourite: '$favourite',
        owner: {
            $cond: [
                { $ne: ['$owner', []] },
                {
                    _id: { $arrayElemAt: ['$owner._id', 0] },
                    username: { $arrayElemAt: ['$owner.username', 0] }
                },
                null
            ]
        }
    }

    if (userId)
        keys.userFavourite = {
            $filter: {
                input: "$favourite",
                cond: { $eq: ["$$this.userId", ObjectId(userId)] }
            }
        }

    return keys
}