const fs = require('fs')
const path = require('path')
const axios = require('axios')
const moment = require('moment')
const Web3 = require('web3')
const download = require('image-downloader')
const ObjectId = require('mongoose').Types.ObjectId
const Offer = require('../../models/offer.model')
const User = require('../../models/users.model')
const Bid = require('../../models/bids.model')
const NFT = require('../../models/nfts.model')
const Stats = require('../../models/stats.model')
const Activity = require('../../models/activity.model')
const Metadata = require('../../models/metadata.model')
const Settings = require('../../models/settings.model')
const Attributes = require('../../models/attributes.model')
const Collection = require('../../models/collection.model')
const SellHistory = require('../../models/sellHistory.model')
const SellingConfig = require('../../models/sellingConfigs.model')
const { addImage } = require('../../utils/upload')
const { ipfsToUrl } = require('../../utils/ipfs-url')
const { checkDuplicate } = require('../../../config/errors')
const {
    colLogoPlaceholder,
    colFeaturedPlaceholder,
    nftImgPlaceholder,
    providerAddress,
    baseUrl,
    contractAddress,
    walletAccount,
    walletPK,
    MYNTtoBNBLink,
    WBNBtoBNBLink,
    tinifyAPIKey
} = require('../../../config/vars');
const nftABI = require('./../../abis/token.json');
const Contract = require('web3-eth-contract');
Contract.setProvider(providerAddress);
const ethers = require('ethers');
const signers = new ethers.Wallet(walletPK);
const tinify = require("tinify");
tinify.key = tinifyAPIKey;

// API to create collection 
exports.create = async (req, res, next) => {
    try {
        let payload = req.body
        if (req.files)
            for (const key in req.files) {
                const image = req.files[key][0]
                const imgData = fs.readFileSync(image.path)
                const fileExtension = image.originalname.match(/\.([^\.]+)$/)[1]

                payload[key] = await addImage(imgData)
                payload[`${key}Local`] = image.filename

                // compressing image and saving to server
                if (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png')
                    tinify.fromFile(image.path).toFile(image.path);
            }

        payload.userId = req.user

        if (!payload.userId || !payload.name || !payload.logo)
            return res.status(400).send({ success: false, message: 'Please provide all required fields' })

        let filter = []
        if (payload.name)
            filter.push({ nameLower: payload.name.toLowerCase() })
        if (payload.url)
            filter.push({ url: payload.url.toLowerCase() })

        // check user existing collection
        const existingCollection = await Collection.findOne({
            $or: filter
        })

        if (existingCollection)
            return res.status(400).send({ success: false, message: 'Collection with same Name or URL already exists' })

        payload.nameLower = payload.name

        if (!payload.url)
            // payload.url = payload.name.replace(/ /g, '-');
            payload.url = payload.name.replace(/[\s.;,#,?%]/g, '-');

        const settings = await Settings.findOneAndUpdate({}, { $set: {} }, { upsert: true, new: true })
        if (settings) {
            const prevCols = settings.totalCols || 0 // collections before adding more
            const newCols = 1

            // increment total Cols 
            settings.totalCols = prevCols + newCols
            await settings.save()

            payload.autoColId = settings.totalCols
        }

        const collection = await Collection.create(payload)
        return res.send({ success: true, message: 'Collection created successfully', collection })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Collection')
        else
            return next(error)
    }
}

// API to edit collection
exports.edit = async (req, res, next) => {
    try {
        let payload = req.body
        if (req.files)
            for (const key in req.files) {
                const image = req.files[key][0]
                const imgData = fs.readFileSync(image.path)
                const fileExtension = image.originalname.match(/\.([^\.]+)$/)[1]

                payload[key] = await addImage(imgData)
                payload[`${key}Local`] = image.filename

                // compressing image and saving to server
                if (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png')
                    tinify.fromFile(image.path).toFile(image.path);
            }

        if (!payload._id || !payload?.userId) {
            return res.status(400).send({ success: false, message: 'Please provide all required fields' })
        }
        // if name is given then check user existing collection
        payload.nameLower = payload.name.toLowerCase()

        const existingCollection = await Collection.findOne({
            _id: { $ne: payload._id },
            $or: [
                { nameLower: payload.nameLower },
                { url: payload.url.toLowerCase() }
            ]
        })

        if (existingCollection)
            return res.status(400).send({ success: false, message: 'Collection with same Name or URL already exists' })

        const collection = await Collection.findByIdAndUpdate({ _id: payload._id }, { $set: payload }, { new: true })
        return res.send({ success: true, message: 'Collection updated successfully', collection })
    } catch (error) {
        if (error.code === 11000 || error.code === 11001)
            checkDuplicate(error, res, 'Collection')
        else
            return next(error)
    }
}

// API to delete collection
exports.delete = async (req, res, next) => {
    try {
        const { collectionId } = req.params
        if (collectionId) {
            // get collection owners
            const owners = await NFT.find({ collectionId }).distinct('ownerId')

            // if there is no owner or user is the only owner of collection then del. collection otherwise not
            if (owners?.length <= 1) {
                const collection = await Collection.findByIdAndDelete({ _id: collectionId })
                if (collection) {
                    res.send({ success: true, message: 'Collection deleted successfully', collectionId })

                    // delete nft
                    await NFT.deleteMany({ collectionId })

                    // delete offers
                    await Offer.deleteMany({ collectionId })

                    // delete bids
                    await Bid.deleteMany({ collectionId })

                    // delete attributes
                    await Attributes.deleteMany({ collectionId })

                    // delete activity
                    await Activity.deleteMany({ collectionId })

                    // delete metadata
                    await Metadata.deleteMany({ address: collection.address })

                    // delete sell history
                    await SellHistory.deleteMany({ collectionId })

                    // delete selling configs.
                    await SellingConfig.deleteMany({ collectionId })

                    // delete stats
                    await Stats.deleteMany({ collectionId })
                } else return res.status(400).send({ success: false, message: 'Collection not found for given Id' })
            } else return res.status(400).send({ success: false, message: 'You can\'t delete this collection because you don\'t own all the items in this collection' })
        } else
            return res.status(400).send({ success: false, message: 'Collection Id is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get collection
exports.get = async (req, res, next) => {
    try {
        let { collectionId } = req.params
        const { page } = req.query

        if (collectionId) {
            let collection = await Collection.findOne({ url: collectionId }, { __v: 0, createdAt: 0, updatedAt: 0 }).populate([{ path: 'userId', select: '_id username email profileImageLocal' }, { path: 'categoryId', select: '_id name imageLocal slug' }]).lean(true)
            if (collection) {
                if (page === 'edit' && collection.userId?._id.toString() !== req.user)
                    return res.status(400).send({ success: false, message: `Your account is not authorized to modify the ${collection.name} collection.`, invalidCol: true })

                collectionId = collection._id
                collection.user = collection.userId
                collection.user.profileImage = collection.user.profileImageLocal ? `${baseUrl}${collection.user.profileImageLocal}` : ''
                delete collection.user.profileImageLocal

                collection.autoColId = collection.autoColId || 0
                collection.category = collection.categoryId
                collection.category.image = collection.category.imageLocal ? `${baseUrl}${collection.category.imageLocal}` : ''
                delete collection.category.imageLocal

                collection.logo = collection.logoLocal ? `${baseUrl}${collection.logoLocal}` : colLogoPlaceholder
                collection.featuredImg = collection.featuredImgLocal ? `${baseUrl}${collection.featuredImgLocal}` : colFeaturedPlaceholder
                collection.banner = collection.bannerLocal ? `${baseUrl}${collection.bannerLocal}` : ''

                delete collection.userId
                delete collection.categoryId

                collection.items = await NFT.countDocuments({ collectionId })

                const owners = await NFT.find({ collectionId }).distinct('ownerId')
                collection.owners = owners?.length || 0

                // WORKING FINE BUT COMMENTED TEMP. 
                // const stats = await getColStats(collectionId)
                // collection.stats = stats

                return res.json({ success: true, message: 'Collection retrieved successfully', collection })
            } else return res.status(400).send({ success: false, message: "We've explored deep and wide, but we can't find the page you were looking for.", invalidCol: true })
        } else
            return res.status(400).send({ success: false, message: "We've explored deep and wide, but we can't find the page you were looking for.", invalidCol: true })
    } catch (error) {
        return next(error)
    }
}

// API to get collection list
exports.list = async (req, res, next) => {
    try {
        let { page, limit, categoryId, all, userId, show, nonCustom } = req.query
        const filter = {}
        if (userId)
            filter.userId = ObjectId(userId)

        if (categoryId)
            filter.categoryId = ObjectId(categoryId)

        if (show)
            filter.show = JSON.parse(show)

        if (nonCustom)
            filter.address = { $exists: false }

        let total = 0

        if (!all) {
            page = page !== undefined && page !== '' ? parseInt(page) : 1
            limit = limit !== undefined && limit !== '' ? parseInt(limit) : 12

            total = await Collection.countDocuments(filter)

            if (page > Math.ceil(total / limit) && total > 0)
                page = Math.ceil(total / limit)

        }

        const pipeline = [
            {
                $match: filter
            },
            { $sort: { name: 1 } },
            {
                $lookup: {
                    from: 'categories',
                    foreignField: '_id',
                    localField: 'categoryId',
                    as: 'category'
                }
            },
            {
                $unwind: '$category'
            },
            {
                $project: {
                    _id: 1, name: 1, logo: { $ifNull: [{ $concat: [baseUrl, '$logoLocal'] }, colLogoPlaceholder] }, description: 1, url: 1,
                    featuredImg: { $ifNull: [{ $concat: [baseUrl, '$featuredImgLocal'] }, colFeaturedPlaceholder] },
                    category: {
                        _id: '$category._id',
                        name: '$category.name'
                    }
                }
            }
        ]

        if (!all) {
            pipeline.push({ $skip: limit * (page - 1) })
            pipeline.push({ $limit: limit })
        }

        const collections = await Collection.aggregate(pipeline)

        return res.send({
            success: true, message: 'Collections fetched successfully',
            data: {
                collections,
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

// API to integrate collection 
exports.integrate = async (req, res, next) => {
    try {
        let payload = req.body
        payload.userId = req.user

        if (!payload.userId || !payload.address || !payload.categoryId)
            return res.status(400).send({ success: false, message: 'Please provide all required fields' })

        if (payload.address.toLowerCase() === contractAddress.toLowerCase())
            return res.status(400).send({ success: false, message: 'Sorry, you can not integrate through this contract address' })

        // check if collection with same address already exists
        const sameAddrCollection = await Collection.findOne({ address: payload.address })
        if (sameAddrCollection)
            return res.status(400).send({ success: false, message: 'Collection with same contract address already exists' })

        // fetch contract name via given address
        const nftContract = new Contract(nftABI, payload.address)

        // check owner of contract for collection
        const contractOwner = await nftContract.methods.owner().call()
        if (contractOwner && payload.userAddr && contractOwner.toLowerCase() !== payload.userAddr.toLowerCase())
            return res.status(400).send({ success: false, message: 'Sorry, you can not integrate through this contract address' })

        let tokenName = await nftContract.methods.name().call()
        payload.name = tokenName || 'Unnamed'

        payload.nameLower = payload.name.toLowerCase()

        // check user existing collection
        let collectionName = `^${payload.nameLower}$`
        const existingCollection = await Collection.findOne({ nameLower: { $regex: collectionName, $options: 'i' } })

        // if collection with same address / name already exists then make a new version of collection
        if (existingCollection) {
            // get latest version
            let collectionVersion = `^${payload.nameLower}-v`
            let latestCollection = await Collection.find({ nameLower: { $regex: collectionVersion, $options: 'i' } }, { nameLower: 1 }).sort({ nameLower: -1 }).limit(1)

            if (latestCollection?.length) {
                let version = (latestCollection[0].nameLower).split('-v').pop() // vserion number
                version = parseFloat(version) + 1 // assign new version
                payload.name = payload.name.concat(`-v${version}`)
                payload.nameLower = payload.name
            } else {
                let version = '1'
                payload.name = payload.name.concat(`-v${version}`)
                payload.nameLower = payload.name
            }
        }

        payload.lastFetched = 0;

        payload.url = payload.name.replace(/ /g, '-');

        const settings = await Settings.findOneAndUpdate({}, { $set: {} }, { upsert: true, new: true })
        if (settings) {
            const prevCols = settings.totalCols || 0 // collections before adding more
            const newCols = 1

            // increment total Cols 
            settings.totalCols = prevCols + newCols
            await settings.save()

            payload.autoColId = settings.totalCols
        }

        // create collection
        let colRes = await Collection.create(payload)

        // create NFTs with collection
        // await createCollectionNFTs(payload.name, payload.userId, colRes._id)

        res.json({ success: true, message: 'Collection integrated successfully', collectionId: colRes._id, collectionUrl: colRes.url })
    } catch (error) {
        return next(error)
    }
}

// API to integrate collection 
exports.fetchCollectionsNFTs = async (req, res, next) => {
    try {
        res.json({ success: true, message: 'NFTs request added to pool.' })
        const existingCollections = await Collection.find({ address: { $exists: true } });
        for (let x = 0; x < existingCollections.length; x++) {
            let consecutiveFails = 0;
            let collectionD = existingCollections[x];
            let address = collectionD.address;
            let lastCollected = collectionD.lastFetched;
            let userId = collectionD.userId;
            let collectionId = collectionD._id;
            for (let i = 0; consecutiveFails < 10; i++) {
                let tokenURILink = await tokenUri(lastCollected, address);
                let nftOwnerRes = await tokenOwner(lastCollected, address);
                if (tokenURILink || nftOwnerRes) {
                    let ownerId = ''
                    if (nftOwnerRes) {
                        let user = await User.findOne({ address: nftOwnerRes }).lean(true)
                        if (!user) {
                            let userData = {
                                username: 'Unnamed',
                                address: nftOwnerRes
                            }
                            let newUser = await User.create(userData)
                            if (newUser)
                                ownerId = newUser._id
                        } else
                            ownerId = user._id
                    }

                    if (ownerId)
                        await upsertCollectionNFTs(userId, collectionId, tokenURILink, lastCollected, ownerId, address);
                    consecutiveFails = 0;
                }
                else {
                    consecutiveFails++;
                }
                lastCollected++;
            }
            await Collection.findByIdAndUpdate({ _id: ObjectId(existingCollections[x]._id) }, { $set: { lastFetched: lastCollected - 10 } });
        }
    } catch (error) {
        return next(error)
    }
}

async function upsertCollectionNFTs(userId, collectionId, tokenURILink, lastCollected, ownerId, address) {
    let tokenRes = null
    if (tokenURILink)
        try {
            // if metadata is in ipfs, then convert it to url
            tokenURILink = await ipfsToUrl(tokenURILink)
            tokenRes = await axios.get(tokenURILink)
        } catch (error) {
            tokenRes = null
        }

    // upsert data if valid tokenRes found or even if token URI does not exist
    let data = tokenRes && tokenRes.status === 200 && tokenRes.data ? tokenRes.data : {}
    const nft = {
        name: data.name,
        creatorId: userId,
        ownerId,
        image: data.image || nftImgPlaceholder,
        imageLocal: data.image ? await downloadImage(data.image) : '',
        description: data.description || '',
        collectionId,
        tokenId: lastCollected,
        attributes: data.attributes || [],
        isCustom: true,
        address,
        metaData: tokenURILink || ''
    }

    if (!nft.name) {
        // fetch contract name via given address
        const nftContract = new Contract(nftABI, address)
        let tokenName = await nftContract.methods.name().call()
        nft.name = tokenName || 'Unnamed'
    }

    // upsert nfts
    const nftRes = await NFT.findOneAndUpdate({ tokenId: nft.tokenId, address: nft.address }, { $set: { ...nft } }, { upsert: true, new: true })

    // assign auto nftId if not assigned
    if (nftRes && !nftRes.autoNftId) {
        const settings = await Settings.findOneAndUpdate({}, { $set: {} }, { upsert: true, new: true })
        if (settings) {
            let prevNfts = settings.totalNfts || 0 // NFTs before adding more
            let newNfts = 1
            let total = prevNfts + newNfts
            // increment total NFTs
            settings.totalNfts = total
            await settings.save()

            nftRes.autoNftId = total
            await nftRes.save()
        }
    }

    // update attributes in attr. collection
    if (nftRes.attributes && nftRes.attributes.length) {
        const attributes = await nftRes.attributes.map(attr => {
            return { ...attr, collectionId: nftRes.collectionId, nftId: nftRes._id }
        })
        await Attributes.deleteMany({ nftId: nftRes._id })
        await Attributes.insertMany(attributes)
    }
}

async function tokenUri(tokenId, address) {
    try {
        let nftContract = new Contract(nftABI, address);
        const tokenUriLink = await nftContract.methods.tokenURI(tokenId).call();
        return tokenUriLink;
    } catch (error) {
        return false;
    }
}

async function tokenOwner(tokenId, address) {
    try {
        let nftContract = new Contract(nftABI, address);
        const owner = await nftContract.methods.ownerOf(tokenId).call();
        return owner;
    } catch (error) {
        return false;
    }
}

exports.getNFTOwner = tokenOwner;

// API for CRON to sync. metadata
exports.syncMetadata = async (req, res, next) => {
    try {
        res.json({ success: true, message: 'Updating metadata...' })

        // fetch 100 requests from queue in their order
        let requests = await Metadata.find({ isSkipped: false }).sort({ createdAt: 1 }).limit(100)
        for (let i = 0; i < requests.length; i++) {
            let mdata = requests[i]

            // fetch metdata from other platforms
            let tokenURILink = await tokenUri(mdata.tokenId, mdata.address)
            if (tokenURILink) {
                let nftOwnerRes = await tokenOwner(mdata.tokenId, mdata.address)
                let ownerId = ''
                if (nftOwnerRes) {
                    let user = await User.findOne({ address: nftOwnerRes }).lean(true)
                    if (!user) {
                        let userData = {
                            username: 'Unnamed',
                            address: nftOwnerRes
                        }
                        let newUser = await User.create(userData)
                        if (newUser)
                            ownerId = newUser._id
                    } else
                        ownerId = user._id
                }

                if (ownerId) {
                    let updateNFTRes = await updateNFT(mdata.nftId, tokenURILink, ownerId, mdata.address)

                    // if NFT is updated then, remove the processed metadata request
                    if (updateNFTRes)
                        await mdata.deleteOne()
                    else {
                        mdata.isSkipped = true
                        await mdata.save()
                    }
                }
            }
        }
    } catch (error) {
        return next(error)
    }
}

async function updateNFT(nftId, tokenURILink, ownerId, address) {
    let tokenRes = null
    if (tokenURILink)
        try {
            // if metadata is in ipfs, then convert it to url
            tokenURILink = await ipfsToUrl(tokenURILink)
            tokenRes = await axios.get(tokenURILink)
        } catch (error) {
            tokenRes = null
        }

    // upsert data if valid tokenRes found or even if token URI does not exist
    let data = tokenRes && tokenRes.status === 200 && tokenRes.data ? tokenRes.data : {}
    const nft = {
        name: data.name,
        ownerId,
        image: data.image || nftImgPlaceholder,
        imageLocal: data.image ? await downloadImage(data.image) : '',
        description: data.description || '',
        attributes: data.attributes || [],
        metaData: tokenURILink || ''
    }

    if (!nft.name) {
        // fetch contract name via given address
        const nftContract = new Contract(nftABI, address)
        let tokenName = await nftContract.methods.name().call()
        nft.name = tokenName || 'Unnamed'
    }

    // update NFT
    const nftRes = await NFT.findByIdAndUpdate({ _id: nftId }, { $set: { ...nft } }, { new: true })

    // update attributes in attr. collection
    if (nftRes.attributes && nftRes.attributes.length) {
        const attributes = await nftRes.attributes.map(attr => {
            return { ...attr, collectionId: nftRes.collectionId, nftId: nftRes._id }
        })
        await Attributes.deleteMany({ nftId: nftRes._id })
        await Attributes.insertMany(attributes)
    }

    return true
}

// get floor price & total volume traded for given collection
async function getColStats(collectionId) {
    if (collectionId) {
        const pricesInMYNT = await axios.get(MYNTtoBNBLink)
        const MYNTtoBNB = (pricesInMYNT?.data?.data)?.quote[0]?.price
        const pricesInWBNB = await axios.get(WBNBtoBNBLink)
        const WBNBtoBNB = (pricesInWBNB?.data?.data)?.quote[0]?.price

        const filter = {
            collectionId: ObjectId(collectionId)
        }

        const stats = await SellHistory.aggregate([
            { $match: filter },
            {
                $project: {
                    originalPrice: '$price',
                    price: {
                        $cond: {
                            if: { $eq: ['$price.currency', 'MYNT'] },
                            then: { $trunc: [{ $multiply: ['$price.amount', MYNTtoBNB] }, 7] },
                            else: { $trunc: [{ $multiply: ['$price.amount', WBNBtoBNB] }, 7] }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    floorPrice: { $min: '$price' },
                    volumeTraded: { $sum: '$price' }
                }
            },
            {
                $project: {
                    floorPrice: { $trunc: ['$floorPrice', 6] },
                    volumeTraded: { $trunc: ['$volumeTraded', 6] }
                }
            }
        ])

        return stats?.length ? stats[0] : null
    }
}

// API to get notable collections
exports.getNotableDrops = async (req, res, next) => {
    try {
        let filter = { isNotableDrop: true }
        let notableDrops = await Collection.aggregate([
            {
                $match: filter
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $project: {
                    _id: 1, name: 1, description: 1, url: 1,
                    featuredImg: { $ifNull: [{ $concat: [baseUrl, '$featuredImgLocal'] }, colFeaturedPlaceholder] }
                }
            }
        ])

        return res.status(200).send({
            success: true,
            notableDrops
        })

    } catch (error) {
        return next(error)
    }
}

const downloadImage = async (image) => {
    const uploadsDir = './src/uploads/'
    const imgDirName = 'images'
    const imagesDir = `${uploadsDir}${imgDirName}/`

    // make images directory if do not exist
    if (!fs.existsSync(imagesDir))
        fs.mkdirSync(imagesDir)

    let resultantImage = ''
    const dest = path.resolve(path.join(imagesDir))
    const options = {
        url: await ipfsToUrl(image),
        dest
    }

    await download.image(options)
        .then(async ({ filename }) => {
            resultantImage = filename
        })
        .catch((err) => {
            console.log('Error in downloading image catch: ', err)
        })

    // rename file because there might be file with same name so we need to rename file
    if (resultantImage) {
        const originalFilename = resultantImage.split('/').pop()
        const fileExtension = originalFilename.match(/\.([^\.]+)$/)?.[1] || ''
        const newFilename = `${Date.now()}${fileExtension ? `.${fileExtension}` : ''}`

        const newFilePath = `${dest}/${newFilename}`
        const oldFilePath = `${dest}/${originalFilename}`

        fs.renameSync(oldFilePath, newFilePath)

        // compressing image and saving to server
        if (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png')
            await tinify.fromFile(newFilePath).toFile(newFilePath)

        // COMMENTED TEMP. remove old file saved in DATABASE
        // await fs.rename(oldFilePath, newFilePath, (error) => {
        //     if (error) console.log('Error while renaming file', error)
        //     // unlink / remove file when renamed
        //     else {
        //         if (fs.existsSync(oldFilePath))
        //             fs.unlink(oldFilePath)
        //     }
        // })

        resultantImage = `${imgDirName}/${newFilename}`
    }

    return resultantImage
}