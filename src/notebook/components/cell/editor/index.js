import React from 'react';
import PureRenderMixin from 'react-addons-pure-render-mixin';

import CodeMirror from 'react-codemirror';
import CM from 'codemirror';

import Rx from 'rxjs/Rx';

import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/hint/anyword-hint';

import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/css/css';
import 'codemirror/mode/julia/julia';
import 'codemirror/mode/r/r';
import 'codemirror/mode/markdown/markdown';

import './codemirror-ipython';

import { codeComplete, pick, formChangeObject } from './complete';

import { updateCellSource } from '../../../actions';

function goLineUpOrEmit(editor) {
  const cursor = editor.getCursor();
  if (cursor.line === 0 && cursor.ch === 0 && !editor.somethingSelected()) {
    CM.signal(editor, 'topBoundary');
  } else {
    editor.execCommand('goLineUp');
  }
}

function goLineDownOrEmit(editor) {
  const cursor = editor.getCursor();
  const lastLineNumber = editor.lastLine();
  const lastLine = editor.getLine(lastLineNumber);
  if (cursor.line === lastLineNumber &&
      cursor.ch === lastLine.length &&
      !editor.somethingSelected()) {
    CM.signal(editor, 'bottomBoundary');
  } else {
    editor.execCommand('goLineDown');
  }
}

const excludedIntelliSenseTriggerKeys = {
  8: 'backspace',
  9: 'tab',
  13: 'enter',
  16: 'shift',
  17: 'ctrl',
  18: 'alt',
  19: 'pause',
  20: 'capslock',
  27: 'escape',
  32: 'space',
  33: 'pageup',
  34: 'pagedown',
  35: 'end',
  36: 'home',
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  45: 'insert',
  46: 'delete',
  91: 'left window key',
  92: 'right window key',
  93: 'select',
  107: 'add',
  109: 'subtract',
  110: 'decimal point',
  111: 'divide',
  112: 'f1',
  113: 'f2',
  114: 'f3',
  115: 'f4',
  116: 'f5',
  117: 'f6',
  118: 'f7',
  119: 'f8',
  120: 'f9',
  121: 'f10',
  122: 'f11',
  123: 'f12',
  144: 'numlock',
  145: 'scrolllock',
  186: 'semicolon',
  187: 'equalsign',
  188: 'comma',
  189: 'dash',
  // 190: 'period',
  // 191: 'slash',
  192: 'graveaccent',
  220: 'backslash',
  222: 'quote',
};


CM.keyMap.basic.Up = 'goLineUpOrEmit';
CM.keyMap.basic.Down = 'goLineDownOrEmit';
CM.commands.goLineUpOrEmit = goLineUpOrEmit;
CM.commands.goLineDownOrEmit = goLineDownOrEmit;

export default class Editor extends React.Component {
  static propTypes = {
    id: React.PropTypes.string,
    input: React.PropTypes.any,
    completion: React.PropTypes.bool,
    language: React.PropTypes.string,
    lineNumbers: React.PropTypes.bool,
    lineWrapping: React.PropTypes.bool,
    onChange: React.PropTypes.func,
    theme: React.PropTypes.string,
    cmtheme: React.PropTypes.string,
    focused: React.PropTypes.bool,
    focusAbove: React.PropTypes.func,
    focusBelow: React.PropTypes.func,
  };

  static contextTypes = {
    store: React.PropTypes.object,
  };

  static defaultProps = {
    language: 'python',
    lineNumbers: false,
    cmtheme: 'composition',
    focused: false,
  };

  constructor(props) {
    super(props);
    this.shouldComponentUpdate = PureRenderMixin.shouldComponentUpdate.bind(this);
    this.state = {
      source: this.props.input,
    };
    this.onChange = this.onChange.bind(this);

    this.hint = this.completions.bind(this);
    this.hint.async = true;

    // Remember the name of the theme that's applied so that when it changes we
    // can force codemirror to remeasure.
    this.theme = null;
  }

  componentDidMount() {
    // On first load, if focused, set codemirror to focus
    if (this.props.focused) {
      this.refs.codemirror.focus();
    }

    const cm = this.refs.codemirror.getCodeMirror();
    cm.on('topBoundary', this.props.focusAbove);
    cm.on('bottomBoundary', this.props.focusBelow);

    const keyupEvents = Rx.Observable.fromEvent(cm, 'keyup', (editor, ev) => ({ editor, ev }));

    keyupEvents
      .switchMap(i => Rx.Observable.of(i))
      .subscribe(({ editor, ev }) => {
        const cursor = editor.getDoc().getCursor();
        const token = editor.getTokenAt(cursor);

        if (!editor.state.completionActive &&
            !excludedIntelliSenseTriggerKeys[(ev.keyCode || ev.which).toString()] &&
            (token.type === 'tag' || token.type === 'variable' || token.string === ' ' ||
             token.string === '<' || token.string === '/') &&
            store.getState().app.executionState === 'idle') {
          editor.execCommand('autocomplete', { completeSingle: false });
        }
      });
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      source: nextProps.input,
    });
  }

  componentDidUpdate(prevProps) {
    if (this.props.focused && prevProps.focused !== this.props.focused) {
      this.refs.codemirror.focus();
    } else if (!this.props.focused && prevProps.focused !== this.props.focused) {
      const cm = this.refs.codemirror.getCodeMirror();
      cm.getInputField().blur();
    }

    if (this.theme !== this.props.theme) {
      this.theme = this.props.theme;
      this.refs.codemirror.getCodeMirror().refresh();
    }
  }

  onChange(text) {
    if (this.props.onChange) {
      this.props.onChange(text);
    } else {
      this.setState({
        source: text,
      });
      this.context.store.dispatch(updateCellSource(this.props.id, text));
    }
  }

  completions(editor, callback) {
    if (!this.props.completion) {
      return;
    }

    const state = this.context.store.getState();
    const channels = state.app.channels;

    codeComplete(channels, editor)
      .subscribe(callback);
  }

  render() {
    const options = {
      mode: this.props.language,
      lineNumbers: this.props.lineNumbers,
      lineWrapping: this.props.lineWrapping,
      theme: this.props.cmtheme,
      autofocus: false,
      hintOptions: {
        hint: this.hint,
        completeSingle: false, // In automatic autocomplete mode we don't want override
        extraKeys: {
          Right: pick,
        },
      },
      extraKeys: {
        'Ctrl-Space': 'autocomplete',
      },
    };
    return (
      <div className="input">
        <CodeMirror
          value={this.state.source}
          ref="codemirror"
          className="cell_cm"
          options={options}
          onChange={this.onChange}
        />
      </div>
    );
  }
}
