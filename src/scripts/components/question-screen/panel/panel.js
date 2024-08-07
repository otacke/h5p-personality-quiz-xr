import Util from '@services/util.js';
import Option from './option.js';
import './panel.scss';

export default class Panel {

  /**
   * Question screen.
   * @class
   * @param {object} [params] Parameters.
   * @param {string} [params.appearance] Appearence, 'classic', 'chat'.
   * @param {string} [params.questionText] Question text.
   * @param {boolean} [params.animation] If true, animate option buttons.
   * @param {object} [params.answerOptions] Answer options.
   * @param {object} [params.image] Image data.
   * @param {object} [callbacks] Callbacks.
   * @param {function} [callbacks.onAnswerGiven] Callback on answer given.
   * @param {function} [callbacks.onClicked] Callback when panel is completed.
   */
  constructor(params = {}, callbacks = {}) {
    this.params = Util.extend({
      appearance: 'classic',
      questionText: '',
      answerOptions: []
    }, params);

    this.params.questionText = Util.purifyHTML(this.params.questionText);

    this.callbacks = Util.extend({
      onAnswerGiven: () => {},
      onCompleted: () => {}
    }, callbacks);

    this.isVisibleState = true;

    this.optionsChosen = [];

    this.buildDOM();
  }

  /**
   * Build DOM.
   */
  buildDOM() {
    this.dom = document.createElement('div');
    this.dom.classList.add('h5p-personality-quiz-xr-panel');
    this.dom.classList.add(`appearance-${this.params.appearance}`);

    // Image
    if (this.params.image?.file?.path) {
      const image = document.createElement('img');
      image.classList.add('h5p-personality-quiz-xr-panel-image');
      image.setAttribute('alt', this.params.image.file.alt ?? '');
      image.addEventListener('load', () => {
        this.params.globals.get('resize')();
      });
      H5P.setSource(
        image, this.params.image.file, this.params.globals.get('contentId')
      );
      this.dom.append(image);
    }

    // Question text
    const questionTextId = H5P.createUUID();

    this.questionText = document.createElement('div');
    this.questionText.classList.add('h5p-personality-quiz-xr-question');
    this.questionText.setAttribute('id', questionTextId);
    this.dom.append(this.questionText);

    if (this.params.animation && this.params.appearance === 'chat') {
      this.typingDots = document.createElement('div');
      this.typingDots.classList.add('typing-animation-dots');
      this.questionText.append(this.typingDots);

      for (let i = 0; i < 3; i++) {
        const typingDot = document.createElement('div');
        typingDot.classList.add('typing-animation-dot');
        this.typingDots.append(typingDot);
      }
    }
    else {
      this.questionText.innerText = this.params.questionText;
    }

    const mode = (this.params.answerOptions.every((option) => {
      return option?.image?.file;
    })) ?
      'image' :
      'text';

    // Options
    this.optionWrapper = document.createElement('ol');
    this.optionWrapper.classList.add('h5p-personality-quiz-xr-answer-options');
    this.optionWrapper.classList.add(`mode-${mode}`);
    this.optionWrapper.setAttribute('aria-labelledby', questionTextId);
    // Some screenreaders do not real label unless role is set to group
    this.optionWrapper.setAttribute('role', 'group');
    if (this.params.animation && this.params.appearance === 'chat') {
      this.optionWrapper.classList.add('display-none');
    }

    this.dom.append(this.optionWrapper);

    this.options = [];

    this.params.answerOptions.forEach((option, index) => {
      const listItem = document.createElement('li');
      listItem.classList.add('h5p-personality-quiz-xr-answer-list-item');
      this.optionWrapper.append(listItem);

      const optionInstance = new Option(
        {
          globals: this.params.globals,
          appearance: this.params.appearance,
          mode: mode,
          text: option.text,
          image: option.image,
          animation: this.params.animation
        },
        {
          onClicked: () => {
            if (!this.optionsChosen.includes(index)) {
              optionInstance.select({ animate: this.params.animation });
            }
            else {
              optionInstance.deselect();
            }
            this.handleOptionChosen(index);
          },
          onCompleted: () => {
            if (!this.params.allowsMultipleChoices) {
              this.handleOptionCompleted();
            }
          }
        }
      );

      this.options.push(optionInstance);

      listItem.append(optionInstance.getDOM());
    });

    if (this.params.allowsMultipleChoices) {
      this.buttonDone = document.createElement('button');
      this.buttonDone.classList.add('h5p-personality-quiz-xr-button-done');
      if (this.params.animation && this.params.appearance === 'chat') {
        this.buttonDone.classList.add('display-none');
      }

      const label = document.createElement('span');
      label.classList.add('h5p-personality-quiz-xr-button-done-label');
      label.innerText = this.params.dictionary.get('l10n.done');
      this.buttonDone.append(label);

      if (this.optionsChosen.length === 0) {
        this.buttonDone.disabled = true;
      }

      this.buttonDone.addEventListener('click', () => {
        this.buttonDone.disabled = true;
        this.buttonDone.classList.add('selected');
        this.options.forEach((option) => {
          option.disable();
        });

        this.callbacks.onAnswerGiven(this.optionsChosen);
        this.callbacks.onCompleted();
      });

      this.dom.append(this.buttonDone);
    }
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
   * @param {object} [params] Parameters.
   * @param {boolean} [params.showInstantly] If true, skip animation.
   * @param {boolean} [params.focus] If true, set focus.
   */
  show(params = {}) {
    this.dom.classList.remove('display-none');
    this.isVisibleState = true;

    if (
      !params.showInstantly && this.params.appearance === 'chat'
    ) {
      const delayTypingAnimation = Math.min(
        this.params.questionText.length * Panel.DELAY_PER_CHAR_MS,
        Panel.MAX_DELAY_TYPING_ANIMATION_MS
      );

      this.params.globals.get('resize')();

      window.setTimeout(() => {
        this.questionText.innerText = this.params.questionText;

        window.setTimeout(() => {
          this.optionWrapper.classList.remove('display-none');
          this.buttonDone?.classList.remove('display-none');
          this.params.globals.get('resize')();
          if (params.focus) {
            window.setTimeout(() => {
              this.focus();
            }, 50); // Prevent jumping if focus called before resize
          }

        }, Panel.DELAY_FOR_ANSWER_OPTIONS_MS);
      }, delayTypingAnimation);
    }
    else {
      this.questionText.innerText = this.params.questionText;
      this.optionWrapper.classList.remove('display-none');
      if (params.focus) {
        window.requestAnimationFrame(() => {
          this.focus();
        }); // Ensure option is visible
      }

      window.requestAnimationFrame(() => {
        this.params.globals.get('resize')();
      });
    }
  }

  /**
   * Hide.
   */
  hide() {
    this.dom.classList.add('display-none');
    this.isVisibleState = false;
  }

  /**
   * Focus.
   * @param {object} [params] Parameters.
   */
  focus(params) {
    this.options[0]?.focus(params);
  }

  /**
   * Determine whether panel is visible.
   * @returns {boolean} True, if panel is visible, else false.
   */
  isVisible() {
    return this.isVisibleState;
  }

  /**
   * Reset.
   * @param {object} [params] Parameters.
   * @param {number[]} [params.optionsChosen] Index of previously chosen options.
   * @param {boolean} [params.completed] If true, disable options.
   */
  reset(params = {}) {
    if (this.params.animation && this.params.appearance === 'chat') {
      this.questionText.innerHTML = '';
      this.questionText.append(this.typingDots);
      this.optionWrapper.classList.add('display-none');
    }

    this.optionsChosen = params.optionsChosen ?? [];

    this.options.forEach((option, index) => {
      option.reset({
        disabled: this.optionsChosen.length > 0 || params.completed,
        selected: this.optionsChosen.includes(index)
      });
    });

    if (this.params.allowsMultipleChoices) {
      this.buttonDone.disabled =
        this.optionsChosen.length === 0 || params.completed;

      this.buttonDone.classList.toggle('selected', params.completed);
    }
  }

  /**
   * Handle option chosen.
   * @param {number} index Index of option that was chosen.
   */
  handleOptionChosen(index) {
    if (this.optionsChosen.includes(index)) {
      this.optionsChosen = this.optionsChosen.filter((optionIndex) => {
        return optionIndex !== index;
      });
    }
    else {
      this.optionsChosen.push(index);
    }

    if (!this.params.allowsMultipleChoices) {
      this.options.forEach((option) => {
        option.disable();
      });

      this.callbacks.onAnswerGiven(this.optionsChosen);
    }
    else {
      this.buttonDone.disabled = this.optionsChosen.length === 0;
    }
  }

  /**
   * Handle option completed.
   */
  handleOptionCompleted() {
    this.callbacks.onCompleted();
  }

  getChoices() {
    return ({
      question: this.params.questionText,
      options: this.options.map((option, index) => {
        return {
          text: option.params.text,
          image: option.params.image,
          selected: option.isSelected()
        };
      })
    });
  }
}

/** @constant {number} DELAY_PER_CHAR_MS Time to delay showing the question per character. */
Panel.DELAY_PER_CHAR_MS = 40;

/** @constant {number} MAX_DELAY_TYPING_ANIMATION_MS Maximum time to delay showing the question. */
Panel.MAX_DELAY_TYPING_ANIMATION_MS = 2500;

/** @constant {number} DELAY_FOR_ANSWER_OPTIONS_S Time to delay showing the answer options. */
Panel.DELAY_FOR_ANSWER_OPTIONS_MS = 1000;
