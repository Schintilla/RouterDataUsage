https://www.google.com/search?q=create+a+web+app+that+reads+router+data+usage+an+stores+daily+to+display+daily%2C+weekly+and+monthly.+router+ip%2C+username+and+password+as+input.+router+uaage+page+on+left+menu+5th+selection.&rlz=1CDGOYI_enZA953ZA966&hl=en-GB&sourceid=chrome-mobile&ie=UTF-8&aep=47&cud=0&source=chrome.crn.rb&mstk=AUtExfCsWpQHMMHwtEkhHDf5hNCn9VIR9zSEK4tlgEmfOFFag3O0CC3DtCbD6SQ3XG_AOOs_wepy0dlVn-jpclLRCvWO3vYiGDs5jKSfc84jg-B3vaLqzDytbPRSJMy3oIrV6YVd8JwstiTZbGjG5Mr_eCvKjj77g75kikaODNPKFRbE6tsxAzWinfVAXqG3v96q0f_BlpBqj62oPq4bII-4WzGVevesC_NZXcxpeIiq9SLkWGFQdkgzMH4qqhGfqkY7qhaXLXy91mKahZ3pe3Y5vFNcYXHNGvHu6XKYPzh8oaBDDQWZsGEYfpdEFY2ro6m_TOGnxDb_0fscnUPOe6KPEGaKX5Abc5yj2F2ysMry6NlMv1RGdH4UAa94kU8QKhlWtYit30lPjiaUo4e7S2F3XFzagH7saQPgNQ&csuir=1&mtid=_mm7atr6FLudhbIP19bx0Ak&udm=50

router-tracker/
├── node_modules/          # Local app dependencies (Chart.js, Puppeteer, etc.)
├── views/
│   └── dashboard.ejs      # UI Dashboard with FUP alert banner & metric summary cards
├── csvEngine.js           # Replaced database layer to write directly into spreadsheet formatting
├── login.env              # Secure configuration file holding your ROUTER_IP & ROUTER_PASSWORD
├── package.json           # Application node configurations
├── scraper.js             # Background password-only scraper engine optimized for ZTE firmware
├── server.js              # Web application engine with manual-trigger routes & close buttons
└── usage_history.csv      # 📊 Your real-time data log file (viewable inside Microsoft Excel)
