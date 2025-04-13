// C:\Projects\Lalana\src\utils\debug.ts
export const debugLog = (message: string, data: any = {}) => {
  console.log(`[DEBUG ${new Date().toISOString()}] ${message}`, JSON.stringify(data, null, 2));
};