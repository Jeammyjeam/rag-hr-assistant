// Global variables
let pdfText = '';
let chatHistory = [];

// DOM elements
const pdfUpload = document.getElementById('pdf-upload');
const fileInfo = document.getElementById('file-info');
const uploadStatus = document.getElementById('upload-status');
const chatSection = document.getElementById('chat-section');
const chatMessages = document.getElementById('chat-messages');
const questionInput = document.getElementById('question-input');
const askButton = document.getElementById('ask-button');

// Event listeners
pdfUpload.addEventListener('change', handleFileUpload);
askButton.addEventListener('click', handleAskQuestion);
questionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !askButton.disabled) {
        handleAskQuestion();
    }
});

// Handle PDF upload
async function handleFileUpload(event) {
    const file = event.target.files[0];
    
    if (!file) return;
    
    if (file.type !== 'application/pdf') {
        showStatus('Please upload a PDF file', 'error');
        return;
    }

    showStatus('Processing PDF...', 'loading');
    fileInfo.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;

    try {
        const base64Data = await fileToBase64(file);
        const extractedText = await extractPDFText(base64Data);
        
        pdfText = extractedText;
        
        showStatus(`Successfully loaded ${file.name}`, 'success');
        
        // Enable chat section
        chatSection.classList.remove('hidden');
        questionInput.disabled = false;
        askButton.disabled = false;
        
        addMessage('system', `Document loaded: ${file.name} (${extractedText.length} characters extracted)`);
        
    } catch (error) {
        showStatus('Error processing PDF: ' + error.message, 'error');
        console.error('PDF processing error:', error);
    }
}

// Convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// Extract text from PDF using Claude API
async function extractPDFText(base64Data) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'document',
                        source: {
                            type: 'base64',
                            media_type: 'application/pdf',
                            data: base64Data
                        }
                    },
                    {
                        type: 'text',
                        text: 'Extract all text from this PDF document. Return only the extracted text without any additional commentary.'
                    }
                ]
            }]
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to extract PDF text');
    }

    const data = await response.json();
    return data.content[0]?.text || '';
}

// Handle question asking
async function handleAskQuestion() {
    const question = questionInput.value.trim();
    
    if (!question || !pdfText) return;
    
    questionInput.value = '';
    askButton.disabled = true;
    questionInput.disabled = true;
    
    addMessage('user', question);
    addMessage('system', 'Searching document...');
    
    try {
        const answer = await getAnswer(question);
        
        // Remove "searching" message
        const messages = chatMessages.querySelectorAll('.message');
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.classList.contains('system')) {
            lastMessage.remove();
        }
        
        addMessage('assistant', answer);
        
    } catch (error) {
        addMessage('system', 'Error: ' + error.message);
        console.error('Question error:', error);
    } finally {
        askButton.disabled = false;
        questionInput.disabled = false;
        questionInput.focus();
    }
}

// Get answer from Claude API
async function getAnswer(question) {
    const prompt = `You are an HR policy assistant. Answer the following question based ONLY on the provided document. If the answer cannot be found in the document, say so clearly. Include relevant quotes and cite specific sections when possible.

DOCUMENT:
${pdfText}

QUESTION: ${question}

Provide a clear, concise answer with source citations.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            messages: [{
                role: 'user',
                content: prompt
            }]
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to get answer');
    }

    const data = await response.json();
    return data.content[0]?.text || 'No response received';
}

// Add message to chat
function addMessage(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show status message
function showStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = `status show ${type}`;
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
