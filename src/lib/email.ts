import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 465);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASSWORD;
const from = process.env.SMTP_FROM || "矿配云 <no-reply@kuangpeiyun.com>";
const appUrl = process.env.APP_URL || "https://kuangpeiyun.com";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export async function sendPasswordResetEmail(to: string, rawToken: string) {
  const link = `${appUrl}/reset-password?token=${rawToken}`;
  const t = getTransporter();
  if (!t) {
    console.error("[email] SMTP not configured; reset email NOT sent to:", to);
    return;
  }
  await t.sendMail({
    from,
    to,
    subject: "矿配云｜密码重置",
    html: `<p>您正在重置矿配云账号密码。</p>
<p>点击以下链接重置（60 分钟内有效，仅可使用一次）：</p>
<p><a href="${link}">${link}</a></p>
<p>如果这不是您本人操作，请忽略此邮件。</p>`,
  });
}
