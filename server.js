const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let seatingPlan = {};
let normalizedSeatingMap = {};

function normalizeName(name) {
  return name.trim().toLowerCase();
}

// Load guest list from CSV NOT in GitHub
function loadGuestList() {
  const filePath = path.join(__dirname, "guestlist.csv");

  if (!fs.existsSync(filePath)) {
    console.warn("⚠ guestlist.csv not found. Upload it to the server.");
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  const lines = contents.split(/\r?\n/).filter(line => line.trim() !== "");

  for (let i = 1; i < lines.length; i++) {
    const [nameRaw, tableRaw] = lines[i].split(",");
    if (!nameRaw || !tableRaw) continue;

    const name = nameRaw.trim();
    const table = parseInt(tableRaw.trim(), 10);

    seatingPlan[name] = table;
    normalizedSeatingMap[normalizeName(name)] = name;
  }

  console.log(`Loaded ${Object.keys(seatingPlan).length} guest entries.`);
}

loadGuestList();

const registrations = [];

app.post("/api/register", (req, res) => {
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: "Name is required." });
  }

  const normalized = normalizeName(name);
  const canonicalName = normalizedSeatingMap[normalized];

  if (!canonicalName) {
    return res.status(404).json({
      success: false,
      message: "Name not found. Please check spelling or contact an organiser."
    });
  }

  const tableNumber = seatingPlan[canonicalName];

  const alreadyRegistered = registrations.find(r => normalizeName(r.name) === normalized);
  if (!alreadyRegistered) {
    registrations.push({
      name: canonicalName,
      tableNumber,
      time: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    name: canonicalName,
    tableNumber
  });
});

// CSV download endpoint
app.get("/api/guests.csv", (req, res) => {
  let csv = "Name,Table,Time\n";
  registrations.forEach(r => {
    csv += `"${r.name.replace(/"/g, '""')}",${r.tableNumber},${r.time}\n`;
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=registered-guests.csv");
  res.send(csv);
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
