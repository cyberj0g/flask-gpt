const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');
const output = document.getElementById('output');
const status = document.getElementById('status');

let speechRecognizer;
let convId = crypto.randomUUID();
let lang = 'en-US';
let keepRecognizerRunning = false;
let speechEnabled = true;
let botInitiate = false;
let gotUserInput = false;
let waitingForUserInput = false;

const modeSelect = document.getElementById('mode');
const languageSelect = document.getElementById('language');
const toggleSpeechInput = document.getElementById('toggle-speech');
const toggleBotInitiateInput = document.getElementById('toggle-bot-initiate');
const textInput = document.getElementById('text-input');
const speechIndicator = document.getElementById('status-container')
const sendButton = document.getElementById('send-button');
const starterMessage = 'hello';

function toggleBotInitiate() {
    botInitiate = toggleBotInitiateInput.checked
    localStorage.setItem(toggleBotInitiateInput.id, toggleBotInitiateInput.checked);
}

function toggleSpeech() {
    speechEnabled = toggleSpeechInput.checked;
    localStorage.setItem(toggleSpeechInput.id, toggleSpeechInput.checked);
    if (!speechEnabled)
        speechIndicator.style.display='none';
    else {
        if (gotUserInput && waitingForUserInput)
            speechIndicator.style.display='flex';
    }
    if (speechEnabled) {
        keepRecognizerRunning = true;
        window.speechSynthesis.cancel();
        speechEnabled = startSpeech();
        if (!speechEnabled)
            toggleSpeechInput.checked = false;
    } else {
        keepRecognizerRunning = false;
        if (speechRecognizer != null)
            speechRecognizer.stop();
    }
}

toggleSpeechInput.addEventListener('change', () => {
    gotUserInput = true;
    toggleSpeech();
});

toggleBotInitiateInput.addEventListener('change', () => {
    gotUserInput = true;
    toggleBotInitiate();
});

function addChatMessage(message, isUser, isLoader = false) {
    const messageElement = document.createElement('div');
    if (chat.childElementCount === 0)
        chat.innerHTML = ''
    messageElement.classList.add(isUser ? 'user-message' : 'server-message');
    if (isLoader) {
        messageElement.innerHTML = '<i class="fas fa-spinner fa-pulse"></i>';
    } else {
        messageElement.textContent = message;
    }
    chat.appendChild(messageElement);
    chat.scrollTop = chat.scrollHeight;
    return messageElement;
}

async function playServerResponse(text) {
    window.speechSynthesis.cancel();
    keepRecognizerRunning = false;
    speechRecognizer.stop();
    document.getElementById('status-container').style.display='none';

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const voices = window.speechSynthesis.getVoices();
    const maleVoices = voices.filter((voice) => voice.gender === 'male');

    if (maleVoices.length > 0) {
        utterance.voice = maleVoices[0];
    }
    utterance.pitch = 0.9;
    utterance.onerror = err => {
        console.log(err);
    }
    utterance.onend = (event) => {
        console.log('speech synthesis end');
        if (speechEnabled) {
            keepRecognizerRunning = true;
            waitingForUserInput = true;
            document.getElementById('status-container').style.display = 'flex';
            try {
                speechRecognizer.start();
            } catch (error) {
                console.error(error);
            }
        }
    };
    console.log('speech synthesis start');
    window.speechSynthesis.speak(utterance);
}

async function newUserInput(text, isVisible = true) {
    window.speechSynthesis.cancel();
    if (speechEnabled)
        speechRecognizer.stop();
    if (isVisible)
        addChatMessage(text, true, false);
    const loaderElement = addChatMessage('', false, true);
    document.getElementById('status-container').style.display='none';
    document.getElementById('input-container').enabled = false;
    const response = await fetch('/api/process-text', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({text: text, id: convId, lang: lang, mode: modeSelect.value}),
    });
    const serverResponse = await response.json();
    document.getElementById('input-container').enabled = true;
    chat.removeChild(loaderElement);
    addChatMessage(serverResponse.message, false);
    if (speechEnabled) {
        await playServerResponse(serverResponse.message);
    } else {
        waitingForUserInput = true;
    }
}

function startSpeech() {
    try {
        if (!('webkitSpeechRecognition' in window)) {
            alert('Web Speech API is not supported in this browser. Try using Google Chrome.');
            return false;
        }
        if (speechRecognizer != null) {
            speechRecognizer.stop();
        }
        lang = languageSelect.value;
        speechRecognizer = new webkitSpeechRecognition();
        speechRecognizer.continuous = true;
        speechRecognizer.interimResults = false;
        speechRecognizer.lang = lang;

        speechRecognizer.onstart = () => {
            //status.textContent = 'Listening...';
        };

        speechRecognizer.onresult = async (event) => {
            if (event.results.length > 0) {
                const result = event.results[event.resultIndex];
                if (result.isFinal) {
                    const text = result[0].transcript;
                    newUserInput(text);
                }
            }
        };

        speechRecognizer.onerror = (event) => {
            console.error(event.error);
        };

        speechRecognizer.onend = () => {
            if (keepRecognizerRunning) {
                console.log('Recognition ended because of no input, restarting...')
                speechRecognizer.start();
            }
        };
        speechRecognizer.start();
        keepRecognizerRunning = true;
    } catch (error) {
        console.error(error);
        return false;
    }
    return true;
}

function reset() {
    try {
        window.speechSynthesis.cancel();
    }
    catch {}
    document.getElementById('chat').innerHTML = '';
    if (speechEnabled && gotUserInput && !botInitiate)
        document.getElementById('status-container').style.display='flex';
    else
        document.getElementById('status-container').style.display='none';
    document.getElementById('startBtn').innerText = 'Reset'
    if (speechEnabled && !botInitiate)
        startSpeech();
    if (botInitiate)
        newUserInput(starterMessage, false);
    else
        waitingForUserInput = true;
}

document.getElementById('startBtn').addEventListener('click', () => {
    gotUserInput = true;
    convId = crypto.randomUUID();
    document.getElementById('startBtn').value = 'Reset'
    reset();
});

languageSelect.addEventListener('change', () => {
    gotUserInput = true;
    reset();
});

sendButton.addEventListener('click', async () => {
    gotUserInput = true;
    const text = textInput.value.trim();
    if (text) {
        textInput.value = '';
        newUserInput(text);
    }
});

textInput.addEventListener('keypress', (event) => {
    gotUserInput = true;
    if (event.key === 'Enter') {
        sendButton.click();
    }
});

async function fetchModes() {
    const response = await fetch('/api/modes');
    const modes = await response.json();
    let isFirst = true;
    for (const mode of modes) {
        const option = document.createElement('option');
        option.value = mode.value;
        option.textContent = mode.name;
        if (isFirst) {
            option.selected = true;
            isFirst = false;
        }
        modeSelect.appendChild(option);
    }
}

modeSelect.addEventListener('change', () => {
    localStorage.setItem('selectedMode', modeSelect.value);
});

document.addEventListener('DOMContentLoaded', () => {
    let speech = localStorage.getItem(toggleSpeechInput.id);
    if (speech != null)
        toggleSpeechInput.checked = speech == 'true';
    let initiate = localStorage.getItem(toggleBotInitiateInput.id);
    if (initiate != null)
        toggleBotInitiateInput.checked = initiate == 'true';
    toggleSpeech();
    toggleBotInitiate();
    fetchModes().then(() => {
        var value = localStorage.getItem('selectedMode');
        if (value != null)
            modeSelect.value = value;
    });
});
