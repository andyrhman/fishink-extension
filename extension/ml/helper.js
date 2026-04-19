function countMatches(text, regex) {
    const matches = String(text || "").match(regex);
    return matches ? matches.length : 0;
}

function entropy(text) {
    const s = String(text || "");
    if (!s) return 0.0;

    const counts = new Map();
    for (const ch of s) {
        counts.set(ch, (counts.get(ch) || 0) + 1);
    }

    let e = 0.0;
    for (const count of counts.values()) {
        const p = count / s.length;
        e -= p * Math.log2(p);
    }
    return e;
}

export function sanitizeUrl(url) {
    if (url == null) return "";

    let s = String(url).trim().toLowerCase();

    s = s.replace(/^https?:\/\//, "");
    s = s.replace(/^www\./, "");

    s = s.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g, "<EMAIL>");

    s = s.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<IP>");

    s = s.replace(/\b\d{4,}\b/g, "<NUMERIC_ID>");

    s = s.replace(/\b[a-z0-9+/=]{20,}\b/g, "<ENCODED>");

    s = s.replace(/\/{2,}/g, "/");

    return s;
}

export function textToCharSequence(text, tokenizer) {
    const wordIndex = tokenizer.word_index || {};
    const oovToken = tokenizer.oov_token || "<OOV>";
    const oovIndex = wordIndex[oovToken] ?? 1;
    const numWords = tokenizer.num_words ?? Infinity;

    const chars = Array.from(String(text));
    const seq = [];

    for (const ch of chars) {
        const idx = wordIndex[ch];

        if (idx == null) {
            seq.push(oovIndex);
            continue;
        }

        if (idx < numWords) {
            seq.push(idx);
        }
    }

    return seq;
}

export function padSequence(seq, maxLen) {
    const out = new Array(maxLen).fill(0);
    const sliced = seq.slice(0, maxLen);

    for (let i = 0; i < sliced.length; i++) {
        out[i] = sliced[i];
    }

    return out;
}

export function scaleFeatures(features, scaler) {
    const mean = scaler.mean || [];
    const scale = scaler.scale || [];

    return features.map((x, i) => {
        const m = mean[i] ?? 0;
        const s = scale[i] ?? 1;
        return (x - m) / (s || 1);
    });
}

export function extractStructuralFeatures(rawUrl, maskedUrl = "") {
    const fallback = (rawUrlLen) => {
        const v = new Array(32).fill(0);
        v[31] = rawUrlLen;
        return v;
    };

    try {
        const cleanedRaw = String(rawUrl).replace(/[\x00-\x1f\x7f]/g, "");
        const parsedUrl = /^https?:\/\//i.test(cleanedRaw)
            ? cleanedRaw
            : `http://${cleanedRaw}`;

        const parsed = new URL(parsedUrl);

        const domainWithPort = (parsed.host || "").toLowerCase();
        const domain = domainWithPort.split(":")[0];
        const path = (parsed.pathname || "").toLowerCase();
        const query = (parsed.search || "").replace(/^\?/, "").toLowerCase();

        const features = [];

        const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(domain) ? 1.0 : 0.0;

        const domainParts = domain.split(".").filter(Boolean);
        const subdomainDepth = isIp ? 0.0 : Math.max(0, domainParts.length - 2);

        const riskyTlds = [".click", ".xyz", ".top", ".club", ".online", ".site", ".ru", ".tk", ".cf"];
        const isRiskyTld = riskyTlds.some((tld) => domain.endsWith(tld)) ? 1.0 : 0.0;

        const digitRatio = countMatches(domain, /\d/g) / Math.max(1, domain.length);
        const hyphenCount = countMatches(domain, /-/g);
        const domainLen = domain.length;
        const vowelRatio = countMatches(domain, /[aeiou]/g) / Math.max(1, domain.length);

        features.push(subdomainDepth, isRiskyTld, digitRatio, hyphenCount, domainLen, vowelRatio);

        const pathDepth = countMatches(path, /\//g);
        const pathLen = path.length;
        const execExts = [".exe", ".bat", ".sh", ".php", ".dll", ".jar", ".vbs"];
        const hasExec = execExts.some((ext) => path.endsWith(ext)) ? 1.0 : 0.0;
        const hasDoubleExt = countMatches(path, /\./g) >= 2 ? 1.0 : 0.0;
        const pathSpecialChars = countMatches(path, /[-_@~]/g) / Math.max(1, pathLen);

        features.push(pathDepth, pathLen, hasExec, hasDoubleExt, pathSpecialChars);

        const params = new URLSearchParams(query);
        const paramMap = new Map();

        for (const [k, v] of params.entries()) {
            const key = k.toLowerCase();
            if (!paramMap.has(key)) paramMap.set(key, []);
            paramMap.get(key).push(v);
        }

        const sensitiveWords = ["token", "email", "redirect", "url", "next", "file", "auth", "key", "session"];
        const paramCount = paramMap.size;
        const sensitiveCount = [...paramMap.keys()].filter((p) =>
            sensitiveWords.some((s) => p.includes(s))
        ).length;
        const maxValLen = paramMap.size
            ? Math.max(...[...paramMap.values()].map((vals) => String(vals[0] || "").length))
            : 0;

        const encodedChars = countMatches(cleanedRaw, /%/g);
        const queryLen = query.length;

        let decodedQuery = query;
        try {
            decodedQuery = decodeURIComponent(query);
        } catch {
            decodedQuery = query;
        }

        const hasEmailInQuery = decodedQuery.includes("@") ? 1.0 : 0.0;
        const queryDigitRatio = countMatches(query, /\d/g) / Math.max(1, queryLen);

        features.push(
            paramCount,
            sensitiveCount,
            maxValLen,
            encodedChars,
            queryLen,
            hasEmailInQuery,
            queryDigitRatio
        );

        const isPrivateIp =
            isIp &&
                (
                    domain.startsWith("192.168.") ||
                    domain.startsWith("10.") ||
                    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(domain)
                )
                ? 1.0
                : 0.0;

        const obfDecHexOct = /^(0[xX][0-9a-fA-F]+|\d{8,10}|(?:0[0-7]+\.){3}0[0-7]+)$/.test(domain)
            ? 1.0
            : 0.0;

        const hasPort = domainWithPort.includes(":") ? 1.0 : 0.0;

        features.push(isIp, isPrivateIp, obfDecHexOct, hasPort);

        const hasJwt = maskedUrl.includes("<JWT_FORMAT") ? 1.0 : 0.0;
        const hasExtRedirect = maskedUrl.includes("<REF_EXTERNAL") ? 1.0 : 0.0;
        const hasEmailMismatch = maskedUrl.includes("<EMAIL_MISMATCH") ? 1.0 : 0.0;
        const hasExecFile = maskedUrl.includes("<FILE_EXEC") ? 1.0 : 0.0;
        const hasBase64 = maskedUrl.includes("<BASE64") ? 1.0 : 0.0;
        const hasObfRedirect = maskedUrl.includes("<REF_ENCODED") ? 1.0 : 0.0;

        features.push(hasJwt, hasExtRedirect, hasEmailMismatch, hasExecFile, hasBase64, hasObfRedirect);

        features.push(
            entropy(domain),
            entropy(path),
            entropy(query),
            cleanedRaw.length
        );

        if (features.length !== 32) {
            return fallback(cleanedRaw.length);
        }

        return features.map((n) => Number(n));
    } catch {
        return fallback(String(rawUrl).length);
    }
}