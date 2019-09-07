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
                    "filename": Jupyter.notebook.notebook_path,
                    "before": "",
                    "after": "",
                    "region_includes_beginning": false,
                    "region_includes_end": false,
                    "max_num_results": 5
                }
            }
        }

        var Cell = cell.Cell;
        var CodeCell = codecell.CodeCell;
        var Completer = completer.Completer;
        var logPrefix = '[' + module.id + ']';
        var doHinting = true;

        function onlyModifierEvent(event) {
            var key = keyboard.inv_keycodes[event.which];
            return (
                (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) &&
                (key === 'alt' || key === 'ctrl' || key === 'meta' || key === 'shift')
            );
        }

        function patchCompleterBuildGuiList() {
            var origCompleterBuildGuiList = Completer.prototype.build_gui_list;
            Completer.prototype.build_gui_list = function (completions) {
                console.info(logPrefix, "invoked");
                var i;
                for (i = 0; i < 50; i++) {
                    console.info(logPrefix, 'type: ', completions[i].type);
                }
                // return origCompleterBuildGuiList.apply(this, arguments);
            };
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

                // compute the optimized position of the complete
                var content = msg.content;
                var start = content.cursor_start;
                var end = content.cursor_end;
                var cur = editor.getCursor();
                if (end == null) {
                    end = editor.indexFromPos(cur);
                    if (start == null) {
                        start = end;
                    } else if (start < 0) {
                        start = end + start;
                    }
                } else {
                    var text = this.editor.getValue();
                    end = utils.char_idx_to_js_idx(end, text);
                    start = utils.char_idx_to_js_idx(start, text);
                }

                var pos = this.editor.cursorCoords(
                    this.editor.posFromIndex(start)
                );
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
                var complete = this.complete;
                requestComplterServer(requestInfo, true, function (data) {
                    data.results.forEach(function (res) {
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
                    var hints = $("#complete").find('.complete-container');
                    $(hints[0]).css('background', 'lightblue');
                });
            };
        }

        function load_ipython_extension() {
            patchCompleterBuildGuiList();
            //  patchCellKeyevent();
            patchCompleterFinishCompleting();
        }

        return {
            load_ipython_extension: load_ipython_extension
        };
    });
