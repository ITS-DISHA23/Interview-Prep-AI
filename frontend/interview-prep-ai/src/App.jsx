import React, { useState, useEffect, useRef } from 'react'; 
import './App.css'; 

function App() {
  const [jobRole, setJobRole] = useState('Software Engineer (General)');
  const [interviewQuestion, setInterviewQuestion] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [aiFeedback, setAiFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState('Loading User ID...'); 

  const [currentSessionInteractions, setCurrentSessionInteractions] = useState([]);

  
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null); 
  const utteranceRef = useRef(null); 


  
  const jobRoles = [
    'Software Engineer (General)',
    'Frontend Developer (React)',
    'Backend Developer (Node.js)',
    'Data Scientist (Python)',
    'Cloud Engineer (AWS)',
    'Product Manager',
    'DevOps Engineer',
  ];

  
  const fetchUserId = async () => {
    setError('');
    try {
      
      const response = await fetch('http://localhost:3001/api/get-sessions');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch user ID from backend.');
      }
      const data = await response.json();
      setUserId(data.userId || 'N/A');
    } catch (err) {
      console.error("Error fetching user ID:", err);
      setError("Failed to load user ID. Please ensure backend is running.");
      setUserId('Error');
    }
  };

 
  useEffect(() => {
    fetchUserId();
  }, []);

 
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API is not supported in this browser. Voice input will not be available.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      console.log("Voice input started...");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserAnswer(prevAnswer => prevAnswer + (prevAnswer ? ' ' : '') + transcript);
      console.log("Recognized:", transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
      console.log("Voice input ended.");
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      console.error("Speech recognition error:", event.error);
      setError(`Voice input error: ${event.error}. Please ensure microphone access.`);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (window.speechSynthesis && utteranceRef.current) {
        window.speechSynthesis.cancel(); 
      }
    };
  }, []);


  const handleJobRoleChange = (e) => {
    setJobRole(e.target.value);
    startNewSession(); 
  };

 
  const handleUserAnswerChange = (e) => {
    setUserAnswer(e.target.value);
  };

  const readQuestionAloud = () => {
    if ('speechSynthesis' in window && interviewQuestion) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      const utterance = new SpeechSynthesisUtterance(interviewQuestion);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
      utteranceRef.current = utterance; 
    } else {
      console.warn("Text-to-speech not supported or no question to read.");
      setError("Text-to-speech is not supported in your browser or no question available.");
    }
  };

 
  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      setError("Voice input not supported in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setError('');
      recognitionRef.current.start();
    }
  };


  const generateQuestion = async () => {
    if (interviewQuestion && userAnswer) {
     
      const existingIndex = currentSessionInteractions.findIndex(
        i => i.question === interviewQuestion && i.userAnswer === userAnswer
      );
      if (existingIndex === -1) { 
        setCurrentSessionInteractions(prev => [
          ...prev,
          {
            question: interviewQuestion,
            userAnswer: userAnswer,
            aiFeedback: aiFeedback || "No feedback generated for this interaction.", 
          }
        ]);
      } else {
       
        setCurrentSessionInteractions(prev => prev.map((item, index) =>
          index === existingIndex ? { ...item, aiFeedback: aiFeedback || item.aiFeedback } : item
        ));
      }
    }

    setInterviewQuestion('');
    setUserAnswer('');
    setAiFeedback(''); 
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate question.');
      }

      const data = await response.json();
      setInterviewQuestion(data.question);
      
    } catch (err) {
      console.error('Error generating question:', err);
      setError(err.message || 'An unexpected error occurred while generating question. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  
  const evaluateAnswer = async () => {
    if (!userAnswer.trim() || !interviewQuestion.trim()) {
      setError('Please provide an answer and ensure a question is generated.');
      return;
    }

    setAiFeedback('');
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/evaluate-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobRole, question: interviewQuestion, userAnswer }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to evaluate answer.');
      }

      const data = await response.json();
      setAiFeedback(data.feedback);

     
      setCurrentSessionInteractions(prev => {
        const newInteraction = {
          question: interviewQuestion,
          userAnswer: userAnswer,
          aiFeedback: data.feedback,
        };

        const existingIndex = prev.findIndex(
          i => i.question === interviewQuestion && i.userAnswer === userAnswer
        );

        if (existingIndex !== -1) {
          return prev.map((item, index) =>
            index === existingIndex ? newInteraction : item
          );
        } else {
          return [...prev, newInteraction];
        }
      });

    } catch (err) {
      console.error('Error evaluating answer:', err);
      setError(err.message || 'An unexpected error occurred while evaluating answer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const resetCurrentQA = () => {
    setInterviewQuestion('');
    setUserAnswer('');
    setAiFeedback('');
    setError('');
    setIsLoading(false);
  };

  const startNewSession = () => {
    setJobRole('Software Engineer (General)'); 
    setInterviewQuestion('');
    setUserAnswer('');
    setAiFeedback('');
    setCurrentSessionInteractions([]); 
    setError('');
    setIsLoading(false);
  };


  return (
    <div className="app-container">
    
      <div className="main-card">
     
        <div className="header-section">
          <h1 className="app-title">
            AI Interview Prep
          </h1>
          <p className="app-subtitle">
            Your smart companion for interview success!
          </p>
          <p className="user-id-display">
            User ID: {userId}
          </p>
        </div>

        
        <div className="content-area">
          {error && (
            <div className="error-message" role="alert">
              <p className="error-title">Error:</p>
              <p>{error}</p>
            </div>
          )}

          
          <div className="ui-section active"> 
            <h2 className="section-title">Select Your Interview Role</h2>
            <div className="input-group">
              <label htmlFor="job-role-select" className="input-label">
                Choose Role:
              </label>
              <select
                id="job-role-select"
                className="select-input"
                value={jobRole}
                onChange={handleJobRoleChange}
                disabled={isLoading}
              >
                {jobRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div className="button-container">
              <button
                onClick={generateQuestion}
                disabled={isLoading}
                className={`button-primary ${isLoading ? 'button-disabled' : ''}`}
              >
                {isLoading && !interviewQuestion ? (
                  <span className="button-content-loading">
                    <svg className="spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Question...
                  </span>
                ) : (
                  'Generate Interview Question'
                )}
              </button>
            </div>
          </div>

        
          {(currentSessionInteractions.length > 0 || interviewQuestion) && (
            <div className="main-sections-container">
             
              {currentSessionInteractions.length > 0 && (
                <div className="current-session-summary ui-section active">
                  <h2 className="section-title">Current Interview Progress</h2>
                  {currentSessionInteractions.map((interaction, index) => (
                    <div key={index} className="current-interaction-item">
                      <p><strong>Q{index + 1}:</strong> {interaction.question}</p>
                      <p><strong>Your Answer:</strong> {interaction.userAnswer}</p>
                      <p><strong>AI Feedback:</strong> {interaction.aiFeedback}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="ongoing-interview-section">
               
                <div className={`ui-section ${interviewQuestion ? 'active' : ''}`}>
                  {interviewQuestion && (
                    <>
                      <h2 className="section-title">Answer the Question</h2>
                      <div className="question-display">
                        <p className="question-text">
                          {interviewQuestion || 'Question will appear here...'}
                          
                          <button
                            onClick={readQuestionAloud}
                            className="read-aloud-button"
                            title="Read question aloud"
                            disabled={!('speechSynthesis' in window) || isLoading}
                          >
                            
                            
                           <svg xmlns="http://www.w3.org/2000/svg" width="18" height="16" viewBox="0 0 1102 1664"><path fill="currentColor" d="M1152 704v128q0 221-147.5 384.5T640 1404v132h256q26 0 45 19t19 45t-19 45t-45 19H256q-26 0-45-19t-19-45t19-45t45-19h256v-132q-217-24-364.5-187.5T0 832V704q0-26 19-45t45-19t45 19t19 45v128q0 185 131.5 316.5T576 1280t316.5-131.5T1024 832V704q0-26 19-45t45-19t45 19t19 45zM896 320v512q0 132-94 226t-226 94t-226-94t-94-226V320q0-132 94-226T576 0t226 94t94 226z"/></svg>


                          </button>
                        </p>
                      </div>

                      <div className="input-group">
                        <label htmlFor="user-answer-input" className="input-label">
                          Your Answer:
                        </label>
                        <textarea
                          id="user-answer-input"
                          className="textarea-input"
                          placeholder="Type your answer here or use voice input..."
                          value={userAnswer}
                          onChange={handleUserAnswerChange}
                          disabled={isLoading}
                        ></textarea>
                        <div className="button-container voice-input-buttons">
                          <button
                            onClick={toggleVoiceInput}
                            disabled={isLoading || !('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)}
                            className={`button-secondary ${isListening ? 'listening-active' : ''}`}
                          >
                            {isListening ? (
                              <span className="button-content-loading">
                                <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 16 16"><path fill="currentColor" d="M8 10c-1.7 0-3-1.3-3-3V3c0-1.6 1.3-3 3-3c1.6 0 3 1.3 3 3v4c0 1.6-1.4 3-3 3z"/><path fill="currentColor" d="M12 5v2.5c0 1.9-1.8 3.5-3.8 3.5h-.4C5.8 11 4 9.4 4 7.5V5c-.6 0-1 .4-1 1v1.5c0 2.2 1.8 4.1 4 4.4V14c-3 0-2.5 2-2.5 2h7s.5-2-2.5-2v-2.1c2.2-.4 4-2.2 4-4.4V6c0-.6-.4-1-1-1z"/></svg>
                                Listening...
                              </span>
                            ) : (
                              'Start Voice Input'
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="button-container">
                        <button
                          onClick={evaluateAnswer}
                          disabled={isLoading || !userAnswer.trim()}
                          className={`button-secondary ${isLoading || !userAnswer.trim() ? 'button-disabled' : ''}`}
                        >
                          {isLoading && aiFeedback === '' ? (
                            <span className="button-content-loading">
                              <svg className="spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Evaluating Answer...
                            </span>
                          ) : (
                            'Get AI Feedback'
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className={`ui-section ${aiFeedback ? 'active' : ''}`}>
                  {aiFeedback && (
                    <>
                      <h2 className="section-title">AI Feedback</h2>
                      <div className="feedback-display">
                          <pre className="feedback-text">
                            {aiFeedback}
                          </pre>
                        </div>
                      <div className="button-container action-buttons">
                        <button
                          onClick={generateQuestion}
                          disabled={isLoading}
                          className={`button-primary ${isLoading ? 'button-disabled' : ''}`}
                        >
                          {isLoading ? (
                            <span className="button-content-loading">
                              <svg className="spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Generating Next...
                            </span>
                          ) : (
                            'Generate Next Question'
                          )}
                        </button>
                        <button
                          onClick={startNewSession} 
                          disabled={isLoading}
                          className={`button-secondary ${isLoading ? 'button-disabled' : ''}`}
                        >
                          Start New Interview
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
