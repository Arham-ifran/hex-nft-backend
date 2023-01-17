const ObjectId = require('mongoose').Types.ObjectId
const Subscription = require('../../models/subscriptions.model')

exports.listSubscriptions = async (req, res, next) =>{
    try{
        let { page, limit, userEmail, ipAddress } = req.query

        page = page !== undefined && page !== '' ? parseInt(page) : 1
        limit = limit !== undefined && limit !== '' ? parseInt(limit) : 10

        let filter = {}

        if(userEmail && userEmail !== null){
            filter.userEmail = userEmail.toLowerCase().trim()
        }

        if(ipAddress && ipAddress !== null){
            filter.ipAddress = ipAddress.trim()
            // filter.ipAddress = { $regex : ipAddress.replace(/^((\d\d?|1\d\d|2([0-4]\d|5[0-5]))\.){3}(\d\d?|1\d\d|2([0-4]\d|5[0-5]))$/),  $options: 'gi' }
        }

        const total = await Subscription.countDocuments(filter)

        if (page > Math.ceil(total / limit) && total > 0)
            page = Math.ceil(total / limit)


        let subscribedUsers = await Subscription.aggregate([
            { $match : filter },
            { 
                $project : {
                    userEmail : 1, 
                    ipAddress : 1,
                    createdAt : 1
                }   
            },
            { $sort : { createdAt : -1 } },
            { $skip: limit * (page - 1) },
            { $limit: limit },
        ])

        return res.status(200).send({ success : true , data : {
            subscribedUsers,
            pagination: {
                page, limit, total,
                pages: Math.ceil(total / limit) <= 0 ? 1 : Math.ceil(total / limit)
            }
        }
        })
    }
    catch(err){
        next(err)
    }
}