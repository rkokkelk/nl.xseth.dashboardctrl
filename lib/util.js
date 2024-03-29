'use strict';

const http = require('http');

exports.validURL = function(url) {
  /**
   * Verify if the url given as String is a valid URL
   *
   * @param {String} url - url string to validate
   * @return {Boolean} url is a valid URL
   */

  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}

exports.fixURL = function(url) {
  /**
   * Fix given url if it does not contain Verify if the url given as String is a valid URL
   *
   * @param {String} url - url to fix
   * @return {String} url fixed or null if cannot be fixed
   */

  if (this.validURL(url))
    return url;

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`
    return this.fixURL(url);
  }

  return null;
}

exports.checkStatus = function(res) {
  /**
   * Verify if fetch response is ok
   *
   * @param {Response} res - response to verify
   * @return {Response} response obj if valid
   */
  if (res.ok) // res.status >= 200 && res.status < 300
    return res;
  else
    throw new Error(res.status);
}

exports.calcBrightness = function(fullyValue) {
  /**
   * Calculate homey dim value from Fully Browser brightnessValue
   *
   * Homey determines dim 0 - 100
   * Fully determines brightness 0 - 255
   *
   * @param {Number} fullyValue - brightness value by Fully Browser
   * @return {Number} homey dim value
   */
  const dim = (fullyValue / 255);
  return Math.round(dim * 100) / 100; // round to 2 decimal points
}

exports.toBase64 = function(stream) {
  /**
   * Turn stream into base64 string
   *
   * @param {Readable} stream - readable stream
   * @return {String} base64 encoded stream
   */
  return new Promise((resolve, reject) => {
    const buffers = [];

    stream.on('data', chunk => {
      buffers.push(chunk);
    });

    stream.once('end', () => {
      const buffer = Buffer.concat(buffers);
      resolve(buffer.toString('base64'));
    });

    stream.once('error', err => {
      reject(err);
    });
  });
}

exports.getRandomBetween = function(min, max) {
  /**
   * Get a random number between min & max
   *
   * @param {Integer} min - minimal number
   * @param {Integer} max - maximum number
   * @return {Integer} number - min < number <= max
   */
  return Math.round(Math.random() * (max - min) + min);
}

exports.startServer = function(homey, onRequest) {
  /**
   * Start a HTTP server on the given port
   *
   * @param {Homey} homey - homey object
   * @param {Function} onRequest - function for handling HTTP requests
   * @return {http.Server} HTTP server
   */

  const server = http.createServer();
  let port = this.getRandomBetween(40000, 50000); // Get random HTTP port

  server
    .listen(port)
    .on('request', onRequest)
    .on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        console.log(`EADDRINUSE: ${port} already in use, retrying!`);

        homey.setTimeout(() => {
          server.close();
          port = this.getRandomBetween(40000, 50000); // Get random HTTP port
          server.listen(port);
        }, 250);
      }
    });

  // Close server by default after 5m
  homey.setInterval(() => server.close(), 300000);

  return server;
}
