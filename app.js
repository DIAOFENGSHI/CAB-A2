var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var axios = require("axios");
var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
// require("@tensorflow/tfjs-backend-cpu");
// require("@tensorflow/tfjs-backend-webgl");
const tf = require("@tensorflow/tfjs");
const cocoSsd = require("@tensorflow-models/coco-ssd");
const fs = require("fs");
const jpeg = require("jpeg-js");
const redis = require("redis");
const AWS = require("aws-sdk");
var app = express();
const host = "13.55.32.170";
const port = "8000";
const s3 = new AWS.S3({ apiVersion: "2006-03-01" });
const bucketName = "n10840044";

// Redis setup
const client = redis.createClient({
  socket: {
    host: "n10840044.km2jzi.ng.0001.apse2.cache.amazonaws.com",
    port: 6379,
  },
});

// wait for connection
(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.log(err);
  }
})();

// Print redis errors to the console
client.on("error", (err) => {
  console.log("Error " + err);
});

client.on("connect", () => {
  console.log("Connected");
});

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);

var config = {
    method: "get",
    url: "https://api.qldtraffic.qld.gov.au/v1/webcams?apikey=3e83add325cbb69ac4d8e5bf433d770b",
  };

app.get("/init", async (req, res) => {
  const response = await axios(config)
  // save the response.data to redis
  const info = response.data.features.map((feature)=>{
    return {
      id:feature.properties.id,
      description:feature.properties.description,
      coordinates:feature.geometry.coordinates,
    }
  })
  // ttl for s3 is one day ???
  s3Key = "qldTrafficApi"
  const body = JSON.stringify(info)
  const objectParams = { Bucket: bucketName, Key: s3Key, Body: body };
  await s3.putObject(objectParams).promise();
  res.json(info)
})

app.post("/trafficfllow", async (req, res) => {
  async function getPrediction(buf){
    const model = await cocoSsd.load()
    const NUMBER_OF_CHANNELS = 3
    const pixels = jpeg.decode(buf.data, true)
    const imageByteArray = (image, numChannels) => {
    const pixels = image.data
    const numPixels = image.width * image.height
    const values = new Int32Array(numPixels * numChannels)
      for (let i = 0; i < numPixels; i++) {
        for (let channel = 0; channel < numChannels; ++channel) {
          values[i * numChannels + channel] = pixels[i * 4 + channel]
        }
      }
      return values
    }
    const imageToInput = (image, numChannels) => {
      const values = imageByteArray(image, numChannels)
      const outShape = [image.height, image.width, numChannels]
      const input = tf.tensor3d(values, outShape, "int32")
      return input
    }
    const input = imageToInput(pixels, NUMBER_OF_CHANNELS)
    const predictions = await model.detect(input)
    return predictions
  }

  const locations_id = req.body

  // check result in redis, if all meet, return result

  // if not go next
  
  // if part, filter the locations_id, use a array to carry the redis outcome, then add them together later


  // check api in s3
  const value = await client.get("sun")
  console.log(value)

  // if there is not, fetch
  const response = await axios(config)
  const sources = response.data.features
  const locations = locations_id.map((id)=>{
      return sources.filter((source)=>{return source.properties.id == id})[0]
  })

  // when have the api info, analyse the picture by locations id
  const result = await Promise.all(locations.map(async (location)=>
  {
    const buf = await axios.get(
      location.properties.image_url, {responseType: 'arraybuffer',})
    const prediction = await getPrediction(buf)
    const precise = prediction.filter((predict)=>{
        return predict.class == "car" || predict.class == "truck"
    })
    return precise
  }))
  
  // save the result to redis
  
  // qury s3 for the count of location 
  
  // add the count then pass to s3

  // give respinse in vechicle and count

  res.json(result)
})

app.listen(port, () => {
  console.log("Server listening on port: ", port);
});

module.exports = app;
