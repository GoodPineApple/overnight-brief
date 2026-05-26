import nodemailer from 'nodemailer';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground',
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

export async function sendEmail(to: string, subject: string, html: string) {
  const accessToken = await oauth2Client.getAccessToken();

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken: accessToken.token as string,
    },
  });

  await transporter.sendMail({
    from: `Overnight Brief <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}
