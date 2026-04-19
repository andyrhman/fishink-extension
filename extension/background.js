import { predictPhishing } from "./ml/predictor.js"; // adjust path if needed

const allowNextNavigation = new Map();

function isHttpUrl(url) {
    return /^https?:\/\//i.test(url);
}

function loaderPageUrl(targetUrl) {
    return chrome.runtime.getURL(
        `loader.html?target=${encodeURIComponent(targetUrl)}`
    );
}

function warningPageUrl(targetUrl, score) {
    return chrome.runtime.getURL(
        `warning.html?target=${encodeURIComponent(targetUrl)}&score=${encodeURIComponent(score)}`
    );
}

chrome.webNavigation.onBeforeNavigate.addListener(
    async (details) => {
        if (details.frameId !== 0 || !isHttpUrl(details.url)) return;

        const allowedUrl = allowNextNavigation.get(details.tabId);
        if (allowedUrl === details.url) {
            allowNextNavigation.delete(details.tabId);
            return;
        }

        chrome.tabs.update(details.tabId, {
            url: loaderPageUrl(details.url),
        });
    },
    { url: [{ schemes: ["http", "https"] }] }
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        if (message?.type === "CHECK_URL") {
            const result = await predictPhishing(message.url);
            sendResponse({ ok: true, result });
            return;
        }

        if (message?.type === "SHOW_WARNING") {
            await chrome.tabs.update(message.tabId, {
                url: warningPageUrl(message.target, message.score),
            });
            sendResponse({ ok: true });
            return;
        }

        if (message?.type === "GO_TARGET") {
            allowNextNavigation.set(message.tabId, message.target);
            await chrome.tabs.update(message.tabId, { url: message.target });
            sendResponse({ ok: true });
            return;
        }

        sendResponse({ ok: false, error: "Unknown message type" });
    })().catch((err) => {
        sendResponse({ ok: false, error: err?.message || String(err) });
    });

    return true;
});