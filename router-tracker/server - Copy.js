const express = require('express');
const cors = require('cors');
const cron = require('cron');
const csvEngine = require('./csvEngine');
const scrapeRouterData = require('./scraper');

require('dotenv').config({ path: './login.env' });

const app = express();
app.use(cors());
app.use(express.json());
app.set('view engine', 'ejs'); 

app.use('/js/chart.js', express.static(__dirname + '/node_modules/chart.js/dist/chart.umd.js'));
app.use('/js/chartjs-plugin-annotation.js', express.static(__dirname + '/node_modules/chartjs-plugin-annotation/dist/chartjs-plugin-annotation.min.js'));

function getDaysArray(start, end) {
  const arr = [];
  const dt = new Date(start);
  const endDt = new Date(end);
  while (dt <= endDt) {
    const isoString = new Date(dt).toISOString();
    const cleanDateOnly = isoString.split('T')[0];
    arr.push(cleanDateOnly);
    dt.setDate(dt.getDate() + 1);
  }
  return arr;
}

function getWeekNumber(dateStr) {
  try {
    const dateObj = new Date(dateStr + "T00:00:00");
    const startOfYear = new Date(dateObj.getFullYear(), 0, 1);
    const pastDaysOfYear = (dateObj - startOfYear) / 86400000;
    return String(Math.floor((pastDaysOfYear + startOfYear.getDay() + 1) / 7)).padStart(2, '0');
  } catch(e) {
    return "00";
  }
}

// 🛠️ NEW HELPER: Translates "YYYY-MM-DD" into "DD-MMM-YY" (e.g., "17-Oct-26")
function formatToDdMmmYy(dateStr) {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    
    const yearShort = parts[0].substring(2); // Extracts "26" from "2026"
    const day = parts[2];
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const monthText = months[monthIndex] || "Jan";
    
    return `${day}-${monthText}-${yearShort}`;
  } catch (e) {
    return dateStr;
  }
}

app.get('/api/usage', (req, res) => {
  try {
    const rawRows = csvEngine.readAll() || [];
    if (rawRows.length === 0) {
      return res.json({ daily: [], weekly: [], monthly: [], predictionGB: 0, latestRaw: null });
    }
    
    const chronologicalRows = [...rawRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const filledDailyData = [];
    
    for (let i = 0; i < chronologicalRows.length; i++) {
      const currentEntry = chronologicalRows[i];
      if (!currentEntry.date || isNaN(currentEntry.total_bytes)) continue;
      
      const currentGB = currentEntry.total_bytes / 1e9;
      const cleanDateStr = String(currentEntry.date).trim();
      const extractedMonth = cleanDateStr.substring(0, 7);
      
      if (i === 0) {
        filledDailyData.push({
          date: cleanDateStr,
          usageGB: parseFloat(currentGB.toFixed(2)),
          absoluteTotalGB: parseFloat(currentGB.toFixed(2)),
          week_num: String(currentEntry.week_num || '00'),
          month_num: extractedMonth
        });
        continue;
      }
      
      const prevEntry = chronologicalRows[i - 1];
      const dateStart = new Date(prevEntry.date + "T00:00:00");
      const dateEnd = new Date(currentEntry.date + "T00:00:00");
      
      const timeDiff = dateEnd - dateStart;
      const daysGap = Math.round(timeDiff / (1000 * 60 * 60 * 24));
      
      const deltaBytes = currentEntry.total_bytes - prevEntry.total_bytes;
      const trueDeltaBytes = deltaBytes >= 0 ? deltaBytes : currentEntry.total_bytes;
      const totalDeltaGB = trueDeltaBytes / 1e9;
      
      if (daysGap > 1 && daysGap < 365) {
        const averageUsagePerDayGB = totalDeltaGB / daysGap;
        const missingDates = getDaysArray(new Date(dateStart.getTime() + 86400000), dateEnd);
        
        missingDates.forEach((gapDate) => {
          const stepIndex = missingDates.indexOf(gapDate) + 1;
          let calculatedAbsoluteGB = (prevEntry.total_bytes / 1e9) + (averageUsagePerDayGB * stepIndex);
          if (deltaBytes < 0) calculatedAbsoluteGB = averageUsagePerDayGB * stepIndex; 
          
          const cleanGapDateStr = String(gapDate);
          
          filledDailyData.push({
            date: cleanGapDateStr,
            usageGB: parseFloat(averageUsagePerDayGB.toFixed(2)),
            absoluteTotalGB: parseFloat(calculatedAbsoluteGB.toFixed(2)),
            week_num: getWeekNumber(cleanGapDateStr),
            month_num: cleanGapDateStr.substring(0, 7)
          });
        });
      } else {
        filledDailyData.push({
          date: cleanDateStr,
          usageGB: parseFloat(totalDeltaGB.toFixed(2)),
          absoluteTotalGB: parseFloat(currentGB.toFixed(2)),
          week_num: String(currentEntry.week_num || '00'),
          month_num: extractedMonth
        });
      }
    }

    const weeklyMap = {};
    filledDailyData.forEach(item => {
      if (!weeklyMap[item.week_num]) weeklyMap[item.week_num] = 0;
      weeklyMap[item.week_num] += item.usageGB;
    });

    const weeklyData = Object.keys(weeklyMap).sort().map(week => ({
      label: "Week " + week,
      usageGB: parseFloat(weeklyMap[week].toFixed(2))
    }));

    const monthlyMap = {};
    filledDailyData.forEach(item => {
      if (!monthlyMap[item.month_num] || item.absoluteTotalGB > monthlyMap[item.month_num].absoluteTotalGB) {
        monthlyMap[item.month_num] = item;
      }
    });
    
    const monthlyData = Object.keys(monthlyMap).sort().map(month => {
      const record = monthlyMap[month];
      const dateObj = new Date(record.date + "T00:00:00");
      const labelStr = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      return {
        label: labelStr,
        usageGB: record.absoluteTotalGB
      };
    });

    let forecastPredictionGB = 0;
    if (filledDailyData.length > 0) {
      const latestEntry = filledDailyData[filledDailyData.length - 1];
      const activeMonthToken = String(latestEntry.month_num);
      const currentMonthLogs = filledDailyData.filter(item => String(item.month_num) === activeMonthToken);
      
      if (currentMonthLogs.length > 0) {
        const currentMonthUsageMaxGB = currentMonthLogs[currentMonthLogs.length - 1].absoluteTotalGB;
        const activeDateObj = new Date(latestEntry.date + "T00:00:00");
        const daysPassedInMonth = activeDateObj.getDate(); 
        const averageBurnRatePerDay = currentMonthUsageMaxGB / (daysPassedInMonth || 1);
        forecastPredictionGB = parseFloat((averageBurnRatePerDay * 30).toFixed(2));
      }
    }

    // Apply the clean dd-mmm-yy visual translation transformation exclusively to daily labels
    const formattedDailyList = filledDailyData.map(item => ({
      date: formatToDdMmmYy(item.date),
      usageGB: item.usageGB
    }));

    res.json({
      daily: formattedDailyList.slice(-14),
      weekly: weeklyData.slice(-6),
      monthly: monthlyData.slice(-12),
      predictionGB: forecastPredictionGB,
      latestRaw: chronologicalRows[chronologicalRows.length - 1] || null
    });

  } catch (err) {
    console.error("❌ Backend processing error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const job = new cron.CronJob('55 23 * * *', async () => {
  const data = await scrapeRouterData();
  if (data) {
    const today = new Date().toISOString().split('T')[0];
    csvEngine.saveEntry(today, data.total);
  }
});
job.start();

app.get('/', (req, res) => { res.render('dashboard'); });

app.get('/api/scrape-now', async (req, res) => {
  const data = await scrapeRouterData();
  if (data) {
    const today = new Date().toISOString().split('T')[0];
    csvEngine.saveEntry(today, data.total);
    return res.json({ success: true, message: "Scrape successful!", data });
  }
  res.status(500).json({ success: false, message: "Scrape routine failed." });
});

app.post('/api/shutdown', (req, res) => {
  res.json({ success: true });
  setTimeout(() => { process.exit(0); }, 500);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server running on port " + PORT));
