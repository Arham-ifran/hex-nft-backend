const GiftCardLogs = require('../../models/giftCardLogs.model')
const Users = require('../../models/users.model')

exports.createGiftCardLogs = async(payload) => {
    if(Object.keys(payload).length > 0){

        let { userId, token } = payload

        let logPresent = await GiftCardLogs.findOne({ userId, isUsed : true, token })

        if(logPresent){
            return { success : 'false', message : 'You have already applied this voucher code!'}
        }

        const giftCardLog = await GiftCardLogs.create(payload)
        console.log('gift card log -----------------', giftCardLog)
        return { success: true , message : 'Gift card log created successfully!', giftCardLog }
    }
}

exports.deleteGiftCardLog = async(payload) => {
    console.log('')
    console.log('')
    console.log('Delete Gift Card --------------', payload)
    if(Object.keys(payload).length > 0){

        let filter = {}

        if(payload.offerId){
            if(payload.deleteExceptThisOffer){
                filter.offerId = { $ne: payload.offerId }
            }
            else{
                filter.offerId = payload.offerId
            }
        }

        if(payload.bidId){
            if(payload.deleteExceptThisBid){
                filter.bidId = { $ne: payload.bidId }
            }
            else{
                filter.bidId = payload.bidId
            }
        }

        if(payload.nftId){
            filter.nftId = payload.nftId
        }

        const giftCardlogs = await GiftCardLogs.find(filter)

        console.log('GiftCard log------------------')
        console.log('GiftCard log length------------------',giftCardlogs.length)
        console.log(giftCardlogs)

        if(giftCardlogs.length > 1){
            await GiftCardLogs.deleteMany(filter)
            return { success : true, message: 'Gift Card Log deleted successfully!'}
    
        }
        else if(giftCardlogs.length == 1){
            await GiftCardLogs.deleteOne(filter)
            return { success : true, message: 'Gift Card Log deleted successfully!'}

        }
        else {
            return { success: false, message: 'No record present againt this id!'}
        }

    }
    else {
        return { success: false, message: 'Please provide either offer id or nft and user ids'}
    }
}

// update isGiftCardUsed status to true 
exports.updateGiftCardStatus = async(payload) =>{
    if(Object.keys(payload).length > 0){

        let filter = {}

        if(payload.offerId){
            filter.offerId = payload.offerId
        }

        if(payload.bidId){
            filter.bidId = payload.bidId
        }

        let updatedGiftCardLog = await GiftCardLogs.findOneAndUpdate(filter, { $set: { isGiftCardUsed: true } }, { new : true })

        let offerByUser = await Users.findOne({ _id : updatedGiftCardLog.userId})

        if(Object.keys(updatedGiftCardLog).length > 0){
            return { success: true , message: "Gift Card Log updated successfully!", data : { token : updatedGiftCardLog.token , userId : offerByUser.address} }
        }
        else{
            console.log(' errrrrrrrrrr-----------------',updatedGiftCardLog )
            return { success: false , message: "Couldn't update gift card log!"}

        }
    }
}
