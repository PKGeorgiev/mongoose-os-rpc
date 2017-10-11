var TransportBase = require('./transportBase');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var request = require('request');

function HttpTransport(options) {
  var self = this;
  
  TransportBase.call(self, options)
  
  process.nextTick(self.emit.bind(this), 'open');
}

util.inherits(HttpTransport, TransportBase)


module.exports = HttpTransport;


HttpTransport.prototype.request = function(packet, callback) {
  var self = this;
  
  self._callback = callback;  

  request.post(
      self._url.href,
      { json: packet },

      function (error, response, body) {
        if (error) {     
          self._processCallback(self._composeErrorPacket(packet, 400, error.code));
          
        } else if (response.statusCode == 200) {
          
          if (Object.getPrototypeOf( body ) !== Object.prototype) {
            
            self._processCallback(self._composeErrorPacket(packet, 400, "The server returned invalid JSON string."));
            
          } else {
            
            self._processCallback(body); 
            
          }
        } else {
          self._processCallback(self._composeErrorPacket(packet, response.statusCode, "Unexpected http code " + response.statusCode));
          
        };
      }
  );
  
  
  
}





