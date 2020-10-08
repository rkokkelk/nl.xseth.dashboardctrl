'use strict';

const Homey = require('homey');

class DashboardCtrlApp extends Homey.App {

  onInit() {
    this.log('Initializing Dashboard control app.');

    new Homey.FlowCardAction('dashboard')
      .register()
      .registerRunListener(args => args.device.showDashboard());

    new Homey.FlowCardAction('application')
      .register()
      .registerRunListener(args => args.device.startApplication(args.pkg));

    new Homey.FlowCardAction('loadUrl')
      .register()
      .registerRunListener(args => args.device.loadUrl(args.url));

  }

}

module.exports = DashboardCtrlApp;
