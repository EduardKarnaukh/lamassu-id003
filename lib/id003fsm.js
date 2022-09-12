'use strict';

var StateMachine = require('./contrib/javascriptstatemachine');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var _ = require('lodash');

var Id003Fsm = function(config) {
  EventEmitter.call(this);
  this.config = config;
  this.disableFlag = false;
  this.start();
};

util.inherits(Id003Fsm, EventEmitter);
Id003Fsm.factory = function factory(config) {
  return new Id003Fsm(config);
};

StateMachine.create({
  target: Id003Fsm.prototype,
  error: function(eventName, from, to, args, errorCode, errorMessage, err) {
    if (err) this.emit('error', err);
    else console.log('FSM: %s', errorMessage);
  },
  events: [
    { name: 'start', from: ['none', 'Failure'], to: 'Start' },
    { name: 'badFrame', from: '*', to: 'BadFrame' },
    { name: 'commerror', from: 'Start',  to: 'ComError' },
    { name: 'connect', from: 'Start',  to: 'Connected' },
    { name: 'connect', from: 'Refresh', to: 'Disable'},
    { name: 'refresh', from: 'Start', to: 'Refresh'},
    { name: 'powerUp', from: '*', to: 'PowerUp' },
    { name: 'powerUpAcceptor',
        from: ['Accepting', 'Escrow', 'Stacking', 'Paused'],
        to: 'PowerUp' },
    { name: 'powerUpStacker',
        from: ['Stacking', 'VendValid', 'Stacked', 'Paused'],
        to: 'PowerUp' },
    { name: 'denominations', from: '*', to: 'Denominations' },
    { name: 'version', from: '*', to: 'Version' },
    { name: 'currencypath', from: '*', to: 'CurrencyPath' },
    { name: 'setcount', from: '*', to: 'SetCount' },
    { name: 'setcurrentcount', from: '*', to: 'SetCurrentCount' },
    { name: 'count', from: '*', to: 'Count' },
    { name: 'paying', from: '*', to: 'Paying' },
    { name: 'paystay', from: '*', to: 'PayStay' },
    { name: 'payvalid', from: '*', to: 'PayValid' },
    { name: 'invalidcommand', from: '*', to: 'InvalidCommand' },
    { name: 'recyclerunitfailure', from: '*', to: 'RecyclerUnitFailure' },
    { name: 'initialize', from: '*', to: 'Initialize' },
    { name: 'enable', from: '*', to: 'Enable' },
    { name: 'disable', from: '*', to: 'Disable' },
    { name: 'escrow', from: ['Paused', 'Enable', 'Accepting', 'Escrow'],
        to: 'Escrow' },
    { name: 'returning', from: ['Escrow', 'Returning', 'Paused'],
        to: 'Returning' },
    { name: 'stacking', from: ['Escrow', 'Stacking', 'Paused'], to: 'Stacking' },
    { name: 'vendValid',
        from: ['Connected', 'Escrow', 'Stacking', 'VendValid', 'Paused'],
        to: 'VendValid' },
    { name: 'stacked', from: ['VendValid', 'Stacked', 'Paused'], to: 'Stacked' },
    { name: 'rejecting',
        from: ['Accepting', 'Rejecting', 'Escrow', 'Stacking', 'Paused'],
        to: 'Rejecting' },
    { name: 'stackerOpen', from: '*', to: 'StackerOpen' },
    { name: 'stackerFull',
        from: ['StackerFull', 'Stacked', 'VendValid', 'Paused'],
        to: 'StackerFull' },
    { name: 'accepting', from: ['Paused', 'Enable', 'Accepting'],
        to: 'Accepting' },
    { name: 'failure', from: '*', to: 'Failure' },
    { name: 'acceptorJam', from: '*', to: 'AcceptorJam' },
    { name: 'stackerJam', from: '*', to: 'StackerJam' },
    { name: 'cheated', from: '*', to: 'Cheated' },
    { name: 'pause', from: '*', to: 'Paused' }
  ]
});

var TRANSIENT = ['returning', 'stacking', 'stacked', 'accepting', 'rejecting'];

// Reset on power up
Id003Fsm.prototype.onleavestate = function(event, from, to) {
  clearTimeout(this.stateTimeout);
  console.log('003-FSM: %s [ %s -> %s ]', event, from, to);
};

// TODO FIX this will never do anything, as it stands. Check for transient event,
// or change TRANSIENT to states, not events.
Id003Fsm.prototype.onenterstate = function(event, from, to) {
  if (!_.has(TRANSIENT, to)) return;
  var self = this;
  this.stateTimeout = setTimeout(function() {
    self.emit('stuck');
  }, this.config.transientTimeout);
};

Id003Fsm.prototype.onPowerUp = function() { this.emit('powerUp'); };

Id003Fsm.prototype.onleaveConnected = function() {
  this.emit('ready');
};

Id003Fsm.prototype.onDenominations = function() {
  this.emit('denominations');
};

Id003Fsm.prototype.onVersion = function(event, from, to, data) {
  this.emit('version', data);
};

Id003Fsm.prototype.onCurrencyPath = function() {
};

Id003Fsm.prototype.onPayStay = function(event, from, to, data) {
  this.emit('onpaystay');
};

Id003Fsm.prototype.onPayValid = function(event, from, to, data) {
  this.emit('onpayvalid');
  this._dispatch('ack');
};

Id003Fsm.prototype.onEnable = function() {
  if (this.disableFlag) {
    this.disableFlag = false;
    this._dispatch('inhibit');
  }
};

Id003Fsm.prototype.onleaveDisable = function() {
  this.disableFlag = false;
};

Id003Fsm.prototype.onDisable = function(event, from) {
  this.disableFlag = false;
  if (from === 'Initialize') this.emit('standby');
};

Id003Fsm.prototype.onAccepting = function() {
  this.emit('billAccepted');
};

Id003Fsm.prototype.onRejecting = function(event, from, to, data) {
  console.log('Rejected bill: %s', data.reason);
  this.emit('billRejected', data);
};

Id003Fsm.prototype.onReturning = function() {
  this.emit('billRejected', {reason: 'Returned', code: null});
};

Id003Fsm.prototype.onEscrow = function(event, from, to, data) {
  this.emit('billRead', data);
};

Id003Fsm.prototype.onStacked = function(event, from, to, data) {
  this.emit('billStacked', data);
};

Id003Fsm.prototype.onCurrencyPath = function(event, from, to, data) {
  this.emit('pathCurrency', data);
};

Id003Fsm.prototype.onSetCount = function(event, from, to, data) {
  this.emit('pathSetCount', data);
};

Id003Fsm.prototype.onSetCurrentCount = function(event, from, to, data) {
  this.emit('pathSetCurrentCount', data);
};

Id003Fsm.prototype.onCount = function(event, from, to, data) {
  this.emit('pathCount', data);
};

Id003Fsm.prototype.onVendValid = function(event, from) {
  // TODO: handle this better
  if (from === 'Connected') {
    this._dispatch('reset');
    return;
  }
  this.emit('billValid');
  this._dispatch('ack');
};

Id003Fsm.prototype.onStackerOpen = function() {
  this.emit('stackerOpen');
};

Id003Fsm.prototype.onAcceptorJam = function() {
  this.emit('acceptorJam');
};

Id003Fsm.prototype.onCheated = function() {
  this.emit('cheated');
}

Id003Fsm.prototype.onStackerJam = function() {
  this.emit('stackerJam');
};

Id003Fsm.prototype._dispatch = function(cmd) {
  this.emit('dispatch', cmd);
};

module.exports = Id003Fsm;
