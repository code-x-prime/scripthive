// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — puppeteer installed on server, not in local dev
import puppeteer from "puppeteer";

interface CertificateData {
  authorName: string;
  paperTitle: string;
  journalName: string;
  volume: string;
  issue: string;
  pubDate: string;
  issn: string;
  certId: string;
}

function buildCertificateHtml(d: CertificateData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>ScriptHive Publication Certificate</title>
<style>
@page{size:A4 landscape;margin:0;}
*{box-sizing:border-box;}
body{margin:0;padding:0;background:#ffffff;font-family:"Georgia","Times New Roman",serif;color:#17233c;}
.certificate-wrapper{width:297mm;height:210mm;background:#ffffff;position:relative;overflow:hidden;padding:18mm;border:2mm solid #102a56;}
.certificate-wrapper::before{content:"";position:absolute;inset:8mm;border:1.2mm solid #c89b3c;pointer-events:none;}
.corner{position:absolute;width:42mm;height:42mm;border-color:#c89b3c;z-index:2;}
.corner.top-left{top:10mm;left:10mm;border-top:2px solid #c89b3c;border-left:2px solid #c89b3c;}
.corner.top-right{top:10mm;right:10mm;border-top:2px solid #c89b3c;border-right:2px solid #c89b3c;}
.corner.bottom-left{bottom:10mm;left:10mm;border-bottom:2px solid #c89b3c;border-left:2px solid #c89b3c;}
.corner.bottom-right{bottom:10mm;right:10mm;border-bottom:2px solid #c89b3c;border-right:2px solid #c89b3c;}
.content{position:relative;z-index:3;text-align:center;height:100%;display:flex;flex-direction:column;justify-content:space-between;}
.brand{font-size:34px;font-family:"Lucida Calligraphy",cursive;font-weight:normal;letter-spacing:1px;color:#102a56;margin-bottom:6px;}
.brand-subtitle{font-size:14px;letter-spacing:1px;color:#6a6f7b;text-transform:uppercase;}
.certificate-title{margin-top:12px;font-size:44px;color:#102a56;font-weight:bold;text-transform:uppercase;letter-spacing:3px;}
.gold-line{width:140mm;height:2px;background:linear-gradient(to right,transparent,#c89b3c,transparent);margin:8px auto 0;}
.presented-text{font-size:18px;margin-top:12px;color:#333b4f;text-transform:uppercase;letter-spacing:1px;}
.author-name{font-size:36px;font-weight:700;color:#0f1f45;margin:10px 0 14px;font-family:"Palatino Linotype",serif;letter-spacing:1px;text-transform:capitalize;}
.main-text{width:88%;margin:0 auto;font-size:17px;line-height:1.55;color:#24324a;}
.paper-title{margin:14px auto;width:86%;font-size:24px;font-weight:700;color:#102a56;line-height:1.45;font-family:"Palatino Linotype",serif;letter-spacing:0.5px;font-style:italic;}
.journal-name{font-size:18px;font-weight:bold;color:#1f3b73;margin-top:6px;}
.details-grid{width:86%;margin:14px auto 0;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-family:Arial,sans-serif;}
.detail-box{border:1px solid #d6c08b;padding:8px 6px;background:rgba(248,246,239,0.75);border-radius:6px;}
.detail-label{font-size:10px;text-transform:uppercase;color:#6b7280;letter-spacing:0.7px;margin-bottom:4px;}
.detail-value{font-size:13px;font-weight:bold;color:#17233c;}
.verification-text{width:82%;margin:12px auto 0;font-size:14px;line-height:1.45;color:#4b5563;}
.footer{display:grid;grid-template-columns:1fr 120px 1fr;align-items:end;gap:20px;margin-top:10px;}
.signature-block{text-align:center;font-family:Arial,sans-serif;}
.signature-line{border-top:1.5px solid #102a56;width:68%;margin:0 auto 6px;height:1px;}
.signature-title{font-size:13px;font-weight:bold;color:#102a56;}
.signature-subtitle{font-size:12px;color:#6b7280;margin-top:2px;}
.seal{width:96px;height:96px;border-radius:50%;border:3px double #c89b3c;display:flex;align-items:center;justify-content:center;margin:0 auto;color:#102a56;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;text-align:center;text-transform:uppercase;background:radial-gradient(circle,#fff9ea 0%,#ffffff 70%);}
.website{position:absolute;bottom:9mm;left:0;right:0;text-align:center;font-family:Arial,sans-serif;font-size:12px;color:#6b7280;z-index:4;}
.certificate-wrapper::after{content:"";position:absolute;inset:0;pointer-events:none;z-index:1;opacity:0.08;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='90'%3E%3Ctext x='5' y='55' transform='rotate(-35 70 45)' fill='black' font-size='18' font-family='Arial' font-weight='bold'%3EScriptHive Publication%3C/text%3E%3C/svg%3E");background-repeat:repeat;background-size:140px 90px;}
</style>
</head>
<body>
<div class="certificate-wrapper">
  <div class="corner top-left"></div>
  <div class="corner top-right"></div>
  <div class="corner bottom-left"></div>
  <div class="corner bottom-right"></div>
  <div class="content">
    <div class="top-header">
      <div class="brand">ScriptHive Publication</div>
      <div class="brand-subtitle">Peer-Reviewed Academic Publishing Platform</div>
      <div class="certificate-title">Certificate of Publication</div>
      <div class="gold-line"></div>
    </div>
    <div class="middle-section">
      <div class="presented-text">This certificate is proudly presented to</div>
      <div class="author-name">${d.authorName}</div>
      <div class="main-text">In recognition of the successful publication of the research manuscript entitled</div>
      <div class="paper-title">&ldquo;${d.paperTitle}&rdquo;</div>
      <div class="main-text">published in</div>
      <div class="journal-name">${d.journalName}</div>
      <div class="details-grid">
        <div class="detail-box"><div class="detail-label">Volume / Issue</div><div class="detail-value">${d.volume}</div></div>
        <div class="detail-box"><div class="detail-label">Publication Date</div><div class="detail-value">${d.pubDate}</div></div>
        <div class="detail-box"><div class="detail-label">ISSN</div><div class="detail-value">${d.issn || "XXXX-XXXX"}</div></div>
        <div class="detail-box"><div class="detail-label">Certificate ID</div><div class="detail-value">${d.certId}</div></div>
      </div>
      <div class="verification-text">
        The above-mentioned manuscript has been reviewed and accepted for publication through the journal's formal
        double-blind peer review process in accordance with the editorial policies and academic standards of
        ScriptHive Publication.
      </div>
    </div>
    <div class="footer">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-title">Editor-in-Chief</div>
        <div class="signature-subtitle">ScriptHive Publication</div>
      </div>
      <div class="seal">Official<br/>Publication<br/>Certificate</div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-title">Publisher</div>
        <div class="signature-subtitle">ScriptHive Publication</div>
      </div>
    </div>
  </div>
  <div class="website">www.scripthive.org | Certificate issued for academic publication record</div>
</div>
</body>
</html>`;
}

export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
  try {
    const page = await browser.newPage();
    await page.setContent(buildCertificateHtml(data), { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" }
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
