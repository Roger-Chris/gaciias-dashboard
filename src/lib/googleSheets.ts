export async function fetchMasterKPI() {
  const url = 'https://docs.google.com/spreadsheets/d/1vtClvnGG5gDcGN5hiQULXZWtKGqz9-7PdwXvy_jIJyA/gviz/tq?tqx=out:json';
  
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();
    
    // Strip the Google Visualization API wrapper
    const jsonString = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\)/)?.[1];
    if (!jsonString) throw new Error('Invalid response format');
    
    const rawData = JSON.parse(jsonString);
    const rows = rawData.table.rows;
    
    // Map rows to a usable object
    const kpiData: Record<string, string | number> = {};
    rows.forEach((row: any) => {
      if (row.c[0]?.v && row.c[1]?.v !== undefined) {
        kpiData[row.c[0].v] = row.c[1].v;
      }
    });
    
    return kpiData;
  } catch (error) {
    console.error('Failed to fetch KPI data:', error);
    return null;
  }
}
