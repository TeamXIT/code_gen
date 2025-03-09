const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Project settings
const projectName = "dynamicBackend";
const projectPath = path.join(__dirname, projectName);
const schemaFile = "schema.json";

// Ensure project directory exists
if (!fs.existsSync(projectPath)) fs.mkdirSync(projectPath);

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
console.log("📦 Installing dependencies...");
execSync(`cd ${projectName} && npm install ${dependencies.join(" ")}`);
execSync(`cd ${projectName} && npm install --save-dev ${devDependencies.join(" ")}`);
console.log("✅ Dependencies installed");

// Step 3: Create `server.js`
const serverJsContent = `
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/${projectName}";

// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Auto-load routes
const fs = require("fs");
const routesPath = "./routes";
if (fs.existsSync(routesPath)) {
  fs.readdirSync(routesPath).forEach(file => {
    if (file.endsWith(".js")) {
      const route = require(\`./routes/\${file}\`);
      app.use(\`/\${file.replace("Routes.js", "").toLowerCase()}\`, route);
    }
  });
}

app.listen(PORT, () => console.log(\`🚀 Server running on port \${PORT}\`));
`;
fs.writeFileSync(path.join(projectPath, "server.js"), serverJsContent);
console.log("✅ server.js created");

// Step 4: Create .env file
const envContent = `MONGO_URI=mongodb://localhost:27017/${projectName}`;
fs.writeFileSync(path.join(projectPath, ".env"), envContent);
console.log("✅ .env file created");

// Step 5: Create directories
const directories = ["models", "routes", "controllers"];
directories.forEach((dir) => {
  fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
});
console.log("✅ Base directories created");

// Step 6: Read schema.json
let schema;
try {
  schema = JSON.parse(fs.readFileSync(schemaFile, "utf8").trim());
  console.log("✅ schema.json loaded successfully");
} catch (error) {
  console.error("❌ Error parsing schema.json:", error.message);
  process.exit(1);
}

// Step 7: Generate CRUD files
Object.keys(schema).forEach((modelName) => {
  const fields = schema[modelName].fields;

  // Generate Model
  let schemaFields = Object.keys(fields)
    .map((key) => {
      let constraints = fields[key];
      let fieldStr = `${key}: { type: ${constraints.type}`;

      if (constraints.ref) fieldStr += `, ref: "${constraints.ref}"`;
      if (constraints.required) fieldStr += ", required: true";
      if (constraints.unique) fieldStr += ", unique: true";
      if (constraints.default) 
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
`;
  fs.writeFileSync(path.join(projectPath, "models", `${modelName}.js`), modelContent);
  console.log(`✅ Model created: ${modelName}.js`);

  // Generate Controller with Sorting, Filtering & Searching
  const controllerContent = `
const ${modelName} = require("../models/${modelName}");

exports.create = async (req, res) => {
  try { res.status(201).json(await new ${modelName}(req.body).save()); }
  catch (error) { res.status(400).json({ error: error.message }); }
};

exports.findAll = async (req, res) => {
  try {
    let query = ${modelName}.find();
    
    // Filtering
    ${Object.keys(fields)
      .filter((key) => fields[key].filterable)
      .map((key) => `if (req.query.${key}) query = query.where("${key}").equals(req.query.${key});`)
      .join("\n    ")}

    // Searching
    ${Object.keys(fields)
      .filter((key) => fields[key].searchable)
      .map((key) => `if (req.query.search) query = query.or([{ "${key}": new RegExp(req.query.search, "i") }]);`)
      .join("\n    ")}

    // Sorting
    if (req.query.sortBy) {
      const sortOrder = req.query.order === "desc" ? -1 : 1;
      query = query.sort({ [req.query.sortBy]: sortOrder });
    }

    res.json(await query.exec());
  }
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
`;
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
`;
  fs.writeFileSync(path.join(projectPath, "routes", `${modelName}Routes.js`), routeContent);
  console.log(`✅ Routes created: ${modelName}Routes.js`);
});

console.log("🔥 Project setup complete! Run `cd dynamicBackend && npm run dev` to start the server.");
