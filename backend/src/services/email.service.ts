import { env } from "../config/env.js";
import { emailTransporter } from "../config/email.js";

interface SendMailParams {
  to: string | string[];
  subject: string;
  html: string;
}

export const sendMail = async ({ to, subject, html }: SendMailParams): Promise<void> => {
  await emailTransporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html
  });
};

export const sendSubmissionConfirmationEmail = async (
  authorEmail: string,
  authorName: string,
  submissionId: string
): Promise<void> => {
  await sendMail({
    to: authorEmail,
    subject: `Submission Received: ${submissionId}`,
    html: `<p>Dear ${authorName},</p><p>Your manuscript has been received. Submission ID: <strong>${submissionId}</strong>.</p>`
  });
};

export const sendPaymentReceiptEmail = async (
  to: string,
  invoiceId: string,
  amount: number,
  currency: string,
  transactionId: string
): Promise<void> => {
  await sendMail({
    to,
    subject: `Payment received for ${invoiceId}`,
    html: `<p>Payment received successfully.</p><p>Invoice: <strong>${invoiceId}</strong></p><p>Amount: ${currency} ${amount.toFixed(
      2
    )}</p><p>Transaction ID: <strong>${transactionId}</strong></p>`
  });
};

export const sendUnderReviewEmail = async (authorEmail: string, authorName: string, title: string): Promise<void> => {
  await sendMail({
    to: authorEmail,
    subject: "Your manuscript is under review",
    html: `<p>Dear ${authorName},</p><p>Your manuscript <strong>${title}</strong> is now <strong>under review</strong>. We will notify you of the editorial decision as soon as possible.</p>`
  });
};

export const sendAcceptedEmail = async (authorEmail: string, authorName: string, title: string): Promise<void> => {
  await sendMail({
    to: authorEmail,
    subject: "Congratulations — manuscript accepted",
    html: `<p>Dear ${authorName},</p><p>We are pleased to inform you that your manuscript <strong>${title}</strong> has been <strong>accepted</strong>. Further instructions regarding APC and publication will follow.</p>`
  });
};

export const sendRejectedEmail = async (authorEmail: string, authorName: string, title: string): Promise<void> => {
  await sendMail({
    to: authorEmail,
    subject: "Editorial decision on your manuscript",
    html: `<p>Dear ${authorName},</p><p>Thank you for submitting <strong>${title}</strong>. After careful consideration, we are unable to accept this manuscript for publication in its current form.</p>`
  });
};

export const sendPaymentLinkEmail = async (
  authorEmail: string,
  authorName: string,
  invoiceId: string,
  paymentUrl: string
): Promise<void> => {
  await sendMail({
    to: authorEmail,
    subject: `Payment link for invoice ${invoiceId}`,
    html: `<p>Dear ${authorName},</p><p>Please complete your APC payment using this secure link:</p><p><a href="${paymentUrl}">${paymentUrl}</a></p>`
  });
};

export const sendDoiAssignedEmail = async (
  authorEmail: string,
  authorName: string,
  title: string,
  doi: string
): Promise<void> => {
  await sendMail({
    to: authorEmail,
    subject: `DOI assigned — ${doi}`,
    html: `<p>Dear ${authorName},</p><p>A DOI has been registered for your manuscript <strong>${title}</strong>.</p><p><strong>DOI:</strong> ${doi}</p><p>You may cite this identifier in your publication records.</p>`
  });
};

export const sendArticlePublishedEmail = async (
  authorEmail: string,
  authorName: string,
  title: string,
  doiLink: string,
  journalName: string
): Promise<void> => {
  await sendMail({
    to: authorEmail,
    subject: `Your article is now published — ${title}`,
    html: `<p>Dear ${authorName},</p><p>Congratulations! Your manuscript <strong>${title}</strong> has been published${journalName ? ` in <strong>${journalName}</strong>` : ""}.</p>${doiLink ? `<p>DOI: <a href="${doiLink}">${doiLink}</a></p>` : ""}<p>Thank you for publishing with ScriptHive.</p>`
  });
};
