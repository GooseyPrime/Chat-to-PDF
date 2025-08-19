const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const generatePdf = require('./pdf-utils/generatePdf');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

app.post('/generate', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).send('URL is required');

  try {
    const pdfBuffer = await generatePdf(url);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=chat-export.pdf',
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating PDF:', err);
    res.status(500).send('Failed to generate PDF');
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
