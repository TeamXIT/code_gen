Backend Generator

This is a Node.js Express & MongoDB backend generator that creates a fully functional API based on a given JSON schema. It automates model, controller, and route generation.

SAMPLE SCHEMA:

{
    "User": {
      "fields": {
        "name": { "type": "String", "required": true, "searchable": true },
        "email": { "type": "String", "required": true, "unique": true, "filterable": true },
        "password": { "type": "String", "required": true },
        "role": { "type": "String", "enum": ["admin", "user"], "default": "user", "filterable": true },
        "createdAt": { "type": "Date", "default": "Date.now", "sortable": true }
      }
    },
    "Product": {
      "fields": {
        "name": { "type": "String", "required": true, "searchable": true },
        "description": { "type": "String", "searchable": true },
        "price": { "type": "Number", "required": true, "sortable": true, "filterable": true },
        "category": { "type": "String", "filterable": true },
        "stock": { "type": "Number", "default": 0, "sortable": true },
        "createdAt": { "type": "Date", "default": "Date.now", "sortable": true }
      }
    },
    "Order": {
      "fields": {
        "userId": { "type": "mongoose.Schema.Types.ObjectId", "ref": "User", "required": true },
        "products": { 
          "type": "Array", 
          "required": true, 
          "items": { 
            "productId": { "type": "mongoose.Schema.Types.ObjectId", "ref": "Product" },
            "quantity": { "type": "Number", "required": true }
          } 
        },
        "totalAmount": { "type": "Number", "required": true, "sortable": true },
        "status": { "type": "String", "enum": ["pending", "shipped", "delivered", "cancelled"], "default": "pending", "filterable": true },
        "createdAt": { "type": "Date", "default": "Date.now", "sortable": true }
      }
    },
    "Category": {
    "fields": {
      "title": { "type": "String", "required": true },
      "description": { "type": "String" }
    }
  }
  }
  

📌 Features

Automatic CRUD API generation

Express.js for routing

Mongoose for MongoDB integration

Environment variable support with .env

Dynamic route loading

🚀 Getting Started

1️⃣ Generate the Backend

Run the following command to generate your backend project:

node backend-generator myProject schema.json

myProject: The name of your new project folder.

schema.json: The path to the schema defining your models.

2️⃣ Navigate to the Project

cd myProject

3️⃣ Install Dependencies

npm install

4️⃣ Start the Server

For production:

npm start

For development (auto-restarts on changes):

npm run dev

📂 Project Structure

myProject/
│-- models/          # Mongoose models
│-- controllers/     # API logic
│-- routes/          # Express routes
│-- server.js        # Entry point
│-- .env             # Environment variables
│-- package.json     # Project config

📌 API Endpoints

Each model in your schema will have these endpoints automatically:

Create: POST /model

Get All: GET /model

Get by ID: GET /model/:id

Update: PUT /model/:id

Delete: DELETE /model/:id

🛠 Configuration

Set your database connection string in .env:

MONGO_URI=mongodb://localhost:27017/myDatabase

📜 License

This project is open-source. Feel free to modify and use it as needed!

Happy Coding! 🚀

