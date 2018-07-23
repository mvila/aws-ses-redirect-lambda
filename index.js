const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const ses = new AWS.SES();

const CONFIG = JSON.parse(process.env.AWS_SES_REDIRECT_LAMBDA_CONFIG);

async function getRawMessage(sesMessageId) {
  const result = await s3.getObject({Bucket: CONFIG.s3BucketName, Key: sesMessageId}).promise();
  return result.Body.toString();
}

async function sendMessage(message) {
  const {MessageId: messageId} = await ses.sendRawEmail({RawMessage: {Data: message}}).promise();
  return messageId;
}

function findRedirection(recipients) {
  for (let recipient of recipients) {
    recipient = recipient.toLowerCase();
    for (const redirection of CONFIG.redirections) {
      if (recipient.includes(redirection.recipient.toLowerCase())) {
        return redirection;
      }
    }
  }

  throw new Error(`Redirection not found (recipients: ${JSON.stringify(recipients)})`);
}

function findHeader(headers, name) {
  name = name.toLowerCase();
  for (const header of headers) {
    if (header.name.toLowerCase() === name) {
      return header.value;
    }
  }
}

exports.handler = async event => {
  try {
    const {
      mail: {messageId: sesMessageId, headersTruncated, headers: originalHeaders, commonHeaders},
      receipt: {recipients}
    } = event.Records[0].ses;

    console.log(`Redirecting message (sesMessageId: '${sesMessageId}')`);

    if (headersTruncated) {
      throw new Error('Message headers are truncated');
    }

    const redirection = findRedirection(recipients);

    let headers = `From: ${redirection.from}\r\n`;

    const originalFrom = commonHeaders.from[0];
    if (originalFrom) {
      headers += `Reply-To: ${originalFrom}\r\n`;
    }

    const originalTo = commonHeaders.to[0];
    if (originalTo) {
      headers += `X-Original-To: ${originalTo}\r\n`;
    }

    headers += `To: ${redirection.to}\r\n`;

    const subject = commonHeaders.subject;
    if (subject) {
      headers += `Subject: ${subject}\r\n`;
    }

    const mimeVersion = findHeader(originalHeaders, 'MIME-Version');
    if (mimeVersion) {
      headers += `MIME-Version: ${mimeVersion}\r\n`;
    }

    const contentType = findHeader(originalHeaders, 'Content-Type');
    if (contentType) {
      headers += `Content-Type: ${contentType}\r\n`;
    }

    const contentTransferEncoding = findHeader(originalHeaders, 'Content-Transfer-Encoding');
    if (contentTransferEncoding) {
      headers += `Content-Transfer-Encoding: ${contentTransferEncoding}\r\n`;
    }

    const rawMessage = await getRawMessage(sesMessageId);
    const index = rawMessage.indexOf('\r\n\r\n');
    const body = index !== -1 ? rawMessage.slice(index + '\r\n\r\n'.length) : 'Empty email';

    const message = headers + '\r\n' + body;

    const newMessageId = await sendMessage(message);

    console.log(
      `Message redirected from <${redirection.recipient}> to <${
        redirection.to
      }> (sesMessageId: '${sesMessageId}', newMessageId: '${newMessageId}')`
    );
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
  }
};
