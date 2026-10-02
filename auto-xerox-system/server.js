const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const pdfToPrinter = require('pdf-to-printer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniquePrefix}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// GET Endpoint: List all connected system printers
app.get('/api/printers', async (req, res) => {
  try {
    const printers = await pdfToPrinter.getPrinters();
    const defaultPrinter = await pdfToPrinter.getDefaultPrinter();
    res.status(200).json({ success: true, defaultPrinter, printers });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve printers' });
  }
});

// POST Endpoint: Submit and automatically print document
app.post('/api/kiosk/submit-job', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const { copies, colorMode, sides, paperSize, orientation } = req.body;
    const filePath = req.file.path;
    const jobId = 'JOB-' + Math.floor(100000 + Math.random() * 900000);

    console.log(`[+] New Job Submitted: ${jobId}`);
    console.log(`    File Path: ${filePath}`);

    // Build printer options
    const printOptions = {
      copies: parseInt(copies, 10) || 1,
      paperSize: paperSize || 'A4',
      side: sides === 'double' ? 'duplex' : 'simplex',
      monochrome: colorMode === 'bw'
    };

    console.log(`[*] Sending ${req.file.filename} to printer hardware...`);

    pdfToPrinter
      .print(filePath, printOptions)
      .then(() => {
        console.log(`[✓] Print Job ${jobId} successfully sent to hardware printer.`);
      })
      .catch((err) => {
        console.error(`[✗] Hardware Print Failed for ${jobId}:`, err);
      });

    return res.status(200).json({
      success: true,
      jobId: jobId,
      message: 'Print job received and sent to printer queue.'
    });
  } catch (error) {
    console.error('[-] Job Processing Error:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Auto-Xerox Kiosk Server running on http://localhost:${PORT}`);
});
