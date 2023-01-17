const fs = require('fs');
const axios = require('axios')
const ObjectId = require('mongoose').Types.ObjectId
const User = require('../../models/users.model');
const NFT = require('../../models/nfts.model')
const SellHistory = require('../../models/sellHistory.model')
const { addImage } = require('../../utils/upload');
const { userDefaultImage, baseUrl, MYNTtoUSDLink, WBNBtoUSDLink, tinifyAPIKey } = require('../../../config/vars')
const tinify = require("tinify");
tinify.key = tinifyAPIKey;

exports.create = async (req, res, next) => {
  try {
    let user = await User.create(req.body);
    return res.send({ status: true, data: user });
  } catch (error) {
    return next(error);
  }
};
exports.update = async (req, res, next) => {
  try {
    let payload = req.body;
    const _id = req.user;
    if (!payload.username) {
      return res.send({ status: false, message: "Please fill all required fields" });
    }

    if (req.files) {
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
    }

    let user = await User.findByIdAndUpdate({ _id }, { $set: payload }, { new: true });
    let data = user.transform();
    return res.send({ status: true, data, message: "Your profile is updated successfully." });
  } catch (error) {
    return next(error);
  }
};

exports.getCreators = async (req, res, next) => {
  try {
    let { page, limit } = req.query

    page = page !== undefined && page !== '' ? parseInt(page) : 1
    limit = limit !== undefined && limit !== '' ? parseInt(limit) : 12

    let total = await NFT.aggregate([
      {
        $group: {
          _id: '$creatorId'
        }
      }
    ])

    total = total && total.length ? total.length : 0

    // if (page > Math.ceil(total / limit) && total > 0)
    //   page = Math.ceil(total / limit)

    const creators = await NFT.aggregate([
      {
        $group: {
          _id: '$creatorId',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      { $skip: limit * (page - 1) },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          foreignField: '_id', // user Id
          localField: '_id', // creator Id
          as: 'creator'
        }
      },
      {
        $unwind: '$creator'
      },
      {
        $project: {
          _id: '$creator._id',
          username: '$creator.username',
          profileImage: { $ifNull: [{ $concat: [baseUrl, '$creator.profileImageLocal'] }, userDefaultImage] },
          facebookLink: '$creator.facebookLink',
          twitterLink: '$creator.twitterLink',
          gPlusLink: '$creator.gPlusLink',
          vineLink: '$creator.vineLink',
        }
      }
    ])

    return res.send({
      status: true, message: "Authors fetched succesfully",
      data: {
        creators,
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

exports.topSellers = async (req, res, next) => {
  try {
    let { page, limit } = req.query

    page = page !== undefined && page !== '' ? parseInt(page) : 1
    limit = limit !== undefined && limit !== '' ? parseInt(limit) : 12

    let total = await SellHistory.aggregate([
      {
        $group: {
          _id: '$sellerId'
        }
      }
    ])

    total = total && total.length ? total.length : 0

    // if (page > Math.ceil(total / limit) && total > 0)
    //   page = Math.ceil(total / limit)

    let sellers = await SellHistory.aggregate([
      {
        $group: {
          _id: '$sellerId',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      { $skip: limit * (page - 1) },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          foreignField: '_id', // user Id
          localField: '_id', // seller Id
          as: 'seller'
        }
      },
      {
        $unwind: '$seller'
      },
      {
        $project: {
          _id: '$seller._id',
          username: '$seller.username',
          profileImage: { $ifNull: [{ $concat: [baseUrl, '$seller.profileImageLocal'] }, userDefaultImage] },
        }
      }
    ])

    return res.send({
      status: true, message: 'Top Sellers fetched succesfully',
      data: {
        sellers,
        pagination: {
          page, limit, total,
          pages: Math.ceil(total / limit) <= 0 ? 1 : Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    return next(error);
  }
}

exports.getUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (userId) {
      let user = await User.findOne({ _id: ObjectId(userId) });
      if (user) {
        user = user.transform();
        return res.send({ status: true, data: user, message: "Users fetched succesfully" });
      } else
        return res.status(400).send({ success: false, message: "We've explored deep and wide, but we can't find the page you were looking for.", invalidAuthor: true })
    } else
      return res.status(400).send({ success: false, message: "We've explored deep and wide, but we can't find the page you were looking for.", invalidAuthor: true })
  } catch (error) {
    return next(error);
  }
};

exports.listTrade = async (req, res, next) => {
  try {
    let { page, limit, startDate, endDate } = req.query

    page = page !== undefined && page !== '' ? parseInt(page) : 1
    limit = limit !== undefined && limit !== '' ? parseInt(limit) : 12

    const _id = req.user;

    const pricesInMYNT = await axios.get(MYNTtoUSDLink)
    const MYNTtoUSD = (pricesInMYNT?.data?.data)?.quote[0]?.price
    const pricesInWBNB = await axios.get(WBNBtoUSDLink)
    const WBNBtoUSD = (pricesInWBNB?.data?.data)?.quote[0]?.price

    const filter = {
      $or: [{ sellerId: ObjectId(_id) }, { buyerId: ObjectId(_id) }]
    }

    if (startDate && endDate) {
      filter.$and = [{ updatedAt: { $gte: new Date(startDate) } }, { updatedAt: { $lte: new Date(endDate) } }]
    }

    const total = await SellHistory.countDocuments(filter)

    let list = await SellHistory.aggregate([
      {
        $match: filter
      },
      {
        $sort: { updatedAt: -1 }
      },
      { $skip: limit * (page - 1) },
      { $limit: limit },
      {
        $project: {
          price: 1, updatedAt: 1,
          priceInDollars: {
            $cond: {
              if: { $eq: ['$price.currency', 'MYNT'] },
              then: { $trunc: [{ $multiply: ['$price.amount', MYNTtoUSD] }, 7] },
              else: { $trunc: [{ $multiply: ['$price.amount', WBNBtoUSD] }, 7] }
            }
          },
          type: {
            $cond: {
              if: { $eq: ["$sellerId", ObjectId(_id)] }, then: "Sell",
              else: "Purchase"
            }
          }
        }
      }
    ])

    let totalVol = 0
    list.forEach((item) => {
      totalVol += item.priceInDollars
    })

    return res.send({
      success: true, message: 'Trade list fetched successfully',
      data: {
        list,
        totalVol,
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