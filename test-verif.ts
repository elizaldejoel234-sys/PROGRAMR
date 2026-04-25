import fetch from 'node-fetch';
fetch("http://localhost:3000/api/run-command", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ command: "echo test" })
}).then(r => r.json()).then(console.log).catch(console.error);
