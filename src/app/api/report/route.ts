import { NextResponse } from "next/server";
import { sendEmailReport } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { kpis, timestamp, source } = await request.json();

    if (!kpis || !Array.isArray(kpis)) {
      return NextResponse.json(
        { error: "Invalid KPI data provided" },
        { status: 400 }
      );
    }

    // Call the shared email report sender (isWeekly = false for instant/manual trigger)
    const emailResult = await sendEmailReport(kpis, timestamp, source, false);

    return NextResponse.json({
      success: true,
      message: "Report compiled and sent successfully via Resend",
      id: emailResult.id
    });
  } catch (error: unknown) {
    console.error("Resend API Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error"
      },
      { status: 500 }
    );
  }
}
