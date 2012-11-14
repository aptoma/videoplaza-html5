# What is this? #
Videoplaza is a provider of ads for video.

This repository contains a library written to make writing a working
integration with Videoplaza substantially easier. It will take care of
all forms of tracking, displaying prerolls, midrolls and postrolls, as
well as companion banners in a flexible and standards compliant way.

# Do you have an example? #

Yes, just open demo/index.html.

# How do I use it? #
To use the library, include it in your page after the Videoplaza HTML5
SDK, and create a new VideoplazaAds object with the vpHost given to you
by Videoplaza. You may also add a truthy second parameter to enable
debug mode, in which various debug messages will be printed with
console.log.

When a video ad is to be displayed, we store the state of the original
player, and then change the video source to play back ads instead. When
all ads are done playing, we restore the original state and resume
playback.

When displaying a **companion banner**, a companion handler function will be
called (the function can be set with setCompanionHandler). The function
will receive the HTML for the banner, its zone ID and its dimensions. It
is entirely up to this function how it wishes to display the banner, but
it must return true to indicate that it has indeed shown the banner.

**Midrolls** can be set using the setMidrolls([]) method, which takes a list
of timecodes (in seconds) at which midrolls should be displayed. These
are absolute, not relative to the start of the video (i.e. *startTime*
is taken into account).

Also, remember to call setContentMeta before each new video is to be
displayed to set the correct data to send to the Videoplaza backend.

**All of this should be very apparent by looking at `demo/index.html`**

### A note on events ###
In order to show pre- and postrolls, the plugin needs to listen to `play`
and `ended` events. During playback of ads, the ads will cause the same
events to be triggered. In order to let you know whether an event was
triggered from the original video or an ad, you need to register takeover
callbacks: `vp.setTakeoverCallbacks(onTakeover, onRelease);`. If provided,
these callbacks while be triggered whenever the plugin takes over control of
the player. Have a look at the demo implementation to see how this can work.

You need to make sure that any events you register don't interfere with the
this plugin. If you encounter issues or have a suggestion for improving this
flow, please let us know. Currently, we listen to the following events, which
you need to make sure that you don't capture and stop:

* `play`
* `click`
* `touchstart` (on iPad)
* `canplay`
* `timeupdate`
* `ended`


# Support #
The code presented here is not officially supported by Videoplaza, nor
by Aptoma AS. That said, it should be working well and should be safe to
use.

We will tag releases, but do not as of now guarantee any form of backwards
compatibility, not even for minor releases.

Any issues should be submitted at the [Github issues page](https://github.com/aptoma/videoplaza-html5/issues).

## Participation ##

Any patches should include tests. We use [Buster.js](http://docs.busterjs.org/)
for testing. To start a server and watch files, simply run `guard` from the
project root. Tests should be run on at least Chrome and Firefox, and preferably
any modern browser, including recent versions of iOS and Android.

As we deal with video playback, you also need to manually verify that stuff
works.
