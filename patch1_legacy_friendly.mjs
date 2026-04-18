import fs from "fs/promises";

const filePath = "./src/model/model.json";

function getKerasHistory(node) {
    const found = [];

    function walk(value) {
        if (!value) return;

        if (Array.isArray(value)) {
            for (const item of value) walk(item);
            return;
        }

        if (typeof value === "object") {
            if (value.class_name === "__keras_tensor__" && value.config?.keras_history) {
                found.push(value.config.keras_history);
                return;
            }

            for (const v of Object.values(value)) walk(v);
        }
    }

    walk(node);
    return found;
}

const raw = await fs.readFile(filePath, "utf8");
const model = JSON.parse(raw);

const layers =
    model?.modelTopology?.model_config?.config?.layers ||
    model?.modelTopology?.model_config?.layers ||
    [];

for (const layer of layers) {
    if (layer.class_name === "InputLayer" && layer.config) {
        const cfg = layer.config;

        // Keep only batchInputShape
        if (cfg.batch_shape && !cfg.batchInputShape) {
            cfg.batchInputShape = cfg.batch_shape;
        }

        delete cfg.inputShape;
        delete cfg.batch_input_shape;
    }

    if (Array.isArray(layer.inbound_nodes)) {
        const legacyNodes = [];

        for (const node of layer.inbound_nodes) {
            const histories = getKerasHistory(node);

            if (histories.length > 0) {
                legacyNodes.push(
                    histories.map(([sourceLayerName, nodeIndex, tensorIndex]) => [
                        sourceLayerName,
                        nodeIndex,
                        tensorIndex,
                        {},
                    ])
                );
            } else {
                legacyNodes.push([]);
            }
        }

        layer.inbound_nodes = legacyNodes;
    }
}

await fs.writeFile(filePath, JSON.stringify(model, null, 2), "utf8");
console.log("Patched model.json successfully");