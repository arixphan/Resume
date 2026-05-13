const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors());
// Increase payload limit because HTML/CSS can be large
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

let browser;

async function getBrowser() {
  if (!browser) {
    console.log('Launching browser instance...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Handle browser disconnection
    browser.on('disconnected', () => {
      browser = null;
    });
  }
  return browser;
}

app.post('/generate-pdf', async (req, res) => {
  const { html, css } = req.body;

  if (!html) {
    return res.status(400).send('Missing html');
  }

  // Construct the full HTML document for Puppeteer
  const fullHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        /* Base reset to ensure pure PDF rendering */
        body { margin: 0; padding: 0; background: white; font-family: "Times New Roman", Times, serif; }
        
        /* Inject the frontend CSS */
        ${css || ''}
        
        /* Override specifically for the PDF generation environment */
        .cv-document { 
          width: 100% !important; 
          max-width: none !important; 
          box-shadow: none !important; 
          padding: 0 !important; 
          margin: 0 !important; 
        }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;

  try {
    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();
    
    // Set content and wait for basic load (much faster than networkidle0 if no external assets)
    await page.setContent(fullHtml, { waitUntil: 'load' });

    console.log('Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1.5cm',
        bottom: '1.5cm',
        left: '1.5cm',
        right: '1.5cm',
      },
      // Enable header/footer to use custom templates
      displayHeaderFooter: true,
      // Empty header template so nothing shows at the top
      headerTemplate: '<span></span>', 
      // Footer template with page numbers
      footerTemplate: `
        <div style="width: 100%; font-size: 10px; padding: 0 1.5cm; display: flex; justify-content: flex-end; color: #666; font-family: 'Times New Roman', Times, serif;">
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `,
    });
    
    await page.close();
    console.log('PDF generated successfully.');

    // Send back the PDF
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
    });
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error generating PDF');
  }
});

app.post('/save-cv', async (req, res) => {
  const { markdown } = req.body;

  if (markdown === undefined) {
    return res.status(400).send('Missing markdown content');
  }

  try {
    const filePath = path.join(__dirname, '..', 'CV.md');
    fs.writeFileSync(filePath, markdown, 'utf8');
    console.log('CV.md updated successfully.');
    res.status(200).send('File updated successfully');
  } catch (error) {
    console.error('Error saving CV.md:', error);
    res.status(500).send('Error saving file');
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PDF Server running on http://localhost:${PORT}`);
});
