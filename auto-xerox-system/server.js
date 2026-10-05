require("dotenv").config();
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const Razorpay = require('razorpay');

const app = express();
const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});


// Use Render's dynamic PORT environment variable or fall back to 10000
const PORT = process.env.PORT || 10000;

// Enable CORS and request parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Ensure 'uploads' directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure File Storage via Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit
});

// In-Memory Print Job Queue for Local Hardware Relay
let printJobsQueue = [];

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Render server active' });
});

// 1. Submit Print Job (Called by Kiosk UI / Mobile Web App)
app.post('/api/kiosk/submit-job', upload.single('document'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const { copies, colorMode, sides, paperSize, orientation, pagesPerSheet, amount } = req.body;
    const jobId = 'JOB-' + Math.floor(100000 + Math.random() * 900000);

    const jobData = {
      id: jobId,
      filename: req.file.filename,
      filePath: req.file.path,
      originalName: req.file.originalname,
      copies: parseInt(copies, 10) || 1,
      colorMode: colorMode || 'bw',
      sides: sides || 'single',
      paperSize: paperSize || 'A4',
      orientation: orientation || 'portrait',
      pagesPerSheet: pagesPerSheet || 1,
      amount: amount || 0,
      createdAt: new Date().toISOString()
    };

    // Add to pending queue for the local print agent
    printJobsQueue.push(jobData);

    console.log(`[+] New Print Job Queued: ${jobId}`);

    return res.status(200).json({
      success: true,
      jobId: jobId,
      message: 'Print job submitted successfully.'
    });
  } catch (error) {
    console.error('[-] Error processing job:', error);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// 2. Poll Pending Jobs (Called by local Kiosk PC agent / print_agent.py)
app.get('/api/agent/pending-jobs', (req, res) => {
  res.status(200).json({ success: true, jobs: printJobsQueue });
});

// 3. Complete Print Job (Called by local Kiosk PC agent after physical printing)
app.post('/api/agent/complete-job/:jobId', (req, res) => {
  const { jobId } = req.params;
  printJobsQueue = printJobsQueue.filter(job => job.id !== jobId);
  console.log(`[✓] Print Job Completed: ${jobId}`);
  res.status(200).json({ success: true, message: `Job ${jobId} completed` });
});

// 4. Download File (Called by local Kiosk PC agent to retrieve print file)
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});
app.post('/create-order', async (req, res) => {
  try {
    const order = await rzp.orders.create({
      amount: Math.round(req.body.amount * 100),
      currency: 'INR',
      receipt: 'rcpt_' + Date.now()
    });
    res.json({ ...order, key: process.env.RAZORPAY_KEY_ID});
    
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Order failed' });
  }
});

app.post('/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');

  if (expected === razorpay_signature) {
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false });
  }
});
// Start Express Server - Bound to '0.0.0.0' for Render deployment
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Auto-Xerox Kiosk Cloud Server running on port ${PORT}`);
});