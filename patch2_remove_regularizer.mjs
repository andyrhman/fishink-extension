import fs from "fs/promises";

const filePath = "./src/model/model.json";

function stripRegularizerFields(obj) {
    if (!obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
        for (const item of obj) stripRegularizerFields(item);
        return;
    }

    for (const key of Object.keys(obj)) {
        const lower = key.toLowerCase();

        if (
            lower.includes("regularizer") ||
            lower === "l2_rate" ||
            lower === "l1_rate"
        ) {
            delete obj[key];
            continue;
        }

        stripRegularizerFields(obj[key]);
    }
}

const raw = await fs.readFile(filePath, "utf8");
const model = JSON.parse(raw);

stripRegularizerFields(model);

await fs.writeFile(filePath, JSON.stringify(model, null, 2), "utf8");
console.log("Removed regularizer fields from model.json");