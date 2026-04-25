import fetch from 'node-fetch';

fetch("https://esm.sh/react-dom@18.2.0/es2022/client.mjs")
  .then(r => r.text())
  .then(t => console.log(t));
