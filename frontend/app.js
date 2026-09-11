const API = "http://localhost:8000";

const CAT_ICON = {
  food: "🍔",
  transport: "🚌",
  subscriptions: "📺",
  shopping: "🛍️",
  utilities: "💡",
  entertainment: "🎬",
  health: "💊",
};

function catIcon(cat) {
  return CAT_ICON[(cat || "").toLowerCase()] || "🏷️";
}

function formatMoney(n) {
  return "$" + Number(n).toFixed(2);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

async function fetchTransactions() {
  const res = await fetch(`${API}/api/transactions/`);
  return res.json();
}

async function refresh() {
  try {
    const txs = await fetchTransactions();
    renderStats(txs);
    renderList(txs);
  } catch (e) {
    console.error(e);
  }
}

function renderStats(txs) {
  const total = txs.reduce((s, t) => s + parseFloat(t.amount), 0);
  document.getElementById("stat-total").textContent = formatMoney(total);
  document.getElementById("stat-meta").textContent =
    "across " + txs.length + (txs.length === 1 ? " transaction" : " transactions");
  document.getElementById("tx-count-pill").textContent = txs.length;
}

function renderList(txs) {
  const list = document.getElementById("tx-list");
  if (txs.length === 0) {
    list.innerHTML = `<li class="tx-empty">Nothing here yet. Add your first transaction above.</li>`;
    return;
  }
  list.innerHTML = txs.map((tx) => {
    const cat = (tx.category || "").toLowerCase().trim();
    const catClass = cat ? `cat-${escapeHtml(cat)}` : "cat-uncategorized";
    return `
      <li class="tx-item" data-id="${tx.id}">
        <div class="tx-cat ${catClass}">${catIcon(cat)}</div>
        <div class="tx-meta">
          <span class="tx-desc">${escapeHtml(tx.description)}</span>
          <span class="tx-sub">
            ${cat ? `<span class="cat-pill ${catClass}">${escapeHtml(cat)}</span>` : ""}
            <span>${formatDate(tx.created_at)}</span>
          </span>
        </div>
        <span class="tx-amount">${formatMoney(tx.amount)}</span>
        <button class="tx-delete" aria-label="Delete" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </button>
      </li>
    `;
  }).join("");
}

document.getElementById("tx-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.amount = parseFloat(data.amount);
  data.category = (data.category || "").trim() || null;
  await fetch(`${API}/api/transactions/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  e.target.reset();
  await refresh();
});

document.getElementById("tx-list").addEventListener("click", async (e) => {
  const btn = e.target.closest(".tx-delete");
  if (!btn) return;
  const li = btn.closest(".tx-item");
  const id = li.dataset.id;
  if (!confirm("Delete this transaction?")) return;
  await fetch(`${API}/api/transactions/${id}`, { method: "DELETE" });
  await refresh();
});

const chatLog = document.getElementById("chat-log");

function addMsg(role, text, isError = false) {
  const div = document.createElement("div");
  div.className = `msg ${role}${isError ? " error" : ""}`;
  div.innerHTML = `<div class="bubble">${escapeHtml(text)}</div>`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

function addTyping() {
  const div = document.createElement("div");
  div.className = "msg agent typing";
  div.innerHTML = `<div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

document.getElementById("chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = e.target.message;
  const msg = input.value.trim();
  if (!msg) return;

  addMsg("user", msg);
  input.value = "";
  const typing = addTyping();

  let replyText;
  let isError = false;
  try {
    const res = await fetch(`${API}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });
    const data = await res.json();
    if (!res.ok) {
      replyText = data.detail || "Request failed.";
      isError = true;
    } else if (!data.reply) {
      replyText = "I couldn't produce an answer. Try rephrasing.";
    } else {
      replyText = data.reply;
    }
  } catch (err) {
    replyText = `Network error: ${err.message}`;
    isError = true;
  }

  typing.remove();
  addMsg("agent", replyText, isError);
});

refresh();
