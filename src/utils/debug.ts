// C:\Users\gugul\Downloads\SOUND-CRAFT-USING-NLP-WITH-FOURIER-TRANFORM-ALGORITHM-main\src\utils\debug.ts
export const debugLog = (message: string, data: Record<string, any> = {}) => {
  const timestamp = new Date().toISOString();
  const formattedData: Record<string, any> = {};
  
  for (const _ in data) {
    formattedData[_] = typeof data[_] === 'object' && data[_] !== null
      ? JSON.stringify(data[_], (k, v) => {
          if (v instanceof Float32Array) {
            return `Float32Array(length=${v.length})`;
          }
          if (v instanceof HTMLDivElement) {
            return 'HTMLDivElement';
          }
          return v;
        }, 2)
      : data[_];
  }

  console.log(`[DEBUG ${timestamp}] ${message}`, formattedData);
};
