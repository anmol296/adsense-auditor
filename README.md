# AdSense Auditor

AdSense Auditor is a simple web application designed to perform basic AdSense policy compliance checks on arbitrary websites. It fetches a given URL, analyses the HTML and flags obvious violations such as adult or gambling-related terms and missing files like `ads.txt`. It’s intended as a starting point for a more comprehensive compliance tool and does **not** guarantee full compliance with Google AdSense program policies.

## Features

- **API endpoint**: `/api/audit` accepts a JSON payload with a `url` field and returns a JSON report indicating:
  - The detected page title and HTML length.
  - Whether potentially prohibited terms (e.g. adult or gambling content) are present.
  - Whether the site references an `ads.txt` file.
  - A list of notes explaining which checks ran.
- **Simple UI**: A basic browser form where you can input a URL and view audit results formatted in the browser.
- **Native server**: Implemented using Node.js and the built‑in `http` module, with no third‑party dependencies.
- **Modular analysis**: The core analysis logic lives in `audit.js` and can be unit tested or extended independently of the server.

## Running Locally

1. Ensure you have [Node.js](https://nodejs.org) installed (v18+).
2. Clone this repository and install dependencies:

   ```bash
   git clone https://github.com/anmol296/adsense-auditor.git
   cd adsense-auditor
   npm install
   ```

3. Start the server:

   ```bash
   node server.js
   ```

4. Open your browser to `http://localhost:3000` and try auditing a website.

## Deploying to Render

This project can be deployed to [Render](https://render.com) as a free web service.

1. Create a new **Web Service** in Render and connect it to your GitHub repository.
2. Choose **Node** environment, select a region (e.g. Singapore) and the free plan.
3. Use the following settings:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Render will automatically set the `PORT` environment variable. The server binds to this port by default.
5. Once deployed, visit the service URL to access the app.

## Extending

This app performs very limited checks. To improve it you might:

- Add more robust content analysis rules for things like misleading navigation, malicious scripts, or scraped content.
- Check page layout and ad placement requirements (e.g. no more than three ads per page, no ads above the fold).
- Validate that required pages such as Privacy Policy and Contact are present.
- Crawl multiple pages rather than only the root URL.
- Persist audit results in a database and expose a dashboard for historical audits.

Contributions and suggestions are welcome!
