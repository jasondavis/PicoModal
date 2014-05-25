/**
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * A self-contained modal library
 */
(function(window, document) {
    "use strict";

    /** Returns whether a value is a dom node */
    function isNode(value) {
        if ( typeof Node === "object" ) {
            return value instanceof Node;
        }
        else {
            return value &&
                typeof value === "object" &&
                typeof value.nodeType === "number";
        }
    }

    /** Returns whether a value is a string */
    function isString(value) {
        return typeof value === "string";
    }

    /** Memoizes the result of another method */
    function memoize( callback ) {
        var notCalled = true;
        var result;
        return function () {
            if ( notCalled ) {
                result = callback.apply(this, arguments);
                notCalled = false;
            }
            return result;
        };
    }

    /**
     * Generates observable objects that can be watched and triggered
     */
    function observable() {
        var callbacks = [];
        return {
            watch: function(callback) {
                callbacks.push(callback);
            },
            trigger: function( modal ) {
                for (var i = 0; i < callbacks.length; i++) {
                    window.setTimeout(callbacks[i].bind(window, modal), 1);
                }
            }
        };
    }


    /**
     * A small interface for creating and managing a dom element
     */
    function make( parent ) {

        var elem = document.createElement('div');
        (parent || document.body).appendChild(elem);

        var iface = {

            elem: elem,

            /** Creates a child of this node */
            child: function () {
                return make(elem);
            },

            /** Applies a set of styles to an element */
            stylize: function(styles) {
                styles = styles || {};

                if ( typeof styles.opacity !== "undefined" ) {
                    styles.filter =
                        "alpha(opacity=" + (styles.opacity * 100) + ")";
                }

                for (var prop in styles) {
                    if (styles.hasOwnProperty(prop)) {
                        elem.style[prop] = styles[prop];
                    }
                }

                return iface;
            },

            /** Adds a class name */
            clazz: function (clazz) {
                elem.className += clazz;
                return iface;
            },

            /** Sets the HTML */
            html: function (content) {
                if ( isNode(content) ) {
                    elem.appendChild( content );
                }
                else {
                    elem.innerHTML = content;
                }
                return iface;
            },

            /** Returns the width of this element */
            getWidth: function () {
                return elem.clientWidth;
            },

            /** Adds a click handler to this element */
            onClick: function(callback) {
                if (elem.attachEvent) {
                    elem.attachEvent('onclick', callback);
                }
                else {
                    elem.addEventListener('click', callback);
                }
                return iface;
            },

            /** Removes this element from the DOM */
            destroy: function() {
                document.body.removeChild(elem);
            },

            /** Hides this element */
            hide: function() {
                elem.style.display = "none";
            },

            /** Shows this element */
            show: function() {
                elem.style.display = "block";
            }
        };

        return iface;
    }


    /** Generates the grey-out effect */
    function buildOverlay( getOption, close ) {
        return make()
            .clazz("pico-overlay")
            .stylize({
                display: "block",
                position: "fixed",
                top: "0px",
                left: "0px",
                height: "100%",
                width: "100%",
                zIndex: 10000
            })
            .stylize(getOption('overlayStyles', {
                opacity: 0.5,
                background: "#000"
            }))
            .onClick( getOption('overlayClose', true) ? close : function(){} );
    }

    /** Builds the content of a modal */
    function buildModal( getOption ) {
        var elem = make()
            .clazz("pico-content")
            .stylize({
                display: 'block',
                position: 'fixed',
                zIndex: 10001,
                left: "50%",
                top: "50px"
            })
            .html( getOption('content') );

        var width = getOption('width', elem.getWidth());

        elem
            .stylize({
                width: width + "px",
                margin: "0 0 0 " + (-(width / 2) + "px")
            })
            .stylize( getOption('modalStyles', {
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "5px"
            }) );

        return elem;
    }

    /** Builds the close button */
    function buildClose ( elem, getOption, close ) {
        if ( getOption('closeButton', true) ) {
            return elem().child()
                .html( getOption('closeHtml', "&#xD7;") )
                .clazz("pico-close")
                .stylize( getOption('closeStyles', {
                    borderRadius: "2px",
                    cursor: "pointer",
                    height: "15px",
                    width: "15px",
                    position: "absolute",
                    top: "5px",
                    right: "5px",
                    fontSize: "16px",
                    textAlign: "center",
                    lineHeight: "15px",
                    background: "#CCC"
                }) )
                .onClick(close);
        }
    }

    /** Builds a method that calls a method and returns an element */
    function buildElemAccessor( builder ) {
        return function () {
            return builder().elem;
        };
    }


    /**
     * Displays a modal
     */
    function picoModal(options) {

        if ( isString(options) || isNode(options) ) {
            options = { content: options };
        }

        var afterShowEvent = observable();
        var afterCloseEvent = observable();
        var afterCreateEvent = observable();

        /**
         * Returns a named option if it has been explicitly defined. Otherwise,
         * it returns the given default value
         */
        function getOption ( opt, defaultValue ) {
            return options[opt] === void(0) ? defaultValue : options[opt];
        }

        /** Hides this modal */
        function close () {
            shadowElem().hide();
            modalElem().hide();
            afterCloseEvent.trigger(iface);
        }

        /** Wraps a method so it returns the modal interface */
        function returnIface ( callback ) {
            return function () {
                callback.apply(this, arguments);
                return this;
            };
        }

        var modalElem = memoize(function() {
            var elem = buildModal(getOption);
            afterCreateEvent.trigger(iface);
            return elem;
        });

        var shadowElem = memoize(buildOverlay.bind(window, getOption, close));

        var closeElem = memoize(
            buildClose.bind(window, modalElem, getOption, close));

        var iface = {

            /** Returns the wrapping modal element */
            modalElem: buildElemAccessor(modalElem),

            /** Returns the close button element */
            closeElem: buildElemAccessor(closeElem),

            /** Returns the overlay element */
            overalElem: buildElemAccessor(shadowElem),

            /** Shows this modal */
            show: function () {
                shadowElem().show();
                closeElem();
                modalElem().show();
                afterShowEvent.trigger(iface);
                return this;
            },

            /** Hides this modal */
            close: returnIface(close),

            /** Destroys this modal */
            destroy: function () {
                modalElem = modalElem().destroy();
                shadowElem = shadowElem().destroy();
                closeElem = undefined;
            },

            /** Executes after the DOM nodes are created */
            afterCreate: returnIface(afterCreateEvent.watch),

            /** Executes a callback after this modal is shown */
            afterShow: returnIface(afterShowEvent.watch),

            /** Executes a callback after this modal is closed */
            afterClose: returnIface(afterCloseEvent.watch)
        };

        return iface;
    }

    window.picoModal = picoModal;

}(window, document));
