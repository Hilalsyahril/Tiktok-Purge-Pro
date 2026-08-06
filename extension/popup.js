document.getElementById('start').addEventListener('click', () => {
  const mode = document.getElementById('mode').value;
  document.getElementById('log').innerHTML = '<div>Status: RUNNING</div>';
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: "start", mode: mode}, (response) => {
      if (chrome.runtime.lastError || !response) {
        document.getElementById('log').innerHTML = "<div>Error: Harap refresh halaman TikTok terlebih dahulu</div>";
      } else {
        const logContainer = document.getElementById('log');
        const newLog = document.createElement('div');
        newLog.innerText = "Status: " + response.status;
        logContainer.appendChild(newLog);
        document.getElementById('status-val').innerText = "RUNNING";
        document.getElementById('status-val').style.color = "#FE2C55";
      }
    });
  });
});

document.getElementById('stop').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: "stop"}, (response) => {
      if (chrome.runtime.lastError || !response) {
        const logContainer = document.getElementById('log');
        const newLog = document.createElement('div');
        newLog.innerText = "Error: Harap refresh halaman TikTok terlebih dahulu";
        logContainer.appendChild(newLog);
      } else {
        const logContainer = document.getElementById('log');
        const newLog = document.createElement('div');
        newLog.innerText = "Status: " + response.status;
        logContainer.appendChild(newLog);
        document.getElementById('status-val').innerText = "READY";
        document.getElementById('status-val').style.color = "#2ECC71";
      }
    });
  });
});

// Listener for UI updates
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "update_ui") {
    if (request.processed !== undefined) {
      document.getElementById('processed-val').innerText = request.processed;
    }
    if (request.currentBatch !== undefined) {
      document.getElementById('batch-val').innerText = request.currentBatch;
    }
    if (request.logMsg !== undefined) {
      const logContainer = document.getElementById('log');
      const newLog = document.createElement('div');
      newLog.innerText = request.logMsg;
      logContainer.appendChild(newLog);
      
      // Auto-scroll to bottom
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }
});
