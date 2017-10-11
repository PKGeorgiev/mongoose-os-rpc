# mongoose-os-rpc: a Node.js implementation of Mongoose OS' RPC protocol

mongoose-os-rpc is a client library that allows you to call remote functions (RPC) on devices which are running Mongoose OS (generally ESP8266).
The library laverages Node's callbacks. Unconfirmed RPC calls will timeout and the caller will be notified about the failure.

**Note**: For instructions how to install and setup Mongoose OS, please visit the official site - https://mongoose-os.com/docs/quickstart/setup.html

## Protocol support

This library implements the RPC protocol (JSON based) as described here: https://github.com/mongoose-os-libs/rpc-common

## Transports

RPC packets are sent via a particular transport. Currently http, ws and mqtt are supported.

### HTTP

The url format is: http://devideIpOrName/rpc

### WS (WebSocket)

The url format is: ws://devideIpOrName/rpc

### MQTT

The url format is: mqtt://devideIpOrName/deviceName
This transport requires a client id. If the clientId option was not specified a unique value will be generated.
The RPC client will then subscribe to client-id/rpc topic, listening for replies.

## Installing

```
npm install --save mongoose-os-rpc
```

## Usage examples

### Using Rpc class (automatic transport creation)

```js

const Rpc = require("mongoose-os-rpc").Rpc;

// Instantiate Rpc object using the short format (specifying address property)
// The Rpc object will internally create an instance of an appropriate transport
let rpc = new Rpc({
  address: 'http://deviceIpOrName/rpc'
  // OR: address: 'ws://deviceIpOrName/rpc'
  // OR: address: 'mqtt://deviceIpOrName/esp8266_C6D764'  <-- In this case esp8266_C6D764 is device's name as configured in Mongoose OS
})

```

### Manually creating a transport

```js

const Rpc = require("mongoose-os-rpc").Rpc;
const HttpTransport = require("mongoose-os-rpc").HttpTransport;

let transport = new HttpTransport({
  address: 'http://deviceIpOrName/rpc'
});

let rpc = new Rpc({
  transport: transport
})

```

### Calling FS.List function via http

```js
const Rpc = require("mongoose-os-rpc").Rpc;

// Instantiate Rpc object using the short format (specifying address property)
// The Rpc object will internally create an instance of an appropriate transport
let rpc = new Rpc({
  address: 'http://deviceIpOrName/rpc'
  // OR: address: 'ws://deviceIpOrName/rpc'
  // OR: address: 'mqtt://deviceIpOrName/esp8266_C6D764'  <-- In this case esp8266_C6D764 is device's name as configured in Mongoose OS
});

// Subscribe for error events
rpc.on('error', function(){
  console.log("RPC ERROR");
  console.log(arguments);
})

// Subscribe for disconnect events
rpc.on('close', function() {
  console.log("RPC channel was closed!");
});

// Subscribe for connect events
// To distinguish between connect and reconnect use isReconnect() function
rpc.on('open', function() {
  console.log("RPC channel was opened!");

    if (!rpc.isReconnect()) {
      
      rpc.call("FS.List", {}, "", function(err, result, tag){
        
        console.log("CALLBACK (FS.List)");
        console.log(err);
        console.log(result);
        
        if (err) {
          // Oops, something went wrong
        } else {
          console.log(result)
        }
                
      });

    } else {
      console.log("The underlying transport had reconnected");
    }
    
});



```

## TODO

* Implement and test transport authentication
* Implement tests
