import { env } from "../config/env.js";
import { emailTransporter } from "../config/email.js";

interface SendMailParams {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
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
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Arial,sans-serif;">
<span style="display:none;font-size:1px;color:#eef2f7;max-height:0;overflow:hidden;">${preheader}</span>

<table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:40px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

  <!-- Top accent bar -->
  <tr>
    <td style="background:#1d4ed8;height:5px;font-size:0;line-height:0;">&nbsp;</td>
  </tr>

  <!-- Header -->
  <tr>
    <td style="background:#0f172a;padding:36px 48px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-right:12px;vertical-align:middle;">
                  <img src="https://scripthive.org/images/only%20Logo.png" alt="ScriptHive" width="40" height="40" style="display:block;object-fit:contain;" />
                </td>
                <td style="vertical-align:middle;">
                  <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.2;">ScriptHive Publication</div>
                  <div style="font-size:11px;color:#93c5fd;margin-top:5px;letter-spacing:2px;text-transform:uppercase;font-weight:600;">International Research Journals</div>
                </td>
              </tr>
            </table>
          </td>
          <td></td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Title bar -->
  <tr>
    <td style="background:#1d4ed8;padding:16px 48px;">
      <div style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">${title}</div>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="background:#ffffff;padding:44px 48px;border-left:1px solid #dde3ed;border-right:1px solid #dde3ed;">
      ${body}
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f1f5f9;border:1px solid #dde3ed;border-top:3px solid #1d4ed8;padding:28px 48px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:13px;font-weight:700;color:#0f172a;">ScriptHive Publication</div>
            <div style="font-size:12px;color:#64748b;margin-top:3px;">
              <a href="https://scripthive.org" style="color:#1d4ed8;text-decoration:none;">scripthive.org</a>
              &nbsp;·&nbsp;
              <a href="mailto:info@scripthive.org" style="color:#1d4ed8;text-decoration:none;">info@scripthive.org</a>
              &nbsp;·&nbsp;+91 9899916683
            </div>
          </td>
        </tr>
        <tr><td style="padding-top:14px;border-top:1px solid #e2e8f0;margin-top:14px;">
          <div style="font-size:11px;color:#94a3b8;">This is an automated email. If you did not expect this, please ignore it or contact us at <a href="mailto:info@scripthive.org" style="color:#94a3b8;">info@scripthive.org</a></div>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- Bottom accent -->
  <tr>
    <td style="background:#0f172a;height:4px;font-size:0;line-height:0;">&nbsp;</td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/* ── sendMail with optional attachments ────────────────────────────────────── */
interface Attachment { filename: string; content: Buffer; contentType?: string; }

/* ── Shared components ─────────────────────────────────────────────────────── */
function greeting(name: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;color:#374151;">Dear <strong>${name}</strong>,</p>`;
}

function badge(text: string, color: string, bg: string): string {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:11px;font-weight:800;padding:5px 14px;letter-spacing:1px;text-transform:uppercase;border-left:3px solid ${color};">${text}</span>`;
}

function infoCard(rows: [string, string][]): string {
  const cells = rows.map(([k, v], i) =>
    `<tr style="background:${i % 2 === 0 ? "#f8fafc" : "#ffffff"};">
      <td style="padding:11px 16px;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e8edf4;width:38%;border-right:1px solid #e8edf4;">${k}</td>
      <td style="padding:11px 16px;font-size:13px;color:#0f172a;font-weight:600;border-bottom:1px solid #e8edf4;">${v}</td>
    </tr>`
  ).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dde3ed;margin:24px 0;"><thead><tr><td colspan="2" style="background:#0f172a;padding:10px 16px;font-size:11px;font-weight:800;color:#93c5fd;letter-spacing:1.5px;text-transform:uppercase;">Details</td></tr></thead><tbody>${cells}</tbody></table>`;
}

function ctaButton(text: string, url: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0;">
    <tr><td align="center">
      <a href="${url}" style="display:inline-block;background:#1d4ed8;color:#ffffff;font-size:14px;font-weight:800;padding:16px 40px;text-decoration:none;letter-spacing:0.5px;text-transform:uppercase;border-bottom:3px solid #1e40af;">${text}</a>
    </td></tr>
  </table>`;
}

function divider(): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td style="border-top:2px solid #e8edf4;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

/* ── sendMail ──────────────────────────────────────────────────────────────── */
export const sendMail = async ({ to, subject, html, replyTo, attachments }: SendMailParams): Promise<void> => {
  await emailTransporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    html,
    ...(replyTo ? { replyTo } : {}),
    ...(attachments?.length ? { attachments } : {})
  });
};

/* ── Submission confirmation ───────────────────────────────────────────────── */
export const sendSubmissionConfirmationEmail = async (
  authorEmail: string,
  authorName: string,
  submissionId: string,
  journalName?: string
): Promise<void> => {
  const rows: [string, string][] = [
    ["Submission ID", submissionId],
    ...(journalName ? [["Journal", journalName] as [string, string]] : []),
    ["Status", "Received — Pending Review"],
    ["Next Step", "Editorial Pre-screening (1–3 days)"],
  ];
  const body = `
    ${greeting(authorName)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Thank you for submitting your manuscript to <strong>ScriptHive Publication</strong>. We have successfully received your submission and it is now queued for editorial pre-screening.
    </p>
    ${infoCard(rows)}
    <p style="margin:0 0 8px;font-size:14px;color:#374151;line-height:1.6;">
      Our editorial team will review your manuscript and you will receive an update within <strong>7–15 working days</strong>.
    </p>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#64748b;">Keep your Submission ID safe — you'll need it to track your paper's status.</p>
  `;
  await sendMail({
    to: authorEmail,
    subject: `✅ Submission Received — ${submissionId}`,
    html: baseTemplate("Submission Received", `Your submission ${submissionId} has been received.`, body)
  });
};

/* ── Payment receipt ───────────────────────────────────────────────────────── */
export const sendPaymentReceiptEmail = async (
  to: string,
  invoiceId: string,
  amount: number,
  currency: string,
  transactionId: string,
  submissionId?: string,
  journalName?: string,
  issn?: string | null,
  eIssn?: string | null
): Promise<void> => {
  const symbol = currency === "INR" ? "₹" : "$";
  const infoRows: [string, string][] = [
    ["Invoice ID", invoiceId],
  ];
  if (submissionId) {
    infoRows.push(["Submission ID", submissionId]);
  }
  if (journalName) {
    infoRows.push(["Journal", journalName]);
  }
  if (issn || eIssn) {
    const parts = [];
    if (issn) parts.push(`ISSN: ${issn}`);
    if (eIssn) parts.push(`e-ISSN: ${eIssn}`);
    infoRows.push(["ISSN", parts.join(" · ")]);
  }
  infoRows.push(["Amount Paid", `${currency} ${amount.toFixed(2)}`]);
  infoRows.push(["Transaction ID", transactionId]);
  infoRows.push(["Status", "Paid"]);

  const body = `
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Your payment has been successfully processed. Below are your transaction details.
    </p>
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:36px;font-weight:800;color:#16a34a;">${symbol}${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      ${badge("Payment Successful", "#16a34a", "#dcfce7")}
    </div>
    ${infoCard(infoRows)}
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">Please keep this receipt for your records. If you have questions, reply to this email with your Invoice ID.</p>
  `;
  await sendMail({
    to,
    subject: `🧾 Payment Receipt — ${invoiceId}`,
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
    subject: `🔍 Manuscript Under Review`,
    html: baseTemplate("Under Review", `Your manuscript "${title}" is now under peer review.`, body)
  });
};

/* ── Accepted ──────────────────────────────────────────────────────────────── */
export const sendAcceptedEmail = async (
  authorEmail: string,
  authorName: string,
  title: string,
  submissionId?: string,
  journalName?: string
): Promise<void> => {
  const infoRows: [string, string][] = [];
  if (submissionId) infoRows.push(["Submission ID", submissionId]);
  infoRows.push(["Manuscript Title", title]);
  if (journalName) infoRows.push(["Journal", journalName]);
  infoRows.push(["Decision", "Accepted"]);
  infoRows.push(["Next Step", "APC payment & production"]);

  const body = `
    ${greeting(authorName)}
    <div style="text-align:center;margin:0 0 24px;">${badge("🎉 Accepted for Publication", "#16a34a", "#dcfce7")}</div>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Congratulations! We are delighted to inform you that your manuscript has been <strong>accepted for publication</strong> in a ScriptHive journal.
    </p>
    ${infoCard(infoRows)}
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      You will shortly receive instructions regarding the <strong>Article Processing Charge (APC)</strong> and the production process. Please complete the payment to proceed to publication.
    </p>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#64748b;">Thank you for choosing ScriptHive Publication for your research.</p>
  `;
  await sendMail({
    to: authorEmail,
    subject: `🎉 Manuscript Accepted — ${submissionId ?? title}`,
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
    subject: `Editorial Decision — ${title}`,
    html: baseTemplate("Editorial Decision", `We have reached a decision on your manuscript.`, body)
  });
};

/* ── Payment link ──────────────────────────────────────────────────────────── */
export const sendPaymentLinkEmail = async (
  authorEmail: string,
  authorName: string,
  submissionId: string,
  paymentUrl: string,
  journalName?: string,
  issn?: string | null,
  eIssn?: string | null
): Promise<void> => {
  const infoRows: [string, string][] = [
    ["Submission ID", submissionId],
  ];
  if (journalName) {
    infoRows.push(["Journal", journalName]);
  }
  if (issn || eIssn) {
    const parts = [];
    if (issn) parts.push(`ISSN: ${issn}`);
    if (eIssn) parts.push(`e-ISSN: ${eIssn}`);
    infoRows.push(["ISSN", parts.join(" · ")]);
  }
  infoRows.push(["Action Required", "Complete APC Payment"]);

  const body = `
    ${greeting(authorName)}
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Your manuscript has been accepted! Please complete your <strong>Article Processing Charge (APC)</strong> payment using the secure link below to proceed to publication.
    </p>
    ${infoCard(infoRows)}
    ${ctaButton("💳 Pay Now — Complete APC", paymentUrl)}
    ${divider()}
    <p style="margin:0;font-size:13px;color:#64748b;">This payment link is secure. If you did not expect this email, please contact us at <a href="mailto:support@scripthive.org" style="color:#2563eb;">support@scripthive.org</a>.</p>
  `;
  await sendMail({
    to: authorEmail,
    subject: `💳 APC Payment Required — ${submissionId}`,
    html: baseTemplate("Payment Required", `Complete your APC payment for submission ${submissionId}.`, body)
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
    subject: `🔗 DOI Assigned — ${doi}`,
    html: baseTemplate("DOI Assigned", `Your manuscript has been assigned DOI: ${doi}`, body)
  });
};

/* ── Article published ─────────────────────────────────────────────────────── */
export const sendArticlePublishedEmail = async (
  authorEmail: string,
  authorName: string,
  title: string,
  doiLink: string,
  journalName: string,
  articlePageUrl?: string,
  certData?: {
    volume: string;
    issue: string;
    pubDate: string;
    issn: string;
    certId: string;
  }
): Promise<void> => {
  const viewUrl = articlePageUrl || doiLink;
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
    ${viewUrl ? ctaButton("📖 View Published Article", viewUrl) : ""}
    ${divider()}
    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
      Share your published article with your network. Thank you for contributing to open-access research with ScriptHive.
    </p>
  `;
  // Generate certificate PDF if data provided
  let certPdf: Buffer | null = null;
  if (certData) {
    try {
      const { generateCertificatePdf } = await import("./certificate.service.js");
      certPdf = await generateCertificatePdf({
        authorName,
        paperTitle: title,
        journalName,
        volume: certData.volume,
        issue: certData.issue,
        pubDate: certData.pubDate,
        issn: certData.issn,
        certId: certData.certId
      });
    } catch (e) {
      console.warn("[Certificate] PDF generation failed:", e instanceof Error ? e.message : e);
    }
  }

  await sendMail({
    to: authorEmail,
    subject: `🌟 Your Article is Published — ${title}`,
    html: baseTemplate("Article Published", `Your article "${title}" is now published.`, body),
    ...(certPdf ? { attachments: [{ filename: "Publication_Certificate.pdf", content: certPdf, contentType: "application/pdf" }] } : {})
  });
};

/* ── Article published — send to ALL authors, each gets own certificate ─────── */
export const sendArticlePublishedEmailToAllAuthors = async (
  authors: { name: string; email: string }[],
  title: string,
  doiLink: string,
  journalName: string,
  articlePageUrl?: string,
  certBase?: {
    volume: string;
    issue: string;
    pubDate: string;
    issn: string;
    baseCertId: string;
  }
): Promise<void> => {
  const viewUrl = articlePageUrl || doiLink;

  for (let i = 0; i < authors.length; i++) {
    const author = authors[i]!;
    if (!author.email) continue;

    const certId = certBase
      ? (i === 0 ? certBase.baseCertId : `${certBase.baseCertId}-${i}`)
      : undefined;

    const body = `
      ${greeting(author.name)}
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
      ${viewUrl ? ctaButton("📖 View Published Article", viewUrl) : ""}
      ${divider()}
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
        Share your published article with your network. Thank you for contributing to open-access research with ScriptHive.
      </p>
    `;

    let certPdf: Buffer | null = null;
    if (certBase && certId) {
      try {
        const { generateCertificatePdf } = await import("./certificate.service.js");
        certPdf = await generateCertificatePdf({
          authorName: author.name,
          paperTitle: title,
          journalName,
          volume: certBase.volume,
          issue: certBase.issue,
          pubDate: certBase.pubDate,
          issn: certBase.issn,
          certId
        });
      } catch (e) {
        console.warn("[Certificate] PDF generation failed for", author.name, ":", e instanceof Error ? e.message : e);
      }
    }

    await sendMail({
      to: author.email,
      subject: `🌟 Your Article is Published — ${title}`,
      html: baseTemplate("Article Published", `Your article "${title}" is now published.`, body),
      ...(certPdf ? { attachments: [{ filename: `Publication_Certificate_${author.name.replace(/\s+/g, "_")}.pdf`, content: certPdf, contentType: "application/pdf" }] } : {})
    });
  }
};
