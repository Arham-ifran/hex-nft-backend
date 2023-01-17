const ObjectId = require('mongoose').Types.ObjectId
const NFT = require('../../models/nfts.model')
const User = require('../../models/users.model')
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
                const nfts = await NFT.aggregate([
                    {
                        $match: {
                            creatorId: ObjectId(user._id)
                        }
                    },
                    { $sort: { createdAt: -1 } },
                    { $limit: 5 },
                    {
                        $lookup: {
                            from: 'bids',
                            foreignField: 'nftId',
                            localField: '_id',
                            as: 'bids'
                        }
                    },
                    {
                        $lookup: {
                            from: 'offers',
                            foreignField: 'nftId',
                            localField: '_id',
                            as: 'offers'
                        }
                    },
                    {
                        $project: {
                            _id: 1, name: 1, description: 1,
                            address: { $ifNull: ['$address', null] },
                            image: { $ifNull: ['$image', gamificationPlaceholder] },
                            imageLocal: { $ifNull: [{ $concat: [baseUrl, '$imageLocal'] }, gamificationPlaceholder] },
                            currentPrice: { $ifNull: ['$currentPrice', null] },
                            auctionEndDate: { $ifNull: ['$auctionEndDate', null] },
                            currency: { $ifNull: ['$currency', null] },
                            statusType: '$status',
                            status: {
                                $cond: [
                                    { $eq: ['$status', 2] }, 'On Sale', 'Idle'
                                ]
                            },
                            currentBid: { $ifNull: [{ $arrayElemAt: ['$bids.price', -1] }, null] },
                            currentOffer: { $ifNull: [{ $arrayElemAt: ['$offers.price', -1] }, null] }
                        }
                    },
                ])

                return res.send({
                    success: true, message: 'Most recent NFTs created by user are fetched successfully',
                    nfts,
                    viewAll: `${baseUrl}author/${user._id}`
                })
            }
        }
    } catch (error) {
        return next(error)
    }
}

exports.getRecentCollectibles = async (req, res, next) => {
    try {
        const { address } = req.params;

        if (!address)
            return res.status(400).send({ success: false, message: 'User wallet address is required' })
        else {
            const user = await User.findOne({ address });

            if (!user)
                return res.status(400).send({ success: false, message: "We've explored deep and wide but we're unable to find the user you're looking for" })
            else {
                const nfts = await NFT.aggregate([
                    {
                        $match: {
                            ownerId: ObjectId(user._id)
                        }
                    },
                    { $sort: { createdAt: -1 } },
                    { $limit: 6 },
                    {
                        $project: {
                            _id: 1, name: 1,
                            address: { $ifNull: ['$address', null] },
                            image: { $ifNull: ['$image', gamificationPlaceholder] },
                            imageLocal: { $ifNull: [{ $concat: [baseUrl, '$imageLocal'] }, gamificationPlaceholder] },
                            currentPrice: { $ifNull: ['$currentPrice', null] },
                            auctionEndDate: { $ifNull: ['$auctionEndDate', null] },
                            currency: { $ifNull: ['$currency', null] },
                            statusType: '$status',
                            status: {
                                $cond: [
                                    { $eq: ['$status', 2] }, 'On Sale', 'Idle'
                                ]
                            }
                        }
                    },
                ])

                return res.send({
                    success: true, message: 'Most recent NFTs created by user are fetched successfully',
                    nfts,
                    viewAll: `${baseUrl}author/${user._id}`
                })
            }
        }
    } catch (error) {
        return next(error)
    }
}