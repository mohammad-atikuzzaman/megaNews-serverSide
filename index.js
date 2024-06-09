const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = 5000;

app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
const uri = `mongodb+srv://${process.env.MONGODB_USER_NAME}:${process.env.MONGODB_USER_PASS}@cluster0.tyigyp7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const { MongoClient, ServerApiVersion } = require("mongodb");

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    app.post("/jwt", async (req, res) => {
      const user = req.body;

      const token = jwt.sign(user, process.env.SECRET_KEY_TOKEN, {
        expiresIn: "1d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      res
        .clearCookie("token", { maxAge: 0, sameSite: "none", secure: true })
        .send({ message: true });
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const meganewsDB = client.db("megaNews");
    const usersCollection = meganewsDB.collection("usersCollection");

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const data = req.body;
      console.log(data);
      const query = { userEmail: data.userEmail };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }

      const userData = {
        ...data,
      };
      const result = await usersCollection.insertOne(userData);
      res.send(result);
    });
    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { userEmail: email };
      const user = req.body;
      console.log(user, email);
      const options = { upsert: true };
      const updateDoc = {
        $set: {
         ...user
        },
      };

      const result = await usersCollection.updateOne(filter, updateDoc, options);
      res.send(result)
    
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
