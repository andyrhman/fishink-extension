import * as tf from "@tensorflow/tfjs";
import { loadArtifacts, extractHostname } from "./ml/inference.js";
import { sanitizeUrl, textToCharSequence, padSequence, scaleFeatures, extractStructuralFeatures } from "./ml/helper.js";

export async function predictPhishing(rawUrl) {
    const { model, tokenizer, scaler, trustedDomains } = await loadArtifacts();

    const url = String(rawUrl || "").trim();
    const hostname = extractHostname(url);

    if (trustedDomains.has(hostname) || [...trustedDomains].some((d) => hostname.endsWith("." + d))) {
        return {
            url,
            masked_url: sanitizeUrl(url),
            probability: 0,
            estimated_phishing_score: 0,
            threshold: 0.05685228854417801,
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

    const pred = model.predict({
        seq_input: seqTensor,
        structural_input: structTensor,
    });

    const proba = (await pred.data())[0];

    seqTensor.dispose();
    structTensor.dispose();
    if (Array.isArray(pred)) {
        pred.forEach((t) => t.dispose());
    } else {
        pred.dispose();
    }

    const threshold = 0.05685228854417801;
    const estimatedPhishingScore = Number((proba * 100).toFixed(2));

    return {
        url,
        masked_url: maskedUrl,
        probability: proba,
        estimated_phishing_score: estimatedPhishingScore,
        threshold,
        prediction: proba >= threshold ? "PHISHING" : "TERPERCAYA",
        whitelist_override: false,
    };
}