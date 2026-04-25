import fetch from 'node-fetch';
fetch("https://esm.sh/react-dom@18.2.0/client?target=es2022")
  .then(r => r.text())
  .then(t => console.log(t));
