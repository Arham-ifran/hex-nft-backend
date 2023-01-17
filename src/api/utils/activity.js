const Activity = require('../models/activity.model')

exports.insert = async (data = null) => {
    if (Object.keys(data).length === 0) {
        return { status: false, message: 'Given Data Is Null.' }
    }
    await Activity.create(data)
}