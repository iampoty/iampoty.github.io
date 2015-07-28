'use strict';

console.log('main.js');
var GCM_SENDER = '776729739926';
var API_KEY = window.GoogleSamples.Config.gcmAPIKey;
var GCM_ENDPOINT = 'https://android.googleapis.com/gcm/send';

var curlCommandDiv = document.querySelector('.js-curl-command');
var isPushEnabled = false;
var isRegister = false;
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

function setLocalS(k,v){
  console.log('setLocalS',k,':',v);
  if (('localStorage' in window) && window.localStorage !== null) {
    localStorage[k] = v;
  } else {
    var date = new Date();
    date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000));
    var expires = date.toGMTString();
    var cookiestr = k+'='+v+';' +' expires=' + expires + '; path=/';
    document.cookie = cookiestr;
  }
}

function getLocalS(k){
  if (('localStorage' in window) && window.localStorage !== null) {
    return localStorage[k];

  } else {    
    return getCookie(k);
  }
}

function remLocalS(k){
  console.log('remLocalS',k);
  if (('localStorage' in window) && window.localStorage !== null) {
    localStorage[k] = null;
    localStorage.removeItem(k);
  } else {
    var date = new Date();
    date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000));
    var expires = date.toGMTString();
    var cookiestr = k+'=;' +' expires=' + expires + '; path=/';
    document.cookie = cookiestr;
  }
}

function getCookie(c_name)
{
var i,x,y,ARRcookies=document.cookie.split(";");
for (i=0;i<ARRcookies.length;i++)
  {
  x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
  y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
  x=x.replace(/^\s+|\s+$/g,"");
  if (x==c_name)
    {
    return unescape(y);
    }
  }
}

function sendSubscriptionToServer(subscription) {
  // TODO: Send the subscription.endpoint
  // to your server and save it to send a
  // push message at a later date
  //
  // For compatibly of Chrome 43, get the endpoint via
  // endpointWorkaround(subscription)
  isRegister = true;
  var regId = getLocalS('register');
  console.log('TODO: Implement sendSubscriptionToServer()',subscription,'/',regId);
  
  if(regId !== subscription.subscriptionId){       
    console.log('New RegId: TODO: remove Old RegId (',subscription.subscriptionId,'/',regId,')');
//    saveRegId(subscription.subscriptionId);
    setLocalS('register',subscription.subscriptionId);
  }
  toPushMessage({'event':'subscription','subscriptionId':subscription.subscriptionId});
//  var mergedEndpoint = endpointWorkaround(subscription);

  //showCurlCommand(mergedEndpoint);

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
  
  isRegister = false;
  remLocalS('register');
  var subscribeButton = document.querySelectorAll('.js-subscribe-topic');
  for (var i = 0; i < subscribeButton.length; i++) {    
    var btn = subscribeButton[i];
    var isRegis = getLocalS(btn.value);
    console.log(i,btn.value,isRegis);
    if(isRegis){
      remLocalS(btn.value);
      btn.checked = false;
    }
  }
  toPushMessage({'event':'unsubscription','subscriptionId':subscription.subscriptionId});
}

function unsubscribe() {
  var pushButton = document.querySelector('.js-push-button');
  pushButton.disabled = true;
  curlCommandDiv.textContent = '';
  
  navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {
    serviceWorkerRegistration.pushManager.getSubscription().then(
      function(pushSubscription) {
        if (!pushSubscription) {
          isPushEnabled = false;
          pushButton.disabled = false;
          pushButton.textContent = 'Enable Push Messages';
          console.log('!pushSubscription');
          return;
        }

        pushSubscription.unsubscribe().then(function(successful) {
          pushButton.disabled = false;
          pushButton.textContent = 'Enable Push Messages';
          isPushEnabled = false;
          console.log('unsubscription successful',successful);          
          sendUnsubscriptionToServer(successful,pushSubscription);                    
        }).catch(function(e) {          
//          window.Demo.debug.log('Unsubscription error: ', e);
          pushButton.disabled = false;
        });
      }).catch(function(e) {
//        window.Demo.debug.log('Error thrown while unsubscribing from ' +'push messaging.', e);
      });
  });
}

function subscribe() {
  var pushButton = document.querySelector('.js-push-button');
  pushButton.disabled = true;

  navigator.serviceWorker.ready.then(function(serviceWorkerRegistration) {    
    serviceWorkerRegistration.pushManager.subscribe({userVisibleOnly: true}).then(function(subscription) {
        isPushEnabled = true;
        pushButton.textContent = 'Disable Push Messages';
        pushButton.disabled = false;
        return sendSubscriptionToServer(subscription);
      })
      .catch(function(e) {
//        console.log('subscription catch ',e);
        if (Notification.permission === 'denied') {
//          window.Demo.debug.log('Permission for Notifications was denied');
          pushButton.disabled = true;
        } else {
//          window.Demo.debug.log('Unable to subscribe to push.', e);
          pushButton.disabled = false;
          pushButton.textContent = 'Enable Push Messages';
        }
      });
  },function(why){
    console.error("installing the worker failed!:",why);
  });
}

function toPushMessage(message) {
  return new Promise(function(resolve, reject) {
    var messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = function(event) {
      if (event.data.error) {
        reject(event.data.error);
      } else {
        resolve(event.data);
      }
    };
//    console.log('message:',message);
    navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
//    navigator.serviceWorker.controller.postMessage({'message':message,'token':tk}, [messageChannel.port2]);
  });
}

function initialiseState() {
  console.log('start initialiseState');
  
  if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
    window.Demo.debug.log('Notifications aren\'t supported.');
    return;
  }

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
//        window.Demo.debug.log('Error during getSubscription()', err);
      });
  });
}

window.addEventListener('load', function() {
  var i;
  var subscribeButton = document.querySelectorAll('.js-subscribe-topic');
//  console.log('subscribeButton',subscribeButton);
  for (i = 0; i < subscribeButton.length; i++) {
    var btn = subscribeButton[i];
//    console.log('btn',btn.value);
    var isRegis = getLocalS(btn.value);
    if(isRegis && isPushEnabled){
      btn.checked = true;
    }else{
      btn.checked = false;
      remLocalS(btn.value);
    }
//    console.log('isRegis ',isRegis);
    
  subscribeButton[i].addEventListener('change', function(ev) {
//    console.log('toPushButton',this.value);
    if (isPushEnabled) {
      var isRegis = this.checked;
      var topicId = this.value;
      if(isRegis){//add
        setLocalS(topicId,1);
      }else{//remove
        remLocalS(topicId);
      }
      toPushMessage({'event':isRegis?'subscribe_topic':'unsubscribe_topic','topicId':topicId});
    }else{
      this.checked = false;
    }
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


var getNotificationButton = document.querySelector('.js-get-notification-button');
  getNotificationButton.addEventListener('click', function() {
    toPushMessage({'event':'getnotification'});
  });

var toPushButton = document.querySelectorAll('.js-to-push-button');
for (i = 0; i < toPushButton.length; i++) {
  toPushButton[i].addEventListener('click', function() {
    console.log('toPushButton',this.attributes.getNamedItem("cat").value);
    toPushMessage({'event':'push','topicId':this.attributes.getNamedItem("cat").value});
  });
}

if ('serviceWorker' in navigator) {
    console.log('start serviceWorker');
//    navigator.serviceWorker.register('http://localhost:8081/gcm/service-worker.js')
    navigator.serviceWorker.register('/service-worker.js')
//    navigator.serviceWorker.register('/js/service-worker.js',{scope: '/js/'})
    .then(initialiseState);
  } else {
    window.Demo.debug.log('Service workers aren\'t supported in this browser.');
  }

});
