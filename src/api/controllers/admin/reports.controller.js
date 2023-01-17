const Report = require('../../models/reports.model')
const NFT = require('../../models/nfts.model')
const ReportResponse = require('../../models/reportResponses.model')
const { checkDuplicate } = require('../../../config/errors')
const mongoose = require('mongoose');
var ObjectID = require('mongodb').ObjectID;
const moment = require('moment')

// API to create Report
exports.create = async (req, res, next) => {
    try {
        let payload = req.body
        const content = await Report.create(payload)
        return res.status(200).send({ success: true, message: 'NFT reported successfully', content })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Report')
        else
            return next(error)
    }
}

// API to edit Report
exports.edit = async (req, res, next) => {
    try {
        let { status, _id } = req.body

        if (status) {
            status = parseInt(status)
        }

        const nftReport = await Report.findByIdAndUpdate({ _id }, { $set: { status } }, { new: true })
        return res.send({ success: true, message: 'Status updated successfully', nftReport })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Report')
        else
            return next(error)
    }
}

exports.uploadReportImg = async (req, res, next) => {
    try {
        if (req.file) {
            return res.status(200).send({ success: true, message: 'Image uploaded successfully!', imageData: req.file })
        }
        else {
            return res.status(400).send({ success: false, message: 'Image not found!' })

        }
    }
    catch (err) {
        next(err)
    }
}
// API to delete content
exports.delete = async (req, res, next) => {
    try {
        const { reportId } = req.params
        if (reportId) {
            const content = await Report.deleteOne({ _id: reportId })
            if (content && content.deletedCount)
                return res.send({ success: true, message: 'Report deleted successfully', reportId })
            else return res.status(400).send({ success: false, message: 'Report not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Report Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get a Report
exports.get = async (req, res, next) => {
    try {
        const { reportId } = req.params
        if (reportId) {
            const content = await Report.findOne({ _id: reportId }, { _id: 1, title: 1, status: 1, slug: 1, description: 1 }).lean(true)
            if (content)
                return res.json({ success: true, message: 'Report retrieved successfully', content })
            else return res.status(400).send({ success: false, message: 'Report not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Report Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get Report list
exports.list = async (req, res, next) => {
    try {
        let { page, limit } = req.query
        let { reportedBy, reportedTo, nftId, status, createdAtFrom, createdAtTo } = req.body
        const filter = {}
        let nftIds = []

        if (reportedBy) {
            filter.reportedBy = mongoose.Types.ObjectId(reportedBy)
        }
        if (reportedTo) {
            filter.reportedTo = mongoose.Types.ObjectId(reportedTo)
        }
        if (nftId) {
            nftId = nftId.trim()
            let nftName = { $regex: nftId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: 'gi' }
            let nftData = await NFT.find({ name: nftName }).lean()
            nftData.map((nft) => {
                return nftIds.push(nft._id)
            })

            filter.nftId = { $in: nftIds }
        }
        if (status) {
            filter.status = parseInt(status)
        }
        if (createdAtFrom && createdAtTo) {
            let startDate = moment.utc(new Date(createdAtFrom)).format('YYYY-MM-DD');
            let endDate = moment.utc(new Date(createdAtTo)).add(1, 'day').format('YYYY-MM-DD');
            filter.createdAt = { $gte: new Date(startDate), $lt: new Date(endDate) }
        }

        else if (createdAtFrom) {
            let startDate = moment.utc(new Date(createdAtFrom)).format('YYYY-MM-DD');
            filter.createdAt = { $gte: new Date(startDate) }
        }

        else if (createdAtTo) {
            let endDate = moment.utc(new Date(createdAtTo)).add(1, 'day').format('YYYY-MM-DD');
            filter.createdAt = { $lt: new Date(endDate) }
        }
        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        const total = await Report.countDocuments(filter)

        if (page > Math.ceil(total / limit) && total > 0)
            page = Math.ceil(total / limit)

        const nftReports = await Report.aggregate([
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
                    localField: 'reportedBy',
                    as: 'reportedFrom'
                }
            },
            { $unwind: '$reportedFrom' },
            {
                $lookup: {
                    from: 'users',
                    foreignField: '_id',
                    localField: 'reportedTo',
                    as: 'reportedUser'
                }
            },
            { $unwind: '$reportedUser' },
            { $skip: limit * (page - 1) },
            { $limit: limit },
            {
                $project: {
                    _id: 1, nftId: 1, status: 1, description: 1, reportedTo: 1,
                    reportedBy: 1, createdAt: 1,
                    nft: {
                        _id: '$nft._id',
                        name: '$nft.name',
                    },
                    reportedFrom: {
                        _id: '$reportedFrom._id',
                        name: '$reportedFrom.username'
                    },
                    reportedUser: {
                        _id: '$reportedUser._id',
                        name: '$reportedUser.username'
                    }
                }
            }
        ])

        return res.send({
            success: true, message: 'NFT reports fetched successfully',
            data: {
                nftReports,
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

exports.addReportResponse = async (req, res, next) => {
    try {
        let { reportId, id, content, isAdmin } = req.body
        let payload = {}

        if (reportId) {
            payload.reportId = new ObjectID(reportId)
        }
        
        if(id && id !=='null' && id !==''){
            if (content && isAdmin) {
                payload.adminId = new ObjectID(id)
                payload.adminResponse = content
            }
            else {
                payload.userId = new ObjectID(id)
                payload.userResponse = content
            }
        }
        else {
            return res.status(200).send({success : false, message : 'Admin Id is required'})
        }

        let reportRes = await ReportResponse.create(payload)
        res.status(200).send({ success: true, reportRes })
    }
    catch (err) {
        next(err)
    }
}

exports.getReportMessages = async (req, res, next) => {
    try {
        let { reportId } = req.body
        const filter = { reportId: new ObjectID(reportId) }

        let reportMessages = await ReportResponse.aggregate([
            {
                $match: filter
            },
            {
                $lookup: {
                    from: 'admins',
                    foreignField: '_id',
                    localField: 'adminId',
                    as: 'admin'
                }
            },
            {
                $unwind: {
                    path: "$admin",
                    preserveNullAndEmptyArrays: true
                }
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
                $unwind: {
                    path: "$user",
                    preserveNullAndEmptyArrays: true
                }
            },
            { $sort: { 'createdAt': 1 } },
            {
                $project: {
                    _id: 0, reportId: 1, adminResponse: 1, userResponse: 1, createdAt: 1,
                    admin: {
                        _id: '$admin._id',
                        name: '$admin.name'
                    },
                    user: {
                        _id: '$user._id',
                        name: '$user.username'
                    }
                }
            },

        ])
        return res.status(200).send({ success: true, reportMessages })
    }
    catch (err) {
        next(err)
    }
}