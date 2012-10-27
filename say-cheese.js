/*
 * Say Cheese!
 * Lee Machin, 2012
 * http://leemach.in, http://new-bamboo.co.uk
 *
 * Minimal javascript library for integrating a webcam and snapshots into your app.
 *
 * Handles starting up the webcam and rendering the element, and also capturing shots
 * in a separate canvas element.
 *
 * Depends on video and canvas, and of course, getUserMedia. It's unlikely to work
 * on anything but the newest browsers.
 */

var SayCheese = (function($) {

  var SayCheese;

  /* Check for the existence of the userMedia feature. */
  function userMediaFeatureExists() {
    return 'getUserMedia'       in navigator ||
           'webkitGetUserMedia' in navigator ||
           'mozGetUserMedia'    in navigator;
  };


  function eventCoords(evt) {
     return { x: evt.offsetX || evt.layerX, y: evt.offsetY || evt.layerY };
  };

  SayCheese = function SayCheese(element, options) {
    if (userMediaFeatureExists()) {
      this.viewfinder = {},
      this.snapshots = [],
      this.canvas = null,
      this.context = null,
      this.video = null,
      this.events = {},
      this.options = {
        dynamicViewfinder: false
      };

      this.element = document.querySelectorAll(element)[0];
      this.element.style.position = 'relative';
      this.setOptions(options);
    } else {
      // should make this more graceful in future
      throw new Error("getUserMedia() is not supported in this browser");
    }

    return this;
  };

  /**
   * Wrap the jQuery stuff so as to minimise the impact of the framework on
   * the rest of the code.
   */
  SayCheese.prototype.on = function on(evt, handler) {
    return $(this).on(evt, handler);
  };

  SayCheese.prototype.off = function off(evt, handler) {
    return $(this).off(evt, handler);
  };

  SayCheese.prototype.trigger = function trigger(evt, data) {
    // bubbling up the DOM makes things go a bit crazy. This assumes
    // preventDefault
    return $(this).triggerHandler(evt, data);
  };

  SayCheese.prototype.merge = function merge(target, object) {
    return $.extend(target, object);
  }

  SayCheese.prototype.setOptions = function setOptions(options) {
    this.options = this.merge(this.options, options);
  }


  SayCheese.prototype.getUserMedia = function getUserMedia(success, error) {
    return (function() {
      return (navigator.getUserMedia ||
              navigator.webkitGetUserMedia ||
              navigator.mozGetUserMedia).bind(navigator);
    })().call(this, { video: true }, success, error);
  };

  SayCheese.prototype.getStreamUrl = function getStreamUrl(stream) {
    url = (function() {
      return (window.URL || window.webkitURL);
    })();

    return (url && url.createObjectURL) ? url.createObjectURL(stream) : stream;
  };

  SayCheese.prototype.createVideo = function createVideo() {
    this.video = document.createElement('video');
    this.video.autoplay = true;
  };

  SayCheese.prototype.setupCanvas = function setupCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.video.offsetWidth;
    this.canvas.height = this.video.offsetHeight;

    this.canvas.style.position = 'absolute';
    this.canvas.style.top = this.video.offsetTop;
    this.canvas.style.left = this.video.offsetLeft;

    this.context = this.canvas.getContext('2d');

    this.element.appendChild(this.canvas);


    this.initDefaultViewfinder();

    if (this.options.dynamicViewfinder == true) {
      this.initDynamicViewfinder();
    }

    return this.trigger('start');
  };

  /* The default viewfinder is just the exact size of the video */
  SayCheese.prototype.initDefaultViewfinder = function initDefaultViewfinder() {
    return this.viewfinder = {
      startX: 0,
      startY: 0,
      endX: this.video.offsetWidth,
      endY: this.video.offsetHeight,
      width: this.video.offsetWidth,
      height: this.video.offsetHeight
    };
  };

  /* This viewfinder can be resized to capture specific parts of the video stream */
  SayCheese.prototype.initDynamicViewfinder = function initDynamicViewfinder() {
    var isDragging = false,
        box = {};

    var start = function start(evt) {
      evt.preventDefault();
      var coords = eventCoords(evt);
      box.startX = coords.x;
      box.startY = coords.y;
      isDragging = true;
    }.bind(this);

    var stop = function stop(evt) {
      evt.preventDefault();
      isDragging = false;

      var coords = eventCoords(evt);
      box.endX = coords.x,
      box.endY = coords.y;

      this.viewfinder = box;
      this.trigger('change');
    }.bind(this);

    var draw = function draw(evt) {
      evt.preventDefault();
      var coords = eventCoords(evt);
      if (isDragging) {
        // used absolutely, can show dimensions. Use endX and endY for
        // mapping the visible canvas area to a new canvas.
        box.width = coords.x - box.startX,
        box.height = coords.y - box.startY;

        // draw the shade
        this.context.globalCompositeOperation = 'xor';
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.fillStyle = 'rgba(0, 0, 0, .8)';
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // draw the window
        this.context.strokeStyle = 'rgba(255, 255, 255, .5)';
        this.context.lineWidth = 2;
        this.context.strokeRect(box.startX, box.startY, box.width, box.height);
        this.context.fillRect(box.startX, box.startY, box.width, box.height);
      }
    }.bind(this);

    this.canvas.addEventListener('mousedown', start, true);
    this.canvas.addEventListener('mouseup', stop, true);
    this.canvas.addEventListener('mousemove', draw, true);

    // add touch events if they're there
    if ('ontouchstart' in window) {
      this.canvas.addEventListener('touchstart', start, true);
      this.canvas.addEventListener('touchend', stop, true);
      this.canvas.addEventListener('touchmove', draw, true);
    }

    // make the cursor a crosshair to make it more clear what can be done
    this.canvas.style.cursor = 'crosshair';
  };

  SayCheese.prototype.resetViewfinder = function() {
    this.context.globalCompositeOperation = 'source-over';
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.viewfinder = {
      startX: 0,
      startY: 0,
      endX: this.video.offsetWidth,
      endY: this.video.offsetHeight,
      width: this.video.offsetWidth,
      height: this.video.offsetHeight
    }

    this.trigger('change');
  };

  SayCheese.prototype.takeSnapshot = function takeSnapshot(callback) {
    var snapshot = document.createElement('canvas'),
        ctx      = snapshot.getContext('2d');

    snapshot.width  = Math.abs(this.viewfinder.width),
    snapshot.height = Math.abs(this.viewfinder.height);

    ctx.drawImage(this.video,
                  Math.min(this.viewfinder.startX, this.viewfinder.endX),
                  Math.min(this.viewfinder.startY, this.viewfinder.endY),
                  snapshot.width,
                  snapshot.height,
                  0,
                  0,
                  snapshot.width,
                  snapshot.height);

    this.snapshots.push(snapshot);
    this.trigger('snapshot', snapshot);

    if (callback) {
      callback.call(this, snapshot);
    }

    ctx = null;
  };

  /* Start up the stream, if possible */
  SayCheese.prototype.start = function start(callback) {
    var success = function success(stream) {
      this.createVideo();

      // video width and height don't exist until metadata is loaded
      this.video.addEventListener('loadedmetadata', this.setupCanvas.bind(this));

      this.video.src = this.getStreamUrl(stream);
      this.element.appendChild(this.video);
    }.bind(this);

    /* error is also called when someone denies access */
    var error = function error() {
      this.trigger('error', arguments);
    }.bind(this);

    // add the callback to the start event if one is supplied.
    if (callback) {
      this.on('start', callback);
    }

    return this.getUserMedia(success, error);
  };

  /* Stop it - TODO: figure out how to actually disable the stream */
  SayCheese.prototype.stop = function stop() {
    this.video = null;
    document.body.removeChild(video);
  };

  return SayCheese;

})($);
