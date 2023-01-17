const axios = require('axios')
const moment = require('moment')
const ObjectId = require('mongoose').Types.ObjectId
const Category = require('../../models/categories.model')
const Stats = require('../../models/stats.model')
const NFT = require('../../models/nfts.model')
const { baseUrl, MYNTtoBNBLink, colLogoPlaceholder, colFeaturedPlaceholder } = require('../../../config/vars')

// API to get rankings
exports.list = async (req, res, next) => {
    try {
        let { page, limit, categoryId, getCategories, sortByVol } = req.query

        let sortBy = { createdAt: -1 }
        if (sortByVol) {
            sortBy = { [sortByVol]: -1 }
        }

        let categories = null

        // get categories on first call only
        if (getCategories)
            categories = await Category.aggregate([
                {
                    $match: { status: true }
                },
                {
                    $sort: { name: 1 }
                },
                {
                    $project: { label: '$name', value: '$_id' }
                },

            ])

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 100

        const filter = {}
        let catFilter = {}

        if (categoryId)
            catFilter['collection.categoryId'] = ObjectId(categoryId)

        let total = 0

        // count total docs.
        // collection lookup if category id is given
        if (categoryId) {
            total = await Stats.aggregate([
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
        } else
            total = await Stats.countDocuments(filter)

        if (page > Math.ceil(total / limit) && total > 0)
            page = Math.ceil(total / limit)

        // ready aggregation pipelins
        let pipeline = [
            { $match: filter },
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
            }
        ]

        // collection look up if category id is given
        if (categoryId)
            pipeline.push({
                $match: catFilter
            })

        pipeline.push({ $sort: sortBy })
        pipeline.push({ $skip: limit * (page - 1) })
        pipeline.push({ $limit: limit })
        pipeline.push({
            $project: {
                _id: 1,
                collection: {
                    _id: '$collection._id',
                    name: '$collection.name',
                    url: '$collection.url',
                    logo: { $ifNull: [{ $concat: [baseUrl, '$collection.logoLocal'] }, colLogoPlaceholder] }
                },
                volume: { $trunc: ['$volume', 7] },
                p24h: { $substr: ['$p24h', 0, 10] },
                p7d: { $substr: ['$p7d', 0, 10] },
                p30d: { $substr: ['$p30d', 0, 10] },
                owners: 1, assets: 1,
            }
        })

        let stats = await Stats.aggregate(pipeline)

        return res.send({
            success: true, message: 'Rankings fetched successfully',
            data: {
                stats: stats.length ? stats : null,
                pagination: {
                    page, limit, total,
                    pages: Math.ceil(total / limit) <= 0 ? 1 : Math.ceil(total / limit)
                },
                categories,
                getCategories: getCategories || false
            }
        })
    } catch (error) {
        return next(error)
    }
}

// API to create rankings
exports.create = async (req, res, next) => {
    try {
        const { duration } = req.query
        let filter = {}

        if (duration) {
            const days = duration === '24h' ? 1 : (duration === '7d' ? 7 : duration === '30d' ? 30 : '')
            const startDate = moment().subtract(days, 'd').format('YYYY-MM-DD HH:mm:ss:SSS') // last X days
            const endDate = moment().format('YYYY-MM-DD HH:mm:ss:SSS') // current date
            filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) }
        }

        const pricesInMYNT = await axios.get(MYNTtoBNBLink)
        const MYNTtoBNB = (pricesInMYNT?.data?.data)?.quote[0]?.price

        // get nfts w.r.t. to collections
        const nfts = await NFT.aggregate([
            {
                $match: filter
            },
            {
                $project: {
                    _id: 1,
                    ownerId: 1,
                    originalPrice: { $ifNull: ['$currentPrice', 0] }, // original price
                    currency: 1,
                    collectionId: 1,
                    currentPrice: {
                        $cond: {
                            if: { $eq: ['$currency', 'MYNT'] },
                            then: { $trunc: [{ $multiply: ['$currentPrice', MYNTtoBNB] }, 7] },
                            else: '$currentPrice'
                        }
                    },
                }
            },
            {
                $group: {
                    _id: '$collectionId',
                    collectionId: { $first: '$collectionId' },
                    assets: { $addToSet: '$_id' },
                    owners: { $addToSet: '$ownerId' },
                    volume: { $sum: '$currentPrice' },
                }
            },
            {
                $project: {
                    _id: 0,
                    collectionId: 1,
                    assets: { $size: '$assets' },
                    owners: { $size: '$owners' },
                    volume: '$volume',
                }
            }
        ])

        // check volume difference with previous stats
        for (let i = 0; i < nfts.length; i++) {
            let data = nfts[i]

            // check stats for given time & collection else for all time
            let statsFilter = { collectionId: data.collectionId }
            let stats = await Stats.findOne(statsFilter)

            const vKey = duration ? `v${duration}` : 'volume' // value key for X duration
            const pKey = duration ? `p${duration}` : 'volume' // percent key for X duration
            const previousVol = stats ? stats[vKey] : 0
            const currentVol = data.volume || 0

            if (stats) {
                // save current volume
                stats[vKey] = currentVol

                // calculate percent
                if (duration)
                    stats[pKey] = `${(previousVol ? ((currentVol - previousVol) / currentVol) * 100 : currentVol).toFixed()}%`

                // save changes
                await stats.save()
            }

            // if no stats found for given collection then create one
            else {
                stats = { ...data }
                // save current volume
                stats[vKey] = currentVol

                // calculate percent
                if (duration)
                    stats[pKey] = `${(previousVol ? ((currentVol - previousVol) / currentVol) * 100 : currentVol).toFixed()}%`

                // create stats
                await Stats.create(data)
            }
        }

        return res.json({ success: true, message: 'Stats created successfully' })
    } catch (error) {
        next(error)
    }
}

// API to fetch top collections over 7 days 
exports.topCollections = async (req, res, next) => {
    try {
        const pricesInMYNT = await axios.get(MYNTtoBNBLink)
        const MYNTtoBNB = (pricesInMYNT?.data?.data)?.quote[0]?.price

        let topCollections = await Stats.aggregate([
            {
                $match: {
                    v7d: { $gt: 0 }
                }
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
                $lookup: {
                    from: "nfts",
                    let: { collectionId: "$collectionId" },
                    pipeline: [
                        {
                            $match:
                            {
                                $expr:
                                {
                                    $and:
                                        [
                                            { $eq: ["$collectionId", "$$collectionId"] },
                                            { $eq: ["$status", 2] }
                                        ]
                                }
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                currency: 1,
                                currentPrice: 1,
                                priceInBNB: {
                                    $cond: [
                                        { $eq: ['$currency', 'MYNT'] },
                                        { $multiply: ['$currentPrice', MYNTtoBNB] },
                                        '$currentPrice'
                                    ]
                                },

                            }
                        }
                    ],
                    as: "nfts"
                }
            },
            {
                $sort: { v7d: -1 }
            },
            {
                $project: {
                    v7d: 1, p7d: 1,
                    collection: {
                        _id: '$collection._id',
                        name: '$collection.name',
                        url: '$collection.url',
                        logo: {
                            $ifNull: [{ $concat: [baseUrl, '$collection.logoLocal'] }, colLogoPlaceholder]
                        }
                    },
                    volume: { $trunc: ['$volume', 7] },
                    // get currency of floor price (min price from array)
                    currency: { $arrayElemAt: ['$nfts.currency', { $indexOfArray: ["$nfts.priceInBNB", { $min: "$nfts.priceInBNB" }] }] },
                    floorPrice: { $trunc: [{ $min: "$nfts.priceInBNB" }, 7] }
                }
            },
        ])
        return res.status(200).send({ success: true, topCollections })
    }
    catch (error) {
        return next(error)
    }
}

// API to fetch trending collections 
exports.trendingCollections = async (req, res, next) => {
    try {
        let trendingCollections = await Stats.aggregate([
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
                $lookup: {
                    from: 'users',
                    foreignField: '_id',
                    localField: 'collection.userId',
                    as: 'collection.user'
                }
            },
            {
                $unwind: '$collection.user'
            },
            {
                $sort: { volume: -1 }
            },
            {
                $limit: 9
            },
            {
                $project: {
                    volume: 1,
                    collection: {
                        _id: '$collection._id',
                        name: '$collection.name',
                        description: '$collection.description',
                        logo: {
                            $ifNull: [{ $concat: [baseUrl, '$collection.logoLocal'] }, colLogoPlaceholder]
                        },
                        featuredImg: { $ifNull: [{ $concat: [baseUrl, '$collection.featuredImgLocal'] }, colFeaturedPlaceholder] },
                        url: '$collection.url'
                    },
                    owner: {
                        _id: '$collection.user._id',
                        name: '$collection.user.username',
                    }
                }
            },
        ])
        return res.status(200).send({ success: true, trendingCollections })
    }
    catch (error) {
        return next(error)
    }
}
