import tls from 'node:tls';
import { createInterface } from 'node:readline';

function readConfiguration() {
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  if (!user || !password) return null;
  return {
    host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 465),
    user,
    password,
    from: process.env.SMTP_FROM?.trim() || user
  };
}

export function isEmailConfigured() {
  return readConfiguration() !== null;
}

function address(value) {
  return String(value).replace(/[\r\n<>]/g, '');
}

async function sendSmtpMessage({ to, subject, text }) {
  const config = readConfiguration();
  if (!config) return { sent: false, reason: 'not_configured' };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port.');
  }

  const socket = tls.connect({ host: config.host, port: config.port, servername: config.host });
  socket.setTimeout(20000, () => socket.destroy(new Error('SMTP connection timed out.')));
  const lines = createInterface({ input: socket, crlfDelay: Infinity });
  const replies = lines[Symbol.asyncIterator]();
  try {
    await new Promise((resolve, reject) => {
      socket.once('secureConnect', resolve);
      socket.once('error', reject);
    });

    const readReply = async (expectedCode) => {
      let line;
      let code;
      do {
        const result = await replies.next();
        if (result.done) throw new Error('SMTP connection closed unexpectedly.');
        line = result.value;
        const match = /^(\d{3})([ -])/.exec(line);
        if (!match) throw new Error('SMTP server returned an invalid response.');
        code = Number(match[1]);
      } while (line[3] === '-');
      if (code !== expectedCode) throw new Error(`SMTP server returned status ${code}.`);
    };
    const command = async (value, expectedCode) => {
      await new Promise((resolve, reject) => {
        socket.write(`${value}\r\n`, (error) => error ? reject(error) : resolve());
      });
      await readReply(expectedCode);
    };

    await readReply(220);
    await command('EHLO dormhive.local', 250);
    await command('AUTH LOGIN', 334);
    await command(Buffer.from(config.user).toString('base64'), 334);
    await command(Buffer.from(config.password).toString('base64'), 235);
    await command(`MAIL FROM:<${address(config.from)}>`, 250);
    await command(`RCPT TO:<${address(to)}>`, 250);
    await command('DATA', 354);

    const encodedText = Buffer.from(text, 'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') ?? '';
    const message = [
      `From: <${address(config.from)}>`,
      `To: <${address(to)}>`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      encodedText
    ].join('\r\n').replace(/(^|\r\n)\./g, '$1..');
    await new Promise((resolve, reject) => {
      socket.write(`${message}\r\n.\r\n`, (error) => error ? reject(error) : resolve());
    });
    await readReply(250);
    await command('QUIT', 221);
    return { sent: true };
  } finally {
    lines.close();
    socket.end();
  }
}

export async function sendVerificationDecisionEmail({ email, name, status }) {
  const normalizedName = String(name || 'there').replace(/[\r\n]/g, ' ').trim();
  const approved = status === 'approved';
  const subject = approved ? 'Your DormHive account is approved' : 'An update about your DormHive account';
  const text = approved
    ? `Hello ${normalizedName},\n\nYour DormHive account has been approved. You can now sign in using your registered email and password.\n\nThank you,\nDormHive`
    : `Hello ${normalizedName},\n\nYour DormHive account verification was not approved. Please contact DormHive support if you believe this decision was made in error.\n\nThank you,\nDormHive`;
  return sendSmtpMessage({ to: email, subject, text });
}

export async function sendPasswordResetEmail({ email, name, resetUrl }) {
  const normalizedName = String(name || 'there').replace(/[\r\n]/g, ' ').trim();
  const text = `Hello ${normalizedName},\n\nWe received a request to reset your DormHive password. Use this one-time link within 10 minutes:\n\n${resetUrl}\n\nIf you did not request a password reset, you can ignore this email.\n\nThank you,\nDormHive`;
  return sendSmtpMessage({ to: email, subject: 'Reset your DormHive password', text });
}
