/*global videoplaza */

/**
 * Create a new VideoplazaAds integration
 *
 * @class
 * @param {string} vpHost Videoplaza Host URL
 * @param debug
 */
function VideoplazaAds(vpHost, debug) {
    this.vpHost = vpHost;
    this.requestSettings = {
        width: null,
        height: null,
        bitrate: null,
        insertionPointType: null,
        playbackPosition: null
    };
    this.adPlaying = false;
    this.adsEnabled = true;
    this.midrolls = [];
    this.lastPlayedMidroll = null;
    this.debug = !!debug;
    this.skipHandler = {
        start: null,
        end: null
    };

    this.adCall = new videoplaza.core.AdCallModule(vpHost);
    this.tracker = new videoplaza.core.Tracker();
    this.trackingEvents = videoplaza.core.Tracker.trackingEvents;
}

VideoplazaAds.prototype.log = function log() {
    if (this.debug && console.log) {
        console.log.apply(console, arguments);
    }
};

VideoplazaAds.prototype.logError = function logError() {
    if (console.error) {
        console.error.apply(console, arguments);
    }
};

/**
 * Set functions to be called when an ad starts, and when ads finish
 *
 * This should be used to handle the displaying of a skip button
 *
 * @param {function(adDuration : int)} onAdStarted Called whenever a new video ad is started
 * @param {function} onAdEnded Called when a series of ads has finished
 */
VideoplazaAds.prototype.setSkipHandler = function setSkipHandler(onAdStarted, onAdEnded) {
    this.skipHandler.start = onAdStarted;
    this.skipHandler.end = onAdEnded;
};

/**
 * Call this method to skip the currently playing ad
 */
VideoplazaAds.prototype.skipCurrentAd = function skipCurrentAd() {
    this._showNextAd();
};

/**
 * Set whether ads are enabled
 *
 * @param {boolean} enabled Whether to enabled ads or not
 */
VideoplazaAds.prototype.setAdsEnabled = function setAdsEnabled(enabled) {
    this.adsEnabled = enabled;
};

/**
 * Set or clear the function to call to display a companion banner
 *
 * The function will be passed the HTML of the companion banner (usually an iframe).
 * It will also receive the companion ad's zone ID, its width and its height.
 * This function MUST return true if the companion banner was successfully shown.
 *
 * If the argument to this function is not a function, the existing handler will be cleared
 *
 * @param {?function(object): boolean} companionHandlerCallback
 *   Function to call when companion banners are to be displayed.
 */
VideoplazaAds.prototype.setCompanionHandler = function setCompanionHandler(companionHandlerCallback) {
    this.companionHandler = companionHandlerCallback;
};

/**
 * Set where midrolls should occur
 *
 * @param {Number[]} midrolls Timecodes (in seconds) for when midrolls should be triggered
 */
VideoplazaAds.prototype.setMidrolls = function setMidrolls(midrolls) {
    if (typeof midrolls === typeof []) {
        midrolls.sort(function (a, b) {
            return a - b;
        });
    }
    this.midrolls = midrolls;
    this.lastPlayedMidroll = null;
};

/**
 * Binds the given callback to the given event on the given element
 * The callback will have the same this context as the call to listen
 *
 * @param {Node} element The element to add a listener to
 * @param {string} event Event to add a listener for
 * @param {function} callback Event callback
 */
VideoplazaAds.prototype._listen = function _listen(element, event, callback) {
    var _this = this;
    var c = function (e) {
        callback.call(_this, e);
    };
    if (typeof element.addEventListener === 'function') {
        element.addEventListener(event, c, false);
    } else {
        element.attachEvent('on' + event, c);
    }
};

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
VideoplazaAds.prototype.setContentMeta = function setContentMeta(meta) {
    this.contentMeta = meta;
};

/**
 * Give information about the environment for the ad
 *
 * @param {Number} width Width of the video frame
 * @param {Number} height Height of the video frame
 * @param {Number} [bitrate] The maximum bitrate (in Kbps) of the ad
 */
VideoplazaAds.prototype.setVideoProperties = function setVideoProperties(width, height, bitrate) {
    this.requestSettings.width = width;
    this.requestSettings.height = height;
    this.requestSettings.bitrate = bitrate;
};

/**
 * Called when ads are received from Videoplaza
 *
 * @param {object[]} ads The ads received
 */
VideoplazaAds.prototype._onAds = function _onAds(ads) {
    this.log('got ads', ads);
    this.ads = ads;
    this.adIndex = -1;
    this._showNextAd();
};

/**
 * Show the next ad in the last received list of ads
 *
 * @return {boolean} Whether another ad was played or not
 */
VideoplazaAds.prototype._showNextAd = function _showNextAd() {
    this.adIndex++;
    if (!this.adsEnabled || this.adIndex >= this.ads.length) {
        this.log('no more ads');

        if (typeof this.skipHandler.end === 'function') {
            this.skipHandler.end.call(this);
        }

        this._resumeWatchedPlayer();
        return false;
    }

    this.log('showing ad #' + this.adIndex);
    this.ad = this.ads[this.adIndex];

    switch (this.ad.type) {
        case 'standard_spot':
            this.log('found standard spot');
            this._displayAdCreatives(this.ad.creatives);
            return true;
        case 'inventory':
            this.log('found inventory');
            this.tracker.track(this.ad, this.trackingEvents.ad.impression);
            return this._showNextAd();
        default:
            this._onError('ad format ' + this.ad.type + ' not supported');
            return false;
    }
};

/**
 * Show the given companion banner
 *
 * @param {object} companion The companion banner to display
 * @param {string} companion.id Companion banner ID
 * @param {string} companion.resource Companion resource to display
 * @param {string} companion.resourceType Companion type
 * @param {object} companion.trackingUrls
 * @param {string} companion.type Always === 'companion'
 * @return {boolean} Whether the companion banner was successfully shown
 */
VideoplazaAds.prototype._showCompanion = function _showCompanion(companion) {
    this.log('show companion banner', companion);
    if (typeof this.companionHandler !== 'function') {
        return false;
    }

    var cb = '<iframe scrolling="no" frameborder="0" ' +
        'width="' + companion.width + '" ' +
        'height="' + companion.height + '" ' +
        'src="' + companion.resource + '"></iframe>';

    if (this.companionHandler(cb, companion.zoneId, companion.width, companion.height)) {
        this.tracker.track(companion, this.trackingEvents.creative.creativeView);
        return true;
    }

    return false;
};

/**
 * Display all the given creatives
 *
 * Will play the last video in the list, and call showCompanion on every
 * creative with .type === 'companion'
 *
 * @param {object[]} creatives List of creatives to display
 */
VideoplazaAds.prototype._displayAdCreatives = function _displayAdCreatives(creatives) {
    this.adVideo = null;

    this.log('found ' + creatives.length + ' creatives for ad');
    for (var i = 0, l = creatives.length; i < l; i++) {
        if (creatives[i].id === 'video') {
            this.log('found video creative', creatives[i]);
            this.adVideo = creatives[i];
        } else if (creatives[i].type === 'companion') {
            this.log('found companion creative', creatives[i]);
            if (!this._showCompanion(creatives[i])) {
                this.logError("Videoplaza error: no way of displaying companion ad");
            }
        }
    }

    if (!this.adVideo) {
        this.logError("Videoplaza error: bad ad - no video", this.ad);
        this._showNextAd();
        return;
    }

    this._playVideoAd();
};

/**
 * Should be called if Videoplaza encounters an error
 *
 * Will log an error message and resume normal video playback
 *
 * @param {string} message A message describing the error
 */
VideoplazaAds.prototype._onError = function _onError(message) {
    this.logError('Videoplaza error: ' + message);
    this._resumeWatchedPlayer();
};

/**
 * Fetches and displays ads
 *
 * @param {string} insertionPoint The type of ad to fetch
 *      May be one of: onBeforeContent, playbackPosition, onContentEnd, playbackTime, onSeek
 * @param {boolean} [includePosition] Whether to send the current video position
 */
VideoplazaAds.prototype._runAds = function _runAds(insertionPoint, includePosition) {
    this.watchedPlayer.pause();
    this.requestSettings.insertionPointType = insertionPoint;

    if (includePosition) {
        this.requestSettings.playbackPosition = this.watchedPlayer.currentTime;
    } else {
        this.requestSettings.playbackPosition = null;
    }

    var _this = this;
    var onSuccess = function onAdRequestSuccess(message) {
        _this._onAds.call(_this, message);
    };
    var onFail = function onAdRequestFail(message) {
        _this._onError.call(_this, message);
    };
    this.adCall.requestAds(this.contentMeta, this.requestSettings, onSuccess, onFail);
};

/**
 * Destroy the ad player if it exists
 */
VideoplazaAds.prototype._destroyAdPlayer = function _destroyAdPlayer() {
    this.log('told to destroy ad player');
    if (this.adPlayer) {
        this.log('actually destroyed ad player');
        this.adPlayer.parentNode.removeChild(this.adPlayer);
        this.watchedPlayer.style.display = 'block';
        this.adPlayer = null;
    }
};

/**
 * Callback for tracking when an ad starts playing or resumes
 */
VideoplazaAds.prototype._onAdPlay = function _onAdPlay() {
    if (!this.adPlaying) {
        this.log('ad started playing');
        this.tracker.track(this.ad, this.trackingEvents.ad.impression);
        this.tracker.track(this.adVideo, this.trackingEvents.creative.creativeView);
        this.tracker.track(this.adVideo, this.trackingEvents.creative.start);
    } else {
        // resume
        this.log('ad resumed');
        this.tracker.track(this.adVideo, this.trackingEvents.creative.resume);
    }

    this.adPlaying = true;
};

/**
 * Ad click handler
 *
 * @param {Event} e Click event
 */
VideoplazaAds.prototype._onAdClick = function _onAdClick(e) {
    // @TODO: This is needed for Android ad playback. May need more TLC
    if (!this.adPlaying) {
        this.log('ad click with no ad playing, fallthrough to start playback.');
        return true;
    }
    this.log('ad click through to ' + this.adVideo.clickThroughUri);
    this.tracker.track(this.adVideo, this.trackingEvents.creative.clickThrough);
    window.open(this.adVideo.clickThroughUri, '_blank');
    e.preventDefault();
    return false;
};

/**
 * Track progress on ad playback
 *
 * @param {Event} e Time update event
 */
VideoplazaAds.prototype._onAdTick = function _onAdTick(e) {
    if (!(this.adPlayer && this.adVideo)) {
        this.log('Ad player or ad video not ready');
        return false;
    }
    var percent = this.adPlayer.currentTime / this.adVideo.duration;
    if (this.unsentQuartiles.length && percent > this.unsentQuartiles[0]) {
        var q = this.unsentQuartiles.shift();
        switch (q) {
            case 0.25:
                this.log('logged first quartile');
                this.tracker.track(this.adVideo, this.trackingEvents.creative.firstQuartile);
                break;
            case 0.5:
                this.log('logged midpoint');
                this.tracker.track(this.adVideo, this.trackingEvents.creative.midpoint);
                break;
            case 0.75:
                this.log('logged third quartile');
                this.tracker.track(this.adVideo, this.trackingEvents.creative.thirdQuartile);
                break;
        }
    }

    return true;
};

/**
 * Create the ad player element (unless it already exists)
 *
 * @return {boolean} Whether a player was created
 */
VideoplazaAds.prototype._createAdPlayer = function _createAdPlayer() {
    this.log('told to create ad player');
    if (this.watchedPlayer && !this.adPlayer) {
        this.log('actually created ad player');
        this.adPlayer = document.createElement('video');
        this.adPlayer.setAttribute('width', this.watchedPlayer.clientWidth || this.watchedPlayer.offsetWidth);
        this.adPlayer.setAttribute('height', this.watchedPlayer.clientHeight || this.watchedPlayer.offsetHeight);
        if (navigator.userAgent.match(/iPad|iPod|iPhone|Android/)) {
            this.adPlayer.setAttribute('controls');
        }
        this.adPlayer.setAttribute('preload', 'auto');
        this._listen(this.adPlayer, 'play', this._onAdPlay);
        this._listen(this.adPlayer, 'click', this._onAdClick);
        this._listen(this.adPlayer, 'canplay', this._onAdCanPlay);
        this._listen(this.adPlayer, 'timeupdate', this._onAdTick);
        this._listen(this.adPlayer, 'ended', this._showNextAd);
        this.adPlayer.style.display = 'none';
        this.watchedPlayer.parentNode.insertBefore(this.adPlayer, this.watchedPlayer);

        this.watchedPlayer.style.display = 'none';
        this.adPlayer.style.display = 'block';

        this.adPlaying = false;

        return true;
    }

    return false;
};

/**
 * Play the current video ad
 */
VideoplazaAds.prototype._playVideoAd = function _playVideoAd() {
    this.log('playing ad', this.adVideo);
    this.unsentQuartiles = [0.25, 0.5, 0.75];
    this._createAdPlayer();

    if (typeof this.skipHandler.start === 'function') {
        this.skipHandler.start.call(this, this.adVideo.duration);
    }

    this.adPlayer.setAttribute('src', this.adVideo.mediaFiles[0].uri);
    this.adPlayer.load();
};

/**
 * Called when the ad has loaded and can be played
 */
VideoplazaAds.prototype._onAdCanPlay = function _onAdCanPlay() {
    this.adPlayer.play();
};

/**
 * Resumes normal video playback and destroys the ad player
 */
VideoplazaAds.prototype._resumeWatchedPlayer = function _resumeWatchedPlayer() {
    this.log('resuming watched player');
    this._destroyAdPlayer();
    if (this.watchedPlayer && this.watchedPlayer.paused && !this.watchedPlayer.ended) {
        this.watchedPlayer.play();
    }

    if (this.watchedPlayer.ended) {
        this._triggerVideoEvent('ended');
    }
};

/**
 * Trigger an event with the given type on the currently watched player
 *
 * @see http://stackoverflow.com/questions/2490825/how-to-trigger-event-in-javascript
 * @param {string} eType Event type to trigger
 */
VideoplazaAds.prototype._triggerVideoEvent = function _triggerVideoEvent(eType) {
    if (!this.watchedPlayer) {
        return;
    }

    var event;
    if (document.createEvent) {
        event = document.createEvent("HTMLEvents");
        event.initEvent(eType, true, true);
    } else {
        event = document.createEventObject();
        event.eventType = eType;
    }

    if (document.createEvent) {
        this.watchedPlayer.dispatchEvent(event);
    } else {
        this.watchedPlayer.fireEvent("on" + event.eventType, event);
    }
};

/**
 * Shows a preroll if a preroll should be played
 *
 * @param {Event} e event that triggered this callback
 */
VideoplazaAds.prototype._checkForPreroll = function _checkForPreroll(e) {
    if (!this.hasShownPreroll) {
        this._runAds('onBeforeContent');
        this.hasShownPreroll = true;
        e.ignore = true;
    }
};

/**
 * Shows a midroll if a midroll should be played
 *
 * This is determined by looking through the list of midrolls (which is sorted),
 * and finding the latest timestamp which has been passed.
 * If the last midroll shown was not the one we last passed, then we
 * show that one.
 */
VideoplazaAds.prototype._checkForMidroll = function _checkForMidroll() {
    if (this.midrolls.length === 0) {
        return false;
    }
    var potentialMidroll = null;
    for (var i = 0, l = this.midrolls.length; i < l; i++) {
        if (this.midrolls[i] > this.watchedPlayer.currentTime) {
            break;
        }
        potentialMidroll = i;
    }
    if (potentialMidroll !== null && potentialMidroll !== this.lastPlayedMidroll) {
        this.log('playing overdue midroll ' + potentialMidroll);
        this.lastPlayedMidroll = potentialMidroll;
        this._runAds('playbackPosition', true);

        return true;
    }

    return false;
};

/**
 * Shows a postroll if a postroll should be played
 *
 * @param {Event} e event that triggered this callback
 */
VideoplazaAds.prototype._checkForPostroll = function _checkForPostroll(e) {
    if (!this.hasShownPostroll) {
        this._runAds('onContentEnd');
        this.hasShownPostroll = true;
        e.ignore = true;
    }
};

/**
 * Check if we need to show controls
 *
 * Most mobile devices has disabled autoplay, and need to have controls to
 * allow playback. Actual implementation of this method can be improved.
 *
 * @return {Boolean}
 */
VideoplazaAds.prototype._needControls = function _needContols() {
    return navigator.userAgent.match(/iPad|iPod|iPhone|Android/);
};
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
VideoplazaAds.prototype.watchPlayer = function watchPlayer(videoElement) {
    this.log('told to watch player', videoElement);
    this._destroyAdPlayer();

    if (videoElement.tagName.toLowerCase() !== 'video') {
        this.logError('not watching player - not a video element');
        return false;
    }

    this.watchedPlayer = videoElement;
    this.hasShownPreroll = false;
    this.hasShownPostroll = false;

    if (!this.watchedPlayer.paused) {
        this._runAds('onBeforeContent');
        this.hasShownPreroll = true;
    }

    this._listen(videoElement, 'play', this._checkForPreroll);
    this._listen(videoElement, 'timeupdate', this._checkForMidroll);
    this._listen(videoElement, 'ended', this._checkForPostroll);

    return true;
};
