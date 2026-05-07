document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const filenameLabel = document.getElementById('filename');
    const removeFileBtn = document.getElementById('remove-file');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('messages');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const currentDocTitle = document.getElementById('current-doc-title');

    let isProcessing = false;

    // --- Upload Logic ---

    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--border)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border)';
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    });

    async function handleFileUpload(file) {
        if (!file.name.endsWith('.pdf')) {
            showError('Please upload a PDF file.');
            return;
        }

        // UI State
        setLoading(true, `Uploading ${file.name}...`);
        
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                // Update UI to show active file
                dropZone.classList.add('hidden');
                fileInfo.classList.remove('hidden');
                filenameLabel.textContent = file.name;
                currentDocTitle.textContent = file.name;
                
                // Enable chat
                userInput.disabled = false;
                sendBtn.disabled = false;
                userInput.focus();
                
                setStatus('active', 'Document Indexed');
                addMessage('ai', `I've successfully indexed **${file.name}**. You can now ask me anything about its content!`);
            } else {
                showError(data.detail || 'Upload failed');
                resetUpload();
            }
        } catch (error) {
            console.error('Error:', error);
            showError('An error occurred during upload.');
            resetUpload();
        } finally {
            setLoading(false);
        }
    }

    removeFileBtn.addEventListener('click', () => {
        resetUpload();
    });

    function resetUpload() {
        dropZone.classList.remove('hidden');
        fileInfo.classList.add('hidden');
        fileInput.value = '';
        userInput.disabled = true;
        sendBtn.disabled = true;
        currentDocTitle.textContent = 'Select a document to begin';
        setStatus('idle', 'Ready to upload');
    }

    // --- Chat Logic ---

    async function sendMessage() {
        const message = userInput.value.trim();
        if (!message || isProcessing) return;

        // Add user message to UI
        addMessage('user', message);
        userInput.value = '';
        
        // Show typing indicator
        const typingId = showTypingIndicator();
        isProcessing = true;
        setLoading(true, 'Thinking...');

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();
            
            removeTypingIndicator(typingId);

            if (response.ok) {
                addMessage('ai', data.answer);
            } else {
                addMessage('ai', 'Sorry, I encountered an error: ' + (data.detail || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator(typingId);
            addMessage('ai', 'Sorry, I failed to connect to the server.');
        } finally {
            isProcessing = false;
            setLoading(false);
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // --- Helpers ---

    function addMessage(type, text) {
        // Remove welcome message if it exists
        const welcome = document.querySelector('.welcome-message');
        if (welcome) welcome.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type}`;
        
        // Simple markdown-style bold support
        const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        msgDiv.innerHTML = formattedText;
        
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function showTypingIndicator() {
        const id = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = id;
        typingDiv.className = 'message ai typing';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return id;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    function setStatus(state, text) {
        statusDot.className = 'dot ' + state;
        statusText.textContent = text;
    }

    function setLoading(isLoading, text) {
        if (isLoading) {
            setStatus('loading', text || 'Processing...');
            sendBtn.disabled = true;
        } else {
            setStatus('active', 'Document Indexed');
            sendBtn.disabled = false;
        }
    }

    function showError(message) {
        setStatus('idle', 'Error occurred');
        statusDot.style.background = '#ef4444'; // Red color for error
        statusDot.style.boxShadow = '0 0 12px #ef4444';
        
        // Show as a temporary toast or chat message
        const toast = document.createElement('div');
        toast.style.position = 'fixed';
        toast.style.top = '20px';
        toast.style.right = '20px';
        toast.style.background = 'rgba(239, 68, 68, 0.9)';
        toast.style.color = 'white';
        toast.style.padding = '12px 24px';
        toast.style.borderRadius = '8px';
        toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        toast.style.zIndex = '1000';
        toast.style.fontWeight = '500';
        toast.style.backdropFilter = 'blur(4px)';
        toast.style.animation = 'messageSlide 0.3s ease-out forwards';
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
            
            // Reset status dot color after a while
            statusDot.style.background = '';
            statusDot.style.boxShadow = '';
        }, 5000);
    }
});
