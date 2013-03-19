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
    this._playerState = {
        originalSrc: null,
        timeToResume: 0,
        ended: false
    };
    this.takeoverCallbacks = {
        onTakeover: null,
        onRelease: null
    };
    this._clickEvent = navigator.userAgent.match(/iPad/i) ? 'touchstart' : 'click';

    this._bindContextForCallbacks();
    this.adCall = new videoplaza.core.AdCallModule(vpHost);
    this.tracker = new videoplaza.core.Tracker();
    this.trackingEvents = videoplaza.core.Tracker.trackingEvents;
}

VideoplazaAds.prototype.log = function log() {
    if (this.debug && console.log && console.log.apply) {
        console.log.apply(console, arguments);
    }
};

VideoplazaAds.prototype.logError = function logError() {
    if (console.error && console.error.apply) {
        console.error.apply(console, arguments);
    } else {
        this.log.apply(arguments);
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
 * Set functions to be called when this plugin takes over and releases the player
 *
 * @param onRelease
 * @param onTakeover
 */
VideoplazaAds.prototype.setTakeoverCallbacks = function setTakeoverCallbacks(onTakeover, onRelease) {
    this.takeoverCallbacks.onTakeover = onTakeover;
    this.takeoverCallbacks.onRelease = onRelease;
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
 * Make sure all functions that are used as callbacks have the right context bound.
 *
 * This has to be done outside of the _listen-method in order to allow unbinding
 * of events.
 */
VideoplazaAds.prototype._bindContextForCallbacks = function _bindContextForCallbacks() {
    this._onAdPlay = this._onAdPlay.bind(this);
    this._onAdCanPlay = this._onAdCanPlay.bind(this);
    this._onAdClick = this._onAdClick.bind(this);
    this._onAdClickToResume = this._onAdClickToResume.bind(this);
    this._onAdTick = this._onAdTick.bind(this);
    this._showNextAd = this._showNextAd.bind(this);
    this._onAdError = this._onAdError.bind(this);
    this._checkForPreroll = this._checkForPreroll.bind(this);
    this._checkForMidroll = this._checkForMidroll.bind(this);
    this._checkForPostroll = this._checkForPostroll.bind(this);
    this._onVideoCanPlay = this._onVideoCanPlay.bind(this);
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
    element.addEventListener(event, callback, false);
};

/**
 * Removes the given callback from the given event on the given element
 *
 * @param {Node} element The element to remove a listener from
 * @param {string} event Event to remove a listener for
 * @param {function} callback Event callback to remove
 */
VideoplazaAds.prototype._unlisten = function _unlisten(element, event, callback) {
    element.removeEventListener(event, callback, false);
};

VideoplazaAds.prototype._takeover = function _takeover() {
    this.log('take over player');
    this.player.controls = false;

    this._listen(this.player, 'play', this._onAdPlay);
    this._listen(this.player, this._clickEvent, this._onAdClick);
    this._listen(this.player, 'canplay', this._onAdCanPlay);
    this._listen(this.player, 'timeupdate', this._onAdTick);
    this._listen(this.player, 'ended', this._showNextAd);
    this._listen(this.player, 'error', this._onAdError);

    this._unlisten(this.player, 'canplay', this._onVideoCanPlay);
    this._unlisten(this.player, 'play', this._checkForPreroll);
    this._unlisten(this.player, 'timeupdate', this._checkForMidroll);
    this._unlisten(this.player, 'ended', this._checkForPostroll);

    if (typeof this.takeoverCallbacks.onTakeover === 'function') {
        this.takeoverCallbacks.onTakeover(this.player);
    }
};

VideoplazaAds.prototype._release = function _release() {
    this.log('release player');
    this.player.controls = true;

    this._unlisten(this.player, 'play', this._onAdPlay);
    this._unlisten(this.player, this._clickEvent, this._onAdClick);
    this._unlisten(this.player, this._clickEvent, this._onAdClickToResume);
    this._unlisten(this.player, 'canplay', this._onAdCanPlay);
    this._unlisten(this.player, 'timeupdate', this._onAdTick);
    this._unlisten(this.player, 'ended', this._showNextAd);

    this._listen(this.player, 'canplay', this._onVideoCanPlay);
    this._listen(this.player, 'play', this._checkForPreroll);
    this._listen(this.player, 'timeupdate', this._checkForMidroll);
    this._listen(this.player, 'ended', this._checkForPostroll);

    if (typeof this.takeoverCallbacks.onRelease === 'function') {
        this.takeoverCallbacks.onRelease(this.player);
    }
};

/**
 * Called when ads are received from Videoplaza
 *
 * @param {object[]} ads The ads received
 */
VideoplazaAds.prototype._onAdsReceived = function _onAdsReceived(ads) {
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
    this.adPlaying = false;
    this.adIndex++;
    if (!this.adsEnabled || this.adIndex >= this.ads.length) {
        this.log('no more ads');

        if (typeof this.skipHandler.end === 'function') {
            this.skipHandler.end.call(this);
        }

        this._resumeOriginalVideo();
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
            this._onVideoplazaError('ad format ' + this.ad.type + ' not supported');
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
VideoplazaAds.prototype._showCompanionBanner = function _showCompanionBanner(companion) {
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
            if (!this._showCompanionBanner(creatives[i])) {
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
VideoplazaAds.prototype._onVideoplazaError = function _onVideoplazaError(message) {
    this.logError('Videoplaza error: ' + message);
    this._resumeOriginalVideo();
};

/**
 * Fetches and displays ads
 *
 * @param {string} insertionPoint The type of ad to fetch
 *      May be one of: onBeforeContent, playbackPosition, onContentEnd, playbackTime, onSeek
 * @param {boolean} [includePosition] Whether to send the current video position
 */
VideoplazaAds.prototype._runAds = function _runAds(insertionPoint, includePosition) {
    this.player.pause();
    this._prepareAdPlayback();
    this.requestSettings.insertionPointType = insertionPoint;

    if (includePosition) {
        this.requestSettings.playbackPosition = this.player.currentTime;
    } else {
        this.requestSettings.playbackPosition = null;
    }

    var onSuccess = this._onAdsReceived.bind(this);
    var onFail = this._onVideoplazaError.bind(this);
    this.adCall.requestAds(this.contentMeta, this.requestSettings, onSuccess, onFail);
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
    this.log('ad click through to ' + this.adVideo.clickThroughUri);
    this.tracker.track(this.adVideo, this.trackingEvents.creative.clickThrough);
    window.open(this.adVideo.clickThroughUri, '_blank');

    this.player.controls = true;
    this.player.pause();

    this._unlisten(this.player, this._clickEvent, this._onAdClick);
    // This event will not fire on iPads, since we show controls after returning
    // @see http://apto.ma/ipadvideotouchevents
    this._listen(this.player, this._clickEvent, this._onAdClickToResume);

    e.preventDefault();
    return false;
};

/**
 * Track progress on ad playback
 */
VideoplazaAds.prototype._onAdTick = function _onAdTick() {
    if (!(this.player && this.adVideo && this.adPlaying)) {
        this.log('Player or ad video not ready');
        return false;
    }
    var percent = this.player.currentTime / this.adVideo.duration;
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
            case 0.99:
                this.log('logged last quartile');
                this.tracker.track(this.adVideo, this.trackingEvents.creative.complete);
                break;
        }
    }

    return true;
};

/**
 * Store state of original player and prepare for ad playback
 *
 * @return {boolean} Whether player needed to be prepared
 */
VideoplazaAds.prototype._prepareAdPlayback = function _prepareAdPlayback() {
    this.log('told to create ad player');
    if (this.adPlaying) {
        return false;
    }

    if (this.player) {
        this.log('actually created ad player');
        if (this._playerState.originalSrc !== null) {
            this.log('Player state has src set', this._playerState.originalSrc, this.player.currentSrc);
        }
        this._playerState.originalSrc = this.player.currentSrc;
        this._playerState.timeToResume = this.player.currentTime;
        this._playerState.ended = this.player.ended;

        this.log('saved state', this._playerState, this.player.currentTime);
        this._takeover();

        this.adPlaying = false;

        return true;
    }

    return false;
};

VideoplazaAds.prototype._onAdError = function _onAdError(e) {
    if (e.target.error) {
        switch (e.target.error.code) {
            case e.target.error.MEDIA_ERR_ABORTED:
                this.logError('Ad playback aborted.');
                break;
            case e.target.error.MEDIA_ERR_NETWORK:
                this.logError('A network error caused the video download to fail part-way');
                break;
            case e.target.error.MEDIA_ERR_DECODE:
                this.logError('The video playback was aborted due to a corruption problem or because the video used features your browser did not support');
                break;
            case e.target.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                this.logError('The video could not be loaded, either because the server or network failed or because the format is not supported');
                break;
            default:
                this.logError('An unknown error occurred');
                break;
        }
    }

    this._showNextAd();
};

/**
 * Play the current video ad
 */
VideoplazaAds.prototype._playVideoAd = function _playVideoAd() {
    this.log('playing ad', this.adVideo);
    this.unsentQuartiles = [0.25, 0.5, 0.75, 0.99];

    if (typeof this.skipHandler.start === 'function') {
        this.skipHandler.start.call(this, this.adVideo.duration);
    }

    this.player.setAttribute('src', this.adVideo.mediaFiles[0].uri);
    this.player.load();
};

/**
 * Called when the ad has loaded and can be played
 */
VideoplazaAds.prototype._onAdCanPlay = function _onAdCanPlay() {
    this.player.play();
    this.player.currentTime = 0;
};

/**
 * Called when ad is clicked after clicktrough
 */
VideoplazaAds.prototype._onAdClickToResume = function _onAdClickToResume() {
    this.log('-- click to resume');
    this.player.play();
};

/**
 * Called when the video has loaded and can be played
 */
VideoplazaAds.prototype._onVideoCanPlay = function _onVideoCanPlay() {
    if (this._playerState.timeToResume === 0 || this._playerState.timeToResume === null) {
        this.player.play();
        return;
    }

    if (!this._playerState.isBuffering) {
        this.player.play();
    }

    if (this.player.seekable.length === 0 ||
        this.player.seekable.end(0) < this._playerState.timeToResume)
    {
        this.player.pause();
        this._playerState.isBuffering = true;
        setTimeout(this._onVideoCanPlay, 200);
        return;
    }

    this.player.currentTime = this._playerState.timeToResume;
    this.player.play();
    this._playerState.isBuffering = false;
    this._playerState.timeToResume = 0;
};

/**
 * Resumes normal video playback and releases event capturing
 */
VideoplazaAds.prototype._resumeOriginalVideo = function _resumeOriginalVideo() {
    this.log('resuming watched player', this._playerState);
    if (this.player && !this._playerState.ended) {
        if (this.player.src === this._playerState.originalSrc || !this._playerState.originalSrc) {
            this.player.play();
        } else {
            this.player.src = this._playerState.originalSrc;
            this.player.load();
        }
    }
    this.adPlaying = false;
    this._release();

    if (this._playerState.ended) {
        this.player.autoplay = null;
        if (this.player.src !== this._playerState.originalSrc) {
            this.player.src = this._playerState.originalSrc;
        }
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
    if (!this.player) {
        return;
    }

    var event;
    event = document.createEvent('HTMLEvents');
    event.initEvent(eType, true, true);
    this.player.dispatchEvent(event);
};

/**
 * Shows a preroll if a preroll should be played
 */
VideoplazaAds.prototype._checkForPreroll = function _checkForPreroll() {
    if (!this.hasShownPreroll) {
        this._runAds('onBeforeContent');
        this.hasShownPreroll = true;
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
    if (this.adPlaying) {
        return false;
    }
    if (this.midrolls.length === 0) {
        return false;
    }
    var potentialMidroll = null;
    for (var i = 0, l = this.midrolls.length; i < l; i++) {
        if (this.midrolls[i] > this.player.currentTime) {
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
 */
VideoplazaAds.prototype._checkForPostroll = function _checkForPostroll() {
    if (!this.hasShownPostroll) {
        this.hasShownPostroll = true;
        this._runAds('onContentEnd');
    }
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

    if (videoElement.tagName.toLowerCase() !== 'video') {
        this.logError('not watching player - not a video element');
        return false;
    }

    this.player = videoElement;
    this.hasShownPreroll = false;
    this.hasShownPostroll = false;

    if (!this.player.paused) {
        this._runAds('onBeforeContent');
        this.hasShownPreroll = true;
    }

    this._listen(this.player, 'play', this._checkForPreroll);
    this._listen(this.player, 'timeupdate', this._checkForMidroll);
    this._listen(this.player, 'ended', this._checkForPostroll);

    return true;
};

/**
 * lets you bind a function call to a scope
 */
if (typeof Function.prototype.bind === 'undefined') {
    Function.prototype.bind = function () {
        var __method = this, args = Array.prototype.slice.call(arguments), object = args.shift();
        return function () {
            var local_args = args.concat(Array.prototype.slice.call(arguments));
            if (this !== window) {
                local_args.push(this);
            }
            return __method.apply(object, local_args);
        };
    };
}
