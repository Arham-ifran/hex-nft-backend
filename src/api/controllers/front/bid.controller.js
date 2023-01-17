const fs = require('fs')
const axios = require('axios')
const moment = require('moment')
const Bid = require('../../models/bids.model')
const SellHistory = require('../../models/sellHistory.model')
const SellingConfig = require('../../models/sellingConfigs.model')
const ObjectId = require('mongoose').Types.ObjectId
const { userDefaultImage, MYNTtoBNBLink, WBNBtoBNBLink, baseUrl, extendAuctionTimeBy } = require('../../../config/vars')
const NFT = require('../../models/nfts.model')
const { insert } = require('../../utils/activity')
const { createNFTC, transferStake } = require('./nfts.controller')
const { createEarnings } = require('./earning.controller')
const { createGiftCardLogs, deleteGiftCardLog, updateGiftCardStatus } = require('../gamification/giftCards.controller')
// API to create bid
exports.create = async (req, res, next) => {
    try {
        let payload = req.body
        payload.bidBy = req.user
        let hasDiscount = payload.hasDiscount

        delete payload['hasDiscount']

        const bid = await Bid.create(payload)

        // create gift card log
        if(hasDiscount){
            let logData = {
                bidId: bid._id,
                userId: bid.bidBy,
                nftId: payload.nftId,
                collectionId: payload.collectionId,
                token: payload.giftCardToken,
                paymentMethod: 3,
                originalPrice: payload.originalPrice,
                currency: bid.price.currency,
                discountedPrice: bid.price.amount,
                discount: payload.discountPercentage,
                isGiftCardUsed: false
            }
            let response = await createGiftCardLogs(logData)
            console.log('reponse-----------------', response)
        }

        insert({ userId: req.user, toUserId: payload.ownerId, nftId: payload.nftId, type: 3, price: payload.price.amount, currency: payload.price.currency, collectionId: payload.collectionId })
        res.send({ success: true, message: 'You have placed bid successfully', bid })
        await extendAuctionTime(payload.nftId)
    } catch (error) {
        return next(error)
    }
}

// API to delete bid
exports.delete = async (req, res, next) => {
    try {
        const { bidId } = req.params
        if (bidId) {
            const bid = await Bid.deleteOne({ _id: bidId })
            if (bid && bid.deletedCount)
                return res.send({ success: true, message: 'Your bid has been cancelled successfully' })
            else return res.status(400).send({ success: false, message: 'Bid not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Bid Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get bids list
exports.list = async (req, res, next) => {
    try {
        let { page, limit, nftId } = req.query
        let filter = { isExpired: false, isAccepted: false }

        if (nftId)
            filter.nftId = ObjectId(nftId)

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        const total = await Bid.countDocuments(filter)

        const bids = await Bid.aggregate([
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $skip: limit * (page - 1) },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    foreignField: '_id',
                    localField: 'bidBy',
                    as: 'bidBy'
                }
            },
            {
                $unwind: '$bidBy'
            },
            {
                $project: {
                    bidBy: {
                        _id: '$bidBy._id',
                        username: '$bidBy.username',
                        profilePhoto: { $ifNull: [{ $concat: [baseUrl, '$bidBy.profileImageLocal'] }, userDefaultImage] },
                        address: '$bidBy.address'
                    },
                    price: 1, expiryDate: 1, createdAt: 1, txHash: 1
                }
            }
        ])

        const highestBid = await getHighestBid(nftId)

        return res.send({
            success: true, message: 'Bids fetched successfully',
            data: {
                bids,
                pagination: {
                    page, limit, total,
                    pages: Math.ceil(total / limit) <= 0 ? 1 : Math.ceil(total / limit)
                },
                highestBid
            }
        })
    } catch (error) {
        return next(error)
    }
}

// API to accept bid
exports.accept = async (req, res, next) => {
    try {
        const { bidId, txHash, royalties, tokenId, acceptSign } = req.body
        const sellerId = req.user

        if (!sellerId)
            return res.status(400).send({ success: false, message: 'Seller is required' })

        if (bidId) {
            // accept bid
            const bid = await Bid.findByIdAndUpdate({ _id: bidId }, { isAccepted: true, txHash, acceptSign }, { new: true })

            // update status of gift card log to be true
            let log = await updateGiftCardStatus(bidId)
            let redeemedVoucher;
            if(log.success){
                redeemedVoucher = {
                    token : log.data.token,
                    bidByUserAddress : log.data.userId
                }
            }
            if (bid) {
                // expire other bids
                await Bid.updateMany({ _id: { $ne: ObjectId(bidId) }, nftId: bid.nftId }, { $set: { isExpired: true } })

                // delete other gift card logs present againt nft
                let response = await deleteGiftCardLog({ nftId : bid.nftId, bidId, deleteExceptThisBid : true })

                let nft = await NFT.findOne({ _id: bid.nftId })

                // create owner earnings
                await createEarnings(royalties, nft._id, nft.collectionId, nft.currency === 'BNB' ? 'WBNB' : nft.currency, nft.currentPrice)

                // create sell history
                await SellHistory.create({
                    sellerId: bid.ownerId,
                    buyerId: bid.bidBy,
                    nftId: bid.nftId,
                    collectionId: bid.collectionId,
                    sold: true,
                    price: bid.price,
                    txHash
                })

                // create activity
                insert({ userId: bid.ownerId, toUserId: bid.bidBy, nftId: bid.nftId, type: 5, price: bid.price.amount, currency: bid.price.currency, collectionId: bid.collectionId })

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
                nft.ownerId = bid.bidBy
                nft.tokenId = tokenId
                await nft.save()

                res.send({ success: true, message: 'Bid has been accepted successfully' , redeemedVoucher})

                // transfer stake - only if NFT was on stake already
                if (nft.isStaked)
                    transferStake(nft)
            } else return res.status(400).send({ success: false, message: 'Bid not found for given Id' })
        } else
            return res.status(400).send({ success: false, message: 'Bid Id is required' })
    } catch (error) {
        return next(error)
    }
}

async function getHighestBid(nftId) {
    if (nftId) {
        const pricesInMYNT = await axios.get(MYNTtoBNBLink)
        const MYNTtoBNB = (pricesInMYNT?.data?.data)?.quote[0]?.price
        const pricesInWBNB = await axios.get(WBNBtoBNBLink)
        const WBNBtoBNB = (pricesInWBNB?.data?.data)?.quote[0]?.price

        const bids = await Bid.aggregate([
            {
                $match: { nftId: ObjectId(nftId), isExpired: false, isAccepted: false }
            },
            {
                $project: {
                    _id: 1,
                    originalPrice: '$price',
                    price: {
                        $cond: {
                            if: { $eq: ['$price.currency', 'MYNT'] },
                            then: { $trunc: [{ $multiply: ['$price.amount', MYNTtoBNB] }, 7] },
                            else: { $trunc: [{ $multiply: ['$price.amount', WBNBtoBNB] }, 7] }
                        }
                    },
                }
            },
            {
                $sort: { 'price': -1 }
            },
            {
                $limit: 1
            }
        ])

        let highestBid = null

        if (bids?.length)
            highestBid = { currency: bids[0].originalPrice.currency, amount: bids[0].originalPrice.amount }

        return highestBid
    }
}

// extend time of auction by extendAuctionTimeBy (i.e. 10 mins) if bid is placed in last extendAuctionTimeBy (i.e. 10 mins) minutes
async function extendAuctionTime(nftId) {
    try {
        if (nftId) {
            // check if auction end time is less than 10 minutes left
            const nft = await NFT.findOne({
                _id: nftId,
                sellingMethod: 2, // timed auctions only
                auctionStartDate: { $lte: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')) },
                auctionEndDate: {
                    $gte: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')),
                    $lte: new Date(moment().add(extendAuctionTimeBy, 'minutes').format('YYYY-MM-DD HH:mm:ss:SSS'))
                }
            })

            if (nft) {
                const newAuctionEndDate = moment(new Date(nft.auctionEndDate)).add(extendAuctionTimeBy, 'minutes').format('YYYY-MM-DD HH:mm:ss:SSS')
                const newAuctionEndTime = moment(new Date(newAuctionEndDate)).format('HH:mm')

                // extend X more minutes in auction end date & time
                nft.auctionEndDate = newAuctionEndDate
                nft.auctionEndTime = newAuctionEndTime
                nft.sellingConfig = {
                    ...nft.sellingConfig,
                    duration: {
                        startDate: nft.sellingConfig.duration.startDate,
                        endDate: moment(nft.sellingConfig.duration.endDate).utcOffset(0).add(extendAuctionTimeBy, 'minutes').format('YYYY-MM-DDTHH:mm:ss.SSS') + 'Z',
                        startTime: nft.sellingConfig.duration.startTime,
                        endTime: newAuctionEndTime
                    }
                }

                await nft.save()

                // create selling config.
                await SellingConfig.create({
                    sellerId: nft.ownerId,
                    nftId: nft._id,
                    collectionId: nft.collectionId,
                    sellingConfig: nft.sellingConfig,
                    sellingMethod: nft.sellingMethod,
                    currency: nft.currency,
                    currentPrice: nft.currentPrice,
                    auctionStartDate: nft.auctionStartDate,
                    auctionEndDate: nft.auctionEndDate,
                    auctionStartTime: nft.auctionStartTime,
                    auctionEndTime: nft.auctionEndTime
                })
            }
        }
    } catch (error) {
        console.log('Extend Auction Time Err: ', error)
    }
}