const rp = require('request-promise');
const url = require('url');
const localStorage = new require('node-localstorage').LocalStorage('/tmp/neo-smart-blinds');
let Service, Characteristic;
 
module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("neo-smart-blinds-plugin", "NeoSmartBlind", blinds);
};

function blinds(log, config) {
  this.log = log;
  this.config = config;

  this.name = config['name'];
  this.blindCode = config['blind_code'];
  this.controllerIP = config['controller_ip'];
  this.controllerID = config['controller_id'];
}

blinds.prototype = {
  getServices: function () {
    let informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, "Neo Smart Blinds")
      .setCharacteristic(Characteristic.Model, "Blind")
      .setCharacteristic(Characteristic.SerialNumber, this.blindCode)
      .setCharacteristic(Characteristic.Name, this.name);
 
    let windowCoveringService = new Service.WindowCovering(this.name);

    // Current Position
    windowCoveringService
      .getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getCurrentBlindPosition.bind(this))
        .on('set', this.setCurrentBlindPosition.bind(this));

    // Target Position
    windowCoveringService
      .getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getTargetBlindPosition.bind(this))
        .on('set', this.setTargetBlindPosition.bind(this));

    // Position State
    windowCoveringService
      .getCharacteristic(Characteristic.PositionState)
        .on('get', this.getBlindPositionState.bind(this))
        .on('set', this.setBlindPositionState.bind(this));

 
    this.informationService = informationService;
    this.windowCoveringService = windowCoveringService;
    return [informationService, windowCoveringService];
  },

  
  // Current Position

  getCurrentBlindPosition: function(next) {
    // Retrieve current blind position from storage.
    const currentPosition = localStorage.getItem(this.blindCode + '-current');
    
    return next(null, currentPosition);
  },

  setCurrentBlindPosition: function(newPosition, next) {
    // Save the current blind position to storage.
    localStorage.setItem(this.blindCode + '-current', newPosition);

    return next();
  },

  // Target Position

  getTargetBlindPosition: function(next) {
    // Get target blind position from storage.
    const targetPosition = localStorage.getItem(this.blindCode + '-target');

    return next(null, targetPosition);
  },

  setTargetBlindPosition: function(newPosition, next) {    
    // Save the target blind position to storage.
    localStorage.setItem(this.blindCode + '-target', newPosition);

    const direction = newPosition < 100 ? 'dn' : 'up';
    const _this = this;

    // Send command to blind.
    _this
      .commandBlind(_this.blindCode, direction)
        .then(function(response) {
          // Save the current position.
          localStorage.setItem(_this.blindCode + '-current', newPosition);

          // Update the current position with HomeKit.
          _this
            .windowCoveringService
              .getCharacteristic(Characteristic.CurrentPosition)
              .updateValue(newPosition, next);
        })
        .catch(function(err) {
          next(err);
        });
  },

  // Position State

  getBlindPositionState: function(next) {
    const currentState = localStorage.getItem(this.blindCode + '-state');

    return next(null, currentState ? currentState : Characteristic.PositionState.STOPPED);
  },

  setBlindPositionState: function(newState, next) {
    localStorage.setItem(this.blindCode + '-state', newState);

    return next();
  },

  // Blinds API

  commandBlind: function(id, command) {
    const _this = this;
    const timeHash = new Date().getTime().toString().slice(-7);

    const requestUrl = url.parse('http://' + _this.controllerIP + ':8838');
    requestUrl.pathname = '/neo/v1/transmit';
    requestUrl.search = 'id=' + _this.controllerID + '&command=' + _this.blindCode + '-' + command + '&hash=' + timeHash;

    return rp({
      uri: url.format(requestUrl),
      method: 'GET',
      resolveWithFullResponse: true
    });
  }

};