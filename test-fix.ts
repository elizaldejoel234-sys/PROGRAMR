import * as ReactDOMClient from 'react-dom/client';
const obj = { ...ReactDOMClient, default: ReactDOMClient?.default || ReactDOMClient, __esModule: true };

if (!obj.default.createRoot) {
  console.log("NOT A FUNCTION");
} else {
  console.log("WORKS", obj.default.createRoot);
}
