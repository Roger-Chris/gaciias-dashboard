import { INSTITUTIONAL_CONFIG, DashboardKPI } from "./config";

export async function sendEmailReport(
  kpis: DashboardKPI[],
  lastUpdated: string,
  source: string,
  isWeekly: boolean = false
) {
  const getKpiValue = (moduleName: string, defaultVal: number): number => {
    const cleanKey = (str: string) => str.replace(/[\u2014\u2013-]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
    const target = cleanKey(moduleName);
    const matched = kpis.find(
      (k) => cleanKey(k.module) === target
    );
    return matched ? matched.count : defaultVal;
  };

  const activeMoUs = getKpiValue("MoUs — Active", 0);
  const expiringMoUs = getKpiValue("MoUs — Expiring in 60 Days", 0);
  const publications = getKpiValue("Publications (Total)", 0);

  const currentLocalTime = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " (IST)";

  const titleText = isWeekly ? "Weekly Institutional Digest" : "Instant Intelligence Report";
  const bgHeaderGrad = isWeekly 
    ? "linear-gradient(135deg, #1e1b4b 0%, #311042 100%)"
    : "linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)";

  const alertBlock = expiringMoUs > 0 
    ? `
      <div style="background-color: #fffbeb; border-radius: 8px; padding: 15px; margin: 20px 0; border: 1px solid #fef3c7; color: #b45309;">
        <h4 style="margin: 0 0 5px 0; font-size: 14px; font-weight: 700;">⚠️ MoU Expiration Warning</h4>
        <p style="margin: 0; font-size: 13px; line-height: 1.4;">
          There are <strong>${expiringMoUs} MoU(s)</strong> expiring in the next 60 days. Please review renewal pipelines.
        </p>
      </div>
    `
    : "";

  const emailHtml = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6; padding: 30px; color: #1f2937;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
        <div style="background: ${bgHeaderGrad}; padding: 35px 30px; text-align: center; color: #ffffff;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.025em;">GACIIAS</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px; text-transform: uppercase; tracking-widest: 1px;">
            ${titleText}
          </p>
        </div>
        <div style="padding: 30px;">
          <p style="margin-top: 0; font-size: 16px; line-height: 1.5;">Hello Administrator,</p>
          <p style="font-size: 14px; line-height: 1.5; color: #4b5563;">
            Here is the compilation of institutional performance indicators, generated from the <strong>GACIIAS Dashboard</strong>.
          </p>
          
          ${alertBlock}

          <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px; margin: 20px 0; border: 1px solid #f3f4f6;">
            <table style="width: 100%; font-size: 13px; color: #6b7280;">
              <tr>
                <td style="padding: 4px 0;"><strong>Data Last Updated:</strong></td>
                <td style="text-align: right; color: #111827; font-weight: 600;">${lastUpdated}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;"><strong>Report Sent At:</strong></td>
                <td style="text-align: right; color: #374151;">${currentLocalTime}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;"><strong>Data Source:</strong></td>
                <td style="text-align: right; color: #374151; text-transform: uppercase; font-weight: bold;">${source}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0;"><strong>Receiver Account:</strong></td>
                <td style="text-align: right; color: #374151;">${INSTITUTIONAL_CONFIG.mainAccount}</td>
              </tr>
            </table>
          </div>

          <h3 style="font-size: 16px; margin: 25px 0 10px 0; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px; color: #1e1b4b;">Key Highlights</h3>
          <table style="width: 100%; margin-bottom: 20px; font-size: 14px;">
            <tr>
              <td style="width: 50%; padding: 5px 5px 5px 0;">
                <div style="background: #f8fafc; border: 1px solid #f1f5f9; padding: 12px; border-radius: 8px;">
                  <span style="font-size: 11px; text-transform: uppercase; color: #64748b; display: block;">Active MoUs</span>
                  <strong style="font-size: 18px; color: #4f46e5;">${activeMoUs}</strong>
                </div>
              </td>
              <td style="width: 50%; padding: 5px 0 5px 5px;">
                <div style="background: #f8fafc; border: 1px solid #f1f5f9; padding: 12px; border-radius: 8px;">
                  <span style="font-size: 11px; text-transform: uppercase; color: #64748b; display: block;">Total Publications</span>
                  <strong style="font-size: 18px; color: #0284c7;">${publications}</strong>
                </div>
              </td>
            </tr>
          </table>

          <h3 style="font-size: 16px; margin: 25px 0 10px 0; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px; color: #1e1b4b;">Full Performance Metrics</h3>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
              <tr style="border-bottom: 1px solid #e5e7eb; color: #374151;">
                <th style="padding: 10px 5px; font-weight: 600;">Module</th>
                <th style="padding: 10px 5px; text-align: right; font-weight: 600;">Count</th>
              </tr>
            </thead>
            <tbody>
              ${kpis
                .map(
                  (kpi) => `
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 10px 5px; color: #4b5563;">${kpi.module}</td>
                  <td style="padding: 10px 5px; text-align: right; font-weight: 600; color: #111827;">${kpi.count}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          
          <div style="margin-top: 35px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
            Sent automatically from GACIIAS Dashboard.<br />
            Hosting & GitHub: ${INSTITUTIONAL_CONFIG.hostingAccount}
          </div>
        </div>
      </div>
    </div>
  `;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${INSTITUTIONAL_CONFIG.resendApiToken}`
    },
    body: JSON.stringify({
      from: "GACIIAS Dashboard <onboarding@resend.dev>",
      to: INSTITUTIONAL_CONFIG.mainAccount,
      subject: `GACIIAS ${isWeekly ? "Weekly" : "Manual"} Report - ${lastUpdated}`,
      html: emailHtml
    })
  });

  const resendData = await resendResponse.json();

  if (!resendResponse.ok) {
    throw new Error(resendData.message || "Failed to trigger Resend email API");
  }

  return resendData;
}
