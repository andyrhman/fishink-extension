const params = new URLSearchParams(location.search);
const target = params.get("target") || "";

const statusText = document.getElementById("status-text");
const subtitleText = document.getElementById("subtitle-text");

function getActiveTabId() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            resolve(tabs?.[0]?.id ?? null);
        });
    });
}

function sendMessage(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => resolve(response));
    });
}

(async () => {
    if (!target) {
        statusText.textContent = "URL tidak ditemukan";
        subtitleText.textContent = "Halaman ini tidak punya target yang valid.";
        return;
    }

    statusText.textContent = "Mengecek URL...";
    subtitleText.textContent = "Mohon tunggu, Fishink sedang menganalisis tautan.";

    const response = await sendMessage({ type: "CHECK_URL", url: target });

    if (!response?.ok) {
        statusText.textContent = "Gagal memeriksa URL";
        subtitleText.textContent = response?.error || "Terjadi kesalahan.";
        return;
    }

    const result = response.result;
    const tabId = await getActiveTabId();

    if (result.prediction === "PHISHING") {
        statusText.textContent = "URL berbahaya terdeteksi";
        subtitleText.textContent = "Mengarahkan ke halaman peringatan...";

        await sendMessage({
            type: "SHOW_WARNING",
            tabId,
            target,
            score: result.estimated_phishing_score,
        });

        return;
    }

    statusText.textContent = "URL aman";
    subtitleText.textContent = "Membuka halaman tujuan...";

    await sendMessage({
        type: "GO_TARGET",
        tabId,
        target,
    });
})();