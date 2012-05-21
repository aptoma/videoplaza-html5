Videoplaza is a provider of ads for video, and have recently (as of May
2012) released a major rewrite of their HTML5 video solution.

This repository contains a library written to make writing a working
integration substantially easier. It will take care of all forms of
tracking, displaying prerolls, midrolls and postrolls, as well as
companion banners in a flexible and standards compliant way.

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

Note that this implementation DOES hijack the *play* and *ended* events,
so these might not be reliable.
