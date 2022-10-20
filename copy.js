const tf = require('@tensorflow/tfjs')
const mn = require('@tensorflow-models/mobilenet');
const ccsd = require('@tensorflow-models/coco-ssd');
              require('@tensorflow/tfjs-node')

const fs = require('fs');
const jpeg = require('jpeg-js');

const COCOSSD_PATH = 'model/mobilenet_v2/model.json';
const IMAGE_PATH = 'panda.jpg';
const NUMBER_OF_CHANNELS = 3;

//LOAD DE MODEL
const loadModel = async path => {
  const model = new ccsd.ObjectDetection();
        model.modelPath = `file://${path}`;
        await model.load();
  return model;
}

//TRANSFORMA LA IMAGEN EN rgba VALUES
const readImage = path => {
  const buf = fs.readFileSync(path)
  const pixels = jpeg.decode(buf, true)
  return pixels
}

//CONVERT THE IMAGE FROM rgba VALUES TO rgb VALUES
const imageByteArray = (image, numChannels) => {
  const pixels = image.data
  const numPixels = image.width * image.height;
  const values = new Int32Array(numPixels * numChannels);

  for (let i = 0; i < numPixels; i++) {
    for (let channel = 0; channel < numChannels; ++channel) {
      values[i * numChannels + channel] = pixels[i * 4 + channel];
    }
  }
  return values
}

//CONVERT THE IMAGE TO A TENSOR
const imageToInput = (image, numChannels) => {
  const values = imageByteArray(image, numChannels)
  const outShape = [image.height, image.width, numChannels];
  const input = tf.tensor3d(values, outShape, 'int32');

  return input
}

//EVERY THING START HERE AND ENDS HERE
const inic = async (cocossdPath, imagePath) => {
  const image = readImage(imagePath)
  const input = imageToInput(image, NUMBER_OF_CHANNELS);

  const cocossd = await loadModel(cocossdPath);
  const detection = await cocossd.detect(input);

  console.log('classification results: ', detection);

}

inic(COCOSSD_PATH,IMAGE_PATH)