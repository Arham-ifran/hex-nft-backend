const ObjectId = require('mongoose').Types.ObjectId
const User = require('../../models/users.model')
const Collection = require('../../models/collection.model')
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
                const collections = await Collection.aggregate([
                    {
                        $match: {
                            userId: ObjectId(user._id)
                        }
                    },
                    { $sort: { createdAt: -1 } },
                    { $limit: 2 },
                    {
                        $project: {
                            name: 1, url: 1,
                            logo: { $ifNull: ['$logo', gamificationPlaceholder] },
                            logoLocal: { $ifNull: [{ $concat: [baseUrl, '$logoLocal'] }, gamificationPlaceholder] }
                        }
                    }
                ])

                return res.send({
                    success: true, message: 'Last 2 collections of a given user are fetched successfully',
                    collections,
                    viewAll: `${baseUrl}collections?userId=${user._id}`
                })
            }
        }
    } catch (error) {
        return next(error)
    }
}