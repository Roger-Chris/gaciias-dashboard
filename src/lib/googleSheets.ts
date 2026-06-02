"use server";

import { google } from "googleapis";
import { INSTITUTIONAL_CONFIG, DashboardKPI, DashboardData } from "./config";

interface VizCell {
  v?: unknown;
  f?: string;
}

interface VizRow {
  c?: (VizCell | null)[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const SHEET_ID = INSTITUTIONAL_CONFIG.sheetId;

  // 1. Try Google Sheets API with Service Account (if configured)
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (serviceAccountEmail && privateKey) {
    try {
      console.log("Attempting to fetch Google Sheet via Service Account API...");
      const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");
      const auth = new google.auth.JWT({
        email: serviceAccountEmail,
        key: formattedPrivateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
      });

      const sheets = google.sheets({ version: "v4", auth });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: "A:B",
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        throw new Error("No data rows returned from Google Sheets API.");
      }

      let lastUpdated = "";
      const kpis: DashboardKPI[] = rows
        .map((row: unknown) => {
          if (!Array.isArray(row)) return null;
          const moduleName = row[0];
          const countValue = row[1];

          if (moduleName !== undefined && countValue !== undefined) {
            const cleanModule = String(moduleName).trim();
            // Skip header rows
            if (cleanModule.toLowerCase() === "module" || cleanModule.toLowerCase() === "kpi") {
              return null;
            }
            if (cleanModule.toLowerCase() === "last updated") {
              lastUpdated = String(countValue).trim();
              return null;
            }
            return {
              module: cleanModule,
              count: typeof countValue === "number" ? countValue : parseInt(String(countValue), 10) || 0,
            };
          }
          return null;
        })
        .filter((item: DashboardKPI | null): item is DashboardKPI => item !== null);

      if (kpis.length === 0) {
        throw new Error("No valid KPI records parsed from service account sheets fetch.");
      }

      return {
        kpis,
        lastUpdated: lastUpdated || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
        source: "sheet",
        method: "service-account",
      };
    } catch (apiError: unknown) {
      const errMsg = apiError instanceof Error ? apiError.message : String(apiError);
      console.error("Google Sheets API service account fetch failed:", errMsg);
      // Fallback to public visualization API
    }
  }

  // 2. Fall back to public Visualization endpoint
  console.log("Attempting to fetch Google Sheet via Public Visualization API...");
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  });

  if (!res.ok) {
    throw new Error(`Google Sheets Visualization fetch failed with status: ${res.status}`);
  }

  const text = await res.text();

  if (text.includes("ServiceLogin") || text.includes("accounts.google.com")) {
    throw new Error("Access denied (spreadsheet is private / login required).");
  }

  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*?)\);/);
  if (!match) {
    throw new Error("Could not parse Google Sheets visualization response format.");
  }

  const jsonString = match[1];
  const data = JSON.parse(jsonString);

  if (!data.table || !data.table.rows) {
    throw new Error("Invalid table format in Google Sheets visualization data.");
  }

  const rows = data.table.rows;
  let lastUpdated = "";
  const kpis: DashboardKPI[] = (rows as VizRow[])
    .map((row) => {
      const moduleName = row.c?.[0]?.v;
      const countValue = row.c?.[1]?.v;
      const formattedValue = row.c?.[1]?.f;

      if (moduleName !== undefined && countValue !== undefined) {
        const cleanModule = String(moduleName).trim();
        if (cleanModule.toLowerCase() === "module" || cleanModule.toLowerCase() === "kpi") {
          return null;
        }
        if (cleanModule.toLowerCase() === "last updated") {
          lastUpdated = formattedValue || String(countValue).trim();
          return null;
        }
        return {
          module: cleanModule,
          count: typeof countValue === "number" ? countValue : parseInt(String(countValue), 10) || 0,
        };
      }
      return null;
    })
    .filter((item: DashboardKPI | null): item is DashboardKPI => item !== null);

  if (kpis.length === 0) {
    throw new Error("No data records found in public sheet.");
  }

  return {
    kpis,
    lastUpdated: lastUpdated || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    timestamp: new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
    source: "sheet",
    method: "visualization-api",
  };
}

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
