const fs = require('fs')
const ObjectId = require('mongoose').Types.ObjectId
const Creator = require('../../models/creator.model')
const { addImage } = require('../../utils/upload')
const { checkDuplicate } = require('../../../config/errors')


// API to edit creator
exports.edit = async (req, res, next) => {
    try {
        let payload = req.body
        const creator = await Creator.findByIdAndUpdate({ _id: payload._id }, { $set: payload }, { new: true })
        return res.send({ success: true, message: 'Creator updated successfully', creator })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Creator')
        else
            return next(error)
    }
}

// API to delete creator
exports.delete = async (req, res, next) => {
    try {
        const { creatorId } = req.params
        if (creatorId) {
            const creator = await Creator.deleteOne({ _id: creatorId })
            if (creator.deletedCount)
                return res.send({ success: true, message: 'Creator deleted successfully', creatorId })
            else return res.status(400).send({ success: false, message: 'Creator not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Creator Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get creator
exports.get = async (req, res, next) => {
    try {
        const { creatorId } = req.params
        if (creatorId) {
            const creator = await Creator.findOne({ _id: creatorId }, { __v: 0, createdAt: 0, updatedAt: 0 }).lean(true)
            if (creator)
                return res.json({ success: true, message: 'Creator retrieved successfully', creator })
            else return res.status(400).send({ success: false, message: 'Creator not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Creator Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get creator list
exports.list = async (req, res, next) => {
    try {
        let { all, page, limit } = req.query

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        if (!all)
            limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        const total = await Creator.countDocuments({})

        let pipeline = [
            { $sort: { createdAt: -1 } }
        ]
        if (!all) {
            pipeline.push({ $skip: limit * (page - 1) })
            pipeline.push({ $limit: limit })
        }

        pipeline.push(
            {
                $project: {
                    __v: 0, createdAt: 0, updatedAt: 0
                }
            }
        )

        const creator = await Creator.aggregate(pipeline)

        return res.send({
            success: true, message: 'Creator list fetched successfully',
            data: {
                creator,
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