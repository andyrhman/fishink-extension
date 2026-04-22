import { predictPhishing } from "./ml/predictor.js";

const EXT_ORIGIN = chrome.runtime.getURL("");
const allowNextNavigation = new Map();

function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(
            { enabled: true, userWhitelist: [] },
            (result) => resolve(result)
        );
    });
}

function saveSettings(values) {
    return new Promise((resolve) => {
        chrome.storage.local.set(values, resolve);
    });
}

function normalizeHost(url) {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return "";
    }
}

function normalizeHostEntry(value) {
    return String(value || "").trim().toLowerCase().replace(/^www\./, "");
}

function matchesHost(host, entries) {
    const list = Array.isArray(entries) ? entries : [];
    const normalizedHost = normalizeHostEntry(host);

    return list.some((entry) => {
        const item = normalizeHostEntry(entry);
        return item && (normalizedHost === item || normalizedHost.endsWith("." + item));
    });
}

async function addHostToWhitelist(url) {
    const host = normalizeHost(url);
    if (!host) return;

    const current = await getSettings();
    const next = Array.from(new Set([...(current.userWhitelist || []), host]));
    await saveSettings({ userWhitelist: next });
}

chrome.webNavigation.onBeforeNavigate.addListener(
    async (details) => {
        if (details.frameId !== 0) return;
        if (!/^https?:\/\//i.test(details.url)) return;
        if (details.url.startsWith(EXT_ORIGIN)) return;

        const settings = await getSettings();
        if (!settings.enabled) return;

        const host = normalizeHost(details.url);
        if (!host) return;

        if (matchesHost(host, settings.userWhitelist)) {
            return;
        }

        const allowedUrl = allowNextNavigation.get(details.tabId);
        if (allowedUrl === details.url) {
            allowNextNavigation.delete(details.tabId);
            return;
        }

        chrome.tabs.update(details.tabId, {
            url: chrome.runtime.getURL(
                `loader.html?target=${encodeURIComponent(details.url)}`
            ),
        });
    },
    { url: [{ schemes: ["http", "https"] }] }
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        if (message?.type === "CHECK_URL") {
            const settings = await getSettings();
            const result = await predictPhishing(
                message.url,
                settings.userWhitelist || []
            );
            sendResponse({ ok: true, result });
            return;
        }

        if (message?.type === "SHOW_WARNING") {
            await chrome.tabs.update(message.tabId, {
                url: chrome.runtime.getURL(
                    `warning.html?target=${encodeURIComponent(message.target)}&score=${encodeURIComponent(
                        message.score ?? ""
                    )}`
                ),
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

        if (message?.type === "ADD_TO_WHITELIST_AND_RELOAD") {
            await addHostToWhitelist(message.target);
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