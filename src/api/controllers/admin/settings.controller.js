const fs = require('fs')
const atob = require('atob')
const ObjectId = require('mongoose').Types.ObjectId
const Settings = require('../../models/settings.model')
const { addImage } = require('../../utils/upload')
const { checkDuplicate } = require('../../../config/errors')

// API to edit Settings
exports.edit = async (req, res, next) => {
    try {
        let payload = req.body
        let { type } = req.query
        type = parseInt(type)
        if (type === 3) {
            if (!payload.royality) {
                return res.send({ success: false, message: 'Royality % Required' })
            }
            if (!payload.share) {
                return res.send({ success: false, message: 'Platform Share Required' })
            }
            payload.share = parseInt(payload.share)
            payload.royality = parseInt(payload.royality)
        }
        if (type === 1 || type === 2) {
            delete payload['share']
            delete payload['royality']
        }

        if (type === 1)
            payload.paymentTokens = payload.paymentTokens ? JSON.parse(atob(payload.paymentTokens)) : []

        const settings = await Settings.updateOne({}, { $set: payload }, { upsert: true })
        return res.send({ success: true, message: 'Settings updated successfully', settings })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Settings')
        else
            return next(error)
    }
}

// // API to get Settings
exports.get = async (req, res, next) => {
    try {
        const settings = await Settings.findOne({}, { __v: 0, createdAt: 0, updatedAt: 0 }).lean(true)
        if (settings)
            return res.json({ success: true, message: 'Settings retrieved successfully', settings })
        else
            return res.json({ success: false, message: settings })
    } catch (error) {
        return next(error)
    }
}
