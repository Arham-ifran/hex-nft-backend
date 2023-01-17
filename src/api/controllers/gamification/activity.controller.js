const ObjectId = require('mongoose').Types.ObjectId
const User = require('../../models/users.model')
const Activity = require('../../models/activity.model')
const { baseUrl, gamificationPlaceholder } = require('../../../config/vars')

exports.getRecent = async (req, res, next) => {
    try {
        const { address } = req.params;

        if (!address)
            return res.status(400).send({ success: false, message: 'User wallet address is required' })
        else {
            const user = await User.findOne({ address });

            if (!user)
                return res.status(400).send({ success: false, message: "We've explored deep and wide but we're unable to find the user you're looking for" })
            else {
                const activities = await Activity.aggregate([
                    {
                        $match: {
                            userId: ObjectId(user._id)
                        }
                    },
                    { $sort: { createdAt: -1 } },
                    { $limit: 5 },
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
                        $lookup: {
                            from: 'users',
                            foreignField: '_id',
                            localField: 'toUserId',
                            as: 'toUser'
                        }
                    },
                    {
                        $project: {
                            price: { $ifNull: ['$price', null] },
                            currency: { $ifNull: ['$currency', null] },
                            type: {
                                // 1 = Creation, 2 = Offers, 3 = Bids, 4 = Accept Offer, 5 = Accept Bid, 6 = Listing, 7 = Sales
                                $cond: [
                                    { $eq: ['$type', 1] }, 'Created NFT',
                                    {
                                        $cond: [
                                            { $eq: ['$type', 2] }, 'Made Offer',
                                            {
                                                $cond: [
                                                    { $eq: ['$type', 3] }, 'Placed Bid',
                                                    {
                                                        $cond: [
                                                            { $eq: ['$type', 4] }, 'Accepted Offer',
                                                            {
                                                                $cond: [
                                                                    { $eq: ['$type', 5] }, 'Accepted Bid',
                                                                    {
                                                                        $cond: [
                                                                            { $eq: ['$type', 6] }, 'Put On Listing',
                                                                            {
                                                                                $cond: [
                                                                                    { $eq: ['$type', 7] }, 'Sales / Transferred',
                                                                                    null
                                                                                ]
                                                                            }
                                                                        ]
                                                                    }
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            },
                            user: {
                                $cond: [
                                    { $ne: ['$user', []] },
                                    {
                                        _id: { $arrayElemAt: ['$user._id', 0] },
                                        username: { $arrayElemAt: ['$user.username', 0] },
                                        address: { $arrayElemAt: ['$user.address', 0] },
                                        profileImage: { $ifNull: [{ $arrayElemAt: ['$user.profileImage', 0] }, gamificationPlaceholder] },
                                        profileImageLocal: {
                                            $ifNull: [{ $concat: [baseUrl, { $arrayElemAt: ['$user.profileImageLocal', 0] }] }, gamificationPlaceholder]
                                        }
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
                                        profileImage: { $ifNull: [{ $arrayElemAt: ['$toUser.profileImage', 0] }, gamificationPlaceholder] },
                                        profileImageLocal: {
                                            $ifNull: [{ $concat: [baseUrl, { $arrayElemAt: ['$toUser.profileImageLocal', 0] }] }, gamificationPlaceholder]
                                        }
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
                                        address: { $arrayElemAt: ['$nft.address', 0] },
                                        image: { $ifNull: [{ $arrayElemAt: ['$nft.image', 0] }, gamificationPlaceholder] },
                                        imageLocal: {
                                            $ifNull: [{ $concat: [baseUrl, { $arrayElemAt: ['$nft.imageLocal', 0] }] }, gamificationPlaceholder]
                                        }
                                    },
                                    null
                                ]
                            },
                            createdAt: 1
                        }
                    },
                ])

                return res.send({
                    success: true, message: 'Most recent activities performed by user are fetched successfully',
                    activities
                })
            }
        }
    } catch (error) {
        return next(error)
    }
}