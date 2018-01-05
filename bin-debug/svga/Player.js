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
        _this._asChild = false;
        _this._container = undefined;
        _this._renderer = undefined;
        _this._ticker = undefined;
        _this._drawingCanvas = undefined;
        _this._contentMode = "AspectFit";
        _this._videoItem = undefined;
        _this._loopCount = 0;
        _this._currentFrame = 0;
        _this._dynamicImage = {};
        _this._dynamicImageTransform = {};
        _this._dynamicText = {};
        _this._onFinished = undefined;
        _this._onFrame = undefined;
        _this._onPercentage = undefined;
        _this._nextTickTime = 0;
        _this._init();
        return _this;
    }
    Player.prototype._init = function () {
        var shp = new egret.Shape();
        shp.graphics.beginFill(0x00ff00);
        shp.graphics.drawRect(0, 0, 100, 100);
        shp.graphics.endFill();
        shp.x = 100;
        shp.y = 100;
        this.addChild(shp);
    };
    Player.prototype.setVideoItem = function (videoItem) {
        this._currentFrame = 0;
        this._videoItem = videoItem;
        // this._renderer.prepare();
        // this.clear();
        // this._update();
    };
    Player.prototype.startAnimation = function () {
        // this.stopAnimation(false);
        // this._currentFrame = 0;
        // this._loopCount = 0;
        // this._ticker.start();
    };
    return Player;
}(egret.DisplayObjectContainer));
__reflect(Player.prototype, "Player");
//# sourceMappingURL=Player.js.map