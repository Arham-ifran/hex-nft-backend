const fs = require('fs')
const atob = require('atob')
const Web3 = require('web3')
const axios = require('axios')
const moment = require('moment')
const Bid = require('../../models/bids.model')
const NFT = require('../../models/nfts.model')
const User = require('../../models/users.model')
const Offer = require('../../models/offer.model')
const Settings = require('../../models/settings.model')
const Metadata = require('../../models/metadata.model')
const Activities = require('../../models/activity.model')
const Attributes = require('../../models/attributes.model')
const Collection = require('../../models/collection.model')
const SellHistory = require('../../models/sellHistory.model')
const SellingConfig = require('../../models/sellingConfigs.model')
const { addImage, addContent } = require('../../utils/upload')
const ObjectId = require('mongoose').Types.ObjectId
const { insert } = require('../../utils/activity')
const {
    userDefaultImage, colLogoPlaceholder, nftImgPlaceholder, baseUrl, paypalMode,
    contractAddress, myntContractAddress, MYNTtoBNBLink, USDtoBNBLink, USDtoMYNTLink, WBNBtoBNBLink,
    providerAddress, walletAccount, walletPK, tokenNameToValue, tinifyAPIKey, myntMaxDecimals
} = require('../../../config/vars')
const nftABI = require('./../../abis/token.json')
const myntABI = require('./../../abis/mynt.json')
const Contract = require('web3-eth-contract')
Contract.setProvider(providerAddress)
const ethers = require('ethers')
const signers = new ethers.Wallet(walletPK)
const converter = require('hex2dec')
const { getNFTOwner } = require('./collection.controller')
const paypal = require('paypal-rest-sdk');
const { createEarnings } = require('./earning.controller')
const { createGiftCardLogs, deleteGiftCardLog } = require('../gamification/giftCards.controller')
const tinify = require("tinify")
tinify.key = tinifyAPIKey;

// API to create NFT
exports.create = async (req, res, next) => {
    try {
        let payload = req.body

        if (req.files) {
            if (req.files.file && req.files.image) {
                const file = req.files.file[0]
                const image = req.files.image[0]
                const fileExtension = image.originalname.match(/\.([^\.]+)$/)[1]

                // uploading file to ipfs
                const fileData = fs.readFileSync(file.path)
                payload.file = await addImage(fileData)

                const imageData = fs.readFileSync(image.path)
                payload.image = await addImage(imageData)

                payload.fileLocal = file.filename
                payload.imageLocal = image.filename

                // compressing image and saving to server
                if (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png')
                    tinify.fromFile(image.path).toFile(image.path);
            }
            else {
                const file = req.files.file[0]
                const fileExtension = file.originalname.match(/\.([^\.]+)$/)[1]

                // uploading file to ipfs
                const fileData = fs.readFileSync(file.path)
                payload.image = await addImage(fileData)

                // payload to save in database
                payload.imageLocal = file.filename

                // compressing image and saving to server
                if (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png')
                    tinify.fromFile(file.path).toFile(file.path);
            }
        }

        if (payload.mediaType)
            payload.mediaType = parseInt(payload.mediaType)

        payload.attributes = payload.attributes ? JSON.parse(atob(payload.attributes)) : []

        payload.metaData = await addContent({
            name: payload.name,
            description: payload.description,
            image: payload.image,
            attributes: payload.attributes
        })

        payload.ownerId = req.user
        payload.creatorId = req.user
        payload.copies = payload.copies ? payload.copies : 1;
        payload.address = contractAddress

        let autoNftIds = []
        const settings = await Settings.findOneAndUpdate({}, { $set: {} }, { upsert: true, new: true })
        if (settings) {
            let prevNfts = settings.totalNfts || 0 // NFTs before adding more
            let newNfts = parseInt(payload.copies)

            // increment total NFTs 
            settings.totalNfts = prevNfts + newNfts
            await settings.save()

            let index = 0, nftCount = prevNfts
            do {
                nftCount += 1
                autoNftIds.push(nftCount)
                index++
            } while (index < newNfts)

            // adding autoNftId
            payload.autoNftId = nftCount
        }

        const nft = await NFT.create(payload)

        if (nft.attributes) {
            const attributes = await nft.attributes.map(attr => {
                return { ...attr, collectionId: nft.collectionId, nftId: nft._id }
            })
            await Attributes.insertMany(attributes)
        }

        const collection = await Collection.findById(payload.collectionId);

        insert({ userId: req.user, nftId: nft._id, type: 1, collectionId: collection?._id })
        return res.send({ success: true, message: 'NFT created successfully', nft, collectionURL: collection.url, autoNftIds })
    } catch (error) {
        return next(error)
    }
}
// API to delete NFT
exports.delete = async (req, res, next) => {
    try {
        let { _id } = req.body;
        if (!_id) {
            return res.send({ success: false, message: 'NFT id is required' })
        }
        const nft = await NFT.findByIdAndDelete(_id);
        await Attributes.deleteMany({ nftId: _id })
        await Activities.deleteMany({ nftId: _id })
        return res.send({ success: true, message: 'NFT deleted successfully', nft })
    } catch (error) {
        return next(error)
    }
}

// API to edit NFT
exports.edit = async (req, res, next) => {
    try {
        let payload = req.body
        const sellerId = req.user

        if (!sellerId)
            return res.status(400).send({ success: false, message: 'Seller is required' })

        // set NFT selling config. 
        if (payload.sellingMethod && payload.sellingConfig) {
            payload.sellingMethod = parseInt(payload.sellingMethod)
            payload.sellingConfig = JSON.parse(payload.sellingConfig)

            // set auction start & end date-time
            const datetimeKey = payload.sellingMethod === 1 ? 'listingSchedule' : 'duration'

            if (payload.sellingMethod === 2) {
                payload.currency = payload.sellingConfig.startPrice?.currency
                payload.currentPrice = payload.sellingConfig.startPrice?.amount
                payload.sellingConfig.method = parseInt(payload.sellingConfig.method)
            }
            else if (payload.sellingMethod === 1) {
                payload.currency = payload.sellingConfig.price?.currency
                payload.currentPrice = payload.sellingConfig.price?.amount
            }

            payload.auctionStartDate = payload.sellingConfig[datetimeKey]?.startDate
            payload.auctionEndDate = payload.sellingConfig[datetimeKey]?.endDate
            payload.auctionStartTime = payload.sellingConfig[datetimeKey]?.startTime
            payload.auctionEndTime = payload.sellingConfig[datetimeKey]?.endTime

            payload.status = 2 // on sale

            // create selling config.
            await SellingConfig.create({
                sellerId,
                nftId: payload._id,
                collectionId: payload.collectionId,
                sellingConfig: payload.sellingConfig,
                sellingMethod: payload.sellingMethod,
                currency: payload.currency,
                currentPrice: payload.currentPrice,
                auctionStartDate: payload.auctionStartDate,
                auctionEndDate: payload.auctionEndDate,
                auctionStartTime: payload.auctionStartTime,
                auctionEndTime: payload.auctionEndTime
            })
        }

        // if stake NFT related data is to be updated
        if (payload.updateStake)
            payload.isStaked = payload.isStaked === 'true' ? true : false

        let nft = await NFT.findByIdAndUpdate({ _id: payload._id }, { $set: payload }, { new: true })

        if (payload.updateStake) {
            if (!payload.isStaked) {
                nft.stakingDays = undefined
                nft.stakingPrice = undefined
                nft.stakeId = undefined
                nft.stakingDate = undefined

                // unset price if NFT was on staking only
                if (nft.status !== 2) {
                    nft.currentPrice = undefined
                    nft.currency = undefined
                }
            } else if (payload.isStaked) {
                if (payload.stakingPrice && payload.stakingCurrency && nft.status !== 2) {
                    nft.currentPrice = payload.stakingPrice
                    nft.currency = payload.stakingCurrency
                }

                // create activity for staked NFT
                insert({ userId: sellerId, nftId: nft._id, type: 8, price: nft.currentPrice, currency: nft.currency, collectionId: nft.collectionId })
            }

            await nft.save()
        }

        // create activity for listing NFT
        if (payload.sellingMethod && payload.sellingConfig)
            insert({ userId: sellerId, toUserId: nft.ownerId, nftId: nft._id, type: 6, price: nft.currentPrice, currency: nft.currency, collectionId: nft.collectionId })

        return res.send({ success: true, message: 'NFT updated successfully', nft })
    } catch (error) {
        return next(error)
    }
}

// API to get a NFT
exports.get = async (req, res, next) => {
    try {
        const { nftId } = req.params
        const { page } = req.query
        const userId = req.user

        let filter = { _id: ObjectId(nftId) }

        // if user coming from sell / list NFT screen
        if (page?.toLowerCase() === 'sell') {
            filter = {
                ...filter,
                rights: { $ne: 3 },
                status: { $ne: 2 },
                ownerId: ObjectId(userId)
            }
        }

        const nft = await NFT.aggregate([
            {
                $match: filter
            },
            {
                $lookup: {
                    from: 'users',
                    foreignField: '_id',
                    localField: 'creatorId',
                    as: 'creator'
                }
            },
            {
                $unwind: '$creator'
            },
            {
                $lookup: {
                    from: 'users',
                    foreignField: '_id',
                    localField: 'ownerId',
                    as: 'owner'
                }
            },
            {
                $unwind: '$owner'
            },
            {
                $lookup: {
                    from: 'collections',
                    foreignField: '_id',
                    localField: 'collectionId',
                    as: 'collection'
                }
            },
            {
                $unwind: '$collection'
            },
            {
                $project: {
                    _id: 1, name: 1, description: 1, rights: 1,
                    createdAt: 1, sellingMethod: 1, tokenId: 1, txHash: 1, attributes: 1, metaData: 1, type: 1, isStaked: 1, stakingDays: 1, stakeId: 1, stakingDate: 1,
                    platformShare: { $ifNull: [{ $toString: '$platformShare' }, 0] },
                    commission: { $toString: { $multiply: [{ $last: '$commissions' }, 100] } },
                    isCustom: 1, tokenId: 1, address: 1, mediaType: 1,
                    copies: 1, currentPrice: 1, currency: 1, autoNftId: 1, status: 1,
                    auctionStartDate: 1, auctionEndDate: 1,
                    fileLocal: { $ifNull: [{ $concat: [baseUrl, '$fileLocal'] }, null] },
                    image: { $ifNull: [{ $concat: [baseUrl, '$imageLocal'] }, nftImgPlaceholder] },
                    creator: {
                        _id: '$creator._id',
                        username: '$creator.username',
                        address: '$creator.address',
                        profilePhoto: { $ifNull: [{ $concat: [baseUrl, '$creator.profileImageLocal'] }, userDefaultImage] }
                    },
                    owner: {
                        _id: '$owner._id',
                        username: '$owner.username',
                        address: '$owner.address',
                        referralId: '$owner.referralId',
                        profilePhoto: { $ifNull: [{ $concat: [baseUrl, '$owner.profileImageLocal'] }, userDefaultImage] }
                    },
                    collection: {
                        _id: '$collection._id',
                        name: '$collection.name',
                        address: '$collection.address',
                        url: '$collection.url',
                        autoColId: '$collection.autoColId',
                        image: { $ifNull: [{ $concat: [baseUrl, '$collection.logoLocal'] }, colLogoPlaceholder] }
                    },
                },
            }
        ])

        // check if attrs. for NFT exist
        if (nft?.length && nft[0].attributes && nft[0].attributes.length) {
            const collectionId = nft[0].collection._id
            const totalColNFTs = await NFT.countDocuments({ collectionId })

            // fetch stats for NFT Col's Attrs.
            const colAttributes = await Attributes.aggregate([
                {
                    $match: { collectionId }
                },
                {
                    $group: {
                        _id: { trait_type: '$trait_type', value: '$value' },
                        total: { $sum: 1 },
                    }
                }
            ])

            const nftAttributes = nft[0].attributes
            let resultantAttributes = []

            for (let i = 0; i < nftAttributes.length; i++) {
                const nftAttr = nftAttributes[i]
                const result = await colAttributes.find(attr => (attr._id.trait_type).toLowerCase() === (nftAttr.trait_type).toLowerCase() && (attr._id.value).toLowerCase() === (nftAttr.value).toLowerCase())

                if (result)
                    resultantAttributes.push(result)
            }

            nft[0].attributes = resultantAttributes
            nft[0].totalColNFTs = totalColNFTs
        }

        if (nft?.length) {
            // get platform share & other sellers commissions
            const shares = await getShares(nft[0]._id, nft[0].platformShare)

            if (shares)
                Object.assign(nft[0], shares)
        }

        return res.send({ success: true, message: 'Item retrieved successfully', nft: nft.length ? nft[0] : null })
    } catch (error) {
        return next(error)
    }
}

// API to get NFTs list
exports.list = async (req, res, next) => {
    try {
        let { page, limit, categoryId, collectionId, status, currency, minPrice, maxPrice, ownerId, creatorId, authorId, collectorId, userId } = req.query
        let filter = {}
        let catFilter = {}

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 40

        if (collectionId)
            filter.collectionId = ObjectId(collectionId)

        if (status) {
            status = parseInt(status)

            // if status is 1 then lookup for bids (i.e. nfts on auctions)
            if (status === 1) {
                filter.sellingMethod = 2
                filter.auctionStartDate = { $lt: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')) }
                filter.auctionEndDate = { $gte: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')) }
            }

            // if status is 1 then lookup for offers (i.e. nfts for fixed price)
            if (status === 2) {
                filter.sellingMethod = 1
                filter.auctionStartDate = { $lt: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')) }
                filter.auctionEndDate = { $gte: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')) }
            }

            // if status is 1 then lookup for bids (i.e. nfts with no selling method)
            else if (status === 3) {
                filter.sellingMethod = { $exists: false }
            }
        }

        if (currency) {
            let bnbFilter = [{ currency: 'BNB' }], myntFilter = [{ currency: 'MYNT' }]
            filter = {
                $and: [
                    { ...filter },
                    {
                        $or: [
                            {
                                $and: bnbFilter
                            },
                            {
                                $and: myntFilter
                            }
                        ]
                    }
                ]
            }

            if (minPrice || maxPrice) {
                if (currency === 'USD') {
                    let pricesInUSD = await axios.get(USDtoBNBLink)
                    const USDtoBNB = (pricesInUSD?.data?.data)?.quote[0]?.price

                    if (USDtoBNB) {
                        const bnb = USDtoBNB
                        if (minPrice)
                            bnbFilter[1] = { currentPrice: { $gte: parseFloat(bnb * minPrice) } }
                        if (maxPrice)
                            bnbFilter[1] = { currentPrice: { ...bnbFilter[1]?.currentPrice, $lte: parseFloat(bnb * maxPrice) } }
                    }

                    // convert USD to MYNT
                    pricesInUSD = await axios.get(USDtoMYNTLink)
                    const USDtoMYNT = (pricesInUSD?.data?.data)?.quote[0]?.price

                    if (USDtoMYNT) {
                        const mynt = USDtoMYNT
                        if (minPrice)
                            myntFilter[1] = { currentPrice: { $gte: parseFloat(mynt * minPrice) } }
                        if (maxPrice)
                            myntFilter[1] = { currentPrice: { ...myntFilter[1]?.currentPrice, $lte: parseFloat(mynt * maxPrice) } }
                    }
                }
                else if (currency === 'BNB') {
                    if (minPrice)
                        bnbFilter[1] = { currentPrice: { $gte: parseFloat(minPrice) } }
                    if (maxPrice)
                        bnbFilter[1] = { currentPrice: { ...bnbFilter[1]?.currentPrice, $lte: parseFloat(maxPrice) } }

                    // convert MYNT to BNB
                    const pricesInMYNT = await axios.get(MYNTtoBNBLink)
                    const MYNTtoBNB = (pricesInMYNT?.data?.data)?.quote[0]?.price

                    if (MYNTtoBNB) {
                        const mynt = MYNTtoBNB
                        if (minPrice)
                            myntFilter[1] = { currentPrice: { $gte: parseFloat(mynt * minPrice) } }
                        if (maxPrice)
                            myntFilter[1] = { currentPrice: { ...myntFilter[1]?.currentPrice, $lte: parseFloat(mynt * maxPrice) } }
                    }
                }
            }
        }

        if (creatorId)
            filter.creatorId = ObjectId(creatorId)

        if (ownerId)
            filter.ownerId = ObjectId(ownerId)

        // filter to get author's NFTs (author can either be owner or creator)
        if (authorId)
            filter = {
                $and: [
                    { ...filter },
                    {
                        $or: [
                            { ownerId: ObjectId(authorId) },
                            { creatorId: ObjectId(authorId) }
                        ]
                    }
                ]
            }

        if (collectorId)
            filter = {
                $and: [
                    { ...filter },
                    {
                        $and: [
                            { ownerId: ObjectId(collectorId) },
                            { creatorId: { $ne: ObjectId(collectorId) } }
                        ]
                    }
                ]
            }

        if (categoryId)
            catFilter['collection.categoryId'] = ObjectId(categoryId)

        let total = 0;

        // count total docs.
        // collection lookup if category id is given
        if (categoryId) {
            total = await NFT.aggregate([
                {
                    $match: filter
                },
                {
                    $lookup: {
                        from: 'collections',
                        foreignField: '_id',
                        localField: 'collectionId',
                        as: 'collection'
                    }
                },
                {
                    $unwind: '$collection'
                },
                {
                    $match: catFilter
                }
            ])

            total = total.length
        } else
            total = await NFT.countDocuments(filter)

        // ready aggregation pipelins
        let pipeline = [
            { $match: filter }
        ]

        // collection look up if category id is given
        if (categoryId) {
            pipeline.push({
                $lookup: {
                    from: 'collections',
                    foreignField: '_id',
                    localField: 'collectionId',
                    as: 'collection'
                }
            })
            pipeline.push({
                $unwind: '$collection'
            })
            pipeline.push({
                $match: catFilter
            })
        }

        pipeline.push({ $sort: { createdAt: -1 } })
        pipeline.push({ $skip: limit * (page - 1) })
        pipeline.push({ $limit: limit })

        pipeline.push({
            $lookup: {
                from: 'favourites',
                foreignField: 'nftId',
                localField: '_id',
                as: 'favourite'
            }
        })

        pipeline.push({
            $lookup: {
                from: 'users',
                foreignField: '_id',
                localField: 'ownerId',
                as: 'owner'
            }
        })

        pipeline.push({
            $project: {
                _id: 1, name: 1, currentPrice: 1, auctionEndDate: 1, currency: 1,
                sellingMethod: 1, status: 1, type: 1, isStaked: 1,
                mediaType: 1,
                image: { $ifNull: [{ $concat: [baseUrl, '$imageLocal'] }, nftImgPlaceholder] },
                favourite: '$favourite',
                userFavourite: {
                    $filter: {
                        input: "$favourite",
                        cond: { $eq: ["$$this.userId", ObjectId(userId)] }
                    }
                },
                owner: {
                    $cond: [
                        { $ne: ['$owner', []] },
                        {
                            _id: { $arrayElemAt: ['$owner._id', 0] },
                            username: { $arrayElemAt: ['$owner.username', 0] }
                        },
                        null
                    ]
                }
            }
        })

        let nfts = await NFT.aggregate(pipeline)

        let data = {
            filter,
            nfts,
            pagination: {
                page, limit, total,
                pages: Math.ceil(total / limit) <= 0 ? 1 : Math.ceil(total / limit)
            }
        }

        if (collectorId)
            data.createdNfts = await NFT.countDocuments({ creatorId: ObjectId(collectorId) })

        return res.send({
            success: true, message: 'NFTs fetched successfully',
            data
        })
    } catch (error) {
        return next(error)
    }
}


exports.search = async (req, res, next) => {
    try {
        // let { name } = req.params
        let { name } = req.query

        let nfts = []
        let collections = []
        if (name) {
            const decQuery = atob(name)
            name = decQuery

            nfts = await NFT.find({ "name": { $regex: name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: 'gi', $options: "gi" } }, { _id: 1, name: 1 }).limit(4).sort({ createdAt: -1 })

            collections = await Collection.find({ "name": { $regex: name, $options: "gi" } }, { _id: 1, name: 1, url: 1 }).limit(4).sort({ createdAt: -1 })
        }

        return res.send({
            success: true, message: 'Successfully searched.',
            data: {
                nfts, collections
            }
        })

    } catch (error) {
        return next(error)
    }
}

exports.unsetSellingConfig = async (req, res, next) => {
    try {
        const filter = {
            $and: [
                { sellingMethod: { $in: [1, 2] } },
                { auctionStartDate: { $lte: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')) } },
                { auctionEndDate: { $lte: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')) } }
            ]
        }

        let nfts = await NFT.find(filter)

        for (let i = 0; i < nfts.length; i++) {
            let nft = nfts[i]

            // expire all past offers for selected NFT
            if (nft.sellingMethod === 1)
                await Offer.updateMany({ nftId: nft._id }, { $set: { isExpired: true } })

            // expire all past bids for selected NFT
            else if (nft.sellingMethod === 2)
                await Bid.updateMany({ nftId: nft._id }, { $set: { isExpired: true } })

            // delete any gift card log present againt this offer
            let response = await deleteGiftCardLog({ nftId, unsetSellingConfig : true })

            // unset selling config in NFT
            nft.sellingMethod = undefined
            nft.sellingConfig = undefined
            nft.auctionEndDate = undefined
            nft.auctionEndTime = undefined
            nft.auctionStartDate = undefined
            nft.auctionStartTime = undefined
            nft.currentPrice = undefined
            nft.currency = undefined
            nft.status = 1
            await nft.save()
        }

        res.send({ success: true, message: 'NFTs updated successfully' })
    }
    catch (error) {
        return next(error)
    }
}

// API to sell to the highest bidder OR with fixed or declining price after time is passed
exports.autoSell = async (req, res, next) => {
    try {
        const filter = {
            sellingMethod: 2, // timed auctions only
            auctionStartDate: { $lte: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')) },
            auctionEndDate: { $lte: new Date(moment().format('YYYY-MM-DD HH:mm:ss:SSS')) }
        }

        const nfts = await NFT.find(filter, '_id name description sellingConfig sellingMethod ownerId creatorId tokenId autoNftId address currentPrice currency collectionId platformShare metaData attributes ownerVerification createdSign type mediaType image imageLocal file fileLocal').populate({ path: 'collectionId', select: '_id autoColId' })

        const pricesInMYNT = await axios.get(MYNTtoBNBLink)
        const MYNTtoBNB = (pricesInMYNT?.data?.data)?.quote[0]?.price
        const pricesInWBNB = await axios.get(WBNBtoBNBLink)
        const WBNBtoBNB = (pricesInWBNB?.data?.data)?.quote[0]?.price

        for (let i = 0; i < nfts.length; i++) {
            const nft = nfts[0]

            // CASE 1: SELL TO THE HIGHEST BIDDER
            // auto-sell bid through smart contract only if:
            // bid is greater than or equal to 1 BNB
            // OR 
            // if a seller receives any bids equal to or greater than reserve price
            if (nft?.sellingConfig?.method === 1) {
                // get the highest bid
                const { bid, bidPriceInBNB } = await getHighestBid(nft._id, MYNTtoBNB, WBNBtoBNB)

                // check if bid is greater than or equal to 1 BNB
                if (bid && bidPriceInBNB >= 1) {
                    let allowAutoSell = true

                    // check if reserve price was set while listing and it's acc. to seller's demand
                    if (nft.sellingConfig?.reservePrice?.currency && nft.sellingConfig?.reservePrice?.amount) {
                        const reservePriceCur = nft.sellingConfig?.reservePrice?.currency.toUpperCase()
                        let reservePriceAmt = parseFloat(nft.sellingConfig?.reservePrice?.amount)

                        // if seller receives highest bid less than the reserve price, nothing would happen
                        if (reservePriceCur === 'BNB' && bidPriceInBNB < reservePriceAmt)
                            allowAutoSell = false
                        else if (reservePriceCur === 'MYNT') {
                            // convert nft price to bnb and then check if seller has received highest bid less than the reserve price, do nothing
                            reservePriceAmt = parseFloat((reservePriceAmt * MYNTtoBNB).toFixed(7))
                            if (bidPriceInBNB < reservePriceAmt)
                                allowAutoSell = false
                        }
                    }

                    if (allowAutoSell) {
                        let _nftData = {
                            metaData: nft.metaData,
                            tokenId: nft.tokenId,
                            nftId: nft.autoNftId,
                            nft: nft.address,
                            price: nft.currentPrice,
                            percent: 0
                        }

                        // get platform share & other sellers commissions
                        const { platformShare, commissions, royaltySplit } = await getShares(nft._id, nft.platformShare)
                        _nftData.commissions = commissions || []

                        const autoAcceptRes = await acceptBidWeb3(_nftData, bid, (tokenNameToValue[nft.currency] ? tokenNameToValue[nft.currency] : 2), nft._id, nft.collectionId.autoColId, platformShare, royaltySplit)

                        if (autoAcceptRes) {
                            const { txHash, tokenId, acceptSign } = autoAcceptRes

                            // save bid
                            bid.isAccepted = true
                            bid.txHash = txHash
                            bid.acceptSign = acceptSign
                            await bid.save()

                            // expire other bids
                            await Bid.updateMany({ _id: { $ne: ObjectId(bid._id) }, nftId: bid.nftId }, { $set: { isExpired: true } })

                            // create owner earnings
                            await createEarnings(_nftData.commissions, nft._id, nft.collectionId, nft.currency === 'BNB' ? 'WBNB' : nft.currency, nft.currentPrice)

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
                                const existingNFTC = await NFT.findOne({ type: 2, belongsTo: nft._id, ownerId: bid.ownerId })

                                if (!existingNFTC) {
                                    const nftcData = nft
                                    nftcData.collectionId = nft.collectionId._id
                                    const nftc = await createNFTC(nftcData)

                                    if (nftc) {
                                        // update platform share for simple NFT
                                        nft.platformShare = nftc.platformShare

                                        // create activity
                                        insert({ userId: bid.ownerId, nftId: nftc._id, type: 1, collectionId: nftc.collectionId })
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

                            // transfer stake - only if NFT was on stake already
                            if (nft.isStaked)
                                transferStake(nft)
                        }
                    }
                }
            }
            // CASE 2: SELL WITH THE DECLINING PRICE
            // price falls over time for this kind of auction
            else if (nft?.sellingConfig?.method === 2) {
                if (nft.sellingConfig?.endPrice?.amount) {
                    // update NFT price as per given end price
                    const data = await NFT.findByIdAndUpdate({ _id: nft._id }, { $set: { currentPrice: nft.sellingConfig.endPrice.amount } }, { new: true })

                    // create selling config.
                    await SellingConfig.create({
                        sellerId: data.ownerId,
                        nftId: data._id,
                        collectionId: data.collectionId,
                        sellingConfig: data.sellingConfig,
                        sellingMethod: data.sellingMethod,
                        currency: data.currency,
                        currentPrice: data.currentPrice,
                        auctionStartDate: data.auctionStartDate,
                        auctionEndDate: data.auctionEndDate,
                        auctionStartTime: data.auctionStartTime,
                        auctionEndTime: data.auctionEndTime
                    })
                }
            }
        }

        return res.json({ nfts, success: true, message: 'NFTs on bidding are auto sold to respective owners' })
    } catch (error) {
        return next(error)
    }
}

// API to update tokenIds for given NFTs - special case
exports.updateTokenIds = async (req, res, next) => {
    try {
        let { _id, tokenIds, txHash, autoNftIds } = req.body;
        if (!_id) {
            return res.status(400).send({ success: false, message: 'NFT Ids is required' })
        }
        if (!tokenIds) {
            return res.status(400).send({ success: false, message: 'Token Ids are required' })
        }
        tokenIds = JSON.parse(tokenIds);
        autoNftIds = JSON.parse(autoNftIds);

        // if (tokenIds.length > 1) {
        let nftData = await NFT.findById({ _id });
        nftData = nftData.toObject();
        delete nftData._id;
        for (let i = 0; i < tokenIds.length; i++) {
            if (i === 0) {
                await NFT.findByIdAndUpdate({ _id }, { $set: { tokenId: tokenIds[i], txHash, autoNftId: autoNftIds[i] } });
            }
            else {
                nftData.tokenId = tokenIds[i];
                nftData.autoNftId = autoNftIds[i]
                nftData.txHash = txHash
                await NFT.create(nftData);
            }
        }
        // }
        // else if (tokenIds.length === 1) {
        //     await NFT.findByIdAndUpdate({ _id }, { $set: { tokenId: tokenIds[0] } });
        // }

        return res.json({ success: true, message: 'NFTs token Ids updated successfully' })
    } catch (error) {
        return next(error)
    }
}

// get bid with highest price
async function getHighestBid(nftId, MYNTtoBNB, WBNBtoBNB) {
    if (nftId) {
        const bids = await Bid.aggregate([
            {
                $match: { nftId: ObjectId(nftId), isExpired: false, isAccepted: false }
            },
            {
                $project: {
                    _id: 1,
                    originalPrice: '$price',
                    priceInBNB: {
                        $cond: {
                            if: { $eq: ['$price.currency', 'MYNT'] },
                            then: { $multiply: ['$price.amount', MYNTtoBNB] },
                            else: { $multiply: ['$price.amount', WBNBtoBNB] }
                        }
                    },
                }
            },
            {
                $sort: { 'priceInBNB': -1 }
            },
            {
                $limit: 1
            }
        ])

        let bid = null, bidPriceInBNB = 0
        if (bids?.length) {
            bid = await Bid.findOne({ _id: bids[0]._id })
            bidPriceInBNB = parseFloat((bids[0].priceInBNB).toFixed(7))
        }

        return {
            bid, bidPriceInBNB
        }
    }
}

exports.getHistory = async (req, res, next) => {
    try {
        let { page, limit, nftId } = req.query

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 12

        let total = await SellHistory.countDocuments({ nftId })

        // if (page > Math.ceil(total / limit) && total > 0)
        //   page = Math.ceil(total / limit)

        let history = await SellHistory.aggregate([
            {
                $match: { nftId: ObjectId(nftId) }
            },
            {
                $sort: { createdAt: -1 }
            },
            { $skip: limit * (page - 1) },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    foreignField: '_id', // user Id
                    localField: 'sellerId', // seller Id
                    as: 'seller'
                }
            },
            {
                $unwind: '$seller'
            },
            {
                $lookup: {
                    from: 'users',
                    foreignField: '_id', // user Id
                    localField: 'buyerId', // buyer Id
                    as: 'buyer'
                }
            },
            {
                $unwind: '$buyer'
            },
            {
                $project: {
                    _id: 1,
                    seller: {
                        _id: '$seller._id',
                        username: '$seller.username'
                    },
                    buyer: {
                        _id: '$buyer._id',
                        username: '$buyer.username'
                    },
                    price: 1, txHash: 1
                }
            }
        ])

        return res.send({
            success: true, message: 'History fetched succesfully',
            data: {
                history,
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

// API to add requests in queue for updating NFTs metadata 
exports.updateMetadata = async (req, res, next) => {
    try {
        res.json({ success: true, message: 'Added request for refresh metadata to pool.' })

        // upsert metadata payload for given nft
        await upsertMetadata(req.body)
    } catch (error) {
        return next(error)
    }
}

const upsertMetadata = async (payload) => {
    const mdResult = await Metadata.findOneAndUpdate({ nftId: payload.nftId }, { $set: { ...payload } }, { upsert: true, new: true })

    if (!mdResult.requestId) {
        const metadata = await Metadata.find({}, 'requestId').sort({ requestId: -1 }).limit(1)
        mdResult.requestId = metadata && metadata.length && metadata[0].requestId ? ((metadata[0].requestId) + 1) : 1
        await mdResult.save()
    }
}

const acceptBidWeb3 = async (_nftData, bid, payThrough, _id, collectionId, platformSharePercent, royaltySplitPercent) => {
    try {
        return new Promise(async (resolve, reject) => {
            const web3 = await new Web3(providerAddress)
            const seller = await User.findById({ _id: bid.ownerId })
            const bidder = await User.findById({ _id: bid.bidBy })

            if (!web3 || !seller || !bidder)
                resolve(false)

            const validOwner = await isValidOwner(seller.address, _nftData.nft, _nftData.tokenId)

            if (!validOwner) {
                let payloadData = {
                    nftId: _id,
                    tokenId: _nftData.tokenId,
                    address: _nftData.nft,
                }

                // upsert metadata payload for given nft
                await upsertMetadata(payloadData)
                resolve(false)
            }

            const nftContract = new Contract(nftABI, contractAddress)
            let weiPrice = web3.utils.toWei(`${_nftData.price}`, 'ether')
            if (Number(payThrough) === 1)
                weiPrice = String((parseFloat((_nftData.price * myntMaxDecimals).toFixed(10))))

            const weiOwnerShare = await percentageOf(weiPrice, 100 - royaltySplitPercent)
            const weiRoyaltyShare = await percentageOf(weiPrice, royaltySplitPercent)
            let nftRoyalty = []
            let platformShareAmount = 0
            for (let x = 0; x < _nftData.nftRoyalty?.length; x++) {
                let royaltyShareVal = await percentageOf(weiRoyaltyShare, _nftData.nftRoyalty[x].percent)
                nftRoyalty.push({
                    amount: String(royaltyShareVal),
                    wallet: _nftData.nftRoyalty[x].wallet
                })
            }
            platformShareAmount = await percentageOf(weiPrice, platformSharePercent)

            const transferData = {
                metadata: _nftData.metaData,
                tokenId: _nftData.tokenId,
                nftId: _nftData.nftId,
                newOwner: bidder.address,
                nft: _nftData.nft, // address
                payThrough,
                amount: weiPrice,
                percent: _nftData.percent,
                collectionId,
                nftRoyalty,
                platformShareAmount: String(platformShareAmount),
                ownerShare: String(weiOwnerShare),
                currentOwner: seller.address
            }

            const acceptData = await nftContract.methods.acceptBid(transferData).encodeABI()
            const txCount = await web3.eth.getTransactionCount(walletAccount);
            const gas = await web3.eth.getGasPrice();
            const gasLimit1 = await web3.eth.estimateGas({
                from: walletAccount,
                nonce: txCount,
                to: contractAddress,
                data: acceptData,
            })

            await signers.signTransaction({
                nonce: web3.utils.toHex(txCount),
                gasPrice: web3.utils.toHex(gas),
                gasLimit: web3.utils.toHex(gasLimit1),
                to: contractAddress,
                data: web3.utils.toHex(acceptData)
            })
                .then(async (res) => {
                    const txDetails = await web3.eth.sendSignedTransaction(res)
                    if (txDetails?.logs?.length) {
                        const autoAccepted = txDetails.logs[txDetails.logs.length - 1]

                        const { transactionHash, data } = autoAccepted
                        const txHash = transactionHash

                        // convert tokenId HEX to DECIMAL
                        const tokenId = await converter.hexToDec(data) || 0

                        resolve({
                            tokenId,
                            txHash,
                            acceptSign: res
                        })
                    }

                    resolve(false)
                })
                .catch((e) => {
                    console.log('ERR - Sign Transaction', e)
                    resolve(false)
                })
        })
    }
    catch (e) {
        console.log('ERR - Auto accept bid error: ', e)
        return false
    }
}

async function isValidOwner(owner, contractAddress, tokenId) {
    try {
        const tokenContract = new Contract(nftABI, contractAddress)
        const nftOwner = await tokenContract.methods.ownerOf(tokenId).call()
        return nftOwner.toString() === owner.toString()
    } catch (e) {
        return false
    }
}

const percentageOf = (num, per) => {
    return parseFloat(((num / 100) * per).toFixed(10));
}

exports.cancelListing = async (req, res, next) => {
    try {
        const { nftId, sellingMethod, cancelListingSign } = req.body
        const userId = req.user

        if (nftId && cancelListingSign) {
            // expire made offers
            if (sellingMethod === 1)
                await Offer.updateMany({ nftId }, { $set: { isExpired: true } })

            // expire placed bids
            if (sellingMethod === 2)
                await Bid.updateMany({ nftId }, { $set: { isExpired: true } })

            // delete any gift card log present againt this offer
            let response = await deleteGiftCardLog({ nftId })

            // unset selling config. in NFT
            await NFT.updateOne({ _id: nftId },
                {
                    $unset: {
                        sellingMethod: undefined,
                        sellingConfig: undefined,
                        auctionEndDate: undefined,
                        auctionEndTime: undefined,
                        auctionStartDate: undefined,
                        auctionStartTime: undefined,
                        currentPrice: undefined,
                        currency: undefined
                    },
                    $set: {
                        cancelListingSign,
                        status: 1, // set status to idle
                        rights: 1 // set rights to default
                    }
                }
            )

            return res.json({ success: true, message: 'Listing cancelled successfully' })
        }

        return res.status(400).send({ success: false, message: 'Unable to cancel listing of requested NFT', cancelListingFailed: true })
    } catch (error) {
        return next(error)
    }
}

exports.verifyOwnership = async (req, res, next) => {
    try {
        const nfts = await NFT.find({ ownerVerification: false }).limit(200).populate('ownerId');

        if (!nfts.length)
            await NFT.updateMany({}, { $set: { ownerVerification: false } })
        else
            for (let i = 0; i < nfts.length; i++) {
                const nft = nfts[i];
                await NFT.updateOne({ _id: nft._id }, {
                    $set: {
                        ownerVerification: true
                    }
                })

                const owner = await getNFTOwner(nft.tokenId, nft.address);
                if (owner?.toString() !== nft?.ownerId?.address?.toString()) {
                    const payload = { nftId: nft._id, tokenId: nft.tokenId, address: nft.address }
                    await upsertMetadata(payload)
                }
            }

        return res.json({ success: true, message: 'Verifying onwership of NFTs with our local database' })
    } catch (error) {
        return next(error)
    }
}

exports.transferOwnership = async (req, res, next) => {
    try {
        const {
            nftId,
            newOwnerAddress, // new owner of NFT
            txHash
        } = req.body
        const oldOwnerId = req.user

        if (!nftId || !oldOwnerId || !newOwnerAddress || !txHash)
            return res.status(400).send({ success: false, message: 'NFT ID, txHash, last & current owners are required' })

        let nft = await NFT.findOne({ _id: nftId })

        if (nft) {
            // expire all prev. bids for this NFT
            await Bid.updateMany({ nftId }, { $set: { isExpired: true } })

            // expire all prev. offers for this NFT
            await Offer.updateMany({ nftId }, { $set: { isExpired: true } })

            // check owner
            let ownerId = ''
            let user = await User.findOne({ address: newOwnerAddress }).lean(true)
            if (!user) {
                let userData = {
                    username: 'Unnamed',
                    address: newOwnerAddress
                }
                let newUser = await User.create(userData)
                if (newUser)
                    ownerId = newUser._id
            } else
                ownerId = user._id

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
            nft.ownerId = ownerId
            await nft.save()

            // create sell history
            await SellHistory.create({
                sellerId: oldOwnerId,
                buyerId: ownerId,
                nftId,
                collectionId: nft.collectionId,
                sold: true,
                price: 0,
                txHash
            })

            // create activity
            insert({ userId: oldOwnerId, toUserId: ownerId, nftId, type: 7, price: 0, currency: nft.currency, collectionId: nft.collectionId })

            return res.json({ success: true, message: 'Onwership of NFT transferred successfully' })
        } else return res.status(400).send({ success: false, message: "We've explored deep and wide but we're unable to update the NFT you're looking for." })
    } catch (error) {
        return next(error)
    }
}

exports.buyWithPayPal = async (req, res, next) => {
    try {
        const { nftId, usdPrice } = req.body
        const settings = await Settings.findOne({}, { paypalClientId: 1, paypalClientSecret: 1 })

        if (settings.paypalClientId && settings.paypalClientSecret) {
            if (nftId && usdPrice) {
                const nft = await NFT.findOne({ _id: nftId }, { name: 1, description: 1 })

                paypal.configure({
                    'mode': paypalMode,
                    'client_id': settings.paypalClientId,
                    'client_secret': settings.paypalClientSecret
                });

                const url = `${baseUrl}item-details/${Buffer.from(nftId).toString('base64')}`
                const create_payment_json = {
                    "intent": "sale",
                    "payer": {
                        "payment_method": "paypal"
                    },
                    "redirect_urls": {
                        "return_url": url,
                        "cancel_url": url
                    },
                    "transactions": [{
                        "item_list": {
                            "items": [{
                                "name": nft.name,
                                "price": parseFloat(usdPrice),
                                "currency": "USD",
                                "quantity": 1
                            }]
                        },
                        "amount": {
                            "currency": "USD",
                            "total": parseFloat(usdPrice)
                        },
                        "description": nft.description || ''
                    }]
                };

                paypal.payment.create(create_payment_json, function (error, payment) {
                    if (error) {
                        throw error;
                    } else {
                        for (let i = 0; i < payment.links.length; i++) {
                            if (payment.links[i].rel === 'approval_url') {
                                return res.json({ success: true, message: 'Redirection link for NFT to buy through PayPal', link: payment.links[i].href, payment: true, usdPrice })
                            }
                        }
                    }
                });
            } else
                return res.status(400).send({ success: false, message: 'Unable to detect NFT price', payment: false })
        }
        else
            return res.status(400).send({ success: false, message: "Sorry, you can't buy with PayPal at this moment", payment: false })
    } catch (error) {
        return next(error)
    }
}

exports.buy = async (req, res, next) => {
    try {
        const payload = req.body
        const buyerId = req.user

        if (!payload.nftId || !buyerId || !payload.txHash)
            return res.status(400).send({ success: false, message: 'NFT ID, txHash, current owner are required', buyNFTFailed: true })

        let nft = await NFT.findOne({ _id: payload.nftId })

        if (nft) {
            // expire all prev. bids for this NFT
            await Bid.updateMany({ nftId: payload.nftId }, { $set: { isExpired: true } })

            // expire all prev. offers for this NFT
            await Offer.updateMany({ nftId: payload.nftId }, { $set: { isExpired: true } })

            // create owner earnings
            await createEarnings(payload?.royalties, nft._id, nft.collectionId, nft.currency, nft.currentPrice)

            // create sell history
            const sellHistoryData = {
                sellerId: payload.userId,
                buyerId,
                nftId: payload.nftId,
                collectionId: nft.collectionId,
                sold: true,
                price: payload.price,
                txHash: payload.txHash,
                buySign: payload.buySign,
                paymentId: payload.paymentId,
                paymentToken: payload.paymentToken,
                payerId: payload.payerId,
                paymentMethod: payload.paymentMethod
            }

            await SellHistory.create(sellHistoryData)

            // create activity
            insert({ userId: payload.userId, toUserId: buyerId, nftId: payload.nftId, type: 7, price: payload.price.amount, currency: payload.price.currency, collectionId: nft.collectionId })

            // create redeemed gift card log for Buy Now
            let isGiftCardLogCreated = { }
            if(payload.hasDiscount){
                let logData = {
                    userId: payload.userId,
                    nftId: payload.nftId,
                    collectionId: nft.collectionId,
                    token: payload.giftCardToken,
                    paymentMethod: payload.paymentMethod,
                    originalPrice: payload.originalPrice,
                    currency: payload.paymentToken,
                    discountedPrice: payload.discountedPrice,
                    discount: payload.discountPercentage,
                    isGiftCardUsed: true
                }

                let giftCardLogObject = await createGiftCardLogs(logData)
                isGiftCardLogCreated = { success : giftCardLogObject.success, message : giftCardLogObject.message }
            }

            if (nft?.type === 1) {
                // create NFTC only if it's simple NFT
                // check if ever same seller has NFTC for given simple NFT
                const existingNFTC = await NFT.findOne({ type: 2, belongsTo: nft._id, ownerId: nft.ownerId })

                if (!existingNFTC) {
                    const nftc = await createNFTC(nft)

                    if (nftc) {
                        // update platform share for simple NFT
                        nft.platformShare = nftc.platformShare

                        // create activity
                        insert({ userId: payload.userId, nftId: nftc._id, type: 1, collectionId: nftc.collectionId })
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
            nft.ownerId = buyerId
            await nft.save()

            res.json({ success: true, message: "You've purchased NFT successfully", isGiftCardLogCreated })

            // transfer stake - only if NFT was on stake already
            if (nft.isStaked)
                transferStake(nft)
        } else return res.status(400).send({ success: false, message: "We've explored deep and wide but we're unable to update the NFT you're looking for." })
    } catch (error) {
        return next(error)
    }
}

// method to create NFTC - only if simple NFTC is sold for seller
const createNFTC = async (nft) => {
    if (nft) {
        let payload = {
            name: nft.name,
            description: nft.description,
            creatorId: nft.ownerId,
            ownerId: nft.ownerId,
            collectionId: nft.collectionId,
            metaData: nft.metaData,
            attributes: nft.attributes,
            address: contractAddress,
            ownerVerification: nft.ownerVerification,
            createdSign: nft.createdSign,
            mediaType: nft.mediaType,
            image: nft.image,
            file: nft.file,
            imageLocal: nft.imageLocal,
            fileLocal: nft.fileLocal,
            type: 2,
            belongsTo: nft._id,
            copies: 1
        }

        const settings = await Settings.findOneAndUpdate({}, { $set: {} }, { upsert: true, new: true })
        if (settings) {
            // increment total NFTs 
            const nftCount = settings.totalNfts + 1
            settings.totalNfts = nftCount
            await settings.save()

            // adding autoNftId
            payload.autoNftId = nftCount
        }

        // calculate commissions for given simple NFT sale
        const commissionsRes = await calculateCommissions(nft._id, settings)
        if (commissionsRes) {
            payload = {
                ...payload,
                ...commissionsRes
            }
        }

        const nftc = await NFT.create(payload)

        if (nft.attributes) {
            const attributes = await nft.attributes.map(attr => {
                return { ...attr, collectionId: nft.collectionId, nftId: nftc._id }
            })
            await Attributes.insertMany(attributes)
        }

        return nftc
    }
}

exports.createNFTC = createNFTC

// method to calculate commissions for given simple NFT. For optimzed code, we're cal. commissions before hand
const calculateCommissions = async (nftId, settings) => {
    try {
        if (nftId) {
            // find NFTC for given simple NFT
            const lastNFTC = await NFT.findOne({ type: 2, belongsTo: nftId }, { commissions: 1, nftcId: 1 }).sort({ nftcId: -1 })

            const royaltySplit = settings?.royaltySplit || 0
            const firstComission = settings?.firstComission || 0

            // calculate commission
            if (lastNFTC) {
                const totalCommissions = lastNFTC.commissions.reduce(reducer)
                const sellerCommission = (royaltySplit - totalCommissions) * firstComission
                // i.e. for: 
                // cT0 = 0, cT1 = 0.06
                // cT2 = (0.1 - (cT0 + cT1)) * 0.6 = 0.024, s0 = (0.1 - cT2) = 0.076
                // .... n, and so on

                return {
                    nftcId: lastNFTC.nftcId + 1,
                    platformShare: (royaltySplit - (totalCommissions + sellerCommission)),
                    commissions: (lastNFTC.commissions).concat(sellerCommission)
                }
            } else {
                const totalCommissions = 0
                const sellerCommission = (royaltySplit - totalCommissions) * firstComission
                // i.e. for: 
                // cT0 = 0
                // cT1 = (0.1 - cT0) * 0.6 = 0.06, s0 = (0.1 - cT1) = 0.04

                return {
                    nftcId: 1,
                    platformShare: (royaltySplit - sellerCommission),
                    commissions: [sellerCommission]
                }
            }
        }
    } catch (error) {
        console.log('Error while calculating commissions')
    }
}

// method to sum Number array values
const reducer = (accumulator, curr) => accumulator + curr

// method to get shares for initial seller, platform and other sellers commissions
const getShares = async (nftId, platformShare) => {
    try {
        if (nftId) {
            const settings = await Settings.findOneAndUpdate({}, { $set: {} }, { upsert: true, new: true })

            const initialSellerPercent = settings?.initialSellerPercent * 100
            const royaltySplit = settings?.royaltySplit * 100

            if (!platformShare) {
                if (settings?.royaltySplit)
                    platformShare = settings.royaltySplit * 100
            }
            else
                platformShare = platformShare * 100

            // fetch all NFTCs for sellers commissions
            const commissions = await NFT.aggregate([
                {
                    $match: {
                        type: 2,
                        belongsTo: ObjectId(nftId)
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        foreignField: '_id',
                        localField: 'ownerId',
                        as: 'user'
                    }
                },
                {
                    $sort: {
                        nftcId: -1
                    }
                },
                {
                    $project: {
                        _id: 0,
                        percent: { $toString: { $multiply: [{ $last: '$commissions' }, 100] } },
                        wallet: {
                            $cond: [
                                { $ne: ['$user', []] },
                                { $arrayElemAt: ['$user.address', 0] },
                                null
                            ]
                        },
                    }
                }
            ])

            return { initialSellerPercent, platformShare, commissions, royaltySplit }
        }
    } catch (e) {
        console.log('Error while transferring commission: ', e)
    }
}
// API to get nfts for homepage
exports.getHomePageNfts = async (req, res, next) => {
    try {
        let filter = { showInHomePage: true }
        let bidsOffersFilter = { isAccepted: false, isExpired: false }
        let homepageNfts = await NFT.aggregate([
            {
                $match: filter
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $lookup: {
                    from: 'users',
                    foreignField: '_id',
                    localField: 'ownerId',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $lookup: {
                    from: "offers",
                    let: { nftId: "$_id" },
                    pipeline: [
                        {
                            $match:
                            {
                                $expr:
                                {
                                    $and:
                                        [
                                            { $eq: ["$nftId", "$$nftId"] },
                                            { $eq: ["$isAccepted", false] },
                                            { $eq: ["$isExpired", false] },
                                        ]
                                }
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $project: { price: 1 } },
                        { $limit: 1 }
                    ],
                    as: "offers"
                }
            },
            {
                $lookup: {
                    from: "bids",
                    let: { nftId: "$_id" },
                    pipeline: [
                        {
                            $match:
                            {
                                $expr:
                                {
                                    $and:
                                        [
                                            { $eq: ["$nftId", "$$nftId"] },
                                            { $eq: ["$isAccepted", false] },
                                            { $eq: ["$isExpired", false] },
                                        ]
                                }
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $project: { price: 1 } },
                        { $limit: 1 }
                    ],
                    as: "bids"
                }
            },
            {
                $project: {
                    _id: 1, name: 1, auctionEndTime: 1, auctionEndDate: 1,
                    image: { $ifNull: [{ $concat: [baseUrl, '$imageLocal'] }, nftImgPlaceholder] },
                    owner: {
                        _id: '$user._id',
                        name: '$user.username',
                        profileImage: { $ifNull: [{ $concat: [baseUrl, '$user.profileImageLocal'] }, userDefaultImage] },
                    },
                    latestBid: { $ifNull: [{ $arrayElemAt: ['$bids', -1] }, null] },
                    latestOffer: { $ifNull: [{ $arrayElemAt: ['$offers', -1] }, null] }
                }
            },
            {
                $sort: { 'bids.createdAt': -1 }
            }
        ])

        return res.status(200).send({
            success: true,
            homepageNfts
        })

    } catch (error) {
        return next(error)
    }
}

// method to transfer stake - when NFT is purchased, transfer stake as well
const transferStake = async (nft) => {
    try {
        return new Promise(async (resolve, reject) => {
            const web3 = await new Web3(providerAddress)

            if (!web3 || !nft.stakeId || !nft.ownerId)
                resolve(false)

            const buyer = await User.findById({ _id: nft.ownerId }).lean(true)
            if (!buyer)
                resolve(false)

            // COMMENTED TEMP.
            // const validOwner = await isValidOwner(buyer.address, nft.address, nft.tokenId)

            // if (!validOwner) {
            //     let payloadData = {
            //         nftId: nft._id,
            //         tokenId: nft.tokenId,
            //         address: nft.address,
            //     }

            //     // upsert metadata payload for given nft
            //     await upsertMetadata(payloadData)
            //     resolve(false)
            // }

            const nftContract = new Contract(myntABI, myntContractAddress)
            const transferStakeData = await nftContract.methods
                .transferStake(stakeId, buyer.address)
                .encodeABI();
            let txCount = await web3.eth.getTransactionCount(walletAccount);
            const gas = await web3.eth.getGasPrice();
            const gasLimit1 = await web3.eth.estimateGas({
                from: walletAccount,
                nonce: txCount,
                to: myntContractAddress,
                data: transferStakeData,
            });
            await signers.signTransaction({ nonce: web3.utils.toHex(txCount), gasLimit: web3.utils.toHex(gasLimit1), gasPrice: web3.utils.toHex(gas), to: myntContractAddress, data: web3.utils.toHex(transferStakeData) })
                .then(async (res) => {
                    let promises = [];
                    promises.push(
                        web3.eth.sendSignedTransaction(
                            res,
                            (err, txResult) => (tx = txResult)
                        )
                    );
                    await Promise.all(promises);

                    resolve(true);
                })
                .catch((e) => {
                    resolve(false)
                });
        });
    }
    catch (e) {
        console.log('Transfer Stake Error: ', e);
    }
}

exports.transferStake = transferStake