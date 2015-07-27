'use strict';

console.log('service-worker.js');

var ev;


self.addEventListener('push', function(event) {
  console.log('push event',event);
//  event.waitUntil(
//    self.registration.pushManager.getSubscription().then(function(subscription) {
//      console.log('push event subscription',subscription);
//      fetch('/gcm/notifications/', {
//        method: 'post',
//        headers: {
//          'Authorization': 'Bearer ' + self.token,
//          'Accept': 'application/json',
//          'Content-Type': 'application/json'
//        },
//        body: JSON.stringify(subscription)
//      })
//      .then(function(response) { return response.json(); })
//      .then(function(data) {
//        self.registration.showNotification(data.title, {
//          body: data.body,
//          icon: '/images/icon-192x192.png',
//          tag: data.tag,
//        });
//      })
//      .catch(function(err) {
//        console.log('err');
//        console.log(err);
//      });
//    })
//  );
});

self.addEventListener('sync', function(event) {
  if (event.registration.tag == 'outbox') {
    event.waitUntil(sendEverythingInTheOutbox());
  }
});

self.addEventListener('message', function(event) {
  console.log('Handling message event:', event);  
  if(event.data.event == 'push'){
    console.log('--- Push Hanler');
    
//    self.registration.pushManager.getSubscription().then(function(subscription) {
//      console.log('on pushx ',subscription);
//      fetch('/gcm/pushx/cat'+event.data.cat, {
//        method: 'get',
//        headers: {
//          'Authorization': 'Bearer ' + self.token,
//          'Accept': 'application/json',
//          'Content-Type': 'application/json'
//        },
////        body: JSON.stringify(subscription)
//      })
//      .then(function(response) { return response.json(); })
//      .then(function(data) {
//        console.log('response pushx',data);
//      })
//      .catch(function(err) {
//        console.log('err');
//        console.log(err);
//      });
//    })
    
  }else if(event.data.event == 'subscribe_topic' || event.data.event == 'unsubscribe_topic'){
    console.log('Topic ',event.data.event,event.data.cat);
//    self.registration.pushManager.getSubscription().then(function(subscription) {
//      console.log('on subscription/unsubscription',subscription,event.data);
////      subscription.event.data.push(even)
//      event.data['subscriptionId']=subscription.subscriptionId;
//      fetch('/gcm/'+(event.data.event=='subscription_topic'?'registertopic':'unregistertopic'), {
//        method: 'post',
//        headers: {
//          'Authorization': 'Bearer ' + self.token,
//          'Accept': 'application/json',
//          'Content-Type': 'application/json'
//        },
//        body: JSON.stringify(event.data)
//      })
//      .then(function(response) { console.log('...subscription/unsubscription return '); return response.json(); })
//      .then(function(data) {
//        console.log('...subscription/unsubscription response ',data);
//      })
//      .catch(function(err) {
//        console.log('err');
//        console.log(err);
//      });
//    });
  }else if(event.data.event == 'subscription' || event.data.event == 'unsubscription'){
    console.log('...subscription',event.data.event);

//    self.registration.pushManager.getSubscription().then(function(subscription) {
//      console.log('on subscription/unsubscription',subscription,event.data);      
//      fetch('/gcm/'+(event.data.event=='subscription'?'register':'unregister'), {
//        method: 'post',
//        headers: {
//          'Authorization': 'Bearer ' + self.token,
//          'Accept': 'application/json',
//          'Content-Type': 'application/json'
//        },
//        body: JSON.stringify(subscription?subscription:event.data)
//      })
//      .then(function(response) { console.log('...subscription/unsubscription return '); return response.json(); })
//      .then(function(data) {
//        console.log('...subscription/unsubscription response ',data);
//      })
//      .catch(function(err) {
//        console.log('err');
//        console.log(err);
//      });
//    })

    
  }
  
  
});

self.addEventListener('install', function(event) {
    console.log('onInstall:',event);
});

self.addEventListener('register',function(event){
  console.log('onRegister:',event);
});

self.addEventListener('activate',function(event){
  console.log('onActivate:',event);
});

self.addEventListener('subscribe',function(event){
  console.log('onSubscribe:',event);
});

self.addEventListener('notification',function(event){
  console.log('onNotification:',event);
});

self.addEventListener('fetch', function(event) {
  console.log("onFetch Listener:",event.request.url);  
//  console.log('Inside the /hello/world handler.');
  if (event.request.url.endsWith('/topic/cat2')) {
    event.respondWith(new Response("is Topic 2"));
  }

if (event.request.url.endsWith('/topic/cat1')) {
    event.respondWith(new Response("is Topic 1"));
  }

if (event.request.url.endsWith('/topic/cat3')) {
    event.respondWith(new Response("is Topic 3"));
  }
  
});

self.addEventListener('notificationclick', function(event) {
  console.log('On notification click: ', event.notification.tag);
  // Android doesn’t close the notification when you click on it
  // See: http://crbug.com/4
  // 63146
  event.notification.close();

return clients.openWindow(event.notification.tag);

});