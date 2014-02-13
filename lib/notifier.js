var Websuckets = require('ws'),
    events = require('events'),
    uuid = require('node-uuid'),
    util = require('util'),
    sqlite = require('sqlite3');

var AeroGear = {};

AeroGear.SimplePushNotifier = function (settings) {
    if (!(this instanceof  AeroGear.SimplePushNotifier)) {
        return new  AeroGear.SimplePushNotifier(settings);
    }

    settings = settings || {};

    events.EventEmitter.call(this);

    // Private Instance vars
    var connectURL = settings.connectURL || '',
        client = null,
        pushStore = {};//JSON.parse( localStorage.getItem("ag-push-store") || '{}' );

    pushStore.channels = pushStore.channels || [];
    for (var channel in pushStore.channels) {
        pushStore.channels[channel].state = 'available';
    }
    //localStorage.setItem( "ag-push-store", JSON.stringify( pushStore ) );

    this.getPushStore = function () {
        return pushStore;
    };

    /**
        Sets the value of the private pushStore var as well as the local store
        @private
     */
    this.setPushStore = function (newStore) {
        pushStore = newStore;
        //localStorage.setItem( "ag-push-store", JSON.stringify( newStore ) );
    };

    this.processMessage = function (message) {
        var channel, updates;

        if (message.messageType === 'register' && message.status === 200) {
            channel = {
                channelID: message.channelID,
                version: message.version,
                state: 'used'
            };
            pushStore.channels = this.updateChannel(pushStore.channels, channel);
            this.setPushStore(pushStore);

            channel.pushEndpoint = message.pushEndpoint;

            this.emit(message.channelID + '-success', channel);
        } else if (message.messageType === 'register') {
            throw 'SimplePushRegistrationError';
        } else if (message.messageType === 'notification') {
            updates = message.updates;

            updates.forEach(function (update) {
                this.emit('notification', update);
            }.bind(this));

            // Acknowledge all updates sent in this notification message
            message.messageType = 'ack';
            client.send(JSON.stringify(message));
        } else {
            console.log('blah', message);
        }
    };

    /**
        Generate the hello message send during the initial handshake with the SimplePush server. Sends any pre-existing channels for reregistration as well
        @private
     */
    this.generateHelloMessage = function () {
        var msg = {
            messageType: 'hello',
            uaid: '',
            channelIDs: []
        };

        return JSON.stringify(msg);
    };

    this.findChannelIndex = function (channels, filterField, filterValue) {
        for (var i = 0; i < channels.length; i++) {
            if (channels[i][filterField] === filterValue) {
                return i;
            }
        }
    };

    this.updateChannel = function (channels, channel) {
        for (var i = 0; i < channels.length; i++) {
            if (channels[i].channelID === channel.channelID) {
                channels[i].version = channel.version;
                channels[i].state = channel.state;
                break;
            }
        }

        return channels;
    };

    this.bindSubscribeSuccess = function (channelID, request) {
        this.removeListener(channelID + '-success', request.onsuccess);
        this.on(channelID + '-success', function (event) {
            request.onsuccess(event);
        });
    };

    this.getConnectURL = function () {
        return connectURL;
    };

    /**
        Set the value of the private connectURL var
        @private
        @param {String} url - New connectURL for this client
     */
    this.setConnectURL = function (url) {
        connectURL = url;
    };


    /**
        Returns the value of the private client var
        @private
     */
    this.getClient = function () {
        return client;
    };

    /**
        Sets the value of the private client var
        @private
     */
    this.setClient = function (newClient) {
        client = newClient;
    };
};

util.inherits(AeroGear.SimplePushNotifier, events.EventEmitter);

AeroGear.SimplePushNotifier.prototype.connect = function (options) {
    options = options || {};

    var client = new Websuckets(options.url || this.getConnectURL());

    client.on('open', function () {
        client.send(this.generateHelloMessage());
    }.bind(this));

    client.on('error', function (error) {
        this.emit('error', error);
    }.bind(this));

    client.on('message', function (data, flags) {
        var pushStore = this.getPushStore(),
            message = JSON.parse(data);

        if (message.messageType === 'hello') {
            if (message.uaid !== pushStore.uaid) {
                pushStore.uaid = message.uaid;
                this.setPushStore(pushStore);
            }

            if (options.onConnect) {
                options.onConnect(message);
            }
        } else {
            this.processMessage(message);
        }
    }.bind(this));

    this.setClient(client);
};

AeroGear.SimplePushNotifier.prototype.disconnect = function () {
    var client = this.getClient();
    client.close();
    this.emit('close');
};

AeroGear.SimplePushNotifier.prototype.subscribe = function (channels, reset) {
    var index, response, channelID, channelLength, msg,
        processed = false,
        client = this.getClient(),
        pushStore = this.getPushStore();

    if (reset) {
        this.unsubscribe(this.getChannels());
    }

    channels = Array.isArray(channels) ? channels : [channels];
    pushStore.channels = pushStore.channels || [];
    channelLength = pushStore.channels.length;

    for (var i = 0; i < channels.length; i++) {
        if (channelLength) {
            index = this.findChannelIndex(pushStore.channels, 'state', 'available');
            if (index !== undefined) {
                this.bindSubscribeSuccess(pushStore.channels[index].channelID, channels[i].requestObject);
                channels[i].channelID = pushStore.channels[index].channelID;
                channels[i].state = 'used';
                this.emit(channels[i].channelID + '-success', channels[i]);

                pushStore.channels[index] = channels[i];
                processed = true;
            }
        }

        if (!processed) {
            channels[i].channelID = channels[i].channelID || uuid();
            channels[i].state = 'used';
            msg = {
                messageType: 'register',
                channelID: channels[i].channelID
            };
            this.bindSubscribeSuccess(channels[i].channelID, channels[i].requestObject);
            client.send(JSON.stringify(msg));

            pushStore.channels.push(channels[i]);
        }

        processed = false;
    }

    this.setPushStore(pushStore);

    return this;
};

AeroGear.SimplePushNotifier.prototype.unsubscribe = function (channels) {
    var client = this.getClient(),
        msg = {};

    channels = Array.isArray(channels) ? channels : [channels];
    channels.forEach(function (channel) {
        msg = {
            messageType: 'unregister',
            channelID: channel.channelID
        };

        client.send(JSON.stringify(msg));
    });
};

module.exports = AeroGear;
