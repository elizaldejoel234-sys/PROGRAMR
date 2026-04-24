import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/transpile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: `import React, { useState } from "react";\nexport default function App() { return <View></View>; }`,
        filename: "test.tsx",
        projectType: "expo"
      })
    });
    const data = await res.json();
    console.log(JSON.stringify(data).substring(0, 500));
  } catch(e) {
    console.error(e);
  }
}
test();
