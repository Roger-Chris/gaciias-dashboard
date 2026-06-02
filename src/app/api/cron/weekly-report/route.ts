import { NextResponse } from "next/server";
import { getDashboardData, sendEmailReport } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Basic security verification for production using Vercel CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const isProduction = process.env.NODE_ENV === "production";
    const cronSecret = process.env.CRON_SECRET;

    if (isProduction && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized access to Cron trigger" },
        { status: 401 }
      );
    }

    console.log("Weekly cron job triggered. Fetching dashboard data...");
    const data = await getDashboardData();

    console.log("Sending weekly email report to Director...");
    const emailResult = await sendEmailReport(data.kpis, data.lastUpdated, data.source, true);

    return NextResponse.json({
      success: true,
      message: "Weekly report compiled and sent successfully via Resend",
      id: emailResult.id,
      lastUpdated: data.lastUpdated
    });
  } catch (error: unknown) {
    console.error("Cron Weekly Report Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error"
      },
      { status: 500 }
    );
  }
}
