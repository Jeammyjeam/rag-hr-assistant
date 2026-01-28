// Global variables
let pdfText = '';

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
        const text = await extractTextFromPDF(file);
        pdfText = text;
        
        showStatus(`Successfully loaded ${file.name}`, 'success');
        
        chatSection.classList.remove('hidden');
        questionInput.disabled = false;
        askButton.disabled = false;
        
        addMessage('system', `Document loaded: ${file.name} (${text.length} characters extracted)`);
        
    } catch (error) {
        showStatus('Error processing PDF: ' + error.message, 'error');
        console.error('PDF processing error:', error);
    }
}

// Extract text from PDF
async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async function(e) {
            try {
                const typedArray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument(typedArray).promise;
                let fullText = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }
                
                resolve(fullText);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
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

// Get answer from Gemini API
async function getAnswer(question) {
    const prompt = `You are an HR policy assistant. Answer the following question based ONLY on the provided document. If the answer cannot be found in the document, say so clearly. Include relevant quotes and cite specific sections when possible.

DOCUMENT:
${pdfText}

QUESTION: ${question}

Provide a clear, concise answer with source citations.`;

    const response = await fetch(`${API_CONFIG.endpoint}?key=${API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        })
    });

    if (!response.ok) {
        throw new Error('Failed to get answer from API');
    }

    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || 'No response received';
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
