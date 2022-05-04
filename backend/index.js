/*
Dependencies
*/

const express = require('express')
const admin = require('firebase-admin')
let inspect = require('util').inspect
let Busboy = require('busboy')

let path = require('path')      //yol paketi, yollarla çalışmamızı sağlar
let os = require('os')        //temp klasörüne erişim sağlar
let fs = require('fs')         //izin
let UUID = require('uuid-v4') //benzersiz kimlik (media download)

/*
Config-Express
*/

const app = express()

/*
config firebase
*/

const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'quasagram-ce2ea.appspot.com'
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

/*
endpoint -posts
*/


app.get('/posts', (request, response) => {
  response.set('Access-Control-Allow-Origin', '*')

  let posts = []
  db.collection('posts').orderBy('date', 'desc').limit(3).get().then(snapshot => {
    snapshot.forEach((doc) => {
      posts.push(doc.data())
    });
    response.send(posts)
  })
})

/*
endpoint -createPosts
*/

app.post('/createPost', (request, response) => {
  response.set('Access-Control-Allow-Origin', '*')

  let uuid = UUID()

  let fields = {}
  let fileData = {}

  var busboy = new Busboy({headers: request.headers}); //YENİ BUSBOY NESNESİ OLUŞTUR

  busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
    console.log('File [' + fieldname + ']: filename: ' + filename + ', encoding: ' + encoding + ', mimetype: ' + mimetype);
    // /tmp/456754-456546.png
    let filepath = path.join(os.tmpdir(), filename) //dosya yolunu değişkene dönüştür
    file.pipe(fs.createWriteStream(filepath))
    fileData = {filepath, mimetype}

  });   //HER BİR DOSYA İÇİN TETİKLEYİCİ


  busboy.on('field', function (fieldname, val, fieldnameTruncated, valTruncated, encoding, mimetype) {
    fields[fieldname] = val
  });


  busboy.on('finish', function () {
    bucket.upload(
      fileData.filepath,
      {
        uploadType: 'media',
        metadata: {
          metadata: {
            contentType: fileData.mimetype,
            firebaseStorageDownloadTokens: uuid
          }
        }
      },
      (err, uploadedFile) => {
        if (!err) {
          createDocument(uploadedFile)
        }
      }
    )

    function createDocument(uploadedFile) {
      db.collection('posts').doc(fields.id).set({
        id: fields.id,
        caption: fields.caption,
        location: fields.location,
        date: parseInt(fields.date),
        imageUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${uploadedFile.name}?alt=media&token=${uuid}`
      }).then(() => {
        response.send('Post gönderildi: ' + fields.id);
      })
    }
  });
  request.pipe(busboy);
})


/*
listen
*/

app.listen(process.env.PORT || 3000)
