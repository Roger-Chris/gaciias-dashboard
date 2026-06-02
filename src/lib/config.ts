// Shared configuration and interfaces to prevent bundling Node.js libraries (like googleapis) into Client Components

export const INSTITUTIONAL_CONFIG = {
  mainAccount: "maheswari.iias.dashboard@gmail.com",
  hostingAccount: "rogerchris190306@gmail.com",
  sheetId: "1vtClvnGG5gDcGN5hiQULXZWtKGqz9-7PdwXvy_jIJyA",
  resendApiToken: "re_hLAaniMw_JGHQqX228pGiTtEod8TMHLWE"
};

export interface DashboardKPI {
  module: string;
  count: number;
}

export interface DashboardData {
  kpis: DashboardKPI[];
  lastUpdated: string;
  timestamp: string;
  source: string;
  method: string;
}
