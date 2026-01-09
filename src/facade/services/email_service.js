const { Resend } = require('resend')
require('dotenv').config({ path: '../secretes/.env' })

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = new Resend(RESEND_API_KEY);

async function sendVerificationEmail(userEmail, OTP) {
  const { data, error } = await resend.emails.send({
    from: 'dancompute.service <service@main.ljzcvs.dev>',
    to: [userEmail],
    subject: 'Verify your email',
    html: `<h1>Enter this code to verify your email: ${OTP}</h1>
    <p>If you did not expect this email, you can ignore this.</p>
    `,
  });

  if (error) {
    return console.error({ error });
  }
  return { data };
}


module.exports = {
  sendVerificationEmail
};