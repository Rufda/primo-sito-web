// Simple Google AI chatbot using Gemini API
let history = [];

async function callGemini(message) {
  if (!geminiConfig || !geminiConfig.apiKey) {
    throw new Error('Gemini configuration missing');
  }
  const url = `${geminiConfig.endpoint}?key=${geminiConfig.apiKey}`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: message }] }],
    generationConfig: {
      temperature: geminiConfig.temperature,
      maxOutputTokens: geminiConfig.maxOutputTokens
    },
    safetySettings: [{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error('API error: ' + errorText);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Risposta API vuota');
  }
  history.push({ role: 'user', text: message });
  history.push({ role: 'assistant', text });
  return text;
}

document.addEventListener('DOMContentLoaded', () => {
  const messages = document.getElementById('messages');
  const input = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');

  function addMessage(text, sender) {
    const div = document.createElement('div');
    div.className = 'ai-assistant-message ' + sender;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  async function handleSend() {
    const text = input.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    input.value = '';
    try {
      const reply = await callGemini(text);
      addMessage(reply, 'bot');
    } catch(err) {
      addMessage('Errore: ' + err.message, 'bot');
    }
  }

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keypress', e => {
    if (e.key === 'Enter') handleSend();
  });
});
