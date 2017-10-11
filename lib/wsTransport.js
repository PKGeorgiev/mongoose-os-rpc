const WebSocket = require('ws');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var TransportBase = require('./transportBase');
var defaults = require('defaults');

function WsTransport(options) {
  var self = this;
  
  TransportBase.call(self, options);

  self._connect();
}

util.inherits(WsTransport, TransportBase)


module.exports = WsTransport;


WsTransport.prototype._connect = function() {
  var self = this;

  self._socket = new WebSocket(self._url.href);
  
  self._socket.on('open', function() {
    self.emit('open');
  });
  
  self._socket.on('close', function(code, reason) {
    self.emit('close', code, reason);
    setTimeout(self._connect.bind(self), self._options.reconnectPeriod);
  })
  
  self._socket.on('message', self._onMessage.bind(this));
  
  self._socket.on('error', function() {
    // Re-route errors
    self.emit('error', ...arguments);
  });
}

WsTransport.prototype._onMessage = function(data) {
  var self = this;

  try {
    let obj = JSON.parse(data)
    
    self._processCallback(obj); 
  
  } catch (e) {
    console.log(e);
    self.emit('error', new Error("Unable to parse JSON string."), data, e);
  }
}

WsTransport.prototype.request = function(packet, callback) {
  var self = this;
  
  self._callback = callback;  
  
  self._socket.send(JSON.stringify(packet), function(error) {
    if (error) {     
      console.log(error);
      self._processCallback(self._composeErrorPacket(packet, 400, "Unable to send packet via WS."));
    }    
  });

}


