const NFT = require('../../models/nfts.model')
const Offer = require('../../models/offer.model')
const SellHistory = require('../../models/sellHistory.model')
const ObjectId = require('mongoose').Types.ObjectId
const { userDefaultImage, baseUrl } = require('../../../config/vars')
const { insert } = require('../../utils/activity')
const { createNFTC, transferStake } = require('./nfts.controller')
const { createEarnings } = require('./earning.controller')
const { createGiftCardLogs, deleteGiftCardLog, updateGiftCardStatus } = require('../gamification/giftCards.controller')

// API to create offer
exports.create = async (req, res, next) => {
    try {
        let payload = req.body
        payload.offerBy = req.user
        let hasDiscount = payload.hasDiscount

        delete payload['hasDiscount']
        const offer = await Offer.create(payload)

        // create gift card log
        if(hasDiscount){
            let logData = {
                offerId: offer._id,
                userId: offer.offerBy,
                nftId: payload.nftId,
                collectionId: payload.collectionId,
                token: payload.giftCardToken,
                paymentMethod: 3,
                originalPrice: payload.originalPrice,
                currency: offer.price.currency,
                discountedPrice: offer.price.amount,
                discount: payload.discountPercentage,
                isGiftCardUsed: false
            }
            await createGiftCardLogs(logData)
        }
        insert({ userId: req.user, toUserId: payload.ownerId, nftId: payload.nftId, type: 2, price: payload.price.amount, currency: payload.price.currency, collectionId: payload.collectionId })

        return res.send({ success: true, message: 'You have made offer successfully', offer })
    } catch (error) {
        return next(error)
    }
}

// API to delete offer
exports.delete = async (req, res, next) => {
    try {
        const { offerId } = req.params
        if (offerId) {

            // delete any gift card log present againt this offer
            let response = await deleteGiftCardLog({ offerId })

            const offer = await Offer.deleteOne({ _id: offerId })
            if (offer && offer.deletedCount)
                return res.send({ success: true, message: 'Your Offer has been cancelled successfully' })
            else return res.status(400).send({ success: false, message: 'Offer not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Offer Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get offers list
exports.list = async (req, res, next) => {
    try {
        let { page, limit, nftId } = req.query
        let filter = { isExpired: false, isAccepted: false }

        if (nftId)
            filter.nftId = ObjectId(nftId)

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        const total = await Offer.countDocuments(filter)

        const offers = await Offer.aggregate([
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $skip: limit * (page - 1) },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    foreignField: '_id',
                    localField: 'offerBy',
                    as: 'offerBy'
                }
            },
            {
                $unwind: '$offerBy'
            },
            {
                $project: {
                    offerBy: {
                        _id: '$offerBy._id',
                        username: '$offerBy.username',
                        profilePhoto: { $ifNull: [{ $concat: [baseUrl, '$offerBy.profileImageLocal'] }, userDefaultImage] },
                        address: '$offerBy.address'
                    },
                    price: 1, expiryDate: 1, createdAt: 1, txHash: 1
                }
            }
        ])

        return res.send({
            success: true, message: 'Offers fetched successfully',
            data: {
                offers,
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

// API to accept offer
exports.accept = async (req, res, next) => {
    try {
        const { offerId, txHash, royalties, tokenId, acceptSign } = req.body
        const sellerId = req.user

        if (!sellerId)
            return res.status(400).send({ success: false, message: 'Seller is required' })

        if (offerId) {
            // accept offer
            const offer = await Offer.findByIdAndUpdate({ _id: offerId }, { isAccepted: true, txHash, acceptSign }, { new: true })

            // update status of gift card log to be true
            const log = await updateGiftCardStatus(offerId)
            let redeemedVoucher;
            if(log.success){
                redeemedVoucher = {
                    token : log.data.token,
                    offerByUserAddress : log.data.userId
                }
            }

            if (offer) {
                // expire other offers
                await Offer.updateMany({ _id: { $ne: ObjectId(offerId) }, nftId: offer.nftId }, { $set: { isExpired: true } })

                // delete other gift card logs present againt nft
                let response = await deleteGiftCardLog({ nftId : offer.nftId, offerId, deleteExceptThisOffer : true })

                let nft = await NFT.findOne({ _id: offer.nftId })

                // create owner earnings
                await createEarnings(royalties, nft._id, nft.collectionId, nft.currency === 'BNB' ? 'WBNB' : nft.currency, nft.currentPrice)

                // create sell history
                await SellHistory.create({
                    sellerId: offer.ownerId,
                    buyerId: offer.offerBy,
                    nftId: offer.nftId,
                    collectionId: offer.collectionId,
                    sold: true,
                    price: offer.price,
                    txHash
                })

                // create activity
                insert({ userId: offer.ownerId, toUserId: offer.offerBy, nftId: offer.nftId, type: 4, price: offer.price.amount, currency: offer.price.currency, collectionId: offer.collectionId, })

                if (nft?.type === 1) {
                    // create NFTC only if it's simple NFT
                    // check if ever same seller has NFTC for given simple NFT
                    const existingNFTC = await NFT.findOne({ type: 2, belongsTo: nft._id, ownerId: sellerId })

                    if (!existingNFTC) {
                        const nftc = await createNFTC(nft)

                        if (nftc) {
                            // update platform share for simple NFT
                            nft.platformShare = nftc.platformShare

                            // create activity
                            insert({ userId: sellerId, nftId: nftc._id, type: 1, collectionId: nftc.collectionId })
                        }
                    }
                }

                // update NFT
                nft.sellingMethod = undefined
                nft.sellingConfig = undefined
                nft.auctionEndDate = undefined
                nft.auctionEndTime = undefined
                nft.auctionStartDate = undefined
                nft.auctionStartTime = undefined
                nft.currentPrice = undefined
                nft.currency = undefined
                nft.status = 1
                nft.ownerId = offer.offerBy
                nft.tokenId = tokenId
                await nft.save()

                res.send({ success: true, message: 'Offer has been accepted successfully', redeemedVoucher})

                // transfer stake - only if NFT was on stake already
                if (nft.isStaked)
                    transferStake(nft)
            } else return res.status(400).send({ success: false, message: 'Offer not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Offer Id is required' })
    } catch (error) {
        return next(error)
    }
}
