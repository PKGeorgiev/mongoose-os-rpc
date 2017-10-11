var EventEmitter = require('events').EventEmitter;
var util = require('util');
var defaults = require('defaults');
var url = require('url');

function TransportBase(options) {
  var self = this;  
  
  self._options = options || {};
  
  if (typeof self._options.address === "undefined") {
    throw new Error("Address field cannot be empty!");
  } else {
    self._url = url.parse(self._options.address);
    self._baseUrl = self._url.protocol + "//" + self._url.host + (self._url.port != null ? self._url.port.toString() : "" );
  }
  
  self._options = defaults(self._options, { reconnectPeriod: 10000 });

  self._callback = null;
  
  EventEmitter.call(self)
  
}

util.inherits(TransportBase, EventEmitter)

TransportBase.prototype._processCallback = function (body) {
  var self = this;  
  
  if (Object.getPrototypeOf( body ) !== Object.prototype) {
    
    console.log("THE RESPONSE IS NOT AN OBJECT!");
    self.emit('error', new Error("The response is not valid JSON object."), body);
    
  } else if (typeof body.id == "undefined") {
    
    self.emit('error', new Error("Malformed JSON object (missing ID property)."), body);
    
  } else if (typeof body.error != "undefined") {
    
    self._callback(body.error, null, body.id, body.tag ? body.tag : null);
    
  } else {
    
    self._callback(null, body.result, body.id, body.tag ? body.tag : null);
    
  }     
  
}

TransportBase.prototype._composeErrorPacket = function (requestPacket, code, msg) {
  let response = {
    id: requestPacket.id,
    tag: requestPacket.tag,
    error: {
        "code": code,
        "message": msg
    }
  };
  
  return response;
}


module.exports = TransportBase;