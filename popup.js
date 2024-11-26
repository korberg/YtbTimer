let timerActive = false;
let isAlarmRinging = false;
let countdownInterval;
let endTime;

document.addEventListener('DOMContentLoaded', () => {
  const startButton = document.getElementById('startTimer');
  const stopButton = document.getElementById('stopTimer');
  const hoursInput = document.getElementById('hours');
  const minutesInput = document.getElementById('minutes');
  const statusDisplay = document.getElementById('status');
  const stopMediaCheckbox = document.getElementById('stopMedia');
  const soundAlertCheckbox = document.getElementById('soundAlert');
  const attribution = document.getElementById('attribution');
  const attributionContent = document.getElementById('attributionContent');
  const stopAlarmButton = document.getElementById('stopAlarm');
  const countdownTimeDisplay = document.getElementById('countdown-time');
  
  stopAlarmButton.style.display = "none";
  countdownTimeDisplay.style.display = "visible";
  
  // Load saved settings
  chrome.storage.local.get(
    ['timerActive', 'endTime', 'hours', 'minutes', 'stopMedia', 'soundAlert', 'isAlarmRinging'], 
    (result) => {hours
      hoursInput.value = result.hours || 1;
      minutesInput.value = result.minutes || 30;
      stopMediaCheckbox.checked = result.stopMedia !== false;
      soundAlertCheckbox.checked = result.soundAlert || false;
      isAlarmRinging = result.isAlarmRinging || false;
      
      timerActive = result.timerActive || false;
      endTime = result.endTime || 0;
      
      if (timerActive && endTime > Date.now()) {
        startCountdown(endTime);
      } else {
        resetTimerState();
      }
      updateButtonStates();
      updateAlarmButton();
    });

  // Add time adjustment buttons functionality
  document.querySelectorAll('.time-button').forEach(button => {
    button.addEventListener('click', () => {
      const adjustment = parseInt(button.dataset.adjust);
      adjustTime(adjustment);
    });
  });

  // Enforce valid minute values
  minutesInput.addEventListener('change', () => {
    let minutes = parseInt(minutesInput.value);
    let hours = parseInt(hoursInput.value);
    
    if (minutes >= 60) {
      hours += Math.floor(minutes / 60);
      minutes = minutes % 60;
      hoursInput.value = hours;
      minutesInput.value = minutes;
    }
    saveTimeSettings();
  });
  attribution.addEventListener('click', () => {
    attributionContent.classList.toggle('hidden');
  })
  hoursInput.addEventListener('change', saveTimeSettings);

  stopMediaCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ stopMedia: stopMediaCheckbox.checked });
  });
  soundAlertCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ soundAlert: soundAlertCheckbox.checked });
  });

  function adjustTime(minutes) {
    let totalMinutes = parseInt(hoursInput.value) * 60 + parseInt(minutesInput.value) + minutes;
    if (totalMinutes < 0) totalMinutes = 0;
    
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    
    hoursInput.value = newHours;
    minutesInput.value = newMinutes;
    saveTimeSettings();
  }

  function saveTimeSettings() {
    chrome.storage.local.set({
      hours: parseInt(hoursInput.value),
      minutes: parseInt(minutesInput.value)
    });
  }

  async function checkCurrentTab() {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    const currentTab = tabs[0];
    
    if (!currentTab.url.includes('youtube.com')) {
      startButton.disabled = true;
      statusDisplay.textContent = 'Please open a YouTube page to use the timer';
      statusDisplay.classList.add('error');
      return false;
    }
    
    statusDisplay.textContent = '';
    return true;
  }
  stopAlarmButton.addEventListener('click', async () => {
      try {
          const tabs = await chrome.tabs.query({active: true, currentWindow: true});
          await chrome.tabs.sendMessage(tabs[0].id, { action: 'stopAlarm' });
          isAlarmRinging = false;
          chrome.storage.local.set({ isAlarmRinging: false });
          countdownTimeDisplay.style.display = 'block';
          updateAlarmButton();
      } catch (error) {
          console.error('Error stopping alarm:', error);
      }   
  });
  startButton.addEventListener('click', async () => {
    if (!await checkCurrentTab()) return;

    const hours = parseInt(hoursInput.value) || 0;
    const minutes = parseInt(minutesInput.value) || 0;
    const totalMilliseconds = (hours * 3600 + minutes * 60) * 1000;
    endTime = Date.now() + totalMilliseconds;

    try {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'startTimer',
        duration: totalMilliseconds,
        stopMedia: stopMediaCheckbox.checked,
        soundAlert: soundAlertCheckbox.checked
      });

      timerActive = true;
      chrome.storage.local.set({ 
        timerActive: true,
        endTime: endTime
      });
      
      startCountdown(endTime);
      updateButtonStates();
      console.log("soundalert checkbox", soundAlertCheckbox.checked);
      statusDisplay.textContent = 'Timer started successfully';
      statusDisplay.classList.remove('error');
    } catch (error) {
      console.error('Error starting timer:', error);
      statusDisplay.textContent = 'Error: Please refresh the YouTube page and try again';
      statusDisplay.classList.add('error');
    }
  });

  stopButton.addEventListener('click', async () => {
    try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        await chrome.tabs.sendMessage(tabs[0].id, { action: 'stopTimer' });

        // Stop alarm if it's ringing
        if (isAlarmRinging) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'stopAlarm' });
            isAlarmRinging = false;
            chrome.storage.local.set({ isAlarmRinging: false });
            countdownTimeDisplay.style.display = 'block';
            updateAlarmButton();
        }

        // Reset everything
        resetTimerState();
        updateButtonStates();
        // Clear status and hide countdown
        statusDisplay.textContent = 'Timer stopped';
        statusDisplay.classList.remove('error');

        isAlarmRinging = false;
        countdownTimeDisplay.style.display = 'block';

        // Reset timer state in storage
        chrome.storage.local.set({ 
            timerActive: false,
            endTime: 0,
            isAlarmRinging: false
        });

    } catch (error) {
        console.error('Error stopping timer:', error);
        statusDisplay.textContent = 'Error: Please refresh the YouTube page and try again';
        statusDisplay.classList.add('error');
    }
  });
  function startCountdown(endTimeMs) {
    // Show the countdown container and time
    //countdownDisplay.style.visibility = 'visible';
    countdownTimeDisplay.style.display = 'block';
    clearInterval(countdownInterval);
    
    function updateCountdown() {
        const now = Date.now();
        const timeLeft = Math.max(0, endTimeMs - now);
        
        if (timeLeft === 0) {
            if(soundAlertCheckbox.checked) {
              isAlarmRinging = true;
              chrome.storage.local.set({ isAlarmRinging: true });
              updateAlarmButton();
              setTimeout(() => {
                isAlarmRinging = false;
                chrome.storage.local.set({ isAlarmRinging: false });
                updateAlarmButton();
              }, 14000);
            }
            
            resetTimerState();
            updateButtonStates();
            statusDisplay.textContent = 'Timer completed';
            // Keep countdown visible when alarm is ringing
            //countdownDisplay.style.visibility = 'visible';
            return;
        }

        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        countdownTimeDisplay.textContent = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  }
  function resetTimerState() {
    clearInterval(countdownInterval);
    timerActive = false;
    
    if (isAlarmRinging) {
        //countdownDisplay.style.visibility = 'hidden';
        countdownTimeDisplay.style.display = 'hidden';
    }
    
    countdownTimeDisplay.textContent = '00:00:00';
    
    chrome.storage.local.set({ 
        timerActive: false,
        endTime: 0,
        isAlarmRinging: isAlarmRinging // Keep alarm state
    });
  }
  function updateButtonStates() {
    startButton.disabled = timerActive;
    stopButton.disabled = !timerActive;
    stopMediaCheckbox.disabled = timerActive;
    soundAlertCheckbox.disabled = timerActive;
  }
  function updateAlarmButton() {
    if (isAlarmRinging) {
        stopAlarmButton.style.display = 'block';
        countdownTimeDisplay.style.display = 'none'; // Keep countdown visible
    } else {
        stopAlarmButton.style.display = 'none';
        countdownTimeDisplay.style.display = 'block';
    }
  }
});

