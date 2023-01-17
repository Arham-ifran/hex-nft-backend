const Activity = require('../../models/activity.model')
const { baseUrl } = require('../../../config/vars')

// API to get activity list
exports.list = async (req, res, next) => {
    try {
        let { page, limit } = req.query

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        const total = await Activity.countDocuments()

        const activity = await Activity.aggregate([
            { $sort: { createdAt: -1 } },
            { $skip: limit * (page - 1) },
            { $limit: limit },
            {
                $lookup: {
                    from: 'nfts',
                    foreignField: '_id',
                    localField: 'nftId',
                    as: 'nft'
                }
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
                $lookup: {
                    from: 'users',
                    foreignField: '_id',
                    localField: 'userId',
                    as: 'user'
                }
            },
            {
                $project: {
                    type: 1, price: 1, currency: 1, createdAt: 1,
                    user: {
                        $cond: [
                            { $ne: ['$user', []] },
                            {
                                _id: { $arrayElemAt: ['$user._id', 0] },
                                username: { $arrayElemAt: ['$user.username', 0] },
                                address: { $arrayElemAt: ['$user.address', 0] },
                            },
                            null
                        ]
                    },
                    toUser: {
                        $cond: [
                            { $ne: ['$toUser', []] },
                            {
                                _id: { $arrayElemAt: ['$toUser._id', 0] },
                                username: { $arrayElemAt: ['$toUser.username', 0] },
                                address: { $arrayElemAt: ['$toUser.address', 0] },
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
                                image: {
                                    $ifNull: [{ $concat: [baseUrl, { $arrayElemAt: ['$nft.imageLocal', 0] }] }, '']
                                }
                            },
                            null
                        ]
                    }
                }
            }
        ])

        return res.send({
            success: true, message: 'Activities fetched successfully',
            data: {
                activity,
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