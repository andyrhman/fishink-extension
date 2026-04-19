const params = new URLSearchParams(location.search);
const target = params.get("target") || "";
const score = params.get("score") || "";

const targetUrlEl = document.getElementById("target-url");
const scoreTextEl = document.getElementById("score-text");
const proceedBtn = document.getElementById("proceed-unsafe");
const backBtn = document.getElementById("back-safe");

targetUrlEl.textContent = target || "-";
scoreTextEl.textContent = score ? `${score}%` : "-";

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

proceedBtn.addEventListener("click", async () => {
    const tabId = await getActiveTabId();
    if (!tabId || !target) return;

    await sendMessage({
        type: "GO_TARGET",
        tabId,
        target,
    });
});

backBtn.addEventListener("click", () => {
    history.back();
});