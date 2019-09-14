define([
    'base/js/namespace',
    'base/js/keyboard',
    'base/js/utils',
    'jquery',
    'module',
    'notebook/js/cell',
    'notebook/js/codecell',
    'notebook/js/completer',
    'require'
], function (
    Jupyter,
    keyboard,
    utils,
    $,
    module,
    cell,
    codecell,
    completer,
    requirejs
) {
    'use strict';

    var config = {
        assist_active: true,
        options_limit: 10,
        assist_delay: 0,
        before_line_limit: -1,
        after_line_limit: -1,
        server_url: 'http://coding-assistant-playground.ingress.dev.grabds.com'
    }
    var logPrefix = '[' + module.id + ']';

    console.info(logPrefix, ' config: ', config);

    const optionsLimit = config.options_limit;
    var beforeLineLimit = config.before_line_limit > 0 ? config.before_line_limit : Infinity;
    var afterLineLimit = config.after_line_limit > 0 ? config.after_line_limit : Infinity;
    var assistDelay = config.assist_delay;
    var assistActive = config.assist_active;
    // var serverUrl = config.server_url;
    var serverUrl = utils.get_body_data('baseUrl') + 'tabnine'
    console.log(logPrefix, ' serverUrl: ', serverUrl);

    var requestInfo = {
        "version": "1.0.7",
        "request": {
            "Autocomplete": {
                "filename": Jupyter.notebook.notebook_path.replace('.ipynb', '.py'),
                "before": "",
                "after": "",
                "region_includes_beginning": false,
                "region_includes_end": false,
                "max_num_results": optionsLimit,
            }
        }
    }

    var Cell = cell.Cell;
    var CodeCell = codecell.CodeCell;
    var Completer = completer.Completer;
    var keycodes = keyboard.keycodes;
    var specials = [
        keycodes.enter,
        keycodes.esc,
        keycodes.backspace,
        keycodes.tab,
        keycodes.up,
        keycodes.down,
        keycodes.left,
        keycodes.right,
        keycodes.shift,
        keycodes.ctrl,
        keycodes.alt,
        keycodes.meta,
        keycodes.capslock,
        keycodes.space,
        keycodes.pageup,
        keycodes.pagedown,
        keycodes.end,
        keycodes.home,
        keycodes.insert,
        keycodes.delete,
        keycodes.numlock,
        keycodes.f1,
        keycodes.f2,
        keycodes.f3,
        keycodes.f4,
        keycodes.f5,
        keycodes.f6,
        keycodes.f7,
        keycodes.f8,
        keycodes.f9,
        keycodes.f10,
        keycodes.f11,
        keycodes.f12,
        keycodes.f13,
        keycodes.f14,
        keycodes.f15
    ];

    function loadCss(name) {
        $('<link/>').attr({
            type: 'text/css',
            rel: 'stylesheet',
            href: requirejs.toUrl(name)
        }).appendTo('head');
    }


    function onlyModifierEvent(event) {
        var key = keyboard.inv_keycodes[event.which];
        return (
            (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) &&
            (key === 'alt' || key === 'ctrl' || key === 'meta' || key === 'shift')
        );
    }

    function requestComplterServer(requestData, isAsync, handleResData) {
        // use get to solve post redirecting too many times
        var urlWithParams = serverUrl + '?body=' + JSON.stringify(requestData);
        $.get(serverUrl, {'data': JSON.stringify(requestData)})
         .done(function (data) {
            handleResData(data);
         }).fail(function (error){
            console.log(logPrefix, ' get error: ', error);
         });
    }

    function isValidCodeLine(line) {
        // comment line is valid, since we want to get completions
        if (line.length === 0 ||
            line.charAt(0) === '!') {
            return false;
        }
        return true;
    }

    var origCompleterFinishCompleting = Completer.prototype.finish_completing;

    function patchCompleterFinishCompleting() {
        Completer.prototype.finish_completing = function (msg) {
            if (this.visible && $('#complete').length) {
                console.info(logPrefix, 'complete is visible, ignore by just return');
                return;
            }

            var currEditor = this.editor;
            var currCell = this.cell;
            // check whether current cell satisfies line before and line after
            var cursor = currEditor.getCursor();
            var currCellLines = currEditor.getValue().split("\n");
            var before = [];
            var after = [];
            var currLine = currCellLines[cursor.line];
            if (isValidCodeLine(currLine)) {
                before.push(currLine.slice(0, cursor.ch));
                after.push(currLine.slice(cursor.ch, currLine.length));
            }

            var i = cursor.line - 1;
            for (; i >= 0; before.length < beforeLineLimit, i--) {
                if (isValidCodeLine(currCellLines[i])) {
                    before.push(currCellLines[i]);
                }
            }
            requestInfo.request.Autocomplete.region_includes_beginning = (i < 0);

            i = cursor.line + 1;
            for (; i < currCellLines.length && after.length < afterLineLimit; i++) {
                if (isValidCodeLine(currCellLines[i])) {
                    after.push(currCellLines[i]);
                }
            }

            var cells = Jupyter.notebook.get_cells();
            var index;
            for (index = cells.length - 1; index >= 0 && cells[index] != currCell; index--);
            var regionIncludesBeginning = requestInfo.request.Autocomplete.region_includes_beginning;
            requestInfo.request.Autocomplete.region_includes_beginning = regionIncludesBeginning && (index == 0);
            requestInfo.request.Autocomplete.region_includes_end = (i == currCellLines.length)
                && (index == cells.length - 1);
            // need lookup other cells
            if (before.length < beforeLineLimit || after.length < afterLineLimit) {
                i = index - 1;
                // always use for loop instead of while loop if poosible.
                // since I always foget to describe/increase i in while loop
                var atLineBeginning = true; // set true in case of three is no more lines before
                for (; i >= 0 && before.length < beforeLineLimit; i--) {
                    var cellLines = cells[i].get_text().split("\n");
                    var j = cellLines.length - 1;
                    atLineBeginning = false;
                    for (; j >= 0 && before.length < beforeLineLimit; j--) {
                        if (isValidCodeLine(cellLines[j])) {
                            before.push(cellLines[j]);
                        }
                    }
                    atLineBeginning = (j < 0);
                }
                // at the first cell and at the first line of that cell
                requestInfo.request.Autocomplete.region_includes_beginning = (i < 0) && atLineBeginning;

                i = index + 1;
                var atLineEnd = true; // set true in case of three is no more liens left
                for (; i < cells.length && after.length < afterLineLimit; i++) {
                    var cellLines = cells[i].get_text().split("\n");
                    j = 0;
                    atLineEnd = false;
                    for (; j < cellLines.length && after.length < afterLineLimit; j++) {
                        if (isValidCodeLine(cellLines[j])) {
                            after.push(cellLines[j]);
                        }
                    }
                    atLineEnd = (j == cellLines.length);
                }
                // at the last cell and at the last line of that cell
                requestInfo.request.Autocomplete.region_includes_end = (i == cells.length) && atLineEnd;
            }
            before.reverse();
            this.before = before;
            this.after = after;

            requestInfo.request.Autocomplete.before = before.join("\n");
            requestInfo.request.Autocomplete.after = after.join("\n");

            this.complete = $('<div/>').addClass('completions complete-dropdown-content');
            this.complete.attr('id', 'complete');
            $('body').append(this.complete);
            this.visible = true;
            // fix page flickering
            this.start = currEditor.indexFromPos(cursor);
            this.complete.css({
                'display': 'none',
            });

            var cmp = this;
            requestComplterServer(requestInfo, true, function (data) {
                var complete = cmp.complete;
                if (data.results.length == 0) {
                    cmp.close();
                    return;
                }
                cmp.completions = data.results.slice(0, optionsLimit);
                cmp.completions.forEach(function (res) {
                    var completeContainer = generateCompleteContainer(res);
                    complete.append(completeContainer);
                });
                setCompleteLocation(cmp, data.old_prefix);
                addKeyeventListeners(cmp);
            });
            return true;
        };
    }

    function setCompleteLocation(completer, oldPrefix) {
        if (!completer || !completer.complete) {
            return;
        }
        var start = completer.start;
        completer.completeFrom = completer.editor.posFromIndex(start);
        if (oldPrefix) {
            oldPrefix = oldPrefix;
            completer.completeFrom.ch -= oldPrefix.length;
            // completer.completeFrom.ch = Math.max(completer.completeFrom.ch, 0);
        }
        var pos = completer.editor.cursorCoords(
            completer.completeFrom
        );

        var left = pos.left - 3;
        var top;
        var cheight = completer.complete.height();
        var wheight = $(window).height();
        if (pos.bottom + cheight + 5 > wheight) {
            top = pos.top - cheight - 4;
        } else {
            top = pos.bottom + 1;
        }
        completer.complete.css({
            'left': left + 'px',
            'top': top + 'px',
            'display': 'initial'
        })
    }

    function generateCompleteContainer(responseComplete) {
        var completeContainer = $('<div/>')
            .addClass('complete-container');
        var wordContainer = $('<div/>')
            .addClass('complete-block')
            .addClass('complete-word')
            .text(responseComplete.new_prefix);
        completeContainer.append(wordContainer);
        var probContainer = $('<div/>')
            .addClass('complete-block')
            .addClass('complete-detail')
            .text(responseComplete.detail)
        completeContainer.append(probContainer);
        return completeContainer;
    }

    function isAlphabeticKeyCode(keyCode) {
        return keyCode >= 65 && keyCode <= 90;
    }

    function isNumberKeyCode(keyCode) {
        return (keyCode >= 48 && keyCode <= 57) || (keyCode >= 96 && keyCode <= 105);
    }

    function isOperatorKeyCode(keyCode) {
        return (keyCode >= 106 && keyCode <= 111) ||
            (keyCode >= 186 && keyCode <= 192) ||
            (keyCode >= 219 && keyCode <= 222);
    }

    function needUpdateComplete(keyCode) {
        return isAlphabeticKeyCode(keyCode) || isNumberKeyCode(keyCode) || isOperatorKeyCode(keyCode);
    }

    function addKeyeventListeners(completer) {
        var options = $("#complete").find('.complete-container');
        var editor = completer.editor;
        var currIndex = -1;
        var preIndex;
        completer.isKeyupFired = true; // make keyup only fire once
        completer._handle_keydown = function (comp, event) { // define as member method to handle close
            // since some opration is async, it's better to check whether complete is existing or not.
            if (!$('#complete').length || !completer.completions) {
                // editor.off('keydown', completer._handle_keydown);
                // editor.off('keyup', completer._handle_handle_keyup);
                return;
            }
            completer.isKeyupFired = false;
            if (event.keyCode == keycodes.up || event.keyCode == keycodes.tab
                || event.keyCode == keycodes.down || event.keyCode == keycodes.enter) {
                event.codemirrorIgnore = true;
                event._ipkmIgnore = true;
                event.preventDefault();
                // it's better to prevent enter key when completions being shown
                if (event.keyCode == keycodes.enter) {
                    completer.close();
                    return;
                }
                preIndex = currIndex;
                currIndex = event.keyCode == keycodes.up ? currIndex - 1 : currIndex + 1;
                currIndex = currIndex < 0 ?
                    options.length - 1
                    : (currIndex >= options.length ?
                        currIndex - options.length
                        : currIndex);
                $(options[currIndex]).css('background', 'lightblue');
                var end = editor.getCursor();
                if (completer.completions[currIndex].old_suffix) {
                    end.ch += completer.completions[currIndex].old_suffix.length;
                }
                var replacement = completer.completions[currIndex].new_prefix;
                replacement += completer.completions[currIndex].new_suffix;
                editor.replaceRange(replacement, completer.completeFrom, end);
                if (preIndex != -1) {
                    $(options[preIndex]).css('background', '');
                }
            } else if (needUpdateComplete(event.keyCode)) {
                // Let this be handled by keyup, since it can get current pressed key.
            } else {
                completer.close();
            }

        }

        completer._handle_keyup = function (cmp, event) {
            if (!completer.isKeyupFired && !event.altKey &&
                !event.ctrlKey && !event.metaKey && needUpdateComplete(event.keyCode)) {
                completer.update();
                completer.isKeyupFired = true;
            };
        };

        editor.on('keydown', completer._handle_keydown);
        editor.on('keyup', completer._handle_keyup);
    }

    function addCompleterUpdate() {
        Completer.prototype.update = function () {
            // In this case, only current line have been changed.
            // so we can use cached other lines and this line to
            // generate before and after
            var cursor = this.editor.getCursor();
            this.start = this.editor.indexFromPos(cursor); // get current cursor
            var currLineText = this.editor.getLineHandle(cursor.line).text;
            var currLineBefore = currLineText.slice(0, cursor.ch);
            var currLineAfter = currLineText.slice(cursor.ch, currLineText.length);
            if (this.before.length > 0) {
                this.before[this.before.length - 1] = currLineBefore;
            } else {
                this.before.push(currLineBefore);
            }
            if (this.after.length > 0) {
                this.after[0] = currLineAfter;
            } else {
                this.after.push(currLineAfter);
            }
            requestInfo.request.Autocomplete.before = this.before.join('\n');
            requestInfo.request.Autocomplete.after = this.after.join('\n');
            var cmp = this;
            requestComplterServer(requestInfo, true, function (data) {
                if (data.results.length == 0) {
                    cmp.close();
                    return;
                }
                setCompleteLocation(cmp, data.old_prefix);
                var results = data.results;
                var completeContainers = $("#complete").find('.complete-container');
                var i;
                cmp.completions = results.slice(0, optionsLimit);
                // replace current options first
                for (i = 0; i < cmp.completions.length && i < completeContainers.length; i++) {
                    $(completeContainers[i]).find('.complete-word').text(results[i].new_prefix);
                    $(completeContainers[i]).find('.complete-detail').text(results[i].detail);
                }
                // add
                for (; i < cmp.completions.length; i++) {
                    var completeContainer = generateCompleteContainer(results[i]);
                    cmp.complete.append(completeContainer);
                }
                // remove
                for (; i < completeContainers.length; i++) {
                    completeContainers[i].remove();
                }
                cmp.editor.off('keydown', cmp._handle_keydown);
                cmp.editor.off('keyup', cmp._handle_keyup);
                addKeyeventListeners(cmp);
            });
        };
    }

    var origCompleterClose = Completer.prototype.close;

    function patchCompleterClose() {
        // patch this function to off keyup
        Completer.prototype.close = function () {
            this.done = true;
            $('#complete').remove();
            this.editor.off('keydown', this._handle_keydown);
            // this.editor.off('keypress', this._handle_keypress); disabled since this can be replaced with keydown.
            this.visible = false;
            this.completions = null;
            this.completeFrom = null;
            this.complete = null;
            // before are copied from completer.js
            this.editor.off('keyup', this._handle_key_up);
        };
    }

    function unPatchCompleterFinishCompleting() {
        Completer.prototype.finish_completing = origCompleterFinishCompleting;
    }

    function unPatchCompleterClose() {
        Completer.prototype.close = origCompleterClose;
    }

    function changeFunctionAndState(newState) {
        if (newState) {
            patchCompleterFinishCompleting();
            patchCompleterClose();
        } else {
            unPatchCompleterFinishCompleting();
            unPatchCompleterClose();
        }
        setAssistState(newState);
    }


    function patchCellKeyevent() {
        var origHandleCodemirrorKeyEvent = Cell.prototype.handle_codemirror_keyevent;
        Cell.prototype.handle_codemirror_keyevent = function (editor, event) {
            if (assistActive && !event.altKey && !event.metaKey && !event.ctrlKey
                && (this instanceof CodeCell) && !onlyModifierEvent(event)) {
                this.tooltip.remove_and_cancel_tooltip();
                if (!editor.somethingSelected() &&
                    editor.getSelections().length <= 1 &&
                    !this.completer.visible &&
                    specials.indexOf(event.keyCode) == -1) {
                    var cell = this;
                    setTimeout(function () {
                        cell.completer.startCompletion();
                    }, assistDelay)
                }
            }
            return origHandleCodemirrorKeyEvent.apply(this, arguments);
        };
    }

    function setAssistState(newState) {
        assistActive = newState;
        $('.assistant-toggle > .fa').toggleClass('fa-check', assistActive);
        console.log(logPrefix, 'continuous autocompletion', assistActive ? 'on' : 'off');
    }

    function toggleAutocompletion() {
        changeFunctionAndState(!assistActive);
    }

    function addMenuItem() {
        if ($('#help_menu').find('.assistant-toggle').length > 0) {
            return;
        }
        var menuItem = $('<li/>').insertAfter('#keyboard_shortcuts');
        var menuLink = $('<a/>').text('Jupyter TabNine')
            .addClass('assistant-toggle')
            .attr('title', 'Provide continuous code autocompletion')
            .on('click', toggleAutocompletion)
            .appendTo(menuItem);
        $('<i/>').addClass('fa menu-icon pull-right').prependTo(menuLink);
    }


    function load_notebook_extension() {
        return Jupyter.notebook.config.loaded.then(function on_success() {
            // Note: seems there's bug of pipeline, loaded will ends with
            // `resolved undefined`, so the yaml config won't work.
            console.log(logPrefix, 'jupyter notebook config loaded data: ', Jupyter.notebook.config.data);
            $.extend(true, config, Jupyter.notebook.config.data.jupyter_tabnine);
            loadCss('./main.css');
        }, function on_error(err) {
            console.warn(logPrefix, 'error loading config:', err);
        }).then(function on_success() {
            // $('head').append('<meta name="csrf-token" content="{{ csrf_token() }}">');
            addCompleterUpdate();
            patchCellKeyevent();
            patchCompleterClose();
            patchCompleterFinishCompleting();
            addMenuItem();
            setAssistState(config.assist_active);
        });
    }
    return {
        load_ipython_extension: load_notebook_extension,
        load_jupyter_extension: load_notebook_extension
    };
});

