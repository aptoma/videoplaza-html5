var VPT = videoplaza.core.Tracker.trackingEvents;

/**
 * Create a new VideoplazaAds integration
 *
 * @param {string} vpHost Videoplaza Host URL
 * @constructor
 */
function VideoplazaAds(vpHost) {
  this.vpHost = vpHost;
  this.requestSettings = {
    width: null,
    height: null,
    bitrate: null,
    insertionPointType: null
  };
  this.adPlaying = false;

  this.adCall = new videoplaza.core.AdCallModule(vpHost);
  this.tracker = new videoplaza.core.Tracker();
}

/**
 * Set or clear the function to call to display a companion banner
 *
 * The function will be passed an object with information about the banner.
 * The most important attribute of this object is companion.resource, which
 * contains the URI for the companion banner.
 *
 * This function MUST return true if the companion banner was successfully shown.
 *
 * If the argument to this function is not a function, the existing handler will be cleared
 *
 * @param {?function(object): boolean} companionHandler
 *   Function to call when companion banners are to be displayed.
 */
VideoplazaAds.prototype.setCompanionHandler = function (callback) {
  this.companionHandler = callback;
}

/**
 * Binds the given callback to the given event on the given element
 * The callback will have the same this context as the call to listen
 *
 * @param {Node} element The element to add a listener to
 * @param {string} event Event to add a listener for
 * @param {function} callback Event callback
 */
VideoplazaAds.prototype._listen = function(element, event, callback) {
  var _this = this;
  var c = function(e) { callback.call(_this, e); };
  if (typeof element.addEventListener === 'function') {
    element.addEventListener(event, c, false);
  } else {
    element.attachEvent('on' + event, c);
  }
}

/**
 * Set meta data to send to Videoplaza when requesting ads
 *
 * @param {object} meta Meta data about the video being displayed
 * @param {string} meta.category Videoplaza Karbon content category for targeting
 * @param {string} meta.contentForm shortForm || longForm
 * @param {string} meta.contentId ID for the current video clip
 * @param {string} meta.contentPartner Videoplaza Karbon content partner for targeting
 * @param {Number} meta.duration Duration of the video clip in the player
 * @param {string[]} meta.tags Flags to override ad insertion policies
 * @param {string[]} meta.flags Content keywords for targeting
 */
VideoplazaAds.prototype.setContentMeta = function (meta) {
  this.contentMeta = meta;
}

/**
 * Give information about the environment for the ad
 *
 * @param {Number} width Width of the video frame
 * @param {Number} height Height of the video frame
 * @param {Number} [bitrate] The maximum bitrate of the ad
 */
VideoplazaAds.prototype.setVideoProperties = function (width, height, bitrate) {
  this.requestSettings.width = width;
  this.requestSettings.height = height;
  this.requestSettings.bitrate = bitrate;
}

/**
 * Called when ads are received from Videoplaza
 *
 * @param {object[]} ads The ads received
 */
VideoplazaAds.prototype._onAds = function (ads) {
  console.log('got ads', ads);
  this.ads = ads;
  this.adIndex = -1;
  this._showNextAd();
}

/**
 * Show the next ad in the last received list of ads
 *
 * @return {boolean} Whether another ad was played or not
 */
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
      return true;
    case 'inventory':
      console.log('found inventory');
      this.tracker.track(this.ad, VPT.ad.impression);
      return this._showNextAd();
    default:
      this._onError('ad format ' + this.ad.type + ' not supported');
      return false;
  }
}

/**
 * Show the given companion banner
 *
 * @param {object} companion The companion banner to display
 * @param {string} companion.id Companion banner ID
 * @param {string} companion.resource Companion resource to display
 * @param {string} companion.resourceType Companion type
 * @param {object} companion.trackingUrls
 * @param {string} companion.type Always === 'companion'
 */
VideoplazaAds.prototype._showCompanion = function (companion) {
  console.log('show companion banner', companion.resource);
  if (typeof this.companionHandler === 'function' && this.companpanionHandler(companion)) {
    this.tracker.track(companion, VPT.creative.creativeView);
  }
}

/**
 * Display all the given creatives
 *
 * Will play the last video in the list, and call showCompanion on every
 * creative with .type === 'companion'
 *
 * @param {object[]} creatives List of creatives to display
 */
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
    console.error("Videoplaza error: bad ad - no video", this.ad);
    this._showNextAd();
    return;
  }

  this._playVideoAd();
}

/**
 * Should be called if Videoplaza encounters an error
 *
 * Will log an error message and resume normal video playback
 *
 * @param {string} message A message describing the error
 */
VideoplazaAds.prototype._onError = function (message) {
  console.error('Videoplaza error: ' + message);
  this._resumeWatchedPlayer();
}

/**
 * Fetches and displays ads
 *
 * @param {string} insertionPoint The type of ad to fetch
 *  May be one of: onBeforeContent, playbackPosition, onContentEnd, playbackTime, onSeek
 */
VideoplazaAds.prototype._runAds = function (insertionPoint) {
  this.requestSettings.insertionPointType = insertionPoint;
  var _this = this;
  var a = function(message) { _this._onAds.call(_this, message); };
  var e = function(message) { _this._onError.call(_this, message); };
  this.adCall.requestAds(this.contentMeta, this.requestSettings, a, e);
}

/**
 * Destroy the ad player if it exists
 */
VideoplazaAds.prototype._destroyAdPlayer = function() {
  console.log('told to destroy ad player');
  if (this.adPlayer) {
    console.log('actually destroyed ad player');
    this.adPlayer.parentNode.removeChild(this.adPlayer);
    this.watchedPlayer.style.display = 'block';
    this.adPlayer = null;
  }
}

/**
 * Callback for tracking when an ad starts playing or resumes
 */
VideoplazaAds.prototype._onAdPlay = function() {
  if (!this.adPlaying) {
    console.log('ad started playing');
    this.tracker.track(this.ad, VPT.ad.impression);
    this.tracker.track(this.adVideo, VPT.creative.creativeView);
    this.tracker.track(this.adVideo, VPT.creative.start);
  } else {
    // resume
    console.log('ad resumed');
    this.tracker.track(this.adVideo, VPT.creative.resume);
  }

  this.adPlaying = true;
}

/**
 * Ad click handler
 */
VideoplazaAds.prototype._onAdClick = function() {
  console.log('ad click through to ' + this.adVideo.clickThroughUri);
  this.tracker.track(this.adVideo, VPT.creative.clickThrough);
  window.open(this.adVideo.clickThroughUri, '_blank');
}

/**
 * Create the ad player element (unless it already exists)
 *
 * @return {boolean} Whether a player was created
 */
VideoplazaAds.prototype._createAdPlayer = function() {
  console.log('told to create ad player');
  if (this.watchedPlayer && !this.adPlayer) {
    console.log('actually created ad player');
    this.adPlayer = document.createElement('video');
    this.adPlayer.setAttribute('width', this.watchedPlayer.clientWidth || this.watchedPlayer.offsetWidth);
    this.adPlayer.setAttribute('height', this.watchedPlayer.clientHeight || this.watchedPlayer.offsetHeight);
    this.adPlayer.setAttribute('controls', false);
    this._listen(this.adPlayer, 'play', this._onAdPlay);
    this._listen(this.adPlayer, 'click', this._onAdClick);
    this._listen(this.adPlayer, 'ended', this._showNextAd);
    this.adPlayer.style.display = 'none';
    this.watchedPlayer.parentNode.insertBefore(this.adPlayer, this.watchedPlayer);

    this.watchedPlayer.style.display = 'none';
    this.adPlayer.style.display = 'block';

    this.adPlaying = false;

    return true;
  }

  return false;
}

/**
 * Play the current video ad
 */
VideoplazaAds.prototype._playVideoAd = function () {
  console.log('playing ad', this.videoAd);
  this._createAdPlayer();
  this.adPlayer.setAttribute('src', this.videoAd.mediaFiles[0].uri);
  this.adPlayer.load();
}

/**
 * Resumes normal video playback and destroys the ad player
 */
VideoplazaAds.prototype._resumeWatchedPlayer = function() {
  console.log('resuming watched player');
  this._destroyAdPlayer();
  if (this.watchedPlayer && this.watchedPlayer.paused && !this.watchedPlayer.ended) {
    this.watchedPlayer.play();
  }
}

/**
 * Watch the given player, and inject ads when appropriate
 *
 * Will add two event listeners, one for play and one for ended.
 * This will trigger prerolls and postrolls respectively
 *
 * When an ad is played, the video element will be paused and hidden,
 * and an ad player with the dimension given to setVideoProperties will
 * be added before it in the DOM. When the ad(s) finish, the ad player
 * will be removed, and the video element will be made visible and
 * .play() will be called.
 *
 * @param {Node} videoElement The video element to watch
 * @return {boolean} False if videoElement is not a video element, true otherwise
 */
VideoplazaAds.prototype.watchPlayer = function(videoElement) {
  console.log('told to watch player', videoElement);
  this._destroyAdPlayer();

  if (videoElement.tagName.toLowerCase() !== 'video') {
    console.error('not watching player - not a video element');
    return false;
  }

  this.watchedPlayer = videoElement;

  this._listen(videoElement, 'play', function() {
    if (!this.shownPreroll) {
      videoElement.pause();
      this._runAds('onBeforeContent');
      this.shownPreroll = true;
    }
  });

  this._listen(videoElement, 'ended', function() {
    if (!this.shownPostroll) {
      this._runAds('onContentEnd');
      this.shownPostroll = true;
    }
  });

  return true;
}
