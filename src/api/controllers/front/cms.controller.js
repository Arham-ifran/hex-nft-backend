const CMS = require('../../models/cms.model')
const { checkDuplicate } = require('../../../config/errors')

// API to get a CMS
exports.get = async (req, res, next) => {
    try {
        const { slug } = req.params
        if (slug) {
            const content = await CMS.findOne({ slug }, { _id: 1, title: 1, status:1, slug: 1, description: 1 }).lean(true)
            if (content)
                return res.json({ success: true, message: 'Content Page retrieved successfully', content })
            else return res.status(400).send({ success: false, message: 'Content Page not found for given slug' })
        } else
            return res.status(400).send({ success: false, message: 'Slug is required' })
    } catch (error) {
        return next(error)
    }
}

// API to get CMS list
exports.list = async (req, res, next) => {
    try {
    
        const total = await CMS.countDocuments({})

        const contentPages = await CMS.find({})

        return res.send({
            success: true, message: 'Content Pages fetched successfully',
            data: {
                contentPages,
                
            }
        })
    } catch (error) {
        return next(error)
    }
}