const Contact = require('../../models/contact.model');
const Settings = require('../../models/settings.model')
const { sendEmail } = require('../../utils/emails/emails')

exports.create = async (req, res, next) => {
  try {
    let contact = await Contact.create(req.body);
    let settings = await Settings.findOne({}, {email: 1})
    let content = {
      "${name}": req.body.name,
      "${email}": req.body.email,
      "${message}": req.body.message
    }
    res.send({status: true, data: contact});
    await sendEmail(settings.email, 'contact-email', content, req.body.subject)
  } catch (error) {
    return next(error);
  }
};

