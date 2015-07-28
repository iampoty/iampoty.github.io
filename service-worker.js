'use strict';
var ev;
var GCM_SENDER = '776729739926';
//var apiDomain = 'http://localhost:8081';
var apiDomain = 'http://signup-demo.kapook.com';
self.addEventListener('push', function(event) {
  console.log('push event',event);
  event.waitUntil(
    self.registration.pushManager.getSubscription().then(function(subscription) {
      fetch(apiDomain+'/gcm/notifications', {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + self.token,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscription)
      })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        self.registration.showNotification(data.message.title, {
          body: '',
          icon: '/images/icon-192x192.png',
          tag: data.message.link
        });
      })
      .catch(function(err) {
        console.log('err:',err);
      });
    })
  );

});

self.addEventListener('sync', function(event) {
  console.log('onSync:', event);  
  if (event.registration.tag == 'outbox') {
    event.waitUntil(sendEverythingInTheOutbox());
  }
});

self.addEventListener('message', function(event) {
  console.log('onMessage:', event);  
  if(event.data.event == 'push'){
    console.log('onMessage: Event Push');
    self.registration.pushManager.getSubscription().then(function(subscription) {
      fetch(apiDomain+'/gcm/pushx?topic='+event.data.topicId, {
        method: 'get',
        headers: {
          'Authorization': 'Bearer ' + self.token,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
//        body: JSON.stringify(subscription)
      })
      .then(function(response) { return response.json(); })
      .then(function(data) {
//        console.log('response pushx',data);
      })
      .catch(function(err) {
//        console.log('err',err);
      });
    })
    
  }else if(event.data.event == 'getnotification'){    
    console.log('onMessage: Event Getnotification');

    self.registration.pushManager.getSubscription().then(function(subscription) {
      console.log('getnotification:',subscription);
      fetch(apiDomain+'/gcm/notifications', {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + self.token,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscription)
      })
      .then(function(response) { return response.json(); })
      .then(function(data) {
        console.log('getnotification data:',data);        
//        self.registration.showNotification(data.message.title, {
//          body: data.message.title,
//          icon: '/images/icon-192x192.png',
//          tag: data.message.link,
//        });        
      })
      .catch(function(err) {
        console.log('getnotification err:',err);
      });
    })
  
    
  }else if(event.data.event == 'subscribe_topic' || event.data.event == 'unsubscribe_topic'){
//    console.log('Topic ',event.data.event,event.data.cat);
    self.registration.pushManager.getSubscription().then(function(subscription) {
      console.log('on subscription/unsubscription',subscription,event.data);
      event.data['senderId']=GCM_SENDER;
      event.data['subscriptionId']=subscription.subscriptionId;
      event.data['deviceId']='chrome';
      fetch(apiDomain+'/gcm/'+(event.data.event=='subscribe_topic'?'registertopic':'unregistertopic'), {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + self.token,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event.data)
      })
      .then(function(response) { console.log('...subscription/unsubscription return json:'); return response.json(); })
      .then(function(data) {
        console.log('...subscription/unsubscription response data: ',data);
      })
      .catch(function(err) {
//        console.log('err',err);
      });
    })
  }else if(event.data.event == 'subscription' || event.data.event == 'unsubscription'){
    console.log('onMessage: Event '+event.data.event);
//  event.waitUntil(
    self.registration.pushManager.getSubscription().then(function(subscription) {
//      console.log('on subscription/unsubscription',subscription,event.data);      
      event.data['senderId']=GCM_SENDER;
      event.data['subscriptionId']=subscription.subscriptionId;
      event.data['deviceId']='chrome';
//      subscription['senderId']=GCM_SENDER;
      
      console.log('event:',event);
      console.log('subscription:',subscription);
      
      fetch(apiDomain+'/gcm/'+(event.data.event=='subscription'?'register':'unregister'), {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + self.token,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event.data)
      })
      .then(function(response) { console.log('...subscription/unsubscription return '); return response.json(); })
      .then(function(data) {
        console.log('...subscription/unsubscription response ',data);
      })
      .catch(function(err) {
//        console.log('err',err);
      });
    })
//  );
    
  }
  
  
});

self.addEventListener('install', function(event) {
//    console.log('onInstall:',event);
});

self.addEventListener('register',function(event){
//  console.log('onRegister:',event);
});

self.addEventListener('activate',function(event){
//  console.log('onActivate:',event);
});

self.addEventListener('subscribe',function(event){
//  console.log('onSubscribe:',event);
});

self.addEventListener('notification',function(event){
//  console.log('onNotification:',event);
});

self.addEventListener('fetch', function(event) {
//  ev=event
  console.log("onFetch Listener:",event.request.url);  
//  console.log('Inside the /hello/world handler.');
//  if (event.request.url.endsWith('/topic/cat2')) {
//    event.respondWith(new Response("is Topic 2"));
//  }
//
//if (event.request.url.endsWith('/topic/cat1')) {
//    event.respondWith(new Response("is Topic 1"));
//  }
//
//if (event.request.url.endsWith('/topic/cat3')) {
//    event.respondWith(new Response("is Topic 3"));
//  }
  
});

self.addEventListener('notificationclick', function(event) {
  console.log('On notification click: ', event.notification.tag);
  // Android doesn’t close the notification when you click on it
  // See: http://crbug.com/4
  // 63146
  event.notification.close();

return clients.openWindow(event.notification.tag);
//return function(){
//  clients.openWindow(event.notification.tag);
//  clients.focus();
//}

  // This looks to see if the current is already open and
  // focuses if it is
//  event.waitUntil(clients.matchAll({
//    type: "window"
//  }).then(function(clientList) {
//    for (var i = 0; i < clientList.length; i++) {
//      var client = clientList[i];
//      if (client.url == '/' && 'focus' in client)
//        return client.focus();
//    }
//    if (clients.openWindow)
//      return clients.openWindow('/');
//  }));

});