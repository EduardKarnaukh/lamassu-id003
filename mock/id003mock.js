'use strict';

// This mock emulates a JCM iVizion

var StateMachine = require('../lib/contrib/javascriptstatemachine');
var count = 0;
var callback = null;
var lastBill = null;
var rejectCode = null;

var fsm = StateMachine.create({
  initial: 'Connected',
  error: function(eventName, from, to, args, errorCode, errorMessage, err) {
    console.log('Mock: %s', errorMessage);
    if (err) console.log('Mock: %s', err);
    throw new Error(err);
  },  
  events: [
    { name: 'powerDown', from: '*',  to: 'PowerDown' },  
    { name: 'connect', from: 'Start',  to: 'Connected' },
    { name: 'activate', from: 'Connected', to: 'PowerUp' },
    { name: 'reset', from: ['PowerUp', 'PowerUpAcceptor', 'PowerUpStacker'], 
        to: 'Reset' },
    { name: 'powerUp', from: '*', to: 'PowerUp' },
    { name: 'powerUpAcceptor', from: 'PowerDown', to: 'PowerUpAcceptor' },
    { name: 'powerUpStacker', from: 'PowerDown', to: 'PowerUpStacker' },
    { name: 'activate', from: 'Reset', to: 'Initialize' },
    { name: 'activate', from: 'Initialize', to: 'Disable' },
    { name: 'accepting', from: ['Enable', 'Accepting'], to: 'Accepting' },
    { name: 'escrow', from: 'Accepting', to: 'Escrow' },
    { name: 'stack', from: 'Escrow', to: 'Stacking' },
    { name: 'activate', from: 'Stacking', to: 'VendValid' },
    { name: 'stacked', from: 'VendValid', to: 'Stacked' },
    { name: 'activate', from: 'Stacked', to: 'Enable' },
    { name: 'inhibit', from: ['Initialize', 'Enable', 'Disable'], 
        to: 'Disable' },
    { name: 'unInhibit', from: ['Initialize', 'Disable', 'Enable'], 
        to: 'Enable' },
    { name: 'rejecting', from: ['Accepting', 'Rejecting', 'Escrow', 'Stacking'], 
        to: 'Rejecting' },
    { name: 'stackerFull', from: ['StackerFull', 'Stacked', 'VendValid'], 
        to: 'StackerFull' },
    { name: 'initialize', 
        from: ['Reset', 'StackerFull', 'Initialize'], to: 'Initialize' }
  ],
  callbacks: {
    onleavestate: function(event, from, to) { console.log('Mock entering %s', to); },
    onescrow: function(event, from, to, data) {
      lastBill = data;
    },
    onrejecting: function(event, from, to, data) {
      rejectCode = data;
    }
  }
});

exports.init = function init(cb) {
  callback = cb;
};

var stateToResponse = {
  Connected: null,
  PowerUp: 'powerUp',
  PowerUpAcceptor: 'powerUpAcceptor',
  PowerUpStacker: 'powerUpStacker',
  Initialize: 'initialize',
  Enable: 'enable',
  Disable: 'disable',
  Accepting: 'accepting',
  Escrow: 'escrow',
  Stacking: 'stack',
  VendValid: 'vendValid',
  Stacked: 'stacked',
  Rejecting: 'rejecting',
  StackerFull: 'stackerFull'
};

// cmd will have Req suffix
exports.dispatch = function dispatch(cmd, data) {
  if (cmd === 'status') {
    if (fsm.can('activate')) {
      if (count < 3) {
        count++;
      } else {
        count = 0;
        fsm.activate();
      }      
    }
    if (fsm.current === 'Escrow') {
      _respond('escrow', lastBill);
    } else if (fsm.current === 'Rejecting') {
      _respond('rejecting', rejectCode);
    } else _respond(stateToResponse[fsm.current]);
  } else {
    fsm[cmd](data);
  }
};

// simulate is an alias for dispatch
exports.simulate = exports.dispatch;

function _respond(cmd, data) {
  callback(cmd, data);
}
