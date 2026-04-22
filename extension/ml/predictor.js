import * as tf from "@tensorflow/tfjs";
import { loadArtifacts, extractHostname } from "./inference.js";
import {
    sanitizeUrl,
    textToCharSequence,
    padSequence,
    scaleFeatures,
    extractStructuralFeatures,
} from "./helper.js";

const THRESHOLD = 0.05685228854417801;

function normalizeHostEntry(value) {
    return String(value || "").trim().toLowerCase().replace(/^www\./, "");
}

function matchesHost(host, entries) {
    const list = entries instanceof Set ? [...entries] : Array.isArray(entries) ? entries : [];
    const normalizedHost = normalizeHostEntry(host);

    return list.some((entry) => {
        const item = normalizeHostEntry(entry);
        return item && (normalizedHost === item || normalizedHost.endsWith("." + item));
    });
}

export async function predictPhishing(rawUrl, userWhitelist = []) {
    const { model, tokenizer, scaler, trustedDomains } = await loadArtifacts();

    const url = String(rawUrl || "").trim();
    const hostname = extractHostname(url);

    if (matchesHost(hostname, trustedDomains) || matchesHost(hostname, userWhitelist)) {
        return {
            url,
            masked_url: sanitizeUrl(url),
            probability: 0,
            estimated_phishing_score: 0,
            threshold: THRESHOLD,
            prediction: "TERPERCAYA",
            whitelist_override: true,
            matched_trusted_domain: hostname,
        };
    }

    const maskedUrl = sanitizeUrl(url);

    const seq = textToCharSequence(maskedUrl, tokenizer);
    const paddedSeq = padSequence(seq, 250);

    const structuralFeatures = extractStructuralFeatures(url, maskedUrl);
    const scaledFeatures = scaleFeatures(structuralFeatures, scaler);

    const seqTensor = tf.tensor2d([paddedSeq], [1, 250], "float32");
    const structTensor = tf.tensor2d([scaledFeatures], [1, 32], "float32");

    const pred = model.predict([seqTensor, structTensor]);
    const mainPred = Array.isArray(pred) ? pred[0] : pred;
    const proba = (await mainPred.data())[0];

    seqTensor.dispose();
    structTensor.dispose();

    if (Array.isArray(pred)) {
        pred.forEach((t) => t.dispose());
    } else {
        pred.dispose();
    }

    return {
        url,
        masked_url: maskedUrl,
        probability: proba,
        estimated_phishing_score: Number((proba * 100).toFixed(2)),
        threshold: THRESHOLD,
        prediction: proba >= THRESHOLD ? "PHISHING" : "TERPERCAYA",
        whitelist_override: false,
        matched_trusted_domain: null,
    };
}