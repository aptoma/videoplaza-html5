/*global */

var videoplaza = {
    core: {
        AdCallModule: function (vpHost) {
            this.vpHost = vpHost;
            this.requestAds = function () {
            };
        },
        Tracker: function () {
            this.track = function () {
            };
        }
    }
};

videoplaza.core.Tracker.trackingEvents = {
    ad: {
        impression: 0
    },
    creative: {
        acceptInvitation: '1',
        clickThrough: '20',
        close: '7',
        collapse: '2',
        complete: '18',
        creativeView: '90',
        expand: '31',
        firstQuartile: '15',
        fullscreen: '37',
        midpoint: '16',
        mute: '32',
        pause: '34',
        resume: '36',
        rewind: '35',
        start: '14',
        thirdQuartile: '17',
        timeSpent: '100',
        unmute: '33'
    }
};
