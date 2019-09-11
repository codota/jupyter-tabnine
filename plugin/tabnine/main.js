define([
    'base/js/namespace',
    'base/js/keyboard',
    'base/js/utils',
    'jquery',
    'module',
    'notebook/js/cell',
    'notebook/js/codecell',
    'notebook/js/completer'
], function (
    Jupyter,
    keyboard,
    utils,
    $,
    module,
    cell,
    codecell,
    completer
) {
        'use strict';
        var requestInfo = {
            "version": "1.0.7",
            "request": {
                "Autocomplete": {
                    "filename": Jupyter.notebook.notebook_path.replace('.ipynb', '.py'),
                    "before": "",
                    "after": "",
                    "region_includes_beginning": false,
                    "region_includes_end": false,
                    "max_num_results": 5
                }
            }
        }
        const MAX_NUM_HINTS = 10;
        var Cell = cell.Cell;
        var CodeCell = codecell.CodeCell;
        var Completer = completer.Completer;
        var logPrefix = '[' + module.id + ']';
        var assistActive = true;
        // TODO: move this to cnfig yaml
        var assistDelay = 0;
        var beforeLineLimit = Infinity;
        var afterLineLimit = Infinity;

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

        function onlyModifierEvent(event) {
            var key = keyboard.inv_keycodes[event.which];
            return (
                (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) &&
                (key === 'alt' || key === 'ctrl' || key === 'meta' || key === 'shift')
            );
        }

        function requestComplterServer(requestData, isAsync, handleResData) {
            $.ajax({
                url: 'http://localhost:9999/',
                type: 'post',
                async: isAsync,
                dataType: 'json',
                headers: {
                    'Content-Type': 'text/plain'
                },
                data: JSON.stringify(requestData),
                success: function (data, status, xhr) {
                    // logData(data);
                    handleResData(data);
                },
                error: function (request, status, error) {
                    console.info(logPrefix, "request failed: ", error);
                }
            });
        }

        function logData(data) {
            data.results.forEach(function (res) {
                console.info(logPrefix, 'new_prefix: ', res.new_prefix,
                    ' old_suffix: ', res.old_prefix, ' new_suffix: ', res.new_prefix, ' detail:', res.detail);
            });
        }

        function isValidCodeLine(line) {
            if (line.length === 0 ||
                line.charAt(0) === '!' ||
                line.charAt(0) === '#') {
                return false;
            }
            return true;
        }

        function patchCompleterFinishCompleting() {
            var origCompleterFinishCompleting = Completer.prototype.finish_completing;
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
                while (i >= 0 && before.length < beforeLineLimit) {
                    if (isValidCodeLine(currCellLines[i])) {
                        before.push(currCellLines[i]);
                    }
                    i -= 1;
                }
                i = cursor.line + 1;
                while (i < currCellLines.length && after.length < afterLineLimit) {
                    if (isValidCodeLine(currCellLines[i])) {
                        after.push(currCellLines[i]);
                    }
                    i += 1;
                }
                var cells = Jupyter.notebook.get_cells();
                var index;
                for (index = cells.length - 1; index >= 0 && cells[index] != currCell; index--);
                requestInfo.request.Autocomplete.region_includes_end = (i == currCellLines.length)
                    && (index == cells.length - 1);
                // need lookup other cells
                if (before.length < beforeLineLimit || after.length < afterLineLimit) {
                    i = index - 1;
                    while (i >= 0 && before.length < beforeLineLimit) {
                        var cellLines = cells[i].get_text().split("\n");
                        var j = cellLines.length - 1;
                        while (j >= 0 && before.length < beforeLineLimit) {
                            if (isValidCodeLine(cellLines[j])) {
                                before.push(cellLines[j]);
                            }
                            j -= 1;
                        }
                        i -= 1;
                    }
                    i = index + 1;
                    var atLineEnd = true;
                    while (i < cells.length && after.length < afterLineLimit) {
                        var cellLines = cells[i].get_text().split("\n");
                        j = 0;
                        atLineEnd = false;
                        while (!atLineEnd && after.length < afterLineLimit) {
                            if (isValidCodeLine(cellLines[j])) {
                                after.push(cellLines[j]);
                            }
                            j += 1;
                            atLineEnd = (j == cellLines.length);
                        }
                        i += 1;
                    }
                requestInfo.request.Autocomplete.region_includes_beginning = before.length == 1;
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
                // var start = currEditor.indexFromPos(cursor);
                // this.completeFrom = currEditor.posFromIndex(start);
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
                    data.results.slice(0, MAX_NUM_HINTS).forEach(function (res) {
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
            var start = completer.start;
            completer.completeFrom = completer.editor.posFromIndex(start);
            if (oldPrefix) {
                oldPrefix = oldPrefix.trim();
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
            var hints = $("#complete").find('.complete-container');
            var editor = completer.editor;
            var currIndex = -1;
            var preIndex;
            completer.isKeyupFired = true;
            completer._handle_keydown = function (comp, event) { // define as member method to handle close
                completer.isKeyupFired = false;
                if (event.keyCode == keycodes.up || event.keyCode == keycodes.tab
                    || event.keyCode == keycodes.down) {
                    event.codemirrorIgnore = true;
                    event._ipkmIgnore = true;
                    event.preventDefault();
                    preIndex = currIndex;
                    currIndex = event.keyCode == keycodes.up ? currIndex - 1 : currIndex + 1;
                    currIndex = currIndex < 0 ?
                        hints.length - 1
                        : (currIndex >= hints.length ?
                            currIndex - hints.length
                            : currIndex);
                    $(hints[currIndex]).css('background', 'lightblue');
                    var completeStr = $(hints[currIndex]).find('.complete-word').text().trim();
                    var cur = editor.getCursor();
                    editor.replaceRange(completeStr, completer.completeFrom, cur);
                    if (preIndex != -1) {
                        $(hints[preIndex]).css('background', '');
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
                    if (!data.old_prefix) {
                        setCompleteLocation(cmp, data.old_prefix);
                    }
                    var results = data.results;
                    var completeContainers = $("#complete").find('.complete-container');
                    var i;
                    // replace current hints first
                    for (i = 0; i < MAX_NUM_HINTS && i < completeContainers.length
                        && i < results.length; i++) {
                        $(completeContainers[i]).find('.complete-word').text(results[i].new_prefix);
                        $(completeContainers[i]).find('.complete-detail').text(results[i].detail);
                    }
                    // add
                    for (; i < MAX_NUM_HINTS && i < results.length; i++) {
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

        function patchCompleterClose() {
            // patch this function to off keyup
            Completer.prototype.close = function () {
                this.done = true;
                $('#complete').remove();
                this.editor.off('keydown', this._handle_keydown);
                // this.editor.off('keypress', this._handle_keypress); disabled since this can be replaced with keydown.
                this.visible = false;
                // before are copied from completer.js
                this.editor.off('keyup', this._handle_key_up);
            };
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

        function load_ipython_extension() {
            addCompleterUpdate();
            patchCellKeyevent();
            patchCompleterClose();
            patchCompleterFinishCompleting();
        }

        return {
            load_ipython_extension: load_ipython_extension
        };
    });
