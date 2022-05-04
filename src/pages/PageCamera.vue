<template>
  <q-page class="container-more q-pa-md">
    <div class="camera-frame q-pa-md">
      <video
        v-show="!imageCaptured"
        ref="video"
        class="full-width"
        autoplay
        playsinline
      />

      <canvas
        v-show="imageCaptured"
        ref="canvas"
        class="full-width"
        height="240"
      />
    </div>
    <div class="text-center q-pa-md">
      <q-btn
        v-if="hasCameraSupport"
        @click="captureImage"
        :disable="imageCaptured"
        round
        color="grey-10"
        size="lg"
        icon="eva-camera"
      />

      <q-file
        v-else
        v-model="imageUpload"
        @input="captureImageFallback"
        class="col col-sm-6"
        accept="image/*"
        label="Bir Fotoğraf Seç"
        outlined
      >
        <template v-slot:prepend>
          <q-icon name="eva-image-outline" />
        </template>
      </q-file>

      <div class="row justify-center q-ma-md">
        <q-input
          class="col col-sm-6"
          v-model="post.caption"
          label="Caption"
          dense
        />
      </div>
      <div class="row justify-center q-ma-md">
        <q-input
          class="col col-sm-6"
          v-model="post.location"
          :loading="locationLoading"
          label="Location"
          dense
        >
          <template v-slot:append>
            <q-btn
              v-if="!locationLoading"
              @click="getLocation"
              round
              dense
              flat
              icon="eva-navigation-2-outline"
            />
          </template>
        </q-input>
      </div>
      <div class="row justify-center q-mt-lg">
        <q-btn
          @click="addPost"
          :disable="!imageCaptured"
          unelevated
          rounded
          color="primary"
          label="Post Image"
        />
      </div>
    </div>
  </q-page>
</template>

<script>
import { uid } from "quasar";
require("md-gum-polyfill");

export default {
  name: "PageCamera",
  data() {
    return {
      post: {
        id: uid(),
        caption: "",
        location: "",
        photo: null,
        date: Date.now(),
      },
      imageCaptured: false,
      imageUpload: [],
      hasCameraSupport: true,
      locationLoading: false
    };
  },

  methods: {
    initCamera() {
      navigator.mediaDevices
        .getUserMedia({
          video: true,
        })
        .then((stream) => {
          this.$refs.video.srcObject = stream;
        })
        .catch((error) => {
          this.hasCameraSupport = false;
        });
    },
    captureImage() {
      let video = this.$refs.video;
      let canvas = this.$refs.canvas;
      canvas.width = video.getBoundingClientRect().width;
      canvas.height = video.getBoundingClientRect().height;
      let context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      this.imageCaptured = true;
      this.post.photo = this.dataURItoBlob(canvas.toDataURL());
      this.disableCamera();
    },
    captureImageFallback(file) {
      this.post.photo = file;

      let canvas = this.$refs.canvas;
      let context = canvas.getContext("2d");
      //TODO HATALI

      var reader = new FileReader();
      reader.onload = (event) => {
        var img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          context.drawImage(img, 0, 0);
          this.imageCaptured = true;
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    },

    disableCamera() {
      this.$refs.video.srcObject.getVideoTracks().forEach((track) => {
        track.stop();
      });
    },

    dataURItoBlob(dataURI) {
      // base64'ü bir dizgede tutulan ham ikili verilere dönüştür
      // URLEncoding DataURI'leri işlemez
      var byteString = atob(dataURI.split(",")[1]);

      // mime bileşenini ayırın
      var mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];

      // dizenin baytlarını bir ArrayBuffer'a yazın
      var ab = new ArrayBuffer(byteString.length);

      // arabelleğe bir görünüm oluştur
      var ia = new Uint8Array(ab);

      // arabelleğin baytlarını doğru değerlere ayarlayın
      for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }

      // ArrayBuffer'ı bir bloba yazın ve işlem tamam
      var blob = new Blob([ab], { type: mimeString });
      return blob;
    },
    getLocation() {
      this.locationLoading = true
      navigator.geolocation.getCurrentPosition((position) => {
          this.getCityAndCountry(position)
        },
        (err) => {
          this.locationError()
        }, { timeout: 7000 })
    },
    getCityAndCountry(position) {
      let apiUrl = `https://geocode.xyz/${ position.coords.latitude },${ position.coords.longitude }?json=1%27`
      this.$axios.get(apiUrl).then(result => {
        this.locationSuccess(result)
      }).catch(err => {
        this.locationError()
      })
  },
    locationSuccess(result) {
      this.post.location = result.data.city
      if (result.data.country) {
        this.post.location += `, ${ result.data.country } `
      }
      this.locationLoading = false
    },
    locationError() {
     this.$q.dialog({
        title: 'Hata',
        message: 'Konumunuz tespit edilemiyor.'
      })
      this.locationLoading = false
    },
    addPost() {
      this.$q.loading.show()

      let formData = new FormData()
      formData.append('id', this.post.id)
      formData.append('caption', this.post.caption)
      formData.append('location', this.post.location)
      formData.append('date', this.post.date)
      formData.append('file', this.post.photo, this.post.id + '.png')

      this.$axios.post(`${ process.env.API }/createPost`, formData).then(response =>{
        console.log('response: ', response)
        this.$router.push('/')
         this.$q.notify({
          message: 'Gönderi Oluşturuldu.',
          actions: [
            { label: 'Kapat', color: 'white' }
          ]
        })
        this.$q.loading.hide()
      }).catch(err => {
        console.log('err: ',err)
        this.$q.notify({
          message: 'Yüklenemedi',
        })
        this.$q.loading.hide()
      })
    }
  },
  mounted() {
    this.initCamera();
  },
  beforeDestroy() {
    if (this.hasCameraSupport) {
      this.disableCamera();
    }
  },
};
</script>

<style lang="sass">
.camera-frame
  border: 1px solid #212121
  border-radius: 10px
</style>
