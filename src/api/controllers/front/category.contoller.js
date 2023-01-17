const Category = require('../../models/categories.model')
const { baseUrl, categoryDefaultImage } = require('../../../config/vars')

// API to get active category
exports.get = async (req, res, next) => {
    try {
        let { slug } = req.body

        if (!slug)
            return res.status(400).send({ success: false, message: "We've explored deep and wide, but we can't find the page you were looking for.", invalidCat: true })

        slug = slug.toLowerCase()
        const category = await Category.findOne({ status: true, slug }, { name: 1, imageLocal: 1, bannerLocal: 1, description: 1 }).lean(true)

        if (!category)
            return res.status(400).send({ success: false, message: "We've explored deep and wide, but we can't find the page you were looking for.", invalidCat: true })
        else {
            category.image = category.imageLocal ? `${baseUrl}${category.imageLocal}` : categoryDefaultImage
            category.banner = category.bannerLocal ? `${baseUrl}${category.bannerLocal}` : categoryDefaultImage

            return res.send({ success: true, message: 'Category fetched successfully', category })
        }
    } catch (error) {
        return next(error)
    }
}

// API to get active categories list
exports.list = async (req, res, next) => {
    try {
        const pipeline = [
            {
                $match: { status: true }
            },
            { $sort: { name: 1 } },
            {
                $project: {
                    _id: 1,
                    slug: 1,
                    name: 1,
                    image: { $ifNull: [{ $concat: [baseUrl, '$imageLocal'] }, categoryDefaultImage] }
                }
            }
        ]

        const categories = await Category.aggregate(pipeline)

        return res.send({ success: true, message: 'Categories fetched successfully', categories })
    } catch (error) {
        return next(error)
    }
}