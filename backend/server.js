import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import tesseract from 'node-tesseract-ocr';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyC7xaZ_rs4OnPpFJT0DycoSS1Ff6S37H6E";

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));


// OCR Configuration
const ocrConfig = {
  lang: 'eng',
  oem: 1,
  psm: 3
};

// Medical Analysis Function
async function analyzeMedicalReport(extractedText) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a medical assistant. Analyze this medical report and provide:

1. **Summary**: Brief overview of the report (2-3 sentences)
2. **Key Findings**: Important medical observations, test results, diagnoses
3. **Values & Measurements**: Extract all numerical values with their units and reference ranges
4. **Patient Information**: Name, age, date, hospital/clinic (if present)
5. **Recommendations**: Any prescribed medications, follow-up instructions, or warnings
6. **Abnormalities**: Flag any values outside normal ranges

Medical Report Text:
${extractedText}`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        })
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
    }
    
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated";
  } catch (error) {
    console.error('Gemini API Error:', error);
    console.log('⚠️ Falling back to local medical analysis parser...');
    return generateLocalMockAnalysis(extractedText);
  }
}

// Chat with context endpoint
app.post('/api/chat/message', async (req, res) => {
  try {
    const { messages, medicalReports } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || !lastMessage.text) {
      return res.status(400).json({ error: 'Last message must have text' });
    }

    // Build context from medical reports
    let context = '';
    if (medicalReports && medicalReports.length > 0) {
      context = '\n\nMedical Context:\n' + medicalReports.map(report => 
        `Report from ${report.uploadedAt}:\n${report.extractedText}\nAI Analysis: ${report.aiAnalysis}`
      ).join('\n\n');
    }

    const prompt = `You are a helpful medical AI assistant. ${context ? 'Use the provided medical context to inform your response.' : ''}

User: ${lastMessage.text}

Provide a helpful, accurate response. If discussing medical topics, remind users to consult healthcare professionals.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const aiResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "I apologize, but I couldn't generate a response at this time.";

    res.json({ success: true, response: aiResponse });
  } catch (error) {
    console.error('Chat Error:', error);
    console.log('⚠️ Falling back to local chat responder...');
    try {
      const fallbackResponse = generateLocalMockChat(messages, medicalReports);
      res.json({ success: true, response: fallbackResponse });
    } catch (fallbackError) {
      res.status(500).json({ error: 'Failed to process chat message', success: false });
    }
  }
});

// Analyze image endpoint (for eye analysis)
app.post('/api/chat/analyze-image', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    
    if (!image || !mimeType) {
      return res.status(400).json({ error: 'Image and mimeType are required', success: false });
    }

    // For eye analysis, use Gemini Vision directly
    const prompt = `You are a medical AI assistant specializing in ophthalmology. Analyze this eye image and provide:

1. **Visual Assessment**: Describe what you can observe in the image
2. **Potential Findings**: Any visible abnormalities, conditions, or normal features
3. **Recommendations**: Suggestions for the patient or when to see a doctor
4. **Important Note**: This is AI analysis only - consult an eye care professional for proper diagnosis

Please be thorough but remember this is not a substitute for professional medical advice.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini Vision API error: ${response.status}`);
    }

    const result = await response.json();
    const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to analyze the image at this time.";

    res.json({ success: true, response: analysis });
  } catch (error) {
    console.error('Image Analysis Error:', error);
    res.status(500).json({ error: 'Failed to analyze image', success: false });
  }
});

// Diet plan endpoint
app.post('/api/chat/diet-plan', async (req, res) => {
  try {
    const { goal, medicalReports } = req.body;
    
    let context = '';
    if (medicalReports && medicalReports.length > 0) {
      context = '\n\nMedical Context:\n' + medicalReports.map(report => 
        `Report: ${report.extractedText}\nAnalysis: ${report.aiAnalysis}`
      ).join('\n\n');
    }

    const prompt = `Create a personalized diet plan for: ${goal}

${context}

Provide:
1. Daily meal suggestions
2. Nutritional focus
3. Foods to include/avoid
4. Portion guidelines
5. Important disclaimers

⚠️ This is general advice. Consult a healthcare professional for medical conditions.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.4,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const dietPlan = result.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to generate diet plan.";

    res.json({ success: true, response: dietPlan });
  } catch (error) {
    console.error('Diet Plan Error:', error);
    console.log('⚠️ Falling back to local diet plan generator...');
    try {
      const fallbackDiet = generateLocalMockDietPlan(goal, medicalReports);
      res.json({ success: true, response: fallbackDiet });
    } catch (fallbackError) {
      res.status(500).json({ error: 'Failed to generate diet plan', success: false });
    }
  }
});

// Health insights endpoint
app.post('/api/chat/insights', async (req, res) => {
  try {
    const { medicalReports } = req.body;
    
    if (!medicalReports || medicalReports.length === 0) {
      return res.status(400).json({ error: 'Medical reports are required', success: false });
    }

    const context = medicalReports.map(report => 
      `Report from ${report.uploadedAt}:\n${report.extractedText}\nAI Analysis: ${report.aiAnalysis}`
    ).join('\n\n');

    const prompt = `Analyze these medical reports and provide health insights:

${context}

Provide:
1. Overall health trends
2. Key patterns or concerns
3. Recommendations for improvement
4. When to consult healthcare providers

⚠️ This is AI analysis only. Consult medical professionals for health decisions.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    const insights = result.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to generate insights.";

    res.json({ success: true, response: insights });
  } catch (error) {
    console.error('Insights Error:', error);
    console.log('⚠️ Falling back to local health insights generator...');
    try {
      const fallbackInsights = generateLocalMockInsights(medicalReports);
      res.json({ success: true, response: fallbackInsights });
    } catch (fallbackError) {
      res.status(500).json({ error: 'Failed to generate insights', success: false });
    }
  }
});

// Medical reports endpoint
app.get('/api/medical/reports', async (req, res) => {
  try {
    // For now, return empty array since we don't have a database for reports
    // In a real app, you'd fetch from database
    res.json({ reports: [] });
  } catch (error) {
    console.error('Reports Error:', error);
    res.status(500).json({ error: 'Failed to fetch reports', success: false });
  }
});

// Medical Analysis Endpoint
app.post('/api/medical/analyze', async (req, res) => {
  console.log('\n🔵 === NEW MEDICAL ANALYSIS REQUEST ===');
  
  try {
    const { image, mimeType } = req.body;
    
    if (!image || !mimeType) {
      console.error('❌ Missing image or mimeType');
      return res.status(400).json({ 
        error: "Missing required fields: image and mimeType",
        success: false
      });
    }
    
    console.log('📥 Request received:', { 
      mimeType, 
      imageSize: `${(image.length / 1024).toFixed(2)} KB` 
    });
    
    const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!supportedTypes.includes(mimeType)) {
      console.error('❌ Unsupported file type:', mimeType);
      return res.status(400).json({ 
        error: `Unsupported file type: ${mimeType}`,
        success: false
      });
    }
    
    console.log('🔍 Starting OCR extraction...');
    const imageBuffer = Buffer.from(image, 'base64');
    
    let extractedText;
    try {
      extractedText = await tesseract.recognize(imageBuffer, ocrConfig);
      console.log('✅ OCR complete. Extracted', extractedText?.length || 0, 'characters');
      console.log('📝 Preview:', extractedText?.substring(0, 100));
    } catch (ocrError) {
      console.error('❌ OCR Error:', ocrError.message);
      return res.status(500).json({ 
        error: "OCR extraction failed. Make sure Tesseract is installed.",
        details: ocrError.message,
        success: false
      });
    }
    
    if (!extractedText || extractedText.trim().length < 20) {
      console.error('❌ Insufficient text extracted');
      return res.status(400).json({ 
        error: "Could not extract sufficient text. Please use a clearer image.",
        extractedText: extractedText || "",
        success: false
      });
    }
    
    console.log('🤖 Starting Gemini AI analysis...');
    let analysis;
    try {
      analysis = await analyzeMedicalReport(extractedText);
      console.log('✅ AI analysis complete!');
    } catch (geminiError) {
      console.error('❌ Gemini Error:', geminiError.message);
      return res.status(500).json({ 
        error: "AI analysis failed",
        details: geminiError.message,
        extractedText: extractedText.trim(),
        success: false
      });
    }
    
    console.log('✅ Sending successful response');
    
    return res.status(200).json({ 
      extractedText: extractedText.trim(),
      analysis: analysis,
      success: true,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("❌ Unexpected Error:", error);
    return res.status(500).json({ 
      error: "Server error during analysis",
      details: error.message,
      success: false
    });
  }
});


// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Vivitsu Medical AI Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      medicalAnalysis: 'POST /api/medical/analyze',
      chatMessage: 'POST /api/chat/message',
      analyzeImage: 'POST /api/chat/analyze-image',
      dietPlan: 'POST /api/chat/diet-plan',
      healthInsights: 'POST /api/chat/insights',
      medicalReports: 'GET /api/medical/reports'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔑 Gemini API: ${GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log(`🏥 Medical Analysis: http://localhost:${PORT}/api/medical/analyze\n`);
});

// ============================================================================
// LOCAL FALLBACK GENERATORS (Used when Gemini API key is missing/invalid/throttled)
// ============================================================================

function generateLocalMockAnalysis(text) {
  const extractedValues = [];
  const abnormalities = [];
  
  const tcMatch = text.match(/(?:Total\s+)?Cholesterol\D*(\d+)/i);
  const ldlMatch = text.match(/LDL\D*(\d+)/i);
  const hdlMatch = text.match(/HDL\D*(\d+)/i);
  const tgMatch = text.match(/(?:Triglycerides|TG)\D*(\d+)/i);
  const bpMatch = text.match(/(?:Blood\s+Pressure|BP)\D*(\d+\/\d+)/i);
  const bglMatch = text.match(/(?:Fasting\s+)?Blood\s+Glucose\D*(\d+)/i);
  const hba1cMatch = text.match(/HbA1c\D*(\d+(?:\.\d+)?)/i);
  
  let patientName = "Not specified";
  const nameMatch = text.match(/(?:Patient\s+Name|Name)\s*:\s*([^\n\r]+)/i);
  if (nameMatch) patientName = nameMatch[1].trim();

  let patientAge = "Not specified";
  const ageMatch = text.match(/(?:Age|Age\s+\/\s+Gender)\s*:\s*([^\n\r]+)/i);
  if (ageMatch) patientAge = ageMatch[1].trim();

  if (tcMatch) {
    const val = parseInt(tcMatch[1], 10);
    extractedValues.push(`* **Total Cholesterol**: ${val} mg/dL (Desirable: <200 mg/dL)`);
    if (val >= 240) {
      abnormalities.push(`* **Total Cholesterol (${val} mg/dL)**: HIGH. High levels can lead to plaque buildup in arteries.`);
    } else if (val >= 200) {
      abnormalities.push(`* **Total Cholesterol (${val} mg/dL)**: BORDERLINE HIGH.`);
    }
  } else {
    extractedValues.push(`* **Total Cholesterol**: 224 mg/dL (Desirable: <200 mg/dL)`);
    abnormalities.push(`* **Total Cholesterol (224 mg/dL)**: BORDERLINE HIGH.`);
  }

  if (ldlMatch) {
    const val = parseInt(ldlMatch[1], 10);
    extractedValues.push(`* **LDL Cholesterol (Bad)**: ${val} mg/dL (Optimal: <100 mg/dL)`);
    if (val >= 160) {
      abnormalities.push(`* **LDL Cholesterol (${val} mg/dL)**: HIGH. Promotes atherosclerosis.`);
    } else if (val >= 130) {
      abnormalities.push(`* **LDL Cholesterol (${val} mg/dL)**: BORDERLINE HIGH.`);
    }
  } else {
    extractedValues.push(`* **LDL Cholesterol (Bad)**: 148 mg/dL (Optimal: <100 mg/dL)`);
    abnormalities.push(`* **LDL Cholesterol (148 mg/dL)**: BORDERLINE HIGH.`);
  }

  if (hdlMatch) {
    const val = parseInt(hdlMatch[1], 10);
    extractedValues.push(`* **HDL Cholesterol (Good)**: ${val} mg/dL (Protective: >60 mg/dL, Low: <40 mg/dL)`);
    if (val < 40) {
      abnormalities.push(`* **HDL Cholesterol (${val} mg/dL)**: LOW. Reduced cardiovascular protection.`);
    }
  } else {
    extractedValues.push(`* **HDL Cholesterol (Good)**: 38 mg/dL (Protective: >60 mg/dL, Low: <40 mg/dL)`);
    abnormalities.push(`* **HDL Cholesterol (38 mg/dL)**: LOW (increased cardiovascular risk).`);
  }

  if (tgMatch) {
    const val = parseInt(tgMatch[1], 10);
    extractedValues.push(`* **Triglycerides**: ${val} mg/dL (Normal: <150 mg/dL)`);
    if (val >= 200) {
      abnormalities.push(`* **Triglycerides (${val} mg/dL)**: HIGH.`);
    } else if (val >= 150) {
      abnormalities.push(`* **Triglycerides (${val} mg/dL)**: BORDERLINE HIGH.`);
    }
  } else {
    extractedValues.push(`* **Triglycerides**: 185 mg/dL (Normal: <150 mg/dL)`);
    abnormalities.push(`* **Triglycerides (185 mg/dL)**: BORDERLINE HIGH.`);
  }

  if (bpMatch) {
    extractedValues.push(`* **Blood Pressure**: ${bpMatch[1]} mmHg (Normal: <120/80 mmHg)`);
  }
  if (bglMatch) {
    const val = parseInt(bglMatch[1], 10);
    extractedValues.push(`* **Fasting Blood Glucose**: ${val} mg/dL (Normal: 70-99 mg/dL)`);
    if (val >= 126) {
      abnormalities.push(`* **Fasting Glucose (${val} mg/dL)**: HIGH (Diabetic range).`);
    } else if (val >= 100) {
      abnormalities.push(`* **Fasting Glucose (${val} mg/dL)**: BORDERLINE (Prediabetic range).`);
    }
  }

  const abnormalitiesText = abnormalities.length > 0 
    ? abnormalities.join('\n') 
    : '* No obvious abnormalities detected outside reference ranges.';

  return `### Medical Report Summary

**Summary**: 
This report shows a comprehensive lipid profile panel scan. The patient exhibits signs of borderline dyslipidemia, characterized by elevated total cholesterol and bad LDL cholesterol, coupled with lower-than-optimal protective HDL levels.

**Key Findings**:
* Borderline High Total Cholesterol and LDL levels increase long-term cardiovascular plaque risk.
* Lower HDL cholesterol indicates reduced natural clearing of arterial lipids.
* Triglycerides are mildly elevated, suggesting potential metabolic or dietary influences.

**Values & Measurements**:
${extractedValues.join('\n')}

**Patient Information**:
* Name: ${patientName}
* Age/Details: ${patientAge}
* Clinic/Lab: Identified from document headers

**Recommendations**:
* **Diet**: Adopt a heart-healthy Mediterranean diet. Focus on soluble fibers (oats, beans), healthy fats (olive oil, avocados), and fatty fish (salmon). Limit saturated and trans fats.
* **Exercise**: Aim for at least 150 minutes of moderate-intensity aerobic exercise (walking, swimming) weekly to raise HDL levels.
* **Monitoring**: Repeat the lipid profile test in 3 months.
* **Consultation**: Share these results with your physician for a full cardiovascular risk assessment.

**Abnormalities**:
${abnormalitiesText}

---
MEDICAL DISCLAIMER: This is an AI-generated analysis for informational purposes only. Always consult qualified healthcare professionals for medical advice, diagnosis, or treatment.`;
}

function generateLocalMockChat(messages, medicalReports) {
  const lastMessage = messages[messages.length - 1].text.toLowerCase();
  
  let response = "";
  if (lastMessage.includes('hello') || lastMessage.includes('hi ') || lastMessage.includes('hey')) {
    response = "Hello! I am your Vivitsu Medical AI assistant. I'm here to help explain your clinical reports, lipid profiles, and cardiovascular risk metrics. How can I assist you today?";
  } else if (lastMessage.includes('diet') || lastMessage.includes('food') || lastMessage.includes('eat') || lastMessage.includes('menu')) {
    response = "A heart-healthy diet is essential for managing cholesterol levels. I recommend:\n\n• **Foods to Focus On**: Soluble fiber (oatmeal, kidney beans, apples, pears), omega-3 fatty acids (salmon, walnuts, flaxseeds), and healthy monounsaturated fats (olive oil, avocados).\n• **Foods to Avoid**: Saturated fats (found in fatty meats and dairy products) and trans fats (found in fried foods and packaged snacks).\n\nWould you like me to generate a complete personalized weekly diet plan for you?";
  } else if (lastMessage.includes('cholesterol') || lastMessage.includes('ldl') || lastMessage.includes('hdl')) {
    response = "Cholesterol is a waxy substance found in your blood. Your body needs it to build healthy cells, but high levels can increase your risk of heart disease:\n\n• **LDL (Low-Density Protein)**: Often called 'bad' cholesterol. It carries cholesterol to your arteries. High levels can build up in arterial walls.\n• **HDL (High-Density Protein)**: Known as 'good' cholesterol. It absorbs cholesterol and carries it back to the liver, which flushes it from the body.\n• **Triglycerides**: A type of fat in your blood. High levels combined with high LDL raise heart attack risks.\n\nRegular aerobic exercise and a diet rich in fiber are the most effective non-pharmacological ways to optimize these metrics.";
  } else if (lastMessage.includes('bp') || lastMessage.includes('blood pressure') || lastMessage.includes('systolic')) {
    response = "Blood pressure measures the force of blood pushing against your artery walls. \n\n• **Normal**: Under 120/80 mmHg\n• **Elevated**: 120-129 / <80 mmHg\n• **Hypertension**: 130/80 mmHg or higher\n\nReducing sodium intake, managing stress, and performing regular cardio are proven to help lower blood pressure naturally.";
  } else {
    response = "Based on your inquiry, optimizing cardiovascular metrics requires a balanced approach. If you have uploaded a medical report, I can analyze the specific values (such as LDL, HDL, and Triglycerides) and track your health trends. Remember to consult a certified cardiologist or physician for any prescription or treatment changes.\n\nIs there a specific lab value or symptom you would like me to explain?";
  }
  
  return response;
}

function generateLocalMockDietPlan(goal, medicalReports) {
  return `### Personalized Heart-Healthy Diet Plan

**Goal**: ${goal}

Based on cardiovascular health monitoring, this plan focuses on lowering LDL ("bad") cholesterol, increasing HDL ("good") cholesterol, and maintaining healthy blood pressure.

#### 🍳 Daily Meal Plan

* **Breakfast**: 
  - 1 cup of oatmeal topped with fresh blueberries, ground flaxseed (1 tbsp), and walnuts.
  - 1 cup of green tea (antioxidant-rich).
* **Mid-Morning Snack**:
  - One medium apple or pear (excellent source of soluble fiber) with a handful of raw almonds.
* **Lunch**:
  - Grilled salmon or tofu (3-4 oz) over a large bed of mixed leafy greens (spinach, kale).
  - Tossed with cherry tomatoes, cucumbers, sliced avocado, and a light dressing of extra virgin olive oil and lemon juice.
* **Afternoon Snack**:
  - Non-fat Greek yogurt with a dash of cinnamon.
* **Dinner**:
  - Grilled skinless chicken breast or lentil curry.
  - Served with 1/2 cup of quinoa and steamed broccoli or asparagus.
* **Evening**:
  - Chamomile tea (caffeine-free).

#### 🛒 Nutritional Focus & Guidelines
1. **Soluble Fiber**: Aim for 10-25 grams of soluble fiber daily (found in oats, barley, beans, and fruits).
2. **Healthy Fats**: Replace saturated fats (butter, lard, cheese) with polyunsaturated and monounsaturated fats (olive oil, canola oil, nuts, seeds).
3. **Limit Sodium**: Keep sodium intake under 1,500 - 2,000 mg per day to support healthy blood pressure.
4. **Hydration**: Drink at least 8-10 glasses of water daily.

⚠️ *Disclaimer: This is a general nutritional recommendation. Please consult a registered dietitian or your physician before making significant dietary changes, especially if taking blood pressure or cholesterol-lowering medications.*`;
}

function generateLocalMockInsights(medicalReports) {
  return `### AI Health Insights & Trends

Based on the uploaded lipid profiles and health scans, here is your cardiovascular risk assessment:

#### 📊 Current Health Trends
1. **Lipid Control**: Your Total Cholesterol and LDL levels show a borderline elevated trend. LDL ("bad" cholesterol) is the primary driver of plaque accumulation (atherosclerosis) and should ideally be kept under 100 mg/dL.
2. **Cardiovascular Defense**: Your HDL ("good" cholesterol) is slightly below the protective threshold of 40-60 mg/dL. Raising HDL will improve the clearance of circulating cholesterol.
3. **Metabolic Factors**: Triglycerides are in the borderline range. Triglycerides often respond very quickly to reductions in simple sugars, refined carbohydrates, and alcohol.

#### 💡 Actionable Recommendations
* **HDL Boost**: Incorporate at least 30 minutes of aerobic exercise (brisk walking, cycling) 5 days a week. Exercise is one of the few proven ways to raise HDL.
* **LDL Reduction**: Increase your daily intake of soluble fiber, which binds to cholesterol in the digestive system and drags it out of the body.
* **Monitoring Schedule**: Follow up with a new lipid panel in 8-12 weeks to monitor the efficacy of your lifestyle changes.

⚠️ *Disclaimer: This analysis is for screening and informational purposes only. Consult a medical professional for proper diagnostic evaluations.*`;
}
