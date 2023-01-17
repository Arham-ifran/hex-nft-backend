const fs = require('fs')
const mongoose = require('mongoose');
const Email = require('../../models/email.model')
const { addImage } = require('../../utils/upload')
const { checkDuplicate } = require('../../../config/errors')

// API to create email template 
exports.create = async (req, res, next) => {
    try {
        let payload = req.body
        const email = await Email.create(payload)
        return res.send({ success: true, message: 'Email template created successfully', email })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Email')
        else
            return next(error)
    }
}

// API to edit email template
exports.edit = async (req, res, next) => {
    try {
        let payload = req.body
        const email = await Email.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(payload._id) }, { $set: payload }, { new: true })
        return res.send({ success: true, message: 'Email template updated successfully', email })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Email')
        else
            return next(error)
    }
}

// API to get email template
exports.get = async (req, res, next) => {
    try {
        const { emailId } = req.params
        if (emailId) {
            const email = await Email.findOne({ _id: emailId }, { __v: 0, createdAt: 0, updatedAt: 0 }).lean(true)
            if (email)
                return res.json({ success: true, message: 'Email template retrieved successfully', email })
            else return res.status(400).send({ success: false, message: 'Email template not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Email Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get email list
exports.list = async (req, res, next) => {
    try {
        let { page, limit } = req.query

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        const total = await Email.countDocuments({})

        const emails = await Email.aggregate([
            { $sort: { createdAt: -1 } },
            { $skip: limit * (page - 1) },
            { $limit: limit },
            {
                $project: {
                    __v: 0, createdAt: 0, updatedAt: 0
                }
            }
        ])

        return res.send({
            success: true, message: 'Email templates fetched successfully',
            data: {
                emails,
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
