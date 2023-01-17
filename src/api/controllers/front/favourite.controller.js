const Favourites = require('../../models/favourite.model')
const mongoose = require('mongoose');



// API to add User Favourite
exports.addToFavourite = async (req, res, next) => {
    try {

        const { userId, nftId, refIndex } = req.body

        const alreadyInFavourites = await Favourites.findOne({ userId, nftId })

        if (alreadyInFavourites) {
            return res.status(200).send({
                success: true,
                data: {
                    alreadyInFavourites,
                    refIndex
                }
            })
        }
        else {

            const favourite = await Favourites.create({ userId, nftId })

            return res.send({
                success: true, message: 'added to favourite successfully',
                data: {
                    favourite,
                    refIndex
                }
            })
        }
    } catch (error) {
        return next(error)
    }
}

// API to get User Favourites 
exports.getUserFavourites = async (req, res, next) => {
    try {
        let { userId, nftId, page, limit } = req.body

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 12

        let filter = { userId: mongoose.Types.ObjectId(userId) }

        let total = nftId ? await Favourites.countDocuments({ nftId }) : await Favourites.countDocuments({ userId })
        let favourites = []

        if (userId && nftId) {
            favourites = await Favourites.findOne({ userId, nftId }).lean(true)
        }
        else if (userId) {
            favourites = await Favourites.aggregate([
                { $match: filter },
                { $sort: { createdAt: -1 } },
                {
                    $lookup: {
                        from: 'nfts',
                        foreignField: '_id',
                        localField: 'nftId',
                        as: 'nft'
                    }
                },
                { $unwind: '$nft' },
                {
                    $lookup: {
                        from: 'users',
                        foreignField: '_id',
                        localField: 'nft.ownerId',
                        as: 'nft.owner'
                    }
                },
                { $unwind: '$nft.owner' },
                {
                    $lookup: {
                        from: 'favourites',
                        foreignField: 'nftId',
                        localField: 'nft._id',
                        as: 'nft.favourite'
                    }
                },
                // { $unwind : { path : '$nft.favourites', preserveNullAndEmptyArrays : true}},
                {
                    $project: {
                        userId: 1,
                        nft: {
                            _id: '$nft._id',
                            name: '$nft.name',
                            image: '$nft.image',
                            owner: { username: '$nft.owner.username' },
                            type: '$nft.type',
                            isStaked: '$nft.isStaked'
                        },
                        totalLikes: '$nft.favourite._id'
                    }
                },
                { $skip: limit * (page - 1) },
                { $limit: limit },
            ])

        }

        return res.send({
            success: true, message: 'favourites fetched successfully',
            data: {
                total,
                favourites,
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


//API to remove user favourite
exports.removeFromFavourites = async (req, res, next) => {
    try {
        const { userId, nftId, refIndex } = req.body

        const presentInFavourites = await Favourites.findOne({ userId, nftId })

        if (presentInFavourites) {
            if (userId && nftId) {
                const favourite = await Favourites.deleteOne({ userId, nftId })
                return res.send({
                    success: true, message: 'removed from favourites successfully', refIndex
                })
            }
            else
                return res.send({
                    success: false, message: "Sorry! Could not remove from favourites at the moment", reason: "User and Nft id's are required"
                })
        }
        else {
            return res.status(200).send({
                success: 200,
                alreadyRemovedFromFavourites: true,
                refIndex
            })
        }


    } catch (error) {
        return next(error)
    }
}