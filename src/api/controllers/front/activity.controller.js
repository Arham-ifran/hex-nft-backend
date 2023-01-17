const atob = require('atob')
const Activity = require('../../models/activity.model')
const { baseUrl, nftImgPlaceholder } = require('../../../config/vars')

// API to get Activity list
exports.list = async (req, res, next) => {
    try {
        let { type } = req.params
        let { page, limit, search } = req.query
        let filter = {}
        let nftFilter = {}

        if (search) {
            const decQuery = atob(search)
            search = decQuery
            nftFilter['nft.name'] = { $regex: search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: 'gi' }
        }

        if (type !== 'null') {
            if (type !== 't') {
                type = parseInt(type)
                filter = { type }
            }
            else {
                filter = { $or: [{ type: 4 }, { type: 5 }] }
            }
        }

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        const activities = await Activity.aggregate([
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $skip: limit * (page - 1) },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    foreignField: '_id',
                    localField: 'userId',
                    as: 'user'
                }
            },
            {
                $lookup: {
                    from: 'nfts',
                    foreignField: '_id',
                    localField: 'nftId',
                    as: 'nft'
                }
            },
            {
                $match: nftFilter
            },
            {
                $lookup: {
                    from: 'users',
                    foreignField: '_id',
                    localField: 'toUserId',
                    as: 'toUser'
                }
            },
            {
                $project: {
                    type: 1, price: 1, currency: 1, createdAt: 1,
                    toUserName: { $ifNull: [{ $arrayElemAt: ['$toUser.username', 0] }, ''] },
                    toUserId: { $ifNull: [{ $arrayElemAt: ['$toUser._id', 0] }, ''] },
                    user: {
                        $cond: [
                            { $ne: ['$user', []] },
                            {
                                _id: { $arrayElemAt: ['$user._id', 0] },
                                username: { $arrayElemAt: ['$user.username', 0] },
                            },
                            null
                        ]
                    },
                    nft: {
                        $cond: [
                            { $ne: ['$nft', []] },
                            {
                                _id: { $arrayElemAt: ['$nft._id', 0] },
                                name: { $arrayElemAt: ['$nft.name', 0] },
                                desc: { $arrayElemAt: ['$nft.description', 0] },
                                type: { $arrayElemAt: ['$nft.type', 0] },
                                isStaked: { $arrayElemAt: ['$nft.isStaked', 0] },
                                image: {
                                    $ifNull: [{ $concat: [baseUrl, { $arrayElemAt: ['$nft.imageLocal', 0] }] }, nftImgPlaceholder]
                                }
                            },
                            null
                        ]
                    },
                }
            },
        ])

        return res.send({
            success: true, message: 'Activities fetched successfully',
            data: {
                activities
            }
        })
    } catch (error) {
        return next(error)
    }
}

