function getActiveTabHostname() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs?.[0];
            if (!tab?.url) return resolve("-");
            try {
                const hostname = new URL(tab.url).hostname.replace(/^www\./, "");
                resolve(hostname || "-");
            } catch {
                resolve("-");
            }
        });
    });
}

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

function normalizeHost(input) {
    try {
        let value = String(input || "").trim().toLowerCase();
        if (!value) return "";
        if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
        return new URL(value).hostname.replace(/^www\./, "");
    } catch {
        return "";
    }
}

async function renderWhitelist() {
    const { userWhitelist } = await getSettings();
    const list = document.getElementById("whitelist-list");
    list.innerHTML = "";

    if (!userWhitelist.length) {
        const empty = document.createElement("div");
        empty.className = "whitelist-item";
        empty.innerHTML = `<span>Belum ada website di whitelist.</span>`;
        list.appendChild(empty);
        return;
    }

    for (const site of userWhitelist) {
        const row = document.createElement("div");
        row.className = "whitelist-item";
        row.innerHTML = `
      <span>${site}</span>
      <button class="delete-btn" type="button" title="Delete">🗑️</button>
    `;

        row.querySelector(".delete-btn").addEventListener("click", async () => {
            const current = await getSettings();
            const next = current.userWhitelist.filter((item) => item !== site);
            await saveSettings({ userWhitelist: next });
            renderWhitelist();
        });

        list.appendChild(row);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const mainView = document.getElementById("main-view");
    const settingsView = document.getElementById("settings-view");
    const settingsBtn = document.getElementById("settings-btn");
    const backBtn = document.getElementById("back-btn");

    const siteText = document.getElementById("site-text");
    const toggle = document.getElementById("enabled-toggle");
    const statusText = document.getElementById("status-text");
    const enabledLabel = document.getElementById("enabled-label");
    const enabledDesc = document.getElementById("enabled-desc");

    const input = document.getElementById("site-input");
    const addBtn = document.getElementById("add-btn");

    const [hostname, settings] = await Promise.all([
        getActiveTabHostname(),
        getSettings(),
    ]);

    siteText.textContent = hostname;
    toggle.checked = Boolean(settings.enabled);

    const renderStatus = (isEnabled) => {
        enabledLabel.textContent = isEnabled ? "Enabled" : "Disabled";
        enabledDesc.textContent = isEnabled ? "Proteksi aktif" : "Proteksi nonaktif";
        statusText.textContent = isEnabled
            ? "Fishink sedang memantau URL"
            : "Fishink dimatikan sementara";
    };

    renderStatus(toggle.checked);

    toggle.addEventListener("change", async () => {
        await saveSettings({ enabled: toggle.checked });
        renderStatus(toggle.checked);
    });

    settingsBtn.addEventListener("click", async () => {
        mainView.classList.add("hidden");
        settingsView.classList.remove("hidden");
        await renderWhitelist();
    });

    backBtn.addEventListener("click", () => {
        settingsView.classList.add("hidden");
        mainView.classList.remove("hidden");
    });

    const addCurrent = async () => {
        const host = normalizeHost(input.value);
        if (!host) return;

        const current = await getSettings();
        const next = Array.from(new Set([...(current.userWhitelist || []), host]));
        await saveSettings({ userWhitelist: next });
        input.value = "";
        renderWhitelist();
    };

    addBtn.addEventListener("click", addCurrent);

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addCurrent();
        }
    });
});