const ObjectId = require('mongoose').Types.ObjectId
const User = require('../../models/users.model')
const moment = require('moment');
const { baseUrl } = require('../../../config/vars')

// API to get users list
exports.list = async (req, res, next) => {
    try {
        let { all, page, limit } = req.query
        let { address, username, createdAtFrom, createdAtTo } = req.body
        const filter = {}

        if(address){
            filter.address = address.replace(/\s/g, '');
        }
        if(username){
            username = username.trim()
            filter.username = { $regex: username.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: 'gi' };
        }
        if(createdAtFrom && createdAtTo){
            let startDate = moment.utc(new Date(createdAtFrom)).format('YYYY-MM-DD');
            let endDate = moment.utc(new Date(createdAtTo)).add(1, 'day').format('YYYY-MM-DD');
            filter.createdAt = { $gte : new Date(startDate), $lt : new Date(endDate) } 
        }

        else if(createdAtFrom){
            let startDate = moment.utc(new Date(createdAtFrom)).format('YYYY-MM-DD');
            filter.createdAt = { $gte : new Date(startDate) } 
        }

        else if(createdAtTo){
            let endDate = moment.utc(new Date(createdAtTo)).add(1, 'day').format('YYYY-MM-DD');
            filter.createdAt = { $lt : new Date(endDate) } 
        }
    
        page = page !== undefined && page !== '' ? parseInt(page) : 1
        if (!all)
            limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        const total = await User.countDocuments(filter)

        if (page > Math.ceil(total / limit) && total > 0)
            page = Math.ceil(total / limit)

        let pipeline = [
            { $match : filter },
            { $sort: { createdAt: -1 } }
        ]

        if (!all) {
            pipeline.push({ $skip: limit * (page - 1) })
            pipeline.push({ $limit: limit })
        }

        pipeline.push(
            {
                $project: {
                    _id: 1, username: 1, email: 1, address: 1, createdAt: 1,
                    description: 1, emailVerified: 1, facebookLink: 1, twitterLink: 1, gPlusLink: 1, vineLink: 1,
                    profileImage: { $ifNull: [{ $concat: [baseUrl, '$profileImageLocal'] }, ''] }
                }
            }
        )

        const users = await User.aggregate(pipeline)

        return res.send({
            success: true, message: 'Users fetched successfully',
            data: {
                users,
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

// API to delete user
exports.delete = async (req, res, next) => {
    try {
        const { userId } = req.params
        if (userId) {
            const user = await User.deleteOne({ _id: userId })
            if (user && user.deletedCount)
                return res.send({ success: true, message: 'User deleted successfully', userId })
            else return res.status(400).send({ success: false, message: 'User not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'User Id is required' })
    } catch (error) {
        return next(error)
    }
}