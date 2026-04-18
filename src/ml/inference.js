import * as tf from "@tensorflow/tfjs";

let modelPromise = null;
let tokenizerPromise = null;
let scalerPromise = null;
let trustedPromise = null;

function normalizeHostname(hostname) {
    return String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
}

export function extractHostname(rawUrl) {
    let url = String(rawUrl || "").trim();
    if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
    }

    try {
        const parsed = new URL(url);
        let hostname = normalizeHostname(parsed.hostname);
        if (hostname.startsWith("www.")) hostname = hostname.slice(4);
        return hostname;
    } catch {
        return "";
    }
}

export async function loadArtifacts() {
    if (!modelPromise) {
        modelPromise = tf.loadLayersModel(chrome.runtime.getURL("model/model.json"));
    }

    if (!tokenizerPromise) {
        tokenizerPromise = fetch(chrome.runtime.getURL("data/tokenizer.json")).then((r) => r.json());
    }

    if (!scalerPromise) {
        scalerPromise = fetch(chrome.runtime.getURL("data/scaler.json")).then((r) => r.json());
    }

    if (!trustedPromise) {
        trustedPromise = fetch(chrome.runtime.getURL("data/trusted_website_high_confidence.json"))
            .then((r) => r.json())
            .then((arr) => new Set(arr.map((d) => normalizeHostname(d))));
    }

    const [model, tokenizer, scaler, trustedDomains] = await Promise.all([
        modelPromise,
        tokenizerPromise,
        scalerPromise,
        trustedPromise,
    ]);

    return { model, tokenizer, scaler, trustedDomains };
}