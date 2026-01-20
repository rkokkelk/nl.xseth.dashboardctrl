'use strict';

require('url');

const nutil = require('util');
const Homey = require('homey');
const fetch = require('node-fetch');
const util = require('../../lib/util.js');
const template = require('../../lib/template.js');

class FullyBrowserDevice extends Homey.Device {

  async onInit() {
    const settings = this.getSettings();

    // Verify URL and autofix if possible
    if (!util.validURL(settings.address)) {
      settings.address = util.fixURL(settings.address);
      this.setSettings(settings);
      this.log(`Autofixing URL to: ${settings.address}`)
    }

    const api = new URL(settings.address);
    api.searchParams.set('type', 'json');
    api.searchParams.set('password', settings.password);
    this.API = api;

    // Set values
    this.foregroundApp = ''
    this.foregroundActivity	= ''

    // Setup polling of device
    this.polling = this.homey.setInterval(this.poll.bind(this), 1000 * settings.polling);

    // Register image from CamSnapshot
    this.setupImage();

    // Register capabilities
    this.registerCapabilityListener('onoff', this.turnOnOff.bind(this));
    this.registerCapabilityListener('dim', this.changeBrightness.bind(this));

    // get trigger cards
    this.foregroundAppTrigger = this.homey.flow.getTriggerCard("foregroundAppChanged");
    this.foregroundActivityTrigger = this.homey.flow.getTriggerCard("foregroundActivityChanged");
    
    if (this.hasCapability('foreground_app') === false) {
      await this.addCapability('foreground_app');
    }

    if (this.hasCapability('foreground_activity') === false) {
      await this.addCapability('foreground_activity');
    }
  }

  async setupImage() {
    /**
     * Register snapshot image from FullyBrowser
     */

    const snapshot = await this.homey.images.createImage();

    snapshot.setStream(async stream => {
      const res = await fetch(this.getAPIUrl('getCamshot'));
      util.checkStatus(res);

      return res.body.pipe(stream);
    });

    await this.setCameraImage('front', this.homey.__('Live CamSnapshot'), snapshot)
  }

  onDeleted() {
    this.homey.clearInterval(this.polling);
    this.homey.clearInterval(this.pinning);
  }

  getAPIUrl(cmd) {
    /**
     * Get URL of API as URL object
     *
     * @param {String} cmd - Command to use in API
     * @return {URL} URL of API for specific cmd
     */
    const URL = this.API;
    URL.searchParams.set('cmd', cmd);

    this.log('Executing cmd=[' + cmd + ']');

    // cleanup old parameters
    URL.searchParams.delete('url');
    URL.searchParams.delete('key');
    URL.searchParams.delete('value');
    URL.searchParams.delete('package');

    return URL;
  }

  poll() {
    /**
     * Poll for device current status and update Homey capabilities
     */

    // Translation Fully Browser REST -> Homey capabilities
    const deviceProperties = {
      screenOn: 'onoff',
      screenBrightness: 'dim',
      batteryLevel: 'measure_battery',
      foregroundApp: 'foreground_app',
      foregroundActivity: 'foreground_activity'
    }

    this.getStatus()
      .then(stats => {
        let value = null;

        // Verify for each property if capability needs updating
        for (const [fully, homey] of Object.entries(deviceProperties)) {

          // Get value, in case of screenBrightness calculate Fully value to Homey value
          value = (fully === 'screenBrightness') ? util.calcBrightness(stats[fully]) : stats[fully];

          // Skip any non existing value
          if (value == null)
            continue

          // Change capability if value is different
          if (this.getCapabilityValue(homey) !== value) {
            this.log(`Setting [${homey}]: ${value}`);
            this.setCapabilityValue(homey, value);

            const tokens = {
              foregroundApp: this.getCapabilityValue('foregroundApp'),
              foregroundActivity: this.getCapabilityValue('foregroundActivity')
            }
            tokens[fully] = value;

            // ensure trigger is activited if necessary
            if (fully === 'foregroundApp'){ 
                this.foregroundAppTrigger.trigger(tokens)
                .then(this.log)
                .catch(this.error);

            } else if (fully === 'foregroundActivity'){ 
                this.foregroundActivityTrigger.trigger(tokens)
                .then(this.log)
                .catch(this.error);
            }
          }
        }
      })
      .catch(error => {
        switch (error) {
          case 'err_sensor_motion':
          case 'err_sensor_battery':
            this.setUnavailable(this.homey.__(error));
            this.log(error);
            break;
          default:
            this.setUnavailable(this.homey.__('Unreachable'));
            this.log(error);
            break;
        }
        this.ping();
      });
  }

  ping() {
    /**
     * Ping the device to verify availability
     */
    const self = this;

    this.log('Device is not reachable, pinging every 63 seconds to see if it comes online again.');

    this.homey.clearInterval(this.polling);
    this.homey.clearInterval(this.pinging);

    this.pinging = this.homey.setInterval(() => {
      self.getStatus()
        .then(result => {
          self.log('Device reachable again, setting available, start polling again');
          self.setAvailable()
          this.homey.clearInterval(self.pinging);
          self.polling = this.homey.setInterval(self.poll.bind(self), 1000 * self.getSettings().polling);
        })
        .catch(_error => {
          self.log('Device is not reachable, pinging every 63 seconds to see if it comes online again.');
        })
    }, 63000);
  }

  async getStatus() {
    /**
     * Get the deviceInfo (Status) of Fully Browser
     *
     * @return {Object} Current status of Fully Browser
     */

    const url = this.getAPIUrl('deviceInfo');
    const res = await fetch(url);
    util.checkStatus(res);

    return res.json();
  }

  async turnOnOff(value) {
    /**
     * Turn Fully Browser on or off
     *
     * @param {Boolean} value - to turn on or off
     */
    const onoff = value ? 'screenOn' : 'screenOff'
    const url = this.getAPIUrl(onoff);
    const res = await fetch(url);
    util.checkStatus(res);
  }

  async changeBrightness(value, opts) {
    /**
     * Turn Fully Browser on or off
     *
     * @param {Double} value - percentage to dim 0-1
     * @param {Object} opts - additional options
     */

    const url = this.getAPIUrl('setStringSetting');
    url.searchParams.set('key', 'screenBrightness');
    url.searchParams.set('value', Math.floor(value * 255));

    const res = await fetch(url);
    util.checkStatus(res);
  }

  async bringFullyToFront() {
    /**
     * Bring Fully Browser to foreground
     */
    const url = this.getAPIUrl('toForeground');
    const res = await fetch(url);
    util.checkStatus(res);
  }

  async loadStartUrl() {
    /**
     * Load start Url
     */
    const url = this.getAPIUrl('loadStartUrl');
    const res = await fetch(url);
    util.checkStatus(res);
  }

  async loadUrl(newUrl) {
    /**
     * Load start Url
     */
    const url = this.getAPIUrl('loadUrl');
    url.searchParams.set('url', newUrl);

    const res = await fetch(url);
    util.checkStatus(res);
  }

  async textToSpeech(message) {
    /**
     * Speak a message
     */
    const url = this.getAPIUrl('textToSpeech');
    url.searchParams.set('text', message);

    const res = await fetch(url);
    util.checkStatus(res);
  }

  async setOverlayMessage(message) {
    /**
     * Show a message
     */
    const url = this.getAPIUrl('setOverlayMessage');
    url.searchParams.set('text', message);

    const res = await fetch(url);
    util.checkStatus(res);
  }

  async startScreensaver() {
    /**
     * Start screensaver
     */
    const url = this.getAPIUrl('startScreensaver');

    const res = await fetch(url);
    util.checkStatus(res);
  }

  async startApplication(pkg) {
    /**
     * Load start Url
     */
    const url = this.getAPIUrl('startApplication');
    url.searchParams.set('package', pkg.trim());

    const res = await fetch(url);
    util.checkStatus(res);
  }

  async showImage(backgroundColor, image) {
    /**
     * Show image on device
     * @param {String} backgroundColor - Color in hex format for background
     * @param {Image} image - Homey image object to show
     */

    let imgSrc = image.cloudUrl ? image.cloudUrl : image.localUrl;

    // if not URL is available in image, use stream for base64 data
    if (!imgSrc) {
      const stream = await image.getStream()
      const imgBase64 = await util.toBase64(stream);

      imgSrc = `data:image/png;base64,${imgBase64}`;
    }

    // function for handling GET requests on server
    const self = this;

    const onRequest = function onRequest(req, res) {
      self.log('Parsing request');
      const html = nutil.format(template.html_image, backgroundColor, imgSrc);

      res.write(html);
      res.end();
    };

    // Start HTTP server
    const local = await this.homey.cloud.getLocalAddress();
    const server = util.startServer(this.homey, onRequest);

    server.on('listening', function() {
      const port = server.address().port;

      // Generate URL for Fully to connect to
      const IP = local.split(':')[0];
      const URL = `http://${IP}:${port}`

      self.log(`Image available on ${URL}`);

      return Promise.all([self.bringFullyToFront(), self.loadUrl(URL)]);
    });
  }

  showDashboard() {
    /**
     * Show dashboard in Fully Browser
     */
    return Promise.all([this.bringFullyToFront(), this.loadStartUrl()]);
  }

}

module.exports = FullyBrowserDevice;
