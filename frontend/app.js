const API = "http://localhost:8000";

async function loadTransactions() {
  const res = await fetch(`${API}/api/transactions/`);
  const txs = await res.json();
  const list = document.getElementById("tx-list");
  list.innerHTML = "";
  for (const tx of txs) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${tx.description} <em>(${tx.category})</em></span><span>${tx.amount}</span>`;
    list.appendChild(li);
  }
}

document.getElementById("tx-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  data.amount = parseFloat(data.amount);
  await fetch(`${API}/api/transactions/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  e.target.reset();
  loadTransactions();
});

document.getElementById("chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = e.target.message;
  const log = document.getElementById("chat-log");
  const msg = input.value;
  log.innerHTML += `<div class="msg user">You: ${msg}</div>`;
  input.value = "";
  const res = await fetch(`${API}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg }),
  });
  const data = await res.json();
  log.innerHTML += `<div class="msg agent">Agent: ${data.reply}</div>`;
});

loadTransactions();
