import { fetchMasterKPI } from "./googleSheets";
import { DashboardData, DashboardKPI } from "./config";

export async function getDashboardData(): Promise<DashboardData | null> {
  const kpiData = await fetchMasterKPI();
  if (!kpiData) return null;

  let lastUpdated = "";
  const kpis: DashboardKPI[] = Object.entries(kpiData)
    .filter(([key]) => {
      const cleanKey = key.trim().toLowerCase();
      if (cleanKey === "module" || cleanKey === "kpi") return false;
      if (cleanKey === "last updated") {
        lastUpdated = String(kpiData[key]).trim();
        return false;
      }
      return true;
    })
    .map(([key, val]) => ({
      module: key.trim(),
      count: typeof val === "number" ? val : parseInt(String(val), 10) || 0
    }));

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
    method: "visualization-api"
  };
}
