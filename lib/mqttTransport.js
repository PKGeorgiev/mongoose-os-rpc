const TransportBase = require('./transportBase');
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const mqtt = require('mqtt')
const uuidv1 = require('uuid/v1')
const extend = require('extend')
const url = require('url');
const defaults = require('defaults');


function MqttTransport(options) {
  var self = this;
   
  TransportBase.call(self, options)
   
  self._options = defaults(self._options, {
    clientId: uuidv1()
  }); 
   
  self._device = self._url.path.slice(1);

  self._client  = mqtt.connect(self._baseUrl, { reconnectPeriod: self._options.reconnectPeriod } );
  
  self._client.subscribe(self._options.clientId + "/rpc"); 
  
  self._client.on('connect', function() {
    self.emit('open');
  });
  
  self._client.on('message', self._onMessage.bind(this));
  
  self._client.on('close', function() {
    self.emit('close');
  })
  
  self._client.on('error', function() {
    // Re-route errors
    self.emit('error', ...arguments);
  });
  
  self._callback = null;
}

util.inherits(MqttTransport, TransportBase)


module.exports = MqttTransport;


MqttTransport.prototype._onMessage = function(topic, payload) {
  var self = this;
  
  try {
    let obj = JSON.parse(payload.toString())

    self._processCallback(obj);
  
  } catch (e) {
    console.log(e);
    self.emit('error', new Error("Unable to parse JSON string."), data, topic, payload);
  }
  
}

MqttTransport.prototype.request = function(packet, callback) {
  var self = this;
  
  self._callback = callback;
  
  packet.src = self._options.clientId; 
  
  self._client.publish(self._device + "/rpc", JSON.stringify(packet), { qos: 2 }, function(error) {
    if (error) {     
      console.log(error);
      self._processCallback(self._composeErrorPacket(packet, 400, "Unable to send packet via MQTT."));
    } 
  });

}

