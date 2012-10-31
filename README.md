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

When a video ad is to be displayed, the watched video player is paused
and hidden with display:none. A new video element is then created with
the dimensions set in setVideoProperties(width,height) and inserted
before the real video in the DOM (the ad player will never be created
twice, instead it will only be hidden after the first displayed). The
ad(s) are then played, and afterwards, the ad player is hidden and the
real video is resumed. This process is identical for prerolls, postrolls
and midrolls.

When displaying a companion banner, a companion handler function will be
called (the function can be set with setCompanionHandler). The function
will receive the HTML for the banner, its zone ID and its dimensions. It
is entirely up to this function how it wishes to display the banner, but
it must return true to indicate that it has indeed shown the banner.

Midrolls can be set using the setMidrolls([]) method, which takes a list
of timecodes (in seconds) at which midrolls should be displayed. These
are absolute, not relative to the start of the video (i.e. *startTime*
is taken into account).

Also, remember to call setContentMeta before each new video is to be
displayed to set the correct data to send to the Videoplaza backend.

**All of this should be very apparent by looking at demo/index.html**

### A note on events ###
Note that this implementation depends on being able to listen for the
*play* and *ended* events. It should therefore be allowed to be the first
to attach its event listeners to a newly created video element. It does
play quite nicely with others though. If an ad is displayed, the play
event is intercepted, and a *ignore* property is set to true, the ad is
played, and a new play event is triggered when the ads finish and the
real video starts playing without this *ignore* property. The same
applies to the postroll. This *ignore* property is a workaround for the
lack of event cancellation in the DOM Event spec. Other suggestions are
welcome!

# Support #
The code presented here is not officially supported by Videoplaza, nor
by Aptoma AS. That said, it should be working well and should be safe to
use.
