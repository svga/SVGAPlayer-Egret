var __reflect = (this && this.__reflect) || function (p, c, t) {
    p.__class__ = c, t ? t.push(c) : t = [c], p.__types__ = p.__types__ ? t.concat(p.__types__) : t;
};
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var Player = (function (_super) {
    __extends(Player, _super);
    function Player() {
        var _this = _super.call(this) || this;
        _this.loops = 0;
        _this.clearsAfterStop = true;
        _this.fillMode = "Forward";
        /**
         * Private methods & properties
         */
        _this.asChild = false;
        _this.container = undefined;
        _this.renderer = undefined;
        _this.ticker = undefined;
        _this.drawingCanvas = undefined;
        _this.contentMode = "AspectFit";
        _this.videoItem = undefined;
        _this.loopCount = 0;
        _this.currentFrame = 0;
        _this.dynamicImage = {};
        _this.dynamicImageTransform = {};
        _this.dynamicText = {};
        _this.onFinished = undefined;
        _this.onFrame = undefined;
        _this.onPercentage = undefined;
        _this.nextTickTime = 0;
        _this.init();
        return _this;
    }
    Player.prototype.init = function () {
        // if (this._container instanceof HTMLDivElement || this._asChild) {
        //     if (this._container) {
        //         const existedCanvasElements = this._container.querySelectorAll('canvas');
        //         for (let index = 0; index < existedCanvasElements.length; index++) {
        //             let element = existedCanvasElements[index];
        //             if (element !== undefined && element.__isPlayer) {
        //                 this._container.removeChild(element);
        //             }
        //         }
        //     }
        //     this._drawingCanvas = document.createElement('canvas');
        //     this._drawingCanvas.__isPlayer = true
        //     this._drawingCanvas.style.backgroundColor = "transparent"
        //     if (this._container) {
        //         this._container.appendChild(this._drawingCanvas);
        //         this._container.style.textAlign = "left";
        //     }
        // }
        this.renderer = new Renderer(this);
        this.ticker = new Ticker(this);
    };
    Player.prototype.setVideoItem = function (videoItem) {
        this.currentFrame = 0;
        this.videoItem = videoItem;
        this.renderer.prepare();
        this.clear();
        this.update();
    };
    Player.prototype.startAnimation = function () {
        // this.stopAnimation(false);
        // this._currentFrame = 0;
        // this._loopCount = 0;
        // this._ticker.start();
    };
    Player.prototype._onTick = function () {
        if (typeof this.videoItem === "object") {
            if (performance.now() >= this.nextTickTime) {
                // this.nextTickTime = parseInt(1000 / this.videoItem.FPS) + performance.now() - (60 / this.videoItem.FPS) * 2
                // this.();
            }
        }
    };
    Player.prototype.clear = function () {
        this.renderer.clear();
    };
    Player.prototype.resize = function () {
        // let asParent = false;
        // if (this._drawingCanvas) {
        //     let scaleX = 1.0; let scaleY = 1.0; let translateX = 0.0; let translateY = 0.0;
        //     let targetSize;
        //     if (this._drawingCanvas.parentNode) {
        //         targetSize = { width: this._drawingCanvas.parentNode.clientWidth, height: this._drawingCanvas.parentNode.clientHeight };
        //     }
        //     else {
        //         targetSize = this._videoItem.videoSize;
        //     }
        //     let imageSize = this._videoItem.videoSize;
        //     if (targetSize.width >= imageSize.width && targetSize.height >= imageSize.height) {
        //         this._drawingCanvas.width = targetSize.width;
        //         this._drawingCanvas.height = targetSize.height;
        //         this._drawingCanvas.style.webkitTransform = this._drawingCanvas.style.transform = "";
        //         asParent = true;
        //     }
        //     else {
        //         this._drawingCanvas.width = imageSize.width;
        //         this._drawingCanvas.height = imageSize.height;
        //         if (this._contentMode === "Fill") {
        //             const scaleX = targetSize.width / imageSize.width;
        //             const scaleY = targetSize.height / imageSize.height;
        //             const translateX = (imageSize.width * scaleX - imageSize.width) / 2.0
        //             const translateY = (imageSize.height * scaleY - imageSize.height) / 2.0
        //             this._drawingCanvas.style.webkitTransform = this._drawingCanvas.style.transform = "matrix(" + scaleX + ", 0.0, 0.0, " + scaleY + ", " + translateX + ", " + translateY + ")"
        //         }
        //         else if (this._contentMode === "AspectFit" || this._contentMode === "AspectFill") {
        //             const imageRatio = imageSize.width / imageSize.height;
        //             const viewRatio = targetSize.width / targetSize.height;
        //             if ((imageRatio >= viewRatio && this._contentMode === "AspectFit") || (imageRatio < viewRatio && this._contentMode === "AspectFill")) {
        //                 const scale = targetSize.width / imageSize.width;
        //                 const translateX = (imageSize.width * scale - imageSize.width) / 2.0
        //                 const translateY = (imageSize.height * scale - imageSize.height) / 2.0 + (targetSize.height - imageSize.height * scale) / 2.0
        //                 this._drawingCanvas.style.webkitTransform = this._drawingCanvas.style.transform = "matrix(" + scale + ", 0.0, 0.0, " + scale + ", " + translateX + ", " + translateY + ")"
        //             }
        //             else if ((imageRatio < viewRatio && this._contentMode === "AspectFit") || (imageRatio > viewRatio && this._contentMode === "AspectFill")) {
        //                 const scale = targetSize.height / imageSize.height;
        //                 const translateX = (imageSize.width * scale - imageSize.width) / 2.0 + (targetSize.width - imageSize.width * scale) / 2.0
        //                 const translateY = (imageSize.height * scale - imageSize.height) / 2.0
        //                 this._drawingCanvas.style.webkitTransform = this._drawingCanvas.style.transform = "matrix(" + scale + ", 0.0, 0.0, " + scale + ", " + translateX + ", " + translateY + ")"
        //             }
        //         }
        //         this._globalTransform = undefined;
        //     }
        // }
        // if (this._drawingCanvas === undefined || asParent === true) {
        //     let scaleX = 1.0; let scaleY = 1.0; let translateX = 0.0; let translateY = 0.0;
        //     let targetSize = { width: this._container !== undefined ? this._container.clientWidth : 0.0, height: this._container !== undefined ? this._container.clientHeight : 0.0 };
        //     let imageSize = this._videoItem.videoSize;
        //     if (this._contentMode === "Fill") {
        //         scaleX = targetSize.width / imageSize.width;
        //         scaleY = targetSize.height / imageSize.height;
        //     }
        //     else if (this._contentMode === "AspectFit" || this._contentMode === "AspectFill") {
        //         const imageRatio = imageSize.width / imageSize.height;
        //         const viewRatio = targetSize.width / targetSize.height;
        //         if ((imageRatio >= viewRatio && this._contentMode === "AspectFit") || (imageRatio <= viewRatio && this._contentMode === "AspectFill")) {
        //             scaleX = scaleY = targetSize.width / imageSize.width;
        //             translateY = (targetSize.height - imageSize.height * scaleY) / 2.0
        //         }
        //         else if ((imageRatio < viewRatio && this._contentMode === "AspectFit") || (imageRatio > viewRatio && this._contentMode === "AspectFill")) {
        //             scaleX = scaleY = targetSize.height / imageSize.height;
        //             translateX = (targetSize.width - imageSize.width * scaleX) / 2.0
        //         }
        //     }
        //     this._globalTransform = { a: scaleX, b: 0.0, c: 0.0, d: scaleY, tx: translateX, ty: translateY };
        // }
    };
    Player.prototype.update = function () {
        if (this.videoItem === undefined) {
            return;
        }
        this.resize();
        this.renderer.drawFrame(this.currentFrame);
    };
    return Player;
}(egret.DisplayObjectContainer));
__reflect(Player.prototype, "Player");
//# sourceMappingURL=Player.js.map