/*
 Copyright 2013-2014 Daniel Wirtz <dcode@dcode.io>

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */
/**
 * @license bytebuffer.js (c) 2015 Daniel Wirtz <dcode@dcode.io>
 * Backing buffer: ArrayBuffer, Accessor: Uint8Array
 * Released under the Apache License, Version 2.0
 * see: https://github.com/dcodeIO/bytebuffer.js for details
 */
(function (global, factory) {
    /* AMD */ if (typeof define === 'function' && define["amd"])
        define(["long"], factory);
    else if (typeof require === 'function' && typeof module === "object" && module && module["exports"])
        module['exports'] = (function () {
            var Long;
            try {
                Long = require("long");
            }
            catch (e) { }
            return factory(Long);
        })();
    else
        (global["dcodeIO"] = global["dcodeIO"] || {})["ByteBuffer"] = factory(global["dcodeIO"]["Long"]);
})(this, function (Long) {
    "use strict";
    /**
     * Constructs a new ByteBuffer.
     * @class The swiss army knife for binary data in JavaScript.
     * @exports ByteBuffer
     * @constructor
     * @param {number=} capacity Initial capacity. Defaults to {@link ByteBuffer.DEFAULT_CAPACITY}.
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @expose
     */
    var ByteBuffer = function (capacity, littleEndian, noAssert) {
        if (typeof capacity === 'undefined')
            capacity = ByteBuffer.DEFAULT_CAPACITY;
        if (typeof littleEndian === 'undefined')
            littleEndian = ByteBuffer.DEFAULT_ENDIAN;
        if (typeof noAssert === 'undefined')
            noAssert = ByteBuffer.DEFAULT_NOASSERT;
        if (!noAssert) {
            capacity = capacity | 0;
            if (capacity < 0)
                throw RangeError("Illegal capacity");
            littleEndian = !!littleEndian;
            noAssert = !!noAssert;
        }
        /**
         * Backing ArrayBuffer.
         * @type {!ArrayBuffer}
         * @expose
         */
        this.buffer = capacity === 0 ? EMPTY_BUFFER : new ArrayBuffer(capacity);
        /**
         * Uint8Array utilized to manipulate the backing buffer. Becomes `null` if the backing buffer has a capacity of `0`.
         * @type {?Uint8Array}
         * @expose
         */
        this.view = capacity === 0 ? null : new Uint8Array(this.buffer);
        /**
         * Absolute read/write offset.
         * @type {number}
         * @expose
         * @see ByteBuffer#flip
         * @see ByteBuffer#clear
         */
        this.offset = 0;
        /**
         * Marked offset.
         * @type {number}
         * @expose
         * @see ByteBuffer#mark
         * @see ByteBuffer#reset
         */
        this.markedOffset = -1;
        /**
         * Absolute limit of the contained data. Set to the backing buffer's capacity upon allocation.
         * @type {number}
         * @expose
         * @see ByteBuffer#flip
         * @see ByteBuffer#clear
         */
        this.limit = capacity;
        /**
         * Whether to use little endian byte order, defaults to `false` for big endian.
         * @type {boolean}
         * @expose
         */
        this.littleEndian = littleEndian;
        /**
         * Whether to skip assertions of offsets and values, defaults to `false`.
         * @type {boolean}
         * @expose
         */
        this.noAssert = noAssert;
    };
    /**
     * ByteBuffer version.
     * @type {string}
     * @const
     * @expose
     */
    ByteBuffer.VERSION = "5.0.1";
    /**
     * Little endian constant that can be used instead of its boolean value. Evaluates to `true`.
     * @type {boolean}
     * @const
     * @expose
     */
    ByteBuffer.LITTLE_ENDIAN = true;
    /**
     * Big endian constant that can be used instead of its boolean value. Evaluates to `false`.
     * @type {boolean}
     * @const
     * @expose
     */
    ByteBuffer.BIG_ENDIAN = false;
    /**
     * Default initial capacity of `16`.
     * @type {number}
     * @expose
     */
    ByteBuffer.DEFAULT_CAPACITY = 16;
    /**
     * Default endianess of `false` for big endian.
     * @type {boolean}
     * @expose
     */
    ByteBuffer.DEFAULT_ENDIAN = ByteBuffer.BIG_ENDIAN;
    /**
     * Default no assertions flag of `false`.
     * @type {boolean}
     * @expose
     */
    ByteBuffer.DEFAULT_NOASSERT = false;
    /**
     * A `Long` class for representing a 64-bit two's-complement integer value. May be `null` if Long.js has not been loaded
     *  and int64 support is not available.
     * @type {?Long}
     * @const
     * @see https://github.com/dcodeIO/long.js
     * @expose
     */
    ByteBuffer.Long = Long || null;
    /**
     * @alias ByteBuffer.prototype
     * @inner
     */
    var ByteBufferPrototype = ByteBuffer.prototype;
    /**
     * An indicator used to reliably determine if an object is a ByteBuffer or not.
     * @type {boolean}
     * @const
     * @expose
     * @private
     */
    ByteBufferPrototype.__isByteBuffer__;
    Object.defineProperty(ByteBufferPrototype, "__isByteBuffer__", {
        value: true,
        enumerable: false,
        configurable: false
    });
    // helpers
    /**
     * @type {!ArrayBuffer}
     * @inner
     */
    var EMPTY_BUFFER = new ArrayBuffer(0);
    /**
     * String.fromCharCode reference for compile-time renaming.
     * @type {function(...number):string}
     * @inner
     */
    var stringFromCharCode = String.fromCharCode;
    /**
     * Creates a source function for a string.
     * @param {string} s String to read from
     * @returns {function():number|null} Source function returning the next char code respectively `null` if there are
     *  no more characters left.
     * @throws {TypeError} If the argument is invalid
     * @inner
     */
    function stringSource(s) {
        var i = 0;
        return function () {
            return i < s.length ? s.charCodeAt(i++) : null;
        };
    }
    /**
     * Creates a destination function for a string.
     * @returns {function(number=):undefined|string} Destination function successively called with the next char code.
     *  Returns the final string when called without arguments.
     * @inner
     */
    function stringDestination() {
        var cs = [], ps = [];
        return function () {
            if (arguments.length === 0)
                return ps.join('') + stringFromCharCode.apply(String, cs);
            if (cs.length + arguments.length > 1024)
                ps.push(stringFromCharCode.apply(String, cs)),
                    cs.length = 0;
            Array.prototype.push.apply(cs, arguments);
        };
    }
    /**
     * Gets the accessor type.
     * @returns {Function} `Buffer` under node.js, `Uint8Array` respectively `DataView` in the browser (classes)
     * @expose
     */
    ByteBuffer.accessor = function () {
        return Uint8Array;
    };
    /**
     * Allocates a new ByteBuffer backed by a buffer of the specified capacity.
     * @param {number=} capacity Initial capacity. Defaults to {@link ByteBuffer.DEFAULT_CAPACITY}.
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @returns {!ByteBuffer}
     * @expose
     */
    ByteBuffer.allocate = function (capacity, littleEndian, noAssert) {
        return new ByteBuffer(capacity, littleEndian, noAssert);
    };
    /**
     * Concatenates multiple ByteBuffers into one.
     * @param {!Array.<!ByteBuffer|!ArrayBuffer|!Uint8Array|string>} buffers Buffers to concatenate
     * @param {(string|boolean)=} encoding String encoding if `buffers` contains a string ("base64", "hex", "binary",
     *  defaults to "utf8")
     * @param {boolean=} littleEndian Whether to use little or big endian byte order for the resulting ByteBuffer. Defaults
     *  to {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values for the resulting ByteBuffer. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @returns {!ByteBuffer} Concatenated ByteBuffer
     * @expose
     */
    ByteBuffer.concat = function (buffers, encoding, littleEndian, noAssert) {
        if (typeof encoding === 'boolean' || typeof encoding !== 'string') {
            noAssert = littleEndian;
            littleEndian = encoding;
            encoding = undefined;
        }
        var capacity = 0;
        for (var i = 0, k = buffers.length, length; i < k; ++i) {
            if (!ByteBuffer.isByteBuffer(buffers[i]))
                buffers[i] = ByteBuffer.wrap(buffers[i], encoding);
            length = buffers[i].limit - buffers[i].offset;
            if (length > 0)
                capacity += length;
        }
        if (capacity === 0)
            return new ByteBuffer(0, littleEndian, noAssert);
        var bb = new ByteBuffer(capacity, littleEndian, noAssert), bi;
        i = 0;
        while (i < k) {
            bi = buffers[i++];
            length = bi.limit - bi.offset;
            if (length <= 0)
                continue;
            bb.view.set(bi.view.subarray(bi.offset, bi.limit), bb.offset);
            bb.offset += length;
        }
        bb.limit = bb.offset;
        bb.offset = 0;
        return bb;
    };
    /**
     * Tests if the specified type is a ByteBuffer.
     * @param {*} bb ByteBuffer to test
     * @returns {boolean} `true` if it is a ByteBuffer, otherwise `false`
     * @expose
     */
    ByteBuffer.isByteBuffer = function (bb) {
        return (bb && bb["__isByteBuffer__"]) === true;
    };
    /**
     * Gets the backing buffer type.
     * @returns {Function} `Buffer` under node.js, `ArrayBuffer` in the browser (classes)
     * @expose
     */
    ByteBuffer.type = function () {
        return ArrayBuffer;
    };
    /**
     * Wraps a buffer or a string. Sets the allocated ByteBuffer's {@link ByteBuffer#offset} to `0` and its
     *  {@link ByteBuffer#limit} to the length of the wrapped data.
     * @param {!ByteBuffer|!ArrayBuffer|!Uint8Array|string|!Array.<number>} buffer Anything that can be wrapped
     * @param {(string|boolean)=} encoding String encoding if `buffer` is a string ("base64", "hex", "binary", defaults to
     *  "utf8")
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @returns {!ByteBuffer} A ByteBuffer wrapping `buffer`
     * @expose
     */
    ByteBuffer.wrap = function (buffer, encoding, littleEndian, noAssert) {
        if (typeof encoding !== 'string') {
            noAssert = littleEndian;
            littleEndian = encoding;
            encoding = undefined;
        }
        if (typeof buffer === 'string') {
            if (typeof encoding === 'undefined')
                encoding = "utf8";
            switch (encoding) {
                case "base64":
                    return ByteBuffer.fromBase64(buffer, littleEndian);
                case "hex":
                    return ByteBuffer.fromHex(buffer, littleEndian);
                case "binary":
                    return ByteBuffer.fromBinary(buffer, littleEndian);
                case "utf8":
                    return ByteBuffer.fromUTF8(buffer, littleEndian);
                case "debug":
                    return ByteBuffer.fromDebug(buffer, littleEndian);
                default:
                    throw Error("Unsupported encoding: " + encoding);
            }
        }
        if (buffer === null || typeof buffer !== 'object')
            throw TypeError("Illegal buffer");
        var bb;
        if (ByteBuffer.isByteBuffer(buffer)) {
            bb = ByteBufferPrototype.clone.call(buffer);
            bb.markedOffset = -1;
            return bb;
        }
        if (buffer instanceof Uint8Array) {
            bb = new ByteBuffer(0, littleEndian, noAssert);
            if (buffer.length > 0) {
                bb.buffer = buffer.buffer;
                bb.offset = buffer.byteOffset;
                bb.limit = buffer.byteOffset + buffer.byteLength;
                bb.view = new Uint8Array(buffer.buffer);
            }
        }
        else if (buffer instanceof ArrayBuffer) {
            bb = new ByteBuffer(0, littleEndian, noAssert);
            if (buffer.byteLength > 0) {
                bb.buffer = buffer;
                bb.offset = 0;
                bb.limit = buffer.byteLength;
                bb.view = buffer.byteLength > 0 ? new Uint8Array(buffer) : null;
            }
        }
        else if (Object.prototype.toString.call(buffer) === "[object Array]") {
            bb = new ByteBuffer(buffer.length, littleEndian, noAssert);
            bb.limit = buffer.length;
            for (var i = 0; i < buffer.length; ++i)
                bb.view[i] = buffer[i];
        }
        else
            throw TypeError("Illegal buffer"); // Otherwise fail
        return bb;
    };
    /**
     * Writes the array as a bitset.
     * @param {Array<boolean>} value Array of booleans to write
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `length` if omitted.
     * @returns {!ByteBuffer}
     * @expose
     */
    ByteBufferPrototype.writeBitSet = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (!(value instanceof Array))
                throw TypeError("Illegal BitSet: Not an array");
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        var start = offset, bits = value.length, bytes = (bits >> 3), bit = 0, k;
        offset += this.writeVarint32(bits, offset);
        while (bytes--) {
            k = (!!value[bit++] & 1) |
                ((!!value[bit++] & 1) << 1) |
                ((!!value[bit++] & 1) << 2) |
                ((!!value[bit++] & 1) << 3) |
                ((!!value[bit++] & 1) << 4) |
                ((!!value[bit++] & 1) << 5) |
                ((!!value[bit++] & 1) << 6) |
                ((!!value[bit++] & 1) << 7);
            this.writeByte(k, offset++);
        }
        if (bit < bits) {
            var m = 0;
            k = 0;
            while (bit < bits)
                k = k | ((!!value[bit++] & 1) << (m++));
            this.writeByte(k, offset++);
        }
        if (relative) {
            this.offset = offset;
            return this;
        }
        return offset - start;
    };
    /**
     * Reads a BitSet as an array of booleans.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `length` if omitted.
     * @returns {Array<boolean>
     * @expose
     */
    ByteBufferPrototype.readBitSet = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        var ret = this.readVarint32(offset), bits = ret.value, bytes = (bits >> 3), bit = 0, value = [], k;
        offset += ret.length;
        while (bytes--) {
            k = this.readByte(offset++);
            value[bit++] = !!(k & 0x01);
            value[bit++] = !!(k & 0x02);
            value[bit++] = !!(k & 0x04);
            value[bit++] = !!(k & 0x08);
            value[bit++] = !!(k & 0x10);
            value[bit++] = !!(k & 0x20);
            value[bit++] = !!(k & 0x40);
            value[bit++] = !!(k & 0x80);
        }
        if (bit < bits) {
            var m = 0;
            k = this.readByte(offset++);
            while (bit < bits)
                value[bit++] = !!((k >> (m++)) & 1);
        }
        if (relative) {
            this.offset = offset;
        }
        return value;
    };
    /**
     * Reads the specified number of bytes.
     * @param {number} length Number of bytes to read
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `length` if omitted.
     * @returns {!ByteBuffer}
     * @expose
     */
    ByteBufferPrototype.readBytes = function (length, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + length > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + length + ") <= " + this.buffer.byteLength);
        }
        var slice = this.slice(offset, offset + length);
        if (relative)
            this.offset += length;
        return slice;
    };
    /**
     * Writes a payload of bytes. This is an alias of {@link ByteBuffer#append}.
     * @function
     * @param {!ByteBuffer|!ArrayBuffer|!Uint8Array|string} source Data to write. If `source` is a ByteBuffer, its offsets
     *  will be modified according to the performed read operation.
     * @param {(string|number)=} encoding Encoding if `data` is a string ("base64", "hex", "binary", defaults to "utf8")
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeBytes = ByteBufferPrototype.append;
    // types/ints/int8
    /**
     * Writes an 8bit signed integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeInt8 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value |= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 1;
        var capacity0 = this.buffer.byteLength;
        if (offset > capacity0)
            this.resize((capacity0 *= 2) > offset ? capacity0 : offset);
        offset -= 1;
        this.view[offset] = value;
        if (relative)
            this.offset += 1;
        return this;
    };
    /**
     * Writes an 8bit signed integer. This is an alias of {@link ByteBuffer#writeInt8}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeByte = ByteBufferPrototype.writeInt8;
    /**
     * Reads an 8bit signed integer.
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readInt8 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 1 + ") <= " + this.buffer.byteLength);
        }
        var value = this.view[offset];
        if ((value & 0x80) === 0x80)
            value = -(0xFF - value + 1); // Cast to signed
        if (relative)
            this.offset += 1;
        return value;
    };
    /**
     * Reads an 8bit signed integer. This is an alias of {@link ByteBuffer#readInt8}.
     * @function
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readByte = ByteBufferPrototype.readInt8;
    /**
     * Writes an 8bit unsigned integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeUint8 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value >>>= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 1;
        var capacity1 = this.buffer.byteLength;
        if (offset > capacity1)
            this.resize((capacity1 *= 2) > offset ? capacity1 : offset);
        offset -= 1;
        this.view[offset] = value;
        if (relative)
            this.offset += 1;
        return this;
    };
    /**
     * Writes an 8bit unsigned integer. This is an alias of {@link ByteBuffer#writeUint8}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeUInt8 = ByteBufferPrototype.writeUint8;
    /**
     * Reads an 8bit unsigned integer.
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readUint8 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 1 + ") <= " + this.buffer.byteLength);
        }
        var value = this.view[offset];
        if (relative)
            this.offset += 1;
        return value;
    };
    /**
     * Reads an 8bit unsigned integer. This is an alias of {@link ByteBuffer#readUint8}.
     * @function
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readUInt8 = ByteBufferPrototype.readUint8;
    // types/ints/int16
    /**
     * Writes a 16bit signed integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @throws {TypeError} If `offset` or `value` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.writeInt16 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value |= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 2;
        var capacity2 = this.buffer.byteLength;
        if (offset > capacity2)
            this.resize((capacity2 *= 2) > offset ? capacity2 : offset);
        offset -= 2;
        if (this.littleEndian) {
            this.view[offset + 1] = (value & 0xFF00) >>> 8;
            this.view[offset] = value & 0x00FF;
        }
        else {
            this.view[offset] = (value & 0xFF00) >>> 8;
            this.view[offset + 1] = value & 0x00FF;
        }
        if (relative)
            this.offset += 2;
        return this;
    };
    /**
     * Writes a 16bit signed integer. This is an alias of {@link ByteBuffer#writeInt16}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @throws {TypeError} If `offset` or `value` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.writeShort = ByteBufferPrototype.writeInt16;
    /**
     * Reads a 16bit signed integer.
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @returns {number} Value read
     * @throws {TypeError} If `offset` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.readInt16 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 2 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 2 + ") <= " + this.buffer.byteLength);
        }
        var value = 0;
        if (this.littleEndian) {
            value = this.view[offset];
            value |= this.view[offset + 1] << 8;
        }
        else {
            value = this.view[offset] << 8;
            value |= this.view[offset + 1];
        }
        if ((value & 0x8000) === 0x8000)
            value = -(0xFFFF - value + 1); // Cast to signed
        if (relative)
            this.offset += 2;
        return value;
    };
    /**
     * Reads a 16bit signed integer. This is an alias of {@link ByteBuffer#readInt16}.
     * @function
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @returns {number} Value read
     * @throws {TypeError} If `offset` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.readShort = ByteBufferPrototype.readInt16;
    /**
     * Writes a 16bit unsigned integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @throws {TypeError} If `offset` or `value` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.writeUint16 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value >>>= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 2;
        var capacity3 = this.buffer.byteLength;
        if (offset > capacity3)
            this.resize((capacity3 *= 2) > offset ? capacity3 : offset);
        offset -= 2;
        if (this.littleEndian) {
            this.view[offset + 1] = (value & 0xFF00) >>> 8;
            this.view[offset] = value & 0x00FF;
        }
        else {
            this.view[offset] = (value & 0xFF00) >>> 8;
            this.view[offset + 1] = value & 0x00FF;
        }
        if (relative)
            this.offset += 2;
        return this;
    };
    /**
     * Writes a 16bit unsigned integer. This is an alias of {@link ByteBuffer#writeUint16}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @throws {TypeError} If `offset` or `value` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.writeUInt16 = ByteBufferPrototype.writeUint16;
    /**
     * Reads a 16bit unsigned integer.
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @returns {number} Value read
     * @throws {TypeError} If `offset` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.readUint16 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 2 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 2 + ") <= " + this.buffer.byteLength);
        }
        var value = 0;
        if (this.littleEndian) {
            value = this.view[offset];
            value |= this.view[offset + 1] << 8;
        }
        else {
            value = this.view[offset] << 8;
            value |= this.view[offset + 1];
        }
        if (relative)
            this.offset += 2;
        return value;
    };
    /**
     * Reads a 16bit unsigned integer. This is an alias of {@link ByteBuffer#readUint16}.
     * @function
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @returns {number} Value read
     * @throws {TypeError} If `offset` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.readUInt16 = ByteBufferPrototype.readUint16;
    // types/ints/int32
    /**
     * Writes a 32bit signed integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @expose
     */
    ByteBufferPrototype.writeInt32 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value |= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 4;
        var capacity4 = this.buffer.byteLength;
        if (offset > capacity4)
            this.resize((capacity4 *= 2) > offset ? capacity4 : offset);
        offset -= 4;
        if (this.littleEndian) {
            this.view[offset + 3] = (value >>> 24) & 0xFF;
            this.view[offset + 2] = (value >>> 16) & 0xFF;
            this.view[offset + 1] = (value >>> 8) & 0xFF;
            this.view[offset] = value & 0xFF;
        }
        else {
            this.view[offset] = (value >>> 24) & 0xFF;
            this.view[offset + 1] = (value >>> 16) & 0xFF;
            this.view[offset + 2] = (value >>> 8) & 0xFF;
            this.view[offset + 3] = value & 0xFF;
        }
        if (relative)
            this.offset += 4;
        return this;
    };
    /**
     * Writes a 32bit signed integer. This is an alias of {@link ByteBuffer#writeInt32}.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @expose
     */
    ByteBufferPrototype.writeInt = ByteBufferPrototype.writeInt32;
    /**
     * Reads a 32bit signed integer.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readInt32 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 4 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 4 + ") <= " + this.buffer.byteLength);
        }
        var value = 0;
        if (this.littleEndian) {
            value = this.view[offset + 2] << 16;
            value |= this.view[offset + 1] << 8;
            value |= this.view[offset];
            value += this.view[offset + 3] << 24 >>> 0;
        }
        else {
            value = this.view[offset + 1] << 16;
            value |= this.view[offset + 2] << 8;
            value |= this.view[offset + 3];
            value += this.view[offset] << 24 >>> 0;
        }
        value |= 0; // Cast to signed
        if (relative)
            this.offset += 4;
        return value;
    };
    /**
     * Reads a 32bit signed integer. This is an alias of {@link ByteBuffer#readInt32}.
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readInt = ByteBufferPrototype.readInt32;
    /**
     * Writes a 32bit unsigned integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @expose
     */
    ByteBufferPrototype.writeUint32 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value >>>= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 4;
        var capacity5 = this.buffer.byteLength;
        if (offset > capacity5)
            this.resize((capacity5 *= 2) > offset ? capacity5 : offset);
        offset -= 4;
        if (this.littleEndian) {
            this.view[offset + 3] = (value >>> 24) & 0xFF;
            this.view[offset + 2] = (value >>> 16) & 0xFF;
            this.view[offset + 1] = (value >>> 8) & 0xFF;
            this.view[offset] = value & 0xFF;
        }
        else {
            this.view[offset] = (value >>> 24) & 0xFF;
            this.view[offset + 1] = (value >>> 16) & 0xFF;
            this.view[offset + 2] = (value >>> 8) & 0xFF;
            this.view[offset + 3] = value & 0xFF;
        }
        if (relative)
            this.offset += 4;
        return this;
    };
    /**
     * Writes a 32bit unsigned integer. This is an alias of {@link ByteBuffer#writeUint32}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @expose
     */
    ByteBufferPrototype.writeUInt32 = ByteBufferPrototype.writeUint32;
    /**
     * Reads a 32bit unsigned integer.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readUint32 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 4 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 4 + ") <= " + this.buffer.byteLength);
        }
        var value = 0;
        if (this.littleEndian) {
            value = this.view[offset + 2] << 16;
            value |= this.view[offset + 1] << 8;
            value |= this.view[offset];
            value += this.view[offset + 3] << 24 >>> 0;
        }
        else {
            value = this.view[offset + 1] << 16;
            value |= this.view[offset + 2] << 8;
            value |= this.view[offset + 3];
            value += this.view[offset] << 24 >>> 0;
        }
        if (relative)
            this.offset += 4;
        return value;
    };
    /**
     * Reads a 32bit unsigned integer. This is an alias of {@link ByteBuffer#readUint32}.
     * @function
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readUInt32 = ByteBufferPrototype.readUint32;
    // types/ints/int64
    if (Long) {
        /**
         * Writes a 64bit signed integer.
         * @param {number|!Long} value Value to write
         * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!ByteBuffer} this
         * @expose
         */
        ByteBufferPrototype.writeInt64 = function (value, offset) {
            var relative = typeof offset === 'undefined';
            if (relative)
                offset = this.offset;
            if (!this.noAssert) {
                if (typeof value === 'number')
                    value = Long.fromNumber(value);
                else if (typeof value === 'string')
                    value = Long.fromString(value);
                else if (!(value && value instanceof Long))
                    throw TypeError("Illegal value: " + value + " (not an integer or Long)");
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + 0 > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
            }
            if (typeof value === 'number')
                value = Long.fromNumber(value);
            else if (typeof value === 'string')
                value = Long.fromString(value);
            offset += 8;
            var capacity6 = this.buffer.byteLength;
            if (offset > capacity6)
                this.resize((capacity6 *= 2) > offset ? capacity6 : offset);
            offset -= 8;
            var lo = value.low, hi = value.high;
            if (this.littleEndian) {
                this.view[offset + 3] = (lo >>> 24) & 0xFF;
                this.view[offset + 2] = (lo >>> 16) & 0xFF;
                this.view[offset + 1] = (lo >>> 8) & 0xFF;
                this.view[offset] = lo & 0xFF;
                offset += 4;
                this.view[offset + 3] = (hi >>> 24) & 0xFF;
                this.view[offset + 2] = (hi >>> 16) & 0xFF;
                this.view[offset + 1] = (hi >>> 8) & 0xFF;
                this.view[offset] = hi & 0xFF;
            }
            else {
                this.view[offset] = (hi >>> 24) & 0xFF;
                this.view[offset + 1] = (hi >>> 16) & 0xFF;
                this.view[offset + 2] = (hi >>> 8) & 0xFF;
                this.view[offset + 3] = hi & 0xFF;
                offset += 4;
                this.view[offset] = (lo >>> 24) & 0xFF;
                this.view[offset + 1] = (lo >>> 16) & 0xFF;
                this.view[offset + 2] = (lo >>> 8) & 0xFF;
                this.view[offset + 3] = lo & 0xFF;
            }
            if (relative)
                this.offset += 8;
            return this;
        };
        /**
         * Writes a 64bit signed integer. This is an alias of {@link ByteBuffer#writeInt64}.
         * @param {number|!Long} value Value to write
         * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!ByteBuffer} this
         * @expose
         */
        ByteBufferPrototype.writeLong = ByteBufferPrototype.writeInt64;
        /**
         * Reads a 64bit signed integer.
         * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!Long}
         * @expose
         */
        ByteBufferPrototype.readInt64 = function (offset) {
            var relative = typeof offset === 'undefined';
            if (relative)
                offset = this.offset;
            if (!this.noAssert) {
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + 8 > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 8 + ") <= " + this.buffer.byteLength);
            }
            var lo = 0, hi = 0;
            if (this.littleEndian) {
                lo = this.view[offset + 2] << 16;
                lo |= this.view[offset + 1] << 8;
                lo |= this.view[offset];
                lo += this.view[offset + 3] << 24 >>> 0;
                offset += 4;
                hi = this.view[offset + 2] << 16;
                hi |= this.view[offset + 1] << 8;
                hi |= this.view[offset];
                hi += this.view[offset + 3] << 24 >>> 0;
            }
            else {
                hi = this.view[offset + 1] << 16;
                hi |= this.view[offset + 2] << 8;
                hi |= this.view[offset + 3];
                hi += this.view[offset] << 24 >>> 0;
                offset += 4;
                lo = this.view[offset + 1] << 16;
                lo |= this.view[offset + 2] << 8;
                lo |= this.view[offset + 3];
                lo += this.view[offset] << 24 >>> 0;
            }
            var value = new Long(lo, hi, false);
            if (relative)
                this.offset += 8;
            return value;
        };
        /**
         * Reads a 64bit signed integer. This is an alias of {@link ByteBuffer#readInt64}.
         * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!Long}
         * @expose
         */
        ByteBufferPrototype.readLong = ByteBufferPrototype.readInt64;
        /**
         * Writes a 64bit unsigned integer.
         * @param {number|!Long} value Value to write
         * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!ByteBuffer} this
         * @expose
         */
        ByteBufferPrototype.writeUint64 = function (value, offset) {
            var relative = typeof offset === 'undefined';
            if (relative)
                offset = this.offset;
            if (!this.noAssert) {
                if (typeof value === 'number')
                    value = Long.fromNumber(value);
                else if (typeof value === 'string')
                    value = Long.fromString(value);
                else if (!(value && value instanceof Long))
                    throw TypeError("Illegal value: " + value + " (not an integer or Long)");
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + 0 > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
            }
            if (typeof value === 'number')
                value = Long.fromNumber(value);
            else if (typeof value === 'string')
                value = Long.fromString(value);
            offset += 8;
            var capacity7 = this.buffer.byteLength;
            if (offset > capacity7)
                this.resize((capacity7 *= 2) > offset ? capacity7 : offset);
            offset -= 8;
            var lo = value.low, hi = value.high;
            if (this.littleEndian) {
                this.view[offset + 3] = (lo >>> 24) & 0xFF;
                this.view[offset + 2] = (lo >>> 16) & 0xFF;
                this.view[offset + 1] = (lo >>> 8) & 0xFF;
                this.view[offset] = lo & 0xFF;
                offset += 4;
                this.view[offset + 3] = (hi >>> 24) & 0xFF;
                this.view[offset + 2] = (hi >>> 16) & 0xFF;
                this.view[offset + 1] = (hi >>> 8) & 0xFF;
                this.view[offset] = hi & 0xFF;
            }
            else {
                this.view[offset] = (hi >>> 24) & 0xFF;
                this.view[offset + 1] = (hi >>> 16) & 0xFF;
                this.view[offset + 2] = (hi >>> 8) & 0xFF;
                this.view[offset + 3] = hi & 0xFF;
                offset += 4;
                this.view[offset] = (lo >>> 24) & 0xFF;
                this.view[offset + 1] = (lo >>> 16) & 0xFF;
                this.view[offset + 2] = (lo >>> 8) & 0xFF;
                this.view[offset + 3] = lo & 0xFF;
            }
            if (relative)
                this.offset += 8;
            return this;
        };
        /**
         * Writes a 64bit unsigned integer. This is an alias of {@link ByteBuffer#writeUint64}.
         * @function
         * @param {number|!Long} value Value to write
         * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!ByteBuffer} this
         * @expose
         */
        ByteBufferPrototype.writeUInt64 = ByteBufferPrototype.writeUint64;
        /**
         * Reads a 64bit unsigned integer.
         * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!Long}
         * @expose
         */
        ByteBufferPrototype.readUint64 = function (offset) {
            var relative = typeof offset === 'undefined';
            if (relative)
                offset = this.offset;
            if (!this.noAssert) {
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + 8 > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 8 + ") <= " + this.buffer.byteLength);
            }
            var lo = 0, hi = 0;
            if (this.littleEndian) {
                lo = this.view[offset + 2] << 16;
                lo |= this.view[offset + 1] << 8;
                lo |= this.view[offset];
                lo += this.view[offset + 3] << 24 >>> 0;
                offset += 4;
                hi = this.view[offset + 2] << 16;
                hi |= this.view[offset + 1] << 8;
                hi |= this.view[offset];
                hi += this.view[offset + 3] << 24 >>> 0;
            }
            else {
                hi = this.view[offset + 1] << 16;
                hi |= this.view[offset + 2] << 8;
                hi |= this.view[offset + 3];
                hi += this.view[offset] << 24 >>> 0;
                offset += 4;
                lo = this.view[offset + 1] << 16;
                lo |= this.view[offset + 2] << 8;
                lo |= this.view[offset + 3];
                lo += this.view[offset] << 24 >>> 0;
            }
            var value = new Long(lo, hi, true);
            if (relative)
                this.offset += 8;
            return value;
        };
        /**
         * Reads a 64bit unsigned integer. This is an alias of {@link ByteBuffer#readUint64}.
         * @function
         * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!Long}
         * @expose
         */
        ByteBufferPrototype.readUInt64 = ByteBufferPrototype.readUint64;
    } // Long
    // types/floats/float32
    /*
     ieee754 - https://github.com/feross/ieee754

     The MIT License (MIT)

     Copyright (c) Feross Aboukhadijeh

     Permission is hereby granted, free of charge, to any person obtaining a copy
     of this software and associated documentation files (the "Software"), to deal
     in the Software without restriction, including without limitation the rights
     to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     copies of the Software, and to permit persons to whom the Software is
     furnished to do so, subject to the following conditions:

     The above copyright notice and this permission notice shall be included in
     all copies or substantial portions of the Software.

     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     THE SOFTWARE.
    */
    /**
     * Reads an IEEE754 float from a byte array.
     * @param {!Array} buffer
     * @param {number} offset
     * @param {boolean} isLE
     * @param {number} mLen
     * @param {number} nBytes
     * @returns {number}
     * @inner
     */
    function ieee754_read(buffer, offset, isLE, mLen, nBytes) {
        var e, m, eLen = nBytes * 8 - mLen - 1, eMax = (1 << eLen) - 1, eBias = eMax >> 1, nBits = -7, i = isLE ? (nBytes - 1) : 0, d = isLE ? -1 : 1, s = buffer[offset + i];
        i += d;
        e = s & ((1 << (-nBits)) - 1);
        s >>= (-nBits);
        nBits += eLen;
        for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) { }
        m = e & ((1 << (-nBits)) - 1);
        e >>= (-nBits);
        nBits += mLen;
        for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) { }
        if (e === 0) {
            e = 1 - eBias;
        }
        else if (e === eMax) {
            return m ? NaN : ((s ? -1 : 1) * Infinity);
        }
        else {
            m = m + Math.pow(2, mLen);
            e = e - eBias;
        }
        return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
    }
    /**
     * Writes an IEEE754 float to a byte array.
     * @param {!Array} buffer
     * @param {number} value
     * @param {number} offset
     * @param {boolean} isLE
     * @param {number} mLen
     * @param {number} nBytes
     * @inner
     */
    function ieee754_write(buffer, value, offset, isLE, mLen, nBytes) {
        var e, m, c, eLen = nBytes * 8 - mLen - 1, eMax = (1 << eLen) - 1, eBias = eMax >> 1, rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0), i = isLE ? 0 : (nBytes - 1), d = isLE ? 1 : -1, s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;
        value = Math.abs(value);
        if (isNaN(value) || value === Infinity) {
            m = isNaN(value) ? 1 : 0;
            e = eMax;
        }
        else {
            e = Math.floor(Math.log(value) / Math.LN2);
            if (value * (c = Math.pow(2, -e)) < 1) {
                e--;
                c *= 2;
            }
            if (e + eBias >= 1) {
                value += rt / c;
            }
            else {
                value += rt * Math.pow(2, 1 - eBias);
            }
            if (value * c >= 2) {
                e++;
                c /= 2;
            }
            if (e + eBias >= eMax) {
                m = 0;
                e = eMax;
            }
            else if (e + eBias >= 1) {
                m = (value * c - 1) * Math.pow(2, mLen);
                e = e + eBias;
            }
            else {
                m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
                e = 0;
            }
        }
        for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) { }
        e = (e << mLen) | m;
        eLen += mLen;
        for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) { }
        buffer[offset + i - d] |= s * 128;
    }
    /**
     * Writes a 32bit float.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeFloat32 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number')
                throw TypeError("Illegal value: " + value + " (not a number)");
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 4;
        var capacity8 = this.buffer.byteLength;
        if (offset > capacity8)
            this.resize((capacity8 *= 2) > offset ? capacity8 : offset);
        offset -= 4;
        ieee754_write(this.view, value, offset, this.littleEndian, 23, 4);
        if (relative)
            this.offset += 4;
        return this;
    };
    /**
     * Writes a 32bit float. This is an alias of {@link ByteBuffer#writeFloat32}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeFloat = ByteBufferPrototype.writeFloat32;
    /**
     * Reads a 32bit float.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {number}
     * @expose
     */
    ByteBufferPrototype.readFloat32 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 4 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 4 + ") <= " + this.buffer.byteLength);
        }
        var value = ieee754_read(this.view, offset, this.littleEndian, 23, 4);
        if (relative)
            this.offset += 4;
        return value;
    };
    /**
     * Reads a 32bit float. This is an alias of {@link ByteBuffer#readFloat32}.
     * @function
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {number}
     * @expose
     */
    ByteBufferPrototype.readFloat = ByteBufferPrototype.readFloat32;
    // types/floats/float64
    /**
     * Writes a 64bit float.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeFloat64 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number')
                throw TypeError("Illegal value: " + value + " (not a number)");
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 8;
        var capacity9 = this.buffer.byteLength;
        if (offset > capacity9)
            this.resize((capacity9 *= 2) > offset ? capacity9 : offset);
        offset -= 8;
        ieee754_write(this.view, value, offset, this.littleEndian, 52, 8);
        if (relative)
            this.offset += 8;
        return this;
    };
    /**
     * Writes a 64bit float. This is an alias of {@link ByteBuffer#writeFloat64}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeDouble = ByteBufferPrototype.writeFloat64;
    /**
     * Reads a 64bit float.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
     * @returns {number}
     * @expose
     */
    ByteBufferPrototype.readFloat64 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 8 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 8 + ") <= " + this.buffer.byteLength);
        }
        var value = ieee754_read(this.view, offset, this.littleEndian, 52, 8);
        if (relative)
            this.offset += 8;
        return value;
    };
    /**
     * Reads a 64bit float. This is an alias of {@link ByteBuffer#readFloat64}.
     * @function
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
     * @returns {number}
     * @expose
     */
    ByteBufferPrototype.readDouble = ByteBufferPrototype.readFloat64;
    // types/varints/varint32
    /**
     * Maximum number of bytes required to store a 32bit base 128 variable-length integer.
     * @type {number}
     * @const
     * @expose
     */
    ByteBuffer.MAX_VARINT32_BYTES = 5;
    /**
     * Calculates the actual number of bytes required to store a 32bit base 128 variable-length integer.
     * @param {number} value Value to encode
     * @returns {number} Number of bytes required. Capped to {@link ByteBuffer.MAX_VARINT32_BYTES}
     * @expose
     */
    ByteBuffer.calculateVarint32 = function (value) {
        // ref: src/google/protobuf/io/coded_stream.cc
        value = value >>> 0;
        if (value < 1 << 7)
            return 1;
        else if (value < 1 << 14)
            return 2;
        else if (value < 1 << 21)
            return 3;
        else if (value < 1 << 28)
            return 4;
        else
            return 5;
    };
    /**
     * Zigzag encodes a signed 32bit integer so that it can be effectively used with varint encoding.
     * @param {number} n Signed 32bit integer
     * @returns {number} Unsigned zigzag encoded 32bit integer
     * @expose
     */
    ByteBuffer.zigZagEncode32 = function (n) {
        return (((n |= 0) << 1) ^ (n >> 31)) >>> 0; // ref: src/google/protobuf/wire_format_lite.h
    };
    /**
     * Decodes a zigzag encoded signed 32bit integer.
     * @param {number} n Unsigned zigzag encoded 32bit integer
     * @returns {number} Signed 32bit integer
     * @expose
     */
    ByteBuffer.zigZagDecode32 = function (n) {
        return ((n >>> 1) ^ -(n & 1)) | 0; // // ref: src/google/protobuf/wire_format_lite.h
    };
    /**
     * Writes a 32bit base 128 variable-length integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer|number} this if `offset` is omitted, else the actual number of bytes written
     * @expose
     */
    ByteBufferPrototype.writeVarint32 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value |= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        var size = ByteBuffer.calculateVarint32(value), b;
        offset += size;
        var capacity10 = this.buffer.byteLength;
        if (offset > capacity10)
            this.resize((capacity10 *= 2) > offset ? capacity10 : offset);
        offset -= size;
        value >>>= 0;
        while (value >= 0x80) {
            b = (value & 0x7f) | 0x80;
            this.view[offset++] = b;
            value >>>= 7;
        }
        this.view[offset++] = value;
        if (relative) {
            this.offset = offset;
            return this;
        }
        return size;
    };
    /**
     * Writes a zig-zag encoded (signed) 32bit base 128 variable-length integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer|number} this if `offset` is omitted, else the actual number of bytes written
     * @expose
     */
    ByteBufferPrototype.writeVarint32ZigZag = function (value, offset) {
        return this.writeVarint32(ByteBuffer.zigZagEncode32(value), offset);
    };
    /**
     * Reads a 32bit base 128 variable-length integer.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {number|!{value: number, length: number}} The value read if offset is omitted, else the value read
     *  and the actual number of bytes read.
     * @throws {Error} If it's not a valid varint. Has a property `truncated = true` if there is not enough data available
     *  to fully decode the varint.
     * @expose
     */
    ByteBufferPrototype.readVarint32 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 1 + ") <= " + this.buffer.byteLength);
        }
        var c = 0, value = 0 >>> 0, b;
        do {
            if (!this.noAssert && offset > this.limit) {
                var err = Error("Truncated");
                err['truncated'] = true;
                throw err;
            }
            b = this.view[offset++];
            if (c < 5)
                value |= (b & 0x7f) << (7 * c);
            ++c;
        } while ((b & 0x80) !== 0);
        value |= 0;
        if (relative) {
            this.offset = offset;
            return value;
        }
        return {
            "value": value,
            "length": c
        };
    };
    /**
     * Reads a zig-zag encoded (signed) 32bit base 128 variable-length integer.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {number|!{value: number, length: number}} The value read if offset is omitted, else the value read
     *  and the actual number of bytes read.
     * @throws {Error} If it's not a valid varint
     * @expose
     */
    ByteBufferPrototype.readVarint32ZigZag = function (offset) {
        var val = this.readVarint32(offset);
        if (typeof val === 'object')
            val["value"] = ByteBuffer.zigZagDecode32(val["value"]);
        else
            val = ByteBuffer.zigZagDecode32(val);
        return val;
    };
    // types/varints/varint64
    if (Long) {
        /**
         * Maximum number of bytes required to store a 64bit base 128 variable-length integer.
         * @type {number}
         * @const
         * @expose
         */
        ByteBuffer.MAX_VARINT64_BYTES = 10;
        /**
         * Calculates the actual number of bytes required to store a 64bit base 128 variable-length integer.
         * @param {number|!Long} value Value to encode
         * @returns {number} Number of bytes required. Capped to {@link ByteBuffer.MAX_VARINT64_BYTES}
         * @expose
         */
        ByteBuffer.calculateVarint64 = function (value) {
            if (typeof value === 'number')
                value = Long.fromNumber(value);
            else if (typeof value === 'string')
                value = Long.fromString(value);
            // ref: src/google/protobuf/io/coded_stream.cc
            var part0 = value.toInt() >>> 0, part1 = value.shiftRightUnsigned(28).toInt() >>> 0, part2 = value.shiftRightUnsigned(56).toInt() >>> 0;
            if (part2 == 0) {
                if (part1 == 0) {
                    if (part0 < 1 << 14)
                        return part0 < 1 << 7 ? 1 : 2;
                    else
                        return part0 < 1 << 21 ? 3 : 4;
                }
                else {
                    if (part1 < 1 << 14)
                        return part1 < 1 << 7 ? 5 : 6;
                    else
                        return part1 < 1 << 21 ? 7 : 8;
                }
            }
            else
                return part2 < 1 << 7 ? 9 : 10;
        };
        /**
         * Zigzag encodes a signed 64bit integer so that it can be effectively used with varint encoding.
         * @param {number|!Long} value Signed long
         * @returns {!Long} Unsigned zigzag encoded long
         * @expose
         */
        ByteBuffer.zigZagEncode64 = function (value) {
            if (typeof value === 'number')
                value = Long.fromNumber(value, false);
            else if (typeof value === 'string')
                value = Long.fromString(value, false);
            else if (value.unsigned !== false)
                value = value.toSigned();
            // ref: src/google/protobuf/wire_format_lite.h
            return value.shiftLeft(1).xor(value.shiftRight(63)).toUnsigned();
        };
        /**
         * Decodes a zigzag encoded signed 64bit integer.
         * @param {!Long|number} value Unsigned zigzag encoded long or JavaScript number
         * @returns {!Long} Signed long
         * @expose
         */
        ByteBuffer.zigZagDecode64 = function (value) {
            if (typeof value === 'number')
                value = Long.fromNumber(value, false);
            else if (typeof value === 'string')
                value = Long.fromString(value, false);
            else if (value.unsigned !== false)
                value = value.toSigned();
            // ref: src/google/protobuf/wire_format_lite.h
            return value.shiftRightUnsigned(1).xor(value.and(Long.ONE).toSigned().negate()).toSigned();
        };
        /**
         * Writes a 64bit base 128 variable-length integer.
         * @param {number|Long} value Value to write
         * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
         *  written if omitted.
         * @returns {!ByteBuffer|number} `this` if offset is omitted, else the actual number of bytes written.
         * @expose
         */
        ByteBufferPrototype.writeVarint64 = function (value, offset) {
            var relative = typeof offset === 'undefined';
            if (relative)
                offset = this.offset;
            if (!this.noAssert) {
                if (typeof value === 'number')
                    value = Long.fromNumber(value);
                else if (typeof value === 'string')
                    value = Long.fromString(value);
                else if (!(value && value instanceof Long))
                    throw TypeError("Illegal value: " + value + " (not an integer or Long)");
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + 0 > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
            }
            if (typeof value === 'number')
                value = Long.fromNumber(value, false);
            else if (typeof value === 'string')
                value = Long.fromString(value, false);
            else if (value.unsigned !== false)
                value = value.toSigned();
            var size = ByteBuffer.calculateVarint64(value), part0 = value.toInt() >>> 0, part1 = value.shiftRightUnsigned(28).toInt() >>> 0, part2 = value.shiftRightUnsigned(56).toInt() >>> 0;
            offset += size;
            var capacity11 = this.buffer.byteLength;
            if (offset > capacity11)
                this.resize((capacity11 *= 2) > offset ? capacity11 : offset);
            offset -= size;
            switch (size) {
                case 10: this.view[offset + 9] = (part2 >>> 7) & 0x01;
                case 9: this.view[offset + 8] = size !== 9 ? (part2) | 0x80 : (part2) & 0x7F;
                case 8: this.view[offset + 7] = size !== 8 ? (part1 >>> 21) | 0x80 : (part1 >>> 21) & 0x7F;
                case 7: this.view[offset + 6] = size !== 7 ? (part1 >>> 14) | 0x80 : (part1 >>> 14) & 0x7F;
                case 6: this.view[offset + 5] = size !== 6 ? (part1 >>> 7) | 0x80 : (part1 >>> 7) & 0x7F;
                case 5: this.view[offset + 4] = size !== 5 ? (part1) | 0x80 : (part1) & 0x7F;
                case 4: this.view[offset + 3] = size !== 4 ? (part0 >>> 21) | 0x80 : (part0 >>> 21) & 0x7F;
                case 3: this.view[offset + 2] = size !== 3 ? (part0 >>> 14) | 0x80 : (part0 >>> 14) & 0x7F;
                case 2: this.view[offset + 1] = size !== 2 ? (part0 >>> 7) | 0x80 : (part0 >>> 7) & 0x7F;
                case 1: this.view[offset] = size !== 1 ? (part0) | 0x80 : (part0) & 0x7F;
            }
            if (relative) {
                this.offset += size;
                return this;
            }
            else {
                return size;
            }
        };
        /**
         * Writes a zig-zag encoded 64bit base 128 variable-length integer.
         * @param {number|Long} value Value to write
         * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
         *  written if omitted.
         * @returns {!ByteBuffer|number} `this` if offset is omitted, else the actual number of bytes written.
         * @expose
         */
        ByteBufferPrototype.writeVarint64ZigZag = function (value, offset) {
            return this.writeVarint64(ByteBuffer.zigZagEncode64(value), offset);
        };
        /**
         * Reads a 64bit base 128 variable-length integer. Requires Long.js.
         * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
         *  read if omitted.
         * @returns {!Long|!{value: Long, length: number}} The value read if offset is omitted, else the value read and
         *  the actual number of bytes read.
         * @throws {Error} If it's not a valid varint
         * @expose
         */
        ByteBufferPrototype.readVarint64 = function (offset) {
            var relative = typeof offset === 'undefined';
            if (relative)
                offset = this.offset;
            if (!this.noAssert) {
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + 1 > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 1 + ") <= " + this.buffer.byteLength);
            }
            // ref: src/google/protobuf/io/coded_stream.cc
            var start = offset, part0 = 0, part1 = 0, part2 = 0, b = 0;
            b = this.view[offset++];
            part0 = (b & 0x7F);
            if (b & 0x80) {
                b = this.view[offset++];
                part0 |= (b & 0x7F) << 7;
                if ((b & 0x80) || (this.noAssert && typeof b === 'undefined')) {
                    b = this.view[offset++];
                    part0 |= (b & 0x7F) << 14;
                    if ((b & 0x80) || (this.noAssert && typeof b === 'undefined')) {
                        b = this.view[offset++];
                        part0 |= (b & 0x7F) << 21;
                        if ((b & 0x80) || (this.noAssert && typeof b === 'undefined')) {
                            b = this.view[offset++];
                            part1 = (b & 0x7F);
                            if ((b & 0x80) || (this.noAssert && typeof b === 'undefined')) {
                                b = this.view[offset++];
                                part1 |= (b & 0x7F) << 7;
                                if ((b & 0x80) || (this.noAssert && typeof b === 'undefined')) {
                                    b = this.view[offset++];
                                    part1 |= (b & 0x7F) << 14;
                                    if ((b & 0x80) || (this.noAssert && typeof b === 'undefined')) {
                                        b = this.view[offset++];
                                        part1 |= (b & 0x7F) << 21;
                                        if ((b & 0x80) || (this.noAssert && typeof b === 'undefined')) {
                                            b = this.view[offset++];
                                            part2 = (b & 0x7F);
                                            if ((b & 0x80) || (this.noAssert && typeof b === 'undefined')) {
                                                b = this.view[offset++];
                                                part2 |= (b & 0x7F) << 7;
                                                if ((b & 0x80) || (this.noAssert && typeof b === 'undefined')) {
                                                    throw Error("Buffer overrun");
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            var value = Long.fromBits(part0 | (part1 << 28), (part1 >>> 4) | (part2) << 24, false);
            if (relative) {
                this.offset = offset;
                return value;
            }
            else {
                return {
                    'value': value,
                    'length': offset - start
                };
            }
        };
        /**
         * Reads a zig-zag encoded 64bit base 128 variable-length integer. Requires Long.js.
         * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
         *  read if omitted.
         * @returns {!Long|!{value: Long, length: number}} The value read if offset is omitted, else the value read and
         *  the actual number of bytes read.
         * @throws {Error} If it's not a valid varint
         * @expose
         */
        ByteBufferPrototype.readVarint64ZigZag = function (offset) {
            var val = this.readVarint64(offset);
            if (val && val['value'] instanceof Long)
                val["value"] = ByteBuffer.zigZagDecode64(val["value"]);
            else
                val = ByteBuffer.zigZagDecode64(val);
            return val;
        };
    } // Long
    // types/strings/cstring
    /**
     * Writes a NULL-terminated UTF8 encoded string. For this to work the specified string must not contain any NULL
     *  characters itself.
     * @param {string} str String to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  contained in `str` + 1 if omitted.
     * @returns {!ByteBuffer|number} this if offset is omitted, else the actual number of bytes written
     * @expose
     */
    ByteBufferPrototype.writeCString = function (str, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        var i, k = str.length;
        if (!this.noAssert) {
            if (typeof str !== 'string')
                throw TypeError("Illegal str: Not a string");
            for (i = 0; i < k; ++i) {
                if (str.charCodeAt(i) === 0)
                    throw RangeError("Illegal str: Contains NULL-characters");
            }
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        // UTF8 strings do not contain zero bytes in between except for the zero character, so:
        k = utfx.calculateUTF16asUTF8(stringSource(str))[1];
        offset += k + 1;
        var capacity12 = this.buffer.byteLength;
        if (offset > capacity12)
            this.resize((capacity12 *= 2) > offset ? capacity12 : offset);
        offset -= k + 1;
        utfx.encodeUTF16toUTF8(stringSource(str), function (b) {
            this.view[offset++] = b;
        }.bind(this));
        this.view[offset++] = 0;
        if (relative) {
            this.offset = offset;
            return this;
        }
        return k;
    };
    /**
     * Reads a NULL-terminated UTF8 encoded string. For this to work the string read must not contain any NULL characters
     *  itself.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {string|!{string: string, length: number}} The string read if offset is omitted, else the string
     *  read and the actual number of bytes read.
     * @expose
     */
    ByteBufferPrototype.readCString = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 1 + ") <= " + this.buffer.byteLength);
        }
        var start = offset, temp;
        // UTF8 strings do not contain zero bytes in between except for the zero character itself, so:
        var sd, b = -1;
        utfx.decodeUTF8toUTF16(function () {
            if (b === 0)
                return null;
            if (offset >= this.limit)
                throw RangeError("Illegal range: Truncated data, " + offset + " < " + this.limit);
            b = this.view[offset++];
            return b === 0 ? null : b;
        }.bind(this), sd = stringDestination(), true);
        if (relative) {
            this.offset = offset;
            return sd();
        }
        else {
            return {
                "string": sd(),
                "length": offset - start
            };
        }
    };
    // types/strings/istring
    /**
     * Writes a length as uint32 prefixed UTF8 encoded string.
     * @param {string} str String to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer|number} `this` if `offset` is omitted, else the actual number of bytes written
     * @expose
     * @see ByteBuffer#writeVarint32
     */
    ByteBufferPrototype.writeIString = function (str, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof str !== 'string')
                throw TypeError("Illegal str: Not a string");
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        var start = offset, k;
        k = utfx.calculateUTF16asUTF8(stringSource(str), this.noAssert)[1];
        offset += 4 + k;
        var capacity13 = this.buffer.byteLength;
        if (offset > capacity13)
            this.resize((capacity13 *= 2) > offset ? capacity13 : offset);
        offset -= 4 + k;
        if (this.littleEndian) {
            this.view[offset + 3] = (k >>> 24) & 0xFF;
            this.view[offset + 2] = (k >>> 16) & 0xFF;
            this.view[offset + 1] = (k >>> 8) & 0xFF;
            this.view[offset] = k & 0xFF;
        }
        else {
            this.view[offset] = (k >>> 24) & 0xFF;
            this.view[offset + 1] = (k >>> 16) & 0xFF;
            this.view[offset + 2] = (k >>> 8) & 0xFF;
            this.view[offset + 3] = k & 0xFF;
        }
        offset += 4;
        utfx.encodeUTF16toUTF8(stringSource(str), function (b) {
            this.view[offset++] = b;
        }.bind(this));
        if (offset !== start + 4 + k)
            throw RangeError("Illegal range: Truncated data, " + offset + " == " + (offset + 4 + k));
        if (relative) {
            this.offset = offset;
            return this;
        }
        return offset - start;
    };
    /**
     * Reads a length as uint32 prefixed UTF8 encoded string.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {string|!{string: string, length: number}} The string read if offset is omitted, else the string
     *  read and the actual number of bytes read.
     * @expose
     * @see ByteBuffer#readVarint32
     */
    ByteBufferPrototype.readIString = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 4 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 4 + ") <= " + this.buffer.byteLength);
        }
        var start = offset;
        var len = this.readUint32(offset);
        var str = this.readUTF8String(len, ByteBuffer.METRICS_BYTES, offset += 4);
        offset += str['length'];
        if (relative) {
            this.offset = offset;
            return str['string'];
        }
        else {
            return {
                'string': str['string'],
                'length': offset - start
            };
        }
    };
    // types/strings/utf8string
    /**
     * Metrics representing number of UTF8 characters. Evaluates to `c`.
     * @type {string}
     * @const
     * @expose
     */
    ByteBuffer.METRICS_CHARS = 'c';
    /**
     * Metrics representing number of bytes. Evaluates to `b`.
     * @type {string}
     * @const
     * @expose
     */
    ByteBuffer.METRICS_BYTES = 'b';
    /**
     * Writes an UTF8 encoded string.
     * @param {string} str String to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} if omitted.
     * @returns {!ByteBuffer|number} this if offset is omitted, else the actual number of bytes written.
     * @expose
     */
    ByteBufferPrototype.writeUTF8String = function (str, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        var k;
        var start = offset;
        k = utfx.calculateUTF16asUTF8(stringSource(str))[1];
        offset += k;
        var capacity14 = this.buffer.byteLength;
        if (offset > capacity14)
            this.resize((capacity14 *= 2) > offset ? capacity14 : offset);
        offset -= k;
        utfx.encodeUTF16toUTF8(stringSource(str), function (b) {
            this.view[offset++] = b;
        }.bind(this));
        if (relative) {
            this.offset = offset;
            return this;
        }
        return offset - start;
    };
    /**
     * Writes an UTF8 encoded string. This is an alias of {@link ByteBuffer#writeUTF8String}.
     * @function
     * @param {string} str String to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} if omitted.
     * @returns {!ByteBuffer|number} this if offset is omitted, else the actual number of bytes written.
     * @expose
     */
    ByteBufferPrototype.writeString = ByteBufferPrototype.writeUTF8String;
    /**
     * Calculates the number of UTF8 characters of a string. JavaScript itself uses UTF-16, so that a string's
     *  `length` property does not reflect its actual UTF8 size if it contains code points larger than 0xFFFF.
     * @param {string} str String to calculate
     * @returns {number} Number of UTF8 characters
     * @expose
     */
    ByteBuffer.calculateUTF8Chars = function (str) {
        return utfx.calculateUTF16asUTF8(stringSource(str))[0];
    };
    /**
     * Calculates the number of UTF8 bytes of a string.
     * @param {string} str String to calculate
     * @returns {number} Number of UTF8 bytes
     * @expose
     */
    ByteBuffer.calculateUTF8Bytes = function (str) {
        return utfx.calculateUTF16asUTF8(stringSource(str))[1];
    };
    /**
     * Calculates the number of UTF8 bytes of a string. This is an alias of {@link ByteBuffer.calculateUTF8Bytes}.
     * @function
     * @param {string} str String to calculate
     * @returns {number} Number of UTF8 bytes
     * @expose
     */
    ByteBuffer.calculateString = ByteBuffer.calculateUTF8Bytes;
    /**
     * Reads an UTF8 encoded string.
     * @param {number} length Number of characters or bytes to read.
     * @param {string=} metrics Metrics specifying what `length` is meant to count. Defaults to
     *  {@link ByteBuffer.METRICS_CHARS}.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {string|!{string: string, length: number}} The string read if offset is omitted, else the string
     *  read and the actual number of bytes read.
     * @expose
     */
    ByteBufferPrototype.readUTF8String = function (length, metrics, offset) {
        if (typeof metrics === 'number') {
            offset = metrics;
            metrics = undefined;
        }
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (typeof metrics === 'undefined')
            metrics = ByteBuffer.METRICS_CHARS;
        if (!this.noAssert) {
            if (typeof length !== 'number' || length % 1 !== 0)
                throw TypeError("Illegal length: " + length + " (not an integer)");
            length |= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        var i = 0, start = offset, sd;
        if (metrics === ByteBuffer.METRICS_CHARS) {
            sd = stringDestination();
            utfx.decodeUTF8(function () {
                return i < length && offset < this.limit ? this.view[offset++] : null;
            }.bind(this), function (cp) {
                ++i;
                utfx.UTF8toUTF16(cp, sd);
            });
            if (i !== length)
                throw RangeError("Illegal range: Truncated data, " + i + " == " + length);
            if (relative) {
                this.offset = offset;
                return sd();
            }
            else {
                return {
                    "string": sd(),
                    "length": offset - start
                };
            }
        }
        else if (metrics === ByteBuffer.METRICS_BYTES) {
            if (!this.noAssert) {
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + length > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + length + ") <= " + this.buffer.byteLength);
            }
            var k = offset + length;
            utfx.decodeUTF8toUTF16(function () {
                return offset < k ? this.view[offset++] : null;
            }.bind(this), sd = stringDestination(), this.noAssert);
            if (offset !== k)
                throw RangeError("Illegal range: Truncated data, " + offset + " == " + k);
            if (relative) {
                this.offset = offset;
                return sd();
            }
            else {
                return {
                    'string': sd(),
                    'length': offset - start
                };
            }
        }
        else
            throw TypeError("Unsupported metrics: " + metrics);
    };
    /**
     * Reads an UTF8 encoded string. This is an alias of {@link ByteBuffer#readUTF8String}.
     * @function
     * @param {number} length Number of characters or bytes to read
     * @param {number=} metrics Metrics specifying what `n` is meant to count. Defaults to
     *  {@link ByteBuffer.METRICS_CHARS}.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {string|!{string: string, length: number}} The string read if offset is omitted, else the string
     *  read and the actual number of bytes read.
     * @expose
     */
    ByteBufferPrototype.readString = ByteBufferPrototype.readUTF8String;
    // types/strings/vstring
    /**
     * Writes a length as varint32 prefixed UTF8 encoded string.
     * @param {string} str String to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer|number} `this` if `offset` is omitted, else the actual number of bytes written
     * @expose
     * @see ByteBuffer#writeVarint32
     */
    ByteBufferPrototype.writeVString = function (str, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof str !== 'string')
                throw TypeError("Illegal str: Not a string");
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        var start = offset, k, l;
        k = utfx.calculateUTF16asUTF8(stringSource(str), this.noAssert)[1];
        l = ByteBuffer.calculateVarint32(k);
        offset += l + k;
        var capacity15 = this.buffer.byteLength;
        if (offset > capacity15)
            this.resize((capacity15 *= 2) > offset ? capacity15 : offset);
        offset -= l + k;
        offset += this.writeVarint32(k, offset);
        utfx.encodeUTF16toUTF8(stringSource(str), function (b) {
            this.view[offset++] = b;
        }.bind(this));
        if (offset !== start + k + l)
            throw RangeError("Illegal range: Truncated data, " + offset + " == " + (offset + k + l));
        if (relative) {
            this.offset = offset;
            return this;
        }
        return offset - start;
    };
    /**
     * Reads a length as varint32 prefixed UTF8 encoded string.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {string|!{string: string, length: number}} The string read if offset is omitted, else the string
     *  read and the actual number of bytes read.
     * @expose
     * @see ByteBuffer#readVarint32
     */
    ByteBufferPrototype.readVString = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 1 + ") <= " + this.buffer.byteLength);
        }
        var start = offset;
        var len = this.readVarint32(offset);
        var str = this.readUTF8String(len['value'], ByteBuffer.METRICS_BYTES, offset += len['length']);
        offset += str['length'];
        if (relative) {
            this.offset = offset;
            return str['string'];
        }
        else {
            return {
                'string': str['string'],
                'length': offset - start
            };
        }
    };
    /**
     * Appends some data to this ByteBuffer. This will overwrite any contents behind the specified offset up to the appended
     *  data's length.
     * @param {!ByteBuffer|!ArrayBuffer|!Uint8Array|string} source Data to append. If `source` is a ByteBuffer, its offsets
     *  will be modified according to the performed read operation.
     * @param {(string|number)=} encoding Encoding if `data` is a string ("base64", "hex", "binary", defaults to "utf8")
     * @param {number=} offset Offset to append at. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     * @example A relative `<01 02>03.append(<04 05>)` will result in `<01 02 04 05>, 04 05|`
     * @example An absolute `<01 02>03.append(04 05>, 1)` will result in `<01 04>05, 04 05|`
     */
    ByteBufferPrototype.append = function (source, encoding, offset) {
        if (typeof encoding === 'number' || typeof encoding !== 'string') {
            offset = encoding;
            encoding = undefined;
        }
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        if (!(source instanceof ByteBuffer))
            source = ByteBuffer.wrap(source, encoding);
        var length = source.limit - source.offset;
        if (length <= 0)
            return this; // Nothing to append
        offset += length;
        var capacity16 = this.buffer.byteLength;
        if (offset > capacity16)
            this.resize((capacity16 *= 2) > offset ? capacity16 : offset);
        offset -= length;
        this.view.set(source.view.subarray(source.offset, source.limit), offset);
        source.offset += length;
        if (relative)
            this.offset += length;
        return this;
    };
    /**
     * Appends this ByteBuffer's contents to another ByteBuffer. This will overwrite any contents at and after the
        specified offset up to the length of this ByteBuffer's data.
     * @param {!ByteBuffer} target Target ByteBuffer
     * @param {number=} offset Offset to append to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     * @see ByteBuffer#append
     */
    ByteBufferPrototype.appendTo = function (target, offset) {
        target.append(this, offset);
        return this;
    };
    /**
     * Enables or disables assertions of argument types and offsets. Assertions are enabled by default but you can opt to
     *  disable them if your code already makes sure that everything is valid.
     * @param {boolean} assert `true` to enable assertions, otherwise `false`
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.assert = function (assert) {
        this.noAssert = !assert;
        return this;
    };
    /**
     * Gets the capacity of this ByteBuffer's backing buffer.
     * @returns {number} Capacity of the backing buffer
     * @expose
     */
    ByteBufferPrototype.capacity = function () {
        return this.buffer.byteLength;
    };
    /**
     * Clears this ByteBuffer's offsets by setting {@link ByteBuffer#offset} to `0` and {@link ByteBuffer#limit} to the
     *  backing buffer's capacity. Discards {@link ByteBuffer#markedOffset}.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.clear = function () {
        this.offset = 0;
        this.limit = this.buffer.byteLength;
        this.markedOffset = -1;
        return this;
    };
    /**
     * Creates a cloned instance of this ByteBuffer, preset with this ByteBuffer's values for {@link ByteBuffer#offset},
     *  {@link ByteBuffer#markedOffset} and {@link ByteBuffer#limit}.
     * @param {boolean=} copy Whether to copy the backing buffer or to return another view on the same, defaults to `false`
     * @returns {!ByteBuffer} Cloned instance
     * @expose
     */
    ByteBufferPrototype.clone = function (copy) {
        var bb = new ByteBuffer(0, this.littleEndian, this.noAssert);
        if (copy) {
            bb.buffer = new ArrayBuffer(this.buffer.byteLength);
            bb.view = new Uint8Array(bb.buffer);
        }
        else {
            bb.buffer = this.buffer;
            bb.view = this.view;
        }
        bb.offset = this.offset;
        bb.markedOffset = this.markedOffset;
        bb.limit = this.limit;
        return bb;
    };
    /**
     * Compacts this ByteBuffer to be backed by a {@link ByteBuffer#buffer} of its contents' length. Contents are the bytes
     *  between {@link ByteBuffer#offset} and {@link ByteBuffer#limit}. Will set `offset = 0` and `limit = capacity` and
     *  adapt {@link ByteBuffer#markedOffset} to the same relative position if set.
     * @param {number=} begin Offset to start at, defaults to {@link ByteBuffer#offset}
     * @param {number=} end Offset to end at, defaults to {@link ByteBuffer#limit}
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.compact = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        if (!this.noAssert) {
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        if (begin === 0 && end === this.buffer.byteLength)
            return this; // Already compacted
        var len = end - begin;
        if (len === 0) {
            this.buffer = EMPTY_BUFFER;
            this.view = null;
            if (this.markedOffset >= 0)
                this.markedOffset -= begin;
            this.offset = 0;
            this.limit = 0;
            return this;
        }
        var buffer = new ArrayBuffer(len);
        var view = new Uint8Array(buffer);
        view.set(this.view.subarray(begin, end));
        this.buffer = buffer;
        this.view = view;
        if (this.markedOffset >= 0)
            this.markedOffset -= begin;
        this.offset = 0;
        this.limit = len;
        return this;
    };
    /**
     * Creates a copy of this ByteBuffer's contents. Contents are the bytes between {@link ByteBuffer#offset} and
     *  {@link ByteBuffer#limit}.
     * @param {number=} begin Begin offset, defaults to {@link ByteBuffer#offset}.
     * @param {number=} end End offset, defaults to {@link ByteBuffer#limit}.
     * @returns {!ByteBuffer} Copy
     * @expose
     */
    ByteBufferPrototype.copy = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        if (!this.noAssert) {
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        if (begin === end)
            return new ByteBuffer(0, this.littleEndian, this.noAssert);
        var capacity = end - begin, bb = new ByteBuffer(capacity, this.littleEndian, this.noAssert);
        bb.offset = 0;
        bb.limit = capacity;
        if (bb.markedOffset >= 0)
            bb.markedOffset -= begin;
        this.copyTo(bb, 0, begin, end);
        return bb;
    };
    /**
     * Copies this ByteBuffer's contents to another ByteBuffer. Contents are the bytes between {@link ByteBuffer#offset} and
     *  {@link ByteBuffer#limit}.
     * @param {!ByteBuffer} target Target ByteBuffer
     * @param {number=} targetOffset Offset to copy to. Will use and increase the target's {@link ByteBuffer#offset}
     *  by the number of bytes copied if omitted.
     * @param {number=} sourceOffset Offset to start copying from. Will use and increase {@link ByteBuffer#offset} by the
     *  number of bytes copied if omitted.
     * @param {number=} sourceLimit Offset to end copying from, defaults to {@link ByteBuffer#limit}
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.copyTo = function (target, targetOffset, sourceOffset, sourceLimit) {
        var relative, targetRelative;
        if (!this.noAssert) {
            if (!ByteBuffer.isByteBuffer(target))
                throw TypeError("Illegal target: Not a ByteBuffer");
        }
        targetOffset = (targetRelative = typeof targetOffset === 'undefined') ? target.offset : targetOffset | 0;
        sourceOffset = (relative = typeof sourceOffset === 'undefined') ? this.offset : sourceOffset | 0;
        sourceLimit = typeof sourceLimit === 'undefined' ? this.limit : sourceLimit | 0;
        if (targetOffset < 0 || targetOffset > target.buffer.byteLength)
            throw RangeError("Illegal target range: 0 <= " + targetOffset + " <= " + target.buffer.byteLength);
        if (sourceOffset < 0 || sourceLimit > this.buffer.byteLength)
            throw RangeError("Illegal source range: 0 <= " + sourceOffset + " <= " + this.buffer.byteLength);
        var len = sourceLimit - sourceOffset;
        if (len === 0)
            return target; // Nothing to copy
        target.ensureCapacity(targetOffset + len);
        target.view.set(this.view.subarray(sourceOffset, sourceLimit), targetOffset);
        if (relative)
            this.offset += len;
        if (targetRelative)
            target.offset += len;
        return this;
    };
    /**
     * Makes sure that this ByteBuffer is backed by a {@link ByteBuffer#buffer} of at least the specified capacity. If the
     *  current capacity is exceeded, it will be doubled. If double the current capacity is less than the required capacity,
     *  the required capacity will be used instead.
     * @param {number} capacity Required capacity
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.ensureCapacity = function (capacity) {
        var current = this.buffer.byteLength;
        if (current < capacity)
            return this.resize((current *= 2) > capacity ? current : capacity);
        return this;
    };
    /**
     * Overwrites this ByteBuffer's contents with the specified value. Contents are the bytes between
     *  {@link ByteBuffer#offset} and {@link ByteBuffer#limit}.
     * @param {number|string} value Byte value to fill with. If given as a string, the first character is used.
     * @param {number=} begin Begin offset. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted. defaults to {@link ByteBuffer#offset}.
     * @param {number=} end End offset, defaults to {@link ByteBuffer#limit}.
     * @returns {!ByteBuffer} this
     * @expose
     * @example `someByteBuffer.clear().fill(0)` fills the entire backing buffer with zeroes
     */
    ByteBufferPrototype.fill = function (value, begin, end) {
        var relative = typeof begin === 'undefined';
        if (relative)
            begin = this.offset;
        if (typeof value === 'string' && value.length > 0)
            value = value.charCodeAt(0);
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value |= 0;
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        if (begin >= end)
            return this; // Nothing to fill
        while (begin < end)
            this.view[begin++] = value;
        if (relative)
            this.offset = begin;
        return this;
    };
    /**
     * Makes this ByteBuffer ready for a new sequence of write or relative read operations. Sets `limit = offset` and
     *  `offset = 0`. Make sure always to flip a ByteBuffer when all relative read or write operations are complete.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.flip = function () {
        this.limit = this.offset;
        this.offset = 0;
        return this;
    };
    /**
     * Marks an offset on this ByteBuffer to be used later.
     * @param {number=} offset Offset to mark. Defaults to {@link ByteBuffer#offset}.
     * @returns {!ByteBuffer} this
     * @throws {TypeError} If `offset` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @see ByteBuffer#reset
     * @expose
     */
    ByteBufferPrototype.mark = function (offset) {
        offset = typeof offset === 'undefined' ? this.offset : offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        this.markedOffset = offset;
        return this;
    };
    /**
     * Sets the byte order.
     * @param {boolean} littleEndian `true` for little endian byte order, `false` for big endian
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.order = function (littleEndian) {
        if (!this.noAssert) {
            if (typeof littleEndian !== 'boolean')
                throw TypeError("Illegal littleEndian: Not a boolean");
        }
        this.littleEndian = !!littleEndian;
        return this;
    };
    /**
     * Switches (to) little endian byte order.
     * @param {boolean=} littleEndian Defaults to `true`, otherwise uses big endian
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.LE = function (littleEndian) {
        this.littleEndian = typeof littleEndian !== 'undefined' ? !!littleEndian : true;
        return this;
    };
    /**
     * Switches (to) big endian byte order.
     * @param {boolean=} bigEndian Defaults to `true`, otherwise uses little endian
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.BE = function (bigEndian) {
        this.littleEndian = typeof bigEndian !== 'undefined' ? !bigEndian : false;
        return this;
    };
    /**
     * Prepends some data to this ByteBuffer. This will overwrite any contents before the specified offset up to the
     *  prepended data's length. If there is not enough space available before the specified `offset`, the backing buffer
     *  will be resized and its contents moved accordingly.
     * @param {!ByteBuffer|string|!ArrayBuffer} source Data to prepend. If `source` is a ByteBuffer, its offset will be
     *  modified according to the performed read operation.
     * @param {(string|number)=} encoding Encoding if `data` is a string ("base64", "hex", "binary", defaults to "utf8")
     * @param {number=} offset Offset to prepend at. Will use and decrease {@link ByteBuffer#offset} by the number of bytes
     *  prepended if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     * @example A relative `00<01 02 03>.prepend(<04 05>)` results in `<04 05 01 02 03>, 04 05|`
     * @example An absolute `00<01 02 03>.prepend(<04 05>, 2)` results in `04<05 02 03>, 04 05|`
     */
    ByteBufferPrototype.prepend = function (source, encoding, offset) {
        if (typeof encoding === 'number' || typeof encoding !== 'string') {
            offset = encoding;
            encoding = undefined;
        }
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        if (!(source instanceof ByteBuffer))
            source = ByteBuffer.wrap(source, encoding);
        var len = source.limit - source.offset;
        if (len <= 0)
            return this; // Nothing to prepend
        var diff = len - offset;
        if (diff > 0) {
            var buffer = new ArrayBuffer(this.buffer.byteLength + diff);
            var view = new Uint8Array(buffer);
            view.set(this.view.subarray(offset, this.buffer.byteLength), len);
            this.buffer = buffer;
            this.view = view;
            this.offset += diff;
            if (this.markedOffset >= 0)
                this.markedOffset += diff;
            this.limit += diff;
            offset += diff;
        }
        else {
            var arrayView = new Uint8Array(this.buffer);
        }
        this.view.set(source.view.subarray(source.offset, source.limit), offset - len);
        source.offset = source.limit;
        if (relative)
            this.offset -= len;
        return this;
    };
    /**
     * Prepends this ByteBuffer to another ByteBuffer. This will overwrite any contents before the specified offset up to the
     *  prepended data's length. If there is not enough space available before the specified `offset`, the backing buffer
     *  will be resized and its contents moved accordingly.
     * @param {!ByteBuffer} target Target ByteBuffer
     * @param {number=} offset Offset to prepend at. Will use and decrease {@link ByteBuffer#offset} by the number of bytes
     *  prepended if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     * @see ByteBuffer#prepend
     */
    ByteBufferPrototype.prependTo = function (target, offset) {
        target.prepend(this, offset);
        return this;
    };
    /**
     * Prints debug information about this ByteBuffer's contents.
     * @param {function(string)=} out Output function to call, defaults to console.log
     * @expose
     */
    ByteBufferPrototype.printDebug = function (out) {
        if (typeof out !== 'function')
            out = console.log.bind(console);
        out(this.toString() + "\n" +
            "-------------------------------------------------------------------\n" +
            this.toDebug(/* columns */ true));
    };
    /**
     * Gets the number of remaining readable bytes. Contents are the bytes between {@link ByteBuffer#offset} and
     *  {@link ByteBuffer#limit}, so this returns `limit - offset`.
     * @returns {number} Remaining readable bytes. May be negative if `offset > limit`.
     * @expose
     */
    ByteBufferPrototype.remaining = function () {
        return this.limit - this.offset;
    };
    /**
     * Resets this ByteBuffer's {@link ByteBuffer#offset}. If an offset has been marked through {@link ByteBuffer#mark}
     *  before, `offset` will be set to {@link ByteBuffer#markedOffset}, which will then be discarded. If no offset has been
     *  marked, sets `offset = 0`.
     * @returns {!ByteBuffer} this
     * @see ByteBuffer#mark
     * @expose
     */
    ByteBufferPrototype.reset = function () {
        if (this.markedOffset >= 0) {
            this.offset = this.markedOffset;
            this.markedOffset = -1;
        }
        else {
            this.offset = 0;
        }
        return this;
    };
    /**
     * Resizes this ByteBuffer to be backed by a buffer of at least the given capacity. Will do nothing if already that
     *  large or larger.
     * @param {number} capacity Capacity required
     * @returns {!ByteBuffer} this
     * @throws {TypeError} If `capacity` is not a number
     * @throws {RangeError} If `capacity < 0`
     * @expose
     */
    ByteBufferPrototype.resize = function (capacity) {
        if (!this.noAssert) {
            if (typeof capacity !== 'number' || capacity % 1 !== 0)
                throw TypeError("Illegal capacity: " + capacity + " (not an integer)");
            capacity |= 0;
            if (capacity < 0)
                throw RangeError("Illegal capacity: 0 <= " + capacity);
        }
        if (this.buffer.byteLength < capacity) {
            var buffer = new ArrayBuffer(capacity);
            var view = new Uint8Array(buffer);
            view.set(this.view);
            this.buffer = buffer;
            this.view = view;
        }
        return this;
    };
    /**
     * Reverses this ByteBuffer's contents.
     * @param {number=} begin Offset to start at, defaults to {@link ByteBuffer#offset}
     * @param {number=} end Offset to end at, defaults to {@link ByteBuffer#limit}
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.reverse = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        if (!this.noAssert) {
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        if (begin === end)
            return this; // Nothing to reverse
        Array.prototype.reverse.call(this.view.subarray(begin, end));
        return this;
    };
    /**
     * Skips the next `length` bytes. This will just advance
     * @param {number} length Number of bytes to skip. May also be negative to move the offset back.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.skip = function (length) {
        if (!this.noAssert) {
            if (typeof length !== 'number' || length % 1 !== 0)
                throw TypeError("Illegal length: " + length + " (not an integer)");
            length |= 0;
        }
        var offset = this.offset + length;
        if (!this.noAssert) {
            if (offset < 0 || offset > this.buffer.byteLength)
                throw RangeError("Illegal length: 0 <= " + this.offset + " + " + length + " <= " + this.buffer.byteLength);
        }
        this.offset = offset;
        return this;
    };
    /**
     * Slices this ByteBuffer by creating a cloned instance with `offset = begin` and `limit = end`.
     * @param {number=} begin Begin offset, defaults to {@link ByteBuffer#offset}.
     * @param {number=} end End offset, defaults to {@link ByteBuffer#limit}.
     * @returns {!ByteBuffer} Clone of this ByteBuffer with slicing applied, backed by the same {@link ByteBuffer#buffer}
     * @expose
     */
    ByteBufferPrototype.slice = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        if (!this.noAssert) {
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        var bb = this.clone();
        bb.offset = begin;
        bb.limit = end;
        return bb;
    };
    /**
     * Returns a copy of the backing buffer that contains this ByteBuffer's contents. Contents are the bytes between
     *  {@link ByteBuffer#offset} and {@link ByteBuffer#limit}.
     * @param {boolean=} forceCopy If `true` returns a copy, otherwise returns a view referencing the same memory if
     *  possible. Defaults to `false`
     * @returns {!ArrayBuffer} Contents as an ArrayBuffer
     * @expose
     */
    ByteBufferPrototype.toBuffer = function (forceCopy) {
        var offset = this.offset, limit = this.limit;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: Not an integer");
            offset >>>= 0;
            if (typeof limit !== 'number' || limit % 1 !== 0)
                throw TypeError("Illegal limit: Not an integer");
            limit >>>= 0;
            if (offset < 0 || offset > limit || limit > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + offset + " <= " + limit + " <= " + this.buffer.byteLength);
        }
        // NOTE: It's not possible to have another ArrayBuffer reference the same memory as the backing buffer. This is
        // possible with Uint8Array#subarray only, but we have to return an ArrayBuffer by contract. So:
        if (!forceCopy && offset === 0 && limit === this.buffer.byteLength)
            return this.buffer;
        if (offset === limit)
            return EMPTY_BUFFER;
        var buffer = new ArrayBuffer(limit - offset);
        new Uint8Array(buffer).set(new Uint8Array(this.buffer).subarray(offset, limit), 0);
        return buffer;
    };
    /**
     * Returns a raw buffer compacted to contain this ByteBuffer's contents. Contents are the bytes between
     *  {@link ByteBuffer#offset} and {@link ByteBuffer#limit}. This is an alias of {@link ByteBuffer#toBuffer}.
     * @function
     * @param {boolean=} forceCopy If `true` returns a copy, otherwise returns a view referencing the same memory.
     *  Defaults to `false`
     * @returns {!ArrayBuffer} Contents as an ArrayBuffer
     * @expose
     */
    ByteBufferPrototype.toArrayBuffer = ByteBufferPrototype.toBuffer;
    /**
     * Converts the ByteBuffer's contents to a string.
     * @param {string=} encoding Output encoding. Returns an informative string representation if omitted but also allows
     *  direct conversion to "utf8", "hex", "base64" and "binary" encoding. "debug" returns a hex representation with
     *  highlighted offsets.
     * @param {number=} begin Offset to begin at, defaults to {@link ByteBuffer#offset}
     * @param {number=} end Offset to end at, defaults to {@link ByteBuffer#limit}
     * @returns {string} String representation
     * @throws {Error} If `encoding` is invalid
     * @expose
     */
    ByteBufferPrototype.toString = function (encoding, begin, end) {
        if (typeof encoding === 'undefined')
            return "ByteBufferAB(offset=" + this.offset + ",markedOffset=" + this.markedOffset + ",limit=" + this.limit + ",capacity=" + this.capacity() + ")";
        if (typeof encoding === 'number')
            encoding = "utf8",
                begin = encoding,
                end = begin;
        switch (encoding) {
            case "utf8":
                return this.toUTF8(begin, end);
            case "base64":
                return this.toBase64(begin, end);
            case "hex":
                return this.toHex(begin, end);
            case "binary":
                return this.toBinary(begin, end);
            case "debug":
                return this.toDebug();
            case "columns":
                return this.toColumns();
            default:
                throw Error("Unsupported encoding: " + encoding);
        }
    };
    // lxiv-embeddable
    /**
     * lxiv-embeddable (c) 2014 Daniel Wirtz <dcode@dcode.io>
     * Released under the Apache License, Version 2.0
     * see: https://github.com/dcodeIO/lxiv for details
     */
    var lxiv = function () {
        "use strict";
        /**
         * lxiv namespace.
         * @type {!Object.<string,*>}
         * @exports lxiv
         */
        var lxiv = {};
        /**
         * Character codes for output.
         * @type {!Array.<number>}
         * @inner
         */
        var aout = [
            65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
            81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 97, 98, 99, 100, 101, 102,
            103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118,
            119, 120, 121, 122, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 43, 47
        ];
        /**
         * Character codes for input.
         * @type {!Array.<number>}
         * @inner
         */
        var ain = [];
        for (var i = 0, k = aout.length; i < k; ++i)
            ain[aout[i]] = i;
        /**
         * Encodes bytes to base64 char codes.
         * @param {!function():number|null} src Bytes source as a function returning the next byte respectively `null` if
         *  there are no more bytes left.
         * @param {!function(number)} dst Characters destination as a function successively called with each encoded char
         *  code.
         */
        lxiv.encode = function (src, dst) {
            var b, t;
            while ((b = src()) !== null) {
                dst(aout[(b >> 2) & 0x3f]);
                t = (b & 0x3) << 4;
                if ((b = src()) !== null) {
                    t |= (b >> 4) & 0xf;
                    dst(aout[(t | ((b >> 4) & 0xf)) & 0x3f]);
                    t = (b & 0xf) << 2;
                    if ((b = src()) !== null)
                        dst(aout[(t | ((b >> 6) & 0x3)) & 0x3f]),
                            dst(aout[b & 0x3f]);
                    else
                        dst(aout[t & 0x3f]),
                            dst(61);
                }
                else
                    dst(aout[t & 0x3f]),
                        dst(61),
                        dst(61);
            }
        };
        /**
         * Decodes base64 char codes to bytes.
         * @param {!function():number|null} src Characters source as a function returning the next char code respectively
         *  `null` if there are no more characters left.
         * @param {!function(number)} dst Bytes destination as a function successively called with the next byte.
         * @throws {Error} If a character code is invalid
         */
        lxiv.decode = function (src, dst) {
            var c, t1, t2;
            function fail(c) {
                throw Error("Illegal character code: " + c);
            }
            while ((c = src()) !== null) {
                t1 = ain[c];
                if (typeof t1 === 'undefined')
                    fail(c);
                if ((c = src()) !== null) {
                    t2 = ain[c];
                    if (typeof t2 === 'undefined')
                        fail(c);
                    dst((t1 << 2) >>> 0 | (t2 & 0x30) >> 4);
                    if ((c = src()) !== null) {
                        t1 = ain[c];
                        if (typeof t1 === 'undefined')
                            if (c === 61)
                                break;
                            else
                                fail(c);
                        dst(((t2 & 0xf) << 4) >>> 0 | (t1 & 0x3c) >> 2);
                        if ((c = src()) !== null) {
                            t2 = ain[c];
                            if (typeof t2 === 'undefined')
                                if (c === 61)
                                    break;
                                else
                                    fail(c);
                            dst(((t1 & 0x3) << 6) >>> 0 | t2);
                        }
                    }
                }
            }
        };
        /**
         * Tests if a string is valid base64.
         * @param {string} str String to test
         * @returns {boolean} `true` if valid, otherwise `false`
         */
        lxiv.test = function (str) {
            return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(str);
        };
        return lxiv;
    }();
    // encodings/base64
    /**
     * Encodes this ByteBuffer's contents to a base64 encoded string.
     * @param {number=} begin Offset to begin at, defaults to {@link ByteBuffer#offset}.
     * @param {number=} end Offset to end at, defaults to {@link ByteBuffer#limit}.
     * @returns {string} Base64 encoded string
     * @throws {RangeError} If `begin` or `end` is out of bounds
     * @expose
     */
    ByteBufferPrototype.toBase64 = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        begin = begin | 0;
        end = end | 0;
        if (begin < 0 || end > this.capacity || begin > end)
            throw RangeError("begin, end");
        var sd;
        lxiv.encode(function () {
            return begin < end ? this.view[begin++] : null;
        }.bind(this), sd = stringDestination());
        return sd();
    };
    /**
     * Decodes a base64 encoded string to a ByteBuffer.
     * @param {string} str String to decode
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @returns {!ByteBuffer} ByteBuffer
     * @expose
     */
    ByteBuffer.fromBase64 = function (str, littleEndian) {
        if (typeof str !== 'string')
            throw TypeError("str");
        var bb = new ByteBuffer(str.length / 4 * 3, littleEndian), i = 0;
        lxiv.decode(stringSource(str), function (b) {
            bb.view[i++] = b;
        });
        bb.limit = i;
        return bb;
    };
    /**
     * Encodes a binary string to base64 like `window.btoa` does.
     * @param {string} str Binary string
     * @returns {string} Base64 encoded string
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Window.btoa
     * @expose
     */
    ByteBuffer.btoa = function (str) {
        return ByteBuffer.fromBinary(str).toBase64();
    };
    /**
     * Decodes a base64 encoded string to binary like `window.atob` does.
     * @param {string} b64 Base64 encoded string
     * @returns {string} Binary string
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Window.atob
     * @expose
     */
    ByteBuffer.atob = function (b64) {
        return ByteBuffer.fromBase64(b64).toBinary();
    };
    // encodings/binary
    /**
     * Encodes this ByteBuffer to a binary encoded string, that is using only characters 0x00-0xFF as bytes.
     * @param {number=} begin Offset to begin at. Defaults to {@link ByteBuffer#offset}.
     * @param {number=} end Offset to end at. Defaults to {@link ByteBuffer#limit}.
     * @returns {string} Binary encoded string
     * @throws {RangeError} If `offset > limit`
     * @expose
     */
    ByteBufferPrototype.toBinary = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        begin |= 0;
        end |= 0;
        if (begin < 0 || end > this.capacity() || begin > end)
            throw RangeError("begin, end");
        if (begin === end)
            return "";
        var chars = [], parts = [];
        while (begin < end) {
            chars.push(this.view[begin++]);
            if (chars.length >= 1024)
                parts.push(String.fromCharCode.apply(String, chars)),
                    chars = [];
        }
        return parts.join('') + String.fromCharCode.apply(String, chars);
    };
    /**
     * Decodes a binary encoded string, that is using only characters 0x00-0xFF as bytes, to a ByteBuffer.
     * @param {string} str String to decode
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @returns {!ByteBuffer} ByteBuffer
     * @expose
     */
    ByteBuffer.fromBinary = function (str, littleEndian) {
        if (typeof str !== 'string')
            throw TypeError("str");
        var i = 0, k = str.length, charCode, bb = new ByteBuffer(k, littleEndian);
        while (i < k) {
            charCode = str.charCodeAt(i);
            if (charCode > 0xff)
                throw RangeError("illegal char code: " + charCode);
            bb.view[i++] = charCode;
        }
        bb.limit = k;
        return bb;
    };
    // encodings/debug
    /**
     * Encodes this ByteBuffer to a hex encoded string with marked offsets. Offset symbols are:
     * * `<` : offset,
     * * `'` : markedOffset,
     * * `>` : limit,
     * * `|` : offset and limit,
     * * `[` : offset and markedOffset,
     * * `]` : markedOffset and limit,
     * * `!` : offset, markedOffset and limit
     * @param {boolean=} columns If `true` returns two columns hex + ascii, defaults to `false`
     * @returns {string|!Array.<string>} Debug string or array of lines if `asArray = true`
     * @expose
     * @example `>00'01 02<03` contains four bytes with `limit=0, markedOffset=1, offset=3`
     * @example `00[01 02 03>` contains four bytes with `offset=markedOffset=1, limit=4`
     * @example `00|01 02 03` contains four bytes with `offset=limit=1, markedOffset=-1`
     * @example `|` contains zero bytes with `offset=limit=0, markedOffset=-1`
     */
    ByteBufferPrototype.toDebug = function (columns) {
        var i = -1, k = this.buffer.byteLength, b, hex = "", asc = "", out = "";
        while (i < k) {
            if (i !== -1) {
                b = this.view[i];
                if (b < 0x10)
                    hex += "0" + b.toString(16).toUpperCase();
                else
                    hex += b.toString(16).toUpperCase();
                if (columns)
                    asc += b > 32 && b < 127 ? String.fromCharCode(b) : '.';
            }
            ++i;
            if (columns) {
                if (i > 0 && i % 16 === 0 && i !== k) {
                    while (hex.length < 3 * 16 + 3)
                        hex += " ";
                    out += hex + asc + "\n";
                    hex = asc = "";
                }
            }
            if (i === this.offset && i === this.limit)
                hex += i === this.markedOffset ? "!" : "|";
            else if (i === this.offset)
                hex += i === this.markedOffset ? "[" : "<";
            else if (i === this.limit)
                hex += i === this.markedOffset ? "]" : ">";
            else
                hex += i === this.markedOffset ? "'" : (columns || (i !== 0 && i !== k) ? " " : "");
        }
        if (columns && hex !== " ") {
            while (hex.length < 3 * 16 + 3)
                hex += " ";
            out += hex + asc + "\n";
        }
        return columns ? out : hex;
    };
    /**
     * Decodes a hex encoded string with marked offsets to a ByteBuffer.
     * @param {string} str Debug string to decode (not be generated with `columns = true`)
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @returns {!ByteBuffer} ByteBuffer
     * @expose
     * @see ByteBuffer#toDebug
     */
    ByteBuffer.fromDebug = function (str, littleEndian, noAssert) {
        var k = str.length, bb = new ByteBuffer(((k + 1) / 3) | 0, littleEndian, noAssert);
        var i = 0, j = 0, ch, b, rs = false, // Require symbol next
        ho = false, hm = false, hl = false, // Already has offset (ho), markedOffset (hm), limit (hl)?
        fail = false;
        while (i < k) {
            switch (ch = str.charAt(i++)) {
                case '!':
                    if (!noAssert) {
                        if (ho || hm || hl) {
                            fail = true;
                            break;
                        }
                        ho = hm = hl = true;
                    }
                    bb.offset = bb.markedOffset = bb.limit = j;
                    rs = false;
                    break;
                case '|':
                    if (!noAssert) {
                        if (ho || hl) {
                            fail = true;
                            break;
                        }
                        ho = hl = true;
                    }
                    bb.offset = bb.limit = j;
                    rs = false;
                    break;
                case '[':
                    if (!noAssert) {
                        if (ho || hm) {
                            fail = true;
                            break;
                        }
                        ho = hm = true;
                    }
                    bb.offset = bb.markedOffset = j;
                    rs = false;
                    break;
                case '<':
                    if (!noAssert) {
                        if (ho) {
                            fail = true;
                            break;
                        }
                        ho = true;
                    }
                    bb.offset = j;
                    rs = false;
                    break;
                case ']':
                    if (!noAssert) {
                        if (hl || hm) {
                            fail = true;
                            break;
                        }
                        hl = hm = true;
                    }
                    bb.limit = bb.markedOffset = j;
                    rs = false;
                    break;
                case '>':
                    if (!noAssert) {
                        if (hl) {
                            fail = true;
                            break;
                        }
                        hl = true;
                    }
                    bb.limit = j;
                    rs = false;
                    break;
                case "'":
                    if (!noAssert) {
                        if (hm) {
                            fail = true;
                            break;
                        }
                        hm = true;
                    }
                    bb.markedOffset = j;
                    rs = false;
                    break;
                case ' ':
                    rs = false;
                    break;
                default:
                    if (!noAssert) {
                        if (rs) {
                            fail = true;
                            break;
                        }
                    }
                    b = parseInt(ch + str.charAt(i++), 16);
                    if (!noAssert) {
                        if (isNaN(b) || b < 0 || b > 255)
                            throw TypeError("Illegal str: Not a debug encoded string");
                    }
                    bb.view[j++] = b;
                    rs = true;
            }
            if (fail)
                throw TypeError("Illegal str: Invalid symbol at " + i);
        }
        if (!noAssert) {
            if (!ho || !hl)
                throw TypeError("Illegal str: Missing offset or limit");
            if (j < bb.buffer.byteLength)
                throw TypeError("Illegal str: Not a debug encoded string (is it hex?) " + j + " < " + k);
        }
        return bb;
    };
    // encodings/hex
    /**
     * Encodes this ByteBuffer's contents to a hex encoded string.
     * @param {number=} begin Offset to begin at. Defaults to {@link ByteBuffer#offset}.
     * @param {number=} end Offset to end at. Defaults to {@link ByteBuffer#limit}.
     * @returns {string} Hex encoded string
     * @expose
     */
    ByteBufferPrototype.toHex = function (begin, end) {
        begin = typeof begin === 'undefined' ? this.offset : begin;
        end = typeof end === 'undefined' ? this.limit : end;
        if (!this.noAssert) {
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        var out = new Array(end - begin), b;
        while (begin < end) {
            b = this.view[begin++];
            if (b < 0x10)
                out.push("0", b.toString(16));
            else
                out.push(b.toString(16));
        }
        return out.join('');
    };
    /**
     * Decodes a hex encoded string to a ByteBuffer.
     * @param {string} str String to decode
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @returns {!ByteBuffer} ByteBuffer
     * @expose
     */
    ByteBuffer.fromHex = function (str, littleEndian, noAssert) {
        if (!noAssert) {
            if (typeof str !== 'string')
                throw TypeError("Illegal str: Not a string");
            if (str.length % 2 !== 0)
                throw TypeError("Illegal str: Length not a multiple of 2");
        }
        var k = str.length, bb = new ByteBuffer((k / 2) | 0, littleEndian), b;
        for (var i = 0, j = 0; i < k; i += 2) {
            b = parseInt(str.substring(i, i + 2), 16);
            if (!noAssert)
                if (!isFinite(b) || b < 0 || b > 255)
                    throw TypeError("Illegal str: Contains non-hex characters");
            bb.view[j++] = b;
        }
        bb.limit = j;
        return bb;
    };
    // utfx-embeddable
    /**
     * utfx-embeddable (c) 2014 Daniel Wirtz <dcode@dcode.io>
     * Released under the Apache License, Version 2.0
     * see: https://github.com/dcodeIO/utfx for details
     */
    var utfx = function () {
        "use strict";
        /**
         * utfx namespace.
         * @inner
         * @type {!Object.<string,*>}
         */
        var utfx = {};
        /**
         * Maximum valid code point.
         * @type {number}
         * @const
         */
        utfx.MAX_CODEPOINT = 0x10FFFF;
        /**
         * Encodes UTF8 code points to UTF8 bytes.
         * @param {(!function():number|null) | number} src Code points source, either as a function returning the next code point
         *  respectively `null` if there are no more code points left or a single numeric code point.
         * @param {!function(number)} dst Bytes destination as a function successively called with the next byte
         */
        utfx.encodeUTF8 = function (src, dst) {
            var cp = null;
            if (typeof src === 'number')
                cp = src,
                    src = function () { return null; };
            while (cp !== null || (cp = src()) !== null) {
                if (cp < 0x80)
                    dst(cp & 0x7F);
                else if (cp < 0x800)
                    dst(((cp >> 6) & 0x1F) | 0xC0),
                        dst((cp & 0x3F) | 0x80);
                else if (cp < 0x10000)
                    dst(((cp >> 12) & 0x0F) | 0xE0),
                        dst(((cp >> 6) & 0x3F) | 0x80),
                        dst((cp & 0x3F) | 0x80);
                else
                    dst(((cp >> 18) & 0x07) | 0xF0),
                        dst(((cp >> 12) & 0x3F) | 0x80),
                        dst(((cp >> 6) & 0x3F) | 0x80),
                        dst((cp & 0x3F) | 0x80);
                cp = null;
            }
        };
        /**
         * Decodes UTF8 bytes to UTF8 code points.
         * @param {!function():number|null} src Bytes source as a function returning the next byte respectively `null` if there
         *  are no more bytes left.
         * @param {!function(number)} dst Code points destination as a function successively called with each decoded code point.
         * @throws {RangeError} If a starting byte is invalid in UTF8
         * @throws {Error} If the last sequence is truncated. Has an array property `bytes` holding the
         *  remaining bytes.
         */
        utfx.decodeUTF8 = function (src, dst) {
            var a, b, c, d, fail = function (b) {
                b = b.slice(0, b.indexOf(null));
                var err = Error(b.toString());
                err.name = "TruncatedError";
                err['bytes'] = b;
                throw err;
            };
            while ((a = src()) !== null) {
                if ((a & 0x80) === 0)
                    dst(a);
                else if ((a & 0xE0) === 0xC0)
                    ((b = src()) === null) && fail([a, b]),
                        dst(((a & 0x1F) << 6) | (b & 0x3F));
                else if ((a & 0xF0) === 0xE0)
                    ((b = src()) === null || (c = src()) === null) && fail([a, b, c]),
                        dst(((a & 0x0F) << 12) | ((b & 0x3F) << 6) | (c & 0x3F));
                else if ((a & 0xF8) === 0xF0)
                    ((b = src()) === null || (c = src()) === null || (d = src()) === null) && fail([a, b, c, d]),
                        dst(((a & 0x07) << 18) | ((b & 0x3F) << 12) | ((c & 0x3F) << 6) | (d & 0x3F));
                else
                    throw RangeError("Illegal starting byte: " + a);
            }
        };
        /**
         * Converts UTF16 characters to UTF8 code points.
         * @param {!function():number|null} src Characters source as a function returning the next char code respectively
         *  `null` if there are no more characters left.
         * @param {!function(number)} dst Code points destination as a function successively called with each converted code
         *  point.
         */
        utfx.UTF16toUTF8 = function (src, dst) {
            var c1, c2 = null;
            while (true) {
                if ((c1 = c2 !== null ? c2 : src()) === null)
                    break;
                if (c1 >= 0xD800 && c1 <= 0xDFFF) {
                    if ((c2 = src()) !== null) {
                        if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
                            dst((c1 - 0xD800) * 0x400 + c2 - 0xDC00 + 0x10000);
                            c2 = null;
                            continue;
                        }
                    }
                }
                dst(c1);
            }
            if (c2 !== null)
                dst(c2);
        };
        /**
         * Converts UTF8 code points to UTF16 characters.
         * @param {(!function():number|null) | number} src Code points source, either as a function returning the next code point
         *  respectively `null` if there are no more code points left or a single numeric code point.
         * @param {!function(number)} dst Characters destination as a function successively called with each converted char code.
         * @throws {RangeError} If a code point is out of range
         */
        utfx.UTF8toUTF16 = function (src, dst) {
            var cp = null;
            if (typeof src === 'number')
                cp = src, src = function () { return null; };
            while (cp !== null || (cp = src()) !== null) {
                if (cp <= 0xFFFF)
                    dst(cp);
                else
                    cp -= 0x10000,
                        dst((cp >> 10) + 0xD800),
                        dst((cp % 0x400) + 0xDC00);
                cp = null;
            }
        };
        /**
         * Converts and encodes UTF16 characters to UTF8 bytes.
         * @param {!function():number|null} src Characters source as a function returning the next char code respectively `null`
         *  if there are no more characters left.
         * @param {!function(number)} dst Bytes destination as a function successively called with the next byte.
         */
        utfx.encodeUTF16toUTF8 = function (src, dst) {
            utfx.UTF16toUTF8(src, function (cp) {
                utfx.encodeUTF8(cp, dst);
            });
        };
        /**
         * Decodes and converts UTF8 bytes to UTF16 characters.
         * @param {!function():number|null} src Bytes source as a function returning the next byte respectively `null` if there
         *  are no more bytes left.
         * @param {!function(number)} dst Characters destination as a function successively called with each converted char code.
         * @throws {RangeError} If a starting byte is invalid in UTF8
         * @throws {Error} If the last sequence is truncated. Has an array property `bytes` holding the remaining bytes.
         */
        utfx.decodeUTF8toUTF16 = function (src, dst) {
            utfx.decodeUTF8(src, function (cp) {
                utfx.UTF8toUTF16(cp, dst);
            });
        };
        /**
         * Calculates the byte length of an UTF8 code point.
         * @param {number} cp UTF8 code point
         * @returns {number} Byte length
         */
        utfx.calculateCodePoint = function (cp) {
            return (cp < 0x80) ? 1 : (cp < 0x800) ? 2 : (cp < 0x10000) ? 3 : 4;
        };
        /**
         * Calculates the number of UTF8 bytes required to store UTF8 code points.
         * @param {(!function():number|null)} src Code points source as a function returning the next code point respectively
         *  `null` if there are no more code points left.
         * @returns {number} The number of UTF8 bytes required
         */
        utfx.calculateUTF8 = function (src) {
            var cp, l = 0;
            while ((cp = src()) !== null)
                l += (cp < 0x80) ? 1 : (cp < 0x800) ? 2 : (cp < 0x10000) ? 3 : 4;
            return l;
        };
        /**
         * Calculates the number of UTF8 code points respectively UTF8 bytes required to store UTF16 char codes.
         * @param {(!function():number|null)} src Characters source as a function returning the next char code respectively
         *  `null` if there are no more characters left.
         * @returns {!Array.<number>} The number of UTF8 code points at index 0 and the number of UTF8 bytes required at index 1.
         */
        utfx.calculateUTF16asUTF8 = function (src) {
            var n = 0, l = 0;
            utfx.UTF16toUTF8(src, function (cp) {
                ++n;
                l += (cp < 0x80) ? 1 : (cp < 0x800) ? 2 : (cp < 0x10000) ? 3 : 4;
            });
            return [n, l];
        };
        return utfx;
    }();
    // encodings/utf8
    /**
     * Encodes this ByteBuffer's contents between {@link ByteBuffer#offset} and {@link ByteBuffer#limit} to an UTF8 encoded
     *  string.
     * @returns {string} Hex encoded string
     * @throws {RangeError} If `offset > limit`
     * @expose
     */
    ByteBufferPrototype.toUTF8 = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        if (!this.noAssert) {
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        var sd;
        try {
            utfx.decodeUTF8toUTF16(function () {
                return begin < end ? this.view[begin++] : null;
            }.bind(this), sd = stringDestination());
        }
        catch (e) {
            if (begin !== end)
                throw RangeError("Illegal range: Truncated data, " + begin + " != " + end);
        }
        return sd();
    };
    /**
     * Decodes an UTF8 encoded string to a ByteBuffer.
     * @param {string} str String to decode
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @returns {!ByteBuffer} ByteBuffer
     * @expose
     */
    ByteBuffer.fromUTF8 = function (str, littleEndian, noAssert) {
        if (!noAssert)
            if (typeof str !== 'string')
                throw TypeError("Illegal str: Not a string");
        var bb = new ByteBuffer(utfx.calculateUTF16asUTF8(stringSource(str), true)[1], littleEndian, noAssert), i = 0;
        utfx.encodeUTF16toUTF8(stringSource(str), function (b) {
            bb.view[i++] = b;
        });
        bb.limit = i;
        return bb;
    };
    return ByteBuffer;
});
/*
 Copyright 2013-2014 Daniel Wirtz <dcode@dcode.io>

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */
/**
 * @license bytebuffer.js (c) 2015 Daniel Wirtz <dcode@dcode.io>
 * Backing buffer: ArrayBuffer, Accessor: DataView
 * Released under the Apache License, Version 2.0
 * see: https://github.com/dcodeIO/bytebuffer.js for details
 */
(function (global, factory) {
    /* AMD */ if (typeof define === 'function' && define["amd"])
        define(["long"], factory);
    else if (typeof require === 'function' && typeof module === "object" && module && module["exports"])
        module['exports'] = (function () {
            var Long;
            try {
                Long = require("long");
            }
            catch (e) { }
            return factory(Long);
        })();
    else
        (global["dcodeIO"] = global["dcodeIO"] || {})["ByteBuffer"] = factory(global["dcodeIO"]["Long"]);
})(this, function (Long) {
    "use strict";
    /**
     * Constructs a new ByteBuffer.
     * @class The swiss army knife for binary data in JavaScript.
     * @exports ByteBuffer
     * @constructor
     * @param {number=} capacity Initial capacity. Defaults to {@link ByteBuffer.DEFAULT_CAPACITY}.
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @expose
     */
    var ByteBuffer = function (capacity, littleEndian, noAssert) {
        if (typeof capacity === 'undefined')
            capacity = ByteBuffer.DEFAULT_CAPACITY;
        if (typeof littleEndian === 'undefined')
            littleEndian = ByteBuffer.DEFAULT_ENDIAN;
        if (typeof noAssert === 'undefined')
            noAssert = ByteBuffer.DEFAULT_NOASSERT;
        if (!noAssert) {
            capacity = capacity | 0;
            if (capacity < 0)
                throw RangeError("Illegal capacity");
            littleEndian = !!littleEndian;
            noAssert = !!noAssert;
        }
        /**
         * Backing ArrayBuffer.
         * @type {!ArrayBuffer}
         * @expose
         */
        this.buffer = capacity === 0 ? EMPTY_BUFFER : new ArrayBuffer(capacity);
        /**
         * DataView utilized to manipulate the backing buffer. Becomes `null` if the backing buffer has a capacity of `0`.
         * @type {?DataView}
         * @expose
         */
        this.view = capacity === 0 ? null : new DataView(this.buffer);
        /**
         * Absolute read/write offset.
         * @type {number}
         * @expose
         * @see ByteBuffer#flip
         * @see ByteBuffer#clear
         */
        this.offset = 0;
        /**
         * Marked offset.
         * @type {number}
         * @expose
         * @see ByteBuffer#mark
         * @see ByteBuffer#reset
         */
        this.markedOffset = -1;
        /**
         * Absolute limit of the contained data. Set to the backing buffer's capacity upon allocation.
         * @type {number}
         * @expose
         * @see ByteBuffer#flip
         * @see ByteBuffer#clear
         */
        this.limit = capacity;
        /**
         * Whether to use little endian byte order, defaults to `false` for big endian.
         * @type {boolean}
         * @expose
         */
        this.littleEndian = littleEndian;
        /**
         * Whether to skip assertions of offsets and values, defaults to `false`.
         * @type {boolean}
         * @expose
         */
        this.noAssert = noAssert;
    };
    /**
     * ByteBuffer version.
     * @type {string}
     * @const
     * @expose
     */
    ByteBuffer.VERSION = "5.0.1";
    /**
     * Little endian constant that can be used instead of its boolean value. Evaluates to `true`.
     * @type {boolean}
     * @const
     * @expose
     */
    ByteBuffer.LITTLE_ENDIAN = true;
    /**
     * Big endian constant that can be used instead of its boolean value. Evaluates to `false`.
     * @type {boolean}
     * @const
     * @expose
     */
    ByteBuffer.BIG_ENDIAN = false;
    /**
     * Default initial capacity of `16`.
     * @type {number}
     * @expose
     */
    ByteBuffer.DEFAULT_CAPACITY = 16;
    /**
     * Default endianess of `false` for big endian.
     * @type {boolean}
     * @expose
     */
    ByteBuffer.DEFAULT_ENDIAN = ByteBuffer.BIG_ENDIAN;
    /**
     * Default no assertions flag of `false`.
     * @type {boolean}
     * @expose
     */
    ByteBuffer.DEFAULT_NOASSERT = false;
    /**
     * A `Long` class for representing a 64-bit two's-complement integer value. May be `null` if Long.js has not been loaded
     *  and int64 support is not available.
     * @type {?Long}
     * @const
     * @see https://github.com/dcodeIO/long.js
     * @expose
     */
    ByteBuffer.Long = Long || null;
    /**
     * @alias ByteBuffer.prototype
     * @inner
     */
    var ByteBufferPrototype = ByteBuffer.prototype;
    /**
     * An indicator used to reliably determine if an object is a ByteBuffer or not.
     * @type {boolean}
     * @const
     * @expose
     * @private
     */
    ByteBufferPrototype.__isByteBuffer__;
    Object.defineProperty(ByteBufferPrototype, "__isByteBuffer__", {
        value: true,
        enumerable: false,
        configurable: false
    });
    // helpers
    /**
     * @type {!ArrayBuffer}
     * @inner
     */
    var EMPTY_BUFFER = new ArrayBuffer(0);
    /**
     * String.fromCharCode reference for compile-time renaming.
     * @type {function(...number):string}
     * @inner
     */
    var stringFromCharCode = String.fromCharCode;
    /**
     * Creates a source function for a string.
     * @param {string} s String to read from
     * @returns {function():number|null} Source function returning the next char code respectively `null` if there are
     *  no more characters left.
     * @throws {TypeError} If the argument is invalid
     * @inner
     */
    function stringSource(s) {
        var i = 0;
        return function () {
            return i < s.length ? s.charCodeAt(i++) : null;
        };
    }
    /**
     * Creates a destination function for a string.
     * @returns {function(number=):undefined|string} Destination function successively called with the next char code.
     *  Returns the final string when called without arguments.
     * @inner
     */
    function stringDestination() {
        var cs = [], ps = [];
        return function () {
            if (arguments.length === 0)
                return ps.join('') + stringFromCharCode.apply(String, cs);
            if (cs.length + arguments.length > 1024)
                ps.push(stringFromCharCode.apply(String, cs)),
                    cs.length = 0;
            Array.prototype.push.apply(cs, arguments);
        };
    }
    /**
     * Gets the accessor type.
     * @returns {Function} `Buffer` under node.js, `Uint8Array` respectively `DataView` in the browser (classes)
     * @expose
     */
    ByteBuffer.accessor = function () {
        return DataView;
    };
    /**
     * Allocates a new ByteBuffer backed by a buffer of the specified capacity.
     * @param {number=} capacity Initial capacity. Defaults to {@link ByteBuffer.DEFAULT_CAPACITY}.
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @returns {!ByteBuffer}
     * @expose
     */
    ByteBuffer.allocate = function (capacity, littleEndian, noAssert) {
        return new ByteBuffer(capacity, littleEndian, noAssert);
    };
    /**
     * Concatenates multiple ByteBuffers into one.
     * @param {!Array.<!ByteBuffer|!ArrayBuffer|!Uint8Array|string>} buffers Buffers to concatenate
     * @param {(string|boolean)=} encoding String encoding if `buffers` contains a string ("base64", "hex", "binary",
     *  defaults to "utf8")
     * @param {boolean=} littleEndian Whether to use little or big endian byte order for the resulting ByteBuffer. Defaults
     *  to {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values for the resulting ByteBuffer. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @returns {!ByteBuffer} Concatenated ByteBuffer
     * @expose
     */
    ByteBuffer.concat = function (buffers, encoding, littleEndian, noAssert) {
        if (typeof encoding === 'boolean' || typeof encoding !== 'string') {
            noAssert = littleEndian;
            littleEndian = encoding;
            encoding = undefined;
        }
        var capacity = 0;
        for (var i = 0, k = buffers.length, length; i < k; ++i) {
            if (!ByteBuffer.isByteBuffer(buffers[i]))
                buffers[i] = ByteBuffer.wrap(buffers[i], encoding);
            length = buffers[i].limit - buffers[i].offset;
            if (length > 0)
                capacity += length;
        }
        if (capacity === 0)
            return new ByteBuffer(0, littleEndian, noAssert);
        var bb = new ByteBuffer(capacity, littleEndian, noAssert), bi;
        var view = new Uint8Array(bb.buffer);
        i = 0;
        while (i < k) {
            bi = buffers[i++];
            length = bi.limit - bi.offset;
            if (length <= 0)
                continue;
            view.set(new Uint8Array(bi.buffer).subarray(bi.offset, bi.limit), bb.offset);
            bb.offset += length;
        }
        bb.limit = bb.offset;
        bb.offset = 0;
        return bb;
    };
    /**
     * Tests if the specified type is a ByteBuffer.
     * @param {*} bb ByteBuffer to test
     * @returns {boolean} `true` if it is a ByteBuffer, otherwise `false`
     * @expose
     */
    ByteBuffer.isByteBuffer = function (bb) {
        return (bb && bb["__isByteBuffer__"]) === true;
    };
    /**
     * Gets the backing buffer type.
     * @returns {Function} `Buffer` under node.js, `ArrayBuffer` in the browser (classes)
     * @expose
     */
    ByteBuffer.type = function () {
        return ArrayBuffer;
    };
    /**
     * Wraps a buffer or a string. Sets the allocated ByteBuffer's {@link ByteBuffer#offset} to `0` and its
     *  {@link ByteBuffer#limit} to the length of the wrapped data.
     * @param {!ByteBuffer|!ArrayBuffer|!Uint8Array|string|!Array.<number>} buffer Anything that can be wrapped
     * @param {(string|boolean)=} encoding String encoding if `buffer` is a string ("base64", "hex", "binary", defaults to
     *  "utf8")
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @returns {!ByteBuffer} A ByteBuffer wrapping `buffer`
     * @expose
     */
    ByteBuffer.wrap = function (buffer, encoding, littleEndian, noAssert) {
        if (typeof encoding !== 'string') {
            noAssert = littleEndian;
            littleEndian = encoding;
            encoding = undefined;
        }
        if (typeof buffer === 'string') {
            if (typeof encoding === 'undefined')
                encoding = "utf8";
            switch (encoding) {
                case "base64":
                    return ByteBuffer.fromBase64(buffer, littleEndian);
                case "hex":
                    return ByteBuffer.fromHex(buffer, littleEndian);
                case "binary":
                    return ByteBuffer.fromBinary(buffer, littleEndian);
                case "utf8":
                    return ByteBuffer.fromUTF8(buffer, littleEndian);
                case "debug":
                    return ByteBuffer.fromDebug(buffer, littleEndian);
                default:
                    throw Error("Unsupported encoding: " + encoding);
            }
        }
        if (buffer === null || typeof buffer !== 'object')
            throw TypeError("Illegal buffer");
        var bb;
        if (ByteBuffer.isByteBuffer(buffer)) {
            bb = ByteBufferPrototype.clone.call(buffer);
            bb.markedOffset = -1;
            return bb;
        }
        if (buffer instanceof Uint8Array) {
            bb = new ByteBuffer(0, littleEndian, noAssert);
            if (buffer.length > 0) {
                bb.buffer = buffer.buffer;
                bb.offset = buffer.byteOffset;
                bb.limit = buffer.byteOffset + buffer.byteLength;
                bb.view = new DataView(buffer.buffer);
            }
        }
        else if (buffer instanceof ArrayBuffer) {
            bb = new ByteBuffer(0, littleEndian, noAssert);
            if (buffer.byteLength > 0) {
                bb.buffer = buffer;
                bb.offset = 0;
                bb.limit = buffer.byteLength;
                bb.view = buffer.byteLength > 0 ? new DataView(buffer) : null;
            }
        }
        else if (Object.prototype.toString.call(buffer) === "[object Array]") {
            bb = new ByteBuffer(buffer.length, littleEndian, noAssert);
            bb.limit = buffer.length;
            for (var i = 0; i < buffer.length; ++i)
                bb.view.setUint8(i, buffer[i]);
        }
        else
            throw TypeError("Illegal buffer"); // Otherwise fail
        return bb;
    };
    /**
     * Writes the array as a bitset.
     * @param {Array<boolean>} value Array of booleans to write
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `length` if omitted.
     * @returns {!ByteBuffer}
     * @expose
     */
    ByteBufferPrototype.writeBitSet = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (!(value instanceof Array))
                throw TypeError("Illegal BitSet: Not an array");
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        var start = offset, bits = value.length, bytes = (bits >> 3), bit = 0, k;
        offset += this.writeVarint32(bits, offset);
        while (bytes--) {
            k = (!!value[bit++] & 1) |
                ((!!value[bit++] & 1) << 1) |
                ((!!value[bit++] & 1) << 2) |
                ((!!value[bit++] & 1) << 3) |
                ((!!value[bit++] & 1) << 4) |
                ((!!value[bit++] & 1) << 5) |
                ((!!value[bit++] & 1) << 6) |
                ((!!value[bit++] & 1) << 7);
            this.writeByte(k, offset++);
        }
        if (bit < bits) {
            var m = 0;
            k = 0;
            while (bit < bits)
                k = k | ((!!value[bit++] & 1) << (m++));
            this.writeByte(k, offset++);
        }
        if (relative) {
            this.offset = offset;
            return this;
        }
        return offset - start;
    };
    /**
     * Reads a BitSet as an array of booleans.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `length` if omitted.
     * @returns {Array<boolean>
     * @expose
     */
    ByteBufferPrototype.readBitSet = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        var ret = this.readVarint32(offset), bits = ret.value, bytes = (bits >> 3), bit = 0, value = [], k;
        offset += ret.length;
        while (bytes--) {
            k = this.readByte(offset++);
            value[bit++] = !!(k & 0x01);
            value[bit++] = !!(k & 0x02);
            value[bit++] = !!(k & 0x04);
            value[bit++] = !!(k & 0x08);
            value[bit++] = !!(k & 0x10);
            value[bit++] = !!(k & 0x20);
            value[bit++] = !!(k & 0x40);
            value[bit++] = !!(k & 0x80);
        }
        if (bit < bits) {
            var m = 0;
            k = this.readByte(offset++);
            while (bit < bits)
                value[bit++] = !!((k >> (m++)) & 1);
        }
        if (relative) {
            this.offset = offset;
        }
        return value;
    };
    /**
     * Reads the specified number of bytes.
     * @param {number} length Number of bytes to read
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `length` if omitted.
     * @returns {!ByteBuffer}
     * @expose
     */
    ByteBufferPrototype.readBytes = function (length, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + length > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + length + ") <= " + this.buffer.byteLength);
        }
        var slice = this.slice(offset, offset + length);
        if (relative)
            this.offset += length;
        return slice;
    };
    /**
     * Writes a payload of bytes. This is an alias of {@link ByteBuffer#append}.
     * @function
     * @param {!ByteBuffer|!ArrayBuffer|!Uint8Array|string} source Data to write. If `source` is a ByteBuffer, its offsets
     *  will be modified according to the performed read operation.
     * @param {(string|number)=} encoding Encoding if `data` is a string ("base64", "hex", "binary", defaults to "utf8")
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeBytes = ByteBufferPrototype.append;
    // types/ints/int8
    /**
     * Writes an 8bit signed integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeInt8 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value |= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 1;
        var capacity0 = this.buffer.byteLength;
        if (offset > capacity0)
            this.resize((capacity0 *= 2) > offset ? capacity0 : offset);
        offset -= 1;
        this.view.setInt8(offset, value);
        if (relative)
            this.offset += 1;
        return this;
    };
    /**
     * Writes an 8bit signed integer. This is an alias of {@link ByteBuffer#writeInt8}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeByte = ByteBufferPrototype.writeInt8;
    /**
     * Reads an 8bit signed integer.
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readInt8 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 1 + ") <= " + this.buffer.byteLength);
        }
        var value = this.view.getInt8(offset);
        if (relative)
            this.offset += 1;
        return value;
    };
    /**
     * Reads an 8bit signed integer. This is an alias of {@link ByteBuffer#readInt8}.
     * @function
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readByte = ByteBufferPrototype.readInt8;
    /**
     * Writes an 8bit unsigned integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeUint8 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value >>>= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 1;
        var capacity1 = this.buffer.byteLength;
        if (offset > capacity1)
            this.resize((capacity1 *= 2) > offset ? capacity1 : offset);
        offset -= 1;
        this.view.setUint8(offset, value);
        if (relative)
            this.offset += 1;
        return this;
    };
    /**
     * Writes an 8bit unsigned integer. This is an alias of {@link ByteBuffer#writeUint8}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeUInt8 = ByteBufferPrototype.writeUint8;
    /**
     * Reads an 8bit unsigned integer.
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readUint8 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 1 + ") <= " + this.buffer.byteLength);
        }
        var value = this.view.getUint8(offset);
        if (relative)
            this.offset += 1;
        return value;
    };
    /**
     * Reads an 8bit unsigned integer. This is an alias of {@link ByteBuffer#readUint8}.
     * @function
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `1` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readUInt8 = ByteBufferPrototype.readUint8;
    // types/ints/int16
    /**
     * Writes a 16bit signed integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @throws {TypeError} If `offset` or `value` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.writeInt16 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value |= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 2;
        var capacity2 = this.buffer.byteLength;
        if (offset > capacity2)
            this.resize((capacity2 *= 2) > offset ? capacity2 : offset);
        offset -= 2;
        this.view.setInt16(offset, value, this.littleEndian);
        if (relative)
            this.offset += 2;
        return this;
    };
    /**
     * Writes a 16bit signed integer. This is an alias of {@link ByteBuffer#writeInt16}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @throws {TypeError} If `offset` or `value` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.writeShort = ByteBufferPrototype.writeInt16;
    /**
     * Reads a 16bit signed integer.
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @returns {number} Value read
     * @throws {TypeError} If `offset` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.readInt16 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 2 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 2 + ") <= " + this.buffer.byteLength);
        }
        var value = this.view.getInt16(offset, this.littleEndian);
        if (relative)
            this.offset += 2;
        return value;
    };
    /**
     * Reads a 16bit signed integer. This is an alias of {@link ByteBuffer#readInt16}.
     * @function
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @returns {number} Value read
     * @throws {TypeError} If `offset` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.readShort = ByteBufferPrototype.readInt16;
    /**
     * Writes a 16bit unsigned integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @throws {TypeError} If `offset` or `value` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.writeUint16 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value >>>= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 2;
        var capacity3 = this.buffer.byteLength;
        if (offset > capacity3)
            this.resize((capacity3 *= 2) > offset ? capacity3 : offset);
        offset -= 2;
        this.view.setUint16(offset, value, this.littleEndian);
        if (relative)
            this.offset += 2;
        return this;
    };
    /**
     * Writes a 16bit unsigned integer. This is an alias of {@link ByteBuffer#writeUint16}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @throws {TypeError} If `offset` or `value` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.writeUInt16 = ByteBufferPrototype.writeUint16;
    /**
     * Reads a 16bit unsigned integer.
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @returns {number} Value read
     * @throws {TypeError} If `offset` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.readUint16 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 2 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 2 + ") <= " + this.buffer.byteLength);
        }
        var value = this.view.getUint16(offset, this.littleEndian);
        if (relative)
            this.offset += 2;
        return value;
    };
    /**
     * Reads a 16bit unsigned integer. This is an alias of {@link ByteBuffer#readUint16}.
     * @function
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `2` if omitted.
     * @returns {number} Value read
     * @throws {TypeError} If `offset` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @expose
     */
    ByteBufferPrototype.readUInt16 = ByteBufferPrototype.readUint16;
    // types/ints/int32
    /**
     * Writes a 32bit signed integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @expose
     */
    ByteBufferPrototype.writeInt32 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value |= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 4;
        var capacity4 = this.buffer.byteLength;
        if (offset > capacity4)
            this.resize((capacity4 *= 2) > offset ? capacity4 : offset);
        offset -= 4;
        this.view.setInt32(offset, value, this.littleEndian);
        if (relative)
            this.offset += 4;
        return this;
    };
    /**
     * Writes a 32bit signed integer. This is an alias of {@link ByteBuffer#writeInt32}.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @expose
     */
    ByteBufferPrototype.writeInt = ByteBufferPrototype.writeInt32;
    /**
     * Reads a 32bit signed integer.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readInt32 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 4 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 4 + ") <= " + this.buffer.byteLength);
        }
        var value = this.view.getInt32(offset, this.littleEndian);
        if (relative)
            this.offset += 4;
        return value;
    };
    /**
     * Reads a 32bit signed integer. This is an alias of {@link ByteBuffer#readInt32}.
     * @param {number=} offset Offset to read from. Will use and advance {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readInt = ByteBufferPrototype.readInt32;
    /**
     * Writes a 32bit unsigned integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @expose
     */
    ByteBufferPrototype.writeUint32 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value >>>= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 4;
        var capacity5 = this.buffer.byteLength;
        if (offset > capacity5)
            this.resize((capacity5 *= 2) > offset ? capacity5 : offset);
        offset -= 4;
        this.view.setUint32(offset, value, this.littleEndian);
        if (relative)
            this.offset += 4;
        return this;
    };
    /**
     * Writes a 32bit unsigned integer. This is an alias of {@link ByteBuffer#writeUint32}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @expose
     */
    ByteBufferPrototype.writeUInt32 = ByteBufferPrototype.writeUint32;
    /**
     * Reads a 32bit unsigned integer.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readUint32 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 4 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 4 + ") <= " + this.buffer.byteLength);
        }
        var value = this.view.getUint32(offset, this.littleEndian);
        if (relative)
            this.offset += 4;
        return value;
    };
    /**
     * Reads a 32bit unsigned integer. This is an alias of {@link ByteBuffer#readUint32}.
     * @function
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {number} Value read
     * @expose
     */
    ByteBufferPrototype.readUInt32 = ByteBufferPrototype.readUint32;
    // types/ints/int64
    if (Long) {
        /**
         * Writes a 64bit signed integer.
         * @param {number|!Long} value Value to write
         * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!ByteBuffer} this
         * @expose
         */
        ByteBufferPrototype.writeInt64 = function (value, offset) {
            var relative = typeof offset === 'undefined';
            if (relative)
                offset = this.offset;
            if (!this.noAssert) {
                if (typeof value === 'number')
                    value = Long.fromNumber(value);
                else if (typeof value === 'string')
                    value = Long.fromString(value);
                else if (!(value && value instanceof Long))
                    throw TypeError("Illegal value: " + value + " (not an integer or Long)");
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + 0 > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
            }
            if (typeof value === 'number')
                value = Long.fromNumber(value);
            else if (typeof value === 'string')
                value = Long.fromString(value);
            offset += 8;
            var capacity6 = this.buffer.byteLength;
            if (offset > capacity6)
                this.resize((capacity6 *= 2) > offset ? capacity6 : offset);
            offset -= 8;
            if (this.littleEndian) {
                this.view.setInt32(offset, value.low, true);
                this.view.setInt32(offset + 4, value.high, true);
            }
            else {
                this.view.setInt32(offset, value.high, false);
                this.view.setInt32(offset + 4, value.low, false);
            }
            if (relative)
                this.offset += 8;
            return this;
        };
        /**
         * Writes a 64bit signed integer. This is an alias of {@link ByteBuffer#writeInt64}.
         * @param {number|!Long} value Value to write
         * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!ByteBuffer} this
         * @expose
         */
        ByteBufferPrototype.writeLong = ByteBufferPrototype.writeInt64;
        /**
         * Reads a 64bit signed integer.
         * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!Long}
         * @expose
         */
        ByteBufferPrototype.readInt64 = function (offset) {
            var relative = typeof offset === 'undefined';
            if (relative)
                offset = this.offset;
            if (!this.noAssert) {
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + 8 > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 8 + ") <= " + this.buffer.byteLength);
            }
            var value = this.littleEndian
                ? new Long(this.view.getInt32(offset, true), this.view.getInt32(offset + 4, true), false)
                : new Long(this.view.getInt32(offset + 4, false), this.view.getInt32(offset, false), false);
            if (relative)
                this.offset += 8;
            return value;
        };
        /**
         * Reads a 64bit signed integer. This is an alias of {@link ByteBuffer#readInt64}.
         * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!Long}
         * @expose
         */
        ByteBufferPrototype.readLong = ByteBufferPrototype.readInt64;
        /**
         * Writes a 64bit unsigned integer.
         * @param {number|!Long} value Value to write
         * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!ByteBuffer} this
         * @expose
         */
        ByteBufferPrototype.writeUint64 = function (value, offset) {
            var relative = typeof offset === 'undefined';
            if (relative)
                offset = this.offset;
            if (!this.noAssert) {
                if (typeof value === 'number')
                    value = Long.fromNumber(value);
                else if (typeof value === 'string')
                    value = Long.fromString(value);
                else if (!(value && value instanceof Long))
                    throw TypeError("Illegal value: " + value + " (not an integer or Long)");
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + 0 > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
            }
            if (typeof value === 'number')
                value = Long.fromNumber(value);
            else if (typeof value === 'string')
                value = Long.fromString(value);
            offset += 8;
            var capacity7 = this.buffer.byteLength;
            if (offset > capacity7)
                this.resize((capacity7 *= 2) > offset ? capacity7 : offset);
            offset -= 8;
            if (this.littleEndian) {
                this.view.setInt32(offset, value.low, true);
                this.view.setInt32(offset + 4, value.high, true);
            }
            else {
                this.view.setInt32(offset, value.high, false);
                this.view.setInt32(offset + 4, value.low, false);
            }
            if (relative)
                this.offset += 8;
            return this;
        };
        /**
         * Writes a 64bit unsigned integer. This is an alias of {@link ByteBuffer#writeUint64}.
         * @function
         * @param {number|!Long} value Value to write
         * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!ByteBuffer} this
         * @expose
         */
        ByteBufferPrototype.writeUInt64 = ByteBufferPrototype.writeUint64;
        /**
         * Reads a 64bit unsigned integer.
         * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!Long}
         * @expose
         */
        ByteBufferPrototype.readUint64 = function (offset) {
            var relative = typeof offset === 'undefined';
            if (relative)
                offset = this.offset;
            if (!this.noAssert) {
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + 8 > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 8 + ") <= " + this.buffer.byteLength);
            }
            var value = this.littleEndian
                ? new Long(this.view.getInt32(offset, true), this.view.getInt32(offset + 4, true), true)
                : new Long(this.view.getInt32(offset + 4, false), this.view.getInt32(offset, false), true);
            if (relative)
                this.offset += 8;
            return value;
        };
        /**
         * Reads a 64bit unsigned integer. This is an alias of {@link ByteBuffer#readUint64}.
         * @function
         * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
         * @returns {!Long}
         * @expose
         */
        ByteBufferPrototype.readUInt64 = ByteBufferPrototype.readUint64;
    } // Long
    // types/floats/float32
    /**
     * Writes a 32bit float.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeFloat32 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number')
                throw TypeError("Illegal value: " + value + " (not a number)");
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 4;
        var capacity8 = this.buffer.byteLength;
        if (offset > capacity8)
            this.resize((capacity8 *= 2) > offset ? capacity8 : offset);
        offset -= 4;
        this.view.setFloat32(offset, value, this.littleEndian);
        if (relative)
            this.offset += 4;
        return this;
    };
    /**
     * Writes a 32bit float. This is an alias of {@link ByteBuffer#writeFloat32}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeFloat = ByteBufferPrototype.writeFloat32;
    /**
     * Reads a 32bit float.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {number}
     * @expose
     */
    ByteBufferPrototype.readFloat32 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 4 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 4 + ") <= " + this.buffer.byteLength);
        }
        var value = this.view.getFloat32(offset, this.littleEndian);
        if (relative)
            this.offset += 4;
        return value;
    };
    /**
     * Reads a 32bit float. This is an alias of {@link ByteBuffer#readFloat32}.
     * @function
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `4` if omitted.
     * @returns {number}
     * @expose
     */
    ByteBufferPrototype.readFloat = ByteBufferPrototype.readFloat32;
    // types/floats/float64
    /**
     * Writes a 64bit float.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeFloat64 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number')
                throw TypeError("Illegal value: " + value + " (not a number)");
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        offset += 8;
        var capacity9 = this.buffer.byteLength;
        if (offset > capacity9)
            this.resize((capacity9 *= 2) > offset ? capacity9 : offset);
        offset -= 8;
        this.view.setFloat64(offset, value, this.littleEndian);
        if (relative)
            this.offset += 8;
        return this;
    };
    /**
     * Writes a 64bit float. This is an alias of {@link ByteBuffer#writeFloat64}.
     * @function
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.writeDouble = ByteBufferPrototype.writeFloat64;
    /**
     * Reads a 64bit float.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
     * @returns {number}
     * @expose
     */
    ByteBufferPrototype.readFloat64 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 8 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 8 + ") <= " + this.buffer.byteLength);
        }
        var value = this.view.getFloat64(offset, this.littleEndian);
        if (relative)
            this.offset += 8;
        return value;
    };
    /**
     * Reads a 64bit float. This is an alias of {@link ByteBuffer#readFloat64}.
     * @function
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by `8` if omitted.
     * @returns {number}
     * @expose
     */
    ByteBufferPrototype.readDouble = ByteBufferPrototype.readFloat64;
    // types/varints/varint32
    /**
     * Maximum number of bytes required to store a 32bit base 128 variable-length integer.
     * @type {number}
     * @const
     * @expose
     */
    ByteBuffer.MAX_VARINT32_BYTES = 5;
    /**
     * Calculates the actual number of bytes required to store a 32bit base 128 variable-length integer.
     * @param {number} value Value to encode
     * @returns {number} Number of bytes required. Capped to {@link ByteBuffer.MAX_VARINT32_BYTES}
     * @expose
     */
    ByteBuffer.calculateVarint32 = function (value) {
        // ref: src/google/protobuf/io/coded_stream.cc
        value = value >>> 0;
        if (value < 1 << 7)
            return 1;
        else if (value < 1 << 14)
            return 2;
        else if (value < 1 << 21)
            return 3;
        else if (value < 1 << 28)
            return 4;
        else
            return 5;
    };
    /**
     * Zigzag encodes a signed 32bit integer so that it can be effectively used with varint encoding.
     * @param {number} n Signed 32bit integer
     * @returns {number} Unsigned zigzag encoded 32bit integer
     * @expose
     */
    ByteBuffer.zigZagEncode32 = function (n) {
        return (((n |= 0) << 1) ^ (n >> 31)) >>> 0; // ref: src/google/protobuf/wire_format_lite.h
    };
    /**
     * Decodes a zigzag encoded signed 32bit integer.
     * @param {number} n Unsigned zigzag encoded 32bit integer
     * @returns {number} Signed 32bit integer
     * @expose
     */
    ByteBuffer.zigZagDecode32 = function (n) {
        return ((n >>> 1) ^ -(n & 1)) | 0; // // ref: src/google/protobuf/wire_format_lite.h
    };
    /**
     * Writes a 32bit base 128 variable-length integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer|number} this if `offset` is omitted, else the actual number of bytes written
     * @expose
     */
    ByteBufferPrototype.writeVarint32 = function (value, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value |= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        var size = ByteBuffer.calculateVarint32(value), b;
        offset += size;
        var capacity10 = this.buffer.byteLength;
        if (offset > capacity10)
            this.resize((capacity10 *= 2) > offset ? capacity10 : offset);
        offset -= size;
        value >>>= 0;
        while (value >= 0x80) {
            b = (value & 0x7f) | 0x80;
            this.view.setUint8(offset++, b);
            value >>>= 7;
        }
        this.view.setUint8(offset++, value);
        if (relative) {
            this.offset = offset;
            return this;
        }
        return size;
    };
    /**
     * Writes a zig-zag encoded (signed) 32bit base 128 variable-length integer.
     * @param {number} value Value to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer|number} this if `offset` is omitted, else the actual number of bytes written
     * @expose
     */
    ByteBufferPrototype.writeVarint32ZigZag = function (value, offset) {
        return this.writeVarint32(ByteBuffer.zigZagEncode32(value), offset);
    };
    /**
     * Reads a 32bit base 128 variable-length integer.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {number|!{value: number, length: number}} The value read if offset is omitted, else the value read
     *  and the actual number of bytes read.
     * @throws {Error} If it's not a valid varint. Has a property `truncated = true` if there is not enough data available
     *  to fully decode the varint.
     * @expose
     */
    ByteBufferPrototype.readVarint32 = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 1 + ") <= " + this.buffer.byteLength);
        }
        var c = 0, value = 0 >>> 0, b;
        do {
            if (!this.noAssert && offset > this.limit) {
                var err = Error("Truncated");
                err['truncated'] = true;
                throw err;
            }
            b = this.view.getUint8(offset++);
            if (c < 5)
                value |= (b & 0x7f) << (7 * c);
            ++c;
        } while ((b & 0x80) !== 0);
        value |= 0;
        if (relative) {
            this.offset = offset;
            return value;
        }
        return {
            "value": value,
            "length": c
        };
    };
    /**
     * Reads a zig-zag encoded (signed) 32bit base 128 variable-length integer.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {number|!{value: number, length: number}} The value read if offset is omitted, else the value read
     *  and the actual number of bytes read.
     * @throws {Error} If it's not a valid varint
     * @expose
     */
    ByteBufferPrototype.readVarint32ZigZag = function (offset) {
        var val = this.readVarint32(offset);
        if (typeof val === 'object')
            val["value"] = ByteBuffer.zigZagDecode32(val["value"]);
        else
            val = ByteBuffer.zigZagDecode32(val);
        return val;
    };
    // types/varints/varint64
    if (Long) {
        /**
         * Maximum number of bytes required to store a 64bit base 128 variable-length integer.
         * @type {number}
         * @const
         * @expose
         */
        ByteBuffer.MAX_VARINT64_BYTES = 10;
        /**
         * Calculates the actual number of bytes required to store a 64bit base 128 variable-length integer.
         * @param {number|!Long} value Value to encode
         * @returns {number} Number of bytes required. Capped to {@link ByteBuffer.MAX_VARINT64_BYTES}
         * @expose
         */
        ByteBuffer.calculateVarint64 = function (value) {
            if (typeof value === 'number')
                value = Long.fromNumber(value);
            else if (typeof value === 'string')
                value = Long.fromString(value);
            // ref: src/google/protobuf/io/coded_stream.cc
            var part0 = value.toInt() >>> 0, part1 = value.shiftRightUnsigned(28).toInt() >>> 0, part2 = value.shiftRightUnsigned(56).toInt() >>> 0;
            if (part2 == 0) {
                if (part1 == 0) {
                    if (part0 < 1 << 14)
                        return part0 < 1 << 7 ? 1 : 2;
                    else
                        return part0 < 1 << 21 ? 3 : 4;
                }
                else {
                    if (part1 < 1 << 14)
                        return part1 < 1 << 7 ? 5 : 6;
                    else
                        return part1 < 1 << 21 ? 7 : 8;
                }
            }
            else
                return part2 < 1 << 7 ? 9 : 10;
        };
        /**
         * Zigzag encodes a signed 64bit integer so that it can be effectively used with varint encoding.
         * @param {number|!Long} value Signed long
         * @returns {!Long} Unsigned zigzag encoded long
         * @expose
         */
        ByteBuffer.zigZagEncode64 = function (value) {
            if (typeof value === 'number')
                value = Long.fromNumber(value, false);
            else if (typeof value === 'string')
                value = Long.fromString(value, false);
            else if (value.unsigned !== false)
                value = value.toSigned();
            // ref: src/google/protobuf/wire_format_lite.h
            return value.shiftLeft(1).xor(value.shiftRight(63)).toUnsigned();
        };
        /**
         * Decodes a zigzag encoded signed 64bit integer.
         * @param {!Long|number} value Unsigned zigzag encoded long or JavaScript number
         * @returns {!Long} Signed long
         * @expose
         */
        ByteBuffer.zigZagDecode64 = function (value) {
            if (typeof value === 'number')
                value = Long.fromNumber(value, false);
            else if (typeof value === 'string')
                value = Long.fromString(value, false);
            else if (value.unsigned !== false)
                value = value.toSigned();
            // ref: src/google/protobuf/wire_format_lite.h
            return value.shiftRightUnsigned(1).xor(value.and(Long.ONE).toSigned().negate()).toSigned();
        };
        /**
         * Writes a 64bit base 128 variable-length integer.
         * @param {number|Long} value Value to write
         * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
         *  written if omitted.
         * @returns {!ByteBuffer|number} `this` if offset is omitted, else the actual number of bytes written.
         * @expose
         */
        ByteBufferPrototype.writeVarint64 = function (value, offset) {
            var relative = typeof offset === 'undefined';
            if (relative)
                offset = this.offset;
            if (!this.noAssert) {
                if (typeof value === 'number')
                    value = Long.fromNumber(value);
                else if (typeof value === 'string')
                    value = Long.fromString(value);
                else if (!(value && value instanceof Long))
                    throw TypeError("Illegal value: " + value + " (not an integer or Long)");
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + 0 > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
            }
            if (typeof value === 'number')
                value = Long.fromNumber(value, false);
            else if (typeof value === 'string')
                value = Long.fromString(value, false);
            else if (value.unsigned !== false)
                value = value.toSigned();
            var size = ByteBuffer.calculateVarint64(value), part0 = value.toInt() >>> 0, part1 = value.shiftRightUnsigned(28).toInt() >>> 0, part2 = value.shiftRightUnsigned(56).toInt() >>> 0;
            offset += size;
            var capacity11 = this.buffer.byteLength;
            if (offset > capacity11)
                this.resize((capacity11 *= 2) > offset ? capacity11 : offset);
            offset -= size;
            switch (size) {
                case 10: this.view.setUint8(offset + 9, (part2 >>> 7) & 0x01);
                case 9: this.view.setUint8(offset + 8, size !== 9 ? (part2) | 0x80 : (part2) & 0x7F);
                case 8: this.view.setUint8(offset + 7, size !== 8 ? (part1 >>> 21) | 0x80 : (part1 >>> 21) & 0x7F);
                case 7: this.view.setUint8(offset + 6, size !== 7 ? (part1 >>> 14) | 0x80 : (part1 >>> 14) & 0x7F);
                case 6: this.view.setUint8(offset + 5, size !== 6 ? (part1 >>> 7) | 0x80 : (part1 >>> 7) & 0x7F);
                case 5: this.view.setUint8(offset + 4, size !== 5 ? (part1) | 0x80 : (part1) & 0x7F);
                case 4: this.view.setUint8(offset + 3, size !== 4 ? (part0 >>> 21) | 0x80 : (part0 >>> 21) & 0x7F);
                case 3: this.view.setUint8(offset + 2, size !== 3 ? (part0 >>> 14) | 0x80 : (part0 >>> 14) & 0x7F);
                case 2: this.view.setUint8(offset + 1, size !== 2 ? (part0 >>> 7) | 0x80 : (part0 >>> 7) & 0x7F);
                case 1: this.view.setUint8(offset, size !== 1 ? (part0) | 0x80 : (part0) & 0x7F);
            }
            if (relative) {
                this.offset += size;
                return this;
            }
            else {
                return size;
            }
        };
        /**
         * Writes a zig-zag encoded 64bit base 128 variable-length integer.
         * @param {number|Long} value Value to write
         * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
         *  written if omitted.
         * @returns {!ByteBuffer|number} `this` if offset is omitted, else the actual number of bytes written.
         * @expose
         */
        ByteBufferPrototype.writeVarint64ZigZag = function (value, offset) {
            return this.writeVarint64(ByteBuffer.zigZagEncode64(value), offset);
        };
        /**
         * Reads a 64bit base 128 variable-length integer. Requires Long.js.
         * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
         *  read if omitted.
         * @returns {!Long|!{value: Long, length: number}} The value read if offset is omitted, else the value read and
         *  the actual number of bytes read.
         * @throws {Error} If it's not a valid varint
         * @expose
         */
        ByteBufferPrototype.readVarint64 = function (offset) {
            var relative = typeof offset === 'undefined';
            if (relative)
                offset = this.offset;
            if (!this.noAssert) {
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + 1 > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 1 + ") <= " + this.buffer.byteLength);
            }
            // ref: src/google/protobuf/io/coded_stream.cc
            var start = offset, part0 = 0, part1 = 0, part2 = 0, b = 0;
            b = this.view.getUint8(offset++);
            part0 = (b & 0x7F);
            if (b & 0x80) {
                b = this.view.getUint8(offset++);
                part0 |= (b & 0x7F) << 7;
                if (b & 0x80) {
                    b = this.view.getUint8(offset++);
                    part0 |= (b & 0x7F) << 14;
                    if (b & 0x80) {
                        b = this.view.getUint8(offset++);
                        part0 |= (b & 0x7F) << 21;
                        if (b & 0x80) {
                            b = this.view.getUint8(offset++);
                            part1 = (b & 0x7F);
                            if (b & 0x80) {
                                b = this.view.getUint8(offset++);
                                part1 |= (b & 0x7F) << 7;
                                if (b & 0x80) {
                                    b = this.view.getUint8(offset++);
                                    part1 |= (b & 0x7F) << 14;
                                    if (b & 0x80) {
                                        b = this.view.getUint8(offset++);
                                        part1 |= (b & 0x7F) << 21;
                                        if (b & 0x80) {
                                            b = this.view.getUint8(offset++);
                                            part2 = (b & 0x7F);
                                            if (b & 0x80) {
                                                b = this.view.getUint8(offset++);
                                                part2 |= (b & 0x7F) << 7;
                                                if (b & 0x80) {
                                                    throw Error("Buffer overrun");
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            var value = Long.fromBits(part0 | (part1 << 28), (part1 >>> 4) | (part2) << 24, false);
            if (relative) {
                this.offset = offset;
                return value;
            }
            else {
                return {
                    'value': value,
                    'length': offset - start
                };
            }
        };
        /**
         * Reads a zig-zag encoded 64bit base 128 variable-length integer. Requires Long.js.
         * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
         *  read if omitted.
         * @returns {!Long|!{value: Long, length: number}} The value read if offset is omitted, else the value read and
         *  the actual number of bytes read.
         * @throws {Error} If it's not a valid varint
         * @expose
         */
        ByteBufferPrototype.readVarint64ZigZag = function (offset) {
            var val = this.readVarint64(offset);
            if (val && val['value'] instanceof Long)
                val["value"] = ByteBuffer.zigZagDecode64(val["value"]);
            else
                val = ByteBuffer.zigZagDecode64(val);
            return val;
        };
    } // Long
    // types/strings/cstring
    /**
     * Writes a NULL-terminated UTF8 encoded string. For this to work the specified string must not contain any NULL
     *  characters itself.
     * @param {string} str String to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  contained in `str` + 1 if omitted.
     * @returns {!ByteBuffer|number} this if offset is omitted, else the actual number of bytes written
     * @expose
     */
    ByteBufferPrototype.writeCString = function (str, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        var i, k = str.length;
        if (!this.noAssert) {
            if (typeof str !== 'string')
                throw TypeError("Illegal str: Not a string");
            for (i = 0; i < k; ++i) {
                if (str.charCodeAt(i) === 0)
                    throw RangeError("Illegal str: Contains NULL-characters");
            }
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        // UTF8 strings do not contain zero bytes in between except for the zero character, so:
        k = utfx.calculateUTF16asUTF8(stringSource(str))[1];
        offset += k + 1;
        var capacity12 = this.buffer.byteLength;
        if (offset > capacity12)
            this.resize((capacity12 *= 2) > offset ? capacity12 : offset);
        offset -= k + 1;
        utfx.encodeUTF16toUTF8(stringSource(str), function (b) {
            this.view.setUint8(offset++, b);
        }.bind(this));
        this.view.setUint8(offset++, 0);
        if (relative) {
            this.offset = offset;
            return this;
        }
        return k;
    };
    /**
     * Reads a NULL-terminated UTF8 encoded string. For this to work the string read must not contain any NULL characters
     *  itself.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {string|!{string: string, length: number}} The string read if offset is omitted, else the string
     *  read and the actual number of bytes read.
     * @expose
     */
    ByteBufferPrototype.readCString = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 1 + ") <= " + this.buffer.byteLength);
        }
        var start = offset, temp;
        // UTF8 strings do not contain zero bytes in between except for the zero character itself, so:
        var sd, b = -1;
        utfx.decodeUTF8toUTF16(function () {
            if (b === 0)
                return null;
            if (offset >= this.limit)
                throw RangeError("Illegal range: Truncated data, " + offset + " < " + this.limit);
            b = this.view.getUint8(offset++);
            return b === 0 ? null : b;
        }.bind(this), sd = stringDestination(), true);
        if (relative) {
            this.offset = offset;
            return sd();
        }
        else {
            return {
                "string": sd(),
                "length": offset - start
            };
        }
    };
    // types/strings/istring
    /**
     * Writes a length as uint32 prefixed UTF8 encoded string.
     * @param {string} str String to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer|number} `this` if `offset` is omitted, else the actual number of bytes written
     * @expose
     * @see ByteBuffer#writeVarint32
     */
    ByteBufferPrototype.writeIString = function (str, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof str !== 'string')
                throw TypeError("Illegal str: Not a string");
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        var start = offset, k;
        k = utfx.calculateUTF16asUTF8(stringSource(str), this.noAssert)[1];
        offset += 4 + k;
        var capacity13 = this.buffer.byteLength;
        if (offset > capacity13)
            this.resize((capacity13 *= 2) > offset ? capacity13 : offset);
        offset -= 4 + k;
        this.view.setUint32(offset, k, this.littleEndian);
        offset += 4;
        utfx.encodeUTF16toUTF8(stringSource(str), function (b) {
            this.view.setUint8(offset++, b);
        }.bind(this));
        if (offset !== start + 4 + k)
            throw RangeError("Illegal range: Truncated data, " + offset + " == " + (offset + 4 + k));
        if (relative) {
            this.offset = offset;
            return this;
        }
        return offset - start;
    };
    /**
     * Reads a length as uint32 prefixed UTF8 encoded string.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {string|!{string: string, length: number}} The string read if offset is omitted, else the string
     *  read and the actual number of bytes read.
     * @expose
     * @see ByteBuffer#readVarint32
     */
    ByteBufferPrototype.readIString = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 4 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 4 + ") <= " + this.buffer.byteLength);
        }
        var start = offset;
        var len = this.readUint32(offset);
        var str = this.readUTF8String(len, ByteBuffer.METRICS_BYTES, offset += 4);
        offset += str['length'];
        if (relative) {
            this.offset = offset;
            return str['string'];
        }
        else {
            return {
                'string': str['string'],
                'length': offset - start
            };
        }
    };
    // types/strings/utf8string
    /**
     * Metrics representing number of UTF8 characters. Evaluates to `c`.
     * @type {string}
     * @const
     * @expose
     */
    ByteBuffer.METRICS_CHARS = 'c';
    /**
     * Metrics representing number of bytes. Evaluates to `b`.
     * @type {string}
     * @const
     * @expose
     */
    ByteBuffer.METRICS_BYTES = 'b';
    /**
     * Writes an UTF8 encoded string.
     * @param {string} str String to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} if omitted.
     * @returns {!ByteBuffer|number} this if offset is omitted, else the actual number of bytes written.
     * @expose
     */
    ByteBufferPrototype.writeUTF8String = function (str, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        var k;
        var start = offset;
        k = utfx.calculateUTF16asUTF8(stringSource(str))[1];
        offset += k;
        var capacity14 = this.buffer.byteLength;
        if (offset > capacity14)
            this.resize((capacity14 *= 2) > offset ? capacity14 : offset);
        offset -= k;
        utfx.encodeUTF16toUTF8(stringSource(str), function (b) {
            this.view.setUint8(offset++, b);
        }.bind(this));
        if (relative) {
            this.offset = offset;
            return this;
        }
        return offset - start;
    };
    /**
     * Writes an UTF8 encoded string. This is an alias of {@link ByteBuffer#writeUTF8String}.
     * @function
     * @param {string} str String to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} if omitted.
     * @returns {!ByteBuffer|number} this if offset is omitted, else the actual number of bytes written.
     * @expose
     */
    ByteBufferPrototype.writeString = ByteBufferPrototype.writeUTF8String;
    /**
     * Calculates the number of UTF8 characters of a string. JavaScript itself uses UTF-16, so that a string's
     *  `length` property does not reflect its actual UTF8 size if it contains code points larger than 0xFFFF.
     * @param {string} str String to calculate
     * @returns {number} Number of UTF8 characters
     * @expose
     */
    ByteBuffer.calculateUTF8Chars = function (str) {
        return utfx.calculateUTF16asUTF8(stringSource(str))[0];
    };
    /**
     * Calculates the number of UTF8 bytes of a string.
     * @param {string} str String to calculate
     * @returns {number} Number of UTF8 bytes
     * @expose
     */
    ByteBuffer.calculateUTF8Bytes = function (str) {
        return utfx.calculateUTF16asUTF8(stringSource(str))[1];
    };
    /**
     * Calculates the number of UTF8 bytes of a string. This is an alias of {@link ByteBuffer.calculateUTF8Bytes}.
     * @function
     * @param {string} str String to calculate
     * @returns {number} Number of UTF8 bytes
     * @expose
     */
    ByteBuffer.calculateString = ByteBuffer.calculateUTF8Bytes;
    /**
     * Reads an UTF8 encoded string.
     * @param {number} length Number of characters or bytes to read.
     * @param {string=} metrics Metrics specifying what `length` is meant to count. Defaults to
     *  {@link ByteBuffer.METRICS_CHARS}.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {string|!{string: string, length: number}} The string read if offset is omitted, else the string
     *  read and the actual number of bytes read.
     * @expose
     */
    ByteBufferPrototype.readUTF8String = function (length, metrics, offset) {
        if (typeof metrics === 'number') {
            offset = metrics;
            metrics = undefined;
        }
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (typeof metrics === 'undefined')
            metrics = ByteBuffer.METRICS_CHARS;
        if (!this.noAssert) {
            if (typeof length !== 'number' || length % 1 !== 0)
                throw TypeError("Illegal length: " + length + " (not an integer)");
            length |= 0;
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        var i = 0, start = offset, sd;
        if (metrics === ByteBuffer.METRICS_CHARS) {
            sd = stringDestination();
            utfx.decodeUTF8(function () {
                return i < length && offset < this.limit ? this.view.getUint8(offset++) : null;
            }.bind(this), function (cp) {
                ++i;
                utfx.UTF8toUTF16(cp, sd);
            });
            if (i !== length)
                throw RangeError("Illegal range: Truncated data, " + i + " == " + length);
            if (relative) {
                this.offset = offset;
                return sd();
            }
            else {
                return {
                    "string": sd(),
                    "length": offset - start
                };
            }
        }
        else if (metrics === ByteBuffer.METRICS_BYTES) {
            if (!this.noAssert) {
                if (typeof offset !== 'number' || offset % 1 !== 0)
                    throw TypeError("Illegal offset: " + offset + " (not an integer)");
                offset >>>= 0;
                if (offset < 0 || offset + length > this.buffer.byteLength)
                    throw RangeError("Illegal offset: 0 <= " + offset + " (+" + length + ") <= " + this.buffer.byteLength);
            }
            var k = offset + length;
            utfx.decodeUTF8toUTF16(function () {
                return offset < k ? this.view.getUint8(offset++) : null;
            }.bind(this), sd = stringDestination(), this.noAssert);
            if (offset !== k)
                throw RangeError("Illegal range: Truncated data, " + offset + " == " + k);
            if (relative) {
                this.offset = offset;
                return sd();
            }
            else {
                return {
                    'string': sd(),
                    'length': offset - start
                };
            }
        }
        else
            throw TypeError("Unsupported metrics: " + metrics);
    };
    /**
     * Reads an UTF8 encoded string. This is an alias of {@link ByteBuffer#readUTF8String}.
     * @function
     * @param {number} length Number of characters or bytes to read
     * @param {number=} metrics Metrics specifying what `n` is meant to count. Defaults to
     *  {@link ByteBuffer.METRICS_CHARS}.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {string|!{string: string, length: number}} The string read if offset is omitted, else the string
     *  read and the actual number of bytes read.
     * @expose
     */
    ByteBufferPrototype.readString = ByteBufferPrototype.readUTF8String;
    // types/strings/vstring
    /**
     * Writes a length as varint32 prefixed UTF8 encoded string.
     * @param {string} str String to write
     * @param {number=} offset Offset to write to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer|number} `this` if `offset` is omitted, else the actual number of bytes written
     * @expose
     * @see ByteBuffer#writeVarint32
     */
    ByteBufferPrototype.writeVString = function (str, offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof str !== 'string')
                throw TypeError("Illegal str: Not a string");
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        var start = offset, k, l;
        k = utfx.calculateUTF16asUTF8(stringSource(str), this.noAssert)[1];
        l = ByteBuffer.calculateVarint32(k);
        offset += l + k;
        var capacity15 = this.buffer.byteLength;
        if (offset > capacity15)
            this.resize((capacity15 *= 2) > offset ? capacity15 : offset);
        offset -= l + k;
        offset += this.writeVarint32(k, offset);
        utfx.encodeUTF16toUTF8(stringSource(str), function (b) {
            this.view.setUint8(offset++, b);
        }.bind(this));
        if (offset !== start + k + l)
            throw RangeError("Illegal range: Truncated data, " + offset + " == " + (offset + k + l));
        if (relative) {
            this.offset = offset;
            return this;
        }
        return offset - start;
    };
    /**
     * Reads a length as varint32 prefixed UTF8 encoded string.
     * @param {number=} offset Offset to read from. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {string|!{string: string, length: number}} The string read if offset is omitted, else the string
     *  read and the actual number of bytes read.
     * @expose
     * @see ByteBuffer#readVarint32
     */
    ByteBufferPrototype.readVString = function (offset) {
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 1 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 1 + ") <= " + this.buffer.byteLength);
        }
        var start = offset;
        var len = this.readVarint32(offset);
        var str = this.readUTF8String(len['value'], ByteBuffer.METRICS_BYTES, offset += len['length']);
        offset += str['length'];
        if (relative) {
            this.offset = offset;
            return str['string'];
        }
        else {
            return {
                'string': str['string'],
                'length': offset - start
            };
        }
    };
    /**
     * Appends some data to this ByteBuffer. This will overwrite any contents behind the specified offset up to the appended
     *  data's length.
     * @param {!ByteBuffer|!ArrayBuffer|!Uint8Array|string} source Data to append. If `source` is a ByteBuffer, its offsets
     *  will be modified according to the performed read operation.
     * @param {(string|number)=} encoding Encoding if `data` is a string ("base64", "hex", "binary", defaults to "utf8")
     * @param {number=} offset Offset to append at. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     * @example A relative `<01 02>03.append(<04 05>)` will result in `<01 02 04 05>, 04 05|`
     * @example An absolute `<01 02>03.append(04 05>, 1)` will result in `<01 04>05, 04 05|`
     */
    ByteBufferPrototype.append = function (source, encoding, offset) {
        if (typeof encoding === 'number' || typeof encoding !== 'string') {
            offset = encoding;
            encoding = undefined;
        }
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        if (!(source instanceof ByteBuffer))
            source = ByteBuffer.wrap(source, encoding);
        var length = source.limit - source.offset;
        if (length <= 0)
            return this; // Nothing to append
        offset += length;
        var capacity16 = this.buffer.byteLength;
        if (offset > capacity16)
            this.resize((capacity16 *= 2) > offset ? capacity16 : offset);
        offset -= length;
        new Uint8Array(this.buffer, offset).set(new Uint8Array(source.buffer).subarray(source.offset, source.limit));
        source.offset += length;
        if (relative)
            this.offset += length;
        return this;
    };
    /**
     * Appends this ByteBuffer's contents to another ByteBuffer. This will overwrite any contents at and after the
        specified offset up to the length of this ByteBuffer's data.
     * @param {!ByteBuffer} target Target ByteBuffer
     * @param {number=} offset Offset to append to. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  read if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     * @see ByteBuffer#append
     */
    ByteBufferPrototype.appendTo = function (target, offset) {
        target.append(this, offset);
        return this;
    };
    /**
     * Enables or disables assertions of argument types and offsets. Assertions are enabled by default but you can opt to
     *  disable them if your code already makes sure that everything is valid.
     * @param {boolean} assert `true` to enable assertions, otherwise `false`
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.assert = function (assert) {
        this.noAssert = !assert;
        return this;
    };
    /**
     * Gets the capacity of this ByteBuffer's backing buffer.
     * @returns {number} Capacity of the backing buffer
     * @expose
     */
    ByteBufferPrototype.capacity = function () {
        return this.buffer.byteLength;
    };
    /**
     * Clears this ByteBuffer's offsets by setting {@link ByteBuffer#offset} to `0` and {@link ByteBuffer#limit} to the
     *  backing buffer's capacity. Discards {@link ByteBuffer#markedOffset}.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.clear = function () {
        this.offset = 0;
        this.limit = this.buffer.byteLength;
        this.markedOffset = -1;
        return this;
    };
    /**
     * Creates a cloned instance of this ByteBuffer, preset with this ByteBuffer's values for {@link ByteBuffer#offset},
     *  {@link ByteBuffer#markedOffset} and {@link ByteBuffer#limit}.
     * @param {boolean=} copy Whether to copy the backing buffer or to return another view on the same, defaults to `false`
     * @returns {!ByteBuffer} Cloned instance
     * @expose
     */
    ByteBufferPrototype.clone = function (copy) {
        var bb = new ByteBuffer(0, this.littleEndian, this.noAssert);
        if (copy) {
            bb.buffer = new ArrayBuffer(this.buffer.byteLength);
            new Uint8Array(bb.buffer).set(this.buffer);
            bb.view = new DataView(bb.buffer);
        }
        else {
            bb.buffer = this.buffer;
            bb.view = this.view;
        }
        bb.offset = this.offset;
        bb.markedOffset = this.markedOffset;
        bb.limit = this.limit;
        return bb;
    };
    /**
     * Compacts this ByteBuffer to be backed by a {@link ByteBuffer#buffer} of its contents' length. Contents are the bytes
     *  between {@link ByteBuffer#offset} and {@link ByteBuffer#limit}. Will set `offset = 0` and `limit = capacity` and
     *  adapt {@link ByteBuffer#markedOffset} to the same relative position if set.
     * @param {number=} begin Offset to start at, defaults to {@link ByteBuffer#offset}
     * @param {number=} end Offset to end at, defaults to {@link ByteBuffer#limit}
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.compact = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        if (!this.noAssert) {
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        if (begin === 0 && end === this.buffer.byteLength)
            return this; // Already compacted
        var len = end - begin;
        if (len === 0) {
            this.buffer = EMPTY_BUFFER;
            this.view = null;
            if (this.markedOffset >= 0)
                this.markedOffset -= begin;
            this.offset = 0;
            this.limit = 0;
            return this;
        }
        var buffer = new ArrayBuffer(len);
        new Uint8Array(buffer).set(new Uint8Array(this.buffer).subarray(begin, end));
        this.buffer = buffer;
        this.view = new DataView(buffer);
        if (this.markedOffset >= 0)
            this.markedOffset -= begin;
        this.offset = 0;
        this.limit = len;
        return this;
    };
    /**
     * Creates a copy of this ByteBuffer's contents. Contents are the bytes between {@link ByteBuffer#offset} and
     *  {@link ByteBuffer#limit}.
     * @param {number=} begin Begin offset, defaults to {@link ByteBuffer#offset}.
     * @param {number=} end End offset, defaults to {@link ByteBuffer#limit}.
     * @returns {!ByteBuffer} Copy
     * @expose
     */
    ByteBufferPrototype.copy = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        if (!this.noAssert) {
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        if (begin === end)
            return new ByteBuffer(0, this.littleEndian, this.noAssert);
        var capacity = end - begin, bb = new ByteBuffer(capacity, this.littleEndian, this.noAssert);
        bb.offset = 0;
        bb.limit = capacity;
        if (bb.markedOffset >= 0)
            bb.markedOffset -= begin;
        this.copyTo(bb, 0, begin, end);
        return bb;
    };
    /**
     * Copies this ByteBuffer's contents to another ByteBuffer. Contents are the bytes between {@link ByteBuffer#offset} and
     *  {@link ByteBuffer#limit}.
     * @param {!ByteBuffer} target Target ByteBuffer
     * @param {number=} targetOffset Offset to copy to. Will use and increase the target's {@link ByteBuffer#offset}
     *  by the number of bytes copied if omitted.
     * @param {number=} sourceOffset Offset to start copying from. Will use and increase {@link ByteBuffer#offset} by the
     *  number of bytes copied if omitted.
     * @param {number=} sourceLimit Offset to end copying from, defaults to {@link ByteBuffer#limit}
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.copyTo = function (target, targetOffset, sourceOffset, sourceLimit) {
        var relative, targetRelative;
        if (!this.noAssert) {
            if (!ByteBuffer.isByteBuffer(target))
                throw TypeError("Illegal target: Not a ByteBuffer");
        }
        targetOffset = (targetRelative = typeof targetOffset === 'undefined') ? target.offset : targetOffset | 0;
        sourceOffset = (relative = typeof sourceOffset === 'undefined') ? this.offset : sourceOffset | 0;
        sourceLimit = typeof sourceLimit === 'undefined' ? this.limit : sourceLimit | 0;
        if (targetOffset < 0 || targetOffset > target.buffer.byteLength)
            throw RangeError("Illegal target range: 0 <= " + targetOffset + " <= " + target.buffer.byteLength);
        if (sourceOffset < 0 || sourceLimit > this.buffer.byteLength)
            throw RangeError("Illegal source range: 0 <= " + sourceOffset + " <= " + this.buffer.byteLength);
        var len = sourceLimit - sourceOffset;
        if (len === 0)
            return target; // Nothing to copy
        target.ensureCapacity(targetOffset + len);
        new Uint8Array(target.buffer).set(new Uint8Array(this.buffer).subarray(sourceOffset, sourceLimit), targetOffset);
        if (relative)
            this.offset += len;
        if (targetRelative)
            target.offset += len;
        return this;
    };
    /**
     * Makes sure that this ByteBuffer is backed by a {@link ByteBuffer#buffer} of at least the specified capacity. If the
     *  current capacity is exceeded, it will be doubled. If double the current capacity is less than the required capacity,
     *  the required capacity will be used instead.
     * @param {number} capacity Required capacity
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.ensureCapacity = function (capacity) {
        var current = this.buffer.byteLength;
        if (current < capacity)
            return this.resize((current *= 2) > capacity ? current : capacity);
        return this;
    };
    /**
     * Overwrites this ByteBuffer's contents with the specified value. Contents are the bytes between
     *  {@link ByteBuffer#offset} and {@link ByteBuffer#limit}.
     * @param {number|string} value Byte value to fill with. If given as a string, the first character is used.
     * @param {number=} begin Begin offset. Will use and increase {@link ByteBuffer#offset} by the number of bytes
     *  written if omitted. defaults to {@link ByteBuffer#offset}.
     * @param {number=} end End offset, defaults to {@link ByteBuffer#limit}.
     * @returns {!ByteBuffer} this
     * @expose
     * @example `someByteBuffer.clear().fill(0)` fills the entire backing buffer with zeroes
     */
    ByteBufferPrototype.fill = function (value, begin, end) {
        var relative = typeof begin === 'undefined';
        if (relative)
            begin = this.offset;
        if (typeof value === 'string' && value.length > 0)
            value = value.charCodeAt(0);
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        if (!this.noAssert) {
            if (typeof value !== 'number' || value % 1 !== 0)
                throw TypeError("Illegal value: " + value + " (not an integer)");
            value |= 0;
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        if (begin >= end)
            return this; // Nothing to fill
        while (begin < end)
            this.view.setUint8(begin++, value);
        if (relative)
            this.offset = begin;
        return this;
    };
    /**
     * Makes this ByteBuffer ready for a new sequence of write or relative read operations. Sets `limit = offset` and
     *  `offset = 0`. Make sure always to flip a ByteBuffer when all relative read or write operations are complete.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.flip = function () {
        this.limit = this.offset;
        this.offset = 0;
        return this;
    };
    /**
     * Marks an offset on this ByteBuffer to be used later.
     * @param {number=} offset Offset to mark. Defaults to {@link ByteBuffer#offset}.
     * @returns {!ByteBuffer} this
     * @throws {TypeError} If `offset` is not a valid number
     * @throws {RangeError} If `offset` is out of bounds
     * @see ByteBuffer#reset
     * @expose
     */
    ByteBufferPrototype.mark = function (offset) {
        offset = typeof offset === 'undefined' ? this.offset : offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        this.markedOffset = offset;
        return this;
    };
    /**
     * Sets the byte order.
     * @param {boolean} littleEndian `true` for little endian byte order, `false` for big endian
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.order = function (littleEndian) {
        if (!this.noAssert) {
            if (typeof littleEndian !== 'boolean')
                throw TypeError("Illegal littleEndian: Not a boolean");
        }
        this.littleEndian = !!littleEndian;
        return this;
    };
    /**
     * Switches (to) little endian byte order.
     * @param {boolean=} littleEndian Defaults to `true`, otherwise uses big endian
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.LE = function (littleEndian) {
        this.littleEndian = typeof littleEndian !== 'undefined' ? !!littleEndian : true;
        return this;
    };
    /**
     * Switches (to) big endian byte order.
     * @param {boolean=} bigEndian Defaults to `true`, otherwise uses little endian
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.BE = function (bigEndian) {
        this.littleEndian = typeof bigEndian !== 'undefined' ? !bigEndian : false;
        return this;
    };
    /**
     * Prepends some data to this ByteBuffer. This will overwrite any contents before the specified offset up to the
     *  prepended data's length. If there is not enough space available before the specified `offset`, the backing buffer
     *  will be resized and its contents moved accordingly.
     * @param {!ByteBuffer|string|!ArrayBuffer} source Data to prepend. If `source` is a ByteBuffer, its offset will be
     *  modified according to the performed read operation.
     * @param {(string|number)=} encoding Encoding if `data` is a string ("base64", "hex", "binary", defaults to "utf8")
     * @param {number=} offset Offset to prepend at. Will use and decrease {@link ByteBuffer#offset} by the number of bytes
     *  prepended if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     * @example A relative `00<01 02 03>.prepend(<04 05>)` results in `<04 05 01 02 03>, 04 05|`
     * @example An absolute `00<01 02 03>.prepend(<04 05>, 2)` results in `04<05 02 03>, 04 05|`
     */
    ByteBufferPrototype.prepend = function (source, encoding, offset) {
        if (typeof encoding === 'number' || typeof encoding !== 'string') {
            offset = encoding;
            encoding = undefined;
        }
        var relative = typeof offset === 'undefined';
        if (relative)
            offset = this.offset;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: " + offset + " (not an integer)");
            offset >>>= 0;
            if (offset < 0 || offset + 0 > this.buffer.byteLength)
                throw RangeError("Illegal offset: 0 <= " + offset + " (+" + 0 + ") <= " + this.buffer.byteLength);
        }
        if (!(source instanceof ByteBuffer))
            source = ByteBuffer.wrap(source, encoding);
        var len = source.limit - source.offset;
        if (len <= 0)
            return this; // Nothing to prepend
        var diff = len - offset;
        if (diff > 0) {
            var buffer = new ArrayBuffer(this.buffer.byteLength + diff);
            var arrayView = new Uint8Array(buffer);
            arrayView.set(new Uint8Array(this.buffer).subarray(offset, this.buffer.byteLength), len);
            this.buffer = buffer;
            this.view = new DataView(buffer);
            this.offset += diff;
            if (this.markedOffset >= 0)
                this.markedOffset += diff;
            this.limit += diff;
            offset += diff;
        }
        else {
            var arrayView = new Uint8Array(this.buffer);
        }
        arrayView.set(new Uint8Array(source.buffer).subarray(source.offset, source.limit), offset - len);
        source.offset = source.limit;
        if (relative)
            this.offset -= len;
        return this;
    };
    /**
     * Prepends this ByteBuffer to another ByteBuffer. This will overwrite any contents before the specified offset up to the
     *  prepended data's length. If there is not enough space available before the specified `offset`, the backing buffer
     *  will be resized and its contents moved accordingly.
     * @param {!ByteBuffer} target Target ByteBuffer
     * @param {number=} offset Offset to prepend at. Will use and decrease {@link ByteBuffer#offset} by the number of bytes
     *  prepended if omitted.
     * @returns {!ByteBuffer} this
     * @expose
     * @see ByteBuffer#prepend
     */
    ByteBufferPrototype.prependTo = function (target, offset) {
        target.prepend(this, offset);
        return this;
    };
    /**
     * Prints debug information about this ByteBuffer's contents.
     * @param {function(string)=} out Output function to call, defaults to console.log
     * @expose
     */
    ByteBufferPrototype.printDebug = function (out) {
        if (typeof out !== 'function')
            out = console.log.bind(console);
        out(this.toString() + "\n" +
            "-------------------------------------------------------------------\n" +
            this.toDebug(/* columns */ true));
    };
    /**
     * Gets the number of remaining readable bytes. Contents are the bytes between {@link ByteBuffer#offset} and
     *  {@link ByteBuffer#limit}, so this returns `limit - offset`.
     * @returns {number} Remaining readable bytes. May be negative if `offset > limit`.
     * @expose
     */
    ByteBufferPrototype.remaining = function () {
        return this.limit - this.offset;
    };
    /**
     * Resets this ByteBuffer's {@link ByteBuffer#offset}. If an offset has been marked through {@link ByteBuffer#mark}
     *  before, `offset` will be set to {@link ByteBuffer#markedOffset}, which will then be discarded. If no offset has been
     *  marked, sets `offset = 0`.
     * @returns {!ByteBuffer} this
     * @see ByteBuffer#mark
     * @expose
     */
    ByteBufferPrototype.reset = function () {
        if (this.markedOffset >= 0) {
            this.offset = this.markedOffset;
            this.markedOffset = -1;
        }
        else {
            this.offset = 0;
        }
        return this;
    };
    /**
     * Resizes this ByteBuffer to be backed by a buffer of at least the given capacity. Will do nothing if already that
     *  large or larger.
     * @param {number} capacity Capacity required
     * @returns {!ByteBuffer} this
     * @throws {TypeError} If `capacity` is not a number
     * @throws {RangeError} If `capacity < 0`
     * @expose
     */
    ByteBufferPrototype.resize = function (capacity) {
        if (!this.noAssert) {
            if (typeof capacity !== 'number' || capacity % 1 !== 0)
                throw TypeError("Illegal capacity: " + capacity + " (not an integer)");
            capacity |= 0;
            if (capacity < 0)
                throw RangeError("Illegal capacity: 0 <= " + capacity);
        }
        if (this.buffer.byteLength < capacity) {
            var buffer = new ArrayBuffer(capacity);
            new Uint8Array(buffer).set(new Uint8Array(this.buffer));
            this.buffer = buffer;
            this.view = new DataView(buffer);
        }
        return this;
    };
    /**
     * Reverses this ByteBuffer's contents.
     * @param {number=} begin Offset to start at, defaults to {@link ByteBuffer#offset}
     * @param {number=} end Offset to end at, defaults to {@link ByteBuffer#limit}
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.reverse = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        if (!this.noAssert) {
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        if (begin === end)
            return this; // Nothing to reverse
        Array.prototype.reverse.call(new Uint8Array(this.buffer).subarray(begin, end));
        this.view = new DataView(this.buffer); // FIXME: Why exactly is this necessary?
        return this;
    };
    /**
     * Skips the next `length` bytes. This will just advance
     * @param {number} length Number of bytes to skip. May also be negative to move the offset back.
     * @returns {!ByteBuffer} this
     * @expose
     */
    ByteBufferPrototype.skip = function (length) {
        if (!this.noAssert) {
            if (typeof length !== 'number' || length % 1 !== 0)
                throw TypeError("Illegal length: " + length + " (not an integer)");
            length |= 0;
        }
        var offset = this.offset + length;
        if (!this.noAssert) {
            if (offset < 0 || offset > this.buffer.byteLength)
                throw RangeError("Illegal length: 0 <= " + this.offset + " + " + length + " <= " + this.buffer.byteLength);
        }
        this.offset = offset;
        return this;
    };
    /**
     * Slices this ByteBuffer by creating a cloned instance with `offset = begin` and `limit = end`.
     * @param {number=} begin Begin offset, defaults to {@link ByteBuffer#offset}.
     * @param {number=} end End offset, defaults to {@link ByteBuffer#limit}.
     * @returns {!ByteBuffer} Clone of this ByteBuffer with slicing applied, backed by the same {@link ByteBuffer#buffer}
     * @expose
     */
    ByteBufferPrototype.slice = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        if (!this.noAssert) {
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        var bb = this.clone();
        bb.offset = begin;
        bb.limit = end;
        return bb;
    };
    /**
     * Returns a copy of the backing buffer that contains this ByteBuffer's contents. Contents are the bytes between
     *  {@link ByteBuffer#offset} and {@link ByteBuffer#limit}.
     * @param {boolean=} forceCopy If `true` returns a copy, otherwise returns a view referencing the same memory if
     *  possible. Defaults to `false`
     * @returns {!ArrayBuffer} Contents as an ArrayBuffer
     * @expose
     */
    ByteBufferPrototype.toBuffer = function (forceCopy) {
        var offset = this.offset, limit = this.limit;
        if (!this.noAssert) {
            if (typeof offset !== 'number' || offset % 1 !== 0)
                throw TypeError("Illegal offset: Not an integer");
            offset >>>= 0;
            if (typeof limit !== 'number' || limit % 1 !== 0)
                throw TypeError("Illegal limit: Not an integer");
            limit >>>= 0;
            if (offset < 0 || offset > limit || limit > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + offset + " <= " + limit + " <= " + this.buffer.byteLength);
        }
        // NOTE: It's not possible to have another ArrayBuffer reference the same memory as the backing buffer. This is
        // possible with Uint8Array#subarray only, but we have to return an ArrayBuffer by contract. So:
        if (!forceCopy && offset === 0 && limit === this.buffer.byteLength)
            return this.buffer;
        if (offset === limit)
            return EMPTY_BUFFER;
        var buffer = new ArrayBuffer(limit - offset);
        new Uint8Array(buffer).set(new Uint8Array(this.buffer).subarray(offset, limit), 0);
        return buffer;
    };
    /**
     * Returns a raw buffer compacted to contain this ByteBuffer's contents. Contents are the bytes between
     *  {@link ByteBuffer#offset} and {@link ByteBuffer#limit}. This is an alias of {@link ByteBuffer#toBuffer}.
     * @function
     * @param {boolean=} forceCopy If `true` returns a copy, otherwise returns a view referencing the same memory.
     *  Defaults to `false`
     * @returns {!ArrayBuffer} Contents as an ArrayBuffer
     * @expose
     */
    ByteBufferPrototype.toArrayBuffer = ByteBufferPrototype.toBuffer;
    /**
     * Converts the ByteBuffer's contents to a string.
     * @param {string=} encoding Output encoding. Returns an informative string representation if omitted but also allows
     *  direct conversion to "utf8", "hex", "base64" and "binary" encoding. "debug" returns a hex representation with
     *  highlighted offsets.
     * @param {number=} begin Offset to begin at, defaults to {@link ByteBuffer#offset}
     * @param {number=} end Offset to end at, defaults to {@link ByteBuffer#limit}
     * @returns {string} String representation
     * @throws {Error} If `encoding` is invalid
     * @expose
     */
    ByteBufferPrototype.toString = function (encoding, begin, end) {
        if (typeof encoding === 'undefined')
            return "ByteBufferAB_DataView(offset=" + this.offset + ",markedOffset=" + this.markedOffset + ",limit=" + this.limit + ",capacity=" + this.capacity() + ")";
        if (typeof encoding === 'number')
            encoding = "utf8",
                begin = encoding,
                end = begin;
        switch (encoding) {
            case "utf8":
                return this.toUTF8(begin, end);
            case "base64":
                return this.toBase64(begin, end);
            case "hex":
                return this.toHex(begin, end);
            case "binary":
                return this.toBinary(begin, end);
            case "debug":
                return this.toDebug();
            case "columns":
                return this.toColumns();
            default:
                throw Error("Unsupported encoding: " + encoding);
        }
    };
    // lxiv-embeddable
    /**
     * lxiv-embeddable (c) 2014 Daniel Wirtz <dcode@dcode.io>
     * Released under the Apache License, Version 2.0
     * see: https://github.com/dcodeIO/lxiv for details
     */
    var lxiv = function () {
        "use strict";
        /**
         * lxiv namespace.
         * @type {!Object.<string,*>}
         * @exports lxiv
         */
        var lxiv = {};
        /**
         * Character codes for output.
         * @type {!Array.<number>}
         * @inner
         */
        var aout = [
            65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
            81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 97, 98, 99, 100, 101, 102,
            103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118,
            119, 120, 121, 122, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 43, 47
        ];
        /**
         * Character codes for input.
         * @type {!Array.<number>}
         * @inner
         */
        var ain = [];
        for (var i = 0, k = aout.length; i < k; ++i)
            ain[aout[i]] = i;
        /**
         * Encodes bytes to base64 char codes.
         * @param {!function():number|null} src Bytes source as a function returning the next byte respectively `null` if
         *  there are no more bytes left.
         * @param {!function(number)} dst Characters destination as a function successively called with each encoded char
         *  code.
         */
        lxiv.encode = function (src, dst) {
            var b, t;
            while ((b = src()) !== null) {
                dst(aout[(b >> 2) & 0x3f]);
                t = (b & 0x3) << 4;
                if ((b = src()) !== null) {
                    t |= (b >> 4) & 0xf;
                    dst(aout[(t | ((b >> 4) & 0xf)) & 0x3f]);
                    t = (b & 0xf) << 2;
                    if ((b = src()) !== null)
                        dst(aout[(t | ((b >> 6) & 0x3)) & 0x3f]),
                            dst(aout[b & 0x3f]);
                    else
                        dst(aout[t & 0x3f]),
                            dst(61);
                }
                else
                    dst(aout[t & 0x3f]),
                        dst(61),
                        dst(61);
            }
        };
        /**
         * Decodes base64 char codes to bytes.
         * @param {!function():number|null} src Characters source as a function returning the next char code respectively
         *  `null` if there are no more characters left.
         * @param {!function(number)} dst Bytes destination as a function successively called with the next byte.
         * @throws {Error} If a character code is invalid
         */
        lxiv.decode = function (src, dst) {
            var c, t1, t2;
            function fail(c) {
                throw Error("Illegal character code: " + c);
            }
            while ((c = src()) !== null) {
                t1 = ain[c];
                if (typeof t1 === 'undefined')
                    fail(c);
                if ((c = src()) !== null) {
                    t2 = ain[c];
                    if (typeof t2 === 'undefined')
                        fail(c);
                    dst((t1 << 2) >>> 0 | (t2 & 0x30) >> 4);
                    if ((c = src()) !== null) {
                        t1 = ain[c];
                        if (typeof t1 === 'undefined')
                            if (c === 61)
                                break;
                            else
                                fail(c);
                        dst(((t2 & 0xf) << 4) >>> 0 | (t1 & 0x3c) >> 2);
                        if ((c = src()) !== null) {
                            t2 = ain[c];
                            if (typeof t2 === 'undefined')
                                if (c === 61)
                                    break;
                                else
                                    fail(c);
                            dst(((t1 & 0x3) << 6) >>> 0 | t2);
                        }
                    }
                }
            }
        };
        /**
         * Tests if a string is valid base64.
         * @param {string} str String to test
         * @returns {boolean} `true` if valid, otherwise `false`
         */
        lxiv.test = function (str) {
            return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(str);
        };
        return lxiv;
    }();
    // encodings/base64
    /**
     * Encodes this ByteBuffer's contents to a base64 encoded string.
     * @param {number=} begin Offset to begin at, defaults to {@link ByteBuffer#offset}.
     * @param {number=} end Offset to end at, defaults to {@link ByteBuffer#limit}.
     * @returns {string} Base64 encoded string
     * @throws {RangeError} If `begin` or `end` is out of bounds
     * @expose
     */
    ByteBufferPrototype.toBase64 = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        begin = begin | 0;
        end = end | 0;
        if (begin < 0 || end > this.capacity || begin > end)
            throw RangeError("begin, end");
        var sd;
        lxiv.encode(function () {
            return begin < end ? this.view.getUint8(begin++) : null;
        }.bind(this), sd = stringDestination());
        return sd();
    };
    /**
     * Decodes a base64 encoded string to a ByteBuffer.
     * @param {string} str String to decode
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @returns {!ByteBuffer} ByteBuffer
     * @expose
     */
    ByteBuffer.fromBase64 = function (str, littleEndian) {
        if (typeof str !== 'string')
            throw TypeError("str");
        var bb = new ByteBuffer(str.length / 4 * 3, littleEndian), i = 0;
        lxiv.decode(stringSource(str), function (b) {
            bb.view.setUint8(i++, b);
        });
        bb.limit = i;
        return bb;
    };
    /**
     * Encodes a binary string to base64 like `window.btoa` does.
     * @param {string} str Binary string
     * @returns {string} Base64 encoded string
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Window.btoa
     * @expose
     */
    ByteBuffer.btoa = function (str) {
        return ByteBuffer.fromBinary(str).toBase64();
    };
    /**
     * Decodes a base64 encoded string to binary like `window.atob` does.
     * @param {string} b64 Base64 encoded string
     * @returns {string} Binary string
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Window.atob
     * @expose
     */
    ByteBuffer.atob = function (b64) {
        return ByteBuffer.fromBase64(b64).toBinary();
    };
    // encodings/binary
    /**
     * Encodes this ByteBuffer to a binary encoded string, that is using only characters 0x00-0xFF as bytes.
     * @param {number=} begin Offset to begin at. Defaults to {@link ByteBuffer#offset}.
     * @param {number=} end Offset to end at. Defaults to {@link ByteBuffer#limit}.
     * @returns {string} Binary encoded string
     * @throws {RangeError} If `offset > limit`
     * @expose
     */
    ByteBufferPrototype.toBinary = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        begin |= 0;
        end |= 0;
        if (begin < 0 || end > this.capacity() || begin > end)
            throw RangeError("begin, end");
        if (begin === end)
            return "";
        var chars = [], parts = [];
        while (begin < end) {
            chars.push(this.view.getUint8(begin++));
            if (chars.length >= 1024)
                parts.push(String.fromCharCode.apply(String, chars)),
                    chars = [];
        }
        return parts.join('') + String.fromCharCode.apply(String, chars);
    };
    /**
     * Decodes a binary encoded string, that is using only characters 0x00-0xFF as bytes, to a ByteBuffer.
     * @param {string} str String to decode
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @returns {!ByteBuffer} ByteBuffer
     * @expose
     */
    ByteBuffer.fromBinary = function (str, littleEndian) {
        if (typeof str !== 'string')
            throw TypeError("str");
        var i = 0, k = str.length, charCode, bb = new ByteBuffer(k, littleEndian);
        while (i < k) {
            charCode = str.charCodeAt(i);
            if (charCode > 0xff)
                throw RangeError("illegal char code: " + charCode);
            bb.view.setUint8(i++, charCode);
        }
        bb.limit = k;
        return bb;
    };
    // encodings/debug
    /**
     * Encodes this ByteBuffer to a hex encoded string with marked offsets. Offset symbols are:
     * * `<` : offset,
     * * `'` : markedOffset,
     * * `>` : limit,
     * * `|` : offset and limit,
     * * `[` : offset and markedOffset,
     * * `]` : markedOffset and limit,
     * * `!` : offset, markedOffset and limit
     * @param {boolean=} columns If `true` returns two columns hex + ascii, defaults to `false`
     * @returns {string|!Array.<string>} Debug string or array of lines if `asArray = true`
     * @expose
     * @example `>00'01 02<03` contains four bytes with `limit=0, markedOffset=1, offset=3`
     * @example `00[01 02 03>` contains four bytes with `offset=markedOffset=1, limit=4`
     * @example `00|01 02 03` contains four bytes with `offset=limit=1, markedOffset=-1`
     * @example `|` contains zero bytes with `offset=limit=0, markedOffset=-1`
     */
    ByteBufferPrototype.toDebug = function (columns) {
        var i = -1, k = this.buffer.byteLength, b, hex = "", asc = "", out = "";
        while (i < k) {
            if (i !== -1) {
                b = this.view.getUint8(i);
                if (b < 0x10)
                    hex += "0" + b.toString(16).toUpperCase();
                else
                    hex += b.toString(16).toUpperCase();
                if (columns)
                    asc += b > 32 && b < 127 ? String.fromCharCode(b) : '.';
            }
            ++i;
            if (columns) {
                if (i > 0 && i % 16 === 0 && i !== k) {
                    while (hex.length < 3 * 16 + 3)
                        hex += " ";
                    out += hex + asc + "\n";
                    hex = asc = "";
                }
            }
            if (i === this.offset && i === this.limit)
                hex += i === this.markedOffset ? "!" : "|";
            else if (i === this.offset)
                hex += i === this.markedOffset ? "[" : "<";
            else if (i === this.limit)
                hex += i === this.markedOffset ? "]" : ">";
            else
                hex += i === this.markedOffset ? "'" : (columns || (i !== 0 && i !== k) ? " " : "");
        }
        if (columns && hex !== " ") {
            while (hex.length < 3 * 16 + 3)
                hex += " ";
            out += hex + asc + "\n";
        }
        return columns ? out : hex;
    };
    /**
     * Decodes a hex encoded string with marked offsets to a ByteBuffer.
     * @param {string} str Debug string to decode (not be generated with `columns = true`)
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @returns {!ByteBuffer} ByteBuffer
     * @expose
     * @see ByteBuffer#toDebug
     */
    ByteBuffer.fromDebug = function (str, littleEndian, noAssert) {
        var k = str.length, bb = new ByteBuffer(((k + 1) / 3) | 0, littleEndian, noAssert);
        var i = 0, j = 0, ch, b, rs = false, // Require symbol next
        ho = false, hm = false, hl = false, // Already has offset (ho), markedOffset (hm), limit (hl)?
        fail = false;
        while (i < k) {
            switch (ch = str.charAt(i++)) {
                case '!':
                    if (!noAssert) {
                        if (ho || hm || hl) {
                            fail = true;
                            break;
                        }
                        ho = hm = hl = true;
                    }
                    bb.offset = bb.markedOffset = bb.limit = j;
                    rs = false;
                    break;
                case '|':
                    if (!noAssert) {
                        if (ho || hl) {
                            fail = true;
                            break;
                        }
                        ho = hl = true;
                    }
                    bb.offset = bb.limit = j;
                    rs = false;
                    break;
                case '[':
                    if (!noAssert) {
                        if (ho || hm) {
                            fail = true;
                            break;
                        }
                        ho = hm = true;
                    }
                    bb.offset = bb.markedOffset = j;
                    rs = false;
                    break;
                case '<':
                    if (!noAssert) {
                        if (ho) {
                            fail = true;
                            break;
                        }
                        ho = true;
                    }
                    bb.offset = j;
                    rs = false;
                    break;
                case ']':
                    if (!noAssert) {
                        if (hl || hm) {
                            fail = true;
                            break;
                        }
                        hl = hm = true;
                    }
                    bb.limit = bb.markedOffset = j;
                    rs = false;
                    break;
                case '>':
                    if (!noAssert) {
                        if (hl) {
                            fail = true;
                            break;
                        }
                        hl = true;
                    }
                    bb.limit = j;
                    rs = false;
                    break;
                case "'":
                    if (!noAssert) {
                        if (hm) {
                            fail = true;
                            break;
                        }
                        hm = true;
                    }
                    bb.markedOffset = j;
                    rs = false;
                    break;
                case ' ':
                    rs = false;
                    break;
                default:
                    if (!noAssert) {
                        if (rs) {
                            fail = true;
                            break;
                        }
                    }
                    b = parseInt(ch + str.charAt(i++), 16);
                    if (!noAssert) {
                        if (isNaN(b) || b < 0 || b > 255)
                            throw TypeError("Illegal str: Not a debug encoded string");
                    }
                    bb.view.setUint8(j++, b);
                    rs = true;
            }
            if (fail)
                throw TypeError("Illegal str: Invalid symbol at " + i);
        }
        if (!noAssert) {
            if (!ho || !hl)
                throw TypeError("Illegal str: Missing offset or limit");
            if (j < bb.buffer.byteLength)
                throw TypeError("Illegal str: Not a debug encoded string (is it hex?) " + j + " < " + k);
        }
        return bb;
    };
    // encodings/hex
    /**
     * Encodes this ByteBuffer's contents to a hex encoded string.
     * @param {number=} begin Offset to begin at. Defaults to {@link ByteBuffer#offset}.
     * @param {number=} end Offset to end at. Defaults to {@link ByteBuffer#limit}.
     * @returns {string} Hex encoded string
     * @expose
     */
    ByteBufferPrototype.toHex = function (begin, end) {
        begin = typeof begin === 'undefined' ? this.offset : begin;
        end = typeof end === 'undefined' ? this.limit : end;
        if (!this.noAssert) {
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        var out = new Array(end - begin), b;
        while (begin < end) {
            b = this.view.getUint8(begin++);
            if (b < 0x10)
                out.push("0", b.toString(16));
            else
                out.push(b.toString(16));
        }
        return out.join('');
    };
    /**
     * Decodes a hex encoded string to a ByteBuffer.
     * @param {string} str String to decode
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @returns {!ByteBuffer} ByteBuffer
     * @expose
     */
    ByteBuffer.fromHex = function (str, littleEndian, noAssert) {
        if (!noAssert) {
            if (typeof str !== 'string')
                throw TypeError("Illegal str: Not a string");
            if (str.length % 2 !== 0)
                throw TypeError("Illegal str: Length not a multiple of 2");
        }
        var k = str.length, bb = new ByteBuffer((k / 2) | 0, littleEndian), b;
        for (var i = 0, j = 0; i < k; i += 2) {
            b = parseInt(str.substring(i, i + 2), 16);
            if (!noAssert)
                if (!isFinite(b) || b < 0 || b > 255)
                    throw TypeError("Illegal str: Contains non-hex characters");
            bb.view.setUint8(j++, b);
        }
        bb.limit = j;
        return bb;
    };
    // utfx-embeddable
    /**
     * utfx-embeddable (c) 2014 Daniel Wirtz <dcode@dcode.io>
     * Released under the Apache License, Version 2.0
     * see: https://github.com/dcodeIO/utfx for details
     */
    var utfx = function () {
        "use strict";
        /**
         * utfx namespace.
         * @inner
         * @type {!Object.<string,*>}
         */
        var utfx = {};
        /**
         * Maximum valid code point.
         * @type {number}
         * @const
         */
        utfx.MAX_CODEPOINT = 0x10FFFF;
        /**
         * Encodes UTF8 code points to UTF8 bytes.
         * @param {(!function():number|null) | number} src Code points source, either as a function returning the next code point
         *  respectively `null` if there are no more code points left or a single numeric code point.
         * @param {!function(number)} dst Bytes destination as a function successively called with the next byte
         */
        utfx.encodeUTF8 = function (src, dst) {
            var cp = null;
            if (typeof src === 'number')
                cp = src,
                    src = function () { return null; };
            while (cp !== null || (cp = src()) !== null) {
                if (cp < 0x80)
                    dst(cp & 0x7F);
                else if (cp < 0x800)
                    dst(((cp >> 6) & 0x1F) | 0xC0),
                        dst((cp & 0x3F) | 0x80);
                else if (cp < 0x10000)
                    dst(((cp >> 12) & 0x0F) | 0xE0),
                        dst(((cp >> 6) & 0x3F) | 0x80),
                        dst((cp & 0x3F) | 0x80);
                else
                    dst(((cp >> 18) & 0x07) | 0xF0),
                        dst(((cp >> 12) & 0x3F) | 0x80),
                        dst(((cp >> 6) & 0x3F) | 0x80),
                        dst((cp & 0x3F) | 0x80);
                cp = null;
            }
        };
        /**
         * Decodes UTF8 bytes to UTF8 code points.
         * @param {!function():number|null} src Bytes source as a function returning the next byte respectively `null` if there
         *  are no more bytes left.
         * @param {!function(number)} dst Code points destination as a function successively called with each decoded code point.
         * @throws {RangeError} If a starting byte is invalid in UTF8
         * @throws {Error} If the last sequence is truncated. Has an array property `bytes` holding the
         *  remaining bytes.
         */
        utfx.decodeUTF8 = function (src, dst) {
            var a, b, c, d, fail = function (b) {
                b = b.slice(0, b.indexOf(null));
                var err = Error(b.toString());
                err.name = "TruncatedError";
                err['bytes'] = b;
                throw err;
            };
            while ((a = src()) !== null) {
                if ((a & 0x80) === 0)
                    dst(a);
                else if ((a & 0xE0) === 0xC0)
                    ((b = src()) === null) && fail([a, b]),
                        dst(((a & 0x1F) << 6) | (b & 0x3F));
                else if ((a & 0xF0) === 0xE0)
                    ((b = src()) === null || (c = src()) === null) && fail([a, b, c]),
                        dst(((a & 0x0F) << 12) | ((b & 0x3F) << 6) | (c & 0x3F));
                else if ((a & 0xF8) === 0xF0)
                    ((b = src()) === null || (c = src()) === null || (d = src()) === null) && fail([a, b, c, d]),
                        dst(((a & 0x07) << 18) | ((b & 0x3F) << 12) | ((c & 0x3F) << 6) | (d & 0x3F));
                else
                    throw RangeError("Illegal starting byte: " + a);
            }
        };
        /**
         * Converts UTF16 characters to UTF8 code points.
         * @param {!function():number|null} src Characters source as a function returning the next char code respectively
         *  `null` if there are no more characters left.
         * @param {!function(number)} dst Code points destination as a function successively called with each converted code
         *  point.
         */
        utfx.UTF16toUTF8 = function (src, dst) {
            var c1, c2 = null;
            while (true) {
                if ((c1 = c2 !== null ? c2 : src()) === null)
                    break;
                if (c1 >= 0xD800 && c1 <= 0xDFFF) {
                    if ((c2 = src()) !== null) {
                        if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
                            dst((c1 - 0xD800) * 0x400 + c2 - 0xDC00 + 0x10000);
                            c2 = null;
                            continue;
                        }
                    }
                }
                dst(c1);
            }
            if (c2 !== null)
                dst(c2);
        };
        /**
         * Converts UTF8 code points to UTF16 characters.
         * @param {(!function():number|null) | number} src Code points source, either as a function returning the next code point
         *  respectively `null` if there are no more code points left or a single numeric code point.
         * @param {!function(number)} dst Characters destination as a function successively called with each converted char code.
         * @throws {RangeError} If a code point is out of range
         */
        utfx.UTF8toUTF16 = function (src, dst) {
            var cp = null;
            if (typeof src === 'number')
                cp = src, src = function () { return null; };
            while (cp !== null || (cp = src()) !== null) {
                if (cp <= 0xFFFF)
                    dst(cp);
                else
                    cp -= 0x10000,
                        dst((cp >> 10) + 0xD800),
                        dst((cp % 0x400) + 0xDC00);
                cp = null;
            }
        };
        /**
         * Converts and encodes UTF16 characters to UTF8 bytes.
         * @param {!function():number|null} src Characters source as a function returning the next char code respectively `null`
         *  if there are no more characters left.
         * @param {!function(number)} dst Bytes destination as a function successively called with the next byte.
         */
        utfx.encodeUTF16toUTF8 = function (src, dst) {
            utfx.UTF16toUTF8(src, function (cp) {
                utfx.encodeUTF8(cp, dst);
            });
        };
        /**
         * Decodes and converts UTF8 bytes to UTF16 characters.
         * @param {!function():number|null} src Bytes source as a function returning the next byte respectively `null` if there
         *  are no more bytes left.
         * @param {!function(number)} dst Characters destination as a function successively called with each converted char code.
         * @throws {RangeError} If a starting byte is invalid in UTF8
         * @throws {Error} If the last sequence is truncated. Has an array property `bytes` holding the remaining bytes.
         */
        utfx.decodeUTF8toUTF16 = function (src, dst) {
            utfx.decodeUTF8(src, function (cp) {
                utfx.UTF8toUTF16(cp, dst);
            });
        };
        /**
         * Calculates the byte length of an UTF8 code point.
         * @param {number} cp UTF8 code point
         * @returns {number} Byte length
         */
        utfx.calculateCodePoint = function (cp) {
            return (cp < 0x80) ? 1 : (cp < 0x800) ? 2 : (cp < 0x10000) ? 3 : 4;
        };
        /**
         * Calculates the number of UTF8 bytes required to store UTF8 code points.
         * @param {(!function():number|null)} src Code points source as a function returning the next code point respectively
         *  `null` if there are no more code points left.
         * @returns {number} The number of UTF8 bytes required
         */
        utfx.calculateUTF8 = function (src) {
            var cp, l = 0;
            while ((cp = src()) !== null)
                l += (cp < 0x80) ? 1 : (cp < 0x800) ? 2 : (cp < 0x10000) ? 3 : 4;
            return l;
        };
        /**
         * Calculates the number of UTF8 code points respectively UTF8 bytes required to store UTF16 char codes.
         * @param {(!function():number|null)} src Characters source as a function returning the next char code respectively
         *  `null` if there are no more characters left.
         * @returns {!Array.<number>} The number of UTF8 code points at index 0 and the number of UTF8 bytes required at index 1.
         */
        utfx.calculateUTF16asUTF8 = function (src) {
            var n = 0, l = 0;
            utfx.UTF16toUTF8(src, function (cp) {
                ++n;
                l += (cp < 0x80) ? 1 : (cp < 0x800) ? 2 : (cp < 0x10000) ? 3 : 4;
            });
            return [n, l];
        };
        return utfx;
    }();
    // encodings/utf8
    /**
     * Encodes this ByteBuffer's contents between {@link ByteBuffer#offset} and {@link ByteBuffer#limit} to an UTF8 encoded
     *  string.
     * @returns {string} Hex encoded string
     * @throws {RangeError} If `offset > limit`
     * @expose
     */
    ByteBufferPrototype.toUTF8 = function (begin, end) {
        if (typeof begin === 'undefined')
            begin = this.offset;
        if (typeof end === 'undefined')
            end = this.limit;
        if (!this.noAssert) {
            if (typeof begin !== 'number' || begin % 1 !== 0)
                throw TypeError("Illegal begin: Not an integer");
            begin >>>= 0;
            if (typeof end !== 'number' || end % 1 !== 0)
                throw TypeError("Illegal end: Not an integer");
            end >>>= 0;
            if (begin < 0 || begin > end || end > this.buffer.byteLength)
                throw RangeError("Illegal range: 0 <= " + begin + " <= " + end + " <= " + this.buffer.byteLength);
        }
        var sd;
        try {
            utfx.decodeUTF8toUTF16(function () {
                return begin < end ? this.view.getUint8(begin++) : null;
            }.bind(this), sd = stringDestination());
        }
        catch (e) {
            if (begin !== end)
                throw RangeError("Illegal range: Truncated data, " + begin + " != " + end);
        }
        return sd();
    };
    /**
     * Decodes an UTF8 encoded string to a ByteBuffer.
     * @param {string} str String to decode
     * @param {boolean=} littleEndian Whether to use little or big endian byte order. Defaults to
     *  {@link ByteBuffer.DEFAULT_ENDIAN}.
     * @param {boolean=} noAssert Whether to skip assertions of offsets and values. Defaults to
     *  {@link ByteBuffer.DEFAULT_NOASSERT}.
     * @returns {!ByteBuffer} ByteBuffer
     * @expose
     */
    ByteBuffer.fromUTF8 = function (str, littleEndian, noAssert) {
        if (!noAssert)
            if (typeof str !== 'string')
                throw TypeError("Illegal str: Not a string");
        var bb = new ByteBuffer(utfx.calculateUTF16asUTF8(stringSource(str), true)[1], littleEndian, noAssert), i = 0;
        utfx.encodeUTF16toUTF8(stringSource(str), function (b) {
            bb.view.setUint8(i++, b);
        });
        bb.limit = i;
        return bb;
    };
    return ByteBuffer;
});
/*
 Copyright 2013 Daniel Wirtz <dcode@dcode.io>
 Copyright 2009 The Closure Library Authors. All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS-IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */
/**
 * @license long.js (c) 2013 Daniel Wirtz <dcode@dcode.io>
 * Released under the Apache License, Version 2.0
 * see: https://github.com/dcodeIO/long.js for details
 */
(function (global, factory) {
    /* AMD */ if (typeof define === 'function' && define["amd"])
        define([], factory);
    else if (typeof require === 'function' && typeof module === "object" && module && module["exports"])
        module["exports"] = factory();
    else
        (global["dcodeIO"] = global["dcodeIO"] || {})["Long"] = factory();
})(this, function () {
    "use strict";
    /**
     * Constructs a 64 bit two's-complement integer, given its low and high 32 bit values as *signed* integers.
     *  See the from* functions below for more convenient ways of constructing Longs.
     * @exports Long
     * @class A Long class for representing a 64 bit two's-complement integer value.
     * @param {number} low The low (signed) 32 bits of the long
     * @param {number} high The high (signed) 32 bits of the long
     * @param {boolean=} unsigned Whether unsigned or not, defaults to `false` for signed
     * @constructor
     */
    function Long(low, high, unsigned) {
        /**
         * The low 32 bits as a signed value.
         * @type {number}
         */
        this.low = low | 0;
        /**
         * The high 32 bits as a signed value.
         * @type {number}
         */
        this.high = high | 0;
        /**
         * Whether unsigned or not.
         * @type {boolean}
         */
        this.unsigned = !!unsigned;
    }
    // The internal representation of a long is the two given signed, 32-bit values.
    // We use 32-bit pieces because these are the size of integers on which
    // Javascript performs bit-operations.  For operations like addition and
    // multiplication, we split each number into 16 bit pieces, which can easily be
    // multiplied within Javascript's floating-point representation without overflow
    // or change in sign.
    //
    // In the algorithms below, we frequently reduce the negative case to the
    // positive case by negating the input(s) and then post-processing the result.
    // Note that we must ALWAYS check specially whether those values are MIN_VALUE
    // (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
    // a positive number, it overflows back into a negative).  Not handling this
    // case would often result in infinite recursion.
    //
    // Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the from*
    // methods on which they depend.
    /**
     * An indicator used to reliably determine if an object is a Long or not.
     * @type {boolean}
     * @const
     * @private
     */
    Long.prototype.__isLong__;
    Object.defineProperty(Long.prototype, "__isLong__", {
        value: true,
        enumerable: false,
        configurable: false
    });
    /**
     * @function
     * @param {*} obj Object
     * @returns {boolean}
     * @inner
     */
    function isLong(obj) {
        return (obj && obj["__isLong__"]) === true;
    }
    /**
     * Tests if the specified object is a Long.
     * @function
     * @param {*} obj Object
     * @returns {boolean}
     */
    Long.isLong = isLong;
    /**
     * A cache of the Long representations of small integer values.
     * @type {!Object}
     * @inner
     */
    var INT_CACHE = {};
    /**
     * A cache of the Long representations of small unsigned integer values.
     * @type {!Object}
     * @inner
     */
    var UINT_CACHE = {};
    /**
     * @param {number} value
     * @param {boolean=} unsigned
     * @returns {!Long}
     * @inner
     */
    function fromInt(value, unsigned) {
        var obj, cachedObj, cache;
        if (unsigned) {
            value >>>= 0;
            if (cache = (0 <= value && value < 256)) {
                cachedObj = UINT_CACHE[value];
                if (cachedObj)
                    return cachedObj;
            }
            obj = fromBits(value, (value | 0) < 0 ? -1 : 0, true);
            if (cache)
                UINT_CACHE[value] = obj;
            return obj;
        }
        else {
            value |= 0;
            if (cache = (-128 <= value && value < 128)) {
                cachedObj = INT_CACHE[value];
                if (cachedObj)
                    return cachedObj;
            }
            obj = fromBits(value, value < 0 ? -1 : 0, false);
            if (cache)
                INT_CACHE[value] = obj;
            return obj;
        }
    }
    /**
     * Returns a Long representing the given 32 bit integer value.
     * @function
     * @param {number} value The 32 bit integer in question
     * @param {boolean=} unsigned Whether unsigned or not, defaults to `false` for signed
     * @returns {!Long} The corresponding Long value
     */
    Long.fromInt = fromInt;
    /**
     * @param {number} value
     * @param {boolean=} unsigned
     * @returns {!Long}
     * @inner
     */
    function fromNumber(value, unsigned) {
        if (isNaN(value) || !isFinite(value))
            return unsigned ? UZERO : ZERO;
        if (unsigned) {
            if (value < 0)
                return UZERO;
            if (value >= TWO_PWR_64_DBL)
                return MAX_UNSIGNED_VALUE;
        }
        else {
            if (value <= -TWO_PWR_63_DBL)
                return MIN_VALUE;
            if (value + 1 >= TWO_PWR_63_DBL)
                return MAX_VALUE;
        }
        if (value < 0)
            return fromNumber(-value, unsigned).neg();
        return fromBits((value % TWO_PWR_32_DBL) | 0, (value / TWO_PWR_32_DBL) | 0, unsigned);
    }
    /**
     * Returns a Long representing the given value, provided that it is a finite number. Otherwise, zero is returned.
     * @function
     * @param {number} value The number in question
     * @param {boolean=} unsigned Whether unsigned or not, defaults to `false` for signed
     * @returns {!Long} The corresponding Long value
     */
    Long.fromNumber = fromNumber;
    /**
     * @param {number} lowBits
     * @param {number} highBits
     * @param {boolean=} unsigned
     * @returns {!Long}
     * @inner
     */
    function fromBits(lowBits, highBits, unsigned) {
        return new Long(lowBits, highBits, unsigned);
    }
    /**
     * Returns a Long representing the 64 bit integer that comes by concatenating the given low and high bits. Each is
     *  assumed to use 32 bits.
     * @function
     * @param {number} lowBits The low 32 bits
     * @param {number} highBits The high 32 bits
     * @param {boolean=} unsigned Whether unsigned or not, defaults to `false` for signed
     * @returns {!Long} The corresponding Long value
     */
    Long.fromBits = fromBits;
    /**
     * @function
     * @param {number} base
     * @param {number} exponent
     * @returns {number}
     * @inner
     */
    var pow_dbl = Math.pow; // Used 4 times (4*8 to 15+4)
    /**
     * @param {string} str
     * @param {(boolean|number)=} unsigned
     * @param {number=} radix
     * @returns {!Long}
     * @inner
     */
    function fromString(str, unsigned, radix) {
        if (str.length === 0)
            throw Error('empty string');
        if (str === "NaN" || str === "Infinity" || str === "+Infinity" || str === "-Infinity")
            return ZERO;
        if (typeof unsigned === 'number') {
            // For goog.math.long compatibility
            radix = unsigned,
                unsigned = false;
        }
        else {
            unsigned = !!unsigned;
        }
        radix = radix || 10;
        if (radix < 2 || 36 < radix)
            throw RangeError('radix');
        var p;
        if ((p = str.indexOf('-')) > 0)
            throw Error('interior hyphen');
        else if (p === 0) {
            return fromString(str.substring(1), unsigned, radix).neg();
        }
        // Do several (8) digits each time through the loop, so as to
        // minimize the calls to the very expensive emulated div.
        var radixToPower = fromNumber(pow_dbl(radix, 8));
        var result = ZERO;
        for (var i = 0; i < str.length; i += 8) {
            var size = Math.min(8, str.length - i), value = parseInt(str.substring(i, i + size), radix);
            if (size < 8) {
                var power = fromNumber(pow_dbl(radix, size));
                result = result.mul(power).add(fromNumber(value));
            }
            else {
                result = result.mul(radixToPower);
                result = result.add(fromNumber(value));
            }
        }
        result.unsigned = unsigned;
        return result;
    }
    /**
     * Returns a Long representation of the given string, written using the specified radix.
     * @function
     * @param {string} str The textual representation of the Long
     * @param {(boolean|number)=} unsigned Whether unsigned or not, defaults to `false` for signed
     * @param {number=} radix The radix in which the text is written (2-36), defaults to 10
     * @returns {!Long} The corresponding Long value
     */
    Long.fromString = fromString;
    /**
     * @function
     * @param {!Long|number|string|!{low: number, high: number, unsigned: boolean}} val
     * @returns {!Long}
     * @inner
     */
    function fromValue(val) {
        if (val /* is compatible */ instanceof Long)
            return val;
        if (typeof val === 'number')
            return fromNumber(val);
        if (typeof val === 'string')
            return fromString(val);
        // Throws for non-objects, converts non-instanceof Long:
        return fromBits(val.low, val.high, val.unsigned);
    }
    /**
     * Converts the specified value to a Long.
     * @function
     * @param {!Long|number|string|!{low: number, high: number, unsigned: boolean}} val Value
     * @returns {!Long}
     */
    Long.fromValue = fromValue;
    // NOTE: the compiler should inline these constant values below and then remove these variables, so there should be
    // no runtime penalty for these.
    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_16_DBL = 1 << 16;
    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_24_DBL = 1 << 24;
    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;
    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;
    /**
     * @type {number}
     * @const
     * @inner
     */
    var TWO_PWR_63_DBL = TWO_PWR_64_DBL / 2;
    /**
     * @type {!Long}
     * @const
     * @inner
     */
    var TWO_PWR_24 = fromInt(TWO_PWR_24_DBL);
    /**
     * @type {!Long}
     * @inner
     */
    var ZERO = fromInt(0);
    /**
     * Signed zero.
     * @type {!Long}
     */
    Long.ZERO = ZERO;
    /**
     * @type {!Long}
     * @inner
     */
    var UZERO = fromInt(0, true);
    /**
     * Unsigned zero.
     * @type {!Long}
     */
    Long.UZERO = UZERO;
    /**
     * @type {!Long}
     * @inner
     */
    var ONE = fromInt(1);
    /**
     * Signed one.
     * @type {!Long}
     */
    Long.ONE = ONE;
    /**
     * @type {!Long}
     * @inner
     */
    var UONE = fromInt(1, true);
    /**
     * Unsigned one.
     * @type {!Long}
     */
    Long.UONE = UONE;
    /**
     * @type {!Long}
     * @inner
     */
    var NEG_ONE = fromInt(-1);
    /**
     * Signed negative one.
     * @type {!Long}
     */
    Long.NEG_ONE = NEG_ONE;
    /**
     * @type {!Long}
     * @inner
     */
    var MAX_VALUE = fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0, false);
    /**
     * Maximum signed value.
     * @type {!Long}
     */
    Long.MAX_VALUE = MAX_VALUE;
    /**
     * @type {!Long}
     * @inner
     */
    var MAX_UNSIGNED_VALUE = fromBits(0xFFFFFFFF | 0, 0xFFFFFFFF | 0, true);
    /**
     * Maximum unsigned value.
     * @type {!Long}
     */
    Long.MAX_UNSIGNED_VALUE = MAX_UNSIGNED_VALUE;
    /**
     * @type {!Long}
     * @inner
     */
    var MIN_VALUE = fromBits(0, 0x80000000 | 0, false);
    /**
     * Minimum signed value.
     * @type {!Long}
     */
    Long.MIN_VALUE = MIN_VALUE;
    /**
     * @alias Long.prototype
     * @inner
     */
    var LongPrototype = Long.prototype;
    /**
     * Converts the Long to a 32 bit integer, assuming it is a 32 bit integer.
     * @returns {number}
     */
    LongPrototype.toInt = function toInt() {
        return this.unsigned ? this.low >>> 0 : this.low;
    };
    /**
     * Converts the Long to a the nearest floating-point representation of this value (double, 53 bit mantissa).
     * @returns {number}
     */
    LongPrototype.toNumber = function toNumber() {
        if (this.unsigned)
            return ((this.high >>> 0) * TWO_PWR_32_DBL) + (this.low >>> 0);
        return this.high * TWO_PWR_32_DBL + (this.low >>> 0);
    };
    /**
     * Converts the Long to a string written in the specified radix.
     * @param {number=} radix Radix (2-36), defaults to 10
     * @returns {string}
     * @override
     * @throws {RangeError} If `radix` is out of range
     */
    LongPrototype.toString = function toString(radix) {
        radix = radix || 10;
        if (radix < 2 || 36 < radix)
            throw RangeError('radix');
        if (this.isZero())
            return '0';
        if (this.isNegative()) {
            if (this.eq(MIN_VALUE)) {
                // We need to change the Long value before it can be negated, so we remove
                // the bottom-most digit in this base and then recurse to do the rest.
                var radixLong = fromNumber(radix), div = this.div(radixLong), rem1 = div.mul(radixLong).sub(this);
                return div.toString(radix) + rem1.toInt().toString(radix);
            }
            else
                return '-' + this.neg().toString(radix);
        }
        // Do several (6) digits each time through the loop, so as to
        // minimize the calls to the very expensive emulated div.
        var radixToPower = fromNumber(pow_dbl(radix, 6), this.unsigned), rem = this;
        var result = '';
        while (true) {
            var remDiv = rem.div(radixToPower), intval = rem.sub(remDiv.mul(radixToPower)).toInt() >>> 0, digits = intval.toString(radix);
            rem = remDiv;
            if (rem.isZero())
                return digits + result;
            else {
                while (digits.length < 6)
                    digits = '0' + digits;
                result = '' + digits + result;
            }
        }
    };
    /**
     * Gets the high 32 bits as a signed integer.
     * @returns {number} Signed high bits
     */
    LongPrototype.getHighBits = function getHighBits() {
        return this.high;
    };
    /**
     * Gets the high 32 bits as an unsigned integer.
     * @returns {number} Unsigned high bits
     */
    LongPrototype.getHighBitsUnsigned = function getHighBitsUnsigned() {
        return this.high >>> 0;
    };
    /**
     * Gets the low 32 bits as a signed integer.
     * @returns {number} Signed low bits
     */
    LongPrototype.getLowBits = function getLowBits() {
        return this.low;
    };
    /**
     * Gets the low 32 bits as an unsigned integer.
     * @returns {number} Unsigned low bits
     */
    LongPrototype.getLowBitsUnsigned = function getLowBitsUnsigned() {
        return this.low >>> 0;
    };
    /**
     * Gets the number of bits needed to represent the absolute value of this Long.
     * @returns {number}
     */
    LongPrototype.getNumBitsAbs = function getNumBitsAbs() {
        if (this.isNegative())
            return this.eq(MIN_VALUE) ? 64 : this.neg().getNumBitsAbs();
        var val = this.high != 0 ? this.high : this.low;
        for (var bit = 31; bit > 0; bit--)
            if ((val & (1 << bit)) != 0)
                break;
        return this.high != 0 ? bit + 33 : bit + 1;
    };
    /**
     * Tests if this Long's value equals zero.
     * @returns {boolean}
     */
    LongPrototype.isZero = function isZero() {
        return this.high === 0 && this.low === 0;
    };
    /**
     * Tests if this Long's value is negative.
     * @returns {boolean}
     */
    LongPrototype.isNegative = function isNegative() {
        return !this.unsigned && this.high < 0;
    };
    /**
     * Tests if this Long's value is positive.
     * @returns {boolean}
     */
    LongPrototype.isPositive = function isPositive() {
        return this.unsigned || this.high >= 0;
    };
    /**
     * Tests if this Long's value is odd.
     * @returns {boolean}
     */
    LongPrototype.isOdd = function isOdd() {
        return (this.low & 1) === 1;
    };
    /**
     * Tests if this Long's value is even.
     * @returns {boolean}
     */
    LongPrototype.isEven = function isEven() {
        return (this.low & 1) === 0;
    };
    /**
     * Tests if this Long's value equals the specified's.
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.equals = function equals(other) {
        if (!isLong(other))
            other = fromValue(other);
        if (this.unsigned !== other.unsigned && (this.high >>> 31) === 1 && (other.high >>> 31) === 1)
            return false;
        return this.high === other.high && this.low === other.low;
    };
    /**
     * Tests if this Long's value equals the specified's. This is an alias of {@link Long#equals}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.eq = LongPrototype.equals;
    /**
     * Tests if this Long's value differs from the specified's.
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.notEquals = function notEquals(other) {
        return !this.eq(/* validates */ other);
    };
    /**
     * Tests if this Long's value differs from the specified's. This is an alias of {@link Long#notEquals}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.neq = LongPrototype.notEquals;
    /**
     * Tests if this Long's value is less than the specified's.
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.lessThan = function lessThan(other) {
        return this.comp(/* validates */ other) < 0;
    };
    /**
     * Tests if this Long's value is less than the specified's. This is an alias of {@link Long#lessThan}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.lt = LongPrototype.lessThan;
    /**
     * Tests if this Long's value is less than or equal the specified's.
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.lessThanOrEqual = function lessThanOrEqual(other) {
        return this.comp(/* validates */ other) <= 0;
    };
    /**
     * Tests if this Long's value is less than or equal the specified's. This is an alias of {@link Long#lessThanOrEqual}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.lte = LongPrototype.lessThanOrEqual;
    /**
     * Tests if this Long's value is greater than the specified's.
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.greaterThan = function greaterThan(other) {
        return this.comp(/* validates */ other) > 0;
    };
    /**
     * Tests if this Long's value is greater than the specified's. This is an alias of {@link Long#greaterThan}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.gt = LongPrototype.greaterThan;
    /**
     * Tests if this Long's value is greater than or equal the specified's.
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.greaterThanOrEqual = function greaterThanOrEqual(other) {
        return this.comp(/* validates */ other) >= 0;
    };
    /**
     * Tests if this Long's value is greater than or equal the specified's. This is an alias of {@link Long#greaterThanOrEqual}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {boolean}
     */
    LongPrototype.gte = LongPrototype.greaterThanOrEqual;
    /**
     * Compares this Long's value with the specified's.
     * @param {!Long|number|string} other Other value
     * @returns {number} 0 if they are the same, 1 if the this is greater and -1
     *  if the given one is greater
     */
    LongPrototype.compare = function compare(other) {
        if (!isLong(other))
            other = fromValue(other);
        if (this.eq(other))
            return 0;
        var thisNeg = this.isNegative(), otherNeg = other.isNegative();
        if (thisNeg && !otherNeg)
            return -1;
        if (!thisNeg && otherNeg)
            return 1;
        // At this point the sign bits are the same
        if (!this.unsigned)
            return this.sub(other).isNegative() ? -1 : 1;
        // Both are positive if at least one is unsigned
        return (other.high >>> 0) > (this.high >>> 0) || (other.high === this.high && (other.low >>> 0) > (this.low >>> 0)) ? -1 : 1;
    };
    /**
     * Compares this Long's value with the specified's. This is an alias of {@link Long#compare}.
     * @function
     * @param {!Long|number|string} other Other value
     * @returns {number} 0 if they are the same, 1 if the this is greater and -1
     *  if the given one is greater
     */
    LongPrototype.comp = LongPrototype.compare;
    /**
     * Negates this Long's value.
     * @returns {!Long} Negated Long
     */
    LongPrototype.negate = function negate() {
        if (!this.unsigned && this.eq(MIN_VALUE))
            return MIN_VALUE;
        return this.not().add(ONE);
    };
    /**
     * Negates this Long's value. This is an alias of {@link Long#negate}.
     * @function
     * @returns {!Long} Negated Long
     */
    LongPrototype.neg = LongPrototype.negate;
    /**
     * Returns the sum of this and the specified Long.
     * @param {!Long|number|string} addend Addend
     * @returns {!Long} Sum
     */
    LongPrototype.add = function add(addend) {
        if (!isLong(addend))
            addend = fromValue(addend);
        // Divide each number into 4 chunks of 16 bits, and then sum the chunks.
        var a48 = this.high >>> 16;
        var a32 = this.high & 0xFFFF;
        var a16 = this.low >>> 16;
        var a00 = this.low & 0xFFFF;
        var b48 = addend.high >>> 16;
        var b32 = addend.high & 0xFFFF;
        var b16 = addend.low >>> 16;
        var b00 = addend.low & 0xFFFF;
        var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
        c00 += a00 + b00;
        c16 += c00 >>> 16;
        c00 &= 0xFFFF;
        c16 += a16 + b16;
        c32 += c16 >>> 16;
        c16 &= 0xFFFF;
        c32 += a32 + b32;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c48 += a48 + b48;
        c48 &= 0xFFFF;
        return fromBits((c16 << 16) | c00, (c48 << 16) | c32, this.unsigned);
    };
    /**
     * Returns the difference of this and the specified Long.
     * @param {!Long|number|string} subtrahend Subtrahend
     * @returns {!Long} Difference
     */
    LongPrototype.subtract = function subtract(subtrahend) {
        if (!isLong(subtrahend))
            subtrahend = fromValue(subtrahend);
        return this.add(subtrahend.neg());
    };
    /**
     * Returns the difference of this and the specified Long. This is an alias of {@link Long#subtract}.
     * @function
     * @param {!Long|number|string} subtrahend Subtrahend
     * @returns {!Long} Difference
     */
    LongPrototype.sub = LongPrototype.subtract;
    /**
     * Returns the product of this and the specified Long.
     * @param {!Long|number|string} multiplier Multiplier
     * @returns {!Long} Product
     */
    LongPrototype.multiply = function multiply(multiplier) {
        if (this.isZero())
            return ZERO;
        if (!isLong(multiplier))
            multiplier = fromValue(multiplier);
        if (multiplier.isZero())
            return ZERO;
        if (this.eq(MIN_VALUE))
            return multiplier.isOdd() ? MIN_VALUE : ZERO;
        if (multiplier.eq(MIN_VALUE))
            return this.isOdd() ? MIN_VALUE : ZERO;
        if (this.isNegative()) {
            if (multiplier.isNegative())
                return this.neg().mul(multiplier.neg());
            else
                return this.neg().mul(multiplier).neg();
        }
        else if (multiplier.isNegative())
            return this.mul(multiplier.neg()).neg();
        // If both longs are small, use float multiplication
        if (this.lt(TWO_PWR_24) && multiplier.lt(TWO_PWR_24))
            return fromNumber(this.toNumber() * multiplier.toNumber(), this.unsigned);
        // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
        // We can skip products that would overflow.
        var a48 = this.high >>> 16;
        var a32 = this.high & 0xFFFF;
        var a16 = this.low >>> 16;
        var a00 = this.low & 0xFFFF;
        var b48 = multiplier.high >>> 16;
        var b32 = multiplier.high & 0xFFFF;
        var b16 = multiplier.low >>> 16;
        var b00 = multiplier.low & 0xFFFF;
        var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
        c00 += a00 * b00;
        c16 += c00 >>> 16;
        c00 &= 0xFFFF;
        c16 += a16 * b00;
        c32 += c16 >>> 16;
        c16 &= 0xFFFF;
        c16 += a00 * b16;
        c32 += c16 >>> 16;
        c16 &= 0xFFFF;
        c32 += a32 * b00;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c32 += a16 * b16;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c32 += a00 * b32;
        c48 += c32 >>> 16;
        c32 &= 0xFFFF;
        c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
        c48 &= 0xFFFF;
        return fromBits((c16 << 16) | c00, (c48 << 16) | c32, this.unsigned);
    };
    /**
     * Returns the product of this and the specified Long. This is an alias of {@link Long#multiply}.
     * @function
     * @param {!Long|number|string} multiplier Multiplier
     * @returns {!Long} Product
     */
    LongPrototype.mul = LongPrototype.multiply;
    /**
     * Returns this Long divided by the specified. The result is signed if this Long is signed or
     *  unsigned if this Long is unsigned.
     * @param {!Long|number|string} divisor Divisor
     * @returns {!Long} Quotient
     */
    LongPrototype.divide = function divide(divisor) {
        if (!isLong(divisor))
            divisor = fromValue(divisor);
        if (divisor.isZero())
            throw Error('division by zero');
        if (this.isZero())
            return this.unsigned ? UZERO : ZERO;
        var approx, rem, res;
        if (!this.unsigned) {
            // This section is only relevant for signed longs and is derived from the
            // closure library as a whole.
            if (this.eq(MIN_VALUE)) {
                if (divisor.eq(ONE) || divisor.eq(NEG_ONE))
                    return MIN_VALUE; // recall that -MIN_VALUE == MIN_VALUE
                else if (divisor.eq(MIN_VALUE))
                    return ONE;
                else {
                    // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
                    var halfThis = this.shr(1);
                    approx = halfThis.div(divisor).shl(1);
                    if (approx.eq(ZERO)) {
                        return divisor.isNegative() ? ONE : NEG_ONE;
                    }
                    else {
                        rem = this.sub(divisor.mul(approx));
                        res = approx.add(rem.div(divisor));
                        return res;
                    }
                }
            }
            else if (divisor.eq(MIN_VALUE))
                return this.unsigned ? UZERO : ZERO;
            if (this.isNegative()) {
                if (divisor.isNegative())
                    return this.neg().div(divisor.neg());
                return this.neg().div(divisor).neg();
            }
            else if (divisor.isNegative())
                return this.div(divisor.neg()).neg();
            res = ZERO;
        }
        else {
            // The algorithm below has not been made for unsigned longs. It's therefore
            // required to take special care of the MSB prior to running it.
            if (!divisor.unsigned)
                divisor = divisor.toUnsigned();
            if (divisor.gt(this))
                return UZERO;
            if (divisor.gt(this.shru(1)))
                return UONE;
            res = UZERO;
        }
        // Repeat the following until the remainder is less than other:  find a
        // floating-point that approximates remainder / other *from below*, add this
        // into the result, and subtract it from the remainder.  It is critical that
        // the approximate value is less than or equal to the real value so that the
        // remainder never becomes negative.
        rem = this;
        while (rem.gte(divisor)) {
            // Approximate the result of division. This may be a little greater or
            // smaller than the actual value.
            approx = Math.max(1, Math.floor(rem.toNumber() / divisor.toNumber()));
            // We will tweak the approximate result by changing it in the 48-th digit or
            // the smallest non-fractional digit, whichever is larger.
            var log2 = Math.ceil(Math.log(approx) / Math.LN2), delta = (log2 <= 48) ? 1 : pow_dbl(2, log2 - 48), 
            // Decrease the approximation until it is smaller than the remainder.  Note
            // that if it is too large, the product overflows and is negative.
            approxRes = fromNumber(approx), approxRem = approxRes.mul(divisor);
            while (approxRem.isNegative() || approxRem.gt(rem)) {
                approx -= delta;
                approxRes = fromNumber(approx, this.unsigned);
                approxRem = approxRes.mul(divisor);
            }
            // We know the answer can't be zero... and actually, zero would cause
            // infinite recursion since we would make no progress.
            if (approxRes.isZero())
                approxRes = ONE;
            res = res.add(approxRes);
            rem = rem.sub(approxRem);
        }
        return res;
    };
    /**
     * Returns this Long divided by the specified. This is an alias of {@link Long#divide}.
     * @function
     * @param {!Long|number|string} divisor Divisor
     * @returns {!Long} Quotient
     */
    LongPrototype.div = LongPrototype.divide;
    /**
     * Returns this Long modulo the specified.
     * @param {!Long|number|string} divisor Divisor
     * @returns {!Long} Remainder
     */
    LongPrototype.modulo = function modulo(divisor) {
        if (!isLong(divisor))
            divisor = fromValue(divisor);
        return this.sub(this.div(divisor).mul(divisor));
    };
    /**
     * Returns this Long modulo the specified. This is an alias of {@link Long#modulo}.
     * @function
     * @param {!Long|number|string} divisor Divisor
     * @returns {!Long} Remainder
     */
    LongPrototype.mod = LongPrototype.modulo;
    /**
     * Returns the bitwise NOT of this Long.
     * @returns {!Long}
     */
    LongPrototype.not = function not() {
        return fromBits(~this.low, ~this.high, this.unsigned);
    };
    /**
     * Returns the bitwise AND of this Long and the specified.
     * @param {!Long|number|string} other Other Long
     * @returns {!Long}
     */
    LongPrototype.and = function and(other) {
        if (!isLong(other))
            other = fromValue(other);
        return fromBits(this.low & other.low, this.high & other.high, this.unsigned);
    };
    /**
     * Returns the bitwise OR of this Long and the specified.
     * @param {!Long|number|string} other Other Long
     * @returns {!Long}
     */
    LongPrototype.or = function or(other) {
        if (!isLong(other))
            other = fromValue(other);
        return fromBits(this.low | other.low, this.high | other.high, this.unsigned);
    };
    /**
     * Returns the bitwise XOR of this Long and the given one.
     * @param {!Long|number|string} other Other Long
     * @returns {!Long}
     */
    LongPrototype.xor = function xor(other) {
        if (!isLong(other))
            other = fromValue(other);
        return fromBits(this.low ^ other.low, this.high ^ other.high, this.unsigned);
    };
    /**
     * Returns this Long with bits shifted to the left by the given amount.
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    LongPrototype.shiftLeft = function shiftLeft(numBits) {
        if (isLong(numBits))
            numBits = numBits.toInt();
        if ((numBits &= 63) === 0)
            return this;
        else if (numBits < 32)
            return fromBits(this.low << numBits, (this.high << numBits) | (this.low >>> (32 - numBits)), this.unsigned);
        else
            return fromBits(0, this.low << (numBits - 32), this.unsigned);
    };
    /**
     * Returns this Long with bits shifted to the left by the given amount. This is an alias of {@link Long#shiftLeft}.
     * @function
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    LongPrototype.shl = LongPrototype.shiftLeft;
    /**
     * Returns this Long with bits arithmetically shifted to the right by the given amount.
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    LongPrototype.shiftRight = function shiftRight(numBits) {
        if (isLong(numBits))
            numBits = numBits.toInt();
        if ((numBits &= 63) === 0)
            return this;
        else if (numBits < 32)
            return fromBits((this.low >>> numBits) | (this.high << (32 - numBits)), this.high >> numBits, this.unsigned);
        else
            return fromBits(this.high >> (numBits - 32), this.high >= 0 ? 0 : -1, this.unsigned);
    };
    /**
     * Returns this Long with bits arithmetically shifted to the right by the given amount. This is an alias of {@link Long#shiftRight}.
     * @function
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    LongPrototype.shr = LongPrototype.shiftRight;
    /**
     * Returns this Long with bits logically shifted to the right by the given amount.
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    LongPrototype.shiftRightUnsigned = function shiftRightUnsigned(numBits) {
        if (isLong(numBits))
            numBits = numBits.toInt();
        numBits &= 63;
        if (numBits === 0)
            return this;
        else {
            var high = this.high;
            if (numBits < 32) {
                var low = this.low;
                return fromBits((low >>> numBits) | (high << (32 - numBits)), high >>> numBits, this.unsigned);
            }
            else if (numBits === 32)
                return fromBits(high, 0, this.unsigned);
            else
                return fromBits(high >>> (numBits - 32), 0, this.unsigned);
        }
    };
    /**
     * Returns this Long with bits logically shifted to the right by the given amount. This is an alias of {@link Long#shiftRightUnsigned}.
     * @function
     * @param {number|!Long} numBits Number of bits
     * @returns {!Long} Shifted Long
     */
    LongPrototype.shru = LongPrototype.shiftRightUnsigned;
    /**
     * Converts this Long to signed.
     * @returns {!Long} Signed long
     */
    LongPrototype.toSigned = function toSigned() {
        if (!this.unsigned)
            return this;
        return fromBits(this.low, this.high, false);
    };
    /**
     * Converts this Long to unsigned.
     * @returns {!Long} Unsigned long
     */
    LongPrototype.toUnsigned = function toUnsigned() {
        if (this.unsigned)
            return this;
        return fromBits(this.low, this.high, true);
    };
    /**
     * Converts this Long to its byte representation.
     * @param {boolean=} le Whether little or big endian, defaults to big endian
     * @returns {!Array.<number>} Byte representation
     */
    LongPrototype.toBytes = function (le) {
        return le ? this.toBytesLE() : this.toBytesBE();
    };
    /**
     * Converts this Long to its little endian byte representation.
     * @returns {!Array.<number>} Little endian byte representation
     */
    LongPrototype.toBytesLE = function () {
        var hi = this.high, lo = this.low;
        return [
            lo & 0xff,
            (lo >>> 8) & 0xff,
            (lo >>> 16) & 0xff,
            (lo >>> 24) & 0xff,
            hi & 0xff,
            (hi >>> 8) & 0xff,
            (hi >>> 16) & 0xff,
            (hi >>> 24) & 0xff
        ];
    };
    /**
     * Converts this Long to its big endian byte representation.
     * @returns {!Array.<number>} Big endian byte representation
     */
    LongPrototype.toBytesBE = function () {
        var hi = this.high, lo = this.low;
        return [
            (hi >>> 24) & 0xff,
            (hi >>> 16) & 0xff,
            (hi >>> 8) & 0xff,
            hi & 0xff,
            (lo >>> 24) & 0xff,
            (lo >>> 16) & 0xff,
            (lo >>> 8) & 0xff,
            lo & 0xff
        ];
    };
    return Long;
});
/*!
 * protobuf.js v6.8.1 (c) 2016, daniel wirtz
 * compiled tue, 11 jul 2017 15:52:11 utc
 * licensed under the bsd-3-clause license
 * see: https://github.com/dcodeio/protobuf.js for details
 */
(function (global, undefined) {
    "use strict";
    (function prelude(modules, cache, entries) {
        // This is the prelude used to bundle protobuf.js for the browser. Wraps up the CommonJS
        // sources through a conflict-free require shim and is again wrapped within an iife that
        // provides a unified `global` and a minification-friendly `undefined` var plus a global
        // "use strict" directive so that minification can remove the directives of each module.
        function $require(name) {
            var $module = cache[name];
            if (!$module)
                modules[name][0].call($module = cache[name] = { exports: {} }, $require, $module, $module.exports);
            return $module.exports;
        }
        // Expose globally
        var protobuf = global.protobuf = $require(entries[0]);
        // Be nice to AMD
        if (typeof define === "function" && define.amd)
            define(["long"], function (Long) {
                if (Long && Long.isLong) {
                    protobuf.util.Long = Long;
                    protobuf.configure();
                }
                return protobuf;
            });
        // Be nice to CommonJS
        if (typeof module === "object" && module && module.exports)
            module.exports = protobuf;
    }) /* end of prelude */({ 1: [function (require, module, exports) {
                "use strict";
                module.exports = asPromise;
                /**
                 * Callback as used by {@link util.asPromise}.
                 * @typedef asPromiseCallback
                 * @type {function}
                 * @param {Error|null} error Error, if any
                 * @param {...*} params Additional arguments
                 * @returns {undefined}
                 */
                /**
                 * Returns a promise from a node-style callback function.
                 * @memberof util
                 * @param {asPromiseCallback} fn Function to call
                 * @param {*} ctx Function context
                 * @param {...*} params Function arguments
                 * @returns {Promise<*>} Promisified function
                 */
                function asPromise(fn, ctx /*, varargs */) {
                    var params = new Array(arguments.length - 1), offset = 0, index = 2, pending = true;
                    while (index < arguments.length)
                        params[offset++] = arguments[index++];
                    return new Promise(function executor(resolve, reject) {
                        params[offset] = function callback(err /*, varargs */) {
                            if (pending) {
                                pending = false;
                                if (err)
                                    reject(err);
                                else {
                                    var params = new Array(arguments.length - 1), offset = 0;
                                    while (offset < params.length)
                                        params[offset++] = arguments[offset];
                                    resolve.apply(null, params);
                                }
                            }
                        };
                        try {
                            fn.apply(ctx || null, params);
                        }
                        catch (err) {
                            if (pending) {
                                pending = false;
                                reject(err);
                            }
                        }
                    });
                }
            }, {}], 2: [function (require, module, exports) {
                "use strict";
                /**
                 * A minimal base64 implementation for number arrays.
                 * @memberof util
                 * @namespace
                 */
                var base64 = exports;
                /**
                 * Calculates the byte length of a base64 encoded string.
                 * @param {string} string Base64 encoded string
                 * @returns {number} Byte length
                 */
                base64.length = function length(string) {
                    var p = string.length;
                    if (!p)
                        return 0;
                    var n = 0;
                    while (--p % 4 > 1 && string.charAt(p) === "=")
                        ++n;
                    return Math.ceil(string.length * 3) / 4 - n;
                };
                // Base64 encoding table
                var b64 = new Array(64);
                // Base64 decoding table
                var s64 = new Array(123);
                // 65..90, 97..122, 48..57, 43, 47
                for (var i = 0; i < 64;)
                    s64[b64[i] = i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i - 59 | 43] = i++;
                /**
                 * Encodes a buffer to a base64 encoded string.
                 * @param {Uint8Array} buffer Source buffer
                 * @param {number} start Source start
                 * @param {number} end Source end
                 * @returns {string} Base64 encoded string
                 */
                base64.encode = function encode(buffer, start, end) {
                    var parts = null, chunk = [];
                    var i = 0, // output index
                    j = 0, // goto index
                    t; // temporary
                    while (start < end) {
                        var b = buffer[start++];
                        switch (j) {
                            case 0:
                                chunk[i++] = b64[b >> 2];
                                t = (b & 3) << 4;
                                j = 1;
                                break;
                            case 1:
                                chunk[i++] = b64[t | b >> 4];
                                t = (b & 15) << 2;
                                j = 2;
                                break;
                            case 2:
                                chunk[i++] = b64[t | b >> 6];
                                chunk[i++] = b64[b & 63];
                                j = 0;
                                break;
                        }
                        if (i > 8191) {
                            (parts || (parts = [])).push(String.fromCharCode.apply(String, chunk));
                            i = 0;
                        }
                    }
                    if (j) {
                        chunk[i++] = b64[t];
                        chunk[i++] = 61;
                        if (j === 1)
                            chunk[i++] = 61;
                    }
                    if (parts) {
                        if (i)
                            parts.push(String.fromCharCode.apply(String, chunk.slice(0, i)));
                        return parts.join("");
                    }
                    return String.fromCharCode.apply(String, chunk.slice(0, i));
                };
                var invalidEncoding = "invalid encoding";
                /**
                 * Decodes a base64 encoded string to a buffer.
                 * @param {string} string Source string
                 * @param {Uint8Array} buffer Destination buffer
                 * @param {number} offset Destination offset
                 * @returns {number} Number of bytes written
                 * @throws {Error} If encoding is invalid
                 */
                base64.decode = function decode(string, buffer, offset) {
                    var start = offset;
                    var j = 0, // goto index
                    t; // temporary
                    for (var i = 0; i < string.length;) {
                        var c = string.charCodeAt(i++);
                        if (c === 61 && j > 1)
                            break;
                        if ((c = s64[c]) === undefined)
                            throw Error(invalidEncoding);
                        switch (j) {
                            case 0:
                                t = c;
                                j = 1;
                                break;
                            case 1:
                                buffer[offset++] = t << 2 | (c & 48) >> 4;
                                t = c;
                                j = 2;
                                break;
                            case 2:
                                buffer[offset++] = (t & 15) << 4 | (c & 60) >> 2;
                                t = c;
                                j = 3;
                                break;
                            case 3:
                                buffer[offset++] = (t & 3) << 6 | c;
                                j = 0;
                                break;
                        }
                    }
                    if (j === 1)
                        throw Error(invalidEncoding);
                    return offset - start;
                };
                /**
                 * Tests if the specified string appears to be base64 encoded.
                 * @param {string} string String to test
                 * @returns {boolean} `true` if probably base64 encoded, otherwise false
                 */
                base64.test = function test(string) {
                    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(string);
                };
            }, {}], 3: [function (require, module, exports) {
                "use strict";
                module.exports = codegen;
                /**
                 * Begins generating a function.
                 * @memberof util
                 * @param {string[]} functionParams Function parameter names
                 * @param {string} [functionName] Function name if not anonymous
                 * @returns {Codegen} Appender that appends code to the function's body
                 */
                function codegen(functionParams, functionName) {
                    /* istanbul ignore if */
                    if (typeof functionParams === "string") {
                        functionName = functionParams;
                        functionParams = undefined;
                    }
                    var body = [];
                    /**
                     * Appends code to the function's body or finishes generation.
                     * @typedef Codegen
                     * @type {function}
                     * @param {string|Object.<string,*>} [formatStringOrScope] Format string or, to finish the function, an object of additional scope variables, if any
                     * @param {...*} [formatParams] Format parameters
                     * @returns {Codegen|Function} Itself or the generated function if finished
                     * @throws {Error} If format parameter counts do not match
                     */
                    function Codegen(formatStringOrScope) {
                        // note that explicit array handling below makes this ~50% faster
                        // finish the function
                        if (typeof formatStringOrScope !== "string") {
                            var source = toString();
                            if (codegen.verbose)
                                console.log("codegen: " + source); // eslint-disable-line no-console
                            source = "return " + source;
                            if (formatStringOrScope) {
                                var scopeKeys = Object.keys(formatStringOrScope), scopeParams = new Array(scopeKeys.length + 1), scopeValues = new Array(scopeKeys.length), scopeOffset = 0;
                                while (scopeOffset < scopeKeys.length) {
                                    scopeParams[scopeOffset] = scopeKeys[scopeOffset];
                                    scopeValues[scopeOffset] = formatStringOrScope[scopeKeys[scopeOffset++]];
                                }
                                scopeParams[scopeOffset] = source;
                                return Function.apply(null, scopeParams)
                                    .apply(null, scopeValues);
                            }
                            return Function(source)();
                        }
                        // otherwise append to body
                        var formatParams = new Array(arguments.length - 1), formatOffset = 0;
                        while (formatOffset < formatParams.length)
                            formatParams[formatOffset] = arguments[++formatOffset];
                        formatOffset = 0;
                        formatStringOrScope = formatStringOrScope.replace(/%([%dfijs])/g, function replace($0, $1) {
                            var value = formatParams[formatOffset++];
                            switch ($1) {
                                case "d":
                                case "f": return String(Number(value));
                                case "i": return String(Math.floor(value));
                                case "j": return JSON.stringify(value);
                                case "s": return String(value);
                            }
                            return "%";
                        });
                        if (formatOffset !== formatParams.length)
                            throw Error("parameter count mismatch");
                        body.push(formatStringOrScope);
                        return Codegen;
                    }
                    function toString(functionNameOverride) {
                        return "function " + (functionNameOverride || functionName || "") + "(" + (functionParams && functionParams.join(",") || "") + "){\n  " + body.join("\n  ") + "\n}";
                    }
                    ;
                    Codegen.toString = toString;
                    return Codegen;
                }
                /**
                 * Begins generating a function.
                 * @memberof util
                 * @function codegen
                 * @param {string} [functionName] Function name if not anonymous
                 * @returns {Codegen} Appender that appends code to the function's body
                 * @variation 2
                 */
                /**
                 * When set to `true`, codegen will log generated code to console. Useful for debugging.
                 * @name util.codegen.verbose
                 * @type {boolean}
                 */
                codegen.verbose = false;
            }, {}], 4: [function (require, module, exports) {
                "use strict";
                module.exports = EventEmitter;
                /**
                 * Constructs a new event emitter instance.
                 * @classdesc A minimal event emitter.
                 * @memberof util
                 * @constructor
                 */
                function EventEmitter() {
                    /**
                     * Registered listeners.
                     * @type {Object.<string,*>}
                     * @private
                     */
                    this._listeners = {};
                }
                /**
                 * Registers an event listener.
                 * @param {string} evt Event name
                 * @param {function} fn Listener
                 * @param {*} [ctx] Listener context
                 * @returns {util.EventEmitter} `this`
                 */
                EventEmitter.prototype.on = function on(evt, fn, ctx) {
                    (this._listeners[evt] || (this._listeners[evt] = [])).push({
                        fn: fn,
                        ctx: ctx || this
                    });
                    return this;
                };
                /**
                 * Removes an event listener or any matching listeners if arguments are omitted.
                 * @param {string} [evt] Event name. Removes all listeners if omitted.
                 * @param {function} [fn] Listener to remove. Removes all listeners of `evt` if omitted.
                 * @returns {util.EventEmitter} `this`
                 */
                EventEmitter.prototype.off = function off(evt, fn) {
                    if (evt === undefined)
                        this._listeners = {};
                    else {
                        if (fn === undefined)
                            this._listeners[evt] = [];
                        else {
                            var listeners = this._listeners[evt];
                            for (var i = 0; i < listeners.length;)
                                if (listeners[i].fn === fn)
                                    listeners.splice(i, 1);
                                else
                                    ++i;
                        }
                    }
                    return this;
                };
                /**
                 * Emits an event by calling its listeners with the specified arguments.
                 * @param {string} evt Event name
                 * @param {...*} args Arguments
                 * @returns {util.EventEmitter} `this`
                 */
                EventEmitter.prototype.emit = function emit(evt) {
                    var listeners = this._listeners[evt];
                    if (listeners) {
                        var args = [], i = 1;
                        for (; i < arguments.length;)
                            args.push(arguments[i++]);
                        for (i = 0; i < listeners.length;)
                            listeners[i].fn.apply(listeners[i++].ctx, args);
                    }
                    return this;
                };
            }, {}], 5: [function (require, module, exports) {
                "use strict";
                module.exports = fetch;
                var asPromise = require(1), inquire = require(7);
                var fs = inquire("fs");
                /**
                 * Node-style callback as used by {@link util.fetch}.
                 * @typedef FetchCallback
                 * @type {function}
                 * @param {?Error} error Error, if any, otherwise `null`
                 * @param {string} [contents] File contents, if there hasn't been an error
                 * @returns {undefined}
                 */
                /**
                 * Options as used by {@link util.fetch}.
                 * @typedef FetchOptions
                 * @type {Object}
                 * @property {boolean} [binary=false] Whether expecting a binary response
                 * @property {boolean} [xhr=false] If `true`, forces the use of XMLHttpRequest
                 */
                /**
                 * Fetches the contents of a file.
                 * @memberof util
                 * @param {string} filename File path or url
                 * @param {FetchOptions} options Fetch options
                 * @param {FetchCallback} callback Callback function
                 * @returns {undefined}
                 */
                function fetch(filename, options, callback) {
                    if (typeof options === "function") {
                        callback = options;
                        options = {};
                    }
                    else if (!options)
                        options = {};
                    if (!callback)
                        return asPromise(fetch, this, filename, options); // eslint-disable-line no-invalid-this
                    // if a node-like filesystem is present, try it first but fall back to XHR if nothing is found.
                    if (!options.xhr && fs && fs.readFile)
                        return fs.readFile(filename, function fetchReadFileCallback(err, contents) {
                            return err && typeof XMLHttpRequest !== "undefined"
                                ? fetch.xhr(filename, options, callback)
                                : err
                                    ? callback(err)
                                    : callback(null, options.binary ? contents : contents.toString("utf8"));
                        });
                    // use the XHR version otherwise.
                    return fetch.xhr(filename, options, callback);
                }
                /**
                 * Fetches the contents of a file.
                 * @name util.fetch
                 * @function
                 * @param {string} path File path or url
                 * @param {FetchCallback} callback Callback function
                 * @returns {undefined}
                 * @variation 2
                 */
                /**
                 * Fetches the contents of a file.
                 * @name util.fetch
                 * @function
                 * @param {string} path File path or url
                 * @param {FetchOptions} [options] Fetch options
                 * @returns {Promise<string|Uint8Array>} Promise
                 * @variation 3
                 */
                /**/
                fetch.xhr = function fetch_xhr(filename, options, callback) {
                    var xhr = new XMLHttpRequest();
                    xhr.onreadystatechange /* works everywhere */ = function fetchOnReadyStateChange() {
                        if (xhr.readyState !== 4)
                            return undefined;
                        // local cors security errors return status 0 / empty string, too. afaik this cannot be
                        // reliably distinguished from an actually empty file for security reasons. feel free
                        // to send a pull request if you are aware of a solution.
                        if (xhr.status !== 0 && xhr.status !== 200)
                            return callback(Error("status " + xhr.status));
                        // if binary data is expected, make sure that some sort of array is returned, even if
                        // ArrayBuffers are not supported. the binary string fallback, however, is unsafe.
                        if (options.binary) {
                            var buffer = xhr.response;
                            if (!buffer) {
                                buffer = [];
                                for (var i = 0; i < xhr.responseText.length; ++i)
                                    buffer.push(xhr.responseText.charCodeAt(i) & 255);
                            }
                            return callback(null, typeof Uint8Array !== "undefined" ? new Uint8Array(buffer) : buffer);
                        }
                        return callback(null, xhr.responseText);
                    };
                    if (options.binary) {
                        // ref: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Sending_and_Receiving_Binary_Data#Receiving_binary_data_in_older_browsers
                        if ("overrideMimeType" in xhr)
                            xhr.overrideMimeType("text/plain; charset=x-user-defined");
                        xhr.responseType = "arraybuffer";
                    }
                    xhr.open("GET", filename);
                    xhr.send();
                };
            }, { "1": 1, "7": 7 }], 6: [function (require, module, exports) {
                "use strict";
                module.exports = factory(factory);
                /**
                 * Reads / writes floats / doubles from / to buffers.
                 * @name util.float
                 * @namespace
                 */
                /**
                 * Writes a 32 bit float to a buffer using little endian byte order.
                 * @name util.float.writeFloatLE
                 * @function
                 * @param {number} val Value to write
                 * @param {Uint8Array} buf Target buffer
                 * @param {number} pos Target buffer offset
                 * @returns {undefined}
                 */
                /**
                 * Writes a 32 bit float to a buffer using big endian byte order.
                 * @name util.float.writeFloatBE
                 * @function
                 * @param {number} val Value to write
                 * @param {Uint8Array} buf Target buffer
                 * @param {number} pos Target buffer offset
                 * @returns {undefined}
                 */
                /**
                 * Reads a 32 bit float from a buffer using little endian byte order.
                 * @name util.float.readFloatLE
                 * @function
                 * @param {Uint8Array} buf Source buffer
                 * @param {number} pos Source buffer offset
                 * @returns {number} Value read
                 */
                /**
                 * Reads a 32 bit float from a buffer using big endian byte order.
                 * @name util.float.readFloatBE
                 * @function
                 * @param {Uint8Array} buf Source buffer
                 * @param {number} pos Source buffer offset
                 * @returns {number} Value read
                 */
                /**
                 * Writes a 64 bit double to a buffer using little endian byte order.
                 * @name util.float.writeDoubleLE
                 * @function
                 * @param {number} val Value to write
                 * @param {Uint8Array} buf Target buffer
                 * @param {number} pos Target buffer offset
                 * @returns {undefined}
                 */
                /**
                 * Writes a 64 bit double to a buffer using big endian byte order.
                 * @name util.float.writeDoubleBE
                 * @function
                 * @param {number} val Value to write
                 * @param {Uint8Array} buf Target buffer
                 * @param {number} pos Target buffer offset
                 * @returns {undefined}
                 */
                /**
                 * Reads a 64 bit double from a buffer using little endian byte order.
                 * @name util.float.readDoubleLE
                 * @function
                 * @param {Uint8Array} buf Source buffer
                 * @param {number} pos Source buffer offset
                 * @returns {number} Value read
                 */
                /**
                 * Reads a 64 bit double from a buffer using big endian byte order.
                 * @name util.float.readDoubleBE
                 * @function
                 * @param {Uint8Array} buf Source buffer
                 * @param {number} pos Source buffer offset
                 * @returns {number} Value read
                 */
                // Factory function for the purpose of node-based testing in modified global environments
                function factory(exports) {
                    // float: typed array
                    if (typeof Float32Array !== "undefined")
                        (function () {
                            var f32 = new Float32Array([-0]), f8b = new Uint8Array(f32.buffer), le = f8b[3] === 128;
                            function writeFloat_f32_cpy(val, buf, pos) {
                                f32[0] = val;
                                buf[pos] = f8b[0];
                                buf[pos + 1] = f8b[1];
                                buf[pos + 2] = f8b[2];
                                buf[pos + 3] = f8b[3];
                            }
                            function writeFloat_f32_rev(val, buf, pos) {
                                f32[0] = val;
                                buf[pos] = f8b[3];
                                buf[pos + 1] = f8b[2];
                                buf[pos + 2] = f8b[1];
                                buf[pos + 3] = f8b[0];
                            }
                            /* istanbul ignore next */
                            exports.writeFloatLE = le ? writeFloat_f32_cpy : writeFloat_f32_rev;
                            /* istanbul ignore next */
                            exports.writeFloatBE = le ? writeFloat_f32_rev : writeFloat_f32_cpy;
                            function readFloat_f32_cpy(buf, pos) {
                                f8b[0] = buf[pos];
                                f8b[1] = buf[pos + 1];
                                f8b[2] = buf[pos + 2];
                                f8b[3] = buf[pos + 3];
                                return f32[0];
                            }
                            function readFloat_f32_rev(buf, pos) {
                                f8b[3] = buf[pos];
                                f8b[2] = buf[pos + 1];
                                f8b[1] = buf[pos + 2];
                                f8b[0] = buf[pos + 3];
                                return f32[0];
                            }
                            /* istanbul ignore next */
                            exports.readFloatLE = le ? readFloat_f32_cpy : readFloat_f32_rev;
                            /* istanbul ignore next */
                            exports.readFloatBE = le ? readFloat_f32_rev : readFloat_f32_cpy;
                            // float: ieee754
                        })();
                    else
                        (function () {
                            function writeFloat_ieee754(writeUint, val, buf, pos) {
                                var sign = val < 0 ? 1 : 0;
                                if (sign)
                                    val = -val;
                                if (val === 0)
                                    writeUint(1 / val > 0 ? 0 : 2147483648, buf, pos);
                                else if (isNaN(val))
                                    writeUint(2143289344, buf, pos);
                                else if (val > 3.4028234663852886e+38)
                                    writeUint((sign << 31 | 2139095040) >>> 0, buf, pos);
                                else if (val < 1.1754943508222875e-38)
                                    writeUint((sign << 31 | Math.round(val / 1.401298464324817e-45)) >>> 0, buf, pos);
                                else {
                                    var exponent = Math.floor(Math.log(val) / Math.LN2), mantissa = Math.round(val * Math.pow(2, -exponent) * 8388608) & 8388607;
                                    writeUint((sign << 31 | exponent + 127 << 23 | mantissa) >>> 0, buf, pos);
                                }
                            }
                            exports.writeFloatLE = writeFloat_ieee754.bind(null, writeUintLE);
                            exports.writeFloatBE = writeFloat_ieee754.bind(null, writeUintBE);
                            function readFloat_ieee754(readUint, buf, pos) {
                                var uint = readUint(buf, pos), sign = (uint >> 31) * 2 + 1, exponent = uint >>> 23 & 255, mantissa = uint & 8388607;
                                return exponent === 255
                                    ? mantissa
                                        ? NaN
                                        : sign * Infinity
                                    : exponent === 0 // denormal
                                        ? sign * 1.401298464324817e-45 * mantissa
                                        : sign * Math.pow(2, exponent - 150) * (mantissa + 8388608);
                            }
                            exports.readFloatLE = readFloat_ieee754.bind(null, readUintLE);
                            exports.readFloatBE = readFloat_ieee754.bind(null, readUintBE);
                        })();
                    // double: typed array
                    if (typeof Float64Array !== "undefined")
                        (function () {
                            var f64 = new Float64Array([-0]), f8b = new Uint8Array(f64.buffer), le = f8b[7] === 128;
                            function writeDouble_f64_cpy(val, buf, pos) {
                                f64[0] = val;
                                buf[pos] = f8b[0];
                                buf[pos + 1] = f8b[1];
                                buf[pos + 2] = f8b[2];
                                buf[pos + 3] = f8b[3];
                                buf[pos + 4] = f8b[4];
                                buf[pos + 5] = f8b[5];
                                buf[pos + 6] = f8b[6];
                                buf[pos + 7] = f8b[7];
                            }
                            function writeDouble_f64_rev(val, buf, pos) {
                                f64[0] = val;
                                buf[pos] = f8b[7];
                                buf[pos + 1] = f8b[6];
                                buf[pos + 2] = f8b[5];
                                buf[pos + 3] = f8b[4];
                                buf[pos + 4] = f8b[3];
                                buf[pos + 5] = f8b[2];
                                buf[pos + 6] = f8b[1];
                                buf[pos + 7] = f8b[0];
                            }
                            /* istanbul ignore next */
                            exports.writeDoubleLE = le ? writeDouble_f64_cpy : writeDouble_f64_rev;
                            /* istanbul ignore next */
                            exports.writeDoubleBE = le ? writeDouble_f64_rev : writeDouble_f64_cpy;
                            function readDouble_f64_cpy(buf, pos) {
                                f8b[0] = buf[pos];
                                f8b[1] = buf[pos + 1];
                                f8b[2] = buf[pos + 2];
                                f8b[3] = buf[pos + 3];
                                f8b[4] = buf[pos + 4];
                                f8b[5] = buf[pos + 5];
                                f8b[6] = buf[pos + 6];
                                f8b[7] = buf[pos + 7];
                                return f64[0];
                            }
                            function readDouble_f64_rev(buf, pos) {
                                f8b[7] = buf[pos];
                                f8b[6] = buf[pos + 1];
                                f8b[5] = buf[pos + 2];
                                f8b[4] = buf[pos + 3];
                                f8b[3] = buf[pos + 4];
                                f8b[2] = buf[pos + 5];
                                f8b[1] = buf[pos + 6];
                                f8b[0] = buf[pos + 7];
                                return f64[0];
                            }
                            /* istanbul ignore next */
                            exports.readDoubleLE = le ? readDouble_f64_cpy : readDouble_f64_rev;
                            /* istanbul ignore next */
                            exports.readDoubleBE = le ? readDouble_f64_rev : readDouble_f64_cpy;
                            // double: ieee754
                        })();
                    else
                        (function () {
                            function writeDouble_ieee754(writeUint, off0, off1, val, buf, pos) {
                                var sign = val < 0 ? 1 : 0;
                                if (sign)
                                    val = -val;
                                if (val === 0) {
                                    writeUint(0, buf, pos + off0);
                                    writeUint(1 / val > 0 ? 0 : 2147483648, buf, pos + off1);
                                }
                                else if (isNaN(val)) {
                                    writeUint(0, buf, pos + off0);
                                    writeUint(2146959360, buf, pos + off1);
                                }
                                else if (val > 1.7976931348623157e+308) {
                                    writeUint(0, buf, pos + off0);
                                    writeUint((sign << 31 | 2146435072) >>> 0, buf, pos + off1);
                                }
                                else {
                                    var mantissa;
                                    if (val < 2.2250738585072014e-308) {
                                        mantissa = val / 5e-324;
                                        writeUint(mantissa >>> 0, buf, pos + off0);
                                        writeUint((sign << 31 | mantissa / 4294967296) >>> 0, buf, pos + off1);
                                    }
                                    else {
                                        var exponent = Math.floor(Math.log(val) / Math.LN2);
                                        if (exponent === 1024)
                                            exponent = 1023;
                                        mantissa = val * Math.pow(2, -exponent);
                                        writeUint(mantissa * 4503599627370496 >>> 0, buf, pos + off0);
                                        writeUint((sign << 31 | exponent + 1023 << 20 | mantissa * 1048576 & 1048575) >>> 0, buf, pos + off1);
                                    }
                                }
                            }
                            exports.writeDoubleLE = writeDouble_ieee754.bind(null, writeUintLE, 0, 4);
                            exports.writeDoubleBE = writeDouble_ieee754.bind(null, writeUintBE, 4, 0);
                            function readDouble_ieee754(readUint, off0, off1, buf, pos) {
                                var lo = readUint(buf, pos + off0), hi = readUint(buf, pos + off1);
                                var sign = (hi >> 31) * 2 + 1, exponent = hi >>> 20 & 2047, mantissa = 4294967296 * (hi & 1048575) + lo;
                                return exponent === 2047
                                    ? mantissa
                                        ? NaN
                                        : sign * Infinity
                                    : exponent === 0 // denormal
                                        ? sign * 5e-324 * mantissa
                                        : sign * Math.pow(2, exponent - 1075) * (mantissa + 4503599627370496);
                            }
                            exports.readDoubleLE = readDouble_ieee754.bind(null, readUintLE, 0, 4);
                            exports.readDoubleBE = readDouble_ieee754.bind(null, readUintBE, 4, 0);
                        })();
                    return exports;
                }
                // uint helpers
                function writeUintLE(val, buf, pos) {
                    buf[pos] = val & 255;
                    buf[pos + 1] = val >>> 8 & 255;
                    buf[pos + 2] = val >>> 16 & 255;
                    buf[pos + 3] = val >>> 24;
                }
                function writeUintBE(val, buf, pos) {
                    buf[pos] = val >>> 24;
                    buf[pos + 1] = val >>> 16 & 255;
                    buf[pos + 2] = val >>> 8 & 255;
                    buf[pos + 3] = val & 255;
                }
                function readUintLE(buf, pos) {
                    return (buf[pos]
                        | buf[pos + 1] << 8
                        | buf[pos + 2] << 16
                        | buf[pos + 3] << 24) >>> 0;
                }
                function readUintBE(buf, pos) {
                    return (buf[pos] << 24
                        | buf[pos + 1] << 16
                        | buf[pos + 2] << 8
                        | buf[pos + 3]) >>> 0;
                }
            }, {}], 7: [function (require, module, exports) {
                "use strict";
                module.exports = inquire;
                /**
                 * Requires a module only if available.
                 * @memberof util
                 * @param {string} moduleName Module to require
                 * @returns {?Object} Required module if available and not empty, otherwise `null`
                 */
                function inquire(moduleName) {
                    try {
                        var mod = eval("quire".replace(/^/, "re"))(moduleName); // eslint-disable-line no-eval
                        if (mod && (mod.length || Object.keys(mod).length))
                            return mod;
                    }
                    catch (e) { } // eslint-disable-line no-empty
                    return null;
                }
            }, {}], 8: [function (require, module, exports) {
                "use strict";
                /**
                 * A minimal path module to resolve Unix, Windows and URL paths alike.
                 * @memberof util
                 * @namespace
                 */
                var path = exports;
                var isAbsolute = 
                /**
                 * Tests if the specified path is absolute.
                 * @param {string} path Path to test
                 * @returns {boolean} `true` if path is absolute
                 */
                path.isAbsolute = function isAbsolute(path) {
                    return /^(?:\/|\w+:)/.test(path);
                };
                var normalize = 
                /**
                 * Normalizes the specified path.
                 * @param {string} path Path to normalize
                 * @returns {string} Normalized path
                 */
                path.normalize = function normalize(path) {
                    path = path.replace(/\\/g, "/")
                        .replace(/\/{2,}/g, "/");
                    var parts = path.split("/"), absolute = isAbsolute(path), prefix = "";
                    if (absolute)
                        prefix = parts.shift() + "/";
                    for (var i = 0; i < parts.length;) {
                        if (parts[i] === "..") {
                            if (i > 0 && parts[i - 1] !== "..")
                                parts.splice(--i, 2);
                            else if (absolute)
                                parts.splice(i, 1);
                            else
                                ++i;
                        }
                        else if (parts[i] === ".")
                            parts.splice(i, 1);
                        else
                            ++i;
                    }
                    return prefix + parts.join("/");
                };
                /**
                 * Resolves the specified include path against the specified origin path.
                 * @param {string} originPath Path to the origin file
                 * @param {string} includePath Include path relative to origin path
                 * @param {boolean} [alreadyNormalized=false] `true` if both paths are already known to be normalized
                 * @returns {string} Path to the include file
                 */
                path.resolve = function resolve(originPath, includePath, alreadyNormalized) {
                    if (!alreadyNormalized)
                        includePath = normalize(includePath);
                    if (isAbsolute(includePath))
                        return includePath;
                    if (!alreadyNormalized)
                        originPath = normalize(originPath);
                    return (originPath = originPath.replace(/(?:\/|^)[^/]+$/, "")).length ? normalize(originPath + "/" + includePath) : includePath;
                };
            }, {}], 9: [function (require, module, exports) {
                "use strict";
                module.exports = pool;
                /**
                 * An allocator as used by {@link util.pool}.
                 * @typedef PoolAllocator
                 * @type {function}
                 * @param {number} size Buffer size
                 * @returns {Uint8Array} Buffer
                 */
                /**
                 * A slicer as used by {@link util.pool}.
                 * @typedef PoolSlicer
                 * @type {function}
                 * @param {number} start Start offset
                 * @param {number} end End offset
                 * @returns {Uint8Array} Buffer slice
                 * @this {Uint8Array}
                 */
                /**
                 * A general purpose buffer pool.
                 * @memberof util
                 * @function
                 * @param {PoolAllocator} alloc Allocator
                 * @param {PoolSlicer} slice Slicer
                 * @param {number} [size=8192] Slab size
                 * @returns {PoolAllocator} Pooled allocator
                 */
                function pool(alloc, slice, size) {
                    var SIZE = size || 8192;
                    var MAX = SIZE >>> 1;
                    var slab = null;
                    var offset = SIZE;
                    return function pool_alloc(size) {
                        if (size < 1 || size > MAX)
                            return alloc(size);
                        if (offset + size > SIZE) {
                            slab = alloc(SIZE);
                            offset = 0;
                        }
                        var buf = slice.call(slab, offset, offset += size);
                        if (offset & 7)
                            offset = (offset | 7) + 1;
                        return buf;
                    };
                }
            }, {}], 10: [function (require, module, exports) {
                "use strict";
                /**
                 * A minimal UTF8 implementation for number arrays.
                 * @memberof util
                 * @namespace
                 */
                var utf8 = exports;
                /**
                 * Calculates the UTF8 byte length of a string.
                 * @param {string} string String
                 * @returns {number} Byte length
                 */
                utf8.length = function utf8_length(string) {
                    var len = 0, c = 0;
                    for (var i = 0; i < string.length; ++i) {
                        c = string.charCodeAt(i);
                        if (c < 128)
                            len += 1;
                        else if (c < 2048)
                            len += 2;
                        else if ((c & 0xFC00) === 0xD800 && (string.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
                            ++i;
                            len += 4;
                        }
                        else
                            len += 3;
                    }
                    return len;
                };
                /**
                 * Reads UTF8 bytes as a string.
                 * @param {Uint8Array} buffer Source buffer
                 * @param {number} start Source start
                 * @param {number} end Source end
                 * @returns {string} String read
                 */
                utf8.read = function utf8_read(buffer, start, end) {
                    var len = end - start;
                    if (len < 1)
                        return "";
                    var parts = null, chunk = [], i = 0, // char offset
                    t; // temporary
                    while (start < end) {
                        t = buffer[start++];
                        if (t < 128)
                            chunk[i++] = t;
                        else if (t > 191 && t < 224)
                            chunk[i++] = (t & 31) << 6 | buffer[start++] & 63;
                        else if (t > 239 && t < 365) {
                            t = ((t & 7) << 18 | (buffer[start++] & 63) << 12 | (buffer[start++] & 63) << 6 | buffer[start++] & 63) - 0x10000;
                            chunk[i++] = 0xD800 + (t >> 10);
                            chunk[i++] = 0xDC00 + (t & 1023);
                        }
                        else
                            chunk[i++] = (t & 15) << 12 | (buffer[start++] & 63) << 6 | buffer[start++] & 63;
                        if (i > 8191) {
                            (parts || (parts = [])).push(String.fromCharCode.apply(String, chunk));
                            i = 0;
                        }
                    }
                    if (parts) {
                        if (i)
                            parts.push(String.fromCharCode.apply(String, chunk.slice(0, i)));
                        return parts.join("");
                    }
                    return String.fromCharCode.apply(String, chunk.slice(0, i));
                };
                /**
                 * Writes a string as UTF8 bytes.
                 * @param {string} string Source string
                 * @param {Uint8Array} buffer Destination buffer
                 * @param {number} offset Destination offset
                 * @returns {number} Bytes written
                 */
                utf8.write = function utf8_write(string, buffer, offset) {
                    var start = offset, c1, // character 1
                    c2; // character 2
                    for (var i = 0; i < string.length; ++i) {
                        c1 = string.charCodeAt(i);
                        if (c1 < 128) {
                            buffer[offset++] = c1;
                        }
                        else if (c1 < 2048) {
                            buffer[offset++] = c1 >> 6 | 192;
                            buffer[offset++] = c1 & 63 | 128;
                        }
                        else if ((c1 & 0xFC00) === 0xD800 && ((c2 = string.charCodeAt(i + 1)) & 0xFC00) === 0xDC00) {
                            c1 = 0x10000 + ((c1 & 0x03FF) << 10) + (c2 & 0x03FF);
                            ++i;
                            buffer[offset++] = c1 >> 18 | 240;
                            buffer[offset++] = c1 >> 12 & 63 | 128;
                            buffer[offset++] = c1 >> 6 & 63 | 128;
                            buffer[offset++] = c1 & 63 | 128;
                        }
                        else {
                            buffer[offset++] = c1 >> 12 | 224;
                            buffer[offset++] = c1 >> 6 & 63 | 128;
                            buffer[offset++] = c1 & 63 | 128;
                        }
                    }
                    return offset - start;
                };
            }, {}], 11: [function (require, module, exports) {
                "use strict";
                module.exports = common;
                var commonRe = /\/|\./;
                /**
                 * Provides common type definitions.
                 * Can also be used to provide additional google types or your own custom types.
                 * @param {string} name Short name as in `google/protobuf/[name].proto` or full file name
                 * @param {Object.<string,*>} json JSON definition within `google.protobuf` if a short name, otherwise the file's root definition
                 * @returns {undefined}
                 * @property {INamespace} google/protobuf/any.proto Any
                 * @property {INamespace} google/protobuf/duration.proto Duration
                 * @property {INamespace} google/protobuf/empty.proto Empty
                 * @property {INamespace} google/protobuf/struct.proto Struct, Value, NullValue and ListValue
                 * @property {INamespace} google/protobuf/timestamp.proto Timestamp
                 * @property {INamespace} google/protobuf/wrappers.proto Wrappers
                 * @example
                 * // manually provides descriptor.proto (assumes google/protobuf/ namespace and .proto extension)
                 * protobuf.common("descriptor", descriptorJson);
                 *
                 * // manually provides a custom definition (uses my.foo namespace)
                 * protobuf.common("my/foo/bar.proto", myFooBarJson);
                 */
                function common(name, json) {
                    if (!commonRe.test(name)) {
                        name = "google/protobuf/" + name + ".proto";
                        json = { nested: { google: { nested: { protobuf: { nested: json } } } } };
                    }
                    common[name] = json;
                }
                // Not provided because of limited use (feel free to discuss or to provide yourself):
                //
                // google/protobuf/descriptor.proto
                // google/protobuf/field_mask.proto
                // google/protobuf/source_context.proto
                // google/protobuf/type.proto
                //
                // Stripped and pre-parsed versions of these non-bundled files are instead available as part of
                // the repository or package within the google/protobuf directory.
                common("any", {
                    /**
                     * Properties of a google.protobuf.Any message.
                     * @interface IAny
                     * @type {Object}
                     * @property {string} [typeUrl]
                     * @property {Uint8Array} [bytes]
                     * @memberof common
                     */
                    Any: {
                        fields: {
                            type_url: {
                                type: "string",
                                id: 1
                            },
                            value: {
                                type: "bytes",
                                id: 2
                            }
                        }
                    }
                });
                var timeType;
                common("duration", {
                    /**
                     * Properties of a google.protobuf.Duration message.
                     * @interface IDuration
                     * @type {Object}
                     * @property {number|Long} [seconds]
                     * @property {number} [nanos]
                     * @memberof common
                     */
                    Duration: timeType = {
                        fields: {
                            seconds: {
                                type: "int64",
                                id: 1
                            },
                            nanos: {
                                type: "int32",
                                id: 2
                            }
                        }
                    }
                });
                common("timestamp", {
                    /**
                     * Properties of a google.protobuf.Timestamp message.
                     * @interface ITimestamp
                     * @type {Object}
                     * @property {number|Long} [seconds]
                     * @property {number} [nanos]
                     * @memberof common
                     */
                    Timestamp: timeType
                });
                common("empty", {
                    /**
                     * Properties of a google.protobuf.Empty message.
                     * @interface IEmpty
                     * @memberof common
                     */
                    Empty: {
                        fields: {}
                    }
                });
                common("struct", {
                    /**
                     * Properties of a google.protobuf.Struct message.
                     * @interface IStruct
                     * @type {Object}
                     * @property {Object.<string,IValue>} [fields]
                     * @memberof common
                     */
                    Struct: {
                        fields: {
                            fields: {
                                keyType: "string",
                                type: "Value",
                                id: 1
                            }
                        }
                    },
                    /**
                     * Properties of a google.protobuf.Value message.
                     * @interface IValue
                     * @type {Object}
                     * @property {string} [kind]
                     * @property {0} [nullValue]
                     * @property {number} [numberValue]
                     * @property {string} [stringValue]
                     * @property {boolean} [boolValue]
                     * @property {IStruct} [structValue]
                     * @property {IListValue} [listValue]
                     * @memberof common
                     */
                    Value: {
                        oneofs: {
                            kind: {
                                oneof: [
                                    "nullValue",
                                    "numberValue",
                                    "stringValue",
                                    "boolValue",
                                    "structValue",
                                    "listValue"
                                ]
                            }
                        },
                        fields: {
                            nullValue: {
                                type: "NullValue",
                                id: 1
                            },
                            numberValue: {
                                type: "double",
                                id: 2
                            },
                            stringValue: {
                                type: "string",
                                id: 3
                            },
                            boolValue: {
                                type: "bool",
                                id: 4
                            },
                            structValue: {
                                type: "Struct",
                                id: 5
                            },
                            listValue: {
                                type: "ListValue",
                                id: 6
                            }
                        }
                    },
                    NullValue: {
                        values: {
                            NULL_VALUE: 0
                        }
                    },
                    /**
                     * Properties of a google.protobuf.ListValue message.
                     * @interface IListValue
                     * @type {Object}
                     * @property {Array.<IValue>} [values]
                     * @memberof common
                     */
                    ListValue: {
                        fields: {
                            values: {
                                rule: "repeated",
                                type: "Value",
                                id: 1
                            }
                        }
                    }
                });
                common("wrappers", {
                    /**
                     * Properties of a google.protobuf.DoubleValue message.
                     * @interface IDoubleValue
                     * @type {Object}
                     * @property {number} [value]
                     * @memberof common
                     */
                    DoubleValue: {
                        fields: {
                            value: {
                                type: "double",
                                id: 1
                            }
                        }
                    },
                    /**
                     * Properties of a google.protobuf.FloatValue message.
                     * @interface IFloatValue
                     * @type {Object}
                     * @property {number} [value]
                     * @memberof common
                     */
                    FloatValue: {
                        fields: {
                            value: {
                                type: "float",
                                id: 1
                            }
                        }
                    },
                    /**
                     * Properties of a google.protobuf.Int64Value message.
                     * @interface IInt64Value
                     * @type {Object}
                     * @property {number|Long} [value]
                     * @memberof common
                     */
                    Int64Value: {
                        fields: {
                            value: {
                                type: "int64",
                                id: 1
                            }
                        }
                    },
                    /**
                     * Properties of a google.protobuf.UInt64Value message.
                     * @interface IUInt64Value
                     * @type {Object}
                     * @property {number|Long} [value]
                     * @memberof common
                     */
                    UInt64Value: {
                        fields: {
                            value: {
                                type: "uint64",
                                id: 1
                            }
                        }
                    },
                    /**
                     * Properties of a google.protobuf.Int32Value message.
                     * @interface IInt32Value
                     * @type {Object}
                     * @property {number} [value]
                     * @memberof common
                     */
                    Int32Value: {
                        fields: {
                            value: {
                                type: "int32",
                                id: 1
                            }
                        }
                    },
                    /**
                     * Properties of a google.protobuf.UInt32Value message.
                     * @interface IUInt32Value
                     * @type {Object}
                     * @property {number} [value]
                     * @memberof common
                     */
                    UInt32Value: {
                        fields: {
                            value: {
                                type: "uint32",
                                id: 1
                            }
                        }
                    },
                    /**
                     * Properties of a google.protobuf.BoolValue message.
                     * @interface IBoolValue
                     * @type {Object}
                     * @property {boolean} [value]
                     * @memberof common
                     */
                    BoolValue: {
                        fields: {
                            value: {
                                type: "bool",
                                id: 1
                            }
                        }
                    },
                    /**
                     * Properties of a google.protobuf.StringValue message.
                     * @interface IStringValue
                     * @type {Object}
                     * @property {string} [value]
                     * @memberof common
                     */
                    StringValue: {
                        fields: {
                            value: {
                                type: "string",
                                id: 1
                            }
                        }
                    },
                    /**
                     * Properties of a google.protobuf.BytesValue message.
                     * @interface IBytesValue
                     * @type {Object}
                     * @property {Uint8Array} [value]
                     * @memberof common
                     */
                    BytesValue: {
                        fields: {
                            value: {
                                type: "bytes",
                                id: 1
                            }
                        }
                    }
                });
                /**
                 * Gets the root definition of the specified common proto file.
                 *
                 * Bundled definitions are:
                 * - google/protobuf/any.proto
                 * - google/protobuf/duration.proto
                 * - google/protobuf/empty.proto
                 * - google/protobuf/struct.proto
                 * - google/protobuf/timestamp.proto
                 * - google/protobuf/wrappers.proto
                 *
                 * @param {string} file Proto file name
                 * @returns {INamespace|null} Root definition or `null` if not defined
                 */
                common.get = function get(file) {
                    return common[file] || null;
                };
            }, {}], 12: [function (require, module, exports) {
                "use strict";
                /**
                 * Runtime message from/to plain object converters.
                 * @namespace
                 */
                var converter = exports;
                var Enum = require(15), util = require(37);
                /**
                 * Generates a partial value fromObject conveter.
                 * @param {Codegen} gen Codegen instance
                 * @param {Field} field Reflected field
                 * @param {number} fieldIndex Field index
                 * @param {string} prop Property reference
                 * @returns {Codegen} Codegen instance
                 * @ignore
                 */
                function genValuePartial_fromObject(gen, field, fieldIndex, prop) {
                    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
                    if (field.resolvedType) {
                        if (field.resolvedType instanceof Enum) {
                            gen("switch(d%s){", prop);
                            for (var values = field.resolvedType.values, keys = Object.keys(values), i = 0; i < keys.length; ++i) {
                                if (field.repeated && values[keys[i]] === field.typeDefault)
                                    gen("default:");
                                gen("case%j:", keys[i])("case %i:", values[keys[i]])("m%s=%j", prop, values[keys[i]])("break");
                            }
                            gen("}");
                        }
                        else
                            gen("if(typeof d%s!==\"object\")", prop)("throw TypeError(%j)", field.fullName + ": object expected")("m%s=types[%i].fromObject(d%s)", prop, fieldIndex, prop);
                    }
                    else {
                        var isUnsigned = false;
                        switch (field.type) {
                            case "double":
                            case "float":
                                gen("m%s=Number(d%s)", prop, prop); // also catches "NaN", "Infinity"
                                break;
                            case "uint32":
                            case "fixed32":
                                gen("m%s=d%s>>>0", prop, prop);
                                break;
                            case "int32":
                            case "sint32":
                            case "sfixed32":
                                gen("m%s=d%s|0", prop, prop);
                                break;
                            case "uint64":
                                isUnsigned = true;
                            // eslint-disable-line no-fallthrough
                            case "int64":
                            case "sint64":
                            case "fixed64":
                            case "sfixed64":
                                gen("if(util.Long)")("(m%s=util.Long.fromValue(d%s)).unsigned=%j", prop, prop, isUnsigned)("else if(typeof d%s===\"string\")", prop)("m%s=parseInt(d%s,10)", prop, prop)("else if(typeof d%s===\"number\")", prop)("m%s=d%s", prop, prop)("else if(typeof d%s===\"object\")", prop)("m%s=new util.LongBits(d%s.low>>>0,d%s.high>>>0).toNumber(%s)", prop, prop, prop, isUnsigned ? "true" : "");
                                break;
                            case "bytes":
                                gen("if(typeof d%s===\"string\")", prop)("util.base64.decode(d%s,m%s=util.newBuffer(util.base64.length(d%s)),0)", prop, prop, prop)("else if(d%s.length)", prop)("m%s=d%s", prop, prop);
                                break;
                            case "string":
                                gen("m%s=String(d%s)", prop, prop);
                                break;
                            case "bool":
                                gen("m%s=Boolean(d%s)", prop, prop);
                                break;
                        }
                    }
                    return gen;
                    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
                }
                /**
                 * Generates a plain object to runtime message converter specific to the specified message type.
                 * @param {Type} mtype Message type
                 * @returns {Codegen} Codegen instance
                 */
                converter.fromObject = function fromObject(mtype) {
                    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
                    var fields = mtype.fieldsArray;
                    var gen = util.codegen(["d"], mtype.name + "$fromObject")("if(d instanceof this.ctor)")("return d");
                    if (!fields.length)
                        return gen("return new this.ctor");
                    gen("var m=new this.ctor");
                    for (var i = 0; i < fields.length; ++i) {
                        var field = fields[i].resolve(), prop = util.safeProp(field.name);
                        // Map fields
                        if (field.map) {
                            gen("if(d%s){", prop)("if(typeof d%s!==\"object\")", prop)("throw TypeError(%j)", field.fullName + ": object expected")("m%s={}", prop)("for(var ks=Object.keys(d%s),i=0;i<ks.length;++i){", prop);
                            genValuePartial_fromObject(gen, field, /* not sorted */ i, prop + "[ks[i]]")("}")("}");
                            // Repeated fields
                        }
                        else if (field.repeated) {
                            gen("if(d%s){", prop)("if(!Array.isArray(d%s))", prop)("throw TypeError(%j)", field.fullName + ": array expected")("m%s=[]", prop)("for(var i=0;i<d%s.length;++i){", prop);
                            genValuePartial_fromObject(gen, field, /* not sorted */ i, prop + "[i]")("}")("}");
                            // Non-repeated fields
                        }
                        else {
                            if (!(field.resolvedType instanceof Enum))
                                gen // no need to test for null/undefined if an enum (uses switch)
                                ("if(d%s!=null){", prop); // !== undefined && !== null
                            genValuePartial_fromObject(gen, field, /* not sorted */ i, prop);
                            if (!(field.resolvedType instanceof Enum))
                                gen("}");
                        }
                    }
                    return gen("return m");
                    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
                };
                /**
                 * Generates a partial value toObject converter.
                 * @param {Codegen} gen Codegen instance
                 * @param {Field} field Reflected field
                 * @param {number} fieldIndex Field index
                 * @param {string} prop Property reference
                 * @returns {Codegen} Codegen instance
                 * @ignore
                 */
                function genValuePartial_toObject(gen, field, fieldIndex, prop) {
                    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
                    if (field.resolvedType) {
                        if (field.resolvedType instanceof Enum)
                            gen("d%s=o.enums===String?types[%i].values[m%s]:m%s", prop, fieldIndex, prop, prop);
                        else
                            gen("d%s=types[%i].toObject(m%s,o)", prop, fieldIndex, prop);
                    }
                    else {
                        var isUnsigned = false;
                        switch (field.type) {
                            case "double":
                            case "float":
                                gen("d%s=o.json&&!isFinite(m%s)?String(m%s):m%s", prop, prop, prop, prop);
                                break;
                            case "uint64":
                                isUnsigned = true;
                            // eslint-disable-line no-fallthrough
                            case "int64":
                            case "sint64":
                            case "fixed64":
                            case "sfixed64":
                                gen("if(typeof m%s===\"number\")", prop)("d%s=o.longs===String?String(m%s):m%s", prop, prop, prop)("else") // Long-like
                                ("d%s=o.longs===String?util.Long.prototype.toString.call(m%s):o.longs===Number?new util.LongBits(m%s.low>>>0,m%s.high>>>0).toNumber(%s):m%s", prop, prop, prop, prop, isUnsigned ? "true" : "", prop);
                                break;
                            case "bytes":
                                gen("d%s=o.bytes===String?util.base64.encode(m%s,0,m%s.length):o.bytes===Array?Array.prototype.slice.call(m%s):m%s", prop, prop, prop, prop, prop);
                                break;
                            default:
                                gen("d%s=m%s", prop, prop);
                                break;
                        }
                    }
                    return gen;
                    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
                }
                /**
                 * Generates a runtime message to plain object converter specific to the specified message type.
                 * @param {Type} mtype Message type
                 * @returns {Codegen} Codegen instance
                 */
                converter.toObject = function toObject(mtype) {
                    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
                    var fields = mtype.fieldsArray.slice().sort(util.compareFieldsById);
                    if (!fields.length)
                        return util.codegen()("return {}");
                    var gen = util.codegen(["m", "o"], mtype.name + "$toObject")("if(!o)")("o={}")("var d={}");
                    var repeatedFields = [], mapFields = [], normalFields = [], i = 0;
                    for (; i < fields.length; ++i)
                        if (!fields[i].partOf)
                            (fields[i].resolve().repeated ? repeatedFields
                                : fields[i].map ? mapFields
                                    : normalFields).push(fields[i]);
                    if (repeatedFields.length) {
                        gen("if(o.arrays||o.defaults){");
                        for (i = 0; i < repeatedFields.length; ++i)
                            gen("d%s=[]", util.safeProp(repeatedFields[i].name));
                        gen("}");
                    }
                    if (mapFields.length) {
                        gen("if(o.objects||o.defaults){");
                        for (i = 0; i < mapFields.length; ++i)
                            gen("d%s={}", util.safeProp(mapFields[i].name));
                        gen("}");
                    }
                    if (normalFields.length) {
                        gen("if(o.defaults){");
                        for (i = 0; i < normalFields.length; ++i) {
                            var field = normalFields[i], prop = util.safeProp(field.name);
                            if (field.resolvedType instanceof Enum)
                                gen("d%s=o.enums===String?%j:%j", prop, field.resolvedType.valuesById[field.typeDefault], field.typeDefault);
                            else if (field.long)
                                gen("if(util.Long){")("var n=new util.Long(%i,%i,%j)", field.typeDefault.low, field.typeDefault.high, field.typeDefault.unsigned)("d%s=o.longs===String?n.toString():o.longs===Number?n.toNumber():n", prop)("}else")("d%s=o.longs===String?%j:%i", prop, field.typeDefault.toString(), field.typeDefault.toNumber());
                            else if (field.bytes)
                                gen("d%s=o.bytes===String?%j:%s", prop, String.fromCharCode.apply(String, field.typeDefault), "[" + Array.prototype.slice.call(field.typeDefault).join(",") + "]");
                            else
                                gen("d%s=%j", prop, field.typeDefault); // also messages (=null)
                        }
                        gen("}");
                    }
                    var hasKs2 = false;
                    for (i = 0; i < fields.length; ++i) {
                        var field = fields[i], index = mtype._fieldsArray.indexOf(field), prop = util.safeProp(field.name);
                        if (field.map) {
                            if (!hasKs2) {
                                hasKs2 = true;
                                gen("var ks2");
                            }
                            gen("if(m%s&&(ks2=Object.keys(m%s)).length){", prop, prop)("d%s={}", prop)("for(var j=0;j<ks2.length;++j){");
                            genValuePartial_toObject(gen, field, /* sorted */ index, prop + "[ks2[j]]")("}");
                        }
                        else if (field.repeated) {
                            gen("if(m%s&&m%s.length){", prop, prop)("d%s=[]", prop)("for(var j=0;j<m%s.length;++j){", prop);
                            genValuePartial_toObject(gen, field, /* sorted */ index, prop + "[j]")("}");
                        }
                        else {
                            gen("if(m%s!=null&&m.hasOwnProperty(%j)){", prop, field.name); // !== undefined && !== null
                            genValuePartial_toObject(gen, field, /* sorted */ index, prop);
                            if (field.partOf)
                                gen("if(o.oneofs)")("d%s=%j", util.safeProp(field.partOf.name), field.name);
                        }
                        gen("}");
                    }
                    return gen("return d");
                    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
                };
            }, { "15": 15, "37": 37 }], 13: [function (require, module, exports) {
                "use strict";
                module.exports = decoder;
                var Enum = require(15), types = require(36), util = require(37);
                function missing(field) {
                    return "missing required '" + field.name + "'";
                }
                /**
                 * Generates a decoder specific to the specified message type.
                 * @param {Type} mtype Message type
                 * @returns {Codegen} Codegen instance
                 */
                function decoder(mtype) {
                    /* eslint-disable no-unexpected-multiline */
                    var gen = util.codegen(["r", "l"], mtype.name + "$decode")("if(!(r instanceof Reader))")("r=Reader.create(r)")("var c=l===undefined?r.len:r.pos+l,m=new this.ctor" + (mtype.fieldsArray.filter(function (field) { return field.map; }).length ? ",k" : ""))("while(r.pos<c){")("var t=r.uint32()");
                    if (mtype.group)
                        gen("if((t&7)===4)")("break");
                    gen("switch(t>>>3){");
                    var i = 0;
                    for (; i < mtype.fieldsArray.length; ++i) {
                        var field = mtype._fieldsArray[i].resolve(), type = field.resolvedType instanceof Enum ? "int32" : field.type, ref = "m" + util.safeProp(field.name);
                        gen("case %i:", field.id);
                        // Map fields
                        if (field.map) {
                            gen("r.skip().pos++") // assumes id 1 + key wireType
                            ("if(%s===util.emptyObject)", ref)("%s={}", ref)("k=r.%s()", field.keyType)("r.pos++"); // assumes id 2 + value wireType
                            if (types.long[field.keyType] !== undefined) {
                                if (types.basic[type] === undefined)
                                    gen("%s[typeof k===\"object\"?util.longToHash(k):k]=types[%i].decode(r,r.uint32())", ref, i); // can't be groups
                                else
                                    gen("%s[typeof k===\"object\"?util.longToHash(k):k]=r.%s()", ref, type);
                            }
                            else {
                                if (types.basic[type] === undefined)
                                    gen("%s[k]=types[%i].decode(r,r.uint32())", ref, i); // can't be groups
                                else
                                    gen("%s[k]=r.%s()", ref, type);
                            }
                            // Repeated fields
                        }
                        else if (field.repeated) {
                            gen("if(!(%s&&%s.length))", ref, ref)("%s=[]", ref);
                            // Packable (always check for forward and backward compatiblity)
                            if (types.packed[type] !== undefined)
                                gen("if((t&7)===2){")("var c2=r.uint32()+r.pos")("while(r.pos<c2)")("%s.push(r.%s())", ref, type)("}else");
                            // Non-packed
                            if (types.basic[type] === undefined)
                                gen(field.resolvedType.group
                                    ? "%s.push(types[%i].decode(r))"
                                    : "%s.push(types[%i].decode(r,r.uint32()))", ref, i);
                            else
                                gen("%s.push(r.%s())", ref, type);
                            // Non-repeated
                        }
                        else if (types.basic[type] === undefined)
                            gen(field.resolvedType.group
                                ? "%s=types[%i].decode(r)"
                                : "%s=types[%i].decode(r,r.uint32())", ref, i);
                        else
                            gen("%s=r.%s()", ref, type);
                        gen("break");
                        // Unknown fields
                    }
                    gen("default:")("r.skipType(t&7)")("break")("}")("}");
                    // Field presence
                    for (i = 0; i < mtype._fieldsArray.length; ++i) {
                        var rfield = mtype._fieldsArray[i];
                        if (rfield.required)
                            gen("if(!m.hasOwnProperty(%j))", rfield.name)("throw util.ProtocolError(%j,{instance:m})", missing(rfield));
                    }
                    return gen("return m");
                    /* eslint-enable no-unexpected-multiline */
                }
            }, { "15": 15, "36": 36, "37": 37 }], 14: [function (require, module, exports) {
                "use strict";
                module.exports = encoder;
                var Enum = require(15), types = require(36), util = require(37);
                /**
                 * Generates a partial message type encoder.
                 * @param {Codegen} gen Codegen instance
                 * @param {Field} field Reflected field
                 * @param {number} fieldIndex Field index
                 * @param {string} ref Variable reference
                 * @returns {Codegen} Codegen instance
                 * @ignore
                 */
                function genTypePartial(gen, field, fieldIndex, ref) {
                    return field.resolvedType.group
                        ? gen("types[%i].encode(%s,w.uint32(%i)).uint32(%i)", fieldIndex, ref, (field.id << 3 | 3) >>> 0, (field.id << 3 | 4) >>> 0)
                        : gen("types[%i].encode(%s,w.uint32(%i).fork()).ldelim()", fieldIndex, ref, (field.id << 3 | 2) >>> 0);
                }
                /**
                 * Generates an encoder specific to the specified message type.
                 * @param {Type} mtype Message type
                 * @returns {Codegen} Codegen instance
                 */
                function encoder(mtype) {
                    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
                    var gen = util.codegen(["m", "w"], mtype.name + "$encode")("if(!w)")("w=Writer.create()");
                    var i, ref;
                    // "when a message is serialized its known fields should be written sequentially by field number"
                    var fields = mtype.fieldsArray.slice().sort(util.compareFieldsById);
                    for (var i = 0; i < fields.length; ++i) {
                        var field = fields[i].resolve(), index = mtype._fieldsArray.indexOf(field), type = field.resolvedType instanceof Enum ? "int32" : field.type, wireType = types.basic[type];
                        ref = "m" + util.safeProp(field.name);
                        // Map fields
                        if (field.map) {
                            gen("if(%s!=null&&m.hasOwnProperty(%j)){", ref, field.name) // !== undefined && !== null
                            ("for(var ks=Object.keys(%s),i=0;i<ks.length;++i){", ref)("w.uint32(%i).fork().uint32(%i).%s(ks[i])", (field.id << 3 | 2) >>> 0, 8 | types.mapKey[field.keyType], field.keyType);
                            if (wireType === undefined)
                                gen("types[%i].encode(%s[ks[i]],w.uint32(18).fork()).ldelim().ldelim()", index, ref); // can't be groups
                            else
                                gen(".uint32(%i).%s(%s[ks[i]]).ldelim()", 16 | wireType, type, ref);
                            gen("}")("}");
                            // Repeated fields
                        }
                        else if (field.repeated) {
                            gen("if(%s!=null&&%s.length){", ref, ref); // !== undefined && !== null
                            // Packed repeated
                            if (field.packed && types.packed[type] !== undefined) {
                                gen("w.uint32(%i).fork()", (field.id << 3 | 2) >>> 0)("for(var i=0;i<%s.length;++i)", ref)("w.%s(%s[i])", type, ref)("w.ldelim()");
                                // Non-packed
                            }
                            else {
                                gen("for(var i=0;i<%s.length;++i)", ref);
                                if (wireType === undefined)
                                    genTypePartial(gen, field, index, ref + "[i]");
                                else
                                    gen("w.uint32(%i).%s(%s[i])", (field.id << 3 | wireType) >>> 0, type, ref);
                            }
                            gen("}");
                            // Non-repeated
                        }
                        else {
                            if (field.optional)
                                gen("if(%s!=null&&m.hasOwnProperty(%j))", ref, field.name); // !== undefined && !== null
                            if (wireType === undefined)
                                genTypePartial(gen, field, index, ref);
                            else
                                gen("w.uint32(%i).%s(%s)", (field.id << 3 | wireType) >>> 0, type, ref);
                        }
                    }
                    return gen("return w");
                    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
                }
            }, { "15": 15, "36": 36, "37": 37 }], 15: [function (require, module, exports) {
                "use strict";
                module.exports = Enum;
                // extends ReflectionObject
                var ReflectionObject = require(24);
                ((Enum.prototype = Object.create(ReflectionObject.prototype)).constructor = Enum).className = "Enum";
                var util = require(37);
                /**
                 * Constructs a new enum instance.
                 * @classdesc Reflected enum.
                 * @extends ReflectionObject
                 * @constructor
                 * @param {string} name Unique name within its namespace
                 * @param {Object.<string,number>} [values] Enum values as an object, by name
                 * @param {Object.<string,*>} [options] Declared options
                 */
                function Enum(name, values, options) {
                    ReflectionObject.call(this, name, options);
                    if (values && typeof values !== "object")
                        throw TypeError("values must be an object");
                    /**
                     * Enum values by id.
                     * @type {Object.<number,string>}
                     */
                    this.valuesById = {};
                    /**
                     * Enum values by name.
                     * @type {Object.<string,number>}
                     */
                    this.values = Object.create(this.valuesById); // toJSON, marker
                    /**
                     * Value comment texts, if any.
                     * @type {Object.<string,string>}
                     */
                    this.comments = {};
                    // Note that values inherit valuesById on their prototype which makes them a TypeScript-
                    // compatible enum. This is used by pbts to write actual enum definitions that work for
                    // static and reflection code alike instead of emitting generic object definitions.
                    if (values)
                        for (var keys = Object.keys(values), i = 0; i < keys.length; ++i)
                            if (typeof values[keys[i]] === "number")
                                this.valuesById[this.values[keys[i]] = values[keys[i]]] = keys[i];
                }
                /**
                 * Enum descriptor.
                 * @interface IEnum
                 * @property {Object.<string,number>} values Enum values
                 * @property {Object.<string,*>} [options] Enum options
                 */
                /**
                 * Constructs an enum from an enum descriptor.
                 * @param {string} name Enum name
                 * @param {IEnum} json Enum descriptor
                 * @returns {Enum} Created enum
                 * @throws {TypeError} If arguments are invalid
                 */
                Enum.fromJSON = function fromJSON(name, json) {
                    return new Enum(name, json.values, json.options);
                };
                /**
                 * Converts this enum to an enum descriptor.
                 * @returns {IEnum} Enum descriptor
                 */
                Enum.prototype.toJSON = function toJSON() {
                    return util.toObject([
                        "options", this.options,
                        "values", this.values
                    ]);
                };
                /**
                 * Adds a value to this enum.
                 * @param {string} name Value name
                 * @param {number} id Value id
                 * @param {string} [comment] Comment, if any
                 * @returns {Enum} `this`
                 * @throws {TypeError} If arguments are invalid
                 * @throws {Error} If there is already a value with this name or id
                 */
                Enum.prototype.add = function (name, id, comment) {
                    // utilized by the parser but not by .fromJSON
                    if (!util.isString(name))
                        throw TypeError("name must be a string");
                    if (!util.isInteger(id))
                        throw TypeError("id must be an integer");
                    if (this.values[name] !== undefined)
                        throw Error("duplicate name");
                    if (this.valuesById[id] !== undefined) {
                        if (!(this.options && this.options.allow_alias))
                            throw Error("duplicate id");
                        this.values[name] = id;
                    }
                    else
                        this.valuesById[this.values[name] = id] = name;
                    this.comments[name] = comment || null;
                    return this;
                };
                /**
                 * Removes a value from this enum
                 * @param {string} name Value name
                 * @returns {Enum} `this`
                 * @throws {TypeError} If arguments are invalid
                 * @throws {Error} If `name` is not a name of this enum
                 */
                Enum.prototype.remove = function (name) {
                    if (!util.isString(name))
                        throw TypeError("name must be a string");
                    var val = this.values[name];
                    if (val === undefined)
                        throw Error("name does not exist");
                    delete this.valuesById[val];
                    delete this.values[name];
                    delete this.comments[name];
                    return this;
                };
            }, { "24": 24, "37": 37 }], 16: [function (require, module, exports) {
                "use strict";
                module.exports = Field;
                // extends ReflectionObject
                var ReflectionObject = require(24);
                ((Field.prototype = Object.create(ReflectionObject.prototype)).constructor = Field).className = "Field";
                var Enum = require(15), types = require(36), util = require(37);
                var Type; // cyclic
                var ruleRe = /^required|optional|repeated$/;
                /**
                 * Constructs a new message field instance. Note that {@link MapField|map fields} have their own class.
                 * @name Field
                 * @classdesc Reflected message field.
                 * @extends FieldBase
                 * @constructor
                 * @param {string} name Unique name within its namespace
                 * @param {number} id Unique id within its namespace
                 * @param {string} type Value type
                 * @param {string|Object.<string,*>} [rule="optional"] Field rule
                 * @param {string|Object.<string,*>} [extend] Extended type if different from parent
                 * @param {Object.<string,*>} [options] Declared options
                 */
                /**
                 * Constructs a field from a field descriptor.
                 * @param {string} name Field name
                 * @param {IField} json Field descriptor
                 * @returns {Field} Created field
                 * @throws {TypeError} If arguments are invalid
                 */
                Field.fromJSON = function fromJSON(name, json) {
                    return new Field(name, json.id, json.type, json.rule, json.extend, json.options);
                };
                /**
                 * Not an actual constructor. Use {@link Field} instead.
                 * @classdesc Base class of all reflected message fields. This is not an actual class but here for the sake of having consistent type definitions.
                 * @exports FieldBase
                 * @extends ReflectionObject
                 * @constructor
                 * @param {string} name Unique name within its namespace
                 * @param {number} id Unique id within its namespace
                 * @param {string} type Value type
                 * @param {string|Object.<string,*>} [rule="optional"] Field rule
                 * @param {string|Object.<string,*>} [extend] Extended type if different from parent
                 * @param {Object.<string,*>} [options] Declared options
                 */
                function Field(name, id, type, rule, extend, options) {
                    if (util.isObject(rule)) {
                        options = rule;
                        rule = extend = undefined;
                    }
                    else if (util.isObject(extend)) {
                        options = extend;
                        extend = undefined;
                    }
                    ReflectionObject.call(this, name, options);
                    if (!util.isInteger(id) || id < 0)
                        throw TypeError("id must be a non-negative integer");
                    if (!util.isString(type))
                        throw TypeError("type must be a string");
                    if (rule !== undefined && !ruleRe.test(rule = rule.toString().toLowerCase()))
                        throw TypeError("rule must be a string rule");
                    if (extend !== undefined && !util.isString(extend))
                        throw TypeError("extend must be a string");
                    /**
                     * Field rule, if any.
                     * @type {string|undefined}
                     */
                    this.rule = rule && rule !== "optional" ? rule : undefined; // toJSON
                    /**
                     * Field type.
                     * @type {string}
                     */
                    this.type = type; // toJSON
                    /**
                     * Unique field id.
                     * @type {number}
                     */
                    this.id = id; // toJSON, marker
                    /**
                     * Extended type if different from parent.
                     * @type {string|undefined}
                     */
                    this.extend = extend || undefined; // toJSON
                    /**
                     * Whether this field is required.
                     * @type {boolean}
                     */
                    this.required = rule === "required";
                    /**
                     * Whether this field is optional.
                     * @type {boolean}
                     */
                    this.optional = !this.required;
                    /**
                     * Whether this field is repeated.
                     * @type {boolean}
                     */
                    this.repeated = rule === "repeated";
                    /**
                     * Whether this field is a map or not.
                     * @type {boolean}
                     */
                    this.map = false;
                    /**
                     * Message this field belongs to.
                     * @type {Type|null}
                     */
                    this.message = null;
                    /**
                     * OneOf this field belongs to, if any,
                     * @type {OneOf|null}
                     */
                    this.partOf = null;
                    /**
                     * The field type's default value.
                     * @type {*}
                     */
                    this.typeDefault = null;
                    /**
                     * The field's default value on prototypes.
                     * @type {*}
                     */
                    this.defaultValue = null;
                    /**
                     * Whether this field's value should be treated as a long.
                     * @type {boolean}
                     */
                    this.long = util.Long ? types.long[type] !== undefined : false;
                    /**
                     * Whether this field's value is a buffer.
                     * @type {boolean}
                     */
                    this.bytes = type === "bytes";
                    /**
                     * Resolved type if not a basic type.
                     * @type {Type|Enum|null}
                     */
                    this.resolvedType = null;
                    /**
                     * Sister-field within the extended type if a declaring extension field.
                     * @type {Field|null}
                     */
                    this.extensionField = null;
                    /**
                     * Sister-field within the declaring namespace if an extended field.
                     * @type {Field|null}
                     */
                    this.declaringField = null;
                    /**
                     * Internally remembers whether this field is packed.
                     * @type {boolean|null}
                     * @private
                     */
                    this._packed = null;
                }
                /**
                 * Determines whether this field is packed. Only relevant when repeated and working with proto2.
                 * @name Field#packed
                 * @type {boolean}
                 * @readonly
                 */
                Object.defineProperty(Field.prototype, "packed", {
                    get: function () {
                        // defaults to packed=true if not explicity set to false
                        if (this._packed === null)
                            this._packed = this.getOption("packed") !== false;
                        return this._packed;
                    }
                });
                /**
                 * @override
                 */
                Field.prototype.setOption = function setOption(name, value, ifNotSet) {
                    if (name === "packed")
                        this._packed = null;
                    return ReflectionObject.prototype.setOption.call(this, name, value, ifNotSet);
                };
                /**
                 * Field descriptor.
                 * @interface IField
                 * @property {string} [rule="optional"] Field rule
                 * @property {string} type Field type
                 * @property {number} id Field id
                 * @property {Object.<string,*>} [options] Field options
                 */
                /**
                 * Extension field descriptor.
                 * @interface IExtensionField
                 * @extends IField
                 * @property {string} extend Extended type
                 */
                /**
                 * Converts this field to a field descriptor.
                 * @returns {IField} Field descriptor
                 */
                Field.prototype.toJSON = function toJSON() {
                    return util.toObject([
                        "rule", this.rule !== "optional" && this.rule || undefined,
                        "type", this.type,
                        "id", this.id,
                        "extend", this.extend,
                        "options", this.options
                    ]);
                };
                /**
                 * Resolves this field's type references.
                 * @returns {Field} `this`
                 * @throws {Error} If any reference cannot be resolved
                 */
                Field.prototype.resolve = function resolve() {
                    if (this.resolved)
                        return this;
                    if ((this.typeDefault = types.defaults[this.type]) === undefined) {
                        this.resolvedType = (this.declaringField ? this.declaringField.parent : this.parent).lookupTypeOrEnum(this.type);
                        if (this.resolvedType instanceof Type)
                            this.typeDefault = null;
                        else
                            this.typeDefault = this.resolvedType.values[Object.keys(this.resolvedType.values)[0]]; // first defined
                    }
                    // use explicitly set default value if present
                    if (this.options && this.options["default"] != null) {
                        this.typeDefault = this.options["default"];
                        if (this.resolvedType instanceof Enum && typeof this.typeDefault === "string")
                            this.typeDefault = this.resolvedType.values[this.typeDefault];
                    }
                    // remove unnecessary options
                    if (this.options) {
                        if (this.options.packed === true || this.options.packed !== undefined && this.resolvedType && !(this.resolvedType instanceof Enum))
                            delete this.options.packed;
                        if (!Object.keys(this.options).length)
                            this.options = undefined;
                    }
                    // convert to internal data type if necesssary
                    if (this.long) {
                        this.typeDefault = util.Long.fromNumber(this.typeDefault, this.type.charAt(0) === "u");
                        /* istanbul ignore else */
                        if (Object.freeze)
                            Object.freeze(this.typeDefault); // long instances are meant to be immutable anyway (i.e. use small int cache that even requires it)
                    }
                    else if (this.bytes && typeof this.typeDefault === "string") {
                        var buf;
                        if (util.base64.test(this.typeDefault))
                            util.base64.decode(this.typeDefault, buf = util.newBuffer(util.base64.length(this.typeDefault)), 0);
                        else
                            util.utf8.write(this.typeDefault, buf = util.newBuffer(util.utf8.length(this.typeDefault)), 0);
                        this.typeDefault = buf;
                    }
                    // take special care of maps and repeated fields
                    if (this.map)
                        this.defaultValue = util.emptyObject;
                    else if (this.repeated)
                        this.defaultValue = util.emptyArray;
                    else
                        this.defaultValue = this.typeDefault;
                    // ensure proper value on prototype
                    if (this.parent instanceof Type)
                        this.parent.ctor.prototype[this.name] = this.defaultValue;
                    return ReflectionObject.prototype.resolve.call(this);
                };
                /**
                 * Decorator function as returned by {@link Field.d} and {@link MapField.d} (TypeScript).
                 * @typedef FieldDecorator
                 * @type {function}
                 * @param {Object} prototype Target prototype
                 * @param {string} fieldName Field name
                 * @returns {undefined}
                 */
                /**
                 * Field decorator (TypeScript).
                 * @name Field.d
                 * @function
                 * @param {number} fieldId Field id
                 * @param {"double"|"float"|"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"string"|"bool"|"bytes"|Object} fieldType Field type
                 * @param {"optional"|"required"|"repeated"} [fieldRule="optional"] Field rule
                 * @param {T} [defaultValue] Default value
                 * @returns {FieldDecorator} Decorator function
                 * @template T extends number | number[] | Long | Long[] | string | string[] | boolean | boolean[] | Uint8Array | Uint8Array[] | Buffer | Buffer[]
                 */
                Field.d = function decorateField(fieldId, fieldType, fieldRule, defaultValue) {
                    // submessage: decorate the submessage and use its name as the type
                    if (typeof fieldType === "function")
                        fieldType = util.decorateType(fieldType).name;
                    else if (fieldType && typeof fieldType === "object")
                        fieldType = util.decorateEnum(fieldType).name;
                    return function fieldDecorator(prototype, fieldName) {
                        util.decorateType(prototype.constructor)
                            .add(new Field(fieldName, fieldId, fieldType, fieldRule, { "default": defaultValue }));
                    };
                };
                /**
                 * Field decorator (TypeScript).
                 * @name Field.d
                 * @function
                 * @param {number} fieldId Field id
                 * @param {Constructor<T>|string} fieldType Field type
                 * @param {"optional"|"required"|"repeated"} [fieldRule="optional"] Field rule
                 * @returns {FieldDecorator} Decorator function
                 * @template T extends Message<T>
                 * @variation 2
                 */
                // like Field.d but without a default value
                Field._configure = function configure(Type_) {
                    Type = Type_;
                };
            }, { "15": 15, "24": 24, "36": 36, "37": 37 }], 17: [function (require, module, exports) {
                "use strict";
                var protobuf = module.exports = require(18);
                protobuf.build = "light";
                /**
                 * A node-style callback as used by {@link load} and {@link Root#load}.
                 * @typedef LoadCallback
                 * @type {function}
                 * @param {Error|null} error Error, if any, otherwise `null`
                 * @param {Root} [root] Root, if there hasn't been an error
                 * @returns {undefined}
                 */
                /**
                 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and calls the callback.
                 * @param {string|string[]} filename One or multiple files to load
                 * @param {Root} root Root namespace, defaults to create a new one if omitted.
                 * @param {LoadCallback} callback Callback function
                 * @returns {undefined}
                 * @see {@link Root#load}
                 */
                function load(filename, root, callback) {
                    if (typeof root === "function") {
                        callback = root;
                        root = new protobuf.Root();
                    }
                    else if (!root)
                        root = new protobuf.Root();
                    return root.load(filename, callback);
                }
                /**
                 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and calls the callback.
                 * @name load
                 * @function
                 * @param {string|string[]} filename One or multiple files to load
                 * @param {LoadCallback} callback Callback function
                 * @returns {undefined}
                 * @see {@link Root#load}
                 * @variation 2
                 */
                // function load(filename:string, callback:LoadCallback):undefined
                /**
                 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and returns a promise.
                 * @name load
                 * @function
                 * @param {string|string[]} filename One or multiple files to load
                 * @param {Root} [root] Root namespace, defaults to create a new one if omitted.
                 * @returns {Promise<Root>} Promise
                 * @see {@link Root#load}
                 * @variation 3
                 */
                // function load(filename:string, [root:Root]):Promise<Root>
                protobuf.load = load;
                /**
                 * Synchronously loads one or multiple .proto or preprocessed .json files into a common root namespace (node only).
                 * @param {string|string[]} filename One or multiple files to load
                 * @param {Root} [root] Root namespace, defaults to create a new one if omitted.
                 * @returns {Root} Root namespace
                 * @throws {Error} If synchronous fetching is not supported (i.e. in browsers) or if a file's syntax is invalid
                 * @see {@link Root#loadSync}
                 */
                function loadSync(filename, root) {
                    if (!root)
                        root = new protobuf.Root();
                    return root.loadSync(filename);
                }
                protobuf.loadSync = loadSync;
                // Serialization
                protobuf.encoder = require(14);
                protobuf.decoder = require(13);
                protobuf.verifier = require(40);
                protobuf.converter = require(12);
                // Reflection
                protobuf.ReflectionObject = require(24);
                protobuf.Namespace = require(23);
                protobuf.Root = require(29);
                protobuf.Enum = require(15);
                protobuf.Type = require(35);
                protobuf.Field = require(16);
                protobuf.OneOf = require(25);
                protobuf.MapField = require(20);
                protobuf.Service = require(33);
                protobuf.Method = require(22);
                // Runtime
                protobuf.Message = require(21);
                protobuf.wrappers = require(41);
                // Utility
                protobuf.types = require(36);
                protobuf.util = require(37);
                // Configure reflection
                protobuf.ReflectionObject._configure(protobuf.Root);
                protobuf.Namespace._configure(protobuf.Type, protobuf.Service);
                protobuf.Root._configure(protobuf.Type);
                protobuf.Field._configure(protobuf.Type);
            }, { "12": 12, "13": 13, "14": 14, "15": 15, "16": 16, "18": 18, "20": 20, "21": 21, "22": 22, "23": 23, "24": 24, "25": 25, "29": 29, "33": 33, "35": 35, "36": 36, "37": 37, "40": 40, "41": 41 }], 18: [function (require, module, exports) {
                "use strict";
                var protobuf = exports;
                /**
                 * Build type, one of `"full"`, `"light"` or `"minimal"`.
                 * @name build
                 * @type {string}
                 * @const
                 */
                protobuf.build = "minimal";
                // Serialization
                protobuf.Writer = require(42);
                protobuf.BufferWriter = require(43);
                protobuf.Reader = require(27);
                protobuf.BufferReader = require(28);
                // Utility
                protobuf.util = require(39);
                protobuf.rpc = require(31);
                protobuf.roots = require(30);
                protobuf.configure = configure;
                /* istanbul ignore next */
                /**
                 * Reconfigures the library according to the environment.
                 * @returns {undefined}
                 */
                function configure() {
                    protobuf.Reader._configure(protobuf.BufferReader);
                    protobuf.util._configure();
                }
                // Configure serialization
                protobuf.Writer._configure(protobuf.BufferWriter);
                configure();
            }, { "27": 27, "28": 28, "30": 30, "31": 31, "39": 39, "42": 42, "43": 43 }], 19: [function (require, module, exports) {
                "use strict";
                var protobuf = module.exports = require(17);
                protobuf.build = "full";
                // Parser
                protobuf.tokenize = require(34);
                protobuf.parse = require(26);
                protobuf.common = require(11);
                // Configure parser
                protobuf.Root._configure(protobuf.Type, protobuf.parse, protobuf.common);
            }, { "11": 11, "17": 17, "26": 26, "34": 34 }], 20: [function (require, module, exports) {
                "use strict";
                module.exports = MapField;
                // extends Field
                var Field = require(16);
                ((MapField.prototype = Object.create(Field.prototype)).constructor = MapField).className = "MapField";
                var types = require(36), util = require(37);
                /**
                 * Constructs a new map field instance.
                 * @classdesc Reflected map field.
                 * @extends FieldBase
                 * @constructor
                 * @param {string} name Unique name within its namespace
                 * @param {number} id Unique id within its namespace
                 * @param {string} keyType Key type
                 * @param {string} type Value type
                 * @param {Object.<string,*>} [options] Declared options
                 */
                function MapField(name, id, keyType, type, options) {
                    Field.call(this, name, id, type, options);
                    /* istanbul ignore if */
                    if (!util.isString(keyType))
                        throw TypeError("keyType must be a string");
                    /**
                     * Key type.
                     * @type {string}
                     */
                    this.keyType = keyType; // toJSON, marker
                    /**
                     * Resolved key type if not a basic type.
                     * @type {ReflectionObject|null}
                     */
                    this.resolvedKeyType = null;
                    // Overrides Field#map
                    this.map = true;
                }
                /**
                 * Map field descriptor.
                 * @interface IMapField
                 * @extends {IField}
                 * @property {string} keyType Key type
                 */
                /**
                 * Extension map field descriptor.
                 * @interface IExtensionMapField
                 * @extends IMapField
                 * @property {string} extend Extended type
                 */
                /**
                 * Constructs a map field from a map field descriptor.
                 * @param {string} name Field name
                 * @param {IMapField} json Map field descriptor
                 * @returns {MapField} Created map field
                 * @throws {TypeError} If arguments are invalid
                 */
                MapField.fromJSON = function fromJSON(name, json) {
                    return new MapField(name, json.id, json.keyType, json.type, json.options);
                };
                /**
                 * Converts this map field to a map field descriptor.
                 * @returns {IMapField} Map field descriptor
                 */
                MapField.prototype.toJSON = function toJSON() {
                    return util.toObject([
                        "keyType", this.keyType,
                        "type", this.type,
                        "id", this.id,
                        "extend", this.extend,
                        "options", this.options
                    ]);
                };
                /**
                 * @override
                 */
                MapField.prototype.resolve = function resolve() {
                    if (this.resolved)
                        return this;
                    // Besides a value type, map fields have a key type that may be "any scalar type except for floating point types and bytes"
                    if (types.mapKey[this.keyType] === undefined)
                        throw Error("invalid key type: " + this.keyType);
                    return Field.prototype.resolve.call(this);
                };
                /**
                 * Map field decorator (TypeScript).
                 * @name MapField.d
                 * @function
                 * @param {number} fieldId Field id
                 * @param {"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"bool"|"string"} fieldKeyType Field key type
                 * @param {"double"|"float"|"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"bool"|"string"|"bytes"|Object|Constructor<{}>} fieldValueType Field value type
                 * @returns {FieldDecorator} Decorator function
                 * @template T extends { [key: string]: number | Long | string | boolean | Uint8Array | Buffer | number[] | Message<{}> }
                 */
                MapField.d = function decorateMapField(fieldId, fieldKeyType, fieldValueType) {
                    // submessage value: decorate the submessage and use its name as the type
                    if (typeof fieldValueType === "function")
                        fieldValueType = util.decorateType(fieldValueType).name;
                    else if (fieldValueType && typeof fieldValueType === "object")
                        fieldValueType = util.decorateEnum(fieldValueType).name;
                    return function mapFieldDecorator(prototype, fieldName) {
                        util.decorateType(prototype.constructor)
                            .add(new MapField(fieldName, fieldId, fieldKeyType, fieldValueType));
                    };
                };
            }, { "16": 16, "36": 36, "37": 37 }], 21: [function (require, module, exports) {
                "use strict";
                module.exports = Message;
                var util = require(39);
                /**
                 * Constructs a new message instance.
                 * @classdesc Abstract runtime message.
                 * @constructor
                 * @param {Properties<T>} [properties] Properties to set
                 * @template T extends object
                 */
                function Message(properties) {
                    // not used internally
                    if (properties)
                        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                            this[keys[i]] = properties[keys[i]];
                }
                /**
                 * Reference to the reflected type.
                 * @name Message.$type
                 * @type {Type}
                 * @readonly
                 */
                /**
                 * Reference to the reflected type.
                 * @name Message#$type
                 * @type {Type}
                 * @readonly
                 */
                /*eslint-disable valid-jsdoc*/
                /**
                 * Creates a new message of this type using the specified properties.
                 * @param {Object.<string,*>} [properties] Properties to set
                 * @returns {Message<T>} Message instance
                 * @template T extends Message<T>
                 * @this Constructor<T>
                 */
                Message.create = function create(properties) {
                    return this.$type.create(properties);
                };
                /**
                 * Encodes a message of this type.
                 * @param {T|Object.<string,*>} message Message to encode
                 * @param {Writer} [writer] Writer to use
                 * @returns {Writer} Writer
                 * @template T extends Message<T>
                 * @this Constructor<T>
                 */
                Message.encode = function encode(message, writer) {
                    return this.$type.encode(message, writer);
                };
                /**
                 * Encodes a message of this type preceeded by its length as a varint.
                 * @param {T|Object.<string,*>} message Message to encode
                 * @param {Writer} [writer] Writer to use
                 * @returns {Writer} Writer
                 * @template T extends Message<T>
                 * @this Constructor<T>
                 */
                Message.encodeDelimited = function encodeDelimited(message, writer) {
                    return this.$type.encodeDelimited(message, writer);
                };
                /**
                 * Decodes a message of this type.
                 * @name Message.decode
                 * @function
                 * @param {Reader|Uint8Array} reader Reader or buffer to decode
                 * @returns {T} Decoded message
                 * @template T extends Message<T>
                 * @this Constructor<T>
                 */
                Message.decode = function decode(reader) {
                    return this.$type.decode(reader);
                };
                /**
                 * Decodes a message of this type preceeded by its length as a varint.
                 * @name Message.decodeDelimited
                 * @function
                 * @param {Reader|Uint8Array} reader Reader or buffer to decode
                 * @returns {T} Decoded message
                 * @template T extends Message<T>
                 * @this Constructor<T>
                 */
                Message.decodeDelimited = function decodeDelimited(reader) {
                    return this.$type.decodeDelimited(reader);
                };
                /**
                 * Verifies a message of this type.
                 * @name Message.verify
                 * @function
                 * @param {Object.<string,*>} message Plain object to verify
                 * @returns {string|null} `null` if valid, otherwise the reason why it is not
                 */
                Message.verify = function verify(message) {
                    return this.$type.verify(message);
                };
                /**
                 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
                 * @param {Object.<string,*>} object Plain object
                 * @returns {T} Message instance
                 * @template T extends Message<T>
                 * @this Constructor<T>
                 */
                Message.fromObject = function fromObject(object) {
                    return this.$type.fromObject(object);
                };
                /**
                 * Creates a plain object from a message of this type. Also converts values to other types if specified.
                 * @param {T} message Message instance
                 * @param {IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 * @template T extends Message<T>
                 * @this Constructor<T>
                 */
                Message.toObject = function toObject(message, options) {
                    return this.$type.toObject(message, options);
                };
                /**
                 * Converts this message to JSON.
                 * @returns {Object.<string,*>} JSON object
                 */
                Message.prototype.toJSON = function toJSON() {
                    return this.$type.toObject(this, util.toJSONOptions);
                };
                /*eslint-enable valid-jsdoc*/
            }, { "39": 39 }], 22: [function (require, module, exports) {
                "use strict";
                module.exports = Method;
                // extends ReflectionObject
                var ReflectionObject = require(24);
                ((Method.prototype = Object.create(ReflectionObject.prototype)).constructor = Method).className = "Method";
                var util = require(37);
                /**
                 * Constructs a new service method instance.
                 * @classdesc Reflected service method.
                 * @extends ReflectionObject
                 * @constructor
                 * @param {string} name Method name
                 * @param {string|undefined} type Method type, usually `"rpc"`
                 * @param {string} requestType Request message type
                 * @param {string} responseType Response message type
                 * @param {boolean|Object.<string,*>} [requestStream] Whether the request is streamed
                 * @param {boolean|Object.<string,*>} [responseStream] Whether the response is streamed
                 * @param {Object.<string,*>} [options] Declared options
                 */
                function Method(name, type, requestType, responseType, requestStream, responseStream, options) {
                    /* istanbul ignore next */
                    if (util.isObject(requestStream)) {
                        options = requestStream;
                        requestStream = responseStream = undefined;
                    }
                    else if (util.isObject(responseStream)) {
                        options = responseStream;
                        responseStream = undefined;
                    }
                    /* istanbul ignore if */
                    if (!(type === undefined || util.isString(type)))
                        throw TypeError("type must be a string");
                    /* istanbul ignore if */
                    if (!util.isString(requestType))
                        throw TypeError("requestType must be a string");
                    /* istanbul ignore if */
                    if (!util.isString(responseType))
                        throw TypeError("responseType must be a string");
                    ReflectionObject.call(this, name, options);
                    /**
                     * Method type.
                     * @type {string}
                     */
                    this.type = type || "rpc"; // toJSON
                    /**
                     * Request type.
                     * @type {string}
                     */
                    this.requestType = requestType; // toJSON, marker
                    /**
                     * Whether requests are streamed or not.
                     * @type {boolean|undefined}
                     */
                    this.requestStream = requestStream ? true : undefined; // toJSON
                    /**
                     * Response type.
                     * @type {string}
                     */
                    this.responseType = responseType; // toJSON
                    /**
                     * Whether responses are streamed or not.
                     * @type {boolean|undefined}
                     */
                    this.responseStream = responseStream ? true : undefined; // toJSON
                    /**
                     * Resolved request type.
                     * @type {Type|null}
                     */
                    this.resolvedRequestType = null;
                    /**
                     * Resolved response type.
                     * @type {Type|null}
                     */
                    this.resolvedResponseType = null;
                }
                /**
                 * Method descriptor.
                 * @interface IMethod
                 * @property {string} [type="rpc"] Method type
                 * @property {string} requestType Request type
                 * @property {string} responseType Response type
                 * @property {boolean} [requestStream=false] Whether requests are streamed
                 * @property {boolean} [responseStream=false] Whether responses are streamed
                 * @property {Object.<string,*>} [options] Method options
                 */
                /**
                 * Constructs a method from a method descriptor.
                 * @param {string} name Method name
                 * @param {IMethod} json Method descriptor
                 * @returns {Method} Created method
                 * @throws {TypeError} If arguments are invalid
                 */
                Method.fromJSON = function fromJSON(name, json) {
                    return new Method(name, json.type, json.requestType, json.responseType, json.requestStream, json.responseStream, json.options);
                };
                /**
                 * Converts this method to a method descriptor.
                 * @returns {IMethod} Method descriptor
                 */
                Method.prototype.toJSON = function toJSON() {
                    return util.toObject([
                        "type", this.type !== "rpc" && this.type || undefined,
                        "requestType", this.requestType,
                        "requestStream", this.requestStream,
                        "responseType", this.responseType,
                        "responseStream", this.responseStream,
                        "options", this.options
                    ]);
                };
                /**
                 * @override
                 */
                Method.prototype.resolve = function resolve() {
                    /* istanbul ignore if */
                    if (this.resolved)
                        return this;
                    this.resolvedRequestType = this.parent.lookupType(this.requestType);
                    this.resolvedResponseType = this.parent.lookupType(this.responseType);
                    return ReflectionObject.prototype.resolve.call(this);
                };
            }, { "24": 24, "37": 37 }], 23: [function (require, module, exports) {
                "use strict";
                module.exports = Namespace;
                // extends ReflectionObject
                var ReflectionObject = require(24);
                ((Namespace.prototype = Object.create(ReflectionObject.prototype)).constructor = Namespace).className = "Namespace";
                var Enum = require(15), Field = require(16), util = require(37);
                var Type, // cyclic
                Service; // "
                /**
                 * Constructs a new namespace instance.
                 * @name Namespace
                 * @classdesc Reflected namespace.
                 * @extends NamespaceBase
                 * @constructor
                 * @param {string} name Namespace name
                 * @param {Object.<string,*>} [options] Declared options
                 */
                /**
                 * Constructs a namespace from JSON.
                 * @memberof Namespace
                 * @function
                 * @param {string} name Namespace name
                 * @param {Object.<string,*>} json JSON object
                 * @returns {Namespace} Created namespace
                 * @throws {TypeError} If arguments are invalid
                 */
                Namespace.fromJSON = function fromJSON(name, json) {
                    return new Namespace(name, json.options).addJSON(json.nested);
                };
                /**
                 * Converts an array of reflection objects to JSON.
                 * @memberof Namespace
                 * @param {ReflectionObject[]} array Object array
                 * @returns {Object.<string,*>|undefined} JSON object or `undefined` when array is empty
                 */
                function arrayToJSON(array) {
                    if (!(array && array.length))
                        return undefined;
                    var obj = {};
                    for (var i = 0; i < array.length; ++i)
                        obj[array[i].name] = array[i].toJSON();
                    return obj;
                }
                Namespace.arrayToJSON = arrayToJSON;
                /**
                 * Not an actual constructor. Use {@link Namespace} instead.
                 * @classdesc Base class of all reflection objects containing nested objects. This is not an actual class but here for the sake of having consistent type definitions.
                 * @exports NamespaceBase
                 * @extends ReflectionObject
                 * @abstract
                 * @constructor
                 * @param {string} name Namespace name
                 * @param {Object.<string,*>} [options] Declared options
                 * @see {@link Namespace}
                 */
                function Namespace(name, options) {
                    ReflectionObject.call(this, name, options);
                    /**
                     * Nested objects by name.
                     * @type {Object.<string,ReflectionObject>|undefined}
                     */
                    this.nested = undefined; // toJSON
                    /**
                     * Cached nested objects as an array.
                     * @type {ReflectionObject[]|null}
                     * @private
                     */
                    this._nestedArray = null;
                }
                function clearCache(namespace) {
                    namespace._nestedArray = null;
                    return namespace;
                }
                /**
                 * Nested objects of this namespace as an array for iteration.
                 * @name NamespaceBase#nestedArray
                 * @type {ReflectionObject[]}
                 * @readonly
                 */
                Object.defineProperty(Namespace.prototype, "nestedArray", {
                    get: function () {
                        return this._nestedArray || (this._nestedArray = util.toArray(this.nested));
                    }
                });
                /**
                 * Namespace descriptor.
                 * @interface INamespace
                 * @property {Object.<string,*>} [options] Namespace options
                 * @property {Object.<string,AnyNestedObject>} [nested] Nested object descriptors
                 */
                /**
                 * Any extension field descriptor.
                 * @typedef AnyExtensionField
                 * @type {IExtensionField|IExtensionMapField}
                 */
                /**
                 * Any nested object descriptor.
                 * @typedef AnyNestedObject
                 * @type {IEnum|IType|IService|AnyExtensionField|INamespace}
                 */
                // ^ BEWARE: VSCode hangs forever when using more than 5 types (that's why AnyExtensionField exists in the first place)
                /**
                 * Converts this namespace to a namespace descriptor.
                 * @returns {INamespace} Namespace descriptor
                 */
                Namespace.prototype.toJSON = function toJSON() {
                    return util.toObject([
                        "options", this.options,
                        "nested", arrayToJSON(this.nestedArray)
                    ]);
                };
                /**
                 * Adds nested objects to this namespace from nested object descriptors.
                 * @param {Object.<string,AnyNestedObject>} nestedJson Any nested object descriptors
                 * @returns {Namespace} `this`
                 */
                Namespace.prototype.addJSON = function addJSON(nestedJson) {
                    var ns = this;
                    /* istanbul ignore else */
                    if (nestedJson) {
                        for (var names = Object.keys(nestedJson), i = 0, nested; i < names.length; ++i) {
                            nested = nestedJson[names[i]];
                            ns.add(// most to least likely
                            (nested.fields !== undefined
                                ? Type.fromJSON
                                : nested.values !== undefined
                                    ? Enum.fromJSON
                                    : nested.methods !== undefined
                                        ? Service.fromJSON
                                        : nested.id !== undefined
                                            ? Field.fromJSON
                                            : Namespace.fromJSON)(names[i], nested));
                        }
                    }
                    return this;
                };
                /**
                 * Gets the nested object of the specified name.
                 * @param {string} name Nested object name
                 * @returns {ReflectionObject|null} The reflection object or `null` if it doesn't exist
                 */
                Namespace.prototype.get = function get(name) {
                    return this.nested && this.nested[name]
                        || null;
                };
                /**
                 * Gets the values of the nested {@link Enum|enum} of the specified name.
                 * This methods differs from {@link Namespace#get|get} in that it returns an enum's values directly and throws instead of returning `null`.
                 * @param {string} name Nested enum name
                 * @returns {Object.<string,number>} Enum values
                 * @throws {Error} If there is no such enum
                 */
                Namespace.prototype.getEnum = function getEnum(name) {
                    if (this.nested && this.nested[name] instanceof Enum)
                        return this.nested[name].values;
                    throw Error("no such enum");
                };
                /**
                 * Adds a nested object to this namespace.
                 * @param {ReflectionObject} object Nested object to add
                 * @returns {Namespace} `this`
                 * @throws {TypeError} If arguments are invalid
                 * @throws {Error} If there is already a nested object with this name
                 */
                Namespace.prototype.add = function add(object) {
                    if (!(object instanceof Field && object.extend !== undefined || object instanceof Type || object instanceof Enum || object instanceof Service || object instanceof Namespace))
                        throw TypeError("object must be a valid nested object");
                    if (!this.nested)
                        this.nested = {};
                    else {
                        var prev = this.get(object.name);
                        if (prev) {
                            if (prev instanceof Namespace && object instanceof Namespace && !(prev instanceof Type || prev instanceof Service)) {
                                // replace plain namespace but keep existing nested elements and options
                                var nested = prev.nestedArray;
                                for (var i = 0; i < nested.length; ++i)
                                    object.add(nested[i]);
                                this.remove(prev);
                                if (!this.nested)
                                    this.nested = {};
                                object.setOptions(prev.options, true);
                            }
                            else
                                throw Error("duplicate name '" + object.name + "' in " + this);
                        }
                    }
                    this.nested[object.name] = object;
                    object.onAdd(this);
                    return clearCache(this);
                };
                /**
                 * Removes a nested object from this namespace.
                 * @param {ReflectionObject} object Nested object to remove
                 * @returns {Namespace} `this`
                 * @throws {TypeError} If arguments are invalid
                 * @throws {Error} If `object` is not a member of this namespace
                 */
                Namespace.prototype.remove = function remove(object) {
                    if (!(object instanceof ReflectionObject))
                        throw TypeError("object must be a ReflectionObject");
                    if (object.parent !== this)
                        throw Error(object + " is not a member of " + this);
                    delete this.nested[object.name];
                    if (!Object.keys(this.nested).length)
                        this.nested = undefined;
                    object.onRemove(this);
                    return clearCache(this);
                };
                /**
                 * Defines additial namespaces within this one if not yet existing.
                 * @param {string|string[]} path Path to create
                 * @param {*} [json] Nested types to create from JSON
                 * @returns {Namespace} Pointer to the last namespace created or `this` if path is empty
                 */
                Namespace.prototype.define = function define(path, json) {
                    if (util.isString(path))
                        path = path.split(".");
                    else if (!Array.isArray(path))
                        throw TypeError("illegal path");
                    if (path && path.length && path[0] === "")
                        throw Error("path must be relative");
                    var ptr = this;
                    while (path.length > 0) {
                        var part = path.shift();
                        if (ptr.nested && ptr.nested[part]) {
                            ptr = ptr.nested[part];
                            if (!(ptr instanceof Namespace))
                                throw Error("path conflicts with non-namespace objects");
                        }
                        else
                            ptr.add(ptr = new Namespace(part));
                    }
                    if (json)
                        ptr.addJSON(json);
                    return ptr;
                };
                /**
                 * Resolves this namespace's and all its nested objects' type references. Useful to validate a reflection tree, but comes at a cost.
                 * @returns {Namespace} `this`
                 */
                Namespace.prototype.resolveAll = function resolveAll() {
                    var nested = this.nestedArray, i = 0;
                    while (i < nested.length)
                        if (nested[i] instanceof Namespace)
                            nested[i++].resolveAll();
                        else
                            nested[i++].resolve();
                    return this.resolve();
                };
                /**
                 * Recursively looks up the reflection object matching the specified path in the scope of this namespace.
                 * @param {string|string[]} path Path to look up
                 * @param {*|Array.<*>} filterTypes Filter types, any combination of the constructors of `protobuf.Type`, `protobuf.Enum`, `protobuf.Service` etc.
                 * @param {boolean} [parentAlreadyChecked=false] If known, whether the parent has already been checked
                 * @returns {ReflectionObject|null} Looked up object or `null` if none could be found
                 */
                Namespace.prototype.lookup = function lookup(path, filterTypes, parentAlreadyChecked) {
                    /* istanbul ignore next */
                    if (typeof filterTypes === "boolean") {
                        parentAlreadyChecked = filterTypes;
                        filterTypes = undefined;
                    }
                    else if (filterTypes && !Array.isArray(filterTypes))
                        filterTypes = [filterTypes];
                    if (util.isString(path) && path.length) {
                        if (path === ".")
                            return this.root;
                        path = path.split(".");
                    }
                    else if (!path.length)
                        return this;
                    // Start at root if path is absolute
                    if (path[0] === "")
                        return this.root.lookup(path.slice(1), filterTypes);
                    // Test if the first part matches any nested object, and if so, traverse if path contains more
                    var found = this.get(path[0]);
                    if (found) {
                        if (path.length === 1) {
                            if (!filterTypes || filterTypes.indexOf(found.constructor) > -1)
                                return found;
                        }
                        else if (found instanceof Namespace && (found = found.lookup(path.slice(1), filterTypes, true)))
                            return found;
                        // Otherwise try each nested namespace
                    }
                    else
                        for (var i = 0; i < this.nestedArray.length; ++i)
                            if (this._nestedArray[i] instanceof Namespace && (found = this._nestedArray[i].lookup(path, filterTypes, true)))
                                return found;
                    // If there hasn't been a match, try again at the parent
                    if (this.parent === null || parentAlreadyChecked)
                        return null;
                    return this.parent.lookup(path, filterTypes);
                };
                /**
                 * Looks up the reflection object at the specified path, relative to this namespace.
                 * @name NamespaceBase#lookup
                 * @function
                 * @param {string|string[]} path Path to look up
                 * @param {boolean} [parentAlreadyChecked=false] Whether the parent has already been checked
                 * @returns {ReflectionObject|null} Looked up object or `null` if none could be found
                 * @variation 2
                 */
                // lookup(path: string, [parentAlreadyChecked: boolean])
                /**
                 * Looks up the {@link Type|type} at the specified path, relative to this namespace.
                 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
                 * @param {string|string[]} path Path to look up
                 * @returns {Type} Looked up type
                 * @throws {Error} If `path` does not point to a type
                 */
                Namespace.prototype.lookupType = function lookupType(path) {
                    var found = this.lookup(path, [Type]);
                    if (!found)
                        throw Error("no such type");
                    return found;
                };
                /**
                 * Looks up the values of the {@link Enum|enum} at the specified path, relative to this namespace.
                 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
                 * @param {string|string[]} path Path to look up
                 * @returns {Enum} Looked up enum
                 * @throws {Error} If `path` does not point to an enum
                 */
                Namespace.prototype.lookupEnum = function lookupEnum(path) {
                    var found = this.lookup(path, [Enum]);
                    if (!found)
                        throw Error("no such Enum '" + path + "' in " + this);
                    return found;
                };
                /**
                 * Looks up the {@link Type|type} or {@link Enum|enum} at the specified path, relative to this namespace.
                 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
                 * @param {string|string[]} path Path to look up
                 * @returns {Type} Looked up type or enum
                 * @throws {Error} If `path` does not point to a type or enum
                 */
                Namespace.prototype.lookupTypeOrEnum = function lookupTypeOrEnum(path) {
                    var found = this.lookup(path, [Type, Enum]);
                    if (!found)
                        throw Error("no such Type or Enum '" + path + "' in " + this);
                    return found;
                };
                /**
                 * Looks up the {@link Service|service} at the specified path, relative to this namespace.
                 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
                 * @param {string|string[]} path Path to look up
                 * @returns {Service} Looked up service
                 * @throws {Error} If `path` does not point to a service
                 */
                Namespace.prototype.lookupService = function lookupService(path) {
                    var found = this.lookup(path, [Service]);
                    if (!found)
                        throw Error("no such Service '" + path + "' in " + this);
                    return found;
                };
                Namespace._configure = function (Type_, Service_) {
                    Type = Type_;
                    Service = Service_;
                };
            }, { "15": 15, "16": 16, "24": 24, "37": 37 }], 24: [function (require, module, exports) {
                "use strict";
                module.exports = ReflectionObject;
                ReflectionObject.className = "ReflectionObject";
                var util = require(37);
                var Root; // cyclic
                /**
                 * Constructs a new reflection object instance.
                 * @classdesc Base class of all reflection objects.
                 * @constructor
                 * @param {string} name Object name
                 * @param {Object.<string,*>} [options] Declared options
                 * @abstract
                 */
                function ReflectionObject(name, options) {
                    if (!util.isString(name))
                        throw TypeError("name must be a string");
                    if (options && !util.isObject(options))
                        throw TypeError("options must be an object");
                    /**
                     * Options.
                     * @type {Object.<string,*>|undefined}
                     */
                    this.options = options; // toJSON
                    /**
                     * Unique name within its namespace.
                     * @type {string}
                     */
                    this.name = name;
                    /**
                     * Parent namespace.
                     * @type {Namespace|null}
                     */
                    this.parent = null;
                    /**
                     * Whether already resolved or not.
                     * @type {boolean}
                     */
                    this.resolved = false;
                    /**
                     * Comment text, if any.
                     * @type {string|null}
                     */
                    this.comment = null;
                    /**
                     * Defining file name.
                     * @type {string|null}
                     */
                    this.filename = null;
                }
                Object.defineProperties(ReflectionObject.prototype, {
                    /**
                     * Reference to the root namespace.
                     * @name ReflectionObject#root
                     * @type {Root}
                     * @readonly
                     */
                    root: {
                        get: function () {
                            var ptr = this;
                            while (ptr.parent !== null)
                                ptr = ptr.parent;
                            return ptr;
                        }
                    },
                    /**
                     * Full name including leading dot.
                     * @name ReflectionObject#fullName
                     * @type {string}
                     * @readonly
                     */
                    fullName: {
                        get: function () {
                            var path = [this.name], ptr = this.parent;
                            while (ptr) {
                                path.unshift(ptr.name);
                                ptr = ptr.parent;
                            }
                            return path.join(".");
                        }
                    }
                });
                /**
                 * Converts this reflection object to its descriptor representation.
                 * @returns {Object.<string,*>} Descriptor
                 * @abstract
                 */
                ReflectionObject.prototype.toJSON = function toJSON() {
                    throw Error(); // not implemented, shouldn't happen
                };
                /**
                 * Called when this object is added to a parent.
                 * @param {ReflectionObject} parent Parent added to
                 * @returns {undefined}
                 */
                ReflectionObject.prototype.onAdd = function onAdd(parent) {
                    if (this.parent && this.parent !== parent)
                        this.parent.remove(this);
                    this.parent = parent;
                    this.resolved = false;
                    var root = parent.root;
                    if (root instanceof Root)
                        root._handleAdd(this);
                };
                /**
                 * Called when this object is removed from a parent.
                 * @param {ReflectionObject} parent Parent removed from
                 * @returns {undefined}
                 */
                ReflectionObject.prototype.onRemove = function onRemove(parent) {
                    var root = parent.root;
                    if (root instanceof Root)
                        root._handleRemove(this);
                    this.parent = null;
                    this.resolved = false;
                };
                /**
                 * Resolves this objects type references.
                 * @returns {ReflectionObject} `this`
                 */
                ReflectionObject.prototype.resolve = function resolve() {
                    if (this.resolved)
                        return this;
                    if (this.root instanceof Root)
                        this.resolved = true; // only if part of a root
                    return this;
                };
                /**
                 * Gets an option value.
                 * @param {string} name Option name
                 * @returns {*} Option value or `undefined` if not set
                 */
                ReflectionObject.prototype.getOption = function getOption(name) {
                    if (this.options)
                        return this.options[name];
                    return undefined;
                };
                /**
                 * Sets an option.
                 * @param {string} name Option name
                 * @param {*} value Option value
                 * @param {boolean} [ifNotSet] Sets the option only if it isn't currently set
                 * @returns {ReflectionObject} `this`
                 */
                ReflectionObject.prototype.setOption = function setOption(name, value, ifNotSet) {
                    if (!ifNotSet || !this.options || this.options[name] === undefined)
                        (this.options || (this.options = {}))[name] = value;
                    return this;
                };
                /**
                 * Sets multiple options.
                 * @param {Object.<string,*>} options Options to set
                 * @param {boolean} [ifNotSet] Sets an option only if it isn't currently set
                 * @returns {ReflectionObject} `this`
                 */
                ReflectionObject.prototype.setOptions = function setOptions(options, ifNotSet) {
                    if (options)
                        for (var keys = Object.keys(options), i = 0; i < keys.length; ++i)
                            this.setOption(keys[i], options[keys[i]], ifNotSet);
                    return this;
                };
                /**
                 * Converts this instance to its string representation.
                 * @returns {string} Class name[, space, full name]
                 */
                ReflectionObject.prototype.toString = function toString() {
                    var className = this.constructor.className, fullName = this.fullName;
                    if (fullName.length)
                        return className + " " + fullName;
                    return className;
                };
                ReflectionObject._configure = function (Root_) {
                    Root = Root_;
                };
            }, { "37": 37 }], 25: [function (require, module, exports) {
                "use strict";
                module.exports = OneOf;
                // extends ReflectionObject
                var ReflectionObject = require(24);
                ((OneOf.prototype = Object.create(ReflectionObject.prototype)).constructor = OneOf).className = "OneOf";
                var Field = require(16), util = require(37);
                /**
                 * Constructs a new oneof instance.
                 * @classdesc Reflected oneof.
                 * @extends ReflectionObject
                 * @constructor
                 * @param {string} name Oneof name
                 * @param {string[]|Object.<string,*>} [fieldNames] Field names
                 * @param {Object.<string,*>} [options] Declared options
                 */
                function OneOf(name, fieldNames, options) {
                    if (!Array.isArray(fieldNames)) {
                        options = fieldNames;
                        fieldNames = undefined;
                    }
                    ReflectionObject.call(this, name, options);
                    /* istanbul ignore if */
                    if (!(fieldNames === undefined || Array.isArray(fieldNames)))
                        throw TypeError("fieldNames must be an Array");
                    /**
                     * Field names that belong to this oneof.
                     * @type {string[]}
                     */
                    this.oneof = fieldNames || []; // toJSON, marker
                    /**
                     * Fields that belong to this oneof as an array for iteration.
                     * @type {Field[]}
                     * @readonly
                     */
                    this.fieldsArray = []; // declared readonly for conformance, possibly not yet added to parent
                }
                /**
                 * Oneof descriptor.
                 * @interface IOneOf
                 * @property {Array.<string>} oneof Oneof field names
                 * @property {Object.<string,*>} [options] Oneof options
                 */
                /**
                 * Constructs a oneof from a oneof descriptor.
                 * @param {string} name Oneof name
                 * @param {IOneOf} json Oneof descriptor
                 * @returns {OneOf} Created oneof
                 * @throws {TypeError} If arguments are invalid
                 */
                OneOf.fromJSON = function fromJSON(name, json) {
                    return new OneOf(name, json.oneof, json.options);
                };
                /**
                 * Converts this oneof to a oneof descriptor.
                 * @returns {IOneOf} Oneof descriptor
                 */
                OneOf.prototype.toJSON = function toJSON() {
                    return util.toObject([
                        "options", this.options,
                        "oneof", this.oneof
                    ]);
                };
                /**
                 * Adds the fields of the specified oneof to the parent if not already done so.
                 * @param {OneOf} oneof The oneof
                 * @returns {undefined}
                 * @inner
                 * @ignore
                 */
                function addFieldsToParent(oneof) {
                    if (oneof.parent)
                        for (var i = 0; i < oneof.fieldsArray.length; ++i)
                            if (!oneof.fieldsArray[i].parent)
                                oneof.parent.add(oneof.fieldsArray[i]);
                }
                /**
                 * Adds a field to this oneof and removes it from its current parent, if any.
                 * @param {Field} field Field to add
                 * @returns {OneOf} `this`
                 */
                OneOf.prototype.add = function add(field) {
                    /* istanbul ignore if */
                    if (!(field instanceof Field))
                        throw TypeError("field must be a Field");
                    if (field.parent && field.parent !== this.parent)
                        field.parent.remove(field);
                    this.oneof.push(field.name);
                    this.fieldsArray.push(field);
                    field.partOf = this; // field.parent remains null
                    addFieldsToParent(this);
                    return this;
                };
                /**
                 * Removes a field from this oneof and puts it back to the oneof's parent.
                 * @param {Field} field Field to remove
                 * @returns {OneOf} `this`
                 */
                OneOf.prototype.remove = function remove(field) {
                    /* istanbul ignore if */
                    if (!(field instanceof Field))
                        throw TypeError("field must be a Field");
                    var index = this.fieldsArray.indexOf(field);
                    /* istanbul ignore if */
                    if (index < 0)
                        throw Error(field + " is not a member of " + this);
                    this.fieldsArray.splice(index, 1);
                    index = this.oneof.indexOf(field.name);
                    /* istanbul ignore else */
                    if (index > -1)
                        this.oneof.splice(index, 1);
                    field.partOf = null;
                    return this;
                };
                /**
                 * @override
                 */
                OneOf.prototype.onAdd = function onAdd(parent) {
                    ReflectionObject.prototype.onAdd.call(this, parent);
                    var self = this;
                    // Collect present fields
                    for (var i = 0; i < this.oneof.length; ++i) {
                        var field = parent.get(this.oneof[i]);
                        if (field && !field.partOf) {
                            field.partOf = self;
                            self.fieldsArray.push(field);
                        }
                    }
                    // Add not yet present fields
                    addFieldsToParent(this);
                };
                /**
                 * @override
                 */
                OneOf.prototype.onRemove = function onRemove(parent) {
                    for (var i = 0, field; i < this.fieldsArray.length; ++i)
                        if ((field = this.fieldsArray[i]).parent)
                            field.parent.remove(field);
                    ReflectionObject.prototype.onRemove.call(this, parent);
                };
                /**
                 * Decorator function as returned by {@link OneOf.d} (TypeScript).
                 * @typedef OneOfDecorator
                 * @type {function}
                 * @param {Object} prototype Target prototype
                 * @param {string} oneofName OneOf name
                 * @returns {undefined}
                 */
                /**
                 * OneOf decorator (TypeScript).
                 * @function
                 * @param {...string} fieldNames Field names
                 * @returns {OneOfDecorator} Decorator function
                 * @template T extends string
                 */
                OneOf.d = function decorateOneOf() {
                    var fieldNames = new Array(arguments.length), index = 0;
                    while (index < arguments.length)
                        fieldNames[index] = arguments[index++];
                    return function oneOfDecorator(prototype, oneofName) {
                        util.decorateType(prototype.constructor)
                            .add(new OneOf(oneofName, fieldNames));
                        Object.defineProperty(prototype, oneofName, {
                            get: util.oneOfGetter(fieldNames),
                            set: util.oneOfSetter(fieldNames)
                        });
                    };
                };
            }, { "16": 16, "24": 24, "37": 37 }], 26: [function (require, module, exports) {
                "use strict";
                module.exports = parse;
                parse.filename = null;
                parse.defaults = { keepCase: false };
                var tokenize = require(34), Root = require(29), Type = require(35), Field = require(16), MapField = require(20), OneOf = require(25), Enum = require(15), Service = require(33), Method = require(22), types = require(36), util = require(37);
                var base10Re = /^[1-9][0-9]*$/, base10NegRe = /^-?[1-9][0-9]*$/, base16Re = /^0[x][0-9a-fA-F]+$/, base16NegRe = /^-?0[x][0-9a-fA-F]+$/, base8Re = /^0[0-7]+$/, base8NegRe = /^-?0[0-7]+$/, numberRe = /^(?![eE])[0-9]*(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?$/, nameRe = /^[a-zA-Z_][a-zA-Z_0-9]*$/, typeRefRe = /^(?:\.?[a-zA-Z_][a-zA-Z_0-9]*)+$/, fqTypeRefRe = /^(?:\.[a-zA-Z][a-zA-Z_0-9]*)+$/;
                /**
                 * Result object returned from {@link parse}.
                 * @interface IParserResult
                 * @property {string|undefined} package Package name, if declared
                 * @property {string[]|undefined} imports Imports, if any
                 * @property {string[]|undefined} weakImports Weak imports, if any
                 * @property {string|undefined} syntax Syntax, if specified (either `"proto2"` or `"proto3"`)
                 * @property {Root} root Populated root instance
                 */
                /**
                 * Options modifying the behavior of {@link parse}.
                 * @interface IParseOptions
                 * @property {boolean} [keepCase=false] Keeps field casing instead of converting to camel case
                 */
                /**
                 * Parses the given .proto source and returns an object with the parsed contents.
                 * @param {string} source Source contents
                 * @param {Root} root Root to populate
                 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
                 * @returns {IParserResult} Parser result
                 * @property {string} filename=null Currently processing file name for error reporting, if known
                 * @property {IParseOptions} defaults Default {@link IParseOptions}
                 */
                function parse(source, root, options) {
                    /* eslint-disable callback-return */
                    if (!(root instanceof Root)) {
                        options = root;
                        root = new Root();
                    }
                    if (!options)
                        options = parse.defaults;
                    var tn = tokenize(source), next = tn.next, push = tn.push, peek = tn.peek, skip = tn.skip, cmnt = tn.cmnt;
                    var head = true, pkg, imports, weakImports, syntax, isProto3 = false;
                    var ptr = root;
                    var applyCase = options.keepCase ? function (name) { return name; } : util.camelCase;
                    /* istanbul ignore next */
                    function illegal(token, name, insideTryCatch) {
                        var filename = parse.filename;
                        if (!insideTryCatch)
                            parse.filename = null;
                        return Error("illegal " + (name || "token") + " '" + token + "' (" + (filename ? filename + ", " : "") + "line " + tn.line + ")");
                    }
                    function readString() {
                        var values = [], token;
                        do {
                            /* istanbul ignore if */
                            if ((token = next()) !== "\"" && token !== "'")
                                throw illegal(token);
                            values.push(next());
                            skip(token);
                            token = peek();
                        } while (token === "\"" || token === "'");
                        return values.join("");
                    }
                    function readValue(acceptTypeRef) {
                        var token = next();
                        switch (token) {
                            case "'":
                            case "\"":
                                push(token);
                                return readString();
                            case "true":
                            case "TRUE":
                                return true;
                            case "false":
                            case "FALSE":
                                return false;
                        }
                        try {
                            return parseNumber(token, /* insideTryCatch */ true);
                        }
                        catch (e) {
                            /* istanbul ignore else */
                            if (acceptTypeRef && typeRefRe.test(token))
                                return token;
                            /* istanbul ignore next */
                            throw illegal(token, "value");
                        }
                    }
                    function readRanges(target, acceptStrings) {
                        var token, start;
                        do {
                            if (acceptStrings && ((token = peek()) === "\"" || token === "'"))
                                target.push(readString());
                            else
                                target.push([start = parseId(next()), skip("to", true) ? parseId(next()) : start]);
                        } while (skip(",", true));
                        skip(";");
                    }
                    function parseNumber(token, insideTryCatch) {
                        var sign = 1;
                        if (token.charAt(0) === "-") {
                            sign = -1;
                            token = token.substring(1);
                        }
                        switch (token) {
                            case "inf":
                            case "INF":
                            case "Inf":
                                return sign * Infinity;
                            case "nan":
                            case "NAN":
                            case "Nan":
                            case "NaN":
                                return NaN;
                            case "0":
                                return 0;
                        }
                        if (base10Re.test(token))
                            return sign * parseInt(token, 10);
                        if (base16Re.test(token))
                            return sign * parseInt(token, 16);
                        if (base8Re.test(token))
                            return sign * parseInt(token, 8);
                        /* istanbul ignore else */
                        if (numberRe.test(token))
                            return sign * parseFloat(token);
                        /* istanbul ignore next */
                        throw illegal(token, "number", insideTryCatch);
                    }
                    function parseId(token, acceptNegative) {
                        switch (token) {
                            case "max":
                            case "MAX":
                            case "Max":
                                return 536870911;
                            case "0":
                                return 0;
                        }
                        /* istanbul ignore if */
                        if (!acceptNegative && token.charAt(0) === "-")
                            throw illegal(token, "id");
                        if (base10NegRe.test(token))
                            return parseInt(token, 10);
                        if (base16NegRe.test(token))
                            return parseInt(token, 16);
                        /* istanbul ignore else */
                        if (base8NegRe.test(token))
                            return parseInt(token, 8);
                        /* istanbul ignore next */
                        throw illegal(token, "id");
                    }
                    function parsePackage() {
                        /* istanbul ignore if */
                        if (pkg !== undefined)
                            throw illegal("package");
                        pkg = next();
                        /* istanbul ignore if */
                        if (!typeRefRe.test(pkg))
                            throw illegal(pkg, "name");
                        ptr = ptr.define(pkg);
                        skip(";");
                    }
                    function parseImport() {
                        var token = peek();
                        var whichImports;
                        switch (token) {
                            case "weak":
                                whichImports = weakImports || (weakImports = []);
                                next();
                                break;
                            case "public":
                                next();
                            // eslint-disable-line no-fallthrough
                            default:
                                whichImports = imports || (imports = []);
                                break;
                        }
                        token = readString();
                        skip(";");
                        whichImports.push(token);
                    }
                    function parseSyntax() {
                        skip("=");
                        syntax = readString();
                        isProto3 = syntax === "proto3";
                        /* istanbul ignore if */
                        if (!isProto3 && syntax !== "proto2")
                            throw illegal(syntax, "syntax");
                        skip(";");
                    }
                    function parseCommon(parent, token) {
                        switch (token) {
                            case "option":
                                parseOption(parent, token);
                                skip(";");
                                return true;
                            case "message":
                                parseType(parent, token);
                                return true;
                            case "enum":
                                parseEnum(parent, token);
                                return true;
                            case "service":
                                parseService(parent, token);
                                return true;
                            case "extend":
                                parseExtension(parent, token);
                                return true;
                        }
                        return false;
                    }
                    function ifBlock(obj, fnIf, fnElse) {
                        var trailingLine = tn.line;
                        if (obj) {
                            obj.comment = cmnt(); // try block-type comment
                            obj.filename = parse.filename;
                        }
                        if (skip("{", true)) {
                            var token;
                            while ((token = next()) !== "}")
                                fnIf(token);
                            skip(";", true);
                        }
                        else {
                            if (fnElse)
                                fnElse();
                            skip(";");
                            if (obj && typeof obj.comment !== "string")
                                obj.comment = cmnt(trailingLine); // try line-type comment if no block
                        }
                    }
                    function parseType(parent, token) {
                        /* istanbul ignore if */
                        if (!nameRe.test(token = next()))
                            throw illegal(token, "type name");
                        var type = new Type(token);
                        ifBlock(type, function parseType_block(token) {
                            if (parseCommon(type, token))
                                return;
                            switch (token) {
                                case "map":
                                    parseMapField(type, token);
                                    break;
                                case "required":
                                case "optional":
                                case "repeated":
                                    parseField(type, token);
                                    break;
                                case "oneof":
                                    parseOneOf(type, token);
                                    break;
                                case "extensions":
                                    readRanges(type.extensions || (type.extensions = []));
                                    break;
                                case "reserved":
                                    readRanges(type.reserved || (type.reserved = []), true);
                                    break;
                                default:
                                    /* istanbul ignore if */
                                    if (!isProto3 || !typeRefRe.test(token))
                                        throw illegal(token);
                                    push(token);
                                    parseField(type, "optional");
                                    break;
                            }
                        });
                        parent.add(type);
                    }
                    function parseField(parent, rule, extend) {
                        var type = next();
                        if (type === "group") {
                            parseGroup(parent, rule);
                            return;
                        }
                        /* istanbul ignore if */
                        if (!typeRefRe.test(type))
                            throw illegal(type, "type");
                        var name = next();
                        /* istanbul ignore if */
                        if (!nameRe.test(name))
                            throw illegal(name, "name");
                        name = applyCase(name);
                        skip("=");
                        var field = new Field(name, parseId(next()), type, rule, extend);
                        ifBlock(field, function parseField_block(token) {
                            /* istanbul ignore else */
                            if (token === "option") {
                                parseOption(field, token);
                                skip(";");
                            }
                            else
                                throw illegal(token);
                        }, function parseField_line() {
                            parseInlineOptions(field);
                        });
                        parent.add(field);
                        // JSON defaults to packed=true if not set so we have to set packed=false explicity when
                        // parsing proto2 descriptors without the option, where applicable. This must be done for
                        // all known packable types and anything that could be an enum (= is not a basic type).
                        if (!isProto3 && field.repeated && (types.packed[type] !== undefined || types.basic[type] === undefined))
                            field.setOption("packed", false, /* ifNotSet */ true);
                    }
                    function parseGroup(parent, rule) {
                        var name = next();
                        /* istanbul ignore if */
                        if (!nameRe.test(name))
                            throw illegal(name, "name");
                        var fieldName = util.lcFirst(name);
                        if (name === fieldName)
                            name = util.ucFirst(name);
                        skip("=");
                        var id = parseId(next());
                        var type = new Type(name);
                        type.group = true;
                        var field = new Field(fieldName, id, name, rule);
                        field.filename = parse.filename;
                        ifBlock(type, function parseGroup_block(token) {
                            switch (token) {
                                case "option":
                                    parseOption(type, token);
                                    skip(";");
                                    break;
                                case "required":
                                case "optional":
                                case "repeated":
                                    parseField(type, token);
                                    break;
                                /* istanbul ignore next */
                                default:
                                    throw illegal(token); // there are no groups with proto3 semantics
                            }
                        });
                        parent.add(type)
                            .add(field);
                    }
                    function parseMapField(parent) {
                        skip("<");
                        var keyType = next();
                        /* istanbul ignore if */
                        if (types.mapKey[keyType] === undefined)
                            throw illegal(keyType, "type");
                        skip(",");
                        var valueType = next();
                        /* istanbul ignore if */
                        if (!typeRefRe.test(valueType))
                            throw illegal(valueType, "type");
                        skip(">");
                        var name = next();
                        /* istanbul ignore if */
                        if (!nameRe.test(name))
                            throw illegal(name, "name");
                        skip("=");
                        var field = new MapField(applyCase(name), parseId(next()), keyType, valueType);
                        ifBlock(field, function parseMapField_block(token) {
                            /* istanbul ignore else */
                            if (token === "option") {
                                parseOption(field, token);
                                skip(";");
                            }
                            else
                                throw illegal(token);
                        }, function parseMapField_line() {
                            parseInlineOptions(field);
                        });
                        parent.add(field);
                    }
                    function parseOneOf(parent, token) {
                        /* istanbul ignore if */
                        if (!nameRe.test(token = next()))
                            throw illegal(token, "name");
                        var oneof = new OneOf(applyCase(token));
                        ifBlock(oneof, function parseOneOf_block(token) {
                            if (token === "option") {
                                parseOption(oneof, token);
                                skip(";");
                            }
                            else {
                                push(token);
                                parseField(oneof, "optional");
                            }
                        });
                        parent.add(oneof);
                    }
                    function parseEnum(parent, token) {
                        /* istanbul ignore if */
                        if (!nameRe.test(token = next()))
                            throw illegal(token, "name");
                        var enm = new Enum(token);
                        ifBlock(enm, function parseEnum_block(token) {
                            if (token === "option") {
                                parseOption(enm, token);
                                skip(";");
                            }
                            else
                                parseEnumValue(enm, token);
                        });
                        parent.add(enm);
                    }
                    function parseEnumValue(parent, token) {
                        /* istanbul ignore if */
                        if (!nameRe.test(token))
                            throw illegal(token, "name");
                        skip("=");
                        var value = parseId(next(), true), dummy = {};
                        ifBlock(dummy, function parseEnumValue_block(token) {
                            /* istanbul ignore else */
                            if (token === "option") {
                                parseOption(dummy, token); // skip
                                skip(";");
                            }
                            else
                                throw illegal(token);
                        }, function parseEnumValue_line() {
                            parseInlineOptions(dummy); // skip
                        });
                        parent.add(token, value, dummy.comment);
                    }
                    function parseOption(parent, token) {
                        var isCustom = skip("(", true);
                        /* istanbul ignore if */
                        if (!typeRefRe.test(token = next()))
                            throw illegal(token, "name");
                        var name = token;
                        if (isCustom) {
                            skip(")");
                            name = "(" + name + ")";
                            token = peek();
                            if (fqTypeRefRe.test(token)) {
                                name += token;
                                next();
                            }
                        }
                        skip("=");
                        parseOptionValue(parent, name);
                    }
                    function parseOptionValue(parent, name) {
                        if (skip("{", true)) {
                            do {
                                /* istanbul ignore if */
                                if (!nameRe.test(token = next()))
                                    throw illegal(token, "name");
                                if (peek() === "{")
                                    parseOptionValue(parent, name + "." + token);
                                else {
                                    skip(":");
                                    setOption(parent, name + "." + token, readValue(true));
                                }
                            } while (!skip("}", true));
                        }
                        else
                            setOption(parent, name, readValue(true));
                        // Does not enforce a delimiter to be universal
                    }
                    function setOption(parent, name, value) {
                        if (parent.setOption)
                            parent.setOption(name, value);
                    }
                    function parseInlineOptions(parent) {
                        if (skip("[", true)) {
                            do {
                                parseOption(parent, "option");
                            } while (skip(",", true));
                            skip("]");
                        }
                        return parent;
                    }
                    function parseService(parent, token) {
                        /* istanbul ignore if */
                        if (!nameRe.test(token = next()))
                            throw illegal(token, "service name");
                        var service = new Service(token);
                        ifBlock(service, function parseService_block(token) {
                            if (parseCommon(service, token))
                                return;
                            /* istanbul ignore else */
                            if (token === "rpc")
                                parseMethod(service, token);
                            else
                                throw illegal(token);
                        });
                        parent.add(service);
                    }
                    function parseMethod(parent, token) {
                        var type = token;
                        /* istanbul ignore if */
                        if (!nameRe.test(token = next()))
                            throw illegal(token, "name");
                        var name = token, requestType, requestStream, responseType, responseStream;
                        skip("(");
                        if (skip("stream", true))
                            requestStream = true;
                        /* istanbul ignore if */
                        if (!typeRefRe.test(token = next()))
                            throw illegal(token);
                        requestType = token;
                        skip(")");
                        skip("returns");
                        skip("(");
                        if (skip("stream", true))
                            responseStream = true;
                        /* istanbul ignore if */
                        if (!typeRefRe.test(token = next()))
                            throw illegal(token);
                        responseType = token;
                        skip(")");
                        var method = new Method(name, type, requestType, responseType, requestStream, responseStream);
                        ifBlock(method, function parseMethod_block(token) {
                            /* istanbul ignore else */
                            if (token === "option") {
                                parseOption(method, token);
                                skip(";");
                            }
                            else
                                throw illegal(token);
                        });
                        parent.add(method);
                    }
                    function parseExtension(parent, token) {
                        /* istanbul ignore if */
                        if (!typeRefRe.test(token = next()))
                            throw illegal(token, "reference");
                        var reference = token;
                        ifBlock(null, function parseExtension_block(token) {
                            switch (token) {
                                case "required":
                                case "repeated":
                                case "optional":
                                    parseField(parent, token, reference);
                                    break;
                                default:
                                    /* istanbul ignore if */
                                    if (!isProto3 || !typeRefRe.test(token))
                                        throw illegal(token);
                                    push(token);
                                    parseField(parent, "optional", reference);
                                    break;
                            }
                        });
                    }
                    var token;
                    while ((token = next()) !== null) {
                        switch (token) {
                            case "package":
                                /* istanbul ignore if */
                                if (!head)
                                    throw illegal(token);
                                parsePackage();
                                break;
                            case "import":
                                /* istanbul ignore if */
                                if (!head)
                                    throw illegal(token);
                                parseImport();
                                break;
                            case "syntax":
                                /* istanbul ignore if */
                                if (!head)
                                    throw illegal(token);
                                parseSyntax();
                                break;
                            case "option":
                                /* istanbul ignore if */
                                if (!head)
                                    throw illegal(token);
                                parseOption(ptr, token);
                                skip(";");
                                break;
                            default:
                                /* istanbul ignore else */
                                if (parseCommon(ptr, token)) {
                                    head = false;
                                    continue;
                                }
                                /* istanbul ignore next */
                                throw illegal(token);
                        }
                    }
                    parse.filename = null;
                    return {
                        "package": pkg,
                        "imports": imports,
                        weakImports: weakImports,
                        syntax: syntax,
                        root: root
                    };
                }
                /**
                 * Parses the given .proto source and returns an object with the parsed contents.
                 * @name parse
                 * @function
                 * @param {string} source Source contents
                 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
                 * @returns {IParserResult} Parser result
                 * @property {string} filename=null Currently processing file name for error reporting, if known
                 * @property {IParseOptions} defaults Default {@link IParseOptions}
                 * @variation 2
                 */
            }, { "15": 15, "16": 16, "20": 20, "22": 22, "25": 25, "29": 29, "33": 33, "34": 34, "35": 35, "36": 36, "37": 37 }], 27: [function (require, module, exports) {
                "use strict";
                module.exports = Reader;
                var util = require(39);
                var BufferReader; // cyclic
                var LongBits = util.LongBits, utf8 = util.utf8;
                /* istanbul ignore next */
                function indexOutOfRange(reader, writeLength) {
                    return RangeError("index out of range: " + reader.pos + " + " + (writeLength || 1) + " > " + reader.len);
                }
                /**
                 * Constructs a new reader instance using the specified buffer.
                 * @classdesc Wire format reader using `Uint8Array` if available, otherwise `Array`.
                 * @constructor
                 * @param {Uint8Array} buffer Buffer to read from
                 */
                function Reader(buffer) {
                    /**
                     * Read buffer.
                     * @type {Uint8Array}
                     */
                    this.buf = buffer;
                    /**
                     * Read buffer position.
                     * @type {number}
                     */
                    this.pos = 0;
                    /**
                     * Read buffer length.
                     * @type {number}
                     */
                    this.len = buffer.length;
                }
                var create_array = typeof Uint8Array !== "undefined"
                    ? function create_typed_array(buffer) {
                        if (buffer instanceof Uint8Array || Array.isArray(buffer))
                            return new Reader(buffer);
                        throw Error("illegal buffer");
                    }
                    : function create_array(buffer) {
                        if (Array.isArray(buffer))
                            return new Reader(buffer);
                        throw Error("illegal buffer");
                    };
                /**
                 * Creates a new reader using the specified buffer.
                 * @function
                 * @param {Uint8Array|Buffer} buffer Buffer to read from
                 * @returns {Reader|BufferReader} A {@link BufferReader} if `buffer` is a Buffer, otherwise a {@link Reader}
                 * @throws {Error} If `buffer` is not a valid buffer
                 */
                Reader.create = util.Buffer
                    ? function create_buffer_setup(buffer) {
                        return (Reader.create = function create_buffer(buffer) {
                            return util.Buffer.isBuffer(buffer)
                                ? new BufferReader(buffer)
                                : create_array(buffer);
                        })(buffer);
                    }
                    : create_array;
                Reader.prototype._slice = util.Array.prototype.subarray || util.Array.prototype.slice;
                /**
                 * Reads a varint as an unsigned 32 bit value.
                 * @function
                 * @returns {number} Value read
                 */
                Reader.prototype.uint32 = (function read_uint32_setup() {
                    var value = 4294967295; // optimizer type-hint, tends to deopt otherwise (?!)
                    return function read_uint32() {
                        value = (this.buf[this.pos] & 127) >>> 0;
                        if (this.buf[this.pos++] < 128)
                            return value;
                        value = (value | (this.buf[this.pos] & 127) << 7) >>> 0;
                        if (this.buf[this.pos++] < 128)
                            return value;
                        value = (value | (this.buf[this.pos] & 127) << 14) >>> 0;
                        if (this.buf[this.pos++] < 128)
                            return value;
                        value = (value | (this.buf[this.pos] & 127) << 21) >>> 0;
                        if (this.buf[this.pos++] < 128)
                            return value;
                        value = (value | (this.buf[this.pos] & 15) << 28) >>> 0;
                        if (this.buf[this.pos++] < 128)
                            return value;
                        /* istanbul ignore if */
                        if ((this.pos += 5) > this.len) {
                            this.pos = this.len;
                            throw indexOutOfRange(this, 10);
                        }
                        return value;
                    };
                })();
                /**
                 * Reads a varint as a signed 32 bit value.
                 * @returns {number} Value read
                 */
                Reader.prototype.int32 = function read_int32() {
                    return this.uint32() | 0;
                };
                /**
                 * Reads a zig-zag encoded varint as a signed 32 bit value.
                 * @returns {number} Value read
                 */
                Reader.prototype.sint32 = function read_sint32() {
                    var value = this.uint32();
                    return value >>> 1 ^ -(value & 1) | 0;
                };
                /* eslint-disable no-invalid-this */
                function readLongVarint() {
                    // tends to deopt with local vars for octet etc.
                    var bits = new LongBits(0, 0);
                    var i = 0;
                    if (this.len - this.pos > 4) {
                        for (; i < 4; ++i) {
                            // 1st..4th
                            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
                            if (this.buf[this.pos++] < 128)
                                return bits;
                        }
                        // 5th
                        bits.lo = (bits.lo | (this.buf[this.pos] & 127) << 28) >>> 0;
                        bits.hi = (bits.hi | (this.buf[this.pos] & 127) >> 4) >>> 0;
                        if (this.buf[this.pos++] < 128)
                            return bits;
                        i = 0;
                    }
                    else {
                        for (; i < 3; ++i) {
                            /* istanbul ignore if */
                            if (this.pos >= this.len)
                                throw indexOutOfRange(this);
                            // 1st..3th
                            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
                            if (this.buf[this.pos++] < 128)
                                return bits;
                        }
                        // 4th
                        bits.lo = (bits.lo | (this.buf[this.pos++] & 127) << i * 7) >>> 0;
                        return bits;
                    }
                    if (this.len - this.pos > 4) {
                        for (; i < 5; ++i) {
                            // 6th..10th
                            bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
                            if (this.buf[this.pos++] < 128)
                                return bits;
                        }
                    }
                    else {
                        for (; i < 5; ++i) {
                            /* istanbul ignore if */
                            if (this.pos >= this.len)
                                throw indexOutOfRange(this);
                            // 6th..10th
                            bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
                            if (this.buf[this.pos++] < 128)
                                return bits;
                        }
                    }
                    /* istanbul ignore next */
                    throw Error("invalid varint encoding");
                }
                /* eslint-enable no-invalid-this */
                /**
                 * Reads a varint as a signed 64 bit value.
                 * @name Reader#int64
                 * @function
                 * @returns {Long} Value read
                 */
                /**
                 * Reads a varint as an unsigned 64 bit value.
                 * @name Reader#uint64
                 * @function
                 * @returns {Long} Value read
                 */
                /**
                 * Reads a zig-zag encoded varint as a signed 64 bit value.
                 * @name Reader#sint64
                 * @function
                 * @returns {Long} Value read
                 */
                /**
                 * Reads a varint as a boolean.
                 * @returns {boolean} Value read
                 */
                Reader.prototype.bool = function read_bool() {
                    return this.uint32() !== 0;
                };
                function readFixed32_end(buf, end) {
                    return (buf[end - 4]
                        | buf[end - 3] << 8
                        | buf[end - 2] << 16
                        | buf[end - 1] << 24) >>> 0;
                }
                /**
                 * Reads fixed 32 bits as an unsigned 32 bit integer.
                 * @returns {number} Value read
                 */
                Reader.prototype.fixed32 = function read_fixed32() {
                    /* istanbul ignore if */
                    if (this.pos + 4 > this.len)
                        throw indexOutOfRange(this, 4);
                    return readFixed32_end(this.buf, this.pos += 4);
                };
                /**
                 * Reads fixed 32 bits as a signed 32 bit integer.
                 * @returns {number} Value read
                 */
                Reader.prototype.sfixed32 = function read_sfixed32() {
                    /* istanbul ignore if */
                    if (this.pos + 4 > this.len)
                        throw indexOutOfRange(this, 4);
                    return readFixed32_end(this.buf, this.pos += 4) | 0;
                };
                /* eslint-disable no-invalid-this */
                function readFixed64() {
                    /* istanbul ignore if */
                    if (this.pos + 8 > this.len)
                        throw indexOutOfRange(this, 8);
                    return new LongBits(readFixed32_end(this.buf, this.pos += 4), readFixed32_end(this.buf, this.pos += 4));
                }
                /* eslint-enable no-invalid-this */
                /**
                 * Reads fixed 64 bits.
                 * @name Reader#fixed64
                 * @function
                 * @returns {Long} Value read
                 */
                /**
                 * Reads zig-zag encoded fixed 64 bits.
                 * @name Reader#sfixed64
                 * @function
                 * @returns {Long} Value read
                 */
                /**
                 * Reads a float (32 bit) as a number.
                 * @function
                 * @returns {number} Value read
                 */
                Reader.prototype.float = function read_float() {
                    /* istanbul ignore if */
                    if (this.pos + 4 > this.len)
                        throw indexOutOfRange(this, 4);
                    var value = util.float.readFloatLE(this.buf, this.pos);
                    this.pos += 4;
                    return value;
                };
                /**
                 * Reads a double (64 bit float) as a number.
                 * @function
                 * @returns {number} Value read
                 */
                Reader.prototype.double = function read_double() {
                    /* istanbul ignore if */
                    if (this.pos + 8 > this.len)
                        throw indexOutOfRange(this, 4);
                    var value = util.float.readDoubleLE(this.buf, this.pos);
                    this.pos += 8;
                    return value;
                };
                /**
                 * Reads a sequence of bytes preceeded by its length as a varint.
                 * @returns {Uint8Array} Value read
                 */
                Reader.prototype.bytes = function read_bytes() {
                    var length = this.uint32(), start = this.pos, end = this.pos + length;
                    /* istanbul ignore if */
                    if (end > this.len)
                        throw indexOutOfRange(this, length);
                    this.pos += length;
                    if (Array.isArray(this.buf))
                        return this.buf.slice(start, end);
                    return start === end // fix for IE 10/Win8 and others' subarray returning array of size 1
                        ? new this.buf.constructor(0)
                        : this._slice.call(this.buf, start, end);
                };
                /**
                 * Reads a string preceeded by its byte length as a varint.
                 * @returns {string} Value read
                 */
                Reader.prototype.string = function read_string() {
                    var bytes = this.bytes();
                    return utf8.read(bytes, 0, bytes.length);
                };
                /**
                 * Skips the specified number of bytes if specified, otherwise skips a varint.
                 * @param {number} [length] Length if known, otherwise a varint is assumed
                 * @returns {Reader} `this`
                 */
                Reader.prototype.skip = function skip(length) {
                    if (typeof length === "number") {
                        /* istanbul ignore if */
                        if (this.pos + length > this.len)
                            throw indexOutOfRange(this, length);
                        this.pos += length;
                    }
                    else {
                        do {
                            /* istanbul ignore if */
                            if (this.pos >= this.len)
                                throw indexOutOfRange(this);
                        } while (this.buf[this.pos++] & 128);
                    }
                    return this;
                };
                /**
                 * Skips the next element of the specified wire type.
                 * @param {number} wireType Wire type received
                 * @returns {Reader} `this`
                 */
                Reader.prototype.skipType = function (wireType) {
                    switch (wireType) {
                        case 0:
                            this.skip();
                            break;
                        case 1:
                            this.skip(8);
                            break;
                        case 2:
                            this.skip(this.uint32());
                            break;
                        case 3:
                            do {
                                if ((wireType = this.uint32() & 7) === 4)
                                    break;
                                this.skipType(wireType);
                            } while (true);
                            break;
                        case 5:
                            this.skip(4);
                            break;
                        /* istanbul ignore next */
                        default:
                            throw Error("invalid wire type " + wireType + " at offset " + this.pos);
                    }
                    return this;
                };
                Reader._configure = function (BufferReader_) {
                    BufferReader = BufferReader_;
                    var fn = util.Long ? "toLong" : "toNumber";
                    util.merge(Reader.prototype, {
                        int64: function read_int64() {
                            return readLongVarint.call(this)[fn](false);
                        },
                        uint64: function read_uint64() {
                            return readLongVarint.call(this)[fn](true);
                        },
                        sint64: function read_sint64() {
                            return readLongVarint.call(this).zzDecode()[fn](false);
                        },
                        fixed64: function read_fixed64() {
                            return readFixed64.call(this)[fn](true);
                        },
                        sfixed64: function read_sfixed64() {
                            return readFixed64.call(this)[fn](false);
                        }
                    });
                };
            }, { "39": 39 }], 28: [function (require, module, exports) {
                "use strict";
                module.exports = BufferReader;
                // extends Reader
                var Reader = require(27);
                (BufferReader.prototype = Object.create(Reader.prototype)).constructor = BufferReader;
                var util = require(39);
                /**
                 * Constructs a new buffer reader instance.
                 * @classdesc Wire format reader using node buffers.
                 * @extends Reader
                 * @constructor
                 * @param {Buffer} buffer Buffer to read from
                 */
                function BufferReader(buffer) {
                    Reader.call(this, buffer);
                    /**
                     * Read buffer.
                     * @name BufferReader#buf
                     * @type {Buffer}
                     */
                }
                /* istanbul ignore else */
                if (util.Buffer)
                    BufferReader.prototype._slice = util.Buffer.prototype.slice;
                /**
                 * @override
                 */
                BufferReader.prototype.string = function read_string_buffer() {
                    var len = this.uint32(); // modifies pos
                    return this.buf.utf8Slice(this.pos, this.pos = Math.min(this.pos + len, this.len));
                };
                /**
                 * Reads a sequence of bytes preceeded by its length as a varint.
                 * @name BufferReader#bytes
                 * @function
                 * @returns {Buffer} Value read
                 */
            }, { "27": 27, "39": 39 }], 29: [function (require, module, exports) {
                "use strict";
                module.exports = Root;
                // extends Namespace
                var Namespace = require(23);
                ((Root.prototype = Object.create(Namespace.prototype)).constructor = Root).className = "Root";
                var Field = require(16), Enum = require(15), OneOf = require(25), util = require(37);
                var Type, // cyclic
                parse, // might be excluded
                common; // "
                /**
                 * Constructs a new root namespace instance.
                 * @classdesc Root namespace wrapping all types, enums, services, sub-namespaces etc. that belong together.
                 * @extends NamespaceBase
                 * @constructor
                 * @param {Object.<string,*>} [options] Top level options
                 */
                function Root(options) {
                    Namespace.call(this, "", options);
                    /**
                     * Deferred extension fields.
                     * @type {Field[]}
                     */
                    this.deferred = [];
                    /**
                     * Resolved file names of loaded files.
                     * @type {string[]}
                     */
                    this.files = [];
                }
                /**
                 * Loads a namespace descriptor into a root namespace.
                 * @param {INamespace} json Nameespace descriptor
                 * @param {Root} [root] Root namespace, defaults to create a new one if omitted
                 * @returns {Root} Root namespace
                 */
                Root.fromJSON = function fromJSON(json, root) {
                    if (!root)
                        root = new Root();
                    if (json.options)
                        root.setOptions(json.options);
                    return root.addJSON(json.nested);
                };
                /**
                 * Resolves the path of an imported file, relative to the importing origin.
                 * This method exists so you can override it with your own logic in case your imports are scattered over multiple directories.
                 * @function
                 * @param {string} origin The file name of the importing file
                 * @param {string} target The file name being imported
                 * @returns {string|null} Resolved path to `target` or `null` to skip the file
                 */
                Root.prototype.resolvePath = util.path.resolve;
                // A symbol-like function to safely signal synchronous loading
                /* istanbul ignore next */
                function SYNC() { } // eslint-disable-line no-empty-function
                /**
                 * Loads one or multiple .proto or preprocessed .json files into this root namespace and calls the callback.
                 * @param {string|string[]} filename Names of one or multiple files to load
                 * @param {IParseOptions} options Parse options
                 * @param {LoadCallback} callback Callback function
                 * @returns {undefined}
                 */
                Root.prototype.load = function load(filename, options, callback) {
                    if (typeof options === "function") {
                        callback = options;
                        options = undefined;
                    }
                    var self = this;
                    if (!callback)
                        return util.asPromise(load, self, filename, options);
                    var sync = callback === SYNC; // undocumented
                    // Finishes loading by calling the callback (exactly once)
                    function finish(err, root) {
                        /* istanbul ignore if */
                        if (!callback)
                            return;
                        var cb = callback;
                        callback = null;
                        if (sync)
                            throw err;
                        cb(err, root);
                    }
                    // Processes a single file
                    function process(filename, source) {
                        try {
                            if (util.isString(source) && source.charAt(0) === "{")
                                source = JSON.parse(source);
                            if (!util.isString(source))
                                self.setOptions(source.options).addJSON(source.nested);
                            else {
                                parse.filename = filename;
                                var parsed = parse(source, self, options), resolved, i = 0;
                                if (parsed.imports)
                                    for (; i < parsed.imports.length; ++i)
                                        if (resolved = self.resolvePath(filename, parsed.imports[i]))
                                            fetch(resolved);
                                if (parsed.weakImports)
                                    for (i = 0; i < parsed.weakImports.length; ++i)
                                        if (resolved = self.resolvePath(filename, parsed.weakImports[i]))
                                            fetch(resolved, true);
                            }
                        }
                        catch (err) {
                            finish(err);
                        }
                        if (!sync && !queued)
                            finish(null, self); // only once anyway
                    }
                    // Fetches a single file
                    function fetch(filename, weak) {
                        // Strip path if this file references a bundled definition
                        var idx = filename.lastIndexOf("google/protobuf/");
                        if (idx > -1) {
                            var altname = filename.substring(idx);
                            if (altname in common)
                                filename = altname;
                        }
                        // Skip if already loaded / attempted
                        if (self.files.indexOf(filename) > -1)
                            return;
                        self.files.push(filename);
                        // Shortcut bundled definitions
                        if (filename in common) {
                            if (sync)
                                process(filename, common[filename]);
                            else {
                                ++queued;
                                setTimeout(function () {
                                    --queued;
                                    process(filename, common[filename]);
                                });
                            }
                            return;
                        }
                        // Otherwise fetch from disk or network
                        if (sync) {
                            var source;
                            try {
                                source = util.fs.readFileSync(filename).toString("utf8");
                            }
                            catch (err) {
                                if (!weak)
                                    finish(err);
                                return;
                            }
                            process(filename, source);
                        }
                        else {
                            ++queued;
                            util.fetch(filename, function (err, source) {
                                --queued;
                                /* istanbul ignore if */
                                if (!callback)
                                    return; // terminated meanwhile
                                if (err) {
                                    /* istanbul ignore else */
                                    if (!weak)
                                        finish(err);
                                    else if (!queued)
                                        finish(null, self);
                                    return;
                                }
                                process(filename, source);
                            });
                        }
                    }
                    var queued = 0;
                    // Assembling the root namespace doesn't require working type
                    // references anymore, so we can load everything in parallel
                    if (util.isString(filename))
                        filename = [filename];
                    for (var i = 0, resolved; i < filename.length; ++i)
                        if (resolved = self.resolvePath("", filename[i]))
                            fetch(resolved);
                    if (sync)
                        return self;
                    if (!queued)
                        finish(null, self);
                    return undefined;
                };
                // function load(filename:string, options:IParseOptions, callback:LoadCallback):undefined
                /**
                 * Loads one or multiple .proto or preprocessed .json files into this root namespace and calls the callback.
                 * @function Root#load
                 * @param {string|string[]} filename Names of one or multiple files to load
                 * @param {LoadCallback} callback Callback function
                 * @returns {undefined}
                 * @variation 2
                 */
                // function load(filename:string, callback:LoadCallback):undefined
                /**
                 * Loads one or multiple .proto or preprocessed .json files into this root namespace and returns a promise.
                 * @function Root#load
                 * @param {string|string[]} filename Names of one or multiple files to load
                 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
                 * @returns {Promise<Root>} Promise
                 * @variation 3
                 */
                // function load(filename:string, [options:IParseOptions]):Promise<Root>
                /**
                 * Synchronously loads one or multiple .proto or preprocessed .json files into this root namespace (node only).
                 * @function Root#loadSync
                 * @param {string|string[]} filename Names of one or multiple files to load
                 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
                 * @returns {Root} Root namespace
                 * @throws {Error} If synchronous fetching is not supported (i.e. in browsers) or if a file's syntax is invalid
                 */
                Root.prototype.loadSync = function loadSync(filename, options) {
                    if (!util.isNode)
                        throw Error("not supported");
                    return this.load(filename, options, SYNC);
                };
                /**
                 * @override
                 */
                Root.prototype.resolveAll = function resolveAll() {
                    if (this.deferred.length)
                        throw Error("unresolvable extensions: " + this.deferred.map(function (field) {
                            return "'extend " + field.extend + "' in " + field.parent.fullName;
                        }).join(", "));
                    return Namespace.prototype.resolveAll.call(this);
                };
                // only uppercased (and thus conflict-free) children are exposed, see below
                var exposeRe = /^[A-Z]/;
                /**
                 * Handles a deferred declaring extension field by creating a sister field to represent it within its extended type.
                 * @param {Root} root Root instance
                 * @param {Field} field Declaring extension field witin the declaring type
                 * @returns {boolean} `true` if successfully added to the extended type, `false` otherwise
                 * @inner
                 * @ignore
                 */
                function tryHandleExtension(root, field) {
                    var extendedType = field.parent.lookup(field.extend);
                    if (extendedType) {
                        var sisterField = new Field(field.fullName, field.id, field.type, field.rule, undefined, field.options);
                        sisterField.declaringField = field;
                        field.extensionField = sisterField;
                        extendedType.add(sisterField);
                        return true;
                    }
                    return false;
                }
                /**
                 * Called when any object is added to this root or its sub-namespaces.
                 * @param {ReflectionObject} object Object added
                 * @returns {undefined}
                 * @private
                 */
                Root.prototype._handleAdd = function _handleAdd(object) {
                    if (object instanceof Field) {
                        if (object.extend !== undefined && !object.extensionField)
                            if (!tryHandleExtension(this, object))
                                this.deferred.push(object);
                    }
                    else if (object instanceof Enum) {
                        if (exposeRe.test(object.name))
                            object.parent[object.name] = object.values; // expose enum values as property of its parent
                    }
                    else if (!(object instanceof OneOf)) {
                        if (object instanceof Type)
                            for (var i = 0; i < this.deferred.length;)
                                if (tryHandleExtension(this, this.deferred[i]))
                                    this.deferred.splice(i, 1);
                                else
                                    ++i;
                        for (var j = 0; j < object.nestedArray.length; ++j)
                            this._handleAdd(object._nestedArray[j]);
                        if (exposeRe.test(object.name))
                            object.parent[object.name] = object; // expose namespace as property of its parent
                    }
                    // The above also adds uppercased (and thus conflict-free) nested types, services and enums as
                    // properties of namespaces just like static code does. This allows using a .d.ts generated for
                    // a static module with reflection-based solutions where the condition is met.
                };
                /**
                 * Called when any object is removed from this root or its sub-namespaces.
                 * @param {ReflectionObject} object Object removed
                 * @returns {undefined}
                 * @private
                 */
                Root.prototype._handleRemove = function _handleRemove(object) {
                    if (object instanceof Field) {
                        if (object.extend !== undefined) {
                            if (object.extensionField) {
                                object.extensionField.parent.remove(object.extensionField);
                                object.extensionField = null;
                            }
                            else {
                                var index = this.deferred.indexOf(object);
                                /* istanbul ignore else */
                                if (index > -1)
                                    this.deferred.splice(index, 1);
                            }
                        }
                    }
                    else if (object instanceof Enum) {
                        if (exposeRe.test(object.name))
                            delete object.parent[object.name]; // unexpose enum values
                    }
                    else if (object instanceof Namespace) {
                        for (var i = 0; i < object.nestedArray.length; ++i)
                            this._handleRemove(object._nestedArray[i]);
                        if (exposeRe.test(object.name))
                            delete object.parent[object.name]; // unexpose namespaces
                    }
                };
                Root._configure = function (Type_, parse_, common_) {
                    Type = Type_;
                    parse = parse_;
                    common = common_;
                };
            }, { "15": 15, "16": 16, "23": 23, "25": 25, "37": 37 }], 30: [function (require, module, exports) {
                "use strict";
                module.exports = {};
                /**
                 * Named roots.
                 * This is where pbjs stores generated structures (the option `-r, --root` specifies a name).
                 * Can also be used manually to make roots available accross modules.
                 * @name roots
                 * @type {Object.<string,Root>}
                 * @example
                 * // pbjs -r myroot -o compiled.js ...
                 *
                 * // in another module:
                 * require("./compiled.js");
                 *
                 * // in any subsequent module:
                 * var root = protobuf.roots["myroot"];
                 */
            }, {}], 31: [function (require, module, exports) {
                "use strict";
                /**
                 * Streaming RPC helpers.
                 * @namespace
                 */
                var rpc = exports;
                /**
                 * RPC implementation passed to {@link Service#create} performing a service request on network level, i.e. by utilizing http requests or websockets.
                 * @typedef RPCImpl
                 * @type {function}
                 * @param {Method|rpc.ServiceMethod<Message<{}>,Message<{}>>} method Reflected or static method being called
                 * @param {Uint8Array} requestData Request data
                 * @param {RPCImplCallback} callback Callback function
                 * @returns {undefined}
                 * @example
                 * function rpcImpl(method, requestData, callback) {
                 *     if (protobuf.util.lcFirst(method.name) !== "myMethod") // compatible with static code
                 *         throw Error("no such method");
                 *     asynchronouslyObtainAResponse(requestData, function(err, responseData) {
                 *         callback(err, responseData);
                 *     });
                 * }
                 */
                /**
                 * Node-style callback as used by {@link RPCImpl}.
                 * @typedef RPCImplCallback
                 * @type {function}
                 * @param {Error|null} error Error, if any, otherwise `null`
                 * @param {Uint8Array|null} [response] Response data or `null` to signal end of stream, if there hasn't been an error
                 * @returns {undefined}
                 */
                rpc.Service = require(32);
            }, { "32": 32 }], 32: [function (require, module, exports) {
                "use strict";
                module.exports = Service;
                var util = require(39);
                // Extends EventEmitter
                (Service.prototype = Object.create(util.EventEmitter.prototype)).constructor = Service;
                /**
                 * A service method callback as used by {@link rpc.ServiceMethod|ServiceMethod}.
                 *
                 * Differs from {@link RPCImplCallback} in that it is an actual callback of a service method which may not return `response = null`.
                 * @typedef rpc.ServiceMethodCallback
                 * @template TRes extends Message<TRes>
                 * @type {function}
                 * @param {Error|null} error Error, if any
                 * @param {TRes} [response] Response message
                 * @returns {undefined}
                 */
                /**
                 * A service method part of a {@link rpc.Service} as created by {@link Service.create}.
                 * @typedef rpc.ServiceMethod
                 * @template TReq extends Message<TReq>
                 * @template TRes extends Message<TRes>
                 * @type {function}
                 * @param {TReq|Properties<TReq>} request Request message or plain object
                 * @param {rpc.ServiceMethodCallback<TRes>} [callback] Node-style callback called with the error, if any, and the response message
                 * @returns {Promise<Message<TRes>>} Promise if `callback` has been omitted, otherwise `undefined`
                 */
                /**
                 * Constructs a new RPC service instance.
                 * @classdesc An RPC service as returned by {@link Service#create}.
                 * @exports rpc.Service
                 * @extends util.EventEmitter
                 * @constructor
                 * @param {RPCImpl} rpcImpl RPC implementation
                 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
                 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
                 */
                function Service(rpcImpl, requestDelimited, responseDelimited) {
                    if (typeof rpcImpl !== "function")
                        throw TypeError("rpcImpl must be a function");
                    util.EventEmitter.call(this);
                    /**
                     * RPC implementation. Becomes `null` once the service is ended.
                     * @type {RPCImpl|null}
                     */
                    this.rpcImpl = rpcImpl;
                    /**
                     * Whether requests are length-delimited.
                     * @type {boolean}
                     */
                    this.requestDelimited = Boolean(requestDelimited);
                    /**
                     * Whether responses are length-delimited.
                     * @type {boolean}
                     */
                    this.responseDelimited = Boolean(responseDelimited);
                }
                /**
                 * Calls a service method through {@link rpc.Service#rpcImpl|rpcImpl}.
                 * @param {Method|rpc.ServiceMethod<TReq,TRes>} method Reflected or static method
                 * @param {Constructor<TReq>} requestCtor Request constructor
                 * @param {Constructor<TRes>} responseCtor Response constructor
                 * @param {TReq|Properties<TReq>} request Request message or plain object
                 * @param {rpc.ServiceMethodCallback<TRes>} callback Service callback
                 * @returns {undefined}
                 * @template TReq extends Message<TReq>
                 * @template TRes extends Message<TRes>
                 */
                Service.prototype.rpcCall = function rpcCall(method, requestCtor, responseCtor, request, callback) {
                    if (!request)
                        throw TypeError("request must be specified");
                    var self = this;
                    if (!callback)
                        return util.asPromise(rpcCall, self, method, requestCtor, responseCtor, request);
                    if (!self.rpcImpl) {
                        setTimeout(function () { callback(Error("already ended")); }, 0);
                        return undefined;
                    }
                    try {
                        return self.rpcImpl(method, requestCtor[self.requestDelimited ? "encodeDelimited" : "encode"](request).finish(), function rpcCallback(err, response) {
                            if (err) {
                                self.emit("error", err, method);
                                return callback(err);
                            }
                            if (response === null) {
                                self.end(/* endedByRPC */ true);
                                return undefined;
                            }
                            if (!(response instanceof responseCtor)) {
                                try {
                                    response = responseCtor[self.responseDelimited ? "decodeDelimited" : "decode"](response);
                                }
                                catch (err) {
                                    self.emit("error", err, method);
                                    return callback(err);
                                }
                            }
                            self.emit("data", response, method);
                            return callback(null, response);
                        });
                    }
                    catch (err) {
                        self.emit("error", err, method);
                        setTimeout(function () { callback(err); }, 0);
                        return undefined;
                    }
                };
                /**
                 * Ends this service and emits the `end` event.
                 * @param {boolean} [endedByRPC=false] Whether the service has been ended by the RPC implementation.
                 * @returns {rpc.Service} `this`
                 */
                Service.prototype.end = function end(endedByRPC) {
                    if (this.rpcImpl) {
                        if (!endedByRPC)
                            this.rpcImpl(null, null, null);
                        this.rpcImpl = null;
                        this.emit("end").off();
                    }
                    return this;
                };
            }, { "39": 39 }], 33: [function (require, module, exports) {
                "use strict";
                module.exports = Service;
                // extends Namespace
                var Namespace = require(23);
                ((Service.prototype = Object.create(Namespace.prototype)).constructor = Service).className = "Service";
                var Method = require(22), util = require(37), rpc = require(31);
                /**
                 * Constructs a new service instance.
                 * @classdesc Reflected service.
                 * @extends NamespaceBase
                 * @constructor
                 * @param {string} name Service name
                 * @param {Object.<string,*>} [options] Service options
                 * @throws {TypeError} If arguments are invalid
                 */
                function Service(name, options) {
                    Namespace.call(this, name, options);
                    /**
                     * Service methods.
                     * @type {Object.<string,Method>}
                     */
                    this.methods = {}; // toJSON, marker
                    /**
                     * Cached methods as an array.
                     * @type {Method[]|null}
                     * @private
                     */
                    this._methodsArray = null;
                }
                /**
                 * Service descriptor.
                 * @interface IService
                 * @extends INamespace
                 * @property {Object.<string,IMethod>} methods Method descriptors
                 */
                /**
                 * Constructs a service from a service descriptor.
                 * @param {string} name Service name
                 * @param {IService} json Service descriptor
                 * @returns {Service} Created service
                 * @throws {TypeError} If arguments are invalid
                 */
                Service.fromJSON = function fromJSON(name, json) {
                    var service = new Service(name, json.options);
                    /* istanbul ignore else */
                    if (json.methods)
                        for (var names = Object.keys(json.methods), i = 0; i < names.length; ++i)
                            service.add(Method.fromJSON(names[i], json.methods[names[i]]));
                    if (json.nested)
                        service.addJSON(json.nested);
                    return service;
                };
                /**
                 * Converts this service to a service descriptor.
                 * @returns {IService} Service descriptor
                 */
                Service.prototype.toJSON = function toJSON() {
                    var inherited = Namespace.prototype.toJSON.call(this);
                    return util.toObject([
                        "options", inherited && inherited.options || undefined,
                        "methods", Namespace.arrayToJSON(this.methodsArray) || {},
                        "nested", inherited && inherited.nested || undefined
                    ]);
                };
                /**
                 * Methods of this service as an array for iteration.
                 * @name Service#methodsArray
                 * @type {Method[]}
                 * @readonly
                 */
                Object.defineProperty(Service.prototype, "methodsArray", {
                    get: function () {
                        return this._methodsArray || (this._methodsArray = util.toArray(this.methods));
                    }
                });
                function clearCache(service) {
                    service._methodsArray = null;
                    return service;
                }
                /**
                 * @override
                 */
                Service.prototype.get = function get(name) {
                    return this.methods[name]
                        || Namespace.prototype.get.call(this, name);
                };
                /**
                 * @override
                 */
                Service.prototype.resolveAll = function resolveAll() {
                    var methods = this.methodsArray;
                    for (var i = 0; i < methods.length; ++i)
                        methods[i].resolve();
                    return Namespace.prototype.resolve.call(this);
                };
                /**
                 * @override
                 */
                Service.prototype.add = function add(object) {
                    /* istanbul ignore if */
                    if (this.get(object.name))
                        throw Error("duplicate name '" + object.name + "' in " + this);
                    if (object instanceof Method) {
                        this.methods[object.name] = object;
                        object.parent = this;
                        return clearCache(this);
                    }
                    return Namespace.prototype.add.call(this, object);
                };
                /**
                 * @override
                 */
                Service.prototype.remove = function remove(object) {
                    if (object instanceof Method) {
                        /* istanbul ignore if */
                        if (this.methods[object.name] !== object)
                            throw Error(object + " is not a member of " + this);
                        delete this.methods[object.name];
                        object.parent = null;
                        return clearCache(this);
                    }
                    return Namespace.prototype.remove.call(this, object);
                };
                /**
                 * Creates a runtime service using the specified rpc implementation.
                 * @param {RPCImpl} rpcImpl RPC implementation
                 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
                 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
                 * @returns {rpc.Service} RPC service. Useful where requests and/or responses are streamed.
                 */
                Service.prototype.create = function create(rpcImpl, requestDelimited, responseDelimited) {
                    var rpcService = new rpc.Service(rpcImpl, requestDelimited, responseDelimited);
                    for (var i = 0, method; i < this.methodsArray.length; ++i) {
                        rpcService[util.lcFirst((method = this._methodsArray[i]).resolve().name)] = util.codegen(["r", "c"], util.lcFirst(method.name))("return this.rpcCall(m,q,s,r,c)")({
                            m: method,
                            q: method.resolvedRequestType.ctor,
                            s: method.resolvedResponseType.ctor
                        });
                    }
                    return rpcService;
                };
            }, { "22": 22, "23": 23, "31": 31, "37": 37 }], 34: [function (require, module, exports) {
                "use strict";
                module.exports = tokenize;
                var delimRe = /[\s{}=;:[\],'"()<>]/g, stringDoubleRe = /(?:"([^"\\]*(?:\\.[^"\\]*)*)")/g, stringSingleRe = /(?:'([^'\\]*(?:\\.[^'\\]*)*)')/g;
                var setCommentRe = /^ *[*/]+ */, setCommentSplitRe = /\n/g, whitespaceRe = /\s/, unescapeRe = /\\(.?)/g;
                var unescapeMap = {
                    "0": "\0",
                    "r": "\r",
                    "n": "\n",
                    "t": "\t"
                };
                /**
                 * Unescapes a string.
                 * @param {string} str String to unescape
                 * @returns {string} Unescaped string
                 * @property {Object.<string,string>} map Special characters map
                 * @memberof tokenize
                 */
                function unescape(str) {
                    return str.replace(unescapeRe, function ($0, $1) {
                        switch ($1) {
                            case "\\":
                            case "":
                                return $1;
                            default:
                                return unescapeMap[$1] || "";
                        }
                    });
                }
                tokenize.unescape = unescape;
                /**
                 * Gets the next token and advances.
                 * @typedef TokenizerHandleNext
                 * @type {function}
                 * @returns {string|null} Next token or `null` on eof
                 */
                /**
                 * Peeks for the next token.
                 * @typedef TokenizerHandlePeek
                 * @type {function}
                 * @returns {string|null} Next token or `null` on eof
                 */
                /**
                 * Pushes a token back to the stack.
                 * @typedef TokenizerHandlePush
                 * @type {function}
                 * @param {string} token Token
                 * @returns {undefined}
                 */
                /**
                 * Skips the next token.
                 * @typedef TokenizerHandleSkip
                 * @type {function}
                 * @param {string} expected Expected token
                 * @param {boolean} [optional=false] If optional
                 * @returns {boolean} Whether the token matched
                 * @throws {Error} If the token didn't match and is not optional
                 */
                /**
                 * Gets the comment on the previous line or, alternatively, the line comment on the specified line.
                 * @typedef TokenizerHandleCmnt
                 * @type {function}
                 * @param {number} [line] Line number
                 * @returns {string|null} Comment text or `null` if none
                 */
                /**
                 * Handle object returned from {@link tokenize}.
                 * @interface ITokenizerHandle
                 * @property {TokenizerHandleNext} next Gets the next token and advances (`null` on eof)
                 * @property {TokenizerHandlePeek} peek Peeks for the next token (`null` on eof)
                 * @property {TokenizerHandlePush} push Pushes a token back to the stack
                 * @property {TokenizerHandleSkip} skip Skips a token, returns its presence and advances or, if non-optional and not present, throws
                 * @property {TokenizerHandleCmnt} cmnt Gets the comment on the previous line or the line comment on the specified line, if any
                 * @property {number} line Current line number
                 */
                /**
                 * Tokenizes the given .proto source and returns an object with useful utility functions.
                 * @param {string} source Source contents
                 * @returns {ITokenizerHandle} Tokenizer handle
                 */
                function tokenize(source) {
                    /* eslint-disable callback-return */
                    source = source.toString();
                    var offset = 0, length = source.length, line = 1, commentType = null, commentText = null, commentLine = 0, commentLineEmpty = false;
                    var stack = [];
                    var stringDelim = null;
                    /* istanbul ignore next */
                    /**
                     * Creates an error for illegal syntax.
                     * @param {string} subject Subject
                     * @returns {Error} Error created
                     * @inner
                     */
                    function illegal(subject) {
                        return Error("illegal " + subject + " (line " + line + ")");
                    }
                    /**
                     * Reads a string till its end.
                     * @returns {string} String read
                     * @inner
                     */
                    function readString() {
                        var re = stringDelim === "'" ? stringSingleRe : stringDoubleRe;
                        re.lastIndex = offset - 1;
                        var match = re.exec(source);
                        if (!match)
                            throw illegal("string");
                        offset = re.lastIndex;
                        push(stringDelim);
                        stringDelim = null;
                        return unescape(match[1]);
                    }
                    /**
                     * Gets the character at `pos` within the source.
                     * @param {number} pos Position
                     * @returns {string} Character
                     * @inner
                     */
                    function charAt(pos) {
                        return source.charAt(pos);
                    }
                    /**
                     * Sets the current comment text.
                     * @param {number} start Start offset
                     * @param {number} end End offset
                     * @returns {undefined}
                     * @inner
                     */
                    function setComment(start, end) {
                        commentType = source.charAt(start++);
                        commentLine = line;
                        commentLineEmpty = false;
                        var offset = start - 3, // "///" or "/**"
                        c;
                        do {
                            if (--offset < 0 || (c = source.charAt(offset)) === "\n") {
                                commentLineEmpty = true;
                                break;
                            }
                        } while (c === " " || c === "\t");
                        var lines = source
                            .substring(start, end)
                            .split(setCommentSplitRe);
                        for (var i = 0; i < lines.length; ++i)
                            lines[i] = lines[i].replace(setCommentRe, "").trim();
                        commentText = lines
                            .join("\n")
                            .trim();
                    }
                    /**
                     * Obtains the next token.
                     * @returns {string|null} Next token or `null` on eof
                     * @inner
                     */
                    function next() {
                        if (stack.length > 0)
                            return stack.shift();
                        if (stringDelim)
                            return readString();
                        var repeat, prev, curr, start, isDoc;
                        do {
                            if (offset === length)
                                return null;
                            repeat = false;
                            while (whitespaceRe.test(curr = charAt(offset))) {
                                if (curr === "\n")
                                    ++line;
                                if (++offset === length)
                                    return null;
                            }
                            if (charAt(offset) === "/") {
                                if (++offset === length)
                                    throw illegal("comment");
                                if (charAt(offset) === "/") {
                                    isDoc = charAt(start = offset + 1) === "/";
                                    while (charAt(++offset) !== "\n")
                                        if (offset === length)
                                            return null;
                                    ++offset;
                                    if (isDoc)
                                        setComment(start, offset - 1);
                                    ++line;
                                    repeat = true;
                                }
                                else if ((curr = charAt(offset)) === "*") {
                                    isDoc = charAt(start = offset + 1) === "*";
                                    do {
                                        if (curr === "\n")
                                            ++line;
                                        if (++offset === length)
                                            throw illegal("comment");
                                        prev = curr;
                                        curr = charAt(offset);
                                    } while (prev !== "*" || curr !== "/");
                                    ++offset;
                                    if (isDoc)
                                        setComment(start, offset - 2);
                                    repeat = true;
                                }
                                else
                                    return "/";
                            }
                        } while (repeat);
                        // offset !== length if we got here
                        var end = offset;
                        delimRe.lastIndex = 0;
                        var delim = delimRe.test(charAt(end++));
                        if (!delim)
                            while (end < length && !delimRe.test(charAt(end)))
                                ++end;
                        var token = source.substring(offset, offset = end);
                        if (token === "\"" || token === "'")
                            stringDelim = token;
                        return token;
                    }
                    /**
                     * Pushes a token back to the stack.
                     * @param {string} token Token
                     * @returns {undefined}
                     * @inner
                     */
                    function push(token) {
                        stack.push(token);
                    }
                    /**
                     * Peeks for the next token.
                     * @returns {string|null} Token or `null` on eof
                     * @inner
                     */
                    function peek() {
                        if (!stack.length) {
                            var token = next();
                            if (token === null)
                                return null;
                            push(token);
                        }
                        return stack[0];
                    }
                    /**
                     * Skips a token.
                     * @param {string} expected Expected token
                     * @param {boolean} [optional=false] Whether the token is optional
                     * @returns {boolean} `true` when skipped, `false` if not
                     * @throws {Error} When a required token is not present
                     * @inner
                     */
                    function skip(expected, optional) {
                        var actual = peek(), equals = actual === expected;
                        if (equals) {
                            next();
                            return true;
                        }
                        if (!optional)
                            throw illegal("token '" + actual + "', '" + expected + "' expected");
                        return false;
                    }
                    /**
                     * Gets a comment.
                     * @param {number} [trailingLine] Line number if looking for a trailing comment
                     * @returns {string|null} Comment text
                     * @inner
                     */
                    function cmnt(trailingLine) {
                        var ret = null;
                        if (trailingLine === undefined) {
                            if (commentLine === line - 1 && (commentType === "*" || commentLineEmpty))
                                ret = commentText;
                        }
                        else {
                            /* istanbul ignore else */
                            if (commentLine < trailingLine)
                                peek();
                            if (commentLine === trailingLine && !commentLineEmpty && commentType === "/")
                                ret = commentText;
                        }
                        return ret;
                    }
                    return Object.defineProperty({
                        next: next,
                        peek: peek,
                        push: push,
                        skip: skip,
                        cmnt: cmnt
                    }, "line", {
                        get: function () { return line; }
                    });
                    /* eslint-enable callback-return */
                }
            }, {}], 35: [function (require, module, exports) {
                "use strict";
                module.exports = Type;
                // extends Namespace
                var Namespace = require(23);
                ((Type.prototype = Object.create(Namespace.prototype)).constructor = Type).className = "Type";
                var Enum = require(15), OneOf = require(25), Field = require(16), MapField = require(20), Service = require(33), Message = require(21), Reader = require(27), Writer = require(42), util = require(37), encoder = require(14), decoder = require(13), verifier = require(40), converter = require(12), wrappers = require(41);
                /**
                 * Constructs a new reflected message type instance.
                 * @classdesc Reflected message type.
                 * @extends NamespaceBase
                 * @constructor
                 * @param {string} name Message name
                 * @param {Object.<string,*>} [options] Declared options
                 */
                function Type(name, options) {
                    Namespace.call(this, name, options);
                    /**
                     * Message fields.
                     * @type {Object.<string,Field>}
                     */
                    this.fields = {}; // toJSON, marker
                    /**
                     * Oneofs declared within this namespace, if any.
                     * @type {Object.<string,OneOf>}
                     */
                    this.oneofs = undefined; // toJSON
                    /**
                     * Extension ranges, if any.
                     * @type {number[][]}
                     */
                    this.extensions = undefined; // toJSON
                    /**
                     * Reserved ranges, if any.
                     * @type {Array.<number[]|string>}
                     */
                    this.reserved = undefined; // toJSON
                    /*?
                     * Whether this type is a legacy group.
                     * @type {boolean|undefined}
                     */
                    this.group = undefined; // toJSON
                    /**
                     * Cached fields by id.
                     * @type {Object.<number,Field>|null}
                     * @private
                     */
                    this._fieldsById = null;
                    /**
                     * Cached fields as an array.
                     * @type {Field[]|null}
                     * @private
                     */
                    this._fieldsArray = null;
                    /**
                     * Cached oneofs as an array.
                     * @type {OneOf[]|null}
                     * @private
                     */
                    this._oneofsArray = null;
                    /**
                     * Cached constructor.
                     * @type {Constructor<{}>}
                     * @private
                     */
                    this._ctor = null;
                }
                Object.defineProperties(Type.prototype, {
                    /**
                     * Message fields by id.
                     * @name Type#fieldsById
                     * @type {Object.<number,Field>}
                     * @readonly
                     */
                    fieldsById: {
                        get: function () {
                            /* istanbul ignore if */
                            if (this._fieldsById)
                                return this._fieldsById;
                            this._fieldsById = {};
                            for (var names = Object.keys(this.fields), i = 0; i < names.length; ++i) {
                                var field = this.fields[names[i]], id = field.id;
                                /* istanbul ignore if */
                                if (this._fieldsById[id])
                                    throw Error("duplicate id " + id + " in " + this);
                                this._fieldsById[id] = field;
                            }
                            return this._fieldsById;
                        }
                    },
                    /**
                     * Fields of this message as an array for iteration.
                     * @name Type#fieldsArray
                     * @type {Field[]}
                     * @readonly
                     */
                    fieldsArray: {
                        get: function () {
                            return this._fieldsArray || (this._fieldsArray = util.toArray(this.fields));
                        }
                    },
                    /**
                     * Oneofs of this message as an array for iteration.
                     * @name Type#oneofsArray
                     * @type {OneOf[]}
                     * @readonly
                     */
                    oneofsArray: {
                        get: function () {
                            return this._oneofsArray || (this._oneofsArray = util.toArray(this.oneofs));
                        }
                    },
                    /**
                     * The registered constructor, if any registered, otherwise a generic constructor.
                     * Assigning a function replaces the internal constructor. If the function does not extend {@link Message} yet, its prototype will be setup accordingly and static methods will be populated. If it already extends {@link Message}, it will just replace the internal constructor.
                     * @name Type#ctor
                     * @type {Constructor<{}>}
                     */
                    ctor: {
                        get: function () {
                            return this._ctor || (this.ctor = Type.generateConstructor(this)());
                        },
                        set: function (ctor) {
                            // Ensure proper prototype
                            var prototype = ctor.prototype;
                            if (!(prototype instanceof Message)) {
                                (ctor.prototype = new Message()).constructor = ctor;
                                util.merge(ctor.prototype, prototype);
                            }
                            // Classes and messages reference their reflected type
                            ctor.$type = ctor.prototype.$type = this;
                            // Mix in static methods
                            util.merge(ctor, Message, true);
                            this._ctor = ctor;
                            // Messages have non-enumerable default values on their prototype
                            var i = 0;
                            for (; i < this.fieldsArray.length; ++i)
                                this._fieldsArray[i].resolve(); // ensures a proper value
                            // Messages have non-enumerable getters and setters for each virtual oneof field
                            var ctorProperties = {};
                            for (i = 0; i < this.oneofsArray.length; ++i)
                                ctorProperties[this._oneofsArray[i].resolve().name] = {
                                    get: util.oneOfGetter(this._oneofsArray[i].oneof),
                                    set: util.oneOfSetter(this._oneofsArray[i].oneof)
                                };
                            if (i)
                                Object.defineProperties(ctor.prototype, ctorProperties);
                        }
                    }
                });
                /**
                 * Generates a constructor function for the specified type.
                 * @param {Type} mtype Message type
                 * @returns {Codegen} Codegen instance
                 */
                Type.generateConstructor = function generateConstructor(mtype) {
                    /* eslint-disable no-unexpected-multiline */
                    var gen = util.codegen(["p"], mtype.name);
                    // explicitly initialize mutable object/array fields so that these aren't just inherited from the prototype
                    for (var i = 0, field; i < mtype.fieldsArray.length; ++i)
                        if ((field = mtype._fieldsArray[i]).map)
                            gen("this%s={}", util.safeProp(field.name));
                        else if (field.repeated)
                            gen("this%s=[]", util.safeProp(field.name));
                    return gen("if(p)for(var ks=Object.keys(p),i=0;i<ks.length;++i)if(p[ks[i]]!=null)") // omit undefined or null
                    ("this[ks[i]]=p[ks[i]]");
                    /* eslint-enable no-unexpected-multiline */
                };
                function clearCache(type) {
                    type._fieldsById = type._fieldsArray = type._oneofsArray = null;
                    delete type.encode;
                    delete type.decode;
                    delete type.verify;
                    return type;
                }
                /**
                 * Message type descriptor.
                 * @interface IType
                 * @extends INamespace
                 * @property {Object.<string,IOneOf>} [oneofs] Oneof descriptors
                 * @property {Object.<string,IField>} fields Field descriptors
                 * @property {number[][]} [extensions] Extension ranges
                 * @property {number[][]} [reserved] Reserved ranges
                 * @property {boolean} [group=false] Whether a legacy group or not
                 */
                /**
                 * Creates a message type from a message type descriptor.
                 * @param {string} name Message name
                 * @param {IType} json Message type descriptor
                 * @returns {Type} Created message type
                 */
                Type.fromJSON = function fromJSON(name, json) {
                    var type = new Type(name, json.options);
                    type.extensions = json.extensions;
                    type.reserved = json.reserved;
                    var names = Object.keys(json.fields), i = 0;
                    for (; i < names.length; ++i)
                        type.add((typeof json.fields[names[i]].keyType !== "undefined"
                            ? MapField.fromJSON
                            : Field.fromJSON)(names[i], json.fields[names[i]]));
                    if (json.oneofs)
                        for (names = Object.keys(json.oneofs), i = 0; i < names.length; ++i)
                            type.add(OneOf.fromJSON(names[i], json.oneofs[names[i]]));
                    if (json.nested)
                        for (names = Object.keys(json.nested), i = 0; i < names.length; ++i) {
                            var nested = json.nested[names[i]];
                            type.add(// most to least likely
                            (nested.id !== undefined
                                ? Field.fromJSON
                                : nested.fields !== undefined
                                    ? Type.fromJSON
                                    : nested.values !== undefined
                                        ? Enum.fromJSON
                                        : nested.methods !== undefined
                                            ? Service.fromJSON
                                            : Namespace.fromJSON)(names[i], nested));
                        }
                    if (json.extensions && json.extensions.length)
                        type.extensions = json.extensions;
                    if (json.reserved && json.reserved.length)
                        type.reserved = json.reserved;
                    if (json.group)
                        type.group = true;
                    return type;
                };
                /**
                 * Converts this message type to a message type descriptor.
                 * @returns {IType} Message type descriptor
                 */
                Type.prototype.toJSON = function toJSON() {
                    var inherited = Namespace.prototype.toJSON.call(this);
                    return util.toObject([
                        "options", inherited && inherited.options || undefined,
                        "oneofs", Namespace.arrayToJSON(this.oneofsArray),
                        "fields", Namespace.arrayToJSON(this.fieldsArray.filter(function (obj) { return !obj.declaringField; })) || {},
                        "extensions", this.extensions && this.extensions.length ? this.extensions : undefined,
                        "reserved", this.reserved && this.reserved.length ? this.reserved : undefined,
                        "group", this.group || undefined,
                        "nested", inherited && inherited.nested || undefined
                    ]);
                };
                /**
                 * @override
                 */
                Type.prototype.resolveAll = function resolveAll() {
                    var fields = this.fieldsArray, i = 0;
                    while (i < fields.length)
                        fields[i++].resolve();
                    var oneofs = this.oneofsArray;
                    i = 0;
                    while (i < oneofs.length)
                        oneofs[i++].resolve();
                    return Namespace.prototype.resolveAll.call(this);
                };
                /**
                 * @override
                 */
                Type.prototype.get = function get(name) {
                    return this.fields[name]
                        || this.oneofs && this.oneofs[name]
                        || this.nested && this.nested[name]
                        || null;
                };
                /**
                 * Adds a nested object to this type.
                 * @param {ReflectionObject} object Nested object to add
                 * @returns {Type} `this`
                 * @throws {TypeError} If arguments are invalid
                 * @throws {Error} If there is already a nested object with this name or, if a field, when there is already a field with this id
                 */
                Type.prototype.add = function add(object) {
                    if (this.get(object.name))
                        throw Error("duplicate name '" + object.name + "' in " + this);
                    if (object instanceof Field && object.extend === undefined) {
                        // NOTE: Extension fields aren't actual fields on the declaring type, but nested objects.
                        // The root object takes care of adding distinct sister-fields to the respective extended
                        // type instead.
                        // avoids calling the getter if not absolutely necessary because it's called quite frequently
                        if (this._fieldsById ? this._fieldsById[object.id] : this.fieldsById[object.id])
                            throw Error("duplicate id " + object.id + " in " + this);
                        if (this.isReservedId(object.id))
                            throw Error("id " + object.id + " is reserved in " + this);
                        if (this.isReservedName(object.name))
                            throw Error("name '" + object.name + "' is reserved in " + this);
                        if (object.parent)
                            object.parent.remove(object);
                        this.fields[object.name] = object;
                        object.message = this;
                        object.onAdd(this);
                        return clearCache(this);
                    }
                    if (object instanceof OneOf) {
                        if (!this.oneofs)
                            this.oneofs = {};
                        this.oneofs[object.name] = object;
                        object.onAdd(this);
                        return clearCache(this);
                    }
                    return Namespace.prototype.add.call(this, object);
                };
                /**
                 * Removes a nested object from this type.
                 * @param {ReflectionObject} object Nested object to remove
                 * @returns {Type} `this`
                 * @throws {TypeError} If arguments are invalid
                 * @throws {Error} If `object` is not a member of this type
                 */
                Type.prototype.remove = function remove(object) {
                    if (object instanceof Field && object.extend === undefined) {
                        // See Type#add for the reason why extension fields are excluded here.
                        /* istanbul ignore if */
                        if (!this.fields || this.fields[object.name] !== object)
                            throw Error(object + " is not a member of " + this);
                        delete this.fields[object.name];
                        object.parent = null;
                        object.onRemove(this);
                        return clearCache(this);
                    }
                    if (object instanceof OneOf) {
                        /* istanbul ignore if */
                        if (!this.oneofs || this.oneofs[object.name] !== object)
                            throw Error(object + " is not a member of " + this);
                        delete this.oneofs[object.name];
                        object.parent = null;
                        object.onRemove(this);
                        return clearCache(this);
                    }
                    return Namespace.prototype.remove.call(this, object);
                };
                /**
                 * Tests if the specified id is reserved.
                 * @param {number} id Id to test
                 * @returns {boolean} `true` if reserved, otherwise `false`
                 */
                Type.prototype.isReservedId = function isReservedId(id) {
                    if (this.reserved)
                        for (var i = 0; i < this.reserved.length; ++i)
                            if (typeof this.reserved[i] !== "string" && this.reserved[i][0] <= id && this.reserved[i][1] >= id)
                                return true;
                    return false;
                };
                /**
                 * Tests if the specified name is reserved.
                 * @param {string} name Name to test
                 * @returns {boolean} `true` if reserved, otherwise `false`
                 */
                Type.prototype.isReservedName = function isReservedName(name) {
                    if (this.reserved)
                        for (var i = 0; i < this.reserved.length; ++i)
                            if (this.reserved[i] === name)
                                return true;
                    return false;
                };
                /**
                 * Creates a new message of this type using the specified properties.
                 * @param {Object.<string,*>} [properties] Properties to set
                 * @returns {Message<{}>} Message instance
                 */
                Type.prototype.create = function create(properties) {
                    return new this.ctor(properties);
                };
                /**
                 * Sets up {@link Type#encode|encode}, {@link Type#decode|decode} and {@link Type#verify|verify}.
                 * @returns {Type} `this`
                 */
                Type.prototype.setup = function setup() {
                    // Sets up everything at once so that the prototype chain does not have to be re-evaluated
                    // multiple times (V8, soft-deopt prototype-check).
                    var fullName = this.fullName, types = [];
                    for (var i = 0; i < this.fieldsArray.length; ++i)
                        types.push(this._fieldsArray[i].resolve().resolvedType);
                    // Replace setup methods with type-specific generated functions
                    this.encode = encoder(this)({
                        Writer: Writer,
                        types: types,
                        util: util
                    });
                    this.decode = decoder(this)({
                        Reader: Reader,
                        types: types,
                        util: util
                    });
                    this.verify = verifier(this)({
                        types: types,
                        util: util
                    });
                    this.fromObject = converter.fromObject(this)({
                        types: types,
                        util: util
                    });
                    this.toObject = converter.toObject(this)({
                        types: types,
                        util: util
                    });
                    // Inject custom wrappers for common types
                    var wrapper = wrappers[fullName];
                    if (wrapper) {
                        var originalThis = Object.create(this);
                        // if (wrapper.fromObject) {
                        originalThis.fromObject = this.fromObject;
                        this.fromObject = wrapper.fromObject.bind(originalThis);
                        // }
                        // if (wrapper.toObject) {
                        originalThis.toObject = this.toObject;
                        this.toObject = wrapper.toObject.bind(originalThis);
                        // }
                    }
                    return this;
                };
                /**
                 * Encodes a message of this type. Does not implicitly {@link Type#verify|verify} messages.
                 * @param {Message<{}>|Object.<string,*>} message Message instance or plain object
                 * @param {Writer} [writer] Writer to encode to
                 * @returns {Writer} writer
                 */
                Type.prototype.encode = function encode_setup(message, writer) {
                    return this.setup().encode(message, writer); // overrides this method
                };
                /**
                 * Encodes a message of this type preceeded by its byte length as a varint. Does not implicitly {@link Type#verify|verify} messages.
                 * @param {Message<{}>|Object.<string,*>} message Message instance or plain object
                 * @param {Writer} [writer] Writer to encode to
                 * @returns {Writer} writer
                 */
                Type.prototype.encodeDelimited = function encodeDelimited(message, writer) {
                    return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
                };
                /**
                 * Decodes a message of this type.
                 * @param {Reader|Uint8Array} reader Reader or buffer to decode from
                 * @param {number} [length] Length of the message, if known beforehand
                 * @returns {Message<{}>} Decoded message
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {util.ProtocolError<{}>} If required fields are missing
                 */
                Type.prototype.decode = function decode_setup(reader, length) {
                    return this.setup().decode(reader, length); // overrides this method
                };
                /**
                 * Decodes a message of this type preceeded by its byte length as a varint.
                 * @param {Reader|Uint8Array} reader Reader or buffer to decode from
                 * @returns {Message<{}>} Decoded message
                 * @throws {Error} If the payload is not a reader or valid buffer
                 * @throws {util.ProtocolError} If required fields are missing
                 */
                Type.prototype.decodeDelimited = function decodeDelimited(reader) {
                    if (!(reader instanceof Reader))
                        reader = Reader.create(reader);
                    return this.decode(reader, reader.uint32());
                };
                /**
                 * Verifies that field values are valid and that required fields are present.
                 * @param {Object.<string,*>} message Plain object to verify
                 * @returns {null|string} `null` if valid, otherwise the reason why it is not
                 */
                Type.prototype.verify = function verify_setup(message) {
                    return this.setup().verify(message); // overrides this method
                };
                /**
                 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
                 * @param {Object.<string,*>} object Plain object to convert
                 * @returns {Message<{}>} Message instance
                 */
                Type.prototype.fromObject = function fromObject(object) {
                    return this.setup().fromObject(object);
                };
                /**
                 * Conversion options as used by {@link Type#toObject} and {@link Message.toObject}.
                 * @interface IConversionOptions
                 * @property {Function} [longs] Long conversion type.
                 * Valid values are `String` and `Number` (the global types).
                 * Defaults to copy the present value, which is a possibly unsafe number without and a {@link Long} with a long library.
                 * @property {Function} [enums] Enum value conversion type.
                 * Only valid value is `String` (the global type).
                 * Defaults to copy the present value, which is the numeric id.
                 * @property {Function} [bytes] Bytes value conversion type.
                 * Valid values are `Array` and (a base64 encoded) `String` (the global types).
                 * Defaults to copy the present value, which usually is a Buffer under node and an Uint8Array in the browser.
                 * @property {boolean} [defaults=false] Also sets default values on the resulting object
                 * @property {boolean} [arrays=false] Sets empty arrays for missing repeated fields even if `defaults=false`
                 * @property {boolean} [objects=false] Sets empty objects for missing map fields even if `defaults=false`
                 * @property {boolean} [oneofs=false] Includes virtual oneof properties set to the present field's name, if any
                 * @property {boolean} [json=false] Performs additional JSON compatibility conversions, i.e. NaN and Infinity to strings
                 */
                /**
                 * Creates a plain object from a message of this type. Also converts values to other types if specified.
                 * @param {Message<{}>} message Message instance
                 * @param {IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 */
                Type.prototype.toObject = function toObject(message, options) {
                    return this.setup().toObject(message, options);
                };
                /**
                 * Decorator function as returned by {@link Type.d} (TypeScript).
                 * @typedef TypeDecorator
                 * @type {function}
                 * @param {Constructor<T>} target Target constructor
                 * @returns {undefined}
                 * @template T extends Message<T>
                 */
                /**
                 * Type decorator (TypeScript).
                 * @param {string} [typeName] Type name, defaults to the constructor's name
                 * @returns {TypeDecorator<T>} Decorator function
                 * @template T extends Message<T>
                 */
                Type.d = function decorateType(typeName) {
                    return function typeDecorator(target) {
                        util.decorateType(target, typeName);
                    };
                };
            }, { "12": 12, "13": 13, "14": 14, "15": 15, "16": 16, "20": 20, "21": 21, "23": 23, "25": 25, "27": 27, "33": 33, "37": 37, "40": 40, "41": 41, "42": 42 }], 36: [function (require, module, exports) {
                "use strict";
                /**
                 * Common type constants.
                 * @namespace
                 */
                var types = exports;
                var util = require(37);
                var s = [
                    "double",
                    "float",
                    "int32",
                    "uint32",
                    "sint32",
                    "fixed32",
                    "sfixed32",
                    "int64",
                    "uint64",
                    "sint64",
                    "fixed64",
                    "sfixed64",
                    "bool",
                    "string",
                    "bytes" // 14
                ];
                function bake(values, offset) {
                    var i = 0, o = {};
                    offset |= 0;
                    while (i < values.length)
                        o[s[i + offset]] = values[i++];
                    return o;
                }
                /**
                 * Basic type wire types.
                 * @type {Object.<string,number>}
                 * @const
                 * @property {number} double=1 Fixed64 wire type
                 * @property {number} float=5 Fixed32 wire type
                 * @property {number} int32=0 Varint wire type
                 * @property {number} uint32=0 Varint wire type
                 * @property {number} sint32=0 Varint wire type
                 * @property {number} fixed32=5 Fixed32 wire type
                 * @property {number} sfixed32=5 Fixed32 wire type
                 * @property {number} int64=0 Varint wire type
                 * @property {number} uint64=0 Varint wire type
                 * @property {number} sint64=0 Varint wire type
                 * @property {number} fixed64=1 Fixed64 wire type
                 * @property {number} sfixed64=1 Fixed64 wire type
                 * @property {number} bool=0 Varint wire type
                 * @property {number} string=2 Ldelim wire type
                 * @property {number} bytes=2 Ldelim wire type
                 */
                types.basic = bake([
                    /* double   */ 1,
                    /* float    */ 5,
                    /* int32    */ 0,
                    /* uint32   */ 0,
                    /* sint32   */ 0,
                    /* fixed32  */ 5,
                    /* sfixed32 */ 5,
                    /* int64    */ 0,
                    /* uint64   */ 0,
                    /* sint64   */ 0,
                    /* fixed64  */ 1,
                    /* sfixed64 */ 1,
                    /* bool     */ 0,
                    /* string   */ 2,
                    /* bytes    */ 2
                ]);
                /**
                 * Basic type defaults.
                 * @type {Object.<string,*>}
                 * @const
                 * @property {number} double=0 Double default
                 * @property {number} float=0 Float default
                 * @property {number} int32=0 Int32 default
                 * @property {number} uint32=0 Uint32 default
                 * @property {number} sint32=0 Sint32 default
                 * @property {number} fixed32=0 Fixed32 default
                 * @property {number} sfixed32=0 Sfixed32 default
                 * @property {number} int64=0 Int64 default
                 * @property {number} uint64=0 Uint64 default
                 * @property {number} sint64=0 Sint32 default
                 * @property {number} fixed64=0 Fixed64 default
                 * @property {number} sfixed64=0 Sfixed64 default
                 * @property {boolean} bool=false Bool default
                 * @property {string} string="" String default
                 * @property {Array.<number>} bytes=Array(0) Bytes default
                 * @property {null} message=null Message default
                 */
                types.defaults = bake([
                    /* double   */ 0,
                    /* float    */ 0,
                    /* int32    */ 0,
                    /* uint32   */ 0,
                    /* sint32   */ 0,
                    /* fixed32  */ 0,
                    /* sfixed32 */ 0,
                    /* int64    */ 0,
                    /* uint64   */ 0,
                    /* sint64   */ 0,
                    /* fixed64  */ 0,
                    /* sfixed64 */ 0,
                    /* bool     */ false,
                    /* string   */ "",
                    /* bytes    */ util.emptyArray,
                    /* message  */ null
                ]);
                /**
                 * Basic long type wire types.
                 * @type {Object.<string,number>}
                 * @const
                 * @property {number} int64=0 Varint wire type
                 * @property {number} uint64=0 Varint wire type
                 * @property {number} sint64=0 Varint wire type
                 * @property {number} fixed64=1 Fixed64 wire type
                 * @property {number} sfixed64=1 Fixed64 wire type
                 */
                types.long = bake([
                    /* int64    */ 0,
                    /* uint64   */ 0,
                    /* sint64   */ 0,
                    /* fixed64  */ 1,
                    /* sfixed64 */ 1
                ], 7);
                /**
                 * Allowed types for map keys with their associated wire type.
                 * @type {Object.<string,number>}
                 * @const
                 * @property {number} int32=0 Varint wire type
                 * @property {number} uint32=0 Varint wire type
                 * @property {number} sint32=0 Varint wire type
                 * @property {number} fixed32=5 Fixed32 wire type
                 * @property {number} sfixed32=5 Fixed32 wire type
                 * @property {number} int64=0 Varint wire type
                 * @property {number} uint64=0 Varint wire type
                 * @property {number} sint64=0 Varint wire type
                 * @property {number} fixed64=1 Fixed64 wire type
                 * @property {number} sfixed64=1 Fixed64 wire type
                 * @property {number} bool=0 Varint wire type
                 * @property {number} string=2 Ldelim wire type
                 */
                types.mapKey = bake([
                    /* int32    */ 0,
                    /* uint32   */ 0,
                    /* sint32   */ 0,
                    /* fixed32  */ 5,
                    /* sfixed32 */ 5,
                    /* int64    */ 0,
                    /* uint64   */ 0,
                    /* sint64   */ 0,
                    /* fixed64  */ 1,
                    /* sfixed64 */ 1,
                    /* bool     */ 0,
                    /* string   */ 2
                ], 2);
                /**
                 * Allowed types for packed repeated fields with their associated wire type.
                 * @type {Object.<string,number>}
                 * @const
                 * @property {number} double=1 Fixed64 wire type
                 * @property {number} float=5 Fixed32 wire type
                 * @property {number} int32=0 Varint wire type
                 * @property {number} uint32=0 Varint wire type
                 * @property {number} sint32=0 Varint wire type
                 * @property {number} fixed32=5 Fixed32 wire type
                 * @property {number} sfixed32=5 Fixed32 wire type
                 * @property {number} int64=0 Varint wire type
                 * @property {number} uint64=0 Varint wire type
                 * @property {number} sint64=0 Varint wire type
                 * @property {number} fixed64=1 Fixed64 wire type
                 * @property {number} sfixed64=1 Fixed64 wire type
                 * @property {number} bool=0 Varint wire type
                 */
                types.packed = bake([
                    /* double   */ 1,
                    /* float    */ 5,
                    /* int32    */ 0,
                    /* uint32   */ 0,
                    /* sint32   */ 0,
                    /* fixed32  */ 5,
                    /* sfixed32 */ 5,
                    /* int64    */ 0,
                    /* uint64   */ 0,
                    /* sint64   */ 0,
                    /* fixed64  */ 1,
                    /* sfixed64 */ 1,
                    /* bool     */ 0
                ]);
            }, { "37": 37 }], 37: [function (require, module, exports) {
                "use strict";
                /**
                 * Various utility functions.
                 * @namespace
                 */
                var util = module.exports = require(39);
                var roots = require(30);
                var Type, // cyclic
                Enum;
                util.codegen = require(3);
                util.fetch = require(5);
                util.path = require(8);
                /**
                 * Node's fs module if available.
                 * @type {Object.<string,*>}
                 */
                util.fs = util.inquire("fs");
                /**
                 * Converts an object's values to an array.
                 * @param {Object.<string,*>} object Object to convert
                 * @returns {Array.<*>} Converted array
                 */
                util.toArray = function toArray(object) {
                    if (object) {
                        var keys = Object.keys(object), array = new Array(keys.length), index = 0;
                        while (index < keys.length)
                            array[index] = object[keys[index++]];
                        return array;
                    }
                    return [];
                };
                /**
                 * Converts an array of keys immediately followed by their respective value to an object, omitting undefined values.
                 * @param {Array.<*>} array Array to convert
                 * @returns {Object.<string,*>} Converted object
                 */
                util.toObject = function toObject(array) {
                    var object = {}, index = 0;
                    while (index < array.length) {
                        var key = array[index++], val = array[index++];
                        if (val !== undefined)
                            object[key] = val;
                    }
                    return object;
                };
                var safePropBackslashRe = /\\/g, safePropQuoteRe = /"/g;
                /**
                 * Returns a safe property accessor for the specified properly name.
                 * @param {string} prop Property name
                 * @returns {string} Safe accessor
                 */
                util.safeProp = function safeProp(prop) {
                    return "[\"" + prop.replace(safePropBackslashRe, "\\\\").replace(safePropQuoteRe, "\\\"") + "\"]";
                };
                /**
                 * Converts the first character of a string to upper case.
                 * @param {string} str String to convert
                 * @returns {string} Converted string
                 */
                util.ucFirst = function ucFirst(str) {
                    return str.charAt(0).toUpperCase() + str.substring(1);
                };
                var camelCaseRe = /_([a-z])/g;
                /**
                 * Converts a string to camel case.
                 * @param {string} str String to convert
                 * @returns {string} Converted string
                 */
                util.camelCase = function camelCase(str) {
                    return str.substring(0, 1)
                        + str.substring(1)
                            .replace(camelCaseRe, function ($0, $1) { return $1.toUpperCase(); });
                };
                /**
                 * Compares reflected fields by id.
                 * @param {Field} a First field
                 * @param {Field} b Second field
                 * @returns {number} Comparison value
                 */
                util.compareFieldsById = function compareFieldsById(a, b) {
                    return a.id - b.id;
                };
                /**
                 * Decorator helper for types (TypeScript).
                 * @param {Constructor<T>} ctor Constructor function
                 * @param {string} [typeName] Type name, defaults to the constructor's name
                 * @returns {Type} Reflected type
                 * @template T extends Message<T>
                 * @property {Root} root Decorators root
                 */
                util.decorateType = function decorateType(ctor, typeName) {
                    /* istanbul ignore if */
                    if (ctor.$type) {
                        if (typeName && ctor.$type.name !== typeName) {
                            util.decorateRoot.remove(ctor.$type);
                            ctor.$type.name = typeName;
                            util.decorateRoot.add(ctor.$type);
                        }
                        return ctor.$type;
                    }
                    /* istanbul ignore next */
                    if (!Type)
                        Type = require(35);
                    var type = new Type(typeName || ctor.name);
                    util.decorateRoot.add(type);
                    type.ctor = ctor; // sets up .encode, .decode etc.
                    Object.defineProperty(ctor, "$type", { value: type, enumerable: false });
                    Object.defineProperty(ctor.prototype, "$type", { value: type, enumerable: false });
                    return type;
                };
                var decorateEnumIndex = 0;
                /**
                 * Decorator helper for enums (TypeScript).
                 * @param {Object} object Enum object
                 * @returns {Enum} Reflected enum
                 */
                util.decorateEnum = function decorateEnum(object) {
                    /* istanbul ignore if */
                    if (object.$type)
                        return object.$type;
                    /* istanbul ignore next */
                    if (!Enum)
                        Enum = require(15);
                    var enm = new Enum("Enum" + decorateEnumIndex++, object);
                    util.decorateRoot.add(enm);
                    Object.defineProperty(object, "$type", { value: enm, enumerable: false });
                    return enm;
                };
                /**
                 * Decorator root (TypeScript).
                 * @name util.decorateRoot
                 * @type {Root}
                 * @readonly
                 */
                Object.defineProperty(util, "decorateRoot", {
                    get: function () {
                        return roots["decorated"] || (roots["decorated"] = new (require(29))());
                    }
                });
            }, { "15": 15, "29": 29, "3": 3, "30": 30, "35": 35, "39": 39, "5": 5, "8": 8 }], 38: [function (require, module, exports) {
                "use strict";
                module.exports = LongBits;
                var util = require(39);
                /**
                 * Constructs new long bits.
                 * @classdesc Helper class for working with the low and high bits of a 64 bit value.
                 * @memberof util
                 * @constructor
                 * @param {number} lo Low 32 bits, unsigned
                 * @param {number} hi High 32 bits, unsigned
                 */
                function LongBits(lo, hi) {
                    // note that the casts below are theoretically unnecessary as of today, but older statically
                    // generated converter code might still call the ctor with signed 32bits. kept for compat.
                    /**
                     * Low bits.
                     * @type {number}
                     */
                    this.lo = lo >>> 0;
                    /**
                     * High bits.
                     * @type {number}
                     */
                    this.hi = hi >>> 0;
                }
                /**
                 * Zero bits.
                 * @memberof util.LongBits
                 * @type {util.LongBits}
                 */
                var zero = LongBits.zero = new LongBits(0, 0);
                zero.toNumber = function () { return 0; };
                zero.zzEncode = zero.zzDecode = function () { return this; };
                zero.length = function () { return 1; };
                /**
                 * Zero hash.
                 * @memberof util.LongBits
                 * @type {string}
                 */
                var zeroHash = LongBits.zeroHash = "\0\0\0\0\0\0\0\0";
                /**
                 * Constructs new long bits from the specified number.
                 * @param {number} value Value
                 * @returns {util.LongBits} Instance
                 */
                LongBits.fromNumber = function fromNumber(value) {
                    if (value === 0)
                        return zero;
                    var sign = value < 0;
                    if (sign)
                        value = -value;
                    var lo = value >>> 0, hi = (value - lo) / 4294967296 >>> 0;
                    if (sign) {
                        hi = ~hi >>> 0;
                        lo = ~lo >>> 0;
                        if (++lo > 4294967295) {
                            lo = 0;
                            if (++hi > 4294967295)
                                hi = 0;
                        }
                    }
                    return new LongBits(lo, hi);
                };
                /**
                 * Constructs new long bits from a number, long or string.
                 * @param {Long|number|string} value Value
                 * @returns {util.LongBits} Instance
                 */
                LongBits.from = function from(value) {
                    if (typeof value === "number")
                        return LongBits.fromNumber(value);
                    if (util.isString(value)) {
                        /* istanbul ignore else */
                        if (util.Long)
                            value = util.Long.fromString(value);
                        else
                            return LongBits.fromNumber(parseInt(value, 10));
                    }
                    return value.low || value.high ? new LongBits(value.low >>> 0, value.high >>> 0) : zero;
                };
                /**
                 * Converts this long bits to a possibly unsafe JavaScript number.
                 * @param {boolean} [unsigned=false] Whether unsigned or not
                 * @returns {number} Possibly unsafe number
                 */
                LongBits.prototype.toNumber = function toNumber(unsigned) {
                    if (!unsigned && this.hi >>> 31) {
                        var lo = ~this.lo + 1 >>> 0, hi = ~this.hi >>> 0;
                        if (!lo)
                            hi = hi + 1 >>> 0;
                        return -(lo + hi * 4294967296);
                    }
                    return this.lo + this.hi * 4294967296;
                };
                /**
                 * Converts this long bits to a long.
                 * @param {boolean} [unsigned=false] Whether unsigned or not
                 * @returns {Long} Long
                 */
                LongBits.prototype.toLong = function toLong(unsigned) {
                    return util.Long
                        ? new util.Long(this.lo | 0, this.hi | 0, Boolean(unsigned))
                        : { low: this.lo | 0, high: this.hi | 0, unsigned: Boolean(unsigned) };
                };
                var charCodeAt = String.prototype.charCodeAt;
                /**
                 * Constructs new long bits from the specified 8 characters long hash.
                 * @param {string} hash Hash
                 * @returns {util.LongBits} Bits
                 */
                LongBits.fromHash = function fromHash(hash) {
                    if (hash === zeroHash)
                        return zero;
                    return new LongBits((charCodeAt.call(hash, 0)
                        | charCodeAt.call(hash, 1) << 8
                        | charCodeAt.call(hash, 2) << 16
                        | charCodeAt.call(hash, 3) << 24) >>> 0, (charCodeAt.call(hash, 4)
                        | charCodeAt.call(hash, 5) << 8
                        | charCodeAt.call(hash, 6) << 16
                        | charCodeAt.call(hash, 7) << 24) >>> 0);
                };
                /**
                 * Converts this long bits to a 8 characters long hash.
                 * @returns {string} Hash
                 */
                LongBits.prototype.toHash = function toHash() {
                    return String.fromCharCode(this.lo & 255, this.lo >>> 8 & 255, this.lo >>> 16 & 255, this.lo >>> 24, this.hi & 255, this.hi >>> 8 & 255, this.hi >>> 16 & 255, this.hi >>> 24);
                };
                /**
                 * Zig-zag encodes this long bits.
                 * @returns {util.LongBits} `this`
                 */
                LongBits.prototype.zzEncode = function zzEncode() {
                    var mask = this.hi >> 31;
                    this.hi = ((this.hi << 1 | this.lo >>> 31) ^ mask) >>> 0;
                    this.lo = (this.lo << 1 ^ mask) >>> 0;
                    return this;
                };
                /**
                 * Zig-zag decodes this long bits.
                 * @returns {util.LongBits} `this`
                 */
                LongBits.prototype.zzDecode = function zzDecode() {
                    var mask = -(this.lo & 1);
                    this.lo = ((this.lo >>> 1 | this.hi << 31) ^ mask) >>> 0;
                    this.hi = (this.hi >>> 1 ^ mask) >>> 0;
                    return this;
                };
                /**
                 * Calculates the length of this longbits when encoded as a varint.
                 * @returns {number} Length
                 */
                LongBits.prototype.length = function length() {
                    var part0 = this.lo, part1 = (this.lo >>> 28 | this.hi << 4) >>> 0, part2 = this.hi >>> 24;
                    return part2 === 0
                        ? part1 === 0
                            ? part0 < 16384
                                ? part0 < 128 ? 1 : 2
                                : part0 < 2097152 ? 3 : 4
                            : part1 < 16384
                                ? part1 < 128 ? 5 : 6
                                : part1 < 2097152 ? 7 : 8
                        : part2 < 128 ? 9 : 10;
                };
            }, { "39": 39 }], 39: [function (require, module, exports) {
                "use strict";
                var util = exports;
                // used to return a Promise where callback is omitted
                util.asPromise = require(1);
                // converts to / from base64 encoded strings
                util.base64 = require(2);
                // base class of rpc.Service
                util.EventEmitter = require(4);
                // float handling accross browsers
                util.float = require(6);
                // requires modules optionally and hides the call from bundlers
                util.inquire = require(7);
                // converts to / from utf8 encoded strings
                util.utf8 = require(10);
                // provides a node-like buffer pool in the browser
                util.pool = require(9);
                // utility to work with the low and high bits of a 64 bit value
                util.LongBits = require(38);
                /**
                 * An immuable empty array.
                 * @memberof util
                 * @type {Array.<*>}
                 * @const
                 */
                util.emptyArray = Object.freeze ? Object.freeze([]) : []; // used on prototypes
                /**
                 * An immutable empty object.
                 * @type {Object}
                 * @const
                 */
                util.emptyObject = Object.freeze ? Object.freeze({}) : {}; // used on prototypes
                /**
                 * Whether running within node or not.
                 * @memberof util
                 * @type {boolean}
                 * @const
                 */
                util.isNode = Boolean(global.process && global.process.versions && global.process.versions.node);
                /**
                 * Tests if the specified value is an integer.
                 * @function
                 * @param {*} value Value to test
                 * @returns {boolean} `true` if the value is an integer
                 */
                util.isInteger = Number.isInteger || function isInteger(value) {
                    return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
                };
                /**
                 * Tests if the specified value is a string.
                 * @param {*} value Value to test
                 * @returns {boolean} `true` if the value is a string
                 */
                util.isString = function isString(value) {
                    return typeof value === "string" || value instanceof String;
                };
                /**
                 * Tests if the specified value is a non-null object.
                 * @param {*} value Value to test
                 * @returns {boolean} `true` if the value is a non-null object
                 */
                util.isObject = function isObject(value) {
                    return value && typeof value === "object";
                };
                /**
                 * Checks if a property on a message is considered to be present.
                 * This is an alias of {@link util.isSet}.
                 * @function
                 * @param {Object} obj Plain object or message instance
                 * @param {string} prop Property name
                 * @returns {boolean} `true` if considered to be present, otherwise `false`
                 */
                util.isset =
                    /**
                     * Checks if a property on a message is considered to be present.
                     * @param {Object} obj Plain object or message instance
                     * @param {string} prop Property name
                     * @returns {boolean} `true` if considered to be present, otherwise `false`
                     */
                    util.isSet = function isSet(obj, prop) {
                        var value = obj[prop];
                        if (value != null && obj.hasOwnProperty(prop))
                            return typeof value !== "object" || (Array.isArray(value) ? value.length : Object.keys(value).length) > 0;
                        return false;
                    };
                /**
                 * Any compatible Buffer instance.
                 * This is a minimal stand-alone definition of a Buffer instance. The actual type is that exported by node's typings.
                 * @interface Buffer
                 * @extends Uint8Array
                 */
                /**
                 * Node's Buffer class if available.
                 * @type {Constructor<Buffer>}
                 */
                util.Buffer = (function () {
                    try {
                        var Buffer = util.inquire("buffer").Buffer;
                        // refuse to use non-node buffers if not explicitly assigned (perf reasons):
                        return Buffer.prototype.utf8Write ? Buffer : null;
                    }
                    catch (e) {
                        /* istanbul ignore next */
                        return null;
                    }
                })();
                // Internal alias of or polyfull for Buffer.from.
                util._Buffer_from = null;
                // Internal alias of or polyfill for Buffer.allocUnsafe.
                util._Buffer_allocUnsafe = null;
                /**
                 * Creates a new buffer of whatever type supported by the environment.
                 * @param {number|number[]} [sizeOrArray=0] Buffer size or number array
                 * @returns {Uint8Array|Buffer} Buffer
                 */
                util.newBuffer = function newBuffer(sizeOrArray) {
                    /* istanbul ignore next */
                    return typeof sizeOrArray === "number"
                        ? util.Buffer
                            ? util._Buffer_allocUnsafe(sizeOrArray)
                            : new util.Array(sizeOrArray)
                        : util.Buffer
                            ? util._Buffer_from(sizeOrArray)
                            : typeof Uint8Array === "undefined"
                                ? sizeOrArray
                                : new Uint8Array(sizeOrArray);
                };
                /**
                 * Array implementation used in the browser. `Uint8Array` if supported, otherwise `Array`.
                 * @type {Constructor<Uint8Array>}
                 */
                util.Array = typeof Uint8Array !== "undefined" ? Uint8Array /* istanbul ignore next */ : Array;
                /**
                 * Any compatible Long instance.
                 * This is a minimal stand-alone definition of a Long instance. The actual type is that exported by long.js.
                 * @interface Long
                 * @property {number} low Low bits
                 * @property {number} high High bits
                 * @property {boolean} unsigned Whether unsigned or not
                 */
                /**
                 * Long.js's Long class if available.
                 * @type {Constructor<Long>}
                 */
                util.Long = global.dcodeIO && global.dcodeIO.Long || util.inquire("long");
                /**
                 * Regular expression used to verify 2 bit (`bool`) map keys.
                 * @type {RegExp}
                 * @const
                 */
                util.key2Re = /^true|false|0|1$/;
                /**
                 * Regular expression used to verify 32 bit (`int32` etc.) map keys.
                 * @type {RegExp}
                 * @const
                 */
                util.key32Re = /^-?(?:0|[1-9][0-9]*)$/;
                /**
                 * Regular expression used to verify 64 bit (`int64` etc.) map keys.
                 * @type {RegExp}
                 * @const
                 */
                util.key64Re = /^(?:[\\x00-\\xff]{8}|-?(?:0|[1-9][0-9]*))$/;
                /**
                 * Converts a number or long to an 8 characters long hash string.
                 * @param {Long|number} value Value to convert
                 * @returns {string} Hash
                 */
                util.longToHash = function longToHash(value) {
                    return value
                        ? util.LongBits.from(value).toHash()
                        : util.LongBits.zeroHash;
                };
                /**
                 * Converts an 8 characters long hash string to a long or number.
                 * @param {string} hash Hash
                 * @param {boolean} [unsigned=false] Whether unsigned or not
                 * @returns {Long|number} Original value
                 */
                util.longFromHash = function longFromHash(hash, unsigned) {
                    var bits = util.LongBits.fromHash(hash);
                    if (util.Long)
                        return util.Long.fromBits(bits.lo, bits.hi, unsigned);
                    return bits.toNumber(Boolean(unsigned));
                };
                /**
                 * Merges the properties of the source object into the destination object.
                 * @memberof util
                 * @param {Object.<string,*>} dst Destination object
                 * @param {Object.<string,*>} src Source object
                 * @param {boolean} [ifNotSet=false] Merges only if the key is not already set
                 * @returns {Object.<string,*>} Destination object
                 */
                function merge(dst, src, ifNotSet) {
                    for (var keys = Object.keys(src), i = 0; i < keys.length; ++i)
                        if (dst[keys[i]] === undefined || !ifNotSet)
                            dst[keys[i]] = src[keys[i]];
                    return dst;
                }
                util.merge = merge;
                /**
                 * Converts the first character of a string to lower case.
                 * @param {string} str String to convert
                 * @returns {string} Converted string
                 */
                util.lcFirst = function lcFirst(str) {
                    return str.charAt(0).toLowerCase() + str.substring(1);
                };
                /**
                 * Creates a custom error constructor.
                 * @memberof util
                 * @param {string} name Error name
                 * @returns {Constructor<Error>} Custom error constructor
                 */
                function newError(name) {
                    function CustomError(message, properties) {
                        if (!(this instanceof CustomError))
                            return new CustomError(message, properties);
                        // Error.call(this, message);
                        // ^ just returns a new error instance because the ctor can be called as a function
                        Object.defineProperty(this, "message", { get: function () { return message; } });
                        /* istanbul ignore next */
                        if (Error.captureStackTrace)
                            Error.captureStackTrace(this, CustomError);
                        else
                            Object.defineProperty(this, "stack", { value: (new Error()).stack || "" });
                        if (properties)
                            merge(this, properties);
                    }
                    (CustomError.prototype = Object.create(Error.prototype)).constructor = CustomError;
                    Object.defineProperty(CustomError.prototype, "name", { get: function () { return name; } });
                    CustomError.prototype.toString = function toString() {
                        return this.name + ": " + this.message;
                    };
                    return CustomError;
                }
                util.newError = newError;
                /**
                 * Constructs a new protocol error.
                 * @classdesc Error subclass indicating a protocol specifc error.
                 * @memberof util
                 * @extends Error
                 * @template T extends Message<T>
                 * @constructor
                 * @param {string} message Error message
                 * @param {Object.<string,*>} [properties] Additional properties
                 * @example
                 * try {
                 *     MyMessage.decode(someBuffer); // throws if required fields are missing
                 * } catch (e) {
                 *     if (e instanceof ProtocolError && e.instance)
                 *         console.log("decoded so far: " + JSON.stringify(e.instance));
                 * }
                 */
                util.ProtocolError = newError("ProtocolError");
                /**
                 * So far decoded message instance.
                 * @name util.ProtocolError#instance
                 * @type {Message<T>}
                 */
                /**
                 * A OneOf getter as returned by {@link util.oneOfGetter}.
                 * @typedef OneOfGetter
                 * @type {function}
                 * @returns {string|undefined} Set field name, if any
                 */
                /**
                 * Builds a getter for a oneof's present field name.
                 * @param {string[]} fieldNames Field names
                 * @returns {OneOfGetter} Unbound getter
                 */
                util.oneOfGetter = function getOneOf(fieldNames) {
                    var fieldMap = {};
                    for (var i = 0; i < fieldNames.length; ++i)
                        fieldMap[fieldNames[i]] = 1;
                    /**
                     * @returns {string|undefined} Set field name, if any
                     * @this Object
                     * @ignore
                     */
                    return function () {
                        for (var keys = Object.keys(this), i = keys.length - 1; i > -1; --i)
                            if (fieldMap[keys[i]] === 1 && this[keys[i]] !== undefined && this[keys[i]] !== null)
                                return keys[i];
                    };
                };
                /**
                 * A OneOf setter as returned by {@link util.oneOfSetter}.
                 * @typedef OneOfSetter
                 * @type {function}
                 * @param {string|undefined} value Field name
                 * @returns {undefined}
                 */
                /**
                 * Builds a setter for a oneof's present field name.
                 * @param {string[]} fieldNames Field names
                 * @returns {OneOfSetter} Unbound setter
                 */
                util.oneOfSetter = function setOneOf(fieldNames) {
                    /**
                     * @param {string} name Field name
                     * @returns {undefined}
                     * @this Object
                     * @ignore
                     */
                    return function (name) {
                        for (var i = 0; i < fieldNames.length; ++i)
                            if (fieldNames[i] !== name)
                                delete this[fieldNames[i]];
                    };
                };
                /**
                 * Default conversion options used for {@link Message#toJSON} implementations.
                 *
                 * These options are close to proto3's JSON mapping with the exception that internal types like Any are handled just like messages. More precisely:
                 *
                 * - Longs become strings
                 * - Enums become string keys
                 * - Bytes become base64 encoded strings
                 * - (Sub-)Messages become plain objects
                 * - Maps become plain objects with all string keys
                 * - Repeated fields become arrays
                 * - NaN and Infinity for float and double fields become strings
                 *
                 * @type {IConversionOptions}
                 * @see https://developers.google.com/protocol-buffers/docs/proto3?hl=en#json
                 */
                util.toJSONOptions = {
                    longs: String,
                    enums: String,
                    bytes: String,
                    json: true
                };
                util._configure = function () {
                    var Buffer = util.Buffer;
                    /* istanbul ignore if */
                    if (!Buffer) {
                        util._Buffer_from = util._Buffer_allocUnsafe = null;
                        return;
                    }
                    // because node 4.x buffers are incompatible & immutable
                    // see: https://github.com/dcodeIO/protobuf.js/pull/665
                    util._Buffer_from = Buffer.from !== Uint8Array.from && Buffer.from ||
                        /* istanbul ignore next */
                        function Buffer_from(value, encoding) {
                            return new Buffer(value, encoding);
                        };
                    util._Buffer_allocUnsafe = Buffer.allocUnsafe ||
                        /* istanbul ignore next */
                        function Buffer_allocUnsafe(size) {
                            return new Buffer(size);
                        };
                };
            }, { "1": 1, "10": 10, "2": 2, "38": 38, "4": 4, "6": 6, "7": 7, "9": 9 }], 40: [function (require, module, exports) {
                "use strict";
                module.exports = verifier;
                var Enum = require(15), util = require(37);
                function invalid(field, expected) {
                    return field.name + ": " + expected + (field.repeated && expected !== "array" ? "[]" : field.map && expected !== "object" ? "{k:" + field.keyType + "}" : "") + " expected";
                }
                /**
                 * Generates a partial value verifier.
                 * @param {Codegen} gen Codegen instance
                 * @param {Field} field Reflected field
                 * @param {number} fieldIndex Field index
                 * @param {string} ref Variable reference
                 * @returns {Codegen} Codegen instance
                 * @ignore
                 */
                function genVerifyValue(gen, field, fieldIndex, ref) {
                    /* eslint-disable no-unexpected-multiline */
                    if (field.resolvedType) {
                        if (field.resolvedType instanceof Enum) {
                            gen("switch(%s){", ref)("default:")("return%j", invalid(field, "enum value"));
                            for (var keys = Object.keys(field.resolvedType.values), j = 0; j < keys.length; ++j)
                                gen("case %i:", field.resolvedType.values[keys[j]]);
                            gen("break")("}");
                        }
                        else {
                            gen("{")("var e=types[%i].verify(%s);", fieldIndex, ref)("if(e)")("return%j+e", field.name + ".")("}");
                        }
                    }
                    else {
                        switch (field.type) {
                            case "int32":
                            case "uint32":
                            case "sint32":
                            case "fixed32":
                            case "sfixed32":
                                gen("if(!util.isInteger(%s))", ref)("return%j", invalid(field, "integer"));
                                break;
                            case "int64":
                            case "uint64":
                            case "sint64":
                            case "fixed64":
                            case "sfixed64":
                                gen("if(!util.isInteger(%s)&&!(%s&&util.isInteger(%s.low)&&util.isInteger(%s.high)))", ref, ref, ref, ref)("return%j", invalid(field, "integer|Long"));
                                break;
                            case "float":
                            case "double":
                                gen("if(typeof %s!==\"number\")", ref)("return%j", invalid(field, "number"));
                                break;
                            case "bool":
                                gen("if(typeof %s!==\"boolean\")", ref)("return%j", invalid(field, "boolean"));
                                break;
                            case "string":
                                gen("if(!util.isString(%s))", ref)("return%j", invalid(field, "string"));
                                break;
                            case "bytes":
                                gen("if(!(%s&&typeof %s.length===\"number\"||util.isString(%s)))", ref, ref, ref)("return%j", invalid(field, "buffer"));
                                break;
                        }
                    }
                    return gen;
                    /* eslint-enable no-unexpected-multiline */
                }
                /**
                 * Generates a partial key verifier.
                 * @param {Codegen} gen Codegen instance
                 * @param {Field} field Reflected field
                 * @param {string} ref Variable reference
                 * @returns {Codegen} Codegen instance
                 * @ignore
                 */
                function genVerifyKey(gen, field, ref) {
                    /* eslint-disable no-unexpected-multiline */
                    switch (field.keyType) {
                        case "int32":
                        case "uint32":
                        case "sint32":
                        case "fixed32":
                        case "sfixed32":
                            gen("if(!util.key32Re.test(%s))", ref)("return%j", invalid(field, "integer key"));
                            break;
                        case "int64":
                        case "uint64":
                        case "sint64":
                        case "fixed64":
                        case "sfixed64":
                            gen("if(!util.key64Re.test(%s))", ref) // see comment above: x is ok, d is not
                            ("return%j", invalid(field, "integer|Long key"));
                            break;
                        case "bool":
                            gen("if(!util.key2Re.test(%s))", ref)("return%j", invalid(field, "boolean key"));
                            break;
                    }
                    return gen;
                    /* eslint-enable no-unexpected-multiline */
                }
                /**
                 * Generates a verifier specific to the specified message type.
                 * @param {Type} mtype Message type
                 * @returns {Codegen} Codegen instance
                 */
                function verifier(mtype) {
                    /* eslint-disable no-unexpected-multiline */
                    var gen = util.codegen(["m"], mtype.name + "$verify")("if(typeof m!==\"object\"||m===null)")("return%j", "object expected");
                    var oneofs = mtype.oneofsArray, seenFirstField = {};
                    if (oneofs.length)
                        gen("var p={}");
                    for (var i = 0; i < mtype.fieldsArray.length; ++i) {
                        var field = mtype._fieldsArray[i].resolve(), ref = "m" + util.safeProp(field.name);
                        if (field.optional)
                            gen("if(%s!=null&&m.hasOwnProperty(%j)){", ref, field.name); // !== undefined && !== null
                        // map fields
                        if (field.map) {
                            gen("if(!util.isObject(%s))", ref)("return%j", invalid(field, "object"))("var k=Object.keys(%s)", ref)("for(var i=0;i<k.length;++i){");
                            genVerifyKey(gen, field, "k[i]");
                            genVerifyValue(gen, field, i, ref + "[k[i]]")("}");
                            // repeated fields
                        }
                        else if (field.repeated) {
                            gen("if(!Array.isArray(%s))", ref)("return%j", invalid(field, "array"))("for(var i=0;i<%s.length;++i){", ref);
                            genVerifyValue(gen, field, i, ref + "[i]")("}");
                            // required or present fields
                        }
                        else {
                            if (field.partOf) {
                                var oneofProp = util.safeProp(field.partOf.name);
                                if (seenFirstField[field.partOf.name] === 1)
                                    gen("if(p%s===1)", oneofProp)("return%j", field.partOf.name + ": multiple values");
                                seenFirstField[field.partOf.name] = 1;
                                gen("p%s=1", oneofProp);
                            }
                            genVerifyValue(gen, field, i, ref);
                        }
                        if (field.optional)
                            gen("}");
                    }
                    return gen("return null");
                    /* eslint-enable no-unexpected-multiline */
                }
            }, { "15": 15, "37": 37 }], 41: [function (require, module, exports) {
                "use strict";
                /**
                 * Wrappers for common types.
                 * @type {Object.<string,IWrapper>}
                 * @const
                 */
                var wrappers = exports;
                var Message = require(21);
                /**
                 * From object converter part of an {@link IWrapper}.
                 * @typedef WrapperFromObjectConverter
                 * @type {function}
                 * @param {Object.<string,*>} object Plain object
                 * @returns {Message<{}>} Message instance
                 * @this Type
                 */
                /**
                 * To object converter part of an {@link IWrapper}.
                 * @typedef WrapperToObjectConverter
                 * @type {function}
                 * @param {Message<{}>} message Message instance
                 * @param {IConversionOptions} [options] Conversion options
                 * @returns {Object.<string,*>} Plain object
                 * @this Type
                 */
                /**
                 * Common type wrapper part of {@link wrappers}.
                 * @interface IWrapper
                 * @property {WrapperFromObjectConverter} [fromObject] From object converter
                 * @property {WrapperToObjectConverter} [toObject] To object converter
                 */
                // Custom wrapper for Any
                wrappers[".google.protobuf.Any"] = {
                    fromObject: function (object) {
                        // unwrap value type if mapped
                        if (object && object["@type"]) {
                            var type = this.lookup(object["@type"]);
                            /* istanbul ignore else */
                            if (type) {
                                // type_url does not accept leading "."
                                var type_url = object["@type"].charAt(0) === "." ?
                                    object["@type"].substr(1) : object["@type"];
                                return this.create({
                                    type_url: type_url,
                                    value: type.encode(type.fromObject(object)).finish()
                                });
                            }
                        }
                        return this.fromObject(object);
                    },
                    toObject: function (message, options) {
                        // decode value if requested and unmapped
                        if (options && options.json && message.type_url && message.value) {
                            var type = this.lookup(message.type_url);
                            /* istanbul ignore else */
                            if (type)
                                message = type.decode(message.value);
                        }
                        // wrap value if unmapped
                        if (!(message instanceof this.ctor) && message instanceof Message) {
                            var object = message.$type.toObject(message, options);
                            object["@type"] = message.$type.fullName;
                            return object;
                        }
                        return this.toObject(message, options);
                    }
                };
            }, { "21": 21 }], 42: [function (require, module, exports) {
                "use strict";
                module.exports = Writer;
                var util = require(39);
                var BufferWriter; // cyclic
                var LongBits = util.LongBits, base64 = util.base64, utf8 = util.utf8;
                /**
                 * Constructs a new writer operation instance.
                 * @classdesc Scheduled writer operation.
                 * @constructor
                 * @param {function(*, Uint8Array, number)} fn Function to call
                 * @param {number} len Value byte length
                 * @param {*} val Value to write
                 * @ignore
                 */
                function Op(fn, len, val) {
                    /**
                     * Function to call.
                     * @type {function(Uint8Array, number, *)}
                     */
                    this.fn = fn;
                    /**
                     * Value byte length.
                     * @type {number}
                     */
                    this.len = len;
                    /**
                     * Next operation.
                     * @type {Writer.Op|undefined}
                     */
                    this.next = undefined;
                    /**
                     * Value to write.
                     * @type {*}
                     */
                    this.val = val; // type varies
                }
                /* istanbul ignore next */
                function noop() { } // eslint-disable-line no-empty-function
                /**
                 * Constructs a new writer state instance.
                 * @classdesc Copied writer state.
                 * @memberof Writer
                 * @constructor
                 * @param {Writer} writer Writer to copy state from
                 * @ignore
                 */
                function State(writer) {
                    /**
                     * Current head.
                     * @type {Writer.Op}
                     */
                    this.head = writer.head;
                    /**
                     * Current tail.
                     * @type {Writer.Op}
                     */
                    this.tail = writer.tail;
                    /**
                     * Current buffer length.
                     * @type {number}
                     */
                    this.len = writer.len;
                    /**
                     * Next state.
                     * @type {State|null}
                     */
                    this.next = writer.states;
                }
                /**
                 * Constructs a new writer instance.
                 * @classdesc Wire format writer using `Uint8Array` if available, otherwise `Array`.
                 * @constructor
                 */
                function Writer() {
                    /**
                     * Current length.
                     * @type {number}
                     */
                    this.len = 0;
                    /**
                     * Operations head.
                     * @type {Object}
                     */
                    this.head = new Op(noop, 0, 0);
                    /**
                     * Operations tail
                     * @type {Object}
                     */
                    this.tail = this.head;
                    /**
                     * Linked forked states.
                     * @type {Object|null}
                     */
                    this.states = null;
                    // When a value is written, the writer calculates its byte length and puts it into a linked
                    // list of operations to perform when finish() is called. This both allows us to allocate
                    // buffers of the exact required size and reduces the amount of work we have to do compared
                    // to first calculating over objects and then encoding over objects. In our case, the encoding
                    // part is just a linked list walk calling operations with already prepared values.
                }
                /**
                 * Creates a new writer.
                 * @function
                 * @returns {BufferWriter|Writer} A {@link BufferWriter} when Buffers are supported, otherwise a {@link Writer}
                 */
                Writer.create = util.Buffer
                    ? function create_buffer_setup() {
                        return (Writer.create = function create_buffer() {
                            return new BufferWriter();
                        })();
                    }
                    : function create_array() {
                        return new Writer();
                    };
                /**
                 * Allocates a buffer of the specified size.
                 * @param {number} size Buffer size
                 * @returns {Uint8Array} Buffer
                 */
                Writer.alloc = function alloc(size) {
                    return new util.Array(size);
                };
                // Use Uint8Array buffer pool in the browser, just like node does with buffers
                /* istanbul ignore else */
                if (util.Array !== Array)
                    Writer.alloc = util.pool(Writer.alloc, util.Array.prototype.subarray);
                /**
                 * Pushes a new operation to the queue.
                 * @param {function(Uint8Array, number, *)} fn Function to call
                 * @param {number} len Value byte length
                 * @param {number} val Value to write
                 * @returns {Writer} `this`
                 * @private
                 */
                Writer.prototype._push = function push(fn, len, val) {
                    this.tail = this.tail.next = new Op(fn, len, val);
                    this.len += len;
                    return this;
                };
                function writeByte(val, buf, pos) {
                    buf[pos] = val & 255;
                }
                function writeVarint32(val, buf, pos) {
                    while (val > 127) {
                        buf[pos++] = val & 127 | 128;
                        val >>>= 7;
                    }
                    buf[pos] = val;
                }
                /**
                 * Constructs a new varint writer operation instance.
                 * @classdesc Scheduled varint writer operation.
                 * @extends Op
                 * @constructor
                 * @param {number} len Value byte length
                 * @param {number} val Value to write
                 * @ignore
                 */
                function VarintOp(len, val) {
                    this.len = len;
                    this.next = undefined;
                    this.val = val;
                }
                VarintOp.prototype = Object.create(Op.prototype);
                VarintOp.prototype.fn = writeVarint32;
                /**
                 * Writes an unsigned 32 bit value as a varint.
                 * @param {number} value Value to write
                 * @returns {Writer} `this`
                 */
                Writer.prototype.uint32 = function write_uint32(value) {
                    // here, the call to this.push has been inlined and a varint specific Op subclass is used.
                    // uint32 is by far the most frequently used operation and benefits significantly from this.
                    this.len += (this.tail = this.tail.next = new VarintOp((value = value >>> 0)
                        < 128 ? 1
                        : value < 16384 ? 2
                            : value < 2097152 ? 3
                                : value < 268435456 ? 4
                                    : 5, value)).len;
                    return this;
                };
                /**
                 * Writes a signed 32 bit value as a varint.
                 * @function
                 * @param {number} value Value to write
                 * @returns {Writer} `this`
                 */
                Writer.prototype.int32 = function write_int32(value) {
                    return value < 0
                        ? this._push(writeVarint64, 10, LongBits.fromNumber(value)) // 10 bytes per spec
                        : this.uint32(value);
                };
                /**
                 * Writes a 32 bit value as a varint, zig-zag encoded.
                 * @param {number} value Value to write
                 * @returns {Writer} `this`
                 */
                Writer.prototype.sint32 = function write_sint32(value) {
                    return this.uint32((value << 1 ^ value >> 31) >>> 0);
                };
                function writeVarint64(val, buf, pos) {
                    while (val.hi) {
                        buf[pos++] = val.lo & 127 | 128;
                        val.lo = (val.lo >>> 7 | val.hi << 25) >>> 0;
                        val.hi >>>= 7;
                    }
                    while (val.lo > 127) {
                        buf[pos++] = val.lo & 127 | 128;
                        val.lo = val.lo >>> 7;
                    }
                    buf[pos++] = val.lo;
                }
                /**
                 * Writes an unsigned 64 bit value as a varint.
                 * @param {Long|number|string} value Value to write
                 * @returns {Writer} `this`
                 * @throws {TypeError} If `value` is a string and no long library is present.
                 */
                Writer.prototype.uint64 = function write_uint64(value) {
                    var bits = LongBits.from(value);
                    return this._push(writeVarint64, bits.length(), bits);
                };
                /**
                 * Writes a signed 64 bit value as a varint.
                 * @function
                 * @param {Long|number|string} value Value to write
                 * @returns {Writer} `this`
                 * @throws {TypeError} If `value` is a string and no long library is present.
                 */
                Writer.prototype.int64 = Writer.prototype.uint64;
                /**
                 * Writes a signed 64 bit value as a varint, zig-zag encoded.
                 * @param {Long|number|string} value Value to write
                 * @returns {Writer} `this`
                 * @throws {TypeError} If `value` is a string and no long library is present.
                 */
                Writer.prototype.sint64 = function write_sint64(value) {
                    var bits = LongBits.from(value).zzEncode();
                    return this._push(writeVarint64, bits.length(), bits);
                };
                /**
                 * Writes a boolish value as a varint.
                 * @param {boolean} value Value to write
                 * @returns {Writer} `this`
                 */
                Writer.prototype.bool = function write_bool(value) {
                    return this._push(writeByte, 1, value ? 1 : 0);
                };
                function writeFixed32(val, buf, pos) {
                    buf[pos] = val & 255;
                    buf[pos + 1] = val >>> 8 & 255;
                    buf[pos + 2] = val >>> 16 & 255;
                    buf[pos + 3] = val >>> 24;
                }
                /**
                 * Writes an unsigned 32 bit value as fixed 32 bits.
                 * @param {number} value Value to write
                 * @returns {Writer} `this`
                 */
                Writer.prototype.fixed32 = function write_fixed32(value) {
                    return this._push(writeFixed32, 4, value >>> 0);
                };
                /**
                 * Writes a signed 32 bit value as fixed 32 bits.
                 * @function
                 * @param {number} value Value to write
                 * @returns {Writer} `this`
                 */
                Writer.prototype.sfixed32 = Writer.prototype.fixed32;
                /**
                 * Writes an unsigned 64 bit value as fixed 64 bits.
                 * @param {Long|number|string} value Value to write
                 * @returns {Writer} `this`
                 * @throws {TypeError} If `value` is a string and no long library is present.
                 */
                Writer.prototype.fixed64 = function write_fixed64(value) {
                    var bits = LongBits.from(value);
                    return this._push(writeFixed32, 4, bits.lo)._push(writeFixed32, 4, bits.hi);
                };
                /**
                 * Writes a signed 64 bit value as fixed 64 bits.
                 * @function
                 * @param {Long|number|string} value Value to write
                 * @returns {Writer} `this`
                 * @throws {TypeError} If `value` is a string and no long library is present.
                 */
                Writer.prototype.sfixed64 = Writer.prototype.fixed64;
                /**
                 * Writes a float (32 bit).
                 * @function
                 * @param {number} value Value to write
                 * @returns {Writer} `this`
                 */
                Writer.prototype.float = function write_float(value) {
                    return this._push(util.float.writeFloatLE, 4, value);
                };
                /**
                 * Writes a double (64 bit float).
                 * @function
                 * @param {number} value Value to write
                 * @returns {Writer} `this`
                 */
                Writer.prototype.double = function write_double(value) {
                    return this._push(util.float.writeDoubleLE, 8, value);
                };
                var writeBytes = util.Array.prototype.set
                    ? function writeBytes_set(val, buf, pos) {
                        buf.set(val, pos); // also works for plain array values
                    }
                    : function writeBytes_for(val, buf, pos) {
                        for (var i = 0; i < val.length; ++i)
                            buf[pos + i] = val[i];
                    };
                /**
                 * Writes a sequence of bytes.
                 * @param {Uint8Array|string} value Buffer or base64 encoded string to write
                 * @returns {Writer} `this`
                 */
                Writer.prototype.bytes = function write_bytes(value) {
                    var len = value.length >>> 0;
                    if (!len)
                        return this._push(writeByte, 1, 0);
                    if (util.isString(value)) {
                        var buf = Writer.alloc(len = base64.length(value));
                        base64.decode(value, buf, 0);
                        value = buf;
                    }
                    return this.uint32(len)._push(writeBytes, len, value);
                };
                /**
                 * Writes a string.
                 * @param {string} value Value to write
                 * @returns {Writer} `this`
                 */
                Writer.prototype.string = function write_string(value) {
                    var len = utf8.length(value);
                    return len
                        ? this.uint32(len)._push(utf8.write, len, value)
                        : this._push(writeByte, 1, 0);
                };
                /**
                 * Forks this writer's state by pushing it to a stack.
                 * Calling {@link Writer#reset|reset} or {@link Writer#ldelim|ldelim} resets the writer to the previous state.
                 * @returns {Writer} `this`
                 */
                Writer.prototype.fork = function fork() {
                    this.states = new State(this);
                    this.head = this.tail = new Op(noop, 0, 0);
                    this.len = 0;
                    return this;
                };
                /**
                 * Resets this instance to the last state.
                 * @returns {Writer} `this`
                 */
                Writer.prototype.reset = function reset() {
                    if (this.states) {
                        this.head = this.states.head;
                        this.tail = this.states.tail;
                        this.len = this.states.len;
                        this.states = this.states.next;
                    }
                    else {
                        this.head = this.tail = new Op(noop, 0, 0);
                        this.len = 0;
                    }
                    return this;
                };
                /**
                 * Resets to the last state and appends the fork state's current write length as a varint followed by its operations.
                 * @returns {Writer} `this`
                 */
                Writer.prototype.ldelim = function ldelim() {
                    var head = this.head, tail = this.tail, len = this.len;
                    this.reset().uint32(len);
                    if (len) {
                        this.tail.next = head.next; // skip noop
                        this.tail = tail;
                        this.len += len;
                    }
                    return this;
                };
                /**
                 * Finishes the write operation.
                 * @returns {Uint8Array} Finished buffer
                 */
                Writer.prototype.finish = function finish() {
                    var head = this.head.next, // skip noop
                    buf = this.constructor.alloc(this.len), pos = 0;
                    while (head) {
                        head.fn(head.val, buf, pos);
                        pos += head.len;
                        head = head.next;
                    }
                    // this.head = this.tail = null;
                    return buf;
                };
                Writer._configure = function (BufferWriter_) {
                    BufferWriter = BufferWriter_;
                };
            }, { "39": 39 }], 43: [function (require, module, exports) {
                "use strict";
                module.exports = BufferWriter;
                // extends Writer
                var Writer = require(42);
                (BufferWriter.prototype = Object.create(Writer.prototype)).constructor = BufferWriter;
                var util = require(39);
                var Buffer = util.Buffer;
                /**
                 * Constructs a new buffer writer instance.
                 * @classdesc Wire format writer using node buffers.
                 * @extends Writer
                 * @constructor
                 */
                function BufferWriter() {
                    Writer.call(this);
                }
                /**
                 * Allocates a buffer of the specified size.
                 * @param {number} size Buffer size
                 * @returns {Buffer} Buffer
                 */
                BufferWriter.alloc = function alloc_buffer(size) {
                    return (BufferWriter.alloc = util._Buffer_allocUnsafe)(size);
                };
                var writeBytesBuffer = Buffer && Buffer.prototype instanceof Uint8Array && Buffer.prototype.set.name === "set"
                    ? function writeBytesBuffer_set(val, buf, pos) {
                        buf.set(val, pos); // faster than copy (requires node >= 4 where Buffers extend Uint8Array and set is properly inherited)
                        // also works for plain array values
                    }
                    : function writeBytesBuffer_copy(val, buf, pos) {
                        if (val.copy)
                            val.copy(buf, pos, 0, val.length);
                        else
                            for (var i = 0; i < val.length;)
                                buf[pos++] = val[i++];
                    };
                /**
                 * @override
                 */
                BufferWriter.prototype.bytes = function write_bytes_buffer(value) {
                    if (util.isString(value))
                        value = util._Buffer_from(value, "base64");
                    var len = value.length >>> 0;
                    this.uint32(len);
                    if (len)
                        this._push(writeBytesBuffer, len, value);
                    return this;
                };
                function writeStringBuffer(val, buf, pos) {
                    if (val.length < 40)
                        util.utf8.write(val, buf, pos);
                    else
                        buf.utf8Write(val, pos);
                }
                /**
                 * @override
                 */
                BufferWriter.prototype.string = function write_string_buffer(value) {
                    var len = Buffer.byteLength(value);
                    this.uint32(len);
                    if (len)
                        this._push(writeStringBuffer, len, value);
                    return this;
                };
                /**
                 * Finishes the write operation.
                 * @name BufferWriter#finish
                 * @function
                 * @returns {Buffer} Finished buffer
                 */
            }, { "39": 39, "42": 42 }] }, {}, [19]);
})(typeof window === "object" && window || typeof self === "object" && self || this);
//# sourceMappingURL=protobuf.js.map
