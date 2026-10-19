const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, 'usage_history.csv');

// Initialize the CSV file with clean spreadsheet headers if it doesn't exist yet
if (!fs.existsSync(CSV_PATH)) {
  const headers = 'date,bytes_downloaded,bytes_uploaded,total_bytes,week_num,month_num\n';
  fs.writeFileSync(CSV_PATH, headers, 'utf8');
  console.log('📝 Created brand new usage_history.csv file with headers!');
}

const csvEngine = {
  // Save or overwrite a daily log entry inside the spreadsheet rows
  saveEntry: (dateStr, totalBytes) => {
    const dateObj = new Date(dateStr);
    
    // Generate ISO Week Number matching strftime('%W')
    const startOfYear = new Date(dateObj.getFullYear(), 0, 1);
    const pastDaysOfYear = (dateObj - startOfYear) / 86400000;
    const weekNum = String(Math.floor((pastDaysOfYear + startOfYear.getDay() + 1) / 7)).padStart(2, '0');
    
    // Generate Month Number matching strftime('%m') (01-12)
    const monthNum = String(dateObj.getMonth() + 1).padStart(2, '0');

    // Read existing dataset rows to handle potential overwrites for matching dates
    let fileLines = fs.readFileSync(CSV_PATH, 'utf8').split('\n').filter(line => line.trim() !== '');
    const headers = fileLines.shift(); // Remove column layout line

    // Filter out previous entries matching today's exact date string to mimic INSERT OR REPLACE
    fileLines = fileLines.filter(line => {
      const currentLineDate = line.split(',')[0];
      return currentLineDate !== dateStr;
    });

    // Structure our clean comma-separated values row entry array format
    const newRow = `${dateStr},${totalBytes},0,${totalBytes},${weekNum},${monthNum}`;
    fileLines.push(newRow);

    // Sort logs descending by date matching our old SQLite behavior (newest entries at top)
    fileLines.sort((a, b) => b.split(',')[0].localeCompare(a.split(',')[0]));

    // Write back out to the master flat document
    fs.writeFileSync(CSV_PATH, [headers, ...fileLines].join('\n') + '\n', 'utf8');
  },

  // Read dataset rows and re-parse them back into plain JavaScript Objects for ChartJS metrics
  readAll: () => {
    if (!fs.existsSync(CSV_PATH)) return [];
    
    const fileLines = fs.readFileSync(CSV_PATH, 'utf8').split('\n').filter(line => line.trim() !== '');
    fileLines.shift(); // Skip the header line

    return fileLines.map(line => {
      const columns = line.split(',');
      return {
        date: columns[0],
        bytes_downloaded: parseInt(columns[1] || '0', 10),
        bytes_uploaded: parseInt(columns[2] || '0', 10),
        total_bytes: parseInt(columns[3] || '0', 10),
        week_num: columns[4],
        month_num: columns[5]
      };
    });
  }
};

module.exports = csvEngine;

