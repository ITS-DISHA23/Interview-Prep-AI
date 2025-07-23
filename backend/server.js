
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose'); 


const { GoogleGenerativeAI } = require('@google/generative-ai');


const app = express();
const port = 3001;


app.use(cors({
  origin: 'http://localhost:5173' 
}));


app.use(bodyParser.json());


const GEMINI_API_KEY = "AIzaSyAFKwgAvB0hHOnCwJWlmFhpnVLdPZSK4Iw"; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);


const MONGODB_URI = 'mongodb+srv://dishadash11:interview123@cluster0.iau4sno.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'; // Default local DB

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));


const interactionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  userAnswer: { type: String, required: true },
  aiFeedback: { type: String, required: true },
  timestamp: { type: Date, default: Date.now } 
}, { _id: false }); 

const interviewSessionSchema = new mongoose.Schema({
  jobRole: { type: String, required: true },
  userId: { type: String, required: true },
  
  interactions: [interactionSchema],
  sessionStartTime: { type: Date, default: Date.now } 
});

const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);


app.use(async (req, res, next) => {
  let userId;
  
  if (typeof __initial_auth_token !== 'undefined') {
    userId = 'canvas_user_' + (typeof __app_id !== 'undefined' ? __app_id.substring(0, 8) : 'default');
  } else {
    
    userId = 'local_anonymous_' + Math.random().toString(36).substring(2, 15);
  }
  req.userId = userId; 
  next();
});



app.post('/api/generate-question', async (req, res) => {
  const { jobRole } = req.body;

  if (!jobRole) {
    return res.status(400).json({ message: 'Job role is required to generate a question.' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Generate a common technical or behavioral interview question for a "${jobRole}" role. The question should be concise and clear. Do not provide the answer.`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const question = response.text().trim();

    res.json({ question });

  } catch (error) {
    console.error('Error generating question from Gemini API:', error);
    res.status(500).json({ message: 'Failed to generate question. Please try again later.', error: error.message });
  }
});


app.post('/api/evaluate-answer', async (req, res) => {
  const { jobRole, question, userAnswer } = req.body;

  if (!jobRole || !question || !userAnswer) {
    return res.status(400).json({ message: 'Job role, question, and user answer are all required for evaluation.' });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `You are an experienced interviewer. Evaluate the following answer provided by a candidate for a "${jobRole}" role.
    
    Interview Question: "${question}"
    
    Candidate's Answer: "${userAnswer}"
    
    Provide constructive feedback on the answer. Cover the following points:
    1.  **Clarity and Conciseness:** Was the answer clear and to the point?
    2.  **Completeness/Accuracy:** Did it fully address the question? Was it technically accurate (if applicable)?
    3.  **Relevance:** Was the answer relevant to the question and the job role?
    4.  **Improvements:** Suggest specific ways the candidate could improve their answer (e.g., add more detail, provide an example, structure it better, correct any inaccuracies).
    
    Format your feedback clearly with bullet points or numbered lists. Start with a brief overall assessment.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const feedback = response.text().trim();

    res.json({ feedback });

  } catch (error) {
    console.error('Error evaluating answer from Gemini API:', error);
    res.status(500).json({ message: 'Failed to evaluate answer. Please try again later.', error: error.message });
  }
});


app.post('/api/save-session', async (req, res) => {
  const { jobRole, interactions } = req.body;
  const userId = req.userId; 

  if (!userId || !jobRole || !interactions || !Array.isArray(interactions) || interactions.length === 0) {
    return res.status(400).json({ message: 'Missing data for saving session or user ID not available. Interactions array is required.' });
  }

  try {
    const newSession = await InterviewSession.create({
      jobRole,
      userId,
      interactions, 
    });

    res.status(201).json({ message: 'Session saved successfully!', sessionId: newSession._id });
  } catch (error) {
    console.error('Error saving session to MongoDB:', error);
    res.status(500).json({ message: 'Failed to save session.', error: error.message });
  }
});


app.get('/api/get-sessions', async (req, res) => {
  const userId = req.userId; 

  if (!userId) {
    return res.status(401).json({ message: 'User ID not available.' });
  }

  try {
   
    const sessions = await InterviewSession.find({ userId }).sort({ sessionStartTime: -1 });

    
    const formattedSessions = sessions.map(session => ({
      id: session._id, 
      jobRole: session.jobRole,
      userId: session.userId,
      sessionStartTime: session.sessionStartTime ? new Date(session.sessionStartTime).toLocaleString() : 'N/A',
      interactions: session.interactions.map(interaction => ({
        question: interaction.question,
        userAnswer: interaction.userAnswer,
        aiFeedback: interaction.aiFeedback,
        timestamp: interaction.timestamp ? new Date(interaction.timestamp).toLocaleString() : 'N/A'
      }))
    }));

    res.json({ sessions: formattedSessions, userId }); 
  } catch (error) {
    console.error('Error fetching sessions from MongoDB:', error);
    res.status(500).json({ message: 'Failed to fetch sessions.', error: error.message });
  }
});


app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
