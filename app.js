'use strict';

const Homey = require('homey');

class DashboardCtrlApp extends Homey.App {

  onInit() {
    this.log('Initializing Dashboard control app.');

    this.homey.flow.getActionCard('dashboard')
      .registerRunListener(args => args.device.showDashboard());

    this.homey.flow.getActionCard('application')
      .registerRunListener(args => args.device.startApplication(args.pkg));

    this.homey.flow.getActionCard('loadUrl')
      .registerRunListener(args => args.device.loadUrl(args.url));

    this.homey.flow.getActionCard('textToSpeech')
      .registerRunListener(args => args.device.textToSpeech(args.message));

    this.homey.flow.getActionCard('setOverlayMessage')
      .registerRunListener(args => args.device.setOverlayMessage(args.message));

    this.homey.flow.getActionCard('startScreensaver')
      .registerRunListener(args => args.device.startScreensaver());

    this.homey.flow.getActionCard('showImage')
      .registerRunListener(args => args.device.showImage(args.color, args.droptoken));

  }

}

module.exports = DashboardCtrlApp;
