const fs = require('fs')
const ObjectId = require('mongoose').Types.ObjectId
const Nfts = require('../../models/nfts.model')
const Offer = require('../../models/offer.model')
const Bid = require('../../models/bids.model')
const Category = require('../../models/categories.model')
const { userDefaultImage, baseUrl, nftImgPlaceholder, colLogoPlaceholder } = require('../../../config/vars')

// API to get nfts list
exports.list = async (req, res, next) => {
    try {
        let { page, limit, status, min, max, collectionId, categoryId, creatorId, type } = req.query

        let filter = {}
        let catFilter = {}

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        if (status) {
            filter.status = parseInt(status)
        }

        if (type) {
            type = parseInt(type)

            if (type === 1 || type === 2) { // for NFT and NFTC
                filter.isStaked = false
                filter.type = type
            } else if (type === 3) { // for NFTD
                filter.isStaked = true
                filter.type = 1
            }
            else if (type === 4) { // for NFTCD
                filter.isStaked = true
                filter.type = 2
            }
        }

        if (min) {
            filter.currentPrice = { $gte: parseInt(min) }
        }

        if (max) {
            filter.currentPrice = { $lte: parseInt(max) }
        }

        if (collectionId) {
            filter.collectionId = ObjectId(collectionId)
        }

        if (creatorId) {
            filter.creatorId = ObjectId(creatorId)
        }

        if (categoryId) {
            catFilter['collection.categoryId'] = ObjectId(categoryId)
        }

        let total = 0
        if (categoryId) {
            total = await Nfts.aggregate([
                {
                    $match: filter
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
                    $match: catFilter
                }
            ])

            total = total.length
        }
        else {
            total = await Nfts.countDocuments(filter)
        }

        // ready aggregation pipelins
        let pipeline = [
            { $match: filter }
        ]

        // collection look up if category id is given
        //  if (categoryId) {
        pipeline.push({
            $lookup: {
                from: 'collections',
                foreignField: '_id',
                localField: 'collectionId',
                as: 'collection'
            }
        })
        pipeline.push({
            $unwind: '$collection'
        })
        pipeline.push({
            $match: catFilter
        })
        // }

        pipeline.push({ $sort: { createdAt: -1 } })
        pipeline.push({ $skip: limit * (page - 1) })
        pipeline.push({ $limit: limit })
        pipeline.push({
            $lookup: {
                from: 'users',
                foreignField: '_id',
                localField: 'ownerId',
                as: 'owner'
            }
        })
        pipeline.push({
            $unwind: '$owner'
        })
        pipeline.push({
            $lookup: {
                from: 'users',
                foreignField: '_id',
                localField: 'creatorId',
                as: 'creator'
            }
        })
        pipeline.push({
            $unwind: '$creator'
        })

        pipeline.push({
            $project: {
                _id: 1, name: 1,
                type: 1,
                currentPrice: 1, auctionEndDate: 1, currency: 1, mediaType: 1, isStaked: 1,
                image: { $ifNull: [{ $concat: [baseUrl, '$imageLocal'] }, nftImgPlaceholder] },
                collection: {
                    _id: '$collection._id',
                    name: '$collection.name',
                    logo: '$collection.logo'
                },
                owner: {
                    _id: '$owner._id',
                    username: '$owner.username',
                    profilePhoto: { $ifNull: [{ $concat: [baseUrl, '$owner.profileImageLocal'] }, userDefaultImage] }
                },
                creator: {
                    _id: '$creator._id',
                    username: '$creator.username',
                    profilePhoto: { $ifNull: [{ $concat: [baseUrl, '$creator.profileImageLocal'] }, userDefaultImage] }
                }
            }
        })

        let nfts = await Nfts.aggregate(pipeline)

        return res.send({
            success: true, message: 'NFTs fetched successfully',
            data: {
                nfts,
                pagination: {
                    page, limit, total,
                    pages: Math.ceil(total / limit) <= 0 ? 1 : Math.ceil(total / limit)
                }
            }
        })
        // }
    } catch (error) {
        return next(error)
    }
}

// API to get nft
exports.get = async (req, res, next) => {
    try {
        let { nftId } = req.params
        let { page, limit } = req.query

        let filter = { "_id": ObjectId(nftId) }

        const nft = await Nfts.aggregate([
            {
                $match: filter
            },
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
                $project: {
                    _id: 1, status: 1, name: 1, currentPrice: 1, currency: 1, showInHomePage: 1,
                    mediaType: 1, type: 1, isStaked: 1,
                    platformShare: { $ifNull: [{ $toString: '$platformShare' }, 100] },
                    commission: { $toString: { $multiply: [{ $last: '$commissions' }, 100] } },
                    fileLocal: { $ifNull: [{ $concat: [baseUrl, '$fileLocal'] }, null] },
                    image: { $ifNull: [{ $concat: [baseUrl, '$imageLocal'] }, nftImgPlaceholder] },
                    sellingMethod: 1,
                    owner: {
                        _id: '$owner._id',
                        username: '$owner.username',
                        profilePhoto: { $ifNull: [{ $concat: [baseUrl, '$owner.profileImageLocal'] }, userDefaultImage] }
                    },
                    creator: {
                        _id: '$creator._id',
                        username: '$creator.username',
                        profilePhoto: { $ifNull: [{ $concat: [baseUrl, '$creator.profileImageLocal'] }, userDefaultImage] }
                    },
                    collection: {
                        $cond: [
                            { $ne: ['$collection', []] },
                            {
                                _id: { $arrayElemAt: ['$collection._id', 0] },
                                name: { $arrayElemAt: ['$collection.name', 0] },
                                logo: {
                                    $ifNull: [{ $concat: [baseUrl, { $arrayElemAt: ['$collection.logoLocal', 0] }] }, colLogoPlaceholder]
                                }
                            },
                            null
                        ]
                    }
                }
            }
        ])

        if (nft[0].sellingMethod === 2) {

            page = page !== undefined && page !== '' ? parseInt(page) : 1
            limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

            const total = await Bid.countDocuments({ nftId: ObjectId(nftId) })

            if (page > Math.ceil(total / limit) && total > 0)
                page = Math.ceil(total / limit)


            const bids = await Bid.aggregate([
                {
                    $match: {
                        nftId: ObjectId(nftId)
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        foreignField: '_id',
                        localField: 'bidBy',
                        as: 'user'
                    }
                },
                {
                    $unwind: '$user'
                },
                { $skip: limit * (page - 1) },
                { $limit: limit },
                {
                    $project: {
                        bidBy: '$user.username',
                        price: 1,
                        expiryDate: 1
                    }
                }
            ])
            return res.send({
                success: true, message: 'NFT fetched successfully',
                data: {
                    nft,
                    bidsOffers: bids,
                    pagination: {
                        page, limit, total,
                        pages: Math.ceil(total / limit) <= 0 ? 1 : Math.ceil(total / limit)
                    }
                }
            })
        }
        else if (nft[0].sellingMethod === 1) {

            page = page !== undefined && page !== '' ? parseInt(page) : 1
            limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

            const total = await Offer.countDocuments({ nftId: ObjectId(nftId) })

            if (page > Math.ceil(total / limit) && total > 0)
                page = Math.ceil(total / limit)

            let offers = await Offer.aggregate([
                {
                    $match: {
                        nftId: ObjectId(nftId)
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        foreignField: '_id',
                        localField: 'offerBy',
                        as: 'user'
                    }
                },
                {
                    $unwind: '$user'
                },
                { $skip: limit * (page - 1) },
                { $limit: limit },
                {
                    $project: {
                        offerBy: '$user.username',
                        price: 1,
                        expiryDate: 1
                    }
                }
            ]);

            return res.send({
                success: true, message: 'NFT fetched successfully',
                data: {
                    nft,
                    bidsOffers: offers,
                    pagination: {
                        page, limit, total,
                        pages: Math.ceil(total / limit) <= 0 ? 1 : Math.ceil(total / limit)
                    }
                }
            })
        }
        else {
            return res.send({
                success: true, message: 'NFT fetched successfully',
                data: {
                    nft
                }
            })
        }
    } catch (error) {
        return next(error)
    }
}

// API to edit nft settings
exports.edit = async (req, res, next) => {
    try {
        let payload = req.body

        if (!payload._id) {
            return res.status(400).send({ success: false, message: 'NFT settings cannot be updated without Nft Id' })
        }

        const nft = await Nfts.findByIdAndUpdate({ _id: payload._id }, { $set: payload }, { new: true })
        return res.send({ success: true, message: 'NFT settings updated successfully' })
    } catch (error) {
        return next(error)
    }
}