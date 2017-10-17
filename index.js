var EventEmitter = require('events').EventEmitter;
var util = require('util')
var dict = require("dict");
var defaults = require('defaults');
var url = require('url');
var HttpTransport = require("./lib/httpTransport");
var WsTransport = require("./lib/wsTransport");
var MqttTransport = require("./lib/mqttTransport");
var crypto = require('crypto');

// Supported transports
var transports = {
  http: HttpTransport,
  ws  : WsTransport,
  mqtt: MqttTransport
}

function Rpc (options) {
  var self = this;
  
  EventEmitter.call(self)
  
  self._options = options || {};
  
  self._options = defaults(self._options, {
    timeout: 10000,       // RPC request timeout value
    transport: null,      // An instance of already configured transport
    address: null,        // Endpoint address (URL). An appropriate transport will be created
    transportOptions: {}, // Transport specific options
    debug: false
  });
  
  if (self._options.transport && self._options.address) {
    throw new Error("Address and Transport cannot be specified simultaneously.");
  }
  
  if (self._options.transport == null) {
    if (self._options.address == null) {
      throw new Error("You must specify Address OR Transport options.");
    } else {
      let tmpUrl = url.parse(self._options.address);
      let transport = tmpUrl.protocol.toLowerCase().replace(":", "");
     
      if (transport in transports) {
        self._options.transport = new transports[transport](defaults(self._options.transportOptions, { address: self._options.address, debug: self._options.debug }));
      } else {
        throw new Error("Unrecognized protocol [" + transport +  "]. Supported protocols: " + Object.keys(transports).join(", "));
      }

      delete self._options.address;      
      
    }
  }
  
  self._queue = dict();
  self._rid = Buffer.from(crypto.randomBytes(2)).readUInt16LE(0).toString();
  self._timerHandle = null;
  self._active = false;
  self._firstConnect = true;
  
  self._debug(self._options.transport._options);
  self._debug(self);
  
  self._options.transport.on('open', function() {
    
    self._debug("Transport opened");
    self._active = true;
    
    self.emit('open');
    
    if (self._firstConnect === false) {
      self._debug("This was a reconnect");
      self.emit('reconnect');
    }
    
  })
  
  self._options.transport.on('close', function(code, reason) {
    
    self._active = false;
    self._debug("Transport closed");
    
    self._firstConnect = false;
    
    self._enableTimer();
    self.emit('close');
  })
  
  self._options.transport.on('error', function() {
    // Re-route errors
    self.emit('error', ...arguments);
  });
  
  self._options.transport.on('debug', function() {
    // Re-route debug events
    self.emit('debug', ...arguments);
  });
  
}

util.inherits(Rpc, EventEmitter)


module.exports.Rpc = Rpc;
module.exports.HttpTransport = require("./lib/httpTransport");
module.exports.WsTransport = require("./lib/wsTransport");
module.exports.MqttTransport = require("./lib/mqttTransport");

Rpc.prototype._debug = function(msg) {
  var self = this;
  if (self._options.debug) {
    console.log(msg);
  }
}

Rpc.prototype.isReconnect = function() {
  var self = this;
  return self._firstConnect == false;
}

Rpc.prototype._disableTimer = function() {
  var self = this;  

  if (self._timerHandle) {    
    clearInterval(self._timerHandle);
    self._timerHandle = null;    
  }
}

Rpc.prototype._enableTimer = function() {
  var self = this;
  
  if (self._timerHandle == null) {
    self._timerHandle = setInterval(self._timerProc.bind(this), 1000);
  }
}

Rpc.prototype._timerProc = function() {
  var self = this; 

  self._debug("Timer event. Queue size: " + self._queue.size);
  
  if (self._queue.size == 0) {
    self._disableTimer();
    return;
  };

    self._queue.forEach(function (value, k) {
      
    if (self._active == false) {
      
      // The transport is inactive. Cancel pending requests
      let error = {
        "code": 503,
        "message": "The transport is not active."
      };
      
      process.nextTick(value.callback.bind(this), error, null);
      
      self._queue.delete(k);       
      
      
    } else if ((new Date()).getTime() - value.datetime >= self._options.timeout) {
      
      // Discard requests that had timed out
      let error = {
        "code": 408,
        "message": "Request timed out."
      };
      
      process.nextTick(value.callback.bind(this), error, null);
      
      self._queue.delete(k);      
    }
 
  }); 
   
  if (self._queue.size == 0) {
    self._disableTimer();
  }
}

Rpc.prototype.call = function(methodName, args, tag, callback) {
  var self = this;
  
  self._debug("Calling: " + methodName);
  self._debug(args);
  
  if (!self._active) {
    
    let error = {
        "code": 400,
        "message": "RPC transport is not active. Subscribe to on(open) event."
    };
    
    callback(error, null, null);
    
    return;
  }
  
  args = args || {};
  tag = tag || "";
  
  let rid = ++self._rid;
  
  self._debug("RID: " + rid);
  
  let rpcPacket = {
    method: methodName,
    args: args,
    tag: tag,
    id: rid
  };  

  self._queue.set(rid.toString(), {
    datetime: (new Date()).getTime(),
    payload: rpcPacket,
    callback: callback
  });
  
  self._options.transport.request(rpcPacket, function(error, result, packetId, packetTag) {
    
    if (!packetId || !self._queue.has(packetId.toString())) {
      self._debug("Invalid response");
      
      return;
      
    } else {
      self._queue.delete(packetId.toString());
      
      if (self._queue.size == 0) {
        self._disableTimer();
      }
    }
    
    if (error) {
        callback(error, null, packetTag);
    } else {
        callback(null, result, packetTag);
    };
  });
  
  self._enableTimer();
}

