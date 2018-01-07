var __reflect = (this && this.__reflect) || function (p, c, t) {
    p.__class__ = c, t ? t.push(c) : t = [c], p.__types__ = p.__types__ ? t.concat(p.__types__) : t;
};
var Ticker = (function () {
    function Ticker(owner) {
        this.owner = undefined;
        this.running = false;
        this.owner = owner;
    }
    Ticker.prototype.start = function () {
        var _this = this;
        if (this.running) {
            return;
        }
        this.running = true;
        var requestFrame = function () {
            egret.startTick(function (timeStamp) {
                _this.owner._onTick();
                if (_this.running === true) {
                    requestFrame();
                }
                //TODO: I don't know the boolean return for what?
                return false;
            }, _this);
        };
        requestFrame();
    };
    Ticker.prototype.stop = function () {
        this.running = false;
    };
    return Ticker;
}());
__reflect(Ticker.prototype, "Ticker");
//# sourceMappingURL=Ticker.js.map