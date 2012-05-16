var T = videoplaza.core.Tracker.trackingEvents;

function VideoplazaAds(vpHost) {
  this.vpHost = vpHost;
  this.requestSettings = {
    width: null,
    height: null,
    bitrate: null,
    insertionPointType: null
  };
  this.adPlaying = false;

  this.ads = new videoplaza.core.AdCallModule(vpHost);
  this.tracker = new videoplaza.core.Tracker();
}

VideoplazaAds.prototype.listen = function(element, event, c) {
  var _this = this;
  var callback = function(e) { c.call(_this, e); };
  if (typeof element.addEventListener === 'function') {
    element.addEventListener(event, callback, false);
  } else {
    element.attachEvent('on' + event, callback);
  }
}

VideoplazaAds.prototype.setContentMeta = function (meta) {
  this.contentMeta = meta;
}

VideoplazaAds.prototype.setVideoProperties = function (width, height, bitrate) {
  this.requestSettings.width = width;
  this.requestSettings.height = height;
  this.requestSettings.bitrate = bitrate;
}

VideoplazaAds.prototype._onAds = function (ads) {
  console.log('got ads', ads);
  this.ads = ads;
  this.adIndex = -1;
  this._showNextAd();
}

VideoplazaAds.prototype._showNextAd = function () {
  this.adIndex++;
  if (this.adIndex >= this.ads.length) {
    console.log('no more ads');
    this._resumeWatchedPlayer();
    return false;
  }

  console.log('showing ad #' + this.adIndex);
  this.ad = this.ads[this.adIndex];

  switch (this.ad.type) {
    case 'standard_spot':
      console.log('found standard spot');
      this._displayAdCreatives(this.ad.creatives);
      break;
    case 'inventory':
      console.log('found inventory');
      this.tracker.track(this.ad, T.ad.impression);
      this._showNextAd();
      break;
    default:
      this._onError('ad format ' + this.ad.type + ' not supported');
      break;
  }
}

VideoplazaAds.prototype.showCompanion = function (companion) {
  console.log('show companion banner', companion.resource);
  this.tracker.track(companion, T.creative.creativeView);
}

VideoplazaAds.prototype._displayAdCreatives = function (creatives) {
  this.videoAd = null;

  console.log('found ' + creatives.length + ' creatives for ad');
  for (var i = 0, l = creatives.length; i < l; i++) {
    if (creatives[i].id === 'video') {
      console.log('found video creative', creatives[i]);
      this.videoAd = creatives[i];
    } else if (creatives[i].type === 'companion') {
      console.log('found companion creative', creatives[i]);
      this.showCompanion(creatives[i]);
    }
  }

  if (!this.videoAd) {
    this._onError('bad ad - no video');
    return;
  }

  this._playVideoAd();
}

VideoplazaAds.prototype._onError = function (message) {
  console.error('Videoplaza error: ' + message);
  this._resumeWatchedPlayer();
}

VideoplazaAds.prototype.runAds = function (insertionPoint) {
  this.requestSettings.insertionPointType = insertionPoint;
  var _this = this;
  var a = function(message) { _this._onAds.call(_this, message); };
  var e = function(message) { _this._onError.call(_this, message); };
  this.ads.requestAds(this.contentMeta, this.requestSettings, a, e);
}

VideoplazaAds.prototype._destroyAdPlayer = function() {
  console.log('told to destroy ad player');
  if (this.adPlayer) {
    console.log('actually destroyed ad player');
    this.adPlayer.parentNode.removeChild(this.adPlayer);
    this.watchedPlayer.style.display = 'block';
    this.adPlayer = null;
  }
}

VideoplazaAds.prototype._onAdPlay = function(event) {
  if (!this.adPlaying) {
    console.log('ad started playing');
    this.tracker.track(this.ad, T.ad.impression);
    this.tracker.track(this.adVideo, T.creative.creativeView);
    this.tracker.track(this.adVideo, T.creative.start);
  } else {
    // resume
    console.log('ad resumed');
    this.tracker.track(this.adVideo, T.creative.resume);
  }

  this.adPlaying = true;
}

VideoplazaAds.prototype._onAdClick = function() {
  console.log('ad click through to ' + this.adVideo.clickThroughUri);
  this.tracker.track(this.adVideo, T.creative.clickThrough);
  window.open(this.adVideo.clickThroughUri, '_blank');
}

VideoplazaAds.prototype._createAdPlayer = function() {
  console.log('told to create ad player');
  if (this.watchedPlayer && !this.adPlayer) {
    console.log('actually created ad player');
    this.adPlayer = document.createElement('video');
    this.adPlayer.setAttribute('width', this.watchedPlayer.clientWidth || this.watchedPlayer.offsetWidth);
    this.adPlayer.setAttribute('height', this.watchedPlayer.clientHeight || this.watchedPlayer.offsetHeight);
    this.adPlayer.setAttribute('controls', false);
    this.listen(this.adPlayer, 'play', this._onAdPlay);
    this.listen(this.adPlayer, 'click', this._onAdClick);
    this.listen(this.adPlayer, 'ended', this._showNextAd);
    this.adPlayer.style.display = 'none';
    this.watchedPlayer.parentNode.insertBefore(this.adPlayer, this.watchedPlayer);

    this.watchedPlayer.style.display = 'none';
    this.adPlayer.style.display = 'block';

    this.adPlaying = false;

    return true;
  }

  return false;
}

VideoplazaAds.prototype._playVideoAd = function () {
  console.log('playing ad', this.videoAd);
  this._createAdPlayer();
  this.adPlayer.setAttribute('src', this.videoAd.mediaFiles[0].uri);
  this.adPlayer.load();
}

VideoplazaAds.prototype._resumeWatchedPlayer = function() {
  console.log('resuming watched player');
  this._destroyAdPlayer();
  if (this.watchedPlayer && this.watchedPlayer.paused && !this.watchedPlayer.ended) {
    this.watchedPlayer.play();
  }
}

VideoplazaAds.prototype.watchPlayer = function(videoElement) {
  console.log('told to watch player', videoElement);
  this._destroyAdPlayer();

  if (videoElement.tagName.toLowerCase() !== 'video') {
    console.error('not watching player - not a video element');
    return false;
  }

  this.watchedPlayer = videoElement;

  this.listen(videoElement, 'play', function() {
    if (!this.shownPreroll) {
      videoElement.pause();
      this.runAds('onBeforeContent');
      this.shownPreroll = true;
    }
  });

  this.listen(videoElement, 'ended', function() {
    if (!this.shownPostroll) {
      this.showAds('onContentEnd');
      this.shownPostroll = true;
    }
  });

  return true;
}
