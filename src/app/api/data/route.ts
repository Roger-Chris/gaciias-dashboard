import { NextResponse } from "next/server";
import { google } from "googleapis";
import { INSTITUTIONAL_CONFIG, DashboardKPI } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

export async function GET() {
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

      const kpis: DashboardKPI[] = rows
        .map((row: any) => {
          const moduleName = row[0];
          const countValue = row[1];

          if (moduleName !== undefined && countValue !== undefined) {
            const cleanModule = String(moduleName).trim();
            // Skip header rows
            if (cleanModule.toLowerCase() === "module" || cleanModule.toLowerCase() === "kpi") {
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

      return NextResponse.json({
        kpis,
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
        source: "sheet",
        method: "service-account",
      });
    } catch (apiError: any) {
      console.error("Google Sheets API service account fetch failed:", apiError.message);
      // Let it fall back to the public visualization API if service account fails
    }
  }

  // 2. Fall back to public Visualization endpoint
  try {
    console.log("Attempting to fetch Google Sheet via Public Visualization API...");
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

    const res = await fetch(url, {
      cache: "no-store", // Force no cache for live data updates
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
    const kpis: DashboardKPI[] = rows
      .map((row: any) => {
        const moduleName = row.c?.[0]?.v;
        const countValue = row.c?.[1]?.v;

        if (moduleName !== undefined && countValue !== undefined) {
          const cleanModule = String(moduleName).trim();
          if (cleanModule.toLowerCase() === "module" || cleanModule.toLowerCase() === "kpi") {
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

    return NextResponse.json({
      kpis,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
      source: "sheet",
      method: "visualization-api",
    });
  } catch (error: any) {
    console.error("Public visualization endpoint failed:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch spreadsheet data",
        isPrivate: error.message.includes("Access denied") || error.message.includes("401") || error.message.includes("ServiceLogin"),
      },
      { status: 500 }
    );
  }
}
