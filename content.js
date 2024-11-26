// content.js
let timer = null;
let alertAudio = null;
let soundConfig = null;

fetch(chrome.runtime.getURL('alarmclocksound_base64.json'))
    .then(response => response.json())
    .then(config => {
        soundConfig = config;
        console.log('Sound config loaded successfully');
    })
    .catch(error => {
        console.error('Error loading sound config:', error);
    });

// Initialize the alert sound
function initAlertSound() {
    if (!alertAudio && soundConfig) {
        try {
            alertAudio = new Audio();
            alertAudio.src = soundConfig.alarmSound;
            
            alertAudio.addEventListener('error', (e) => {
                console.error('Error loading audio:', e);
            });
            
            alertAudio.load();
        } catch (error) {
            console.error('Error initializing audio:', error);
        }
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
        sendResponse({status: 'ok'});
        return true;
    }
    
    if (request.action === 'stopAlarm') {
        if (alertAudio) {
            alertAudio.pause();
            alertAudio.currentTime = 0;
        }
        sendResponse({status: 'alarm stopped'});
        return true;
    }

    if (request.action === 'startTimer') {
        clearTimeout(timer);
        if (request.soundAlert) {
            initAlertSound();
        }
        
        timer = setTimeout(() => {
            if (request.stopMedia) {
                const video = document.querySelector('video');
                if (video) {
                    video.pause();
                }
            }
            
            if (request.soundAlert && alertAudio) {
                console.log('Attempting to play sound...');
                alertAudio.loop = false; // Make the alarm loop until stopped
                alertAudio.currentTime = 0;
                alertAudio.volume = 1.0;
                
                alertAudio.play()
                    .then(() => {
                        console.log('Sound playing successfully');
                        chrome.storage.local.set({ isAlarmRinging: true });
                    })
                    .catch(error => {
                        console.error('Error playing alert sound:', error);
                    });
            }
        }, request.duration);

        sendResponse({status: 'timer started'});
        return true;
    }
    
    if (request.action === 'stopTimer') {
        clearTimeout(timer);
        sendResponse({status: 'timer stopped'});
        return true;
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    clearTimeout(timer);
});

// Re-initialize timer if coming back from YouTube history/navigation
document.addEventListener('yt-navigate-finish', () => {
    chrome.runtime.sendMessage({ action: 'checkTimer' });
});