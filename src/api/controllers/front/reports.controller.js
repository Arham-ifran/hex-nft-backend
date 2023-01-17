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
        const report = await Report.create(payload)
        return res.status(200).send({ success: true, message: 'NFT has been reported successfully', report })
    } catch (error) {
        res.send({ success: false, message: 'Oops! Something went wrong. Please try again.' })
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

// API to get user reports
exports.get = async (req, res, next) => {
    try {
        const { userId } = req.params
        let { page, limit, reportedTo, status, nftTitle, isNftId, nftId } = req.body
        let nftTitles = []

        if (userId && !isNftId) {

            const filter = {}

            if (reportedTo) {
                filter.reportedTo = mongoose.Types.ObjectId(reportedTo)
            }
            if (nftTitle && nftTitle !== '') {
                nftTitle = nftTitle.trim()
                let nftName = { $regex: nftTitle.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: 'gi' }
                let nftData = await NFT.find({ name: nftName }).lean()
                nftData.map((nft) => {
                    return nftTitles.push(nft._id)
                })

                filter.nftId = { $in: nftTitles }
            }
            if (status) {
                filter.status = parseInt(status)
            }

            page = page !== undefined && page !== '' ? parseInt(page) : 1
            limit = limit !== undefined && limit !== '' ? parseInt(limit) : 20

            filter.reportedBy = new ObjectID(userId)

            const total = await Report.countDocuments(filter)

            if (page > Math.ceil(total / limit) && total > 0)
                page = Math.ceil(total / limit)

            const reports = await Report.aggregate([
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
                        localField: 'reportedTo',
                        as: 'reportedUser'
                    }
                },
                { $unwind: '$reportedUser' },
                { $skip: limit * (page - 1) },
                { $limit: limit },
                {
                    $project: {
                        _id: 1, status: 1, description: 1,
                        reportedBy: 1, createdAt: 1,
                        nft: {
                            _id: '$nft._id',
                            name: '$nft.name',
                        },

                        reportedUser: {
                            _id: '$reportedUser._id',
                            name: '$reportedUser.username'
                        }
                    }
                }
            ])

            return res.json({
                success: true, message: 'Reports retrieved successfully', reports,
                pagination: {
                    page, limit, total,
                    pages: Math.ceil(total / limit) <= 0 ? 1 : Math.ceil(total / limit)
                }
            })
        }
        else if (userId && nftId) {
            let nftReport = await Report.findOne({ nftId, reportedBy: userId })
            if (nftReport) {
                return res.status(200).send({ success: true, nftReport })
            }
            else {
                return res.status(200).send({ success: true, nftReport })
            }
        }
        else
            return res.status(400).send({ success: false, message: 'User Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get report
exports.getReport = async (req, res, next) => {
    try {
        const { reportId } = req.params
        if (reportId) {
            let filter = { _id: new ObjectID(reportId) }
            const reportDetails = await Report.aggregate([
                { $match: filter },
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
                        localField: 'reportedTo',
                        as: 'reportedUser'
                    }
                },
                { $unwind: '$reportedUser' },

                {
                    $lookup: {
                        from: 'users',
                        foreignField: '_id',
                        localField: 'reportedBy',
                        as: 'reportedFrom'
                    }
                },
                { $unwind: '$reportedFrom' },

                { $sort: { 'createdAt': 1 } },
                {
                    $project: {
                        _id: 1, createdAt: 1, status: 1, description: 1,
                        reportedUser: {
                            id: '$reportedUser._id',
                            reportedTo: '$reportedUser.username'
                        },
                        reportedFrom: {
                            name: '$reportedFrom.username',
                            id: '$reportedFrom._id',
                        },
                        nft: {
                            nftId: '$nft._id',
                            nftTitle: '$nft.name'
                        },
                    }
                }
            ])

            filter = { reportId: new ObjectID(reportId) }
            const reportMessages = await ReportResponse.aggregate([
                { $match: filter },
                {
                    $lookup: {
                        from: 'admins',
                        foreignField: '_id',
                        localField: 'adminId',
                        as: 'admin'
                    }
                },
                { $unwind: { path: "$admin", preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'users',
                        foreignField: '_id',
                        localField: 'userId',
                        as: 'user'
                    }
                },
                { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

                { $sort: { 'createdAt': 1 } },
                {
                    $project: {
                        _id: 1, createdAt: 1, adminResponse: 1, userResponse: 1,
                        admin: { name: '$admin.name', adminId: '$admin._id' },
                        user: { name: '$user.username', userId: '$user._id' }
                    }
                }

            ])

            return res.json({ success: true, message: 'Reports retrieved successfully', reportDetails, reportMessages })

        }
        else {
            return res.status(400).send({ success: false, message: 'Report id is required' })
        }
    } catch (error) {
        return next(error)
    }
}

// API to add report message
exports.addReportResponse = async (req, res, next) => {
    try {
        let { reportId, id, content } = req.body
        let payload = {}

        if (reportId) {
            payload.reportId = new ObjectID(reportId)
        }

        if (content) {
            payload.userResponse = content
        }

        if (id) {
            payload.userId = id
        }

        let reportRes = await ReportResponse.create(payload)
        res.status(200).send({ success: true, reportRes })
    }
    catch (err) {
        next(err)
    }
}

exports.getReportedNftUsers = async (req, res, next) => {
    try {
        let { id } = req.body
        const filter = {}

        if (id) {
            filter.reportedBy = new ObjectID(id)
            let reportedUsers = await Report.aggregate([
                { $match: filter },
                { $sort: { createdAt: -1 } },
                {
                    $lookup: {
                        from: 'users',
                        foreignField: '_id',
                        localField: 'reportedTo',
                        as: 'reportedUser'
                    }
                },
                { $unwind: '$reportedUser' },
                {
                    $project: {
                        _id: 0,
                        reportedUser: {
                            _id: '$reportedUser._id',
                            name: '$reportedUser.username'
                        }
                    }
                },
                {
                    $group: {
                        _id: '$reportedUser._id',
                        name: { $first: '$reportedUser.name' }
                    },
                }

            ])
            return res.status(200).send({ success: true, reportedUsers })

        }
        else {
            return res.status(400).send({ success: false, message: '"Reported By" id is required' })
        }

    }
    catch (err) {
        next(err)
    }
}