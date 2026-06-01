import { env } from "../config/env.js";
import { emailTransporter } from "../config/email.js";

interface SendMailParams {
  to: string | string[];
  subject: string;
  html: string;
}

/* ── Base template ─────────────────────────────────────────────────────────── */
function baseTemplate(title: string, preheader: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
<span style="display:none;font-size:1px;color:#f4f6fb;max-height:0;overflow:hidden;">${preheader}</span>

<!-- Wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a8a 100%);border-radius:14px 14px 0 0;padding:32px 40px;text-align:center;">
      <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">
        📚 ScriptHive Publication
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:4px;letter-spacing:1px;text-transform:uppercase;">
        International Research Journals
      </div>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="background:#ffffff;padding:40px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
      ${body}
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 14px 14px;padding:24px 40px;text-align:center;">
      <p style="margin:0 0 6px;font-size:12px;color:#64748b;">
        ScriptHive Publication  &nbsp;|&nbsp; <a href="https://scripthive.org" style="color:#2563eb;text-decoration:none;">scripthive.org</a>
      </p>
      <p style="margin:0;font-size:11px;color:#94a3b8;">
        This email was sent from <a href="mailto:noreply@mail.scripthive.org" style="color:#94a3b8;">noreply@mail.scripthive.org</a>.<br/>
        If you did not expect this email, you can safely ignore it.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/* ── Shared components ─────────────────────────────────────────────────────── */
function greeting(name: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;color:#374151;">Dear <strong>${name}</strong>,</p>`;
}

function badge(text: string, color: string, bg: string): string {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase;">${text}</span>`;
}

function infoCard(rows: [string, string][]): string {
  const cells = rows.map(([k, v]) =>
    `<tr>
      <td style="padding:10px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${k}</td>
      <td style="padding:10px 16px;font-size:13px;color:#0f172a;font-weight:600;border-bottom:1px solid #f1f5f9;">${v}</td>
    </tr>`
  ).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:20px 0;">${cells}</table>`;
}

function ctaButton(text: string, url: string): string {
  return `<p style="text-align:center;margin:28px 0 0;">
    <a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">${text}</a>
  </p>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0;" />`;
}

/* ── sendMail ──────────────────────────────────────────────────────────────── */
export const sendMail = async ({ to, subject, html }: SendMailParams): Promise<void> => {
  await emailTransporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html
  });
};

/* ── Submission confirmation ───────────────────────────────────────────────── */
export const sendSubmissionConfirmationEmail = async (
  authorEmail: string,
  authorName: string,
  submissionId: string
): Promise<void> => {
  const body = `
    ${greeting(authorName)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Thank you for submitting your manuscript to <strong>ScriptHive Publication</strong>. We have successfully received your submission and it is now queued for editorial pre-screening.
    </p>
    ${infoCard([
    ["Submission ID", submissionId],
    ["Status", "Received — Pending Review"],
    ["Next Step", "Editorial Pre-screening (1–3 days)"],
  ])}
    <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">
      Our editorial team will review your manuscript and you will receive an update within <strong>7–15 working days</strong>.
    </p>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#64748b;">Keep your Submission ID safe — you'll need it to track your paper's status.</p>
  `;
  await sendMail({
    to: authorEmail,
    subject: `✅ Submission Received — ${submissionId} | ScriptHive`,
    html: baseTemplate("Submission Received", `Your submission ${submissionId} has been received.`, body)
  });
};

/* ── Payment receipt ───────────────────────────────────────────────────────── */
export const sendPaymentReceiptEmail = async (
  to: string,
  invoiceId: string,
  amount: number,
  currency: string,
  transactionId: string
): Promise<void> => {
  const symbol = currency === "INR" ? "₹" : "$";
  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Your payment has been successfully processed. Below are your transaction details.
    </p>
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:36px;font-weight:800;color:#16a34a;">${symbol}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      ${badge("Payment Successful", "#16a34a", "#dcfce7")}
    </div>
    ${infoCard([
    ["Invoice ID", invoiceId],
    ["Amount Paid", `${currency} ${amount.toFixed(2)}`],
    ["Transaction ID", transactionId],
    ["Status", "Paid"],
  ])}
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">Please keep this receipt for your records. If you have questions, reply to this email with your Invoice ID.</p>
  `;
  await sendMail({
    to,
    subject: `🧾 Payment Receipt — ${invoiceId} | ScriptHive`,
    html: baseTemplate("Payment Receipt", `Payment of ${currency} ${amount.toFixed(2)} received for ${invoiceId}.`, body)
  });
};

/* ── Under review ──────────────────────────────────────────────────────────── */
export const sendUnderReviewEmail = async (
  authorEmail: string,
  authorName: string,
  title: string
): Promise<void> => {
  const body = `
    ${greeting(authorName)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      We are pleased to inform you that your manuscript has passed editorial pre-screening and has been sent out for <strong>double-blind peer review</strong>.
    </p>
    ${infoCard([
    ["Manuscript", title],
    ["Status", "Under Peer Review"],
    ["Review Type", "Double-Blind"],
    ["Expected Decision", "7–15 working days"],
  ])}
    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
      You will receive an email as soon as the editorial decision is made. Thank you for your patience.
    </p>
  `;
  await sendMail({
    to: authorEmail,
    subject: `🔍 Manuscript Under Review | ScriptHive`,
    html: baseTemplate("Under Review", `Your manuscript "${title}" is now under peer review.`, body)
  });
};

/* ── Accepted ──────────────────────────────────────────────────────────────── */
export const sendAcceptedEmail = async (
  authorEmail: string,
  authorName: string,
  title: string
): Promise<void> => {
  const body = `
    ${greeting(authorName)}
    <div style="text-align:center;margin:0 0 24px;">${badge("🎉 Accepted for Publication", "#16a34a", "#dcfce7")}</div>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Congratulations! We are delighted to inform you that your manuscript has been <strong>accepted for publication</strong> in a ScriptHive journal.
    </p>
    ${infoCard([
    ["Manuscript", title],
    ["Decision", "Accepted"],
    ["Next Step", "APC payment & production"],
  ])}
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      You will shortly receive instructions regarding the <strong>Article Processing Charge (APC)</strong> and the production process. Please complete the payment to proceed to publication.
    </p>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#64748b;">Thank you for choosing ScriptHive Publication for your research.</p>
  `;
  await sendMail({
    to: authorEmail,
    subject: `🎉 Manuscript Accepted — ${title} | ScriptHive`,
    html: baseTemplate("Manuscript Accepted", `Congratulations! Your manuscript has been accepted.`, body)
  });
};

/* ── Rejected ──────────────────────────────────────────────────────────────── */
export const sendRejectedEmail = async (
  authorEmail: string,
  authorName: string,
  title: string
): Promise<void> => {
  const body = `
    ${greeting(authorName)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Thank you for submitting your manuscript to ScriptHive Publication. After careful evaluation by our editorial board and peer reviewers, we regret to inform you that we are <strong>unable to accept</strong> your manuscript for publication in its current form.
    </p>
    ${infoCard([
    ["Manuscript", title],
    ["Decision", "Not Accepted"],
  ])}
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      This decision does not necessarily reflect the quality of your research. We encourage you to consider the reviewer feedback, revise your manuscript, and resubmit or consider other suitable journals.
    </p>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#64748b;">We appreciate your interest in ScriptHive and wish you success with your research.</p>
  `;
  await sendMail({
    to: authorEmail,
    subject: `Editorial Decision — ${title} | ScriptHive`,
    html: baseTemplate("Editorial Decision", `We have reached a decision on your manuscript.`, body)
  });
};

/* ── Payment link ──────────────────────────────────────────────────────────── */
export const sendPaymentLinkEmail = async (
  authorEmail: string,
  authorName: string,
  invoiceId: string,
  paymentUrl: string
): Promise<void> => {
  const body = `
    ${greeting(authorName)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Your manuscript has been accepted! Please complete your <strong>Article Processing Charge (APC)</strong> payment using the secure link below to proceed to publication.
    </p>
    ${infoCard([
    ["Invoice ID", invoiceId],
    ["Action Required", "Complete APC Payment"],
  ])}
    ${ctaButton("💳 Pay Now — Complete APC", paymentUrl)}
    ${divider()}
    <p style="margin:0;font-size:13px;color:#64748b;">This payment link is secure. If you did not expect this email, please contact us at <a href="mailto:support@scripthive.org" style="color:#2563eb;">support@scripthive.org</a>.</p>
  `;
  await sendMail({
    to: authorEmail,
    subject: `💳 APC Payment Required — ${invoiceId} | ScriptHive`,
    html: baseTemplate("Payment Required", `Complete your APC payment for invoice ${invoiceId}.`, body)
  });
};

/* ── DOI assigned ──────────────────────────────────────────────────────────── */
export const sendDoiAssignedEmail = async (
  authorEmail: string,
  authorName: string,
  title: string,
  doi: string
): Promise<void> => {
  const doiUrl = `https://doi.org/${doi}`;
  const body = `
    ${greeting(authorName)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      A <strong>Digital Object Identifier (DOI)</strong> has been successfully registered for your published manuscript.
    </p>
    ${infoCard([
    ["Manuscript", title],
    ["DOI", doi],
    ["DOI Link", `<a href="${doiUrl}" style="color:#2563eb;">${doiUrl}</a>`],
  ])}
    ${ctaButton("🔗 View Your Article via DOI", doiUrl)}
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;line-height:1.6;">
      You may now use this DOI when citing your article. The identifier is permanently registered and internationally recognised.
    </p>
  `;
  await sendMail({
    to: authorEmail,
    subject: `🔗 DOI Assigned — ${doi} | ScriptHive`,
    html: baseTemplate("DOI Assigned", `Your manuscript has been assigned DOI: ${doi}`, body)
  });
};

/* ── Article published ─────────────────────────────────────────────────────── */
export const sendArticlePublishedEmail = async (
  authorEmail: string,
  authorName: string,
  title: string,
  doiLink: string,
  journalName: string
): Promise<void> => {
  const body = `
    ${greeting(authorName)}
    <div style="text-align:center;margin:0 0 24px;">${badge("🌟 Now Published", "#2563eb", "#eff6ff")}</div>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Congratulations! Your manuscript has been <strong>officially published</strong>${journalName ? ` in <strong>${journalName}</strong>` : ""} and is now available online for the global research community.
    </p>
    ${infoCard([
    ["Manuscript", title],
    ["Journal", journalName || "ScriptHive Journal"],
    ["Status", "Published"],
    ...(doiLink ? [["DOI", `<a href="${doiLink}" style="color:#2563eb;">${doiLink}</a>`] as [string, string]] : []),
  ])}
    ${doiLink ? ctaButton("📖 View Published Article", doiLink) : ""}
    ${divider()}
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
      Share your published article with your network. Thank you for contributing to open-access research with ScriptHive.
    </p>
  `;
  await sendMail({
    to: authorEmail,
    subject: `🌟 Your Article is Published — ${title} | ScriptHive`,
    html: baseTemplate("Article Published", `Your article "${title}" is now published.`, body)
  });
};
