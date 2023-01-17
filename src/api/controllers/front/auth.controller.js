const User = require('../../models/users.model');
const { verifySign } = require('../../utils/web3')

/**
 * Returns jwt token if valid address and password is provided
 * @public
 */
exports.login = async (req, res, next) => {
  try {
    let { address, password, referralId, referredBy } = req.body;

    let user = await User.findOne({ address }).exec();

    // create user if user not found, and then login
    if (!user) {
      let userData = {
        username: 'Unnamed',
        address,
        signature: password,
        referralId
      }
      if (referredBy) {
        let referredByUser = await User.findOne({ referralId: referredBy });
        userData.referredBy = referredByUser._id
      }

      let newUser = await User.create(userData)
      var accessToken = await newUser.token();
      newUser = newUser.transform();
      let data = {
        ...newUser,
        accessToken
      }

      return res.status(200).send({ status: true, message: 'User logged in successfully', data: { ...data, newUser: true } });
    }
    // log in valid user 
    else if (user) {
      // check if user has provided valid signature
      let web3SignRes = await verifySign(address, password)
      if (!web3SignRes)
        return res.status(400).send({ status: false, message: 'Incorrect OR Missing Credentials' });

      var accessToken = await user.token();
      user = user.transform();
      let data = {
        ...user,
        accessToken
      }

      return res.status(200).send({ status: true, message: 'User logged in successfully', data });
    }
  } catch (error) {
    return next(error);
  }
};

