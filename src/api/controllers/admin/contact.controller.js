const mongoose = require('mongoose');
const Contact = require('../../models/contact.model')
const { checkDuplicate } = require('../../../config/errors')


// API to get contacts list
exports.list = async (req, res, next) => {
    try {
        let { page, limit } = req.query
        let { name, email , subject, status } = req.body

        const filter = {}

        if(name){
            name = name.trim()
            filter.name = { $regex: name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: 'gi' }
        }
        if(email){
            filter.email = email.trim()
        }
        if(subject){
            subject = subject.trim()
            filter.subject = { $regex: subject.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: 'gi' }
        }
        if(status){
            filter.status =  parseInt(status)
        }

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        const total = await Contact.countDocuments(filter)

        const contacts = await Contact.aggregate([
            {$match : filter},
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
            success: true, message: 'Contacts fetched successfully',
            data: {
                contacts,
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

// API to edit contact status
exports.edit = async (req, res, next) => {
    try {
        let payload = req.body
        let newPayload = {
            status: payload.status
        }
        let updatedContact = await Contact.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(payload._id) }, { $set: newPayload }, { new: true })
        return res.send({ success: true, message: 'Contact updated successfully', updatedContact })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Contact')
        else
            return next(error)
    }
}



