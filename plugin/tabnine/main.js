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
        var assistDelay = 20;
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
                url: 'http://127.0.0.1:9999/',
                type: 'post',
                async: isAsync,
                dataType: 'json',
                headers: {
                    'Content-Type': 'text/plain'
                },
                data: JSON.stringify(requestData),
                success: function (data, status, xhr) {
                    handleResData(data);
                },
                error: function (request, status, error) {
                    console.info(logPrefix, "request failed: ", error);
                }
            });
        }

        function patchCompleterFinishCompleting() {
            var origCompleterFinishCompleting = Completer.prototype.finish_completing;
            Completer.prototype.finish_completing = function (msg) {
                if (this.visible) {
                    console.info(logPrefix, 'complete is visible, ignore by just return');
                    return;
                }
                var currCellIndex = Jupyter.notebook.find_cell_index(this.cell);
                var cells = Jupyter.notebook.get_cells();
                console.log(logPrefix, 'num cells: ', cells.length);
                console.log(logPrefix, 'currCellIndex: ', currCellIndex);
                var before = "";
                var i;
                for (i = 0; i < currCellIndex; i++) {
                    if (cells[i] instanceof CodeCell) {
                        var text = cells[i].get_text();
                        if (text.length > 0 && text.charAt(0) != '!') {
                            before += text + "\n";
                        }
                    }
                }
                var editor = this.editor;
                var cur = editor.getCursor()
                var text = editor.getValue();
                before += editor.getRange({ line: 0, ch: 0 }, cur);
                requestInfo.request.Autocomplete.before = before;
                this.complete = $('<div/>').addClass('completions complete-dropdown-content');
                this.complete.attr('id', 'complete');
                $('body').append(this.complete);
                this.visible = true;
                var cur = editor.getCursor();
                var start = editor.indexFromPos(cur);
                // console.log(logPrefix, 'start: ', start);
                this.completeFrom = this.editor.posFromIndex(start);

                var pos = this.editor.cursorCoords(
                    this.completeFrom
                );
                // console.log(logPrefix, 'pos: ', pos);
                var left = pos.left - 3;
                var top;
                var cheight = this.complete.height();
                var wheight = $(window).height();
                if (pos.bottom + cheight + 5 > wheight) {
                    top = pos.top - cheight - 4;
                } else {
                    top = pos.bottom + 1;
                }

                this.complete.css({
                    'left': left + 'px',
                    'top': top + 'px',
                })

                // get completions
                var cmp = this;
                requestComplterServer(requestInfo, true, function (data) {
                    console.info(logPrefix, "data: ", data);
                    var complete = cmp.complete;
                    if (data.results.length == 0) {
                        cmp.close();
                        return;
                    }

                    if (data.old_prefix) {
                        cmp.completeFrom.ch -= data.old_prefix.length;
                    }

                    var pos = cmp.editor.cursorCoords(
                        cmp.completeFrom
                    );

                    var left = pos.left - 3;
                    var top;
                    var cheight = cmp.complete.height();
                    var wheight = $(window).height();
                    if (pos.bottom + cheight + 5 > wheight) {
                        top = pos.top - cheight - 4;
                    } else {
                        top = pos.bottom + 1;
                    }

                    cmp.complete.css({
                        'left': left + 'px',
                        'top': top + 'px',
                    })

                    data.results.slice(0, MAX_NUM_HINTS).forEach(function (res) {
                        var hintsContainer = $('<div/>')
                            .addClass('complete-container');
                        var wordContainer = $('<div/>')
                            .addClass('complete-block')
                            .addClass('complete-word')
                            .text(res.new_prefix);
                        hintsContainer.append(wordContainer);
                        var probContainer = $('<div/>')
                            .addClass('complete-block')
                            .addClass('complete-prob')
                            .text(res.detail)
                        hintsContainer.append(probContainer);
                        complete.append(hintsContainer);
                    });
                    addKeyeventListeners(cmp);
                });
                return true;
            };
        }

        function addKeyeventListeners(completer) {
            var hints = $("#complete").find('.complete-container');
            var editor = completer.editor;
            var currIndex = -1;
            var preIndex;
            completer._handle_keydown = function (comp, event) { // define as member method to handle close
                if (event.keyCode == keycodes.up || event.keyCode == keycodes.tab
                    || event.keyCode == keycodes.down) {
                    if (!completer.visible) {
                        return;
                    }
                    event.codemirrorIgnore = true;
                    event._ipkmIgnore = true;
                    event.preventDefault();
                    switch (event.keyCode) {
                        case keycodes.down:
                        case keycodes.tab:
                            preIndex = currIndex;
                            currIndex += 1;
                            break;
                        case keycodes.up:
                            preIndex = currIndex;
                            currIndex -= 1;
                            break;
                    }
                    currIndex = currIndex < 0 ?
                        hints.length - 1
                        : (currIndex >= hints.length ?
                            currIndex - hints.length
                            : currIndex);
                    $(hints[currIndex]).css('background', 'lightblue');
                    var completeStr = $(hints[currIndex]).find('.complete-word').text();
                    var cur = editor.getCursor();
                    editor.replaceRange(completeStr, completer.completeFrom, cur);
                    if (preIndex != -1) {
                        $(hints[preIndex]).css('background', '');
                    }
                } else if (event.keyCode == keycodes.esc ||
                    event.keyCode == keycodes.enter) {
                    event.codemirrorIgnore = true;
                    event._ipkmIgnore = true;
                    event.preventDefault();
                    completer.close();
                } else {
                    completer.close();
                }
            }

            editor.on('keydown', completer._handle_keydown);

            completer._handle_keypress = function (comp, event) {
                var code = event.keyCode;
                if (event.charCode == 0 ||
                    code == keycodes.tab ||
                    code == keycodes.enter ||
                    code == keycodes.up ||
                    code == keycodes.down
                ) return;
                completer.close();
                completer.editor.focus();
                console.log(logPrefix, 'keypress', event.keyCode);
            }
            editor.on('keypress', completer._handle_keypress);
        }

        function patchCellKeyevent() {
            var origHandleCodemirrorKeyEvent = Cell.prototype.handle_codemirror_keyevent;
            Cell.prototype.handle_codemirror_keyevent = function (editor, event) {
                if (assistActive && (this instanceof CodeCell) && !onlyModifierEvent(event)) {
                    this.tooltip.remove_and_cancel_tooltip();

                    if (!editor.somethingSelected() &&
                        editor.getSelections().length <= 1 &&
                        !this.completer.visible &&
                        specials.indexOf(event.keyCode) == -1) {
                        var cell = this;
                        cell.completer.startCompletion();
                        setTimeout(function () {
                            cell.completer.startCompletion();
                        }, assistDelay)
                    }
                }
            }
        }

        function load_ipython_extension() {
            patchCellKeyevent();
            patchCompleterFinishCompleting();
        }

        return {
            load_ipython_extension: load_ipython_extension
        };
    });
