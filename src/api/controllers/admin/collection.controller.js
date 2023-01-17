const Nfts = require('../../models/nfts.model')
const Collection = require('../../models/collection.model')
const { ObjectId } = require('mongodb');
const { baseUrl, colLogoPlaceholder, userDefaultImage, nftImgPlaceholder } = require('../../../config/vars');
const mongoose = require('mongoose');

// API to get collection list
exports.list = async (req, res, next) => {
    try {
        let { all, page, limit } = req.query
        let { categoryId, userId, address, name } = req.body
        const filter = {}

        if (categoryId) {
            filter.categoryId = mongoose.Types.ObjectId(categoryId)
        }
        if (userId) {
            filter.userId = mongoose.Types.ObjectId(userId)
        }
        if (address) {
            filter.address = address
        }

        if (name) {
            name = name.trim()
            filter.name = { $regex: name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: 'gi' }
        }
        page = page !== undefined && page !== '' ? parseInt(page) : 1
        if (!all)
            limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        const total = await Collection.countDocuments(filter)

        if (page > Math.ceil(total / limit) && total > 0)
            page = Math.ceil(total / limit)

        let pipeline = [
            {
                $match: filter
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
                $unwind: '$user'
            },
            {
                $lookup: {
                    from: 'categories',
                    foreignField: '_id',
                    localField: 'categoryId',
                    as: 'categories'
                }
            },
            { $sort: { createdAt: -1 } },
        ]

        if (!all) {
            pipeline.push({ $skip: limit * (page - 1) })
            pipeline.push({ $limit: limit })
        }

        pipeline.push({
            $project: {
                _id: 1, name: 1, address: 1,
                logo: { $ifNull: [{ $concat: [baseUrl, '$logoLocal'] }, colLogoPlaceholder] },
                banner: { $ifNull: [{ $concat: [baseUrl, '$bannerLocal'] }, ''] },
                featuredImg: { $ifNull: [{ $concat: [baseUrl, '$featuredImgLocal'] }, ''] },
                url: 1, description: 1,
                user: {
                    _id: '$user._id',
                    username: '$user.username',
                    profilePhoto: { $ifNull: [{ $concat: [baseUrl, '$user.profileImageLocal'] }, userDefaultImage] }
                },
                category: { $ifNull: [{ $arrayElemAt: ['$categories', 0] }, null] },
            }
        })

        const collections = await Collection.aggregate(pipeline)

        return res.send({
            success: true, message: 'Collections fetched successfully',
            data: {
                collections,
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

// API to get collection
exports.get = async (req, res, next) => {
    try {
        const { collectionId } = req.params

        if (collectionId) {
            const collection = await Collection.aggregate([
                { $match: { _id: ObjectId(collectionId) } },
                {
                    $lookup: {
                        from: 'users',
                        foreignField: '_id',
                        localField: 'userId',
                        as: 'user'
                    }
                },
                {
                    $unwind: '$user'
                },
                {
                    $lookup: {
                        from: 'categories',
                        foreignField: '_id',
                        localField: 'categoryId',
                        as: 'category'
                    }
                },
                {
                    $unwind: '$category'
                },
                {
                    $project: {
                        _id: 1, name: 1, address: 1, isNotableDrop: 1,
                        logo: { $ifNull: [{ $concat: [baseUrl, '$logoLocal'] }, colLogoPlaceholder] },
                        banner: { $ifNull: [{ $concat: [baseUrl, '$bannerLocal'] }, ''] },
                        featuredImg: { $ifNull: [{ $concat: [baseUrl, '$featuredImgLocal'] }, ''] },
                        url: 1, description: 1, show: 1,
                        user: {
                            _id: '$user._id',
                            username: '$user.username',
                        },
                        category: {
                            _id: '$category._id',
                            name: '$category.name'
                        },
                    }
                }
            ])

            if (collection.length) {
                let { page, limit } = req.query

                page = page !== undefined && page !== '' ? parseInt(page) : 1
                limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

                const total = await Nfts.countDocuments({ collectionId })

                if (page > Math.ceil(total / limit) && total > 0)
                    page = Math.ceil(total / limit)

                // find collection NFTs
                const nfts = await Nfts.aggregate([
                    {
                        $match: {
                            collectionId: ObjectId(collectionId)
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
                    {
                        $lookup: {
                            from: 'users',
                            foreignField: '_id',
                            localField: 'creatorId',
                            as: 'creator'
                        }
                    },
                    {
                        $unwind: '$owner'
                    },
                    {
                        $unwind: '$creator'
                    },
                    { $sort: { createdAt: -1 } },
                    { $skip: limit * (page - 1) },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 1,
                            type: 1, isStaked: 1,
                            name: 1, currentPrice: 1, copies: 1, currency: 1,
                            image: {
                                $ifNull: [{ $concat: [baseUrl, '$imageLocal'] }, nftImgPlaceholder]
                            },
                            status: 1,
                            owner: {
                                _id: '$owner._id',
                                username: '$owner.username'
                            },
                            creator: {
                                _id: '$creator._id',
                                username: '$creator.username'
                            },
                        }
                    }
                ])

                return res.send({
                    success: true, message: 'Collection fetched successfully',
                    data: {
                        collection: collection[0],
                        nfts,
                        pagination: {
                            page, limit, total,
                            pages: Math.ceil(total / limit) <= 0 ? 1 : Math.ceil(total / limit)
                        }
                    }
                })
            }
            else {
                return res.status(400).send({ success: false, message: 'collection not found for given Id' })
            }


        }
        else {
            return res.status(400).send({ success: false, message: 'Collection Id is required' })
        }


    } catch (error) {
        return next(error)
    }
}

// API to edit collection
exports.edit = async (req, res, next) => {
    try {
        let payload = req.body
        if (req.files)
            for (const key in req.files) {
                const image = req.files[key][0]
                const imgData = fs.readFileSync(image.path)
                payload[key] = await addImage(imgData)
            }

        if (!payload._id) {
            return res.status(400).send({ success: false, message: 'Please provide all required fields' })
        }

        const collection = await Collection.findByIdAndUpdate({ _id: payload._id }, { $set: payload }, { new: true })
        return res.send({ success: true, message: 'Collection settings updated successfully', collection })
    } catch (error) {
        return next(error)
    }
}

