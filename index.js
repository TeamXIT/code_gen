const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Project settings
const projectName = "civiX";
const projectPath = path.join(__dirname, projectName);
const schemaFile = "schema.json";

// Ensure project directory exists
if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath, { recursive: true });

// Dependencies
const dependencies = ["express", "mongoose", "cors", "dotenv", "body-parser"];
const devDependencies = ["nodemon"];

// Step 1: Create package.json
const packageJson = {
  name: projectName,
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
console.log("✅ package.json created");

// Step 2: Install dependencies
try {
  console.log("📦 Installing dependencies...");
  process.chdir(projectPath); // Fix: Change directory properly
  execSync(`npm install ${dependencies.join(" ")}`);
  execSync(`npm install --save-dev ${devDependencies.join(" ")}`);
  console.log("✅ Dependencies installed");
} catch (error) {
  console.error("❌ Error installing dependencies:", error.message);
}

// Step 3: Create `server.js`
const serverJsContent = `
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path"); // Fix: Ensure path is included

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/${projectName}";

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

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
console.log("✅ server.js created");

// Step 4: Create .env file
fs.writeFileSync(path.join(projectPath, ".env"), `MONGO_URI=mongodb://localhost:27017/${projectName}`);
console.log("✅ .env file created");

// Step 5: Create directories
const directories = ["models", "routes", "controllers"];
directories.forEach((dir) => {
  fs.mkdirSync(path.join(projectPath, dir), { recursive: true }); // Fix: Use { recursive: true }
});
console.log("✅ Base directories created");

// Step 6: Read schema.json
let schema;
try {
  schema = JSON.parse(fs.readFileSync(path.join(__dirname, schemaFile), "utf8").trim()); // Fix: Ensure correct schema path
  console.log("✅ schema.json loaded successfully");
} catch (error) {
  console.error("❌ Error parsing schema.json:", error.message);
  process.exit(1);
}

// Step 7: Generate CRUD files
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
  console.log(`✅ Model created: ${modelName}.js`);

  // Generate Controller
  const controllerContent = `
const ${modelName} = require("../models/${modelName}");

exports.create = async (req, res) => {
  try { res.status(201).json(await new ${modelName}(req.body).save()); }
  catch (error) { res.status(400).json({ error: error.message }); }
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
  console.log(`✅ Controller created: ${modelName}Controller.js`);

  // Generate Routes
  const routeContent = `
const express = require("express");
const router = express.Router();
const controller = require("../controllers/${modelName}Controller");

router.post("/", controller.create);
router.get("/", controller.findAll);
router.get("/:id", controller.findById);
router.put("/:id", controller.update);
router.delete("/:id", controller.delete);

module.exports = router;
  `.trim();

  fs.writeFileSync(path.join(projectPath, "routes", `${modelName}Routes.js`), routeContent);
  console.log(`✅ Routes created: ${modelName}Routes.js`);
});

console.log("🔥 Setup complete! Run `cd dynamicBackend && npm run dev` to start the server.");
