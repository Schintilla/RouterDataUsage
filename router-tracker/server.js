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
  const dt = new Date(start + "T12:00:00");
  const endDt = new Date(end + "T12:00:00");
  
  while (dt <= endDt) {
    arr.push(dt.toISOString().split('T')[0]);
    dt.setDate(dt.getDate() + 1);
  }
  return arr;
}

function getWeekNumber(dateStr) {
  try {
    const dateObj = new Date(dateStr + "T12:00:00");
    const startOfYear = new Date(dateObj.getFullYear(), 0, 1);
    const pastDaysOfYear = (dateObj - startOfYear) / 86400000;
    return String(Math.floor((pastDaysOfYear + startOfYear.getDay() + 1) / 7)).padStart(2, '0');
  } catch(e) {
    return "00";
  }
}

function formatToDdMmm(dateStr) {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const day = parts[2];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const monthText = months[monthIndex] || "Jan";
    return `${day}-${monthText}`;
  } catch (e) {
    return dateStr;
  }
}

app.get('/api/usage', (req, res) => {
  try {
    const rawRows = csvEngine.readAll() || [];
    const cleanRows = rawRows.filter(row => row.date && !isNaN(row.total_bytes) && row.total_bytes > 0 && row.date.length === 10);
    
    if (cleanRows.length === 0) {
      return res.json({ daily: [], weekly: [], monthly: [], predictionGB: 0, latestRaw: null });
    }
    
    const chronologicalRows = [...cleanRows].sort((a, b) => a.date.localeCompare(b.date));
    const filledDailyData = [];
    
    for (let i = 0; i < chronologicalRows.length; i++) {
      const currentEntry = chronologicalRows[i];
      const currentGB = currentEntry.total_bytes / 1e9;
      const cleanDateStr = currentEntry.date;
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
      const dateStart = new Date(prevEntry.date + "T12:00:00");
      const dateEnd = new Date(currentEntry.date + "T12:00:00");
      
      const timeDiff = dateEnd - dateStart;
      const daysGap = Math.round(timeDiff / (1000 * 60 * 60 * 24));
      
      const deltaBytes = currentEntry.total_bytes - prevEntry.total_bytes;
      const trueDeltaBytes = deltaBytes >= 0 ? deltaBytes : currentEntry.total_bytes;
      const totalDeltaGB = trueDeltaBytes / 1e9;
      
      if (daysGap > 1 && daysGap < 365) {
        const averageUsagePerDayGB = totalDeltaGB / daysGap;
        const nextDay = new Date(dateStart.getTime() + 86400000).toISOString().split('T')[0];
        const missingDates = getDaysArray(nextDay, currentEntry.date);
        
        missingDates.forEach((gapDate) => {
          const stepIndex = missingDates.indexOf(gapDate) + 1;
          let calculatedAbsoluteGB = (prevEntry.total_bytes / 1e9) + (averageUsagePerDayGB * stepIndex);
          if (deltaBytes < 0) calculatedAbsoluteGB = averageUsagePerDayGB * stepIndex; 
          
          filledDailyData.push({
            date: gapDate,
            usageGB: parseFloat(averageUsagePerDayGB.toFixed(2)),
            absoluteTotalGB: parseFloat(calculatedAbsoluteGB.toFixed(2)),
            week_num: getWeekNumber(gapDate),
            month_num: gapDate.substring(0, 7)
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
      const dateObj = new Date(record.date + "T12:00:00");
      return {
        label: dateObj.toLocaleString('default', { month: 'long', year: 'numeric' }),
        usageGB: record.absoluteTotalGB
      };
    });

    // 🔮 FIX: Enforce clean day string boundaries to account for the remaining calendar days
    let forecastPredictionGB = 0;
    if (filledDailyData.length > 0) {
      const latestEntry = filledDailyData[filledDailyData.length - 1];
      const activeMonthToken = latestEntry.month_num;
      const currentMonthLogs = filledDailyData.filter(item => item.month_num === activeMonthToken);
      
      if (currentMonthLogs.length > 0) {
        const currentMonthUsageMaxGB = currentMonthLogs[currentMonthLogs.length - 1].absoluteTotalGB;
        
        // Isolate calendar fields via string array index to eliminate timezone slips
        const dateStringParts = latestEntry.date.split('-');
        const daysPassedInMonth = parseInt(dateStringParts[2], 10); 
        
        const referenceYear = parseInt(dateStringParts[0], 10);
        const referenceMonth = parseInt(dateStringParts[1], 10);
        const totalDaysInThisMonth = new Date(referenceYear, referenceMonth, 0).getDate(); 

        const averageBurnRatePerDay = currentMonthUsageMaxGB / (daysPassedInMonth || 1);
        forecastPredictionGB = parseFloat((averageBurnRatePerDay * totalDaysInThisMonth).toFixed(2));
      }
    }

    const formattedDailyList = filledDailyData.map(item => ({
      date: formatToDdMmm(item.date),
      usageGB: item.usageGB
    }));

    res.json({
      daily: formattedDailyList.slice(-30), 
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
  if (data && data.total > 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    csvEngine.saveEntry(todayStr, data.total);
  }
});
job.start();

app.get('/', (req, res) => { res.render('dashboard'); });

app.get('/api/scrape-now', async (req, res) => {
  const data = await scrapeRouterData();
  if (data && data.total > 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    csvEngine.saveEntry(todayStr, data.total);
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
