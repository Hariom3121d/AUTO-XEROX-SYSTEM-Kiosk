/**
 * Auto-Xerox Kiosk - Advanced Settings & Real-Time Price Engine
 */

const KioskState = {
  selectedFile: null,
  pageCount: 1,
  selectedPages: 1,
  copies: 1,
  colorMode: 'bw',       // 'bw' | 'color'
  sides: 'single',       // 'single' | 'double'
  paperSize: 'A4',       // 'A4' | 'A3' | 'Letter' | 'Legal'
  orientation: 'portrait',// 'portrait' | 'landscape'
  pagesPerSheet: 1,      // 1 | 2 | 4
  pageRange: 'all',      // 'all' | 'custom'
  customRangeStr: '',
  ratePerPage: 2,
  totalAmount: 2,
  paymentMethod: 'upi',
  currentTab: 1,
  currentJobId: null,
  upiVPA: 'autoxerox@upi' // Replace with target UPI ID
};

document.addEventListener('DOMContentLoaded', () => {
  initializeTabState();
  setupDragAndDrop();
  setupEventListeners();
  calculateCost();
});

function setupEventListeners() {
  const inputs = [
    'copies-input', 'color-select', 'sides-select',
    'paper-size-select', 'page-range-select', 'custom-pages-input',
    'orientation-select', 'nup-select'
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', calculateCost);
      el.addEventListener('input', calculateCost);
    }
  });

  const proceedBtn = document.getElementById('proceed-payment-btn');
  if (proceedBtn) {
    proceedBtn.addEventListener('click', proceedToPayment);
  }
}

/* ==========================================
 * ADVANCED COST CALCULATOR ENGINE
 * ========================================== */

function calculateCost() {
  const copiesInput = document.getElementById('copies-input');
  const colorSelect = document.getElementById('color-select');
  const sidesSelect = document.getElementById('sides-select');
  const paperSizeSelect = document.getElementById('paper-size-select');
  const pageRangeSelect = document.getElementById('page-range-select');
  const customPagesInput = document.getElementById('custom-pages-input');
  const nupSelect = document.getElementById('nup-select');

  KioskState.copies = copiesInput ? Math.max(1, parseInt(copiesInput.value) || 1) : 1;
  KioskState.colorMode = colorSelect ? colorSelect.value : 'bw';
  KioskState.sides = sidesSelect ? sidesSelect.value : 'single';
  KioskState.paperSize = paperSizeSelect ? paperSizeSelect.value : 'A4';
  KioskState.pageRange = pageRangeSelect ? pageRangeSelect.value : 'all';
  KioskState.pagesPerSheet = nupSelect ? parseInt(nupSelect.value) || 1 : 1;

  // Toggle Custom Range Input visibility
  const customWrapper = document.getElementById('custom-range-wrapper');
  if (customWrapper) {
    if (KioskState.pageRange === 'custom') {
      customWrapper.style.display = 'block';
      KioskState.customRangeStr = customPagesInput ? customPagesInput.value : '';
      KioskState.selectedPages = parseCustomPageCount(KioskState.customRangeStr, KioskState.pageCount);
    } else {
      customWrapper.style.display = 'none';
      KioskState.selectedPages = KioskState.pageCount;
    }
  }

  // Base rate calculation per page side (B&W = ₹2, Color = ₹10)
  let baseRate = (KioskState.colorMode === 'color') ? 10 : 2;
  
  // Paper size surcharge (A3 paper costs +₹5 extra per sheet)
  let paperSurcharge = (KioskState.paperSize === 'A3') ? 5 : 0;

  // Effective print sides required after N-Up scaling
  let effectiveSides = Math.ceil(KioskState.selectedPages / KioskState.pagesPerSheet);

  // Calculate physical paper sheets needed if Double-Sided
  let physicalSheets = (KioskState.sides === 'double') ? Math.ceil(effectiveSides / 2) : effectiveSides;

  // Double-sided discount: Charge 10% less per side when printed double-sided
  let costPerSide = (KioskState.sides === 'double') ? (baseRate * 0.9) : baseRate;

  // Calculation Formula
  let subtotal = (effectiveSides * costPerSide) + (physicalSheets * paperSurcharge);
  KioskState.ratePerPage = baseRate;
  KioskState.totalAmount = Math.ceil(subtotal * KioskState.copies);

  // Update Live Cost Displays
  const liveTotalDisplay = document.getElementById('live-total-price');
  if (liveTotalDisplay) {
    liveTotalDisplay.textContent = `₹${KioskState.totalAmount}`;
  }

  updatePaymentSummary();
}

function parseCustomPageCount(rangeStr, totalDocPages) {
  if (!rangeStr.trim()) return 1;
  const set = new Set();
  const parts = rangeStr.split(',');

  parts.forEach(part => {
    const range = part.trim().split('-');
    if (range.length === 2) {
      const start = parseInt(range[0]) || 1;
      const end = parseInt(range[1]) || totalDocPages;
      for (let i = start; i <= Math.min(end, totalDocPages); i++) {
        if (i > 0) set.add(i);
      }
    } else if (range.length === 1) {
      const page = parseInt(range[0]);
      if (page && page > 0 && page <= totalDocPages) set.add(page);
    }
  });

  return set.size > 0 ? set.size : 1;
}

/* ==========================================
 * NAVIGATION & TAB CONTROLS
 * ========================================== */

function initializeTabState() { 
  switchTab(1); 
}

function switchTab(tabIndex) {
  const targetTabBtn = document.getElementById(`tab${tabIndex}-btn`);
  if (targetTabBtn && targetTabBtn.hasAttribute('disabled')) return;

  KioskState.currentTab = tabIndex;
  for (let i = 1; i <= 4; i++) {
    const tabBtn = document.getElementById(`tab${i}-btn`);
    const tabContent = document.getElementById(`tab-${i}`);
    if (tabBtn) tabBtn.classList.toggle('active', i === tabIndex);
    if (tabContent) tabContent.classList.toggle('active', i === tabIndex);
  }

  if (tabIndex === 3) {
    updatePaymentSummary();
    generateDynamicUPIQR();
  }
}

function unlockNextStep(stepNumber) {
  const stepBtn = document.getElementById(`tab${stepNumber}-btn`);
  if (stepBtn) {
    stepBtn.removeAttribute('disabled');
    stepBtn.removeAttribute('aria-disabled');
  }
}

function proceedToPayment() {
  calculateCost();
  unlockNextStep(3);
  switchTab(3);
}

function updatePaymentSummary() {
  const summaryPages = document.getElementById('summary-pages');
  const summaryCopies = document.getElementById('summary-copies');
  const summaryRate = document.getElementById('summary-rate');
  const summaryTotal = document.getElementById('summary-total');

  if (summaryPages) summaryPages.textContent = KioskState.selectedPages;
  if (summaryCopies) summaryCopies.textContent = KioskState.copies;
  if (summaryRate) summaryRate.textContent = KioskState.ratePerPage;
  if (summaryTotal) summaryTotal.textContent = KioskState.totalAmount;
}

function generateDynamicUPIQR() {
  const qrContainer = document.getElementById('upi-qr-image');
  if (!qrContainer) return;
  const upiUri = `upi://pay?pa=${KioskState.upiVPA}&pn=AutoXeroxKiosk&am=${KioskState.totalAmount}&cu=INR&tn=PrintJobOrder`;
  qrContainer.src = `https://quickchart.io/qr?text=${encodeURIComponent(upiUri)}&size=200&margin=1`;
}

/* ==========================================
 * FILE HANDLING
 * ========================================== */

function setupDragAndDrop() {
  const dropZone = document.getElementById('drop-zone');
  if (!dropZone) return;
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
    dropZone.addEventListener(e, preventDefaults, false);
    document.body.addEventListener(e, preventDefaults, false);
  });
  dropZone.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }

function handleDrop(e) {
  const files = e.dataTransfer.files;
  if (files && files.length > 0) processUploadedFile(files[0]);
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) processUploadedFile(file);
}

async function processUploadedFile(file) {
  KioskState.selectedFile = file;
  const ext = file.name.split('.').pop().toLowerCase();

  const fileNameDisplay = document.getElementById('file-name-display');
  const pageCountDisplay = document.getElementById('page-count-display');
  const fileInfoBox = document.getElementById('file-info');

  if (fileNameDisplay) fileNameDisplay.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
  if (fileInfoBox) fileInfoBox.style.display = 'block';

  if (ext === 'pdf') {
    if (pageCountDisplay) pageCountDisplay.textContent = 'Analyzing PDF...';
    KioskState.pageCount = await countPdfPages(file);
  } else {
    KioskState.pageCount = 1;
  }

  if (pageCountDisplay) pageCountDisplay.textContent = `${KioskState.pageCount} Page(s)`;

  calculateCost();
  unlockNextStep(2);
  setTimeout(() => switchTab(2), 300);
}

function countPdfPages(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = new Uint8Array(e.target.result);
      let pages = 0;
      for (let i = 0; i < text.length - 5; i++) {
        if (text[i] === 0x2f && text[i+1] === 0x54 && text[i+2] === 0x79 && text[i+3] === 0x70 && text[i+4] === 0x65 && text[i+5] === 0x2f) {
          if (text[i+6] === 0x50 && text[i+7] === 0x61 && text[i+8] === 0x67 && text[i+9] === 0x65) pages++;
        }
      }
      resolve(pages > 0 ? pages : 1);
    };
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file);
  });
}

/* ==========================================
 * SUBMIT JOB
 * ========================================== */

async function submitPrintJob() {
  if (!KioskState.selectedFile) return alert('Please upload a file first.');

  const formData = new FormData();
  formData.append('document', KioskState.selectedFile);
  formData.append('copies', KioskState.copies);
  formData.append('colorMode', KioskState.colorMode);
  formData.append('sides', KioskState.sides);
  formData.append('paperSize', KioskState.paperSize);
  formData.append('orientation', KioskState.orientation);
  formData.append('pagesPerSheet', KioskState.pagesPerSheet);
  formData.append('amount', KioskState.totalAmount);
  formData.append('kioskId', 'KIOSK-01');

  unlockNextStep(4);
  switchTab(4);

  const banner = document.getElementById('status-banner');
  const text = document.getElementById('status-text');
  if (text) text.textContent = `Processing payment of ₹${KioskState.totalAmount}...`;

  try {
    const response = await fetch('/api/kiosk/submit-job', { method: 'POST', body: formData });
    const data = await response.json();
    if (response.ok && data.success) {
      if (text) text.textContent = `Job Submitted! ID: ${data.jobId}. Printing in progress...`;
    } else {
      if (text) text.textContent = `Error: ${data.error || 'Failed to submit'}`;
    }
  } catch (err) {
    if (text) text.textContent = 'Server unreachable. Check server.js';
  }
}

// Global scope exposures for inline event attributes
window.proceedToPayment = proceedToPayment;
window.switchTab = switchTab;
window.handleFileSelect = handleFileSelect;
window.submitPrintJob = submitPrintJob;
async function payAndPrint(amount) {
  const order = await fetch('/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount })
  }).then(r => r.json());

  const options = {
    key: order.key,
    amount: order.amount,
    currency: order.currency,
    order_id: order.id,
    name: 'Auto-Xerox Kiosk',
    handler: async function (response) {
      const result = await fetch('/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response)
      }).then(r => r.json());

      if (result.success) {
        submitPrintJob(); // starts printing after payment
      } else {
        alert('Payment failed');
      }
    }
  };

  const rzpPopup = new Razorpay(options);
rzpPopup.on('payment.failed', e => alert('Payment failed: ' + e.error.description));
rzpPopup.open();
}

window.payAndPrint = payAndPrint;