var client = require('./index'),
    mailEndpoint, mailRequest, pushClient, otherRequest, otherEndpoint;

pushClient = client.SimplePushClient({
    simplePushServerURL: 'ws://localhost:7777/simplepush/websocket',
    onConnect: function () {
        console.log('connected');

        mailRequest = pushClient.push.register();

        otherRequest = pushClient.push.register();

        mailRequest.onsuccess = function (event) {
            mailEndpoint = event;

            console.log(mailEndpoint);

            if (mailEndpoint.pushEndpoint) {
                console.log('push endpoint url for mail', mailEndpoint.pushEndpoint);
            } else {
                console.log('mail be registered');
            }

            console.log('subscribed to mail messages on' + mailEndpoint.channelID);
        };

        otherRequest.onsuccess = function (event) {
            otherEndpoint = event;

            if (otherEndpoint.pushEndpoint) {
                console.log('push endpoint url for otherEndpoint', otherEndpoint.pushEndpoint);
            } else {
                console.log('otherEndpoint be registered');
            }

            console.log('subscribed to otherEndpoint messages on' + otherEndpoint.channelID);
        };


        pushClient.on('push', function (message) {
            if (message.channelID === mailEndpoint.channelID) {
                // let's react on that mail....
                console.log('Mail Notification - ' + message.version);
            } else {
                console.log('Other Notification - ' + message.version);
            }
        });
    },
    onClose: function () {}
});
