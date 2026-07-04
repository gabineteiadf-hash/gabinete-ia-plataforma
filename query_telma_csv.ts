import fetch from "node-fetch";

async function run() {
  const fileId = "1bkmW6f7l42-kor9bTFC67BGyH1kDNf9pyTA946yJvmY";
  const downloadUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=csv`;

  console.log("Downloading CSV...");
  const res = await fetch(downloadUrl);
  const text = await res.text();
  const lines = text.split(/\r?\n/);

  console.log(`Downloaded ${lines.length} lines. Searching for "TELMA" or similar...`);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.toUpperCase().includes("TELMA")) {
      console.log(`Line ${i}: ${line}`);
    }
  }
}

run();
