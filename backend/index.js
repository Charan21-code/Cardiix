import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tesseract from 'node-tesseract-ocr';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import MedicalReport from './MedicalReport.js';
import Scan from './models/Scan.js';
import scansRouter from './routes/scans.js';
import Groq from 'groq-sdk';

dotenv.config();

// ES Module setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS Configuration
app.use(cors({
  origin: [
    "http://localhost:3000",                  // Local frontend
    process.env.FRONTEND_URL || ""            // Deployed frontend
  ],
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

// Body parsers
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vivitsu_health';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Tesseract OCR Config
const ocrConfig = { lang: 'eng', oem: 1, psm: 3 };

// Helper: Medical analysis using Groq AI with Python / local fallback
async function analyzeMedicalReport(extractedText) {
  // 1. Try Groq AI (Fast & Accurate Medical LLM)
  try {
    if (process.env.GROQ_API_KEY) {
      const prompt = `You are a medical assistant and clinical expert. Analyze this extracted medical report text and provide:

1. **Executive Summary**: Brief overview of the report (2-3 sentences)
2. **Key Clinical Findings**: Important medical observations, test results, diagnoses
3. **Values & Measurements**: Table or bullet points of numerical values with units and normal reference ranges
4. **Abnormalities & Warnings**: Flag any values outside normal ranges clearly
5. **Recommendations & Next Steps**: Suggested follow-up or general lifestyle guidance

Medical Report Text:
${extractedText}

⚠️ Include a clear disclaimer that this is AI analysis and not a substitute for professional medical advice.`;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are Vivitsu Medical AI, an expert medical report analyzer.' },
          { role: 'user', content: prompt }
        ],
        model: 'openai/gpt-oss-120b',
        temperature: 0.3,
        max_tokens: 1500
      });

      const aiText = completion.choices[0]?.message?.content;
      if (aiText && aiText.trim().length > 30) {
        return aiText.trim();
      }
    }
  } catch (groqErr) {
    console.error('⚠️ Groq AI analysis failed, trying python fallback:', groqErr.message);
  }

  // 2. Try Python medical analyzer (if python3 is available)
  return new Promise((resolve) => {
    const pythonScript = join(__dirname, 'medical_analyzer.py');
    const python = spawn('python3', [pythonScript]);

    let output = '', errorOutput = '';

    python.stdin.write(extractedText);
    python.stdin.end();

    python.stdout.on('data', data => output += data.toString());
    python.stderr.on('data', data => errorOutput += data.toString());

    python.on('close', code => {
      if (code === 0 && output.trim()) {
        resolve(output.trim());
      } else {
        console.error('Python fallback error:', errorOutput);
        resolve(generateLocalMockAnalysis(extractedText));
      }
    });

    python.on('error', err => {
      console.error('Python spawn error:', err.message);
      resolve(generateLocalMockAnalysis(extractedText));
    });

    setTimeout(() => {
      python.kill();
      resolve(generateLocalMockAnalysis(extractedText));
    }, 15000);
  });
}

function generateLocalMockAnalysis(extractedText) {
  return `### Medical Report Summary\n\n**Extracted Content:**\n${extractedText.substring(0, 300)}...\n\n**Preliminary Observations:**\n* Text extracted successfully via OCR.\n* Medical parameters detected in document.\n\n⚠️ *Medical Disclaimer: Please consult a licensed medical professional for formal diagnosis.*`;
}

// Routes ---------------------------------------------------
// Helper: build medical context string from reports
function buildMedicalContext(medicalReports) {
  if (!medicalReports || medicalReports.length === 0) return '';
  return '\n\nPatient Medical Reports Context:\n' +
    medicalReports.map((r, i) =>
      `Report ${i + 1} (${r.uploadedAt || 'unknown date'}): ${r.aiAnalysis || r.extractedText || ''}`
    ).join('\n');
}

// Chat with medical context
app.post('/api/chat/message', async (req, res) => {
  try {
    const { messages, medicalReports } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'Missing messages array' });
    }

    const context = buildMedicalContext(medicalReports);
    const systemPrompt = `You are Vivitsu, an AI health assistant. Be helpful, clear, and always include a disclaimer to consult a healthcare professional for medical decisions.${context}`;

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.text
      }))
    ];

    const completion = await groq.chat.completions.create({
      messages: groqMessages,
      model: 'openai/gpt-oss-120b',
      temperature: 0.7,
      max_tokens: 1024
    });

    const responseText = completion.choices[0]?.message?.content || 'No response generated.';
    res.json({ success: true, response: responseText });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Diet plan generation
app.post('/api/chat/diet-plan', async (req, res) => {
  try {
    const { goal, medicalReports } = req.body;
    const context = buildMedicalContext(medicalReports);

    const prompt = `Create a personalized diet plan for a patient with this goal: "${goal || 'general health improvement'}".${context}\n\nProvide a structured, practical diet plan with meal suggestions. End with a disclaimer to consult a doctor or nutritionist.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are Vivitsu, an AI health assistant specializing in nutrition guidance.' },
        { role: 'user', content: prompt }
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.7,
      max_tokens: 1024
    });

    const responseText = completion.choices[0]?.message?.content || 'No response generated.';
    res.json({ success: true, response: responseText });
  } catch (error) {
    console.error('Diet plan error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health insights
app.post('/api/chat/insights', async (req, res) => {
  try {
    const { medicalReports } = req.body;
    const context = buildMedicalContext(medicalReports);

    if (!context) {
      return res.json({ success: true, response: 'No medical reports found yet. Upload a report to get personalized insights.' });
    }

    const prompt = `Based on the following medical reports, provide key health insights, trends, and recommendations.${context}\n\nEnd with a disclaimer to consult a healthcare professional.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are Vivitsu, an AI health assistant providing health insights.' },
        { role: 'user', content: prompt }
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.7,
      max_tokens: 1024
    });

    const responseText = completion.choices[0]?.message?.content || 'No response generated.';
    res.json({ success: true, response: responseText });
  } catch (error) {
    console.error('Insights error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'Vivitsu Medical AI Backend',
    version: '2.0.0',
    status: 'running'
  });
});

// OCR + Medical Analysis
app.post('/api/medical/analyze', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image || !mimeType) return res.status(400).json({ success: false, error: "Missing image or mimeType" });

    const supportedTypes = ['image/png','image/jpeg','image/jpg','image/webp'];
    if (!supportedTypes.includes(mimeType)) return res.status(400).json({ success: false, error: "Unsupported file type" });

    const imageBuffer = Buffer.from(image, 'base64');

    // OCR extraction
    let extractedText;
    try { extractedText = await tesseract.recognize(imageBuffer, ocrConfig); }
    catch (ocrError) { return res.status(500).json({ success: false, error: "OCR failed", details: ocrError.message }); }

    if (!extractedText || extractedText.trim().length < 20)
      return res.status(400).json({ success: false, error: "Insufficient text extracted", extractedText });

    // Local AI analysis
    let analysis;
    try { analysis = await analyzeMedicalReport(extractedText); }
    catch (analysisError) { return res.status(500).json({ success: false, error: "AI analysis failed", details: analysisError.message }); }

    // Save to MongoDB
    try {
      const newReport = new MedicalReport({
        uploadedImage: image.substring(0,50000),
        extractedText: extractedText.trim(),
        aiAnalysis: analysis,
        uploadedAt: new Date()
      });
      const savedReport = await newReport.save();
      return res.status(200).json({ success: true, extractedText: extractedText.trim(), analysis, reportId: savedReport._id });
    } catch (dbError) {
      return res.status(200).json({ success: true, extractedText: extractedText.trim(), analysis, dbWarning: "Analysis completed but DB save failed" });
    }

  } catch (error) { return res.status(500).json({ success: false, error: error.message }); }
});

// Get Reports
app.get('/api/medical/reports', async (req, res) => {
  try {
    const reports = await MedicalReport.find().select('-uploadedImage').sort({ uploadedAt: -1 }).limit(50);
    res.json({ success: true, count: reports.length, reports });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Get Single Report
app.get('/api/medical/reports/:id', async (req, res) => {
  try {
    const report = await MedicalReport.findById(req.params.id);
    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
    res.json({ success: true, report });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// Mount Scans API
app.use('/api', scansRouter);

app.post('/api/vital-scan/save', async (req, res) => {
  try {
    const scanData = req.body;
    const newScan = new Scan({
      heartRate: scanData.heartRate,
      hrv: scanData.hrv,
      bloodPressure: scanData.bloodPressure,
      stressIndex: scanData.stressIndex || (scanData.stressLevel === 'High' ? 65 : 30),
      aiInterpretation: scanData.aiInterpretation,
      confidence: scanData.confidence || 85.0,
      timestamp: new Date()
    });
    const savedScan = await newScan.save();
    console.log('💾 Vital scan saved to MongoDB:', savedScan._id);
    res.status(201).json({ success: true, scanId: savedScan._id, scan: savedScan });
  } catch (error) {
    console.error('❌ Error saving vital scan:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.delete('/api/medical/reports/:id', async (req, res) => {
  try {
    const deletedReport = await MedicalReport.findByIdAndDelete(req.params.id);
    if (!deletedReport) return res.status(404).json({ success: false, error: 'Report not found' });
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ESP32 Health Data
const healthDataSchema = new mongoose.Schema({
  bpm: Number,
  spo2: Number,
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });
const HealthData = mongoose.model('HealthData', healthDataSchema);

app.post('/data', async (req,res)=>{
  try{
    const { bpm, spo2 } = req.body;
    const newData = new HealthData({ bpm, spo2 });
    await newData.save();
    res.status(200).json({ message: 'Data saved successfully' });
  } catch(err){ res.status(500).json({ error: 'Error saving data' }); }
});

app.get('/data', async (req,res)=>{
  try{
    const data = await HealthData.find().sort({ timestamp:-1 }).limit(50);
    res.status(200).json(data);
  } catch(err){ res.status(500).json({ error: 'Failed to fetch data' }); }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 ESP32 Data Endpoint: /data`);
});
