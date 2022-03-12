const express = require("express");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();

const { MongoClient } = require("mongodb");
var credential_t = process.env.MDB;
fs.writeFileSync("./certsave.pem", credential_t + "\n");
const credentials = "./certsave.pem";

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

var SpotifyWebApi = require("spotify-web-api-node");
const { nextTick } = require("process");

const PORT = process.env.PORT || 3000;
var clientId = process.env.CLIENT_ID;
var redirectUri = process.env.REDIRECT_URI;
var clientSecret = process.env.CLIENT_SECRET;
var scopes = [
  "user-read-private",
  "user-read-email",
  "playlist-modify-public",
  "playlist-modify-private",
];

var mdb_collection;

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

const client = new MongoClient(
  "mongodb+srv://cluster0.qdyeh.mongodb.net/myFirstDatabase?authSource=%24external&authMechanism=MONGODB-X509&retryWrites=true&w=majority",
  {
    sslKey: credentials,
    sslCert: credentials,
  }
);

var spotifyApi;
var ids_s;
const main = async () => {
  await client.connect();
  database = client.db("spotify");
  mdb_collection = database.collection("URIs");
  const alt_ids = await mdb_collection.find({ name: "Melodic Techno" });
  await alt_ids.forEach((unit) => {
    //console.log(unit.uris);
    //ids_s = unit.uris;
  });
  ids_s = await mdb_collection.findOne({ name: "Melodic Techno" });
  ids_s = ids_s.uris;
  //console.log(alt_ids);
  client.close();
  const url = await app.listen(PORT, () => {
    //var jsonIds = fs.readFileSync('./songs/ids.json');
    //ids = JSON.parse(jsonIds);
    console.log(ids_s);
    spotifyApi = new SpotifyWebApi({
      redirectUri: redirectUri,
      clientId: clientId,
      clientSecret: clientSecret,
    });
  });
};

main();

// middleware to check token
const checkToken = (req, res, next) => {
  const shaan_cookie = req.cookies.shaancookie;
  jwt.verify(shaan_cookie, "test_key", (err, data) => {
    if (err) {
      res.sendStatus(403);
    } else if (data.access_token) {
      req.access_token = data.access_token;
      req.refresh_token = data.refresh_token;
      next();
    }
  });
};

// adds the state to the URL - so its something that ideally gets checked that you went through login page and not another page - not being used rn though
app.get("/login", (req, res) => {
  const state2 = "shaanfye123";
  res.cookie("spotify_auth_state", state2);

  res.redirect(spotifyApi.createAuthorizeURL(scopes, state2));
});

app.get("/refresh_token", (req, res) => {
  // refresh token - eventually can set it up so will hit this to get refresh token if its not refreshed yet
  // like if the cookie exists? But doesnt work? not sure 
});

app.get("/add/:playlistname", checkToken, function (req, res) {
  var pl = req.params.playlistname;
  pl = pl.replace(/_/g, " ");
  console.log(pl);
  var tempspot = new SpotifyWebApi({
    redirectUri: redirectUri,
    clientId: clientId,
    clientSecret: clientSecret,
  });
  tempspot.setAccessToken(req.access_token);
  tempspot.setRefreshToken(req.refresh_token);

  tempspot
    .createPlaylist(pl, {
      description: "This is a test for Sammy the BAV",
      public: true,
    })
    .then((data) => {
      console.log("Created playlist!", data.body.id);
      return data.body.id;
    })
    .then((playlist) => {
      tempspot.addTracksToPlaylist(playlist, ids_s);
    })
    .then(function (data) {
      res.send(`Your playlist has been added. The name is: ${pl}`);
      console.log("Added tracks to playlist!");
    });
});

app.get("/callback/", function (req, res) {
  /* Read query parameters */
  var code = req.query.code || null; // Read the authorization code from the query parameters
  var state = req.query.state; // (Optional) Read the state from the query parameter
  console.log(code);
  /* Get the access token! */
  spotifyApi.authorizationCodeGrant(code).then(
    function (data) {
      console.log(data);
      console.log("The token expires in " + data.body["expires_in"]);
      console.log("The access token is " + data.body["access_token"]);
      console.log("The refresh token is " + data.body["refresh_token"]);
      // Set the access token on the API object to use it in later calls
      spotifyApi.setAccessToken(data.body["access_token"]);
      spotifyApi.setRefreshToken(data.body["refresh_token"]);

      // jwt token
      const token = jwt.sign(
        {
          access_token: data.body["access_token"],
          refresh_token: data.body["refresh_token"],
        },
        "test_key"
      );
      res.cookie("shaancookie", token, { maxAge: 900000, httpOnly: true });
      res.send("Ok your cookie should be saved. Now try using /add");
    },
    function (err) {
      res.status(err.code);
      console.log(err);
      //res.send(err.message);
    }
  );
});
