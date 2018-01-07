var __reflect = (this && this.__reflect) || function (p, c, t) {
    p.__class__ = c, t ? t.push(c) : t = [c], p.__types__ = p.__types__ ? t.concat(p.__types__) : t;
};
var Renderer = (function () {
    function Renderer(owner) {
        this.owner = undefined;
        this.prepared = false;
        this.undrawFrame = undefined;
        this.bitmapCache = undefined;
        this.owner = owner;
    }
    Renderer.prototype.prepare = function () {
        var _this = this;
        this.prepared = false;
        this.bitmapCache = undefined;
        var bitmapKey = Object.keys(this.owner.videoItem.images);
        if (this.owner.videoItem.images === undefined || bitmapKey.length == 0) {
            this.bitmapCache = {};
            this.prepared = true;
            return;
        }
        if (this.bitmapCache === undefined) {
            this.bitmapCache = {};
            var totalCount_1 = 0;
            var loadedCount_1 = 0;
            var _loop_1 = function () {
                var src = this_1.owner.videoItem.images[imageKey];
                if (src.indexOf("iVBO") === 0 || src.indexOf("/9j/2w") === 0) {
                    totalCount_1++;
                    var imgTag_1 = new Image;
                    imgTag_1.onload = function () {
                        imgTag_1.onload = null;
                        loadedCount_1++;
                        if (loadedCount_1 == totalCount_1) {
                            _this.prepared = true;
                            if (typeof _this.undrawFrame === "number") {
                                _this.drawFrame(_this.undrawFrame);
                                _this.undrawFrame = undefined;
                            }
                        }
                    };
                    imgTag_1.src = 'data:image/png;base64,' + src;
                    this_1.bitmapCache[imageKey] = imgTag_1;
                    // let imgTag = document.createElement('img');
                    // imgTag.onload = function () {
                    //     loadedCount++;
                    //     if (loadedCount == totalCount) {
                    //         this.prepared = true
                    //         if (typeof this._undrawFrame === "number") {
                    //             this.drawFrame(this._undrawFrame);
                    //             this._undrawFrame = undefined;
                    //         }
                    //     }
                    // }.bind(this);
                    // imgTag.src = 'data:image/png;base64,' + src;
                }
            };
            var this_1 = this;
            for (var imageKey in this.owner.videoItem.images) {
                _loop_1();
            }
            this.prepared = true;
        }
    };
    Renderer.prototype.clear = function () {
    };
    Renderer.prototype.drawFrame = function (frame) {
        var _this = this;
        if (this.prepared) {
            // const ctx = (this.owner._drawingCanvas || this.owner._container).getContext('2d')
            // const areaFrame = {
            //     x: 0.0,
            //     y: 0.0,
            //     width: (this.owner._drawingCanvas || this._owner._container).width,
            //     height: (this._owner._drawingCanvas || this._owner._container).height,
            // }
            // ctx.clearRect(areaFrame.x, areaFrame.y, areaFrame.width, areaFrame.height)
            this.owner.videoItem.sprites.forEach(function (sprite) {
                var frameItem = sprite.frames[_this.owner.currentFrame];
                if (frameItem.alpha < 0.05) {
                    return;
                }
                // 
                var src = _this.bitmapCache[sprite.imageKey] || _this.owner.videoItem.images[sprite.imageKey];
                var myBmp = new egret.Bitmap(src);
                console.log(myBmp);
            });
        }
        else {
            this.undrawFrame = frame;
        }
    };
    return Renderer;
}());
__reflect(Renderer.prototype, "Renderer");
//# sourceMappingURL=Renderer.js.map