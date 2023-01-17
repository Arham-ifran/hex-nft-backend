const fs = require('fs')
const passport = require('passport')
const localStrategy = require('passport-local').Strategy
const mongoose = require('mongoose');
const Admin = require('../../models/admin.model')
const Roles = require('../../models/roles.model')
const { addImage } = require('../../utils/upload')
const { checkDuplicate } = require('../../../config/errors')
const { sendEmail } = require('../../utils/emails/emails')
const { adminUrl, adminPasswordKey, tinifyAPIKey } = require('../../../config/vars');
const randomstring = require("randomstring");
const { validationResult } = require('express-validator')

const Users = require('../../models/users.model')
const Categories = require('../../models/categories.model')
const Collections = require('../../models/collection.model')
const Nfts = require('../../models/nfts.model')
const { baseUrl } = require('../../../config/vars')
const tinify = require("tinify");
tinify.key = tinifyAPIKey;

// API to login admin
exports.login = async (req, res, next) => {
    try {
        let { email, password } = req.body

        if (!email && !password)
            return res.status(402).send({ success: false, message: 'Email & Password required' })

        email = email.toLowerCase()
        const user = await Admin.findOne({ email }).lean()

        if (!user)
            return res.status(404).send({ success: false, message: 'Incorrect email or password' })

        const adminRoles = await Roles.findOne({ _id: user.roleId }, { status: 1 })

        passport.use(new localStrategy({ usernameField: 'email' },
            (username, password, done) => {
                Admin.findOne({ email: username }, 'name email phone address roleId status image password', (err, user) => {
                    if (err)
                        return done(err)
                    else if (!user) // unregistered email
                        return done(null, false, { success: false, message: 'Incorrect email or password' })
                    else if (!user.verifyPassword(password)) // wrong password
                        return done(null, false, { success: false, message: 'Incorrect email or password' })
                    else return done(null, user)
                })
                // .populate({ path: "roleId", select: 'title' })
            })
        )

        // call for passport authentication
        passport.authenticate('local', async (err, user, info) => {
            if (err) return res.status(400).send({ err, success: false, message: 'Oops! Something went wrong while authenticating' })
            // registered user
            else if (user) {
                if (!user.status)
                    return res.status(403).send({ success: false, message: 'Your account is inactive, kindly contact admin', user })
                else {
                    var accessToken = await user.token()
                    let data = {
                        ...user._doc,
                        accessToken
                    }
                    await Admin.updateOne({ _id: user._id }, { $set: { accessToken } }, { upsert: true })
                    return res.status(200).send({ success: true, message: 'Admin logged in successfully', data, adminStatus: adminRoles.status })
                }
            }
            // unknown user or wrong password
            else return res.status(402).send({ success: false, message: 'Incorrect email or password' })
        })(req, res)

    } catch (error) {
        return next(error)
    }
}

// API to create admin 
exports.create = async (req, res, next) => {
    try {
        let payload = req.body
        if (req.files && req.files.image) {
            const image = req.files.image[0]
            const imgData = fs.readFileSync(image.path)
            const fileExtension = image.originalname.match(/\.([^\.]+)$/)[1]

            payload.image = await addImage(imgData)

            // compressing image and saving to server
            if (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png')
                tinify.fromFile(image.path).toFile(image.path);
        }

        const admin = new Admin(payload)
        await admin.save()

        return res.send({ success: true, message: 'Admin user created successfully', admin })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Admin')
        else
            return next(error)
    }
}

//API to verify  admin password
exports.verify = async (req, res, next) => {
    try {
        let { password } = req.body;
        let userId = req.user;
        let currentPasswordFlag = false;
        let user = await Admin.findById({ _id: userId, }).exec();
        if (user) {
            if (password) {
                currentPasswordFlag = await user.verifyPassword(password)// check if current password is valid
            }
            if (currentPasswordFlag) {
                return res.status(200).send({
                    success: true,
                    message: 'Password is right',
                    data: true,
                });
            }
            else {
                return res.status(200).send({
                    success: false,
                    message: 'Your entered password is wrong',
                    data: false,
                });
            }
        }
    }
    catch (error) {
        next(error)
    }
}

// API to edit admin
exports.edit = async (req, res, next) => {
    try {
        let payload = req.body
        const password = payload.password
        delete payload.password

        if (req.files && req.files.image) {
            const image = req.files.image[0]
            const imgData = fs.readFileSync(image.path)
            const fileExtension = image.originalname.match(/\.([^\.]+)$/)[1]

            payload.image = await addImage(imgData)
            payload.imageLocal = image.filename

            // compressing image and saving to server
            if (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png')
                tinify.fromFile(image.path).toFile(image.path);
        }

        const admin = await Admin.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(payload._id) }, { $set: payload }, { new: true })

        if (password && password !== '') {
            admin.password = password
            await admin.save()
        }

        return res.send({ success: true, message: 'Admin updated successfully', admin })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Admin')
        else
            return next(error)
    }
}

// API to delete admin
exports.delete = async (req, res, next) => {
    try {
        const { adminId } = req.params
        if (adminId) {
            const admin = await Admin.deleteOne({ _id: adminId })
            if (admin.deletedCount)
                return res.send({ success: true, message: 'Admin deleted successfully', adminId })
            else return res.status(400).send({ success: false, message: 'Admin not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Admin Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get an admin
exports.get = async (req, res, next) => {
    try {
        const { adminId } = req.params
        if (adminId && adminId !== 'null' && adminId !== null) {
            let admin = await Admin.findOne({ _id: adminId }, { __v: 0, createdAt: 0, updatedAt: 0, password: 0 }).lean(true)
            admin.image = admin.imageLocal ? `${baseUrl}${admin.imageLocal}` : ''

            if (admin)
                return res.json({ success: true, message: 'Admin retrieved successfully', admin })
            else return res.status(400).send({ success: false, message: 'Admin not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Admin Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get admin list
exports.list = async (req, res, next) => {
    try {
        let { page, limit, adminId, query } = req.query

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        if (adminId && adminId !== 'null' && adminId !== null) {
            if (query != undefined && query != '') {
                query = {
                    $or: [
                        { name: new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi') },
                        { email: new RegExp(query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi') },
                    ],
                    _id: { $ne: mongoose.Types.ObjectId(adminId) }
                }
            } else query = {
                _id: { $ne: mongoose.Types.ObjectId(adminId) },
            };


            const total = await Admin.countDocuments({ _id: { $ne: mongoose.Types.ObjectId(adminId) } })

            const admins = await Admin.aggregate([
                { $match: query },
                { $sort: { createdAt: -1 } },
                {
                    $lookup: {
                        from: 'roles',
                        foreignField: '_id',
                        localField: 'roleId',
                        as: 'role'
                    }
                },
                { $unwind: '$role' },
                {
                    $project: {
                        role: {
                            _id: '$role._id',
                            title: '$role.title'
                        },
                        email: 1, name: 1, status: 1, phone: 1, roleId: 1, password: 1
                        // createdAt : 0, updatedAt : 0, __v: 0
                    }
                },
                { $skip: limit * (page - 1) },
                { $limit: limit },
            ])

            return res.send({
                success: true, message: 'Admins fetched successfully',
                data: {
                    admins,
                    pagination: {
                        page, limit, total,
                        pages: Math.ceil(total / limit) <= 0 ? 1 : Math.ceil(total / limit)
                    }
                }
            })
        }
        else {
            return res.send({
                success: false, message: 'Admin Id is required'
            })
        }
    } catch (error) {
        return next(error)
    }
}

// API to edit admin password
exports.editPassword = async (req, res, next) => {
    try {
        let payload = req.body
        let admin = await Admin.find({ _id: mongoose.Types.ObjectId(payload._id) })
        if (admin[0].verifyPassword(payload.current)) {
            let newPayload = {
                password: await admin[0].getPasswordHash(payload.new)
            }
            let updatedAdmin = await Admin.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(payload._id) }, { $set: newPayload }, { new: true })
            return res.send({ success: true, message: 'Password updated successfully', updatedAdmin })
        }
        else {
            return res.send({ success: false, message: 'Incorrent current password', admin: admin[0] })
        }


    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Admin')
        else
            return next(error)
    }
}

// API to edit admin password
exports.forgotPassword = async (req, res, next) => {
    try {
        let payload = req.body
        let admin = await Admin.find({ email: payload.email })
        if (admin.length) {
            let randString = randomstring.generate({
                length: 8,
                charset: 'alphanumeric'
            })
            await Admin.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(admin[0]._id) }, { $set: { resetCode: randString } }, { new: true })

            let content = {
                "${url}": `${adminUrl}admin/reset-password/${admin[0]._id}/${randString}`
            }

            await sendEmail(payload.email, 'forgot-password', content)
            return res.send({ success: true, message: 'An email has been sent to your account in case an account with this email exists. Please check your email and follow the instruction in it to reset your password.' })
        }
        else {
            return res.send({ success: false, message: 'Sorry! The email address entered was not found' })
        }

    } catch (error) {
        return next(error)
    }
}

// API to reset password
exports.resetPassword = async (req, res, next) => {
    try {
        let payload = req.body
        let admin = await Admin.find({ _id: mongoose.Types.ObjectId(payload._id) })
        if (admin.length) {
            if (admin[0].resetCode === payload.code) {
                let newPayload = {
                    password: await admin[0].getPasswordHash(payload.new),
                    resetCode: ''
                }
                let updatedAdmin = await Admin.findByIdAndUpdate({ _id: mongoose.Types.ObjectId(payload._id) }, { $set: newPayload }, { new: true })
                return res.send({ success: true, message: 'Password reset successfully', updatedAdmin })
            }
            else {
                return res.send({ success: false, message: 'Session expired, try again with other email link.' })
            }
        }
        else {
            return res.send({ success: false, message: 'Incorrent Admin Id' })
        }
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Admin')
        else
            return next(error)
    }
}

// API to get dashboard
exports.dashboard = async (req, res, next) => {
    try {
        const users = await Users.countDocuments({})
        const categories = await Categories.countDocuments({})
        const collections = await Collections.countDocuments({})
        const nfts = await Nfts.countDocuments({})
        const auctions = await Nfts.countDocuments({ sellingMethod: 2 })
        return res.send({
            success: true,
            message: 'Stats fetched successfully',
            data: {
                users,
                categories,
                collections,
                nfts,
                auctions
            }
        })
    } catch (error) {
        return next(error)
    }
}

exports.privateAdmin = async (req, res, next) => {
    try {
        return res.render('index', { baseUrl });
    }
    catch (err) {
        next(err)
    }
}
exports.createPrivateAdmin = async (req, res, next) => {
    try {
        let username = req.body.name
        let email = req.body.email
        let password = req.body.password
        let privateKey = req.body.privatekey
        let status = req.body.status === '1' ? true : false
        let admin = await Admin.findOne({ email }, { _id: 1, email: 1 })
        if (admin) {
            return res.status(400).send({ status: false, message: 'Admin with same email already exists!' })
        }

        if (privateKey === adminPasswordKey) {

            roleAlreadyExists = await Roles.findOne({ title: privateAdminPermissionsKeys.title }, { _id: 1 })
            if (roleAlreadyExists) {
                await Admin.create({ name: username, email, password, status, roleId: mongoose.Types.ObjectId(roleAlreadyExists._id) })
            }
            else {
                let createdRole = await Roles.create(privateAdminPermissionsKeys)
                await Admin.create({ name: username, email, password, status, roleId: mongoose.Types.ObjectId(createdRole._id) })

            }
            return res.status(200).send({ status: true, message: 'Admin created successfully!' })

        }
        else {
            return res.status(400).send({ status: false, message: 'Incorrect Private Key!' })
        }
    }
    catch (err) {
        next(err)
    }
}



var privateAdminPermissionsKeys = {
    "viewDashboard": true,
    "addStaff": true,
    "editStaff": true,
    "deleteStaff": true,
    "viewStaff": true,
    "addUser": true,
    "editUser": true,
    "deleteUser": true,
    "viewUsers": true,
    "addCategory": true,
    "editCategory": true,
    "deleteCategory": true,
    "viewCategory": true,
    "addCollection": true,
    "editCollection": true,
    "deleteCollection": true,
    "viewCollection": true,
    "addStaking": true,
    "editStaking": true,
    "deleteStaking": true,
    "viewStaking": true,
    "addNft": true,
    "editNft": true,
    "viewNft": true,
    "deleteNft": true,
    "viewReports": true,
    "editReports": true,
    "deleteReports": true,
    "viewReportResponses": true,
    "addRole": true,
    "editRole": true,
    "deleteRole": true,
    "viewRole": true,
    "addFaq": true,
    "editFaq": true,
    "deleteFaq": true,
    "viewFaqs": true,
    "viewContact": true,
    "editContact": true,
    "viewActivity": true,
    "editSetting": true,
    "viewSetting": true,
    "addContent": true,
    "editContent": true,
    "deleteContent": true,
    "viewContent": true,
    "addDigitalAssets": true,
    "viewDigitalassets": true,
    "editDigitalAssets": true,
    "deleteDigitalAssets": true,
    "addHelpCenterPage": true,
    "editHelpCenterPage": true,
    "viewHelpCenterPage": true,
    "deleteHelpCenterPage": true,
    "addPaymentGateway": true,
    "editPaymentGateway": true,
    "viewPaymentGateway": true,
    "deletePaymentGateway": true,
    "viewThirdParty": true,
    "editThirdParty": true,
    "editEmails": true,
    "viewEmails": true,
    "viewNewsLetter": true,
    "viewNotableDropsSettings": true,
    "editNotableDropsSettings": true,
    "viewHomepageNftSettings": true,
    "editHomepageNftSettings": true,
    "status": true,
    "title": "super admin",
    "isSuperAdmin": true,
}