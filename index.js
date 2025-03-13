#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Get CLI arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("❌ Usage: backend-generator <projectName> <schemaFilePath>");
  process.exit(1);
}

const [projectName, schemaPath] = args;
const projectPath = path.join(process.cwd(), projectName);

// Ensure schema.json exists
if (!fs.existsSync(schemaPath)) {
  console.error("❌ Schema file not found:", schemaPath);
  process.exit(1);
}

// Read schema.json
let schema;
try {
  schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  console.log("✅ Loaded schema.json successfully");
} catch (error) {
  console.error("❌ Error parsing schema.json:", error.message);
  process.exit(1);
}

// Ensure project directory exists
if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });

// Dependencies
const dependencies = ["express", "mongoose", "cors", "dotenv", "body-parser"];
const devDependencies = ["nodemon"];

// Create package.json
const packageJson = {
  name: projectName.toLowerCase(),
  version: "1.0.0",
  description: "Generated Node.js Backend",
  main: "server.js",
  scripts: {
    start: "node server.js",
    dev: "nodemon server.js",
  },
};

fs.writeFileSync(
  path.join(projectPath, "package.json"),
  JSON.stringify(packageJson, null, 2)
);
console.log("✅ Created package.json");

// Install dependencies
try {
  console.log("📦 Installing dependencies...");
  process.chdir(projectPath);
  execSync(`npm install ${dependencies.join(" ")}`);
  execSync(`npm install --save-dev ${devDependencies.join(" ")}`);
  console.log("✅ Installed dependencies");
} catch (error) {
  console.error("❌ Error installing dependencies:", error.message);
}

// Create `server.js`
const serverJsContent = `
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/${projectName}";

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Load routes dynamically
const routesPath = path.join(__dirname, "routes");
if (fs.existsSync(routesPath)) {
  fs.readdirSync(routesPath).forEach(file => {
    if (file.endsWith(".js")) {
      const route = require(\`./routes/\${file}\`);
      app.use(\`/\${file.replace("Routes.js", "").toLowerCase()}\`, route);
      console.log(\`✔ Loaded route: /\${file.replace("Routes.js", "").toLowerCase()}\`);
    }
  });
} else {
  console.log("⚠ No routes found!");
}

app.listen(PORT, () => console.log(\`🚀 Server running on port \${PORT}\`));
`.trim();

fs.writeFileSync(path.join(projectPath, "server.js"), serverJsContent);
console.log("✅ Created server.js");

// Create `.env`
fs.writeFileSync(path.join(projectPath, ".env"), `MONGO_URI=mongodb://localhost:27017/${projectName}`);
console.log("✅ Created .env");

// Create directories
const directories = ["models", "routes", "controllers"];
directories.forEach((dir) => {
  fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
});
console.log("✅ Created project structure");

// Generate Models, Controllers, and Routes
Object.keys(schema).forEach((modelName) => {
  const fields = schema[modelName]?.fields;
  if (!fields) {
    console.error(`⚠ Invalid schema structure for ${modelName}`);
    return;
  }

  // Generate Model
  let schemaFields = Object.entries(fields)
    .map(([key, constraints]) => {
      let fieldStr = `${key}: { type: ${constraints.type}`;
      if (constraints.ref) fieldStr += `, ref: "${constraints.ref}"`;
      if (constraints.required) fieldStr += ", required: true";
      if (constraints.unique) fieldStr += ", unique: true";
      if (constraints.default !== undefined) 
        fieldStr += `, default: ${typeof constraints.default === "string" ? `"${constraints.default}"` : constraints.default}`;
      if (constraints.enum) fieldStr += `, enum: ${JSON.stringify(constraints.enum)}`;
      fieldStr += " }";
      return fieldStr;
    })
    .join(",\n  ");

  const modelContent = `
const mongoose = require("mongoose");
const ${modelName}Schema = new mongoose.Schema({ ${schemaFields} }, { timestamps: true });
module.exports = mongoose.model("${modelName}", ${modelName}Schema);
  `.trim();

  fs.writeFileSync(path.join(projectPath, "models", `${modelName}.js`), modelContent);
  console.log(`✅ Created model: ${modelName}.js`);

  // Generate Controller
  const controllerContent = `
const ${modelName} = require("../models/${modelName}");

exports.create = async (req, res) => {
  try { res.status(201).json(await new ${modelName}(req.body).save()); }
  catch (error) { res.status(400).json({ error: error.message }); }
};
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, filter } = req.query;
    let query = {};
    if (search) {
      query.$or = Object.keys(${modelName}.schema.paths)
        .filter((key) => ${modelName}.schema.paths[key].instance === "String")
        .map((key) => ({ [key]: new RegExp(search, "i") }));
    }
    if (filter) {
      Object.assign(query, JSON.parse(filter));
    }
    const data = await ${modelName}.find(query)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.findAll = async (req, res) => {
  try { res.json(await ${modelName}.find()); }
  catch (error) { res.status(500).json({ error: error.message }); }
};

exports.findById = async (req, res) => {
  try { res.json(await ${modelName}.findById(req.params.id)); }
  catch (error) { res.status(500).json({ error: error.message }); }
};

exports.update = async (req, res) => {
  try { res.json(await ${modelName}.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
  catch (error) { res.status(500).json({ error: error.message }); }
};

exports.delete = async (req, res) => {
  try { res.json({ message: "Deleted successfully", data: await ${modelName}.findByIdAndDelete(req.params.id) }); }
  catch (error) { res.status(500).json({ error: error.message }); }
};
  `.trim();

  fs.writeFileSync(path.join(projectPath, "controllers", `${modelName}Controller.js`), controllerContent);
  console.log(`✅ Created controller: ${modelName}Controller.js`);

  // Generate Routes
  const routeContent = `
const express = require("express");
const router = express.Router();
const ${modelName}Controller = require("../controllers/${modelName}Controller");

router.post("/", ${modelName}Controller.create);
router.get("/", ${modelName}Controller.findAll);
router.get("/getAll", ${modelName}Controller.getAll);
router.get("/:id", ${modelName}Controller.findById);
router.put("/:id", ${modelName}Controller.update);
router.delete("/:id", ${modelName}Controller.delete);

module.exports = router;
  `.trim();

  fs.writeFileSync(
    path.join(projectPath, "routes", `${modelName}Routes.js`),
    routeContent
  );
  console.log(`✅ Created route: ${modelName}Routes.js`);
});

console.log("🔥 Backend setup complete! Run:");
console.log(`   cd ${projectName}`);
console.log("   npm run dev");
