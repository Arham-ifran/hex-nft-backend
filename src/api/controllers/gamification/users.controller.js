const fs = require('fs');
const User = require('../../models/users.model')
const NFT = require('../../models/nfts.model')
const ObjectId = require('mongoose').Types.ObjectId
const { addImage } = require('../../utils/upload');
const { baseUrl, gamificationPlaceholder } = require('../../../config/vars')

exports.get = async (req, res, next) => {
    try {
        const { address } = req.params;

        if (!address)
            return res.status(400).send({ success: false, message: 'User wallet address is required' })
        else {
            const user = await User.findOne({ address }, 'username address profileImage badgeImage bannerImage profileImageLocal badgeImageLocal bannerImageLocal').lean(true);

            if (!user)
                return res.status(400).send({ success: false, message: "We've explored deep and wide but we're unable to find the user you're looking for" })
            else {
                // get user nfts
                const createdNFTs = await NFT.countDocuments({ creatorId: ObjectId(user._id) })
                const collectedNFTs = await NFT.countDocuments({ ownerId: ObjectId(user._id) })

                user.createdNFTs = createdNFTs
                user.collectedNFTs = collectedNFTs

                user.profileImage = user.profileImage || gamificationPlaceholder
                user.badgeImage = user.badgeImage || gamificationPlaceholder
                user.bannerImage = user.bannerImage || gamificationPlaceholder

                user.profileImageLocal = user.profileImageLocal ? `${baseUrl}${user.profileImageLocal}` : gamificationPlaceholder
                user.badgeImageLocal = user.badgeImageLocal ? `${baseUrl}${user.badgeImageLocal}` : gamificationPlaceholder
                user.bannerImageLocal = user.bannerImageLocal ? `${baseUrl}${user.bannerImageLocal}` : gamificationPlaceholder

                return res.json({ success: true, message: "User details fetched succesfully", user });
            }
        }
    } catch (error) {
        return next(error);
    }
}

exports.update = async (req, res, next) => {
    try {
        let payload = req.body
        if (!payload.address)
            return res.send({ status: false, message: 'Address is required' })

        if (req.files) {
            for (const key in req.files) {
                const image = req.files[key][0]
                const imgData = fs.readFileSync(image.path)
                payload[key] = await addImage(imgData)
                payload[`${key}Local`] = image.filename
            }
        }

        const user = await User.findOneAndUpdate({ address: payload.address }, { $set: payload }, { new: true })

        if (!user)
            return res.send({ status: false, message: 'User not found' })

        return res.send({ status: true, message: 'Profile updated successfully', user })
    } catch (error) {
        return next(error)
    }
}