const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, 'usage_history.csv');

if (!fs.existsSync(CSV_PATH)) {
  const headers = 'date,bytes_downloaded,bytes_uploaded,total_bytes,week_num,month_num\n';
  fs.writeFileSync(CSV_PATH, headers, 'utf8');
}

const csvEngine = {
  saveEntry: (dateIn, totalBytes) => {
    // Strips any potential trailing timestamp markers safely
    const dateStr = String(dateIn).split(',')[0].trim();
    const dateObj = new Date(dateStr + "T00:00:00");
    
    const startOfYear = new Date(dateObj.getFullYear(), 0, 1);
    const pastDaysOfYear = (dateObj - startOfYear) / 86400000;
    const weekNum = String(Math.floor((pastDaysOfYear + startOfYear.getDay() + 1) / 7)).padStart(2, '0');
    const monthNum = String(dateObj.getMonth() + 1).padStart(2, '0');

    let fileLines = fs.readFileSync(CSV_PATH, 'utf8').split('\n').filter(line => line.trim() !== '');
    const headers = fileLines.shift();

    fileLines = fileLines.filter(line => line.split(',')[0] !== dateStr);

    const newRow = `${dateStr},${totalBytes},0,${totalBytes},${weekNum},${monthNum}`;
    fileLines.push(newRow);
    fileLines.sort((a, b) => b.split(',')[0].localeCompare(a.split(',')[0]));

    fs.writeFileSync(CSV_PATH, [headers, ...fileLines].join('\n') + '\n', 'utf8');
  },

  readAll: () => {
    if (!fs.existsSync(CSV_PATH)) return [];
    const fileLines = fs.readFileSync(CSV_PATH, 'utf8').split('\n').filter(line => line.trim() !== '');
    fileLines.shift();

    return fileLines.map(line => {
      const columns = line.split(',');
      return {
        date: String(columns[0]).trim(),
        bytes_downloaded: parseInt(columns[1] || '0', 10),
        bytes_uploaded: parseInt(columns[2] || '0', 10),
        total_bytes: parseInt(columns[3] || '0', 10),
        week_num: String(columns[4] || '00').trim(),
        month_num: String(columns[5] || '00').trim()
      };
    });
  }
};

module.exports = csvEngine;
