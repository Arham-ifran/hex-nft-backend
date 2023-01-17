const ObjectId = require('mongoose').Types.ObjectId
const Subscription = require('../../models/subscriptions.model')

exports.createSubscription = async (req, res, next) =>{
    try{
        let { email } = req.body

        let ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip


        let payload = {
            userEmail : email,
            ipAddress
        }

        let subscribedUser = await Subscription.create(payload)

        return res.status(200).send({ success : true , subscribedUser})

    }
    catch(err){
        next(err)
    }
}