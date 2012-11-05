/*global buster assert refute expect VideoplazaAds*/

buster.testCase('vp5', {
    setUp: function () {
        this.vp = new VideoplazaAds('http://vp-validation.videoplaza.tv', true);
        this.vp.adIndex = -1;
        this.vp.ads = [
            {
                campaignId: '1',
                type: 'standard_spot'
            },
            {
                campaignId: '2',
                type: 'inventory'
            },
            {
                campaignId: '3',
                type: 'unknown'
            }
        ];
    },

    'VideoplazaAds': {
        'should read parameters': function () {
            assert.equals(this.vp.vpHost, 'http://vp-validation.videoplaza.tv');
            assert(this.vp.debug);
        }
    },

    'setSkipHandler': {
        'should assign skip handlers': function () {
            var onAdStarted = function () {
            };
            var onAdEnded = function () {
            };

            this.vp.setSkipHandler(onAdStarted, onAdEnded);

            assert.equals(this.vp.skipHandler.start, onAdStarted);
            assert.equals(this.vp.skipHandler.end, onAdEnded);
        }
    },

    'skipCurrentAd': {
        'should call _showNextAd': function () {
            this.stub(this.vp, '_showNextAd');

            this.vp.skipCurrentAd();

            assert.calledOnce(this.vp._showNextAd);
        }
    },

    'setAdsEnabled': {
        'should enable ads when called with true as first argument': function () {
            this.vp.setAdsEnabled(true);

            assert(this.vp.adsEnabled);
        },
        'should disable ads when called with false as first argument': function () {
            this.vp.setAdsEnabled(false);

            refute(this.vp.adsEnabled);
        }
    },

    'setCompanionHandler': {
        'should assign the provided function as handler': function () {
            var callback = function () {
            };

            this.vp.setCompanionHandler(callback);

            assert.equals(this.vp.companionHandler, callback);
        }
    },

    'setMidrolls': {
        setUp: function () {
            this.midrolls = [0, 5, 2, 10];

            this.vp.setMidrolls(this.midrolls);
        },
        'should assign provided the same number of midrolls to vp.midrolls': function () {
            assert.equals(this.vp.midrolls.length, this.midrolls.length);
        },
        'should reset lastPlayedMidroll to null': function () {
            assert.isNull(this.vp.lastPlayedMidroll);
        },
        'should sort provided midroll positions in ascending order': function () {
            var sortedMidrolls = [0, 2, 5, 10];

            assert.equals(this.vp.midrolls, sortedMidrolls);
        }
    },

    '_listen': {
        'should bind callback to event on element': function () {
            var element = document.createElement('div');
            var event = document.createEvent('Event');
            event.initEvent('click', true, true);

            var obj = {};
            obj.callback = function () {
            };
            this.spy(obj, 'callback');

            this.vp._listen(element, 'click', obj.callback);
            element.dispatchEvent(event);

            assert.calledOnce(obj.callback);
        }
    },

    'setContentMeta': {
        'should set meta': function () {
            var meta = {category: 'test'};

            this.vp.setContentMeta(meta);

            assert.same(this.vp.contentMeta, meta);
            assert.equals(this.vp.contentMeta.category, 'test');
        }
    },

    'setVideoProperties': {
        'should set request properties': function () {
            var width = 640;
            var height = 420;
            var bitrate = 1200;

            this.vp.setVideoProperties(width, height, bitrate);

            assert.equals(this.vp.requestSettings.width, width);
            assert.equals(this.vp.requestSettings.height, height);
            assert.equals(this.vp.requestSettings.bitrate, bitrate);
        }
    },

    '_onAds': {
        setUp: function () {
            this.ads = [
                { campaignId: '1'},
                { campaignId: '2'}
            ];

            this.stub(this.vp, '_showNextAd');
            this.spy(this.vp, 'log');
            this.stub(console, 'log');

            this.vp._onAds(this.ads);
        },
        'should log when receiving ads': function () {
            assert.calledOnce(this.vp.log);
            assert.calledOnce(console.log);
        },
        'should set this.ads to received ads': function () {
            assert.same(this.vp.ads, this.ads);
        },
        'should reset ad index to -1': function () {
            assert.equals(this.vp.adIndex, -1);
        },
        'should call _showNextAd() once': function () {
            assert.calledOnce(this.vp._showNextAd);
        }
    },

    '_showNextAd': {
        setUp: function () {
            this.skipHandlerStart = function start() {
            };

            this.skipHandlerEnd = function end() {
            };

            this.spy(this, 'skipHandlerEnd');
            this.vp.setSkipHandler(this.skipHandlerStart, this.skipHandlerEnd);
            this.stub(this.vp, 'log');
            this.stub(this.vp, '_resumeWatchedPlayer');
            this.stub(this.vp, '_displayAdCreatives');
            this.spy(this.vp.tracker, 'track');
            this.spy(this.vp, '_showNextAd');
            this.stub(this.vp, '_onError');
        },
        'should increase ad index by 1': function () {
            this.vp._showNextAd();
            assert.equals(this.vp.adIndex, 0);
        },
        'should when ads are disabled': {
            setUp: function () {
                this.vp.setAdsEnabled(false);
            },
            'log message': function () {
                this.vp._showNextAd();
                assert.calledOnce(this.vp.log);
                assert.calledWith(this.vp.log, 'no more ads');
            },
            'call skiphandler.end if defined': function () {
                this.vp._showNextAd();
                assert.calledOnce(this.skipHandlerEnd);
            },
            'not call skiphandler.end if not defined': function () {
                this.vp.setSkipHandler(null, null);
                this.vp._showNextAd();
                refute.called(this.skipHandlerEnd);
            },
            'call _resumeWatchedPlayer once ': function () {
                this.vp._showNextAd();
                assert.calledOnce(this.vp._resumeWatchedPlayer);
            },
            'return false': function () {
                var result = this.vp._showNextAd();
                refute(result);
            }
        },
        'should when there are no more ads': {
            setUp: function () {
                this.vp.ads = [];
            },
            'log message': function () {
                this.vp._showNextAd();
                assert.calledOnce(this.vp.log);
                assert.calledWith(this.vp.log, 'no more ads');
            },
            'call skiphandler.end if defined': function () {
                this.vp._showNextAd();
                assert.calledOnce(this.skipHandlerEnd);
            },
            'not call skiphandler.end if not defined': function () {
                this.vp.setSkipHandler(null, null);
                this.vp._showNextAd();
                refute.called(this.skipHandlerEnd);
            },
            'call _resumeWatchedPlayer once ': function () {
                this.vp._showNextAd();
                assert.calledOnce(this.vp._resumeWatchedPlayer);
            },
            'return false': function () {
                var result = this.vp._showNextAd();
                refute(result);
            }
        },
        'should log message when called': function () {
            this.vp._showNextAd();
            assert.calledTwice(this.vp.log);
            assert.calledWith(this.vp.log, 'showing ad #0');
        },
        'should update this.ad to next ad': function () {
            this.vp._showNextAd();
            assert.equals(this.vp.ad, this.vp.ads[this.vp.adIndex]);
        },
        'should handle "standard_spot" ad type': function () {
            var result = this.vp._showNextAd();
            assert.calledTwice(this.vp.log);
            assert.calledWith(this.vp.log, 'found standard spot');
            assert.calledOnce(this.vp._displayAdCreatives);
            assert(result);
        },
        'should handle "inventory" ad type': function () {
            this.vp.adIndex = 0;
            this.vp.ads.pop();
            var result = this.vp._showNextAd();
            assert.calledThrice(this.vp.log);
            assert.calledWith(this.vp.log, 'showing ad #1');
            assert.calledWith(this.vp.log, 'found inventory');
            assert.calledWith(this.vp.log, 'no more ads');
            assert.calledOnce(this.vp.tracker.track);
            refute(result);
        },
        'should handle unknown ad type': function () {
            this.vp.adIndex = 1;
            var result = this.vp._showNextAd();
            assert.calledOnce(this.vp.log);
            assert.calledWith(this.vp.log, 'showing ad #2');
            assert.calledOnce(this.vp._onError);
            refute(result);
        }
    },

    '_showCompanion': {
        setUp: function () {
            this.stub(this.vp, 'log');
            this.companion = {};
            this.companionHandler = function () {
                return true;
            };
        },
        'should log being called': function () {
            this.vp._showCompanion(this.companion);
            assert.calledOnce(this.vp.log);
            assert.calledWith(this.vp.log, 'show companion banner', this.companion);
        },
        'should return false if no companionHandler has been set': function () {
            this.vp.setCompanionHandler(null);
            var result = this.vp._showCompanion(this.companion);
            refute(result);
        },
        'should call companionHandler once': function () {
            this.stub(this, 'companionHandler');
            this.vp.setCompanionHandler(this.companionHandler);
            this.vp._showCompanion(this.companion);

            assert.calledOnce(this.companionHandler);
        },
        'should track event and return true if companionHandler succeeds': function () {
            this.spy(this, 'companionHandler');
            this.stub(this.vp.tracker, 'track');

            this.vp.setCompanionHandler(this.companionHandler);

            var result = this.vp._showCompanion(this.companion);
            assert.calledOnce(this.companionHandler);
            assert.calledOnce(this.vp.tracker.track);
            assert(result);
        },
        'should return false if companionHandler fails': function () {
            this.handler = function () {
                return false;
            };
            this.spy(this, 'handler');
            this.vp.setCompanionHandler(this.handler);
            var result = this.vp._showCompanion(this.companion);
            assert.calledOnce(this.handler);
            refute(result);
        }
    },

    '_displayAdCreatives': {
        setUp: function () {
            this.creatives = [
                {
                    id: 'video',
                    _name: 'c1',
                    type: 'linear'
                },
                {
                    id: '123',
                    _name: 'c2',
                    type: 'companion'
                },
                {
                    id: 'video',
                    _name: 'c3',
                    type: 'linear'
                }
            ];
            this.stub(this.vp, 'log');
            this.stub(this.vp, '_showNextAd');
            this.stub(this.vp, 'logError');
            this.stub(this.vp, '_playVideoAd');
            this.stub(this.vp, '_showCompanion').returns(true);
            this.companion = {};
            this.companionHandler = function () {
                return true;
            };

        },
        'should log being called': function () {
            this.vp._displayAdCreatives([]);
            assert.calledOnce(this.vp.log);
            assert.calledWith(this.vp.log, 'found 0 creatives for ad');
        },
        'should pick last video in list of creatives': function () {
            this.vp._displayAdCreatives(this.creatives);
            assert.equals(this.vp.adVideo, this.creatives[2]);
        },
        'should call _showCompanion for any companion banners in the list of creatives': function () {
            this.vp._displayAdCreatives(this.creatives);
            assert.calledOnce(this.vp._showCompanion);
            assert.calledWith(this.vp._showCompanion, this.creatives[1]);
        },
        'should log error if any companion banners fails': function () {
            this.vp._showCompanion.returns(false);
            this.vp._displayAdCreatives(this.creatives);

            assert.calledOnce(this.vp.logError);
            assert.calledWith(this.vp.logError, "Videoplaza error: no way of displaying companion ad");
        },
        'should log error and call _showNextAd if no video creative is found': function () {
            this.vp._displayAdCreatives([]);

            assert.calledOnce(this.vp.logError);
            assert.calledWith(this.vp.logError, "Videoplaza error: bad ad - no video", this.vp.ad);
            assert.calledOnce(this.vp._showNextAd);
        },
        'should call _playVideoAd if video creative is found': function () {
            this.vp._displayAdCreatives(this.creatives);
            assert.calledOnce(this.vp._playVideoAd);
        }
    },

    '_onError should log error and resume playback': function () {
        this.stub(this.vp, 'logError');
        this.stub(this.vp, '_resumeWatchedPlayer');

        this.vp._onError('message');

        assert.calledOnce(this.vp.logError);
        assert.calledWith(this.vp.logError, "Videoplaza error: message");
        assert.calledOnce(this.vp._resumeWatchedPlayer);
    },
    '_runAds': {
        setUp: function () {
            this.stub(this.vp, 'log');
            this.stub(this.vp, 'logError');
            this.vp.watchPlayer(document.createElement('video'));
            this.stub(this.vp.watchedPlayer, 'pause');
            this.stub(this.vp.adCall, 'requestAds');
            this.stub(this.vp, '_onAds');
            this.stub(this.vp, '_onError');
        },
        'should pause watched player': function () {
            this.vp._runAds('onBeforeContent', true);
            assert.calledOnce(this.vp.watchedPlayer.pause);
        },
        'should update request settings with insertion point': function () {
            this.vp._runAds('onBeforeContent', true);
            assert.equals(this.vp.requestSettings.insertionPointType, 'onBeforeContent');
        },
        'should update request settings with playback position if includePosition is provided': function () {
            this.vp._runAds('onBeforeContent', true);
            assert.same(this.vp.requestSettings.playbackPosition, 0);
        },
        'should set playback position to null if includePosition is not provided': function () {
            this.vp._runAds('onBeforeContent', false);
            assert.isNull(this.vp.requestSettings.playbackPosition);
        },
        'should call requestAds and _onAds if succesful': function () {
            this.vp.adCall.requestAds.callsArg(2);

            this.vp._runAds('onBeforeContent', true);

            assert.calledOnce(this.vp.adCall.requestAds);
            assert.calledOnce(this.vp._onAds);
        },
        'should call requestAds and _oneError if failing': function () {
            this.vp.adCall.requestAds.callsArg(3);

            this.vp._runAds('onBeforeContent', true);

            assert.calledOnce(this.vp.adCall.requestAds);
            assert.calledOnce(this.vp._onError);
        }
    },
    '_destroyAdPlayer': {
        'should only log being called if no ad player is set': function () {
            this.stub(this.vp, 'log');

            this.vp._destroyAdPlayer();

            assert.calledOnce(this.vp.log);
            assert.calledWith(this.vp.log, 'told to destroy ad player');
        },
        'should log being called, destroy ad player if set, and show watched player': function () {
            this.stub(this.vp, 'log');
            var parentNode = document.createElement('div');
            this.vp.watchedPlayer = document.createElement('video');
            parentNode.appendChild(this.vp.watchedPlayer);
            this.vp._createAdPlayer();

            this.vp._destroyAdPlayer();
            var watchedPlayer = parentNode.firstElementChild;

            assert.calledWith(this.vp.log, 'told to destroy ad player');
            assert.calledWith(this.vp.log, 'actually destroyed ad player');
            assert.equals(parentNode.children.length, 1);
            assert.same(parentNode.children[0], watchedPlayer);
            assert.equals(watchedPlayer.style.display, 'block');
            assert.isNull(this.vp.adPlayer);
        }
    },
    '_onAdPlay': {
        setUp: function () {
            this.stub(this.vp, 'log');
            this.stub(this.vp.tracker, 'track');
            this.vp.ad = {};
        },
        'should set adPlaying to true': function () {
            this.vp._onAdPlay();

            assert(this.vp.adPlaying);
        },
        'should when not playing': {
            'log playback started': function () {
                this.vp._onAdPlay();

                assert.calledOnce(this.vp.log);
                assert.calledWith(this.vp.log, 'ad started playing');
            },
            'track impression, view and start': function () {
                this.vp._onAdPlay();

                assert.calledThrice(this.vp.tracker.track);
                assert.calledWith(this.vp.tracker.track, this.vp.ad, this.vp.trackingEvents.ad.impression);
                assert.calledWith(this.vp.tracker.track, this.vp.adVideo, this.vp.trackingEvents.creative.creativeView);
                assert.calledWith(this.vp.tracker.track, this.vp.adVideo, this.vp.trackingEvents.creative.start);
            }
        },
        'should when playing': {
            setUp: function () {
                this.vp.adPlaying = true;
            },
            'log playback resume': function () {
                this.vp._onAdPlay();

                assert.calledOnce(this.vp.log);
                assert.calledWith(this.vp.log, 'ad resumed');
            },
            'track resume event': function () {
                this.vp._onAdPlay();

                assert.calledOnce(this.vp.tracker.track);
                assert.calledWith(this.vp.tracker.track, this.vp.adVideo, this.vp.trackingEvents.creative.resume);
            }
        }
    },

    '_onAdClick': {
        setUp: function () {
            this.event = document.createEvent('Event');
            this.event.initEvent('click', true, true);
            this.stub(this.event, 'preventDefault');
            this.stub(window, 'open');
            this.stub(this.vp, 'log');
            this.stub(this.vp.tracker, 'track');
            this.vp.adVideo = {
                clickThroughUri: 'http://test.com'
            };
        },
        'should if ad is not playing': {
            'should return true and log message': function () {
                this.vp.adPlaying = false;
                this.vp._onAdClick(this.event);
                assert.calledOnce(this.vp.log);
                assert.calledWith(this.vp.log, 'ad click with no ad playing, fallthrough to start playback.');
            }
        },
        'should if ad is playing': {
            setUp: function () {
                this.vp.adPlaying = true;
                this.vp._onAdClick(this.event);
            },
            'log being called': function () {
                assert.calledOnce(this.vp.log);
                assert.calledWith(this.vp.log, 'ad click through to http://test.com');
            },
            'track click event': function () {
                assert.calledOnce(this.vp.tracker.track);
                assert.calledWith(this.vp.tracker.track, this.vp.adVideo, this.vp.trackingEvents.creative.clickThrough);
            },
            'open new window with clickThroughUri': function () {
                assert.calledOnce(window.open);
                assert.calledWith(window.open, this.vp.adVideo.clickThroughUri, '_blank');
            },
            'call preventDefault on event': function () {
                assert.calledOnce(this.event.preventDefault);
            }
        }
    },
    '_onAdTick': {
        setUp: function () {
            this.vp.adVideo = {
                duration: 10
            };
            this.vp.adPlayer = {
                currentTime: 0
            };

            this.stub(this.vp, 'log');
            this.stub(this.vp.tracker, 'track');
        },
        'should log message if ad player is not initialized': function () {
            this.vp.adVideo = null;
            var result = this.vp._onAdTick({});
            assert.calledOnce(this.vp.log);
            refute(result);
        },
        'should log message if ad vidoe is not set': function () {
            this.vp.adPlayer = null;
            var result = this.vp._onAdTick({});
            assert.calledOnce(this.vp.log);
            refute(result);
        },
        'should do nothing if there is no unsent quartile': function () {
            this.vp.unsentQuartiles = [0.25, 0.5, 0.75];
            this.vp._onAdTick({});

            refute.called(this.vp.log);
            refute.called(this.vp.tracker.track);
        },
        'should send event when 25% quartile is passed': function () {
            this.vp.unsentQuartiles = [0.25, 0.5, 0.75];
            this.vp.adPlayer.currentTime = 3;

            this.vp._onAdTick();

            assert.equals(2, this.vp.unsentQuartiles.length);
            assert.calledOnce(this.vp.log);
            assert.calledWith(this.vp.log, 'logged first quartile');
            assert.calledOnce(this.vp.tracker.track);
            assert.calledWith(this.vp.tracker.track, this.vp.adVideo, this.vp.trackingEvents.creative.firstQuartile);
        },
        'should send event when 50% quartile is passed': function () {
            this.vp.unsentQuartiles = [0.5, 0.75];
            this.vp.adPlayer.currentTime = 6;

            this.vp._onAdTick();

            assert.equals(1, this.vp.unsentQuartiles.length);
            assert.calledOnce(this.vp.log);
            assert.calledWith(this.vp.log, 'logged midpoint');
            assert.calledOnce(this.vp.tracker.track);
            assert.calledWith(this.vp.tracker.track, this.vp.adVideo, this.vp.trackingEvents.creative.midpoint);
        },
        'should send event when 75% quartile is passed': function () {
            this.vp.unsentQuartiles = [0.75];
            this.vp.adPlayer.currentTime = 10;

            this.vp._onAdTick();

            assert.equals(0, this.vp.unsentQuartiles.length);
            assert.calledOnce(this.vp.log);
            assert.calledWith(this.vp.log, 'logged third quartile');
            assert.calledOnce(this.vp.tracker.track);
            assert.calledWith(this.vp.tracker.track, this.vp.adVideo, this.vp.trackingEvents.creative.thirdQuartile);
        }
    },
    '_createAdPlayer': {
        setUp: function () {
            this.stub(this.vp, 'log');
            this.stub(this.vp, '_listen');

            this.videoWrapper = document.createElement('div');
            this.videoWrapper.style.width = '400px';
            this.videoWrapper.style.height = '300px';
            this.videoPlayer = document.createElement('video');
            this.videoPlayer.style.width = '100%';
            this.videoPlayer.style.height = '100%';
            this.videoWrapper.appendChild(this.videoPlayer);
            document.body.appendChild(this.videoWrapper);
            this.vp.watchedPlayer = this.videoPlayer;
        },
        'should log a message and return false if already created': function () {
            this.vp.adPlayer = true;
            var result = this.vp._createAdPlayer();

            assert.calledOnce(this.vp.log);
            assert.calledWith(this.vp.log, 'told to create ad player');
            refute(result);
        },
        'should if not already created': {
            setUp: function () {
            },
            'log being created and return true if not already created': function () {
                var result = this.vp._createAdPlayer();
                assert.calledTwice(this.vp.log);
                assert.calledWith(this.vp.log, 'told to create ad player');
                assert.calledWith(this.vp.log, 'actually created ad player');
                assert(result);
            },
            'create a new player with same dimensions as watched player, with preload and controls pending on user agent': function () {
                this.vp._createAdPlayer();

                assert.equals(this.vp.adPlayer.clientWidth, 400);
                assert.equals(this.vp.adPlayer.clientHeight, 300);
                if (this.vp._needControls()) {
                    assert(this.vp.adPlayer.controls);
                } else {
                    refute(this.vp.adPlayer.controls);
                }
                assert.equals(this.vp.adPlayer.preload, 'auto');
            },
            'set up event listeners': function () {
                this.vp._createAdPlayer();

                assert.calledWithExactly(this.vp._listen, this.vp.adPlayer, 'play', this.vp._onAdPlay);
                assert.calledWithExactly(this.vp._listen, this.vp.adPlayer, 'click', this.vp._onAdClick);
                assert.calledWithExactly(this.vp._listen, this.vp.adPlayer, 'canplay', this.vp._onAdCanPlay);
                assert.calledWithExactly(this.vp._listen, this.vp.adPlayer, 'timeupdate', this.vp._onAdTick);
                assert.calledWithExactly(this.vp._listen, this.vp.adPlayer, 'ended', this.vp._showNextAd);
            },
            'insert ad player into dom and hide watched player': function () {
                this.vp._createAdPlayer();

                assert.equals(this.vp.watchedPlayer.style.display, 'none');
                assert.equals(this.vp.adPlayer.style.display, 'block');
                assert.same(this.vp.adPlayer.parentNode, this.videoWrapper);
                assert.same(this.vp.adPlayer, this.videoWrapper.children[0]);
                assert.same(this.vp.watchedPlayer, this.videoWrapper.children[1]);
                refute(this.vp.adPlaying);
            }
        }
    },
    '_playVideoAd': {
        setUp: function () {
            this.stub(this.vp, 'log');
            this.stub(this.vp, '_createAdPlayer');
            this.vp.adVideo = {
                duration: 10,
                mediaFiles: [
                    {uri: 'http://test.com/' }
                ]
            };
            this.vp.adPlayer = document.createElement('video');
            this.stub(this.vp.adPlayer, 'load');
        },
        'should log being called': function () {
            this.vp._playVideoAd();

            assert.calledOnce(this.vp.log);
            assert.calledWith(this.vp.log, 'playing ad', this.vp.adVideo);
        },
        'should reset unsent quartiles': function () {
            this.vp._playVideoAd();

            assert.equals(this.vp.unsentQuartiles.length, 3);
        },
        'should create ad player': function () {
            this.vp._playVideoAd();
            assert.calledOnce(this.vp._createAdPlayer);
        },
        'should call start skipHandler if defined': function () {
            var handlers = {startHandler: function () {
            }};
            this.stub(handlers, 'startHandler');
            this.vp.setSkipHandler(handlers.startHandler, null);
            this.vp._playVideoAd();

            assert.calledOnce(handlers.startHandler);
            assert.calledWith(handlers.startHandler, this.vp.adVideo.duration);
        },
        'should set src of adPlayer to provided uri': function () {
            this.vp._playVideoAd();
            assert.equals(this.vp.adPlayer.src, this.vp.adVideo.mediaFiles[0].uri);
        },
        'should call adPlayer.load': function () {
            this.vp._playVideoAd();
            assert.calledOnce(this.vp.adPlayer.load);
        }
    },
    '_onAdCanPlay': {
        'should call adPlayer.play': function () {
            this.vp.adPlayer = document.createElement('video');
            this.stub(this.vp.adPlayer, 'play');
            this.vp._onAdCanPlay();

            assert.calledOnce(this.vp.adPlayer.play);
        }
    },
    '_resumeWatchedPlayer': {
        setUp: function () {
            this.stub(this.vp, 'log');
            this.stub(this.vp, '_destroyAdPlayer');
            this.stub(this.vp, '_triggerVideoEvent');
            this.vp.watchedPlayer = document.createElement('video');
            this.stub(this.vp.watchedPlayer, 'play');
        },
        'should log being called and destroy adPlayer': function () {
            this.vp._resumeWatchedPlayer();

            assert.calledOnce(this.vp.log);
            assert.calledWith(this.vp.log, 'resuming watched player');
            assert.calledOnce(this.vp._destroyAdPlayer);
        },
        'should call play on watched player if paused and not ended': function () {
            this.vp.watchedPlayer.paused = true;
            this.vp._resumeWatchedPlayer();

            assert.calledOnce(this.vp.watchedPlayer.play);
        },
        'should trigger "ended" video event if video is ended': function () {
            this.vp.watchedPlayer = {
                ended: true,
                paused: true,
                play: function () {
                }
            };
            this.stub(this.vp.watchedPlayer, 'play');
            this.vp._resumeWatchedPlayer();

            refute.called(this.vp.watchedPlayer.play);
            assert.calledOnce(this.vp._triggerVideoEvent);
            assert.calledWith(this.vp._triggerVideoEvent, 'ended');
        }
    },
    '_triggerVideoEvent': {
        'should do nothing if no player is registered': function () {
            var result = this.vp._triggerVideoEvent('play');
            assert.equals('undefined', typeof result);
        },
        'should fire an event of the provided type': function () {
            this.vp.watchedPlayer = document.createElement('video');
            this.stub(this.vp.watchedPlayer, 'dispatchEvent');
            var expectedEvent = document.createEvent('HTMLEvents');
            expectedEvent.initEvent('play', true, true);

            this.vp._triggerVideoEvent('play');

            assert.calledOnce(this.vp.watchedPlayer.dispatchEvent);
            assert.equals(this.vp.watchedPlayer.dispatchEvent.args[0][0].type, expectedEvent.type);
        }
    },
    '_checkForMidroll': {
        setUp: function () {
            this.stub(this.vp, '_runAds');
            this.stub(this.vp, 'log');
        },
        'should do nothing if there are no midrolls defined': function () {
            var result = this.vp._checkForMidroll();
            refute(result);
            refute.called(this.vp._runAds);
        },
        'should call _runAds if we have a pending midroll': function () {
            this.vp.watchedPlayer = {
                currentTime: 10
            };
            this.vp.midrolls = [5, 10, 15];
            this.vp._checkForMidroll();

            assert.calledOnce(this.vp.log);
            assert.calledWith(this.vp.log, 'playing overdue midroll 1');

            assert.calledOnce(this.vp._runAds);
            assert.calledWith(this.vp._runAds, 'playbackPosition', true);
            assert.equals(this.vp.lastPlayedMidroll, 1);
        },
        'should return false if there are no pending midrolls': function () {
            this.vp.watchedPlayer = {
                currentTime: 20
            };
            this.vp.midrolls = [];
            var result = this.vp._checkForMidroll();

            refute.called(this.vp.log);
            refute(result);
        }
    },
    '_checkForPreroll': {
        setUp: function () {
            this.stub(this.vp, '_runAds');
        },
        'should do nothing if preroll has been played': function () {
            var event = {};
            this.vp.hasShownPreroll = true;
            this.vp._checkForPreroll(event);

            refute.called(this.vp._runAds);
            refute(event.ignore);
        },
        'should run ads and update preroll state if not yet played': function () {
            var event = {};
            this.vp.hasShownPreroll = false;
            this.vp._checkForPreroll(event);

            assert.called(this.vp._runAds);
            assert.calledWith(this.vp._runAds, 'onBeforeContent');
            assert(this.vp.hasShownPreroll);
            assert(event.ignore);
        }
    },
    '_checkForPostroll': {
        setUp: function () {
            this.stub(this.vp, '_runAds');
        },
        'should do nothing if postroll has been played': function () {
            var event = {};
            this.vp.hasShownPostroll = true;
            this.vp._checkForPostroll(event);

            refute.called(this.vp._runAds);
            refute(event.ignore);
        },
        'should run ads and update postroll state if not yet played': function () {
            var event = {};
            this.vp.hasShownPostroll = false;
            this.vp._checkForPostroll(event);

            assert.called(this.vp._runAds);
            assert.calledWith(this.vp._runAds, 'onContentEnd');
            assert(this.vp.hasShownPostroll);
            assert(event.ignore);
        }
    },
    '_needControls': {
        'should return true if user agent is iOS or Android': function () {
            if (navigator.userAgent.match(/iPad|iPod|iPhone|Android/)) {
                assert(this.vp._needControls());
            } else {
                refute(this.vp._needControls());
            }
        }
    },
    'watchedPlayer': {
        setUp: function () {
            this.stub(this.vp, 'log');
            this.stub(this.vp, 'logError');
            this.stub(this.vp, '_destroyAdPlayer');
            this.stub(this.vp, '_listen');
            this.stub(this.vp, '_runAds');

            this.videoElement = document.createElement('video');
        },
        'should log being called and destroy any existing ad player': function () {
            this.vp.watchPlayer(this.videoElement);

            assert.calledOnce(this.vp.log);
            assert.calledWith(this.vp.log, 'told to watch player', this.videoElement);
        },
        'should log error and return false if videoElement is not a HTMLVideoElemet': function () {
            this.vp.watchPlayer(document.createElement('div'));
            assert.calledOnce(this.vp.logError);
            assert.calledWith(this.vp.logError, 'not watching player - not a video element');
        },
        'should assign videoElement to this.watchedPlayer': function () {
            this.vp.watchPlayer(this.videoElement);
            assert.same(this.vp.watchedPlayer, this.videoElement);
        },
        'should call _runAds with onBeforeContent (preroll) if player is not paused': function () {
            this.videoElement.play();
            if (this.videoElement.paused) {
                buster.log('Error faking play back. Skip tests.');
                assert(true);
                return;
            }
            this.vp.watchPlayer(this.videoElement);
            assert.calledOnce(this.vp._runAds);
            assert(this.vp.hasShownPreroll);
        },
        'should set up event listeners': function () {
            this.vp.watchPlayer(this.videoElement);

            assert.calledThrice(this.vp._listen);
            assert.calledWith(this.vp._listen, this.videoElement, 'play', this.vp._checkForPreroll);
            assert.calledWith(this.vp._listen, this.videoElement, 'timeupdate', this.vp._checkForMidroll);
            assert.calledWith(this.vp._listen, this.videoElement, 'ended', this.vp._checkForPostroll);
        },
        'should set hasShownPostroll to false': function () {
            this.vp.watchPlayer(this.videoElement);
            refute(this.vp.hasShownPostroll);
        },
        'should return true': function () {
            assert(this.vp.watchPlayer(this.videoElement));
        }
    }
});
