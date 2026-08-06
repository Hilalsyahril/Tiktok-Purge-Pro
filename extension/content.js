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

async function clickNextVideo(mode) {
    logToUI("Mencoba pindah ke video berikutnya...");
    const currentUrl = window.location.href;
    
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
        attempts++;
        const nextBtns = document.querySelectorAll('[data-e2e="arrow-right"], button[aria-label*="next" i], button[aria-label*="berikutnya" i], [class*="ArrowRight"]');
        if (nextBtns.length > 0) simulateRealClick(nextBtns[nextBtns.length - 1]);

        const arrowEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true, cancelable: true });
        document.dispatchEvent(arrowEvent);

        let retries = 5;
        while (retries > 0) {
            await sleep(500);
            if (window.location.href !== currentUrl) return true;
            retries--;
        }

        logToUI(`Server menahan navigasi. Jeda 2 dtk... (Percobaan ${attempts}/${maxAttempts})`);
        await sleep(2000);
    }

    // --- JURUS PAMUNGKAS & TAB RECOVERY ---
    logToUI("STUCK PARAH! Menutup video untuk mereset memori DOM...");
    const closeBtn = document.querySelector('[data-e2e="browse-close"], button[aria-label="Tutup"], button[aria-label="Close"]');
    if (closeBtn) simulateRealClick(closeBtn);
    else window.history.back();

    logToUI("Mencari tab yang benar sesuai mode operasi...");
    await sleep(2000); 

    // Tentukan kata kunci tab berdasarkan mode
    let fallbackText = '';
    if (mode === 'repost' || mode === 'Remove Reposts') fallbackText = 'postingan ulang';
    else if (mode === 'unlike' || mode === 'Unlike Videos') fallbackText = 'disukai';
    else if (mode === 'unsave' || mode === 'Clear Favorites' || mode === 'favorit') fallbackText = 'favorit';

    // Looping cari Tab (Maksimal 10 detik / 20x 500ms)
    let tabFound = false;
    let tabWait = 20; 
    let targetTab = null;
    
    while(tabWait > 0 && !tabFound) {
        // Coba cari pakai selector data-e2e spesifik (bisa berubah di tiap update TikTok)
        targetTab = document.querySelector(`[data-e2e*="${mode}" i], [data-e2e*="${fallbackText}" i]`);
        
        // Coba cari dari teks semua tab
        if (!targetTab) {
            const allTabs = document.querySelectorAll('[role="tab"], p, span');
            for(let t of allTabs) {
                if(t.textContent.toLowerCase().includes(fallbackText) || t.textContent.toLowerCase().includes(mode)) {
                    targetTab = t.closest('[role="tab"], div') || t;
                    break;
                }
            }
        }
        
        if (targetTab) {
            tabFound = true;
            simulateRealClick(targetTab); 
            logToUI(`Tab [${fallbackText.toUpperCase()}] ditemukan & diklik! Menunggu grid termuat...`);
            await sleep(3000); // Tunggu video muncul
        } else {
            await sleep(500);
            tabWait--;
        }
    }

    // Jika tab benar-benar hilang (bug server TikTok)
    if (!tabFound) {
        logToUI("Tab target TIDAK MUNCUL sama sekali. Melakukan Hard Refresh...");
        window.location.reload();
        await sleep(10000);
        return false;
    }

    // Klik ulang video pertama dari grid yang sudah benar
    const firstVideo = document.querySelector('[data-e2e="user-post-item"] a, a[href*="/video/"]');
    if (firstVideo) {
        logToUI("Membuka ulang video pertama. Mesin Fast-Forward diaktifkan!");
        simulateRealClick(firstVideo);
        await sleep(3000);
        return true; 
    }

    logToUI("Gagal menemukan video di grid. Bot berhenti.");
    return false; 
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
      logToUI(`✅ Batch ke-${batchCount} selesai. Memasuki mode pendinginan 15 detik...`);
      
      chrome.runtime.sendMessage({
          action: "update_ui", 
          processed: videosInCurrentBatch, 
          currentBatch: batchCount, 
      }).catch(() => {});
      
      const closeBtn = document.querySelector(SELECTORS.closeModal);
      if (closeBtn) closeBtn.click();
      
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      
      await sleep(15000); // Jeda 15 detik
      
      videosInCurrentBatch = 0; // RESET angka proses kembali ke 0
      batchCount++;    // TAMBAH angka batch menjadi 2, 3, dst
      batchSize = Math.floor(Math.random() * (120 - 80 + 1) + 80);

      logToUI(`⏳ Pendinginan selesai. Memulai Batch ke-${batchCount}!`);

      const firstVideo = document.querySelector(SELECTORS.videoGrid);
      if (firstVideo) firstVideo.click();
      await sleep(3000);
    }

    let isCleanVideo = false;

    // PERFORM ACTION
    try {
      // 1. WAJIB TUNGGU UI MUNCUL DULU UNTUK SEMUA MODE
      const isUiReady = await waitForActionBar();
      if (!isUiReady) {
          logToUI("Timeout: Action bar tidak muncul. Lanjut ke video berikutnya.");
          isCleanVideo = true;
      } else {
          // 2. SETELAH UI MUNCUL, BARU CARI TOMBOL SESUAI MODE
          let targetButton = null;
          let needsConfirmation = false;

          if (mode === 'repost' || mode === 'Remove Reposts') {
              targetButton = findYellowRepostButton();
              needsConfirmation = true;
          } else if (mode === 'unlike' || mode === 'Unlike Videos') {
              targetButton = findRedLikeButton();
              needsConfirmation = false;
          } else if (mode === 'unsave' || mode === 'Clear Favorites' || mode === 'favorit') {
              targetButton = findYellowFavoriteButton();
              needsConfirmation = false;
          }

          // 3. EKSEKUSI KLIK
          if (targetButton) {
              logToUI("Target aktif ditemukan! Mengeksekusi...");
              simulateRealClick(targetButton);
              
              if (needsConfirmation) {
                  await sleep(1500);
                  let xpath = "//*[contains(text(), 'Hapus postingan ulang') or contains(text(), 'Remove repost')]";
                  let confirmText = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  if (confirmText) {
                      simulateRealClick(confirmText.closest('[role="button"], button') || confirmText.parentElement);
                  }
              }
              
              logToUI("Eksekusi berhasil. Jeda sinkronisasi...");
              // Jeda sebelum lanjut (wajib untuk memberi waktu server TikTok)
              await sleep(3500);
              
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
              logToUI("Video sudah bersih. Melewati... (Fast-Forward)");
              isCleanVideo = true;
          }
      }
    } catch (e) {
      console.error("Error performing action:", e);
      isCleanVideo = true;
    }
    
    if (!isCleanVideo) {
        await randomSleep(1500, 3500); 
    }
    
    // 3. Move to next
    const success = await clickNextVideo(mode);
    if (success) {
      currentVideoIndex++;
      logToUI(`Membuka video ke-${currentVideoIndex}...`);
      if (!isCleanVideo) {
          await randomSleep(3500, 6000);
      } else {
          await sleep(1000); // Fast forward jeda singkat
      }
    } else {
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
