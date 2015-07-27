'use strict';

console.log('main.js');
var GCM_SENDER = '776729739926';
var API_KEY = window.GoogleSamples.Config.gcmAPIKey;
var GCM_ENDPOINT = 'https://android.googleapis.com/gcm/send';

var curlCommandDiv = document.querySelector('.js-curl-command');
var isPushEnabled = false;
var tk='';
// This method handles the removal of subscriptionId
// in Chrome 44 by concatenating the subscription Id
// to the subscription endpoint
function endpointWorkaround(pushSubscription) {
  // Make sure we only mess with GCM
  if (pushSubscription.endpoint.indexOf('https://android.googleapis.com/gcm/send') !== 0) {
    return pushSubscription.endpoint;
  }

  var mergedEndpoint = pushSubscription.endpoint;
  // Chrome 42 + 43 will not have the subscriptionId attached
  // to the endpoint.
  if (pushSubscription.subscriptionId &&
    pushSubscription.endpoint.indexOf(pushSubscription.subscriptionId) === -1) {
    // Handle version 42 where you have separate subId and Endpoint
    mergedEndpoint = pushSubscription.endpoint + '/' +
      pushSubscription.subscriptionId;
  }
  return mergedEndpoint;
}

function sendSubscriptionToServer(subscription) {
  // TODO: Send the subscription.endpoint
  // to your server and save it to send a
  // push message at a later date
  //
  // For compatibly of Chrome 43, get the endpoint via
  // endpointWorkaround(subscription)
  console.log('TODO: Implement sendSubscriptionToServer()');

toPushMessage({'event':'subscription','subscriptionId':subscription.subscriptionId})
  var mergedEndpoint = endpointWorkaround(subscription);
  showCurlCommand(mergedEndpoint);  
}

// NOTE: This code is only suitable for GCM endpoints,
// When another browser has a working version, alter
// this to send a PUSH request directly to the endpoint
function showCurlCommand(mergedEndpoint) {
  // The curl command to trigger a push message straight from GCM
  if (mergedEndpoint.indexOf(GCM_ENDPOINT) !== 0) {
    window.Demo.debug.log('This browser isn\'t currently ' +
      'supported for this demo');
    return;
  }

  var endpointSections = mergedEndpoint.split('/');
  var subscriptionId = endpointSections[endpointSections.length - 1];
tk = subscriptionId
  var curlCommand = 'curl --header "Authorization: key=' + API_KEY +
    '" --header Content-Type:"application/json" ' + GCM_ENDPOINT +
    ' -d "{\\"registration_ids\\":[\\"' + subscriptionId + '\\"]}"';

  curlCommandDiv.textContent = curlCommand;
}

function sendUnsubscriptionToServer(successful,subscription){
  console.log('successful',successful,subscription);
  toPushMessage({'event':'unsubscription','subscriptionId':subscription.subscriptionId});
}

function unsubscribe() {
  var pushButton = document.querySelector('.js-push-button');
  pushButton.disabled = true;
  curlCommandDiv.textContent = '';
  console.log('unsubscription');
  
  navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {
    // To unsubscribe from push messaging, you need get the
    // subcription object, which you can call unsubscribe() on.
    serviceWorkerRegistration.pushManager.getSubscription().then(
      function(pushSubscription) {
        // Check we have a subscription to unsubscribe
        if (!pushSubscription) {
          // No subscription object, so set the state
          // to allow the user to subscribe to push
          isPushEnabled = false;
          pushButton.disabled = false;
          pushButton.textContent = 'Enable Push Messages';
          console.log('!pushSubscription');
          return;
        }

console.log('--pushSubscription',pushSubscription);
        // TODO: Make a request to your server to remove
        // the users data from your data store so you
        // don't attempt to send them push messages anymore

        // We have a subcription, so call unsubscribe on it
        pushSubscription.unsubscribe().then(function(successful) {
          pushButton.disabled = false;
          pushButton.textContent = 'Enable Push Messages';
          isPushEnabled = false;
          console.log('unsubscription successful',successful);
          
          sendUnsubscriptionToServer(successful,pushSubscription);
          
          
        }).catch(function(e) {
          // We failed to unsubscribe, this can lead to
          // an unusual state, so may be best to remove
          // the subscription id from your data store and
          // inform the user that you disabled push
          console.log('unsubscription error',e);
          window.Demo.debug.log('Unsubscription error: ', e);
          pushButton.disabled = false;
        });
      }).catch(function(e) {
        console.log('unsubscription catch');
        window.Demo.debug.log('Error thrown while unsubscribing from ' +
          'push messaging.', e);
      });
  });
}

function subscribe() {
  // Disable the button so it can't be changed while
  // we process the permission request
  var pushButton = document.querySelector('.js-push-button');
  pushButton.disabled = true;

  navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {    
    console.log('serviceWorkerRegistration',serviceWorkerRegistration);

    if (serviceWorkerRegistration.installing) {
      serviceWorkerRegistration.installing.postMessage("Hello");
    }
    serviceWorkerRegistration.pushManager.subscribe({userVisibleOnly: true,topic:'/topics/cat26'})
      .then(function(subscription) {

        console.log('subscription successful ',subscription);

        // The subscription was successful
        isPushEnabled = true;
        pushButton.textContent = 'Disable Push Messages';
        pushButton.disabled = false;

        // TODO: Send the subscription subscription.endpoint
        // to your server and save it to send a push message
        // at a later date
        return sendSubscriptionToServer(subscription);
      })
      .catch(function(e) {
        console.log('subscription catch ',e);
        if (Notification.permission === 'denied') {
          // The user denied the notification permission which
          // means we failed to subscribe and the user will need
          // to manually change the notification permission to
          // subscribe to push messages
          window.Demo.debug.log('Permission for Notifications was denied');
          pushButton.disabled = true;
        } else {
          // A problem occurred with the subscription, this can
          // often be down to an issue or lack of the gcm_sender_id
          // and / or gcm_user_visible_only
          window.Demo.debug.log('Unable to subscribe to push.', e);
          pushButton.disabled = false;
          pushButton.textContent = 'Enable Push Messages';
        }
      });
  },function(why){
    console.error("installing the worker failed!:",why);
  });
}

function toPushMessage(message) {
  // This wraps the message posting/response in a promise, which will resolve if the response doesn't
  // contain an error, and reject with the error if it does. If you'd prefer, it's possible to call
  // controller.postMessage() and set up the onmessage handler independently of a promise, but this is
  // a convenient wrapper.
  return new Promise(function(resolve, reject) {
    var messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = function(event) {
      if (event.data.error) {
        reject(event.data.error);
      } else {
        resolve(event.data);
      }
    };

    // This sends the message data as well as transferring messageChannel.port2 to the service worker.
    // The service worker can then use the transferred port to reply via postMessage(), which
    // will in turn trigger the onmessage handler on messageChannel.port1.
    // See https://html.spec.whatwg.org/multipage/workers.html#dom-worker-postmessage
    console.log('message:',message);
    navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
//    navigator.serviceWorker.controller.postMessage({'message':message,'token':tk}, [messageChannel.port2]);
  });
}

// Once the service worker is registered set the initial state
function initialiseState() {
  console.log('start initialiseState');
  // Are Notifications supported in the service worker?
  if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
    window.Demo.debug.log('Notifications aren\'t supported.');
    return;
  }

  // Check the current Notification permission.
  // If its denied, it's a permanent block until the
  // user changes the permission
  if (Notification.permission === 'denied') {
    window.Demo.debug.log('The user has blocked notifications.');
    return;
  }

  // Check if push messaging is supported
  if (!('PushManager' in window)) {
    window.Demo.debug.log('Push messaging isn\'t supported.');
    return;
  }

  // We need the service worker registration to check for a subscription
  navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {
    // Do we already have a push message subscription?
    serviceWorkerRegistration.pushManager.getSubscription()
      .then(function(subscription) {
        // Enable any UI which subscribes / unsubscribes from
        // push messages.
        var pushButton = document.querySelector('.js-push-button');
        pushButton.disabled = false;

        if (!subscription) {
          // We aren’t subscribed to push, so set UI
          // to allow the user to enable push
          console.log('!subscription',subscription);
          return;
        }

        // Keep your server in sync with the latest subscription
        sendSubscriptionToServer(subscription);

        // Set your UI to show they have subscribed for
        // push messages
        pushButton.textContent = 'Disable Push Messages';
        isPushEnabled = true;
      })
      .catch(function(err) {
        window.Demo.debug.log('Error during getSubscription()', err);
      });
  });
}

window.addEventListener('load', function() {
  var i;
  var subscribeButton = document.querySelectorAll('.js-subscribe-topic');
  console.log('subscribeButton',subscribeButton);
  for (i = 0; i < subscribeButton.length; i++) {
  subscribeButton[i].addEventListener('change', function(ev) {
    console.log('toPushButton',this.type,this.checked,this.attributes.value,this.value,this.attributes.checked);
    
//    console.log('ev',ev);
    
//    console.log('ev',ev);
//    ev['test']='1233';
//    this.type.push({'test':1233});
//    this.type['test']='aaaa';
    
//    console.log('ev2',ev);
    
    
    toPushMessage({'event':this.checked?'subscribe_topic':'subscribe_topic','cat':this.value});
  });
}
  
  var pushButton = document.querySelector('.js-push-button');
  pushButton.addEventListener('click', function() {
    if (isPushEnabled) {
      unsubscribe();
    } else {
      subscribe();
    }
  });



var toPushButton = document.querySelectorAll('.js-to-push-button');
//console.log('toPushButton ',toPushButton );

for (i = 0; i < toPushButton.length; i++) {
  toPushButton[i].addEventListener('click', function() {
//    console.log('toPushButton',toPushButton[i],this.attributes.getNamedItem("cat").value);
    toPushMessage({'event':'push','cat':this.attributes.getNamedItem("cat").value});
  });
}

//var resetButton = document.querySelector('.js-reset-button');
//resetButton.addEventListener('click', function() {
//  console.log('toPushButton');
//  toPushMessage('reset');
//});


//sw.register("/service_worker.js", { pushChannel: "twitter" });
//
//swReady().then(function(sw) {
//  push.register(sw, "twitter");
//}
  // Check that service workers are supported, if so, progressively
  // enhance and add push messaging support, otherwise continue without it.
  if ('serviceWorker' in navigator) {
    console.log('start serviceWorker');
//    navigator.serviceWorker.register('./service-worker.js')
    navigator.serviceWorker.register('/service-worker.js',{scope: './'})
    .then(initialiseState);
  } else {
    window.Demo.debug.log('Service workers aren\'t supported in this browser.');
  }
  
  
  navigator.serviceWorker.addEventListener("message", function(event) {
    console.log('navigator listener message',event,event.data);
    new Notification(event.data.title, event.data.options);  
  });

});
