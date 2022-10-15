(function ($) {
    var g = new RegExp('(\\' + ['/', '.', '*', '+', '?', '|', '(', ')', '[', ']', '{', '}', '\\'].join('|\\') + ')', 'g');

    function fnFormatResult(a, b, c) {
        var d = '(' + c.replace(g, '\\$1') + ')';
        return a.replace(new RegExp(d, 'gi'), '<strong>$1<\/strong>')
    }

    function Autocomplete(a, b) {
        this.el = $(a);
        this.el.attr('autocomplete', 'off');
        this.suggestions = [];
        this.data = [];
        this.aStatus = [];
        this.badQueries = [];
        this.selectedIndex = -1;
        this.currentValue = this.isFormField() ? this.el.val() : this.el.html()
        this.intervalId = 0;
        this.cachedResponse = [];
        this.onChangeInterval = null;
        this.ignoreValueChange = false;
        this.serviceUrl = b.serviceUrl;
        this.isLocal = false;
        this.options = {
            autoSubmit: false,
            minChars: 1,
            maxHeight: 300,
            deferRequestBy: 0,
            width: 300,
            highlight: true,
            params: {},
            fnFormatResult: fnFormatResult,
            delimiter: null,
            zIndex: 9999
        };
        this.initialize();
        this.setOptions(b);
        this.clearCache()
    }

    $.fn.autocomplete = function (a) {
        return new Autocomplete(this.get(0) || $('<input />'), a)
    };
    Autocomplete.prototype = {
        killerFn: null,
        initialize: function () {
            var a, uid, autocompleteElId;
            a = this;
            uid = Math.floor(Math.random() * 0x100000).toString(16);
            autocompleteElId = 'Autocomplete_' + uid;
            this.killerFn = function (e) {
                if ($(e.target).parents('.autocomplete').length === 0) {
                    a.killSuggestions();
                    a.disableKillerFn()
                }
            };
            // if (!this.options.width) {

            if (parseInt(this.el.width()) < 100) {
                // console.log(parseInt(this.el.width()));
            } else {
                this.options.width = this.el.width() + 30
            }

            // }
            this.mainContainerId = 'AutocompleteContainter_' + uid;
            $('<div id="' + this.mainContainerId + '" style="position:absolute;z-index:100000;"><div class="autocomplete-w1"><div class="autocomplete" id="' + autocompleteElId + '" style="display:none; width:300px;"></div></div></div>').appendTo('body');
            this.container = $('#' + autocompleteElId);
            this.fixPosition();
            if (window.opera) {
                this.el.keypress(function (e) {
                    a.onKeyPress(e)
                })
            } else {
                this.el.keydown(function (e) {
                    a.onKeyPress(e)
                })
            }
            this.el.keyup(function (e) {
                a.onKeyUp(e)
            });
            this.el.blur(function () {
                a.enableKillerFn()
            });
            this.el.focus(function () {
                a.fixPosition()
            })
        },
        setOptions: function (a) {
            var o = this.options;
            $.extend(o, a);
            if (o.lookup) {
                this.isLocal = true;
                if ($.isArray(o.lookup)) {
                    o.lookup = {
                        suggestions: o.lookup,
                        data: [],
                        aStatus: []
                    }
                }
            }
            $('#' + this.mainContainerId).css({
                zIndex: 100000
            });
            this.container.css({
                maxHeight: o.maxHeight + 'px',
                width: o.width
            })
        },
        clearCache: function () {
            this.cachedResponse = [];
            this.badQueries = []
        },
        disable: function () {
            this.disabled = true
        },
        enable: function () {
            this.disabled = false
        },
        fixPosition: function () {
            var a = this.el.offset();
            $('#' + this.mainContainerId).css({
                top: (a.top + this.el.innerHeight()) + 'px',
                left: a.left + 'px'
            })
        },
        enableKillerFn: function () {
            this.el.removeClass('autocomplete-loading')
            var a = this;
            $(document).bind('click', a.killerFn)
        },
        disableKillerFn: function () {
            var a = this;
            $(document).unbind('click', a.killerFn)
        },
        killSuggestions: function () {
            this.el.removeClass('autocomplete-loading')
            var a = this
            this.stopKillSuggestions()
            this.intervalId = window.setInterval(function () {
                a.hide()
                a.stopKillSuggestions()
            }, 300)
        },
        stopKillSuggestions: function () {
            this.el.removeClass('autocomplete-loading')
            window.clearInterval(this.intervalId)
        },
        onKeyPress: function (e) {
            if (this.disabled || !this.enabled) {
                return
            }
            switch (e.keyCode) {
                case 27:
                    this.el.val(this.currentValue);
                    this.hide();
                    break;
                case 9:
                case 13:
                    if (this.selectedIndex === -1) {
                        this.hide();
                        return
                    }
                    this.select(this.selectedIndex);
                    if (e.keyCode === 9) {
                        return
                    }
                    break;
                case 38:
                    this.moveUp();
                    break;
                case 40:
                    this.moveDown();
                    break;
                default:
                    return
            }
            e.stopImmediatePropagation();
            e.preventDefault()
        },
        onKeyUp: function (e) {
            if (this.disabled) {
                return
            }
            switch (e.keyCode) {
                case 38:
                case 40:
                    return
            }
            clearInterval(this.onChangeInterval);
            var value = this.isFormField() ? this.el.val() : this.el.html()

            if (this.currentValue !== value) {
                if (this.options.deferRequestBy > 0) {
                    var a = this;
                    this.onChangeInterval = setInterval(function () {
                        a.onValueChange()
                    }, this.options.deferRequestBy)
                } else {
                    this.onValueChange()
                }
            }
        },
        isFormField: function () {
            return this.el.is('input') || this.el.is('textarea')
        },
        onValueChange: function () {
            clearInterval(this.onChangeInterval)
            this.currentValue = this.isFormField() ? this.el.val() : this.el.html()
            var q = this.getQuery(this.currentValue)
            this.selectedIndex = -1
            if (this.ignoreValueChange) {
                this.ignoreValueChange = false
                return
            }
            if (this.options.minChars == 0) {
                this.el.addClass('autocomplete-loading')
                this.getSuggestions(q)
            } else if (('' === q) || (q.length < this.options.minChars)) {
                this.el.removeClass('autocomplete-loading')
                this.hide()
            } else {
                this.getSuggestions(q)
                this.el.addClass('autocomplete-loading')
            }

        },
        getQuery: function (a) {
            var d, arr;
            d = this.options.delimiter;
            if (!d) {
                return $.trim(a)
            }
            arr = a.split(d);
            return $.trim(arr[arr.length - 1])
        },
        getSuggestionsLocal: function (q) {
            var a, arr, len, val, i
            arr = this.options.lookup
            len = arr.suggestions.length
            a = {
                suggestions: [],
                data: [],
                aStatus: []
            };
            q = q.toLowerCase();
            for (i = 0; i < len; i++) {
                val = arr.suggestions[i];
                if (val.toLowerCase().indexOf(q) === 0) {
                    a.suggestions.push(val)
                    a.data.push(arr.data[i])
                    a.aStatus.push(arr.aStatus[i])
                }
            }
            this.el.removeClass('autocomplete-loading')
            return a
        },
        getSuggestions: function (q) {
            this.el.addClass('autocomplete-loading')
            var b, me;
            b = this.isLocal ? this.getSuggestionsLocal(q) : this.cachedResponse[q];
            if (b && $.isArray(b.suggestions)) {
                this.suggestions = b.suggestions;
                this.data = b.data;
                this.aStatus = b.aStatus;
                this.suggest()
            } else if (!this.isBadQuery(q)) {
                me = this;
                me.options.params.query = q;
                $.get(this.serviceUrl, me.options.params, function (a) {
                    me.processResponse(a)
                }, 'text')
            } else {
                //  setTimeout(this.el.removeClass('autocomplete-loading'), 500);
            }
        },
        isBadQuery: function (q) {
            var i = this.badQueries.length;
            while (i--) {
                if (q.indexOf(this.badQueries[i]) === 0) {
                    return true
                }
            }
            return false
        },
        hide: function () {
            this.enabled = false;
            this.selectedIndex = -1;
            this.container.hide()
        },
        suggest: function () {
            if (0 === this.suggestions.length)
                return this.hide()
            //  console.log(this);
            // console.log(this.el);
            // console.log(this.el.hasClass("autocomplete-loading111"));
            //  if (this.el.hasClass("autocomplete-loading")) {
            //  setTimeout(this.el.removeClass('autocomplete-loading'), 200);
            //  }
            //setTimeout(this.el.removeClass('autocomplete-loading'), 200)
            width = 300
            var b, len, div, f, v, i, s, mOver, mClick
            b = this
            len = this.suggestions.length
            f = this.options.fnFormatResult
            v = this.getQuery(this.currentValue)
            mOver = function (a) {
                return function () {
                    b.activate(a)
                }
            };
            mClick = function (a) {
                return function () {
                    b.select(a)
                }
            };
            this.container.hide().empty()
            for (i = 0; i < len; i++) {
                var c = 1,
                    clsName = '';
                s = replaceXMLProcess(this.suggestions[i])
                c = this.aStatus[i];
                if (c == 0) {
                    clsName = 'red'
                }
                if (clsName != '') {
                    div = $((b.selectedIndex === i ? '<div class="selected"' : '<div') + ' title="' + s + '" class="' + clsName + '">' + f(s, this.data[i], v) + '</div>')
                } else {
                    div = $((b.selectedIndex === i ? '<div class="selected"' : '<div') + ' title="' + s + '">' + f(s, this.data[i], v) + '</div>')
                }
                div.mouseover(mOver(i))
                div.click(mClick(i))
                this.container.append(div)
            }
            this.enabled = true
            this.container.show()
            width = this.el.width()
            if (this.options.width) {
                width = this.options.width
            }
            this.container.css({
                width: width + 'px'
            })
            this.el.removeClass('autocomplete-loading')
        },
        processResponse: function (a) {
            var b;
            try {
                b = eval('(' + a + ')')
            } catch (err) {
                //setTimeout(this.el.removeClass('autocomplete-loading'), 200);
                return
            }
            if (!$.isArray(b.data)) {
                b.data = []
            }
            if (!$.isArray(b.aStatus)) {
                b.aStatus = []
            }
            if (!this.options.noCache) {
                this.cachedResponse[b.query] = b;
                if (b.suggestions.length === 0) {
                    this.badQueries.push(b.query)
                }
            }
            if (b.query === this.getQuery(this.currentValue)) {
                this.suggestions = b.suggestions;
                this.data = b.data;
                this.aStatus = b.aStatus;
                this.suggest();
            }
            this.el.removeClass('autocomplete-loading')
        },
        activate: function (a) {
            var b, activeItem;
            b = this.container.children();
            if (this.selectedIndex !== -1 && b.length > this.selectedIndex) {
                if (this.aStatus[this.selectedIndex] == 0) {
                } else {
                    $(b.get(this.selectedIndex)).removeClass('selected')
                }
            }
            this.selectedIndex = a;
            if (this.selectedIndex !== -1 && b.length > this.selectedIndex) {
                activeItem = b.get(this.selectedIndex);
                if (this.aStatus[this.selectedIndex] == 0) {
                } else {
                    $(activeItem).addClass('selected')
                }
            }
            this.el.removeClass('autocomplete-loading')
            return activeItem
        },
        deactivate: function (a, b) {
            a.className = '';
            if (this.selectedIndex === b) {
                this.selectedIndex = -1
            }
        },
        select: function (i) {
            var a, f
            a = this.suggestions[i]
            if (a) {
                this.el.val(a)
                if (this.options.autoSubmit) {
                    f = this.el.parents('form')
                    if (f.length > 0) {
                        f.get(0).submit()
                    }
                }
                this.ignoreValueChange = true
                this.hide()
                this.onSelect(i)
                this.el.removeClass('autocomplete-loading')
            }
        },
        moveUp: function () {
            if (this.selectedIndex === -1) {
                return
            }
            if (this.selectedIndex === 0) {
                this.container.children().get(0).className = '';
                this.selectedIndex = -1;
                this.el.val(this.currentValue);
                return
            }
            this.adjustScroll(this.selectedIndex - 1)
        },
        moveDown: function () {
            if (this.selectedIndex === (this.suggestions.length - 1)) {
                return
            }
            this.adjustScroll(this.selectedIndex + 1)
        },
        adjustScroll: function (i) {
            var a, offsetTop, upperBound, lowerBound;
            a = this.activate(i);
            offsetTop = a.offsetTop;
            upperBound = this.container.scrollTop();
            lowerBound = upperBound + this.options.maxHeight - 25;
            if (offsetTop < upperBound) {
                this.container.scrollTop(offsetTop)
            } else if (offsetTop > lowerBound) {
                this.container.scrollTop(offsetTop - this.options.maxHeight + 25)
            }
            this.el.val(this.getValue(this.suggestions[i]))
        },
        onSelect: function (i) {
            var a, fn, s, d;
            a = this;
            fn = a.options.onSelect;
            s = a.suggestions[i];
            d = a.data[i];
            a.el.val(a.getValue(s));
            if ($.isFunction(fn)) {
                fn(s, d, a.el)
            }
        },
        getValue: function (a) {
            var b, currVal, arr, me;
            me = this;
            b = me.options.delimiter;
            if (!b) {
                return a
            }
            currVal = me.currentValue;
            arr = currVal.split(b);
            if (arr.length === 1) {
                return a
            }
            return currVal.substr(0, currVal.length - arr[arr.length - 1].length) + a
        }
    }
}(jQuery));
