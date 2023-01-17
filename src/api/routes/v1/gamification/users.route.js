const express = require('express');
const controller = require('../../../controllers/gamification/users.controller');
const router = express.Router();
const { profileUpload } = require('../../../utils/upload')

router.route('/:address').get(controller.get); // API to fetch user profile
router.route('/update').put(profileUpload, controller.update); // API to update user profile

module.exports = router;