// TikTok Purge Pro - Content Script Logic
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randomSleep = (min, max) => sleep(Math.floor(Math.random() * (max - min + 1) + min));

let isRunning = false;

function logToUI(msg) {
    console.log(msg);
    chrome.runtime.sendMessage({
        action: "update_ui",
        logMsg: msg
    }).catch(() => {});
}

// Universal selectors using data-e2e and class patterns (Language Agnostic)
const SELECTORS = {
  // Broadened selector strategy for thumbnail detection
  videoGrid: '[data-e2e="user-post-item"], div[class*="DivItemContainerForProfile"], a[href*="/video/"]',
  nextButton: '[data-e2e="arrow-right"], [aria-label*="Next"], [aria-label*="Berikutnya"], [aria-label*="Selanjutnya"]',
  closeModal: '[data-e2e="close-video-modal"], [aria-label="Close"], [aria-label="Tutup"]',
  shareIcon: '[data-e2e="video-share-icon"]',
  likeIcon: '[data-e2e="like-icon"]',
  saveIcon: '[data-e2e="save-icon"]'
};

// Helper: Find element by text content (multi-language support)
const findElementByText = (texts) => {
  const allElements = document.querySelectorAll('div, button, span, p');
  return Array.from(allElements).find(el => 
    texts.some(text => el.innerText?.toLowerCase().includes(text.toLowerCase()))
  );
};

function simulateRealClick(element) {
    const events = ['pointerover', 'pointerenter', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
    events.forEach(eventType => {
        const event = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1
        });
        element.dispatchEvent(event);
    });
}

async function waitForActionBar() {
    logToUI("Menunggu UI dimuat...");
    let retries = 15; // Tingkatkan maksimal tunggu jadi 7.5 detik (15 x 500ms)
    
    while (retries > 0) {
        // Jangan cari div container-nya, langsung cari saja apakah ikon Like atau Komentar sudah muncul
        const isUiLoaded = document.querySelector('[data-e2e="browse-like-icon"], [data-e2e="like-icon"], [data-e2e="comment-icon"], [data-e2e="browse-comment-icon"]');
        
        if (isUiLoaded) {
            logToUI("UI tombol sudah muncul!");
            // Beri ekstra jeda 1 detik agar React selesai menempelkan Event Listener
            await sleep(1000); 
            return true;
        }
        
        await sleep(500); // Tunggu setengah detik, lalu cek lagi
        retries--;
    }
    return false;
}

function findYellowRepostButton() {
    // 1. Cari elemen <a> berdasarkan ID atau data-e2e yang akurat
    const repostAnchor = document.querySelector('a#icon-element-repost, a[data-e2e="video-share-repost"]');
    
    if (repostAnchor) {
        // 2. Cek apakah di dalamnya ada path dengan fill warna kuning (#FFC300)
        // Kadang huruf bisa kapital atau kecil (ffc300)
        const yellowPath = repostAnchor.querySelector('path[fill="#FFC300" i], path[fill="#ffc300" i], path[fill="rgb(255, 195, 0)"]');
        
        if (yellowPath) {
            logToUI("Tombol repost kuning (Aktif) ditemukan secara eksak!");
            return repostAnchor; // Kembalikan tag <a> untuk dieksekusi kliknya
        } else {
            logToUI("Tombol repost ditemukan, tapi warnanya bukan kuning (Belum di-repost).");
        }
    }
    return null;
}

function findRedLikeButton() {
    // Prioritas 1: Cari tombol yang secara eksplisit ditekan (aria-pressed="true")
    const pressedButton = document.querySelector('button[aria-pressed="true"]');
    if (pressedButton && pressedButton.querySelector('[data-e2e="browse-like-icon"], [data-e2e="like-icon"]')) {
        return pressedButton;
    }

    // Prioritas 2: Cari berdasarkan warna RGBA eksak merah TikTok
    const likeIcons = document.querySelectorAll('span[data-e2e="browse-like-icon"], span[data-e2e="like-icon"]');
    for (let icon of likeIcons) {
        // SVG TikTok kadang menaruh warna di atribut 'fill' pada tag <svg> atau tag <path>
        const svgEl = icon.querySelector('svg');
        const pathEl = icon.querySelector('path');
        
        if ((svgEl && svgEl.getAttribute('fill') === 'rgba(254, 44, 85, 1)') || 
            (pathEl && pathEl.getAttribute('fill') === 'rgba(254, 44, 85, 1)')) {
            return icon.closest('button, div[role="button"]');
        }
    }
    return null;
}

function findYellowFavoriteButton() {
    const favIcons = document.querySelectorAll('span[data-e2e="browse-favorite-icon"], span[data-e2e="collect-icon"]');
    for (let icon of favIcons) {
        // Cari path dengan warna kuning spesifik #FACE15 (atau fallback ke warna kuning lain)
        const yellowPath = icon.querySelector('path[fill*="#FACE15" i], path[fill*="rgba(250, 206, 21"], path[fill*="#ffc300" i]');
        if (yellowPath) {
            return icon.closest('button, div[role="button"]');
        }
    }
    return null;
}

async function runAutomation(mode) {
  isRunning = true;
  logToUI(`Memulai otomatisasi mode: ${mode}...`);
  
  let totalProcessed = 0;
  let videosInCurrentBatch = 0;
  let batchCount = 1;
  let currentVideoIndex = 1;
  let batchSize = Math.floor(Math.random() * (120 - 80 + 1) + 80);

  // 1. Open first video
  if (!document.querySelector('[data-e2e="video-modal"]')) {
    // Try to find the thumbnail in the grid. Filter to ensure we get a post item, not header/sidebar.
    const potentialVideos = Array.from(document.querySelectorAll(SELECTORS.videoGrid)).filter(el => {
        // Ensure it's inside the main content area (usually has class related to profile grid)
        return el.closest('div[class*="DivVideoFeedV2"]') || el.closest('div[class*="DivGridContainer"]');
    });

    const firstVideo = potentialVideos[0];
    if (firstVideo) {
      logToUI(`Membuka video ke-${currentVideoIndex}...`);
      firstVideo.click();
      await sleep(3000); // CRITICAL: Wait for modal render
    } else {
      logToUI("No videos found in grid with provided selectors.");
      return;
    }
  }

  // 2. Start loop
  while (isRunning) {
    if (videosInCurrentBatch >= batchSize) {
      logToUI("Batch limit reached. Istirahat 15 detik sebelum lanjut batch berikutnya...");
      const closeBtn = document.querySelector(SELECTORS.closeModal);
      if (closeBtn) closeBtn.click();
      
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      
      const restTime = 15000; // 15 detik
      await sleep(restTime);
      
      videosInCurrentBatch = 0;
      batchCount++;
      batchSize = Math.floor(Math.random() * (120 - 80 + 1) + 80);

      const firstVideo = document.querySelector(SELECTORS.videoGrid);
      if (firstVideo) firstVideo.click();
      await sleep(3000);
    }

    // PERFORM ACTION
    try {
      // 1. WAJIB TUNGGU UI MUNCUL DULU UNTUK SEMUA MODE
      const isUiReady = await waitForActionBar();
      if (!isUiReady) {
          logToUI("Timeout: Action bar tidak muncul. Lanjut ke video berikutnya.");
      } else {
          logToUI("Mencari tombol target...");
          // 2. SETELAH UI MUNCUL, BARU CARI TOMBOL SESUAI MODE
          let targetButton = null;
          let needsConfirmation = false;

          if (mode === 'repost') {
              targetButton = findYellowRepostButton();
              needsConfirmation = true;
          } else if (mode === 'unlike') {
              targetButton = findRedLikeButton();
              needsConfirmation = false;
          } else if (mode === 'unsave') {
              targetButton = findYellowFavoriteButton();
              needsConfirmation = false;
          }

          // 3. EKSEKUSI KLIK
          if (targetButton) {
              if (mode === 'unlike') {
                  logToUI("Target Unlike ditemukan! Mengeksekusi klik...");
              } else {
                  logToUI("Tombol ditemukan! Mengeksekusi klik...");
              }
              simulateRealClick(targetButton);
              
              if (needsConfirmation) {
                  await sleep(1500);
                  let xpath = "//*[contains(text(), 'Hapus postingan ulang') or contains(text(), 'Remove repost')]";
                  let confirmText = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (confirmText) {
                      simulateRealClick(confirmText.closest('[role="button"], button') || confirmText.parentElement);
                      logToUI("Konfirmasi Hapus Repost Berhasil Diklik!");
                  }
              }
              
              logToUI("Berhasil dieksekusi! Menunggu sinkronisasi server...");
              // Jeda sebelum lanjut (wajib untuk memberi waktu server TikTok)
              await sleep(3000);
              
              // UPDATE UI DASHBOARD
              totalProcessed++;
              videosInCurrentBatch++;
              
              chrome.runtime.sendMessage({
                  action: "update_ui",
                  processed: totalProcessed,
                  currentBatch: batchCount,
                  logMsg: "Berhasil memproses video ke-" + totalProcessed
              }).catch(() => {});
              
          } else {
              logToUI("Tombol target tidak ditemukan (mungkin belum di-like/favorit/repost).");
          }
      }
    } catch (e) {
      console.error("Error performing action:", e);
    }
    
    await randomSleep(1500, 3500); 
    
    // 3. Move to next (Using arrow-down as next video on desktop modal)
    const nextBtn = document.querySelector(SELECTORS.nextButton) || document.querySelector('[data-e2e="arrow-down"]');
    if (nextBtn) {
      logToUI("Beralih ke video berikutnya...");
      currentVideoIndex++;
      logToUI(`Membuka video ke-${currentVideoIndex}...`);
      nextBtn.click();
      await randomSleep(3500, 6000);
    } else {
      logToUI("Next button not found.");
      break;
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start") {
    runAutomation(request.mode);
    sendResponse({status: "started"});
  } else if (request.action === "stop") {
    isRunning = false;
    sendResponse({status: "stopped"});
  }
});
