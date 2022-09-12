'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var _ = require('lodash');
var POLLING_INTERVAL = 100;
var Rs232 = require('./id003rs232');
var Id003Fsm = require('./id003fsm');

var Id003 = function(config) {
  EventEmitter.call(this);
  this.initialized = false;
  this.pollingInterval = null;
  this.config = config;
  this.currency = config.currency;
  this.denominations = null;
  this.com_error = undefined;
  this.lastHeartbeat = Date.now();
  var self = this;
  this._throttledError = _.throttle(function(err) {
    self.emit('error', err);
  }, 2000);
};

util.inherits(Id003, EventEmitter);
Id003.factory = function factory(config) {
  return new Id003(config);
};

Id003.prototype.lightOn = function lightOn() {
  this.rs232.lightOn();
};

Id003.prototype.lightOff = function lightOff() {
  this.rs232.lightOff();
};

Id003.prototype.run = function run(cb) {
  this.id003Fsm = Id003Fsm.factory(this.config);
  this._run(cb);
};

Id003.prototype.isCashboxOut = function isCashboxOut() {
  return this.id003Fsm.is('StackerOpen');
};

Id003.prototype._run = function _run(cb) {
  var self = this;
  var config = this.config;
  var rs232Config = config.rs232;
  rs232Config.currency = config.currency;

  this.rs232 = Rs232.factory(rs232Config, this.denominations);

  this.rs232.on('message', function(cmd, data) {
    self.lastHeartbeat = Date.now();
    // TODO: temp, handle commands better (probably use fsm)
    if (cmd !== 'ack' && cmd !== 'inhibit') self.id003Fsm[cmd](data);
  });

  this.rs232.on('unknownCommand', function(code) {
    throw new Error('unknown code: ' + code.toString(16));
  });

  this.rs232.on('error', function(err) {
    self._throttledError(err);
  });

  this.rs232.on('badFrame', function() {
    self.id003Fsm.badFrame();
  });

  this.id003Fsm.on('dispatch', function(cmd, data) {
    self._send(cmd, data);
  });

  this.id003Fsm.on('powerUp', function() {
    self._send('denominations');
  });

  this.id003Fsm.on('denominations', function() {
    // TODO - now it is disabled here
    self._send('reset');
  });

  this.id003Fsm.on('ready', function() {
    self._send('denominations');
  });

  this.id003Fsm.on('onpaystay', function() {
    self.emit('onpaystay');
  });

  this.id003Fsm.on('onpayvalid', function() {
    self.emit('onpayvalid');
  });

  this.id003Fsm.on('stuck', function() {
    this.emit('error');
  });

  this.id003Fsm.on('stuck', function() {
    this.emit('error', new Error('Bill validator stuck'));
  });

  this.id003Fsm.on('billAccepted', function() {
    self.emit('billAccepted');
  });

  this.id003Fsm.on('billRead', function(data) {
    if (!data.denomination) {
      console.log('bill rejected: unsupported denomination. Code: 0x%s', data.code.toString(16));
      self._send('reject');
      return;
    }
    self.emit('billRead', data);
  });

  this.id003Fsm.on('billStacked', function(data) {
    self.emit('billStacked', data);
  });

  this.id003Fsm.on('pathCurrency', function(data) {
    self.emit('pathCurrency', data);
  });

  this.id003Fsm.on('pathSetCount', function(data) {
    self.emit('pathSetCount', data);
  });

  this.id003Fsm.on('pathSetCurrentCount', function(data) {
    self.emit('pathSetCurrentCount', data);
  });

  this.id003Fsm.on('pathCount', function(data) {
    self.emit('pathCount', data);
  });

  this.id003Fsm.on('billValid', function() {
    self.emit('billValid');
  });

  this.id003Fsm.on('billRejected', function() {
    self.emit('billRejected');
  });

  this.id003Fsm.on('billRefused', function() {
    self.emit('billRefused');
  });

  this.id003Fsm.on('standby', function(data) {
    self.emit('standby', data);
  });

  this.id003Fsm.on('acceptorJam', function() {
    self.emit('acceptorJam');
  });

  this.id003Fsm.on('cheated', function() {
    self.emit('cheated');
  })

  this.id003Fsm.on('stackerJam', function() {
    self.emit('stackerJam');
  });

  this.rs232.open(function(err) {
    if (err) {
      self.com_error = err;
      self.id003Fsm.commerror();
      return cb(err);
    }

    self.pollingInterval = setInterval(function() {
      self._poll();
    }, POLLING_INTERVAL);

    self.id003Fsm.connect();
    self._send('version');

    var t0 = Date.now();
    var denominationsInterval = setInterval(function() {
      if (self.hasDenominations()) {
        clearInterval(denominationsInterval);
        return cb();
      }

      if (Date.now() - t0 > 5000) {
        clearInterval(denominationsInterval);
        cb(new Error('Timeout waiting for denominations'));
      }
    }, 500);
  });
};

Id003.prototype.close = function close(cb) {
  clearInterval(this.pollingInterval);
  this.rs232.close(function(err) {
    if (err) console.log(err);
    cb(err);
  });
};

Id003.prototype.refresh = function refresh(cb) {
  var self = this;

  this.id003Fsm = Id003Fsm.factory(this.config);
  this.id003Fsm.refresh();
  this.close(function() {
    self._run(function(err) {
      console.log('Bill validator running again.');
      cb(err);
    });
  });
};

Id003.prototype.enable = function enable() {
  this._send('unInhibit');
};

Id003.prototype.disable = function() {
  if (this.id003Fsm.is('Disable')) return;
  if (this.id003Fsm.is('Enable')) this._send('inhibit');
  else this.id003Fsm.disableFlag = true;
};

Id003.prototype.stack = function stack() {
  this._send('stack');
};

Id003.prototype.reject = function reject() {
  this._send('reject');
};

Id003.prototype.lowestBill = function lowestBill() {
  var bills = _.values(this._denominations());
  return _.min(bills);
};

Id003.prototype.highestBill = function highestBill(fiat) {
  var bills = _.values(this._denominations());
  var filtered = _.filter(bills, function(bill) {
    return bill <= fiat;
  });
  if (_.isEmpty(filtered)) return null;
  return _.max(filtered);
};

///
/// Set paths for currencies
///
Id003.prototype.currencypath = function currencypath(path1, path2) {
  this._send('currencypath', {path1: path1, path2: path2});
};

///
/// Set count (maximum in stack)
///
Id003.prototype.setCount = function setCount(count, box) {
  this._send('setcount', {count: count, box: box});
};

///
/// Set current count (current count in stack)
///
Id003.prototype.setCurrentCount = function setCurrentCount(count, box) {
  this._send('setcurrentcount', {count: count, box: box});
};

///
/// Payout
///
Id003.prototype.payout = function payout(count, box) {
  this._send('payout', {count: count, box: box});
};

Id003.prototype.hasDenominations = function hasDenominations() {
  return this._denominations() !== null;
};

Id003.prototype._denominations = function _denominations() {
  if (this.denominations) return this.denominations;
  this.denominations = this.rs232 ? this.rs232.denominations : null;
  return this.denominations;
};

Id003.prototype.getVersion = function version() {
  if (this.softwareVersion) return this.softwareVersion;
  this.softwareVersion = this.rs232 ? this.rs232.softwareVersion : null;
  return this.softwareVersion;
};

///
/// Return bill to stack
///
Id003.prototype.emergency = function emergency() {
  this._send('emergency');
};

///
/// Get currency count
///
Id003.prototype.count = function count() {
  this._send('count');
};

Id003.prototype._reset = function _reset() {
  this._send('reset');
};

Id003.prototype._poll = function _poll() {
  this._send('status');
};

Id003.prototype._send = function _send(command, data) {
  this.rs232.send(command, data);
};

Id003.prototype.monitorHeartbeat = function monitorHeartbeat() {
  var self = this;
  function checkHeartbeat() {
    if (Date.now() - self.lastHeartbeat > 1000) {
      clearInterval(interval);
      self.emit('error', new Error('Lost bill validator heartbeat'));
    }
  }
  var interval = setInterval(checkHeartbeat, 500);
};

module.exports = Id003;
