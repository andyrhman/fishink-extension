const TRUSTED_JSON = path.join(DATA_DIR, "trusted_website_high_confidence.json");

const THRESHOLD = 0.05685228854417801;

async function loadArtifacts() {
    const [tokenizerRaw, scalerRaw, trustedRaw] = await Promise.all([
        fs.readFile(TOKENIZER_JSON, "utf8"),
        fs.readFile(SCALER_JSON, "utf8"),
        fs.readFile(TRUSTED_JSON, "utf8"),
    ]);

    const tokenizer = JSON.parse(tokenizerRaw);
    const scaler = JSON.parse(scalerRaw);
    const trustedDomains = new Set(
        JSON.parse(trustedRaw).map((d) => String(d).trim().toLowerCase().replace(/^www\./, ""))
    );

    const model = await tf.loadLayersModel(pathToFileURL(MODEL_JSON).href);

    return { model, tokenizer, scaler, trustedDomains };
}

function extractHostname(rawUrl) {
    let url = String(rawUrl || "").trim();
    if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
    }

    try {
        const parsed = new URL(url);
        let hostname = String(parsed.hostname || "").trim().toLowerCase().replace(/\.$/, "");
        if (hostname.startsWith("www.")) hostname = hostname.slice(4);
        return hostname;
    } catch {
        return "";
    }
}

async function predictPhishing(rawUrl) {
    const { model, tokenizer, scaler, trustedDomains } = await loadArtifacts();

    const url = String(rawUrl || "").trim();
    const hostname = extractHostname(url);

    if (trustedDomains.has(hostname) || [...trustedDomains].some((d) => hostname.endsWith("." + d))) {
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

    // console.log("seqTensor shape:", seqTensor.shape);
    // console.log("structTensor shape:", structTensor.shape);
    // console.log("model inputs:", model.inputs.map((i) => i.name));

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

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

try {
    const input = await rl.question("Masukkan URL: ");
    const result = await predictPhishing(input);

    console.log("\nHasil:");
    console.log(JSON.stringify(result, null, 2));
} catch (err) {
    console.error("Gagal:", err.message || err);
} finally {
    rl.close();
}