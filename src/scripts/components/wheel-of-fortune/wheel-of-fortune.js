import Util from '@services/util.js';
import Color from 'color';
import './wheel-of-fortune.scss';

/** @constant {number} FOCUS_TIMEOUT_MS Timeout for focussing. */
const FOCUS_TIMEOUT_MS = 100;

/** @constant {number} DEGREES_IN_CIRCLE Number of degrees in a circle. */
const DEGREES_IN_CIRCLE = 360;

/** @constant {number} PALENESS_FACTOR Factor to mix a color with white. */
const PALENESS_FACTOR = 0.75;

/** @constant {number} CLOSE_TO_TWO Number close to two to cause inprecision. */
const CLOSE_TO_TWO = 1.99999;


/** @constant {number} CENTER Center point in percent. */
const CENTER = 50;

/** @constant {number} RADIUS Radius in percent. */
const RADIUS = 50;

/** @constant {number} RADIUS_DIVISOR Tweak size of indicator. */
const RADIUS_DIVISOR = 7.5;

/** @constant {number} INDICATOR_RADIUS Indicator radius in percent. */
const INDICATOR_RADIUS = RADIUS / RADIUS_DIVISOR;

/** @constant {number} INDICATOR_ROTATION Indicator rotation offset. */
const INDICATOR_ROTATION_DEG = -90;

/** @constant {number} LABEL_OFFSET Label offset. */
const LABEL_OFFSET = 5;

/** @constant {number} LABEL_TEXT_SIZE_PX Label text size in px (SVG viewport). */
const LABEL_TEXT_SIZE_PX = 6;

/** @constant {number} SPIN_ROUNDS Number of rounds to spin. */
const SPIN_ROUNDS = 5;

/** @constant {number} SPIN_UPDATE_INTERVAL_MS Spinning update interval in MS. */
const SPIN_UPDATE_INTERVAL_MS = 50;

/** @constant {number} SPIN_DURATION_MS Total spin duration. */
const SPIN_DURATION_MS = 5000;

/** @constant {number} LABEL_LABEL_TEXT_SIZE_PX Label text size in px (SVG viewport). */
const LABEL_LABEL_TEXT_SIZE_PX = 4;

export default class WheelOfFortune {

  /**
   * General purpose message box.
   * @class
   * @param {object} [params] Parameters.
   * @param {object[]} [params.segments] Segments' data.
   */
  constructor(params = {}) {
    this.params = Util.extend({
      segments: [{ text: 'Placeholder' }, { text: 'Placeholder' }],
      l10n: {
        skip: 'Skip'
      },
      a11y: {
        started: 'The wheel of fortune started spinning. Please wait a moment.'
      }
    }, params);

    this.onDone = () => {};

    this.dom = document.createElement('div');
    this.dom.classList.add('wheel-of-fortune');

    this.wheel = document.createElement('div');
    this.wheel.classList.add('wheel-of-fortune-wheel');
    this.dom.append(this.wheel);

    const wheel = this.buildWheelSVG({
      segments: this.params.segments
    });

    // Appending SVG element does not work, so innerHTML and querySelector
    this.wheel.innerHTML = wheel.outerHTML;
    this.wheelSegments = this.dom.querySelector('.wheel-of-fortune-segments');

    this.button = document.createElement('button');
    this.button.classList.add('wheel-of-fortune-button');
    this.button.innerText = this.params.l10n.skip;
    this.button.addEventListener('click', () => {
      window.clearTimeout(this.wheelTimeout);
      this.onDone();
      this.onDone = () => {};
    });
    this.dom.append(this.button);

    this.hide = this.hide.bind(this);

    this.isVisible = true;

    this.setAngle(0);
  }

  /**
   * Resize.
   */
  resize() {
    if (this.isVisible) {
      this.clipWheel();
    }
  }

  /**
   * Clip wheel to hide overflowing text.
   */
  clipWheel() {
    window.requestAnimationFrame(() => {
      const backdrop = this.dom.querySelector('.wheel-of-fortune-backdrop');
      const maxSize = (
        backdrop.getBoundingClientRect().width -
          INDICATOR_RADIUS -
          LABEL_OFFSET
      // eslint-disable-next-line no-magic-numbers
      ) / 2;

      this.wheel.style.clipPath = `circle(${maxSize}px at 50% 50%)`;
    });
  }

  /**
   * Get DOM.
   * @returns {HTMLElement} DOM.
   */
  getDOM() {
    return this.dom;
  }

  /**
   * Show.
   */
  show() {
    this.isVisible = true;
    this.dom.classList.remove('display-none');

    this.resize();
  }

  /**
   * Hide.
   * @param {object} [params] Parameters.
   * @param {boolean} [params.fade] If true, will fade out before hiding.
   * @param {function} [params.onHidden] Callback when hidden.
   */
  hide(params = {}) {
    if (!this.isVisible) {
      return;
    }

    // Remember callback
    if (params.onHidden) {
      this.onHidden = params.onHidden;
    }

    if (!params.fade) {
      this.isVisible = false;

      this.dom.removeEventListener('transitionend', this.hide);

      this.dom.classList.remove('fade-out');
      this.dom.classList.add('display-none');

      this.onHidden?.();
      delete this.onHidden;

      return;
    }

    this.dom.addEventListener('transitionend', this.hide);
    this.dom.classList.add('fade-out');
  }

  /**
   * Focus.
   */
  focus() {
    window.setTimeout(() => {
      this.button.focus();
    }, FOCUS_TIMEOUT_MS); // Ensure that aria start message is read first
  }

  /**
   * Spin to particular segment.
   * @param {number} segmentIndex Segment index.
   * @param {function} onDone Callback when done.
   */
  spinTo(segmentIndex, onDone) {
    if (segmentIndex < 0 || segmentIndex > this.params.segments.length) {
      return;
    }

    const min = DEGREES_IN_CIRCLE / this.params.segments.length * segmentIndex;
    const max = DEGREES_IN_CIRCLE / this.params.segments.length * (segmentIndex + 1);

    // Prevent stop on border of two segments
    // eslint-disable-next-line no-magic-numbers
    let segmentAngle = Math.random() * (max - min - 2) + min + 1;

    this.onDone = () => {
      onDone?.(segmentIndex);
    };

    this.spin({ change: SPIN_ROUNDS * DEGREES_IN_CIRCLE + segmentAngle });
  }

  /**
   * Spin wheel.
   * @param {object} [params] Parameters.
   * @param {number} params.time Current time
   * @param {number} params.start Start value.
   * @param {number} params.delta Delta from start.
   * @param {number} params.duration Duration or max time.
   */
  spin(params = {}) {
    params = Util.extend({
      start: 0,
      change: SPIN_ROUNDS * DEGREES_IN_CIRCLE,
      currentTime: 0,
      duration: SPIN_DURATION_MS
    }, params);

    if (params.currentTime === 0) {
      this.params.globals.get('read')(this.params.a11y.started);
    }
    else if (params.currentTime >= params.duration) {
      this.onDone();
      this.onDone = () => {};
      return;
    }

    this.setAngle(Util.easeInOutQuad(
      params.currentTime,
      params.start,
      params.change,
      params.duration
    ));

    window.clearTimeout(this.wheelTimeout);
    this.wheelTimeout = window.setTimeout(() => {
      this.spin({
        start: params.start,
        change: params.change,
        currentTime: params.currentTime + SPIN_UPDATE_INTERVAL_MS,
        duration: params.duration,
        onDone: params.onDone
      });
    }, SPIN_UPDATE_INTERVAL_MS);
  }

  /**
   * Get current segment index.
   * @returns {number} Current segment index.
   */
  getSegmentIndex() {
    return Math.floor(this.getAngle() / (DEGREES_IN_CIRCLE / this.params.segments.length));
  }

  /**
   * Get current angle.
   * @returns {number} Current angle.
   */
  getAngle() {
    return (
      ((this.currentAngle ?? 0) - INDICATOR_ROTATION_DEG) % DEGREES_IN_CIRCLE + DEGREES_IN_CIRCLE
    ) % DEGREES_IN_CIRCLE;
  }

  /**
   * Set angle of wheel.
   * @param {number} degrees Degrees.
   */
  setAngle(degrees) {
    if (typeof degrees !== 'number') {
      return;
    }

    this.currentAngle = (
      (degrees + INDICATOR_ROTATION_DEG) % DEGREES_IN_CIRCLE + DEGREES_IN_CIRCLE
    ) % DEGREES_IN_CIRCLE;

    this.wheelSegments.style.transform =
      `translate(50%, 50%) rotate(${this.currentAngle}deg)`;
  }

  /**
   * Build SVG.
   * @param {object} [params] Parameters.
   * @returns {SVGElement} SVG.
   */
  buildWheelSVG(params = {}) {
    params = Util.extend({
      segments: []
    }, params);

    const wheel = document.createElement('svg');
    wheel.setAttribute('width', '100%');
    wheel.setAttribute('height', '100%');
    wheel.setAttribute('viewBox', '0 0 100 100');
    wheel.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Create background pattern
    const defs = document.createElement('defs');

    this.params.segments.forEach((segment) => {
      if (!segment.image?.file?.path) {
        return; // No background image given
      }

      const pattern = document.createElement('pattern');
      pattern.setAttribute('id', `wheel-of-fortune-segment-image-${segment.uuid}`);
      pattern.setAttribute('width', '100%');
      pattern.setAttribute('height', '100%');

      const tmpImg = document.createElement('img');
      H5P.setSource(
        tmpImg, segment.image.file, this.params.globals.get('contentId')
      );

      // Try to
      const image = document.createElement('image');
      image.setAttribute('width', '200%');
      image.setAttribute('height', '200%');
      image.setAttribute('x', '-50%');
      image.setAttribute('y', '-50%');
      image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      image.setAttribute('href', tmpImg.src);
      pattern.appendChild(image);

      defs.appendChild(pattern);
    });

    wheel.appendChild(defs);

    // Backdrop circle (for transparent images and clipping)
    const circle = document.createElement('circle');
    circle.classList.add('wheel-of-fortune-backdrop');
    circle.setAttribute('cx', CENTER);
    circle.setAttribute('cy', CENTER);
    circle.setAttribute('r', RADIUS);
    wheel.append(circle);

    // Add all segments to wheel
    const wheelSegments = this.buildSegmentWrapper();
    for (let i = 0; i < params.segments.length; i++) {
      const segment = this.buildSegment({
        // eslint-disable-next-line no-magic-numbers
        startAngle: i * 2 * Math.PI / params.segments.length,
        // eslint-disable-next-line no-magic-numbers
        endAngle: (i + 1) * 2 * Math.PI / params.segments.length,
        whiteValue: PALENESS_FACTOR / params.segments.length * (i + 1),
        text: params.segments[i].text,
        image: params.segments[i].image,
        uuid: this.params.segments[i].uuid
      });

      wheelSegments.append(segment);
      wheel.append(wheelSegments);
    }

    // Position indicator
    const indicator = this.buildPositionIndicator();
    wheel.append(indicator);

    return wheel;
  }

  /**
   * Build segment wrapper.
   * @returns {SVGElement} Segment wrapper.
   */
  buildSegmentWrapper() {
    const wrapper = document.createElement('g');
    wrapper.classList.add('wheel-of-fortune-segments');

    return wrapper;
  }

  /**
   * Build segment.
   * @param {object} [params] Parameters.
   * @param {number} [params.startAngle] Start angle.
   * @param {number} [params.endAngle] End angle.
   * @param {number} [params.whiteValue] White value
   * @param {string} [params.fillColor] Fill color.
   * @param {string} [params.text] Segment text.
   * @returns {HTMLElement} Segment element.
   */
  buildSegment(params = {}) {
    params = Util.extend({
      startAngle: 0,
      endAngle: Math.PI * CLOSE_TO_TWO, // 360° exactly would reault in 0°
      fillColor: 'rgb(26 115 217)',
      whiteValue: 0
    }, params);

    if (params.startAngle > params.endAngle) {
      const tmp = params.startAngle;
      params.startAngle = params.endAngle;
      params.endAngle = tmp;
    }

    params.endAngle = Math.min(params.endAngle, Math.PI * CLOSE_TO_TWO);
    params.coverAngle = params.endAngle - params.startAngle;

    const group = document.createElement('g');

    const segment = document.createElement('path');
    segment.classList.add('wheel-of-fortune-segment');

    const start = 'M 0 0';

    const lineX = Math.cos(params.startAngle) * RADIUS;
    const lineY = -Math.sin(params.startAngle) * RADIUS;
    const line = `L ${lineX} ${lineY}`;

    const archRX = RADIUS;
    const archRY = RADIUS;
    const archAngle = 0;
    const archLargeFlag = params.endAngle - params.startAngle <= Math.PI ?
      0 :
      1;
    const archSweepFlag = 0;
    const archX = Math.cos(params.endAngle) * RADIUS;
    const archY = -Math.sin(params.endAngle) * RADIUS;
    const arch = `A ${archRX} ${archRY} ${archAngle} ${archLargeFlag} ${archSweepFlag} ${archX} ${archY}`;

    // Cmp. https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d
    segment.setAttribute('d', `${start} ${line} ${arch} Z`);

    const backgroundColor = Color(params.fillColor).mix(Color('#ffffff'), params.whiteValue);
    if (Object.keys(params.image ?? {}).length) {
      segment.setAttribute('fill', `url(#wheel-of-fortune-segment-image-${params.uuid})`);
    }
    else {
      segment.setAttribute('fill', backgroundColor.hex());
    }

    group.append(segment);

    if (!Object.keys(params.image ?? {}).length && params.text) {
      const text = document.createElement('text');
      text.setAttribute('x',
        INDICATOR_RADIUS + LABEL_OFFSET
      );
      text.setAttribute('y', `${LABEL_LABEL_TEXT_SIZE_PX}`);
      text.innerText = params.text;
      text.style.font = `${LABEL_TEXT_SIZE_PX}px sans-serif`;

      // eslint-disable-next-line no-magic-numbers
      const textAngle = (-2 * params.startAngle - params.coverAngle) * 90 / Math.PI;
      text.style.transform = `rotate(${textAngle}deg)`;

      if (backgroundColor.isDark()) {
        text.setAttribute('fill', '#eeeeee');
      }
      else {
        text.setAttribute('fill', '#111111');
      }

      group.append(text);
    }

    return group;
  }

  /**
   * Build position indicator.
   * @returns {SVGElement} Position indicator group.
   */
  buildPositionIndicator() {
    const indicator = document.createElement('g');

    const triangle = document.createElement('polygon');
    triangle.classList.add('wheel-of-fortune-indicator-knob');

    const point1 = `${CENTER - INDICATOR_RADIUS} ${CENTER}`;
    const point2 = `${CENTER + INDICATOR_RADIUS} ${CENTER}`;
    const point3 = `${CENTER} ${CENTER - (INDICATOR_RADIUS + LABEL_OFFSET - 1)}`;
    const points = [point1, point2, point3];

    triangle.setAttribute('points', points.join(', '));
    indicator.append(triangle);

    const circle = document.createElement('circle');
    circle.classList.add('wheel-of-fortune-indicator');
    circle.setAttribute('cx', CENTER);
    circle.setAttribute('cy', CENTER);
    circle.setAttribute('r', INDICATOR_RADIUS);
    indicator.append(circle);

    return indicator;
  }
}
