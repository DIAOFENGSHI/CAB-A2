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

var app = express();
const host = "13.55.32.170";
const port = "8000";

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

// catch 404 and forward to error handler
// app.use(function (req, res, next) {
//   next(createError(404));
// });

// // error handler
// app.use(function (err, req, res, next) {
//   // set locals, only providing error in development
//   res.locals.message = err.message;
//   res.locals.error = req.app.get("env") === "development" ? err : {};

//   // render the error page
//   res.status(err.status || 500);
//   res.render("error");
// });

app.get("/api/cam", async (req, res) => {
  var config = {
    method: "get",
    url: "https://api.qldtraffic.qld.gov.au/v1/webcams?apikey=3e83add325cbb69ac4d8e5bf433d770b",
  };
  const convertURIToImageData = (url) => {
    return new Promise((resolve, reject) => {
      if (!url) {
        return reject();
      }
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      const image = new Image();
      image.onload = () => {
        canvas.width = image.width;
        canvas.height = image.height;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(context.getImageData(0, 0, canvas.width, canvas.height));
      };
      image.crossOrigin = "Anonymous";
      image.src = url;
    });
  };
  const data = await axios(config)
    .then(async function (response) {
      // console.log(JSON.stringify(response.data));
      const default_image_url = `https://webcams.qldtraffic.qld.gov.au/Gold_Coast/bundall-ashmore-south.jpg`;
      const load = async () => {
        const img = await convertURIToImageData(default_image_url);
        return img;
      };
      const model = await cocoSsd.load();
      const NUMBER_OF_CHANNELS = 3;
      const p = "/home/ubuntu/CAB-A2/bundall-ashmore-south.jpg";
      const buf = fs.readFileSync(p);
      const pixels = jpeg.decode(buf, true);
      const imageByteArray = (image, numChannels) => {
        const pixels = image.data;
        const numPixels = image.width * image.height;
        const values = new Int32Array(numPixels * numChannels);

        for (let i = 0; i < numPixels; i++) {
          for (let channel = 0; channel < numChannels; ++channel) {
            values[i * numChannels + channel] = pixels[i * 4 + channel];
          }
        }
        return values;
      };

      const imageToInput = (image, numChannels) => {
        const values = imageByteArray(image, numChannels);
        const outShape = [image.height, image.width, numChannels];
        const input = tf.tensor3d(values, outShape, "int32");
        return input;
      };
      const input = imageToInput(pixels, NUMBER_OF_CHANNELS);
      const predictions = await model.detect(input);

      console.log("Predictions: ");
      console.log(predictions);
      return response.data;
    })
    .catch(function (error) {
      console.log(error);
    });
  res.json(data);
});

app.listen(port, () => {
  console.log("Server listening on port: ", port);
});

module.exports = app;
