# ZTE G5TS Data Tracker

A local Node.js web dashboard and automated scraper designed to monitor bandwidth consumption, track Fair Usage Policy (FUP) limits, and forecast month-end data usage for the **ZTE G5TS** router.

## Features

* **Live Router Scraping:** Pulls real-time byte volume metrics directly from the ZTE G5TS router interface on demand.
* **Strict Binary Calculation:** Converts raw router bytes using true binary units (`1024³` GiB/TiB) to accurately match ISP FUP quota measurements without decimal inflation.
* **FUP Cap & Daily Budget Tracking:** 
  * Monitors usage against a **450 GB** monthly soft cap.
  * Calculates **Amount Remaining** and determines the exact daily GB allowance needed to stay within the cap for the rest of the calendar month.
  * Displays an alert banner if the soft cap threshold is breached.
* **Month-End Forecasting:** Projects end-of-month total consumption based on your rolling average daily usage and warns if the cap may be exceeded.
* **Interactive Multi-View Charts (Chart.js):**
  * **Daily Profile:** Displays a rolling 30-day history (or from the start of logged data), highlighting current calendar month bars in **green** and prior month bars in **blue** against a 15 GB daily budget line.
  * **Weekly Summary:** Tracks the last 6 weeks against a 105 GB weekly FUP budget.
  * **Monthly Cycle:** Tracks the last 12 monthly billing cycles against the 450 GB ceiling.
* **Quick Utilities:** Includes a one-click **Speed Test** shortcut (`speedtest.net`) and a graceful **Close Application** shutdown hook.

## Project Structure

```text
router-tracker/
├── server.js               # Express backend, API endpoints, scraper & data aggregation
├── launch.bat              # Windows batch launcher (clears stale Node processes & opens Chrome)
├── views/
│   └── dashboard.ejs       # Frontend UI, metric cards, and Chart.js visualizations
└── public/
    └── js/
        ├── chart.js
        └── chartjs-plugin-annotation.js
```

## Prerequisites

* [Node.js](https://nodejs.org) (v16 or higher recommended)
* Google Chrome (for the automated Windows launcher)
* Local network access to your **ZTE G5TS** router

## Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com
   cd zte-g5ts-data-tracker
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Router Credentials / IP:**
   Ensure your router IP address and login credentials (if required by your scraper configuration in `server.js` or `.env`) match your local ZTE G5TS gateway settings.

## Usage

### Option 1: Windows One-Click Launcher
Double-click **`launch.bat`** (or create a desktop shortcut to it). The script will:
1. Terminate any lingering background `node.exe` processes to prevent port conflicts.
2. Start `server.js` silently in the background.
3. Open `http://localhost:3000` in a maximized Google Chrome tab.

### Option 2: Manual Terminal Start
```bash
node server.js
```
Then open your browser and navigate to `http://localhost:3000`.

## Dashboard Controls

* **🔄 Refresh Live Data:** Triggers an immediate scrape of the ZTE G5TS router and updates all cards and charts.
* **🚀 Speed Test:** Opens [Speedtest by Ookla](https://speedtest.net) in a new tab to verify line speeds (e.g., 50 Mbps normal profile vs. 1 Mbps throttled FUP state).
* **🛑 Close Application:** Safely shuts down the background Node.js server and closes the dashboard window.

## License

This project is open-source and available under the [MIT License](LICENSE).
