const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
// const stripe = require("stripe")(process.env.PAYMENT_KEY);
require("dotenv").config();
const app = express();

const stripe = require("stripe")(
  "sk_test_51PQQrjHeLdNaXJDi1lfCxyCfJoJiEp6kCQM5w6neZzD7xSaebcvvqni60wOjqd3h1Fpc2VMfSFkqR15O5l3UW4pO00mawyQhmY"
);
const port = process.env.PORT || 5000;

app.use(express.static("public"));
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
const uri = `mongodb+srv://${process.env.MONGODB_USER_NAME}:${process.env.MONGODB_USER_PASS}@cluster0.tyigyp7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
      res.send({ token });
    });

    // custom middlewares
    const verifyToken = (req, res, next) => {
      // console.log("inside middlewares", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.SECRET_KEY_TOKEN, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { userEmail: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden request" });
      }
      next();
    };

    const verifyPremium = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { userEmail: email };
      const user = await usersCollection.findOne(query);
      const isPremium = user?.type === "premium";
      if (!isPremium) {
        return res.status(403).send({ message: "Forbidden request" });
      }
      next();
    };

    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const meganewsDB = client.db("megaNews");
    const usersCollection = meganewsDB.collection("usersCollection");
    const allArticle = meganewsDB.collection("allArticle");
    const publishers = meganewsDB.collection("publishers");
    const price = meganewsDB.collection("price");

    //statistics api
    app.get("/statistics", async (req, res) => {
      const totalUserCount = await usersCollection.countDocuments();
      const premiumUserCount = await usersCollection.countDocuments({
        type: "premium",
      });

      const doc = {
        totalUser: totalUserCount,
        premiumUser: premiumUserCount,
        freeUser: totalUserCount - premiumUserCount,
      };
      res.send(doc);
    });

    //users api
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const data = req.body;
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

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden request" });
      }
      const query = { userEmail: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/users/premium/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden request" });
      }
      const query = { userEmail: email };
      const user = await usersCollection.findOne(query);
      let premium = false;
      if (user) {
        premium = user?.type === "premium";
      }

      res.send({ premium });
    });

    app.get("/users/user/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden request" });
      }
      const query = { userEmail: email };
      const user = await usersCollection.findOne(query);
      let premium = false;
      if (user) {
        admin = user?.type === "premium";
      }
      res.send({ premium });
    });
    app.patch("/users/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { userEmail: email };
      const user = req.body;
      // console.log(user, email);
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
        },
      };

      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    //articles apis
    app.get("/all-article", verifyToken, verifyAdmin, async (req, res) => {
      const result = await allArticle.find().toArray();
      res.send(result);
    });

    app.get("/all-articles", async (req, res) => {
      const query = { status: "approved" };
      const result = await allArticle.find(query).toArray();
      res.send(result);
    });

    app.get(
      "/premium-articles",
      verifyToken,
      verifyPremium,
      async (req, res) => {
        const query = { status: "approved", type: "premium" };
        const result = await allArticle.find(query).toArray();
        res.send(result);
      }
    );

    app.get("/trending", async (req, res) => {
      const query = { status: "approved" };
      const result = await allArticle
        .find(query)
        .limit(6)
        .sort({ views: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/article/:id", async (req, res) => {
      const id = req.params.id;
      const email = req.query?.email;

      const cursor = { userEmail: email };
      // console.log(email);
      const filter = { _id: new ObjectId(id), status: "approved" };

      const result = await allArticle.findOne(filter);
      const user = await usersCollection.findOne(cursor);
      // console.log(user?.type);
      if (result?.type === "premium") {
        if (result?.type !== user?.type) {
          return res.status(403).send({ message: "Forbidden Request" });
        }
      }
      res.send(result);
    });

    app.patch("/update-article/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...data,
        },
      };
      const result = await allArticle.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    app.patch("/article/:id", async (req, res) => {
      const id = req.params.id;
      const views = req.body;
      const filter = { _id: new ObjectId(id), status: "approved" };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...views,
        },
      };
      const result = await allArticle.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    app.post("/add-article", verifyToken, async (req, res) => {
      const postData = req.body;
      const data = {
        ...postData,
      };
      const result = await allArticle.insertOne(data);
      res.send(result);
    });

    app.patch("/my-article/:id", verifyToken, verifyAdmin, async (req, res) => {
      const articleId = req.params.id;
      const status = req.body;
      const filter = { _id: new ObjectId(articleId) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...status,
        },
      };
      const result = await allArticle.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    app.get("/authors-article/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      // console.log("email",email)
      const filter = { authorEmail: email };
      const result = await allArticle.find(filter).toArray();
      res.send(result);
    });

    app.delete("/delete-article/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await allArticle.deleteOne(filter);
      res.send(result);
    });

    // publisher api for admin
    app.get("/publisher", async (req, res) => {
      const result = await publishers.find().toArray();
      res.send(result);
    });
    app.post("/publisher", verifyToken, verifyAdmin, async (req, res) => {
      const publisher = req.body;
      const data = {
        ...publisher,
      };
      const result = await publishers.insertOne(data);
      res.send(result);
    });

    //payment api for product price
    app.post("/price", async (req, res) => {
      const priceData = req.body;
      const data = {
        ...priceData,
      };
      const emailReq = req.body.email;
      const exist = await price.findOne({ email: emailReq });
      if (exist) {
        return res.send({ message: "already exist" });
      }
      const result = await price.insertOne(data);
      res.send(result);
    });

    app.get("/price/:email", async (req, res) => {
      const userEmail = req.params.email;
      const result = await price.findOne({ email: userEmail });
      res.send(result);
    });

    //payments api for gatway
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card", "link"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
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
