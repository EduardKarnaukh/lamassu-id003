'use strict';

var { SerialPort } = require('serialport');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Crc = require('./crc');

var Id003Rs232 = function(config, denominations) {
  EventEmitter.call(this);
  this.currency = config.currency;
  this.buf = Buffer.alloc(0);
  this.responseSize = null;
  this.config = config;
  this.serial = null;
  this.softwareVersion = null;
  this.denominations = denominations;
};

util.inherits(Id003Rs232, EventEmitter);
Id003Rs232.factory = function factory(config, denominations) {
  return new Id003Rs232(config, denominations);
};

var SYNC = 0xfc;

// TODO: handle comm errors
var CMD = {
  denominations: Buffer([0xfc, 0x05, 0x8a, 0x7d, 0x7c]),
  status: Buffer([0xfc, 0x05, 0x11, 0x27, 0x56]),
  stack: Buffer([0xfc, 0x05, 0x41, 0xa2, 0x04]),
  ack: Buffer([0xfc, 0x05, 0x50, 0xaa, 0x05]),
  inhibit: Buffer([0xfc, 0x06, 0xc3, 0x01, 0x8d, 0xc7]),
  unInhibit: Buffer([0xfc, 0x06, 0xc3, 0x00, 0x04, 0xd6]),
  reset: Buffer([0xfc, 0x05, 0x40, 0x2b, 0x15]),
  reject: Buffer([0xfc, 0x05, 0x43, 0xb0, 0x27]),
  version: Buffer([0xfc, 0x05, 0x88, 0x6f, 0x5f]),
  //                                                      stack1            stack2            crc
  currencypath: Buffer([0xFC, 0x0D, 0xF0, 0x20, 0xD0, 0x02, 0x00, 0x01, 0x08, 0x00, 0x02, 0xBA, 0x42]),
  //                                                 cnt   box   crc
  payout: Buffer([0xFC, 0x09, 0xF0, 0x20, 0x4A, 0x01, 0x02, 0x8B, 0x5C]),
  count: Buffer([0xFC, 0x07, 0xF0, 0x20, 0x92, 0x2B, 0xA7]),
  currentcount: Buffer([0xFC, 0x07, 0xF0, 0x20, 0xa2, 0xa8, 0x96]),
  emergency: Buffer([0xFC, 0x07, 0xF0, 0x20, 0x4D, 0x51, 0x89]),
  //                                                  cnt         box
  setcount: Buffer([0xFC, 0x0A, 0xF0, 0x20, 0xD2, 0x32, 0x00, 0x01, 0x0D, 0xD2]),
  //                                                         cnt         box
  setcurrentcount: Buffer([0xFC, 0x0A, 0xF0, 0x20, 0xe2, 0x02, 0x00, 0x01, 0x51, 0x18]),
};

var RSP = {
  0x40: 'powerUp',
  0x1b: 'initialize',
  0x1a: 'disable',
  0x11: 'enable',
  0x12: 'accepting',
  0x13: 'escrow',
  0x14: 'stacking',
  0x15: 'vendValid',
  0x16: 'stacked',
  0x17: 'rejecting',
  0x18: 'returning',
  0x20: 'paying',
  0x22: 'collected',
  0x23: 'payvalid',
  0x24: 'paystay',
  0x25: 'returningtobox',
  0x43: 'stackerFull',
  0x44: 'stackerOpen',
  0x45: 'acceptorJam',
  0x46: 'stackerJam',
  0x47: 'pause',
  0x48: 'cheated',
  0x49: 'failure',
  0x4b: 'invalidcommand',
  0x4c: 'recyclerunitfailure',
  0x50: 'ack',
  0x88: 'version',
  0x8a: 'denominations',
  0xc3: 'inhibit',
  0xf0: 'currencypath'
};

var REJECTION_REASONS = {
  0x71: 'insertion',
  0x72: 'mug',
  0x73: 'head',
  0x74: 'calibration',
  0x75: 'conveying',
  0x76: 'discrimination',
  0x77: 'photoPattern',
  0x78: 'photoLevel',
  0x79: 'inhibit',
  0x7a: 'unknown',
  0x7b: 'operation',
  0x7c: 'stacker',
  0x7d: 'length',
  0x7e: 'photoPattern',
  0x7f: 'trueBill',
};

Id003Rs232.prototype.open = function open(cb) {
  var self = this;
  var config = Object.assign(
    {},
    {
      baudRate: 19200,
      parity: 'even',
      dataBits: 8,
      bufferSize: 10,
      stopBits: 1,
      autoOpen: false,
    },
    this.config,
  );
  var serial = new SerialPort({...config, path: this.config.device});

  this.serial = serial;

  serial.on('error', function(err) {
    self.emit('error', err);
  });
  serial.on('open', function(err) {
    if (err) return cb(err);
    serial.on('data', function(data) {
      self._process(data);
    });
    serial.on('close', function() {
      self.emit('disconnected');
      console.log('rs232 disconnected');
    });
    self.lightOff();
    cb();
  });

  serial.open((error) => {
    if(error) {
      console.log(error.message);
      cb(error);
    }
  });
};

Id003Rs232.prototype.send = function send(command, data) {
  var codes = CMD[command];
  if (!codes)
    throw new Error('Invalid command: ' + command);

  // parameters
  switch(command) {
    case 'currencypath':
      codes[5] = data.path1;
      codes[8] = data.path2;
      var verify = Crc.compute(codes.slice(0, -2));
      codes.writeUInt16LE(verify, codes.length - 2);
      break;
    case 'payout':
      codes[5] = data.count;
      codes[6] = data.box;
      var verify = Crc.compute(codes.slice(0, -2));
      codes.writeUInt16LE(verify, codes.length - 2);
      break;
    case 'setcount':
      codes[5] = data.count;
      codes[7] = data.box;
      var verify = Crc.compute(codes.slice(0, -2));
      codes.writeUInt16LE(verify, codes.length - 2);
      break;
    case 'setcurrentcount':
      codes[5] = data.count;
      codes[7] = data.box;
      var verify = Crc.compute(codes.slice(0, -2));
      codes.writeUInt16LE(verify, codes.length - 2);
      break;
}

  // send
  this.serial.write(codes);
};

Id003Rs232.prototype.close = function close(cb) {
  this.serial.close(cb);
};

Id003Rs232.prototype.lightOn = function lightOn() {
  var serial = this.serial;

  // TODO can remove this once all deployments have new version of node-serialport
  if (!serial.getStatus) return;

  var self = this;
  serial.getStatus(function(err, status) {
    if (err) return self.emit('error', err);
    var newValue = status | SerialPort.TIOCM_RTS;
    serial.setStatus(newValue, function(err) {
      if (err) return self.emit('error', err);
    });
  });
};

Id003Rs232.prototype.lightOff = function lightOff() {
  var serial = this.serial;

  // TODO can remove this once all deployments have new version of node-serialport
  if (!serial.getStatus) return;

  var self = this;
  serial.getStatus(function(err, status) {
    if (err) return self.emit('error', err);
    var newValue = status & ~SerialPort.TIOCM_RTS;
    serial.setStatus(newValue, function(err) {
      if (err) return self.emit('error', err);
    });
  });
};

Id003Rs232.prototype._acquireSync = function _acquireSync(data) {
  var payload = null;
  for (var i = 0; i < data.length; i++) {
    if (data[i] === SYNC) {
      payload = data.slice(i);
      break;
    }
  }

  return payload || new Buffer(0);
};

Id003Rs232.prototype._crcVerify = function _crcVerify(payload) {
  var payloadCrc = payload.readUInt16LE(payload.length - 2);
  var crc = Crc.compute(payload.slice(0, -2));
  //console.log('CRC ('+payload.toString('hex')+','+payloadCrc+','+crc+')');
  var verify =  crc === payloadCrc;
  if (!verify) throw new Error('CRC error ('+payload.toString('hex')+','+payloadCrc+','+crc+')');
};

Id003Rs232.prototype._parse = function _parse(packet) {
  this._crcVerify(packet);
  var data = packet.length === 5 ? null : packet.slice(3, -2);
  var commandCode = packet[2];
  this._interpret(commandCode, data);
};

Id003Rs232.prototype._interpret = function _interpret(commandCode, rawData) {
  var command = RSP[commandCode];
  if (!command) {
    this.emit('unknownCommand', commandCode);
    return;
  }

  var data = this._parseData(command, rawData);
  // we can change commnad in response, if we need move state to another state
  if(data && data.command)
    command = data.command;
  this.emit('message', command, data);
};

///
/// Parsimg of response
///
Id003Rs232.prototype._parseData = function _parseData(command, rawData) {
  switch (command) {
    case 'escrow':
      return this._escrow(rawData);
    case 'version':
      return this._version(rawData);
    case 'rejecting':
      return this._rejecting(rawData);
    case 'denominations':
      return this._denominations(rawData);

    // command currencypath, setcount, cetcurrentcount and count returns same response
    case 'currencypath':
      switch(rawData[1]) {
        case 0xd0:
          return this.parseCurrencyPath(rawData);
        case 0xd2:
          return this.parseSetCount(rawData);
        case 0x92:
          return this.parseCount(rawData);
        case 0xe2:
          return this.parseSetCurrentCount(rawData);
      }
    case 'stacked':
      return this.parseStacked(rawData);
    default:
      return null;
  }
};

Id003Rs232.prototype._escrow = function _escrow(rawData) {
  var currencyCode = rawData[0];
  var hexCode = 'x' + rawData.toString('hex');
  var denomination = this.denominations[currencyCode];
  return { denomination: denomination, code: currencyCode, hexCode };
};

Id003Rs232.prototype._rejecting = function _rejecting(rawData) {
  var code = rawData[0];
  var reason = REJECTION_REASONS[code];
  return { reason: reason, code: code };
};

Id003Rs232.prototype._denominations = function _denominations(rawData) {
  // TODO: add in currency tables to support multiple currencies at once
  // Last two bytes are boot version
  if (this.denominations) return;
  this.denominations = {};
  var rawLength = rawData.length;
  for (var offset = 0; offset < rawLength; offset += 4) {
    var escrowCode = rawData[offset];
    var denominationInteger = rawData[offset + 2];
    if (denominationInteger === 0x00) continue;
    var denominationExponent = rawData[offset + 3];
    var denomination = denominationInteger * Math.pow(10, denominationExponent);
    this.denominations[escrowCode] = denomination;
  }
};

///
/// Parse response to selected path
///
Id003Rs232.prototype.parseCurrencyPath = function parseCurrencyPath(rawData) {
  if (rawData[1]==0xd0) {
    var path1 = rawData[2];
    var path2 = rawData[5];
    return { status: 'ok', path1: path1, path2: path2 };
  }
};

///
/// Parse response to set count
/// set 5 to box1
/// [FC 0A F0 20 D2 05 00 01 A6 D8]
/// set 10 to box2
/// [FC 0A F0 20 D2 0A 00 02 FA A0]
///
Id003Rs232.prototype.parseSetCount = function parseSetCount(rawData) {
  if (rawData[1]==0xd2) {
    var count = rawData[2]; // pocet v hex
    var box = rawData[4];
    return { status: 'ok', command: 'setcount', count: count, box: box };
  }
};

///
/// Parse response to count
/// example b1=5, b2=10
///           0     b1    b2
/// [FC 0B F0 20 92 05 00 0A 00 D1 64]
///
Id003Rs232.prototype.parseCount = function parseCount(rawData) {
  if (rawData[1]==0x92) {
    var path1 = rawData[2];
    var path2 = rawData[4];
    return { status: 'ok', command: 'count', path1: path1, path2: path2 };
  }
};

///
/// Parse response to set count
/// set 5 to box1
/// [FC 0A F0 20 D2 05 00 01 A6 D8]
/// set 10 to box2
/// [FC 0A F0 20 D2 0A 00 02 FA A0]
///
Id003Rs232.prototype.parseSetCurrentCount = function parseSetCurrentCount(rawData) {
  if (rawData[1]==0xe2) {
    var count = rawData[2]; // pocet v hex
    var box = rawData[4];
    return { status: 'ok', command: 'setcurrentcount', count: count, box: box };
  }
};

///
/// Parsing stacked data
///
Id003Rs232.prototype.parseStacked = function parseStacked(rawData) {
  var path = rawData[0];
  return { status: 'ok', path: path };
};

Id003Rs232.prototype._version = function _version(rawData) {
  this.softwareVersion = rawData.slice(0, -2).toString();
  return this.softwareVersion;
};

Id003Rs232.prototype._process = function _process(data) {
  this.buf = Buffer.concat([this.buf, data]);
  this.buf = this._acquireSync(this.buf);

  // Wait for size byte
  if (this.buf.length < 2) return;

  var responseSize = this.buf[1];

  // Wait for whole packet
  if (this.buf.length < responseSize) return;

  var packet = this.buf.slice(0, responseSize);
  this.buf = this.buf.slice(responseSize);

  try {
    this._parse(packet);
  } catch (ex) {
    console.log(ex.message);
    this.emit('badFrame');
  }
};

module.exports = Id003Rs232;
