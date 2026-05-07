/* global state */
const state = {
  documents: [],
  activeDocId: null,
  chatHistory: [],
  isLoading: false,
  modelName: '',
};

/* ── DOM refs ────────────────────────────────────────────────── */
const dropZone       = document.getElementById('drop-zone');
const fileInput      = document.getElementById('file-input');
const fileInputChat  = document.getElementById('file-input-chat');
const uploadCounter  = document.getElementById('upload-counter');
const uploadProgress = document.getElementById('upload-progress');
const progressFill   = document.getElementById('progress-fill');
const progressText   = document.getElementById('progress-text');
const docsList       = document.getElementById('docs-list');
const messagesArea   = document.getElementById('messages-area');
const welcomeState   = document.getElementById('welcome-state');
const userInput      = document.getElementById('user-input');
const sendBtn        = document.getElementById('send-btn');
const docTitle       = document.getElementById('doc-title');
const modelNameEl    = document.getElementById('model-name');
const statusDot      = document.getElementById('status-dot');
const statusLabel    = document.getElementById('status-label');
const toastContainer = document.getElementById('toast-container');
const newChatBtn     = document.getElementById('new-chat-btn');
const sidebarToggle  = document.getElementById('sidebar-toggle');
const sidebar        = document.getElementById('sidebar');

/* ── Init ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  marked.setOptions({ breaks: true, gfm: true });
  await fetchHealth();
  await fetchDocuments();
  setupDragDrop();
  setupInputEvents();
  setupSidebarToggle();
});

/* ── Health check ────────────────────────────────────────────── */
async function fetchHealth() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    state.modelName = data.model || 'AI Model';
    if (modelNameEl) modelNameEl.textContent = state.modelName;
    setStatus('active', 'active');
  } catch {
    if (modelNameEl) modelNameEl.textContent = 'Offline';
    setStatus('error', 'offline');
  }
}

/* ── Fetch existing documents ────────────────────────────────── */
async function fetchDocuments() {
  try {
    const res = await fetch('/documents');
    const docs = await res.json();
    state.documents = docs;
    renderDocsList();
    if (docs.length > 0) {
      setActiveDoc(docs[docs.length - 1].doc_id);
    }
  } catch { /* silent */ }
}

/* ── Drag & Drop ─────────────────────────────────────────────── */
function setupDragDrop() {
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    [...e.target.files].forEach(f => handleFileUpload(f));
    fileInput.value = '';
  });
  fileInputChat.addEventListener('change', e => {
    [...e.target.files].forEach(f => handleFileUpload(f));
    fileInputChat.value = '';
  });
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    [...e.dataTransfer.files].forEach(f => handleFileUpload(f));
  });
  // Whole-window drop
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault();
    [...e.dataTransfer.files]
      .filter(f => f.name.endsWith('.pdf'))
      .forEach(f => handleFileUpload(f));
  });
}

/* ── Upload file ─────────────────────────────────────────────── */
async function handleFileUpload(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Only PDF files are supported.', 'error');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showToast('File too large. Max 20MB.', 'error');
    return;
  }

  // Show progress UI
  uploadProgress.classList.remove('hidden');
  progressFill.style.width = '10%';
  progressText.textContent = `Uploading ${file.name}...`;
  setStatus('loading', 'uploading');

  const formData = new FormData();
  formData.append('file', file);

  try {
    // Animate progress bar
    let pct = 10;
    const progInterval = setInterval(() => {
      pct = Math.min(pct + 10, 85);
      progressFill.style.width = pct + '%';
    }, 300);

    const res = await fetch('/upload', { method: 'POST', body: formData });
    clearInterval(progInterval);
    progressFill.style.width = '100%';
    progressText.textContent = 'Processing...';

    const data = await res.json();

    if (res.ok) {
      state.documents.push(data);
      renderDocsList();
      setActiveDoc(data.doc_id);
      updateUploadCounter();
      showToast(`✓ "${file.name}" indexed (${data.pages} pages)`, 'success');
      // Add welcome AI message
      addAIMessage(`I've indexed **${file.name}** (${data.pages} pages). Ask me anything about its content!`, []);
    } else {
      showToast(data.detail || 'Upload failed', 'error');
    }
  } catch (err) {
    showToast('Connection error during upload.', 'error');
  } finally {
    setTimeout(() => {
      uploadProgress.classList.add('hidden');
      progressFill.style.width = '0%';
    }, 800);
    setStatus('active', 'active');
  }
}

/* ── Documents list rendering ────────────────────────────────── */
function renderDocsList() {
  docsList.innerHTML = '';
  state.documents.forEach(doc => {
    const item = document.createElement('div');
    item.className = 'doc-item' + (doc.doc_id === state.activeDocId ? ' active' : '');
    item.dataset.docId = doc.doc_id;

    const ext = doc.filename.split('.').pop().toLowerCase();
    const iconClass = ext === 'pdf' ? 'fa-file-pdf pdf' :
                      ext === 'docx' ? 'fa-file-word docx' : 'fa-file-alt txt';

    item.innerHTML = `
      <i class="fas ${iconClass} doc-icon ${ext}"></i>
      <span class="doc-name" title="${doc.filename}">${doc.filename}</span>
      <span class="doc-pages">${doc.pages}p</span>
      <button class="doc-delete" data-doc-id="${doc.doc_id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.doc-delete')) return;
      setActiveDoc(doc.doc_id);
    });

    item.querySelector('.doc-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteDocument(doc.doc_id);
    });

    docsList.appendChild(item);
  });
  updateUploadCounter();
}

function updateUploadCounter() {
  const n = state.documents.length;
  uploadCounter.textContent = `${n} Document${n !== 1 ? 's' : ''} Uploaded`;
}

function setActiveDoc(docId) {
  state.activeDocId = docId;
  const doc = state.documents.find(d => d.doc_id === docId);
  if (doc) {
    docTitle.textContent = doc.filename;
    userInput.placeholder = `Ask ChatDoc AI about '${doc.filename}'...`;
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
  // Update highlight
  document.querySelectorAll('.doc-item').forEach(el => {
    el.classList.toggle('active', el.dataset.docId === docId);
  });
}

/* ── Delete document ─────────────────────────────────────────── */
async function deleteDocument(docId) {
  try {
    const res = await fetch(`/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) {
      state.documents = state.documents.filter(d => d.doc_id !== docId);
      if (state.activeDocId === docId) {
        state.activeDocId = null;
        docTitle.textContent = 'ChatDoc AI';
        userInput.placeholder = 'Upload a document to start chatting...';
        userInput.disabled = true;
        sendBtn.disabled = true;
        if (state.documents.length > 0) {
          setActiveDoc(state.documents[state.documents.length - 1].doc_id);
        }
      }
      renderDocsList();
      showToast('Document removed.', 'info');
    }
  } catch {
    showToast('Could not delete document.', 'error');
  }
}

/* ── New Chat ────────────────────────────────────────────────── */
newChatBtn.addEventListener('click', () => {
  state.chatHistory = [];
  // Clear messages but keep welcome
  messagesArea.innerHTML = '';
  if (welcomeState) {
    messagesArea.appendChild(welcomeState);
    welcomeState.classList.remove('hidden');
  } else {
    const ws = document.createElement('div');
    ws.id = 'welcome-state';
    ws.className = 'welcome-state';
    ws.innerHTML = `
      <div class="welcome-icon-wrap"><i class="fas fa-robot welcome-icon"></i></div>
      <h2 class="welcome-title">New Chat</h2>
      <p class="welcome-desc">Your chat has been cleared. Ask a new question about your documents.</p>
    `;
    messagesArea.appendChild(ws);
  }
  showToast('New chat started.', 'info');
});

/* ── Sidebar toggle ──────────────────────────────────────────── */
function setupSidebarToggle() {
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });
}

/* ── Input events ────────────────────────────────────────────── */
function setupInputEvents() {
  sendBtn.addEventListener('click', sendMessage);
  userInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  // Auto-resize textarea
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
  });
}

/* ── Send message ────────────────────────────────────────────── */
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text || state.isLoading) return;

  state.isLoading = true;
  userInput.value = '';
  userInput.style.height = 'auto';
  sendBtn.disabled = true;
  setStatus('loading', 'thinking');

  // Hide welcome
  const ws = document.getElementById('welcome-state');
  if (ws) ws.classList.add('hidden');

  // Append user message
  addUserMessage(text);

  // Show typing indicator
  const typingEl = showTyping();

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, doc_id: state.activeDocId }),
    });
    const data = await res.json();
    removeTyping(typingEl);

    if (res.ok) {
      addAIMessage(data.answer, data.sources || []);
    } else {
      addAIMessage('⚠️ ' + (data.detail || 'An error occurred.'), []);
    }
  } catch (err) {
    removeTyping(typingEl);
    addAIMessage('⚠️ Could not connect to the server. Please check your connection.', []);
  } finally {
    state.isLoading = false;
    sendBtn.disabled = false;
    userInput.disabled = false;
    setStatus('active', 'active');
    userInput.focus();
  }
}

/* ── Message rendering ───────────────────────────────────────── */
function addUserMessage(text) {
  const now = formatTime();
  const row = document.createElement('div');
  row.className = 'message-row user';
  row.innerHTML = `
    <div class="msg-avatar user"><i class="fas fa-user"></i></div>
    <div class="msg-content">
      <div class="msg-bubble">${escapeHtml(text)}</div>
      <div class="msg-meta">
        <span class="msg-time">${now}</span>
        <i class="fas fa-file-alt" style="font-size:0.65rem;color:var(--text-3)" title="Document context"></i>
      </div>
    </div>
  `;
  messagesArea.appendChild(row);
  scrollToBottom();
  state.chatHistory.push({ role: 'user', content: text, timestamp: now });
}

function addAIMessage(text, sources) {
  const now = formatTime();
  const msgId = 'msg-' + Date.now();
  const html = DOMPurify.sanitize(marked.parse(text));

  const row = document.createElement('div');
  row.className = 'message-row ai';
  row.id = msgId;

  let sourcesHtml = '';
  if (sources && sources.length > 0) {
    sourcesHtml = `<div class="sources-row">${sources.map(s =>
      `<span class="source-chip"><i class="fas fa-file-alt"></i> Page ${s.page}</span>`
    ).join('')}</div>`;
  }

  row.innerHTML = `
    <div class="msg-avatar ai"><i class="fas fa-robot"></i></div>
    <div class="msg-content">
      <div class="msg-bubble">${html}</div>
      ${sourcesHtml}
      <div class="msg-meta">
        <span class="msg-time">${now}</span>
        <div class="msg-actions">
          <button class="action-btn like-btn" title="Like"><i class="fas fa-thumbs-up"></i></button>
          <button class="action-btn dislike-btn" title="Dislike"><i class="fas fa-thumbs-down"></i></button>
          <button class="action-btn copy-btn" data-text="${escapeAttr(text)}" title="Copy"><i class="fas fa-copy"></i></button>
        </div>
      </div>
    </div>
  `;

  // Action handlers
  row.querySelector('.like-btn').addEventListener('click', function() {
    this.classList.toggle('liked');
  });
  row.querySelector('.dislike-btn').addEventListener('click', function() {
    this.classList.toggle('disliked');
  });
  row.querySelector('.copy-btn').addEventListener('click', async function() {
    const raw = this.dataset.text;
    await navigator.clipboard.writeText(raw).catch(() => {});
    this.classList.add('copied');
    this.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => {
      this.classList.remove('copied');
      this.innerHTML = '<i class="fas fa-copy"></i>';
    }, 1500);
  });

  messagesArea.appendChild(row);
  scrollToBottom();
  state.chatHistory.push({ role: 'ai', content: text, timestamp: now });
}

/* ── Typing indicator ────────────────────────────────────────── */
function showTyping() {
  const row = document.createElement('div');
  row.className = 'message-row ai';
  row.innerHTML = `
    <div class="msg-avatar ai"><i class="fas fa-robot"></i></div>
    <div class="msg-content">
      <div class="msg-bubble typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  messagesArea.appendChild(row);
  scrollToBottom();
  return row;
}
function removeTyping(el) { if (el) el.remove(); }

/* ── Status helpers ──────────────────────────────────────────── */
function setStatus(state, label) {
  if (statusDot) statusDot.className = 'status-dot ' + state;
  if (statusLabel) statusLabel.textContent = label;
}

/* ── Scroll to bottom ────────────────────────────────────────── */
function scrollToBottom() {
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

/* ── Toast notifications ─────────────────────────────────────── */
function showToast(message, type = 'info') {
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${icons[type]}"></i>
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ── Utils ───────────────────────────────────────────────────── */
function formatTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
