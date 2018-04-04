var zipFolder = require('zip-folder');
var path = require('path');
var fs = require('fs');
var request = require('request');

var rootFolder = path.resolve('.');
var zipPath = path.resolve(rootFolder, '../cvcafeterialuis.zip');
var kuduApi = 'https://cvcafeterialuis.scm.azurewebsites.net/api/zip/site/wwwroot';
var userName = '$cvcafeterialuis';
var password = '5BSaRuMvAslTL0uLcnN8vp3W3eoRmY3pBfpfKFXyc4BfX27Cud0axonDvMfa';

function uploadZip(callback) {
  fs.createReadStream(zipPath).pipe(request.put(kuduApi, {
    auth: {
      username: userName,
      password: password,
      sendImmediately: true
    },
    headers: {
      "Content-Type": "applicaton/zip"
    }
  }))
  .on('response', function(resp){
    if (resp.statusCode >= 200 && resp.statusCode < 300) {
      fs.unlink(zipPath);
      callback(null);
    } else if (resp.statusCode >= 400) {
      callback(resp);
    }
  })
  .on('error', function(err) {
    callback(err)
  });
}

function publish(callback) {
  zipFolder(rootFolder, zipPath, function(err) {
    if (!err) {
      uploadZip(callback);
    } else {
      callback(err);
    }
  })
}

publish(function(err) {
  if (!err) {
    console.log('cvcafeterialuis publish');
  } else {
    console.error('failed to publish cvcafeterialuis', err);
  }
});