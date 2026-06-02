import { NextResponse } from "next/server";
import { INSTITUTIONAL_CONFIG } from "@/lib/googleSheets";

export async function POST(request: Request) {
  try {
    const { kpis, timestamp, source } = await request.json();

    if (!kpis || !Array.isArray(kpis)) {
      return NextResponse.json(
        { error: "Invalid KPI data provided" },
        { status: 400 }
      );
    }

    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6; padding: 30px; color: #1f2937;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); padding: 30px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">GACIIAS</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Institutional Intelligence Intelligence Report</p>
          </div>
          <div style="padding: 30px;">
            <p style="margin-top: 0; font-size: 16px; line-height: 1.5;">Hello Administrator,</p>
            <p style="font-size: 14px; line-height: 1.5; color: #4b5563;">
              Here is the live KPI compilation generated from the <strong>GACIIAS Dashboard</strong>.
            </p>
            
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 15px; margin: 20px 0; border: 1px solid #f3f4f6;">
              <table style="width: 100%; font-size: 13px; color: #6b7280;">
                <tr>
                  <td><strong>Report Timestamp:</strong></td>
                  <td style="text-align: right; color: #374151;">${timestamp || new Date().toLocaleString()}</td>
                </tr>
                <tr>
                  <td><strong>Data Source:</strong></td>
                  <td style="text-align: right; color: #374151; text-transform: uppercase; font-weight: bold;">${source}</td>
                </tr>
                <tr>
                  <td><strong>Receiver Account:</strong></td>
                  <td style="text-align: right; color: #374151;">${INSTITUTIONAL_CONFIG.mainAccount}</td>
                </tr>
              </table>
            </div>

            <h3 style="font-size: 16px; margin: 25px 0 10px 0; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px;">Key Performance Indicators (KPIs)</h3>
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
                    (kpi: any) => `
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
        subject: `GACIIAS Dashboard Report - ${timestamp || "Sync"}`,
        html: emailHtml
      })
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(resendData.message || "Failed to trigger Resend email API");
    }

    return NextResponse.json({
      success: true,
      message: "Report compiled and sent successfully via Resend",
      id: resendData.id
    });
  } catch (error) {
    console.error("Resend API Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error"
      },
      { status: 500 }
    );
  }
}
