const ObjectId = require('mongoose').Types.ObjectId
const User = require('../../models/users.model')
const Earning = require('../../models/earning.model')
const { baseUrl, nftImgPlaceholder } = require('../../../config/vars')

// API to fetch owners earnings for given user
exports.list = async (req, res, next) => {
    try {
        let { page, limit } = req.body
        const userId = req.user

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 100

        const filter = {
            userId: ObjectId(userId)
        }

        // count total docs.
        const total = await Earning.countDocuments(filter)

        if (page > Math.ceil(total / limit) && total > 0)
            page = Math.ceil(total / limit)

        const earnings = await Earning.aggregate([
            { $match: filter },
            {
                $lookup: {
                    from: 'nfts',
                    foreignField: '_id',
                    localField: 'nftId',
                    as: 'nft'
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: limit * (page - 1) },
            { $limit: limit },
            {
                $project: {
                    _id: 1, price: 1,
                    nft: {
                        $cond: [
                            { $ne: ['$nft', []] },
                            {
                                _id: { $arrayElemAt: ['$nft._id', 0] },
                                name: { $arrayElemAt: ['$nft.name', 0] },
                                address: { $arrayElemAt: ['$nft.address', 0] },
                                image: {
                                    $ifNull: [{ $concat: [baseUrl, { $arrayElemAt: ['$nft.imageLocal', 0] }] }, nftImgPlaceholder]
                                }
                            },
                            null
                        ]
                    },
                    status: {
                        $cond: [{ $eq: ['$status', 2] }, 'Transferred', 'Pending']
                    }
                }
            }
        ])

        return res.json({
            success: true, message: 'Fetched owner\'s earnings successfully',

            data: {
                earnings: earnings.length ? earnings : null,
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

// method to create owner's earnings
exports.createEarnings = async (royalties = [], nftId, collectionId, currency, currentPrice) => {
    try {
        if (royalties?.length) {
            for (let i = 0; i < royalties.length; i++) {
                if (royalties[i].wallet) {
                    // find user
                    const user = await User.findOne({ address: royalties[i].wallet }, 'address').lean(true)
                    if (user) {
                        const earning = {
                            userId: user._id,
                            nftId,
                            collectionId,
                            price: {
                                amount: currentPrice * (royalties[i].percent / 100),
                                currency
                            },
                            status: 2 // 2 = Transferred
                        }

                        // insert earning
                        await Earning.create(earning)
                    }
                }
            }
        }
    } catch (error) {
        console.log('Error while creating owners\' earnings: ', error)
    }
}