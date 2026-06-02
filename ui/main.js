const invoke = window.__TAURI__.core.invoke;
const listen = window.__TAURI__.event.listen;

const form = document.querySelector("#form");
const apiKey = document.querySelector("#apiKey");
const toggleKey = document.querySelector("#toggleKey");
const saveKey = document.querySelector("#saveKey");
const launchCodex = document.querySelector("#launchCodex");

let currentState = {
  providerActive: false,
  savedApiKey: "",
};

function syncButtons() {
  saveKey.disabled = apiKey.value.trim().length === 0;
  launchCodex.disabled = !currentState.providerActive;
}

async function refreshState() {
  currentState = await invoke("get_state");
  if (!apiKey.value && currentState.savedApiKey) {
    apiKey.value = currentState.savedApiKey;
  }
  syncButtons();
}

apiKey.addEventListener("input", syncButtons);

apiKey.addEventListener("input", () => {
  saveKey.classList.remove("saved");
});

toggleKey.addEventListener("click", () => {
  const visible = apiKey.type === "text";
  apiKey.type = visible ? "password" : "text";
  toggleKey.setAttribute("aria-label", visible ? "Показать API key" : "Скрыть API key");
  toggleKey.title = visible ? "Показать API key" : "Скрыть API key";
  apiKey.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = apiKey.value.trim();
  if (!key) return;

  saveKey.disabled = true;
  try {
    await invoke("save_key", { apiKey: key });
    saveKey.classList.add("saved");
    await refreshState();
  } catch (error) {
    saveKey.classList.remove("saved");
    syncButtons();
  }
});

launchCodex.addEventListener("click", async () => {
  if (!currentState.providerActive) return;
  launchCodex.disabled = true;
  try {
    await invoke("launch_saved_codex");
    await refreshState();
  } catch (error) {
    syncButtons();
  }
});

listen("zenith-state-changed", refreshState);
refreshState().catch(() => {});
