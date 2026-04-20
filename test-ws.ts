import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:3000/terminal');
ws.on('open', () => {
  console.log('Connected!');
  ws.send('ls\n');
});
ws.on('message', (data) => {
  console.log('Received:', data.toString());
  ws.close();
  process.exit(0);
});
ws.on('error', (err) => {
  console.error('Error:', err);
  process.exit(1);
});
setTimeout(() => {
  console.error('Timeout');
  process.exit(1);
}, 5000);
