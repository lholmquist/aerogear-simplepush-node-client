var notifier = require('./notifier'),
    events = require('events'),
    util = require('util');

var AeroGear = {};

AeroGear.SimplePushClient = function (options) {
    if (!(this instanceof  AeroGear.SimplePushClient)) {
        return new  AeroGear.SimplePushClient(options);
    }

    this.options = options || {};

    events.EventEmitter.call(this);

    var url = options.url;

    var spClient = this,
        connectOptions;

    connectOptions = {
        onConnect: function () {

            spClient.push = (function () {
                return {
                    register: function () {
                        var request = {
                            onsuccess: function (event) {}
                        };

                        if (!spClient.simpleNotifier) {
                            throw 'SimplePushConnectionError';
                        }

                        spClient.simpleNotifier.subscribe({
                            requestObject: request
                        });

                        return request;
                    },
                    unregister: function (endpoint) {
                        spClient.simpleNotifier.unsubscribe(endpoint);
                    },
                    reconnect: function () {
                        spClient.simpleNotifier.connect(connectOptions);
                    }
                };
            })();

            if (spClient.options.onConnect) {
                spClient.options.onConnect();
            }
        },
        onClose: function () {
            spClient.simpleNotifier.disconnect(spClient.options.onClose);
        }
    };

    spClient.simpleNotifier = notifier.SimplePushNotifier({
        connectURL: spClient.options.simplePushServerURL
    });

    spClient.simpleNotifier.on('setup', function () {
        spClient.simpleNotifier.connect(connectOptions);
    });

    spClient.simpleNotifier.on('notification', function (message) {
        this.emit('push', message);
    }.bind(this));
};

util.inherits(AeroGear.SimplePushClient, events.EventEmitter);

module.exports = AeroGear;
