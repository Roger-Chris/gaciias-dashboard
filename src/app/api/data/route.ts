import { NextResponse } from "next/server";
import { getDashboardData, sendEmailReport } from "@/lib/googleSheets";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getDashboardData();

    // Local/Dev Automation Check: Send weekly report automatically every 7 days
    try {
      const dataDir = path.join(process.cwd(), "src", "data");
      const filePath = path.join(dataDir, "last-weekly-report.json");
      let shouldSend = false;
      let lastSentDate: Date | null = null;

      if (!fs.existsSync(filePath)) {
        shouldSend = true;
      } else {
        const fileContent = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(fileContent);
        if (parsed.lastSent) {
          lastSentDate = new Date(parsed.lastSent);
          const diffTime = Math.abs(new Date().getTime() - lastSentDate.getTime());
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          if (diffDays >= 7) {
            shouldSend = true;
          }
        } else {
          shouldSend = true;
        }
      }

      if (shouldSend) {
        console.log("Local weekly automation check triggered: it has been 7+ days or file is missing. Sending email...");
        // Fire email sending asynchronously in the background so we do not block client response
        (async () => {
          try {
            await sendEmailReport(data.kpis, data.lastUpdated, data.source, true);
            
            if (!fs.existsSync(dataDir)) {
              fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync(
              filePath,
              JSON.stringify({ lastSent: new Date().toISOString() }, null, 2),
              "utf8"
            );
            console.log("Weekly automated email sent successfully and last-weekly-report.json updated.");
          } catch (emailErr) {
            console.error("Failed to automatically send weekly report in background:", emailErr);
          }
        })();
      }
    } catch (automationErr) {
      // Catch silently so we don't break dashboard loading if file operations fail (e.g. read-only file systems)
      console.warn("Local automation check warning (non-fatal):", automationErr);
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Dashboard Data Fetch Route Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch spreadsheet data",
      },
      { status: 500 }
    );
  }
}
