var __reflect = (this && this.__reflect) || function (p, c, t) {
    p.__class__ = c, t ? t.push(c) : t = [c], p.__types__ = p.__types__ ? t.concat(p.__types__) : t;
};
var VideoEntity = (function () {
    function VideoEntity(spec, images) {
        /**
         * SVGA 文件版本
         */
        this.version = "";
        /**
         * 影片尺寸
         */
        this.videoSize = { width: 0, height: 0 };
        /**
         * 帧率
         */
        this.FPS = 20;
        /**
         * 帧数
         */
        this.frames = 0;
        /**
         * Bitmaps
         */
        this.images = {};
        /**
         * SpriteEntity[]
         */
        this.sprites = [];
        if (typeof spec === "object" && spec.$type == ProtoBufDecoder.shareProtoBufDecoder().protoMovieEntity) {
            if (typeof spec.params === "object") {
                this.version = spec.ver;
                this.videoSize.width = spec.params.viewBoxWidth || 0.0;
                this.videoSize.height = spec.params.viewBoxHeight || 0.0;
                this.FPS = spec.params.fps || 20;
                this.frames = spec.params.frames || 0;
            }
            this.resetSprites(spec);
        }
        if (images) {
            this.images = images;
        }
    }
    VideoEntity.prototype.resetSprites = function (spec) {
        if (spec.sprites instanceof Array) {
            this.sprites = spec.sprites.map(function (obj) {
                return new SpriteEntity(obj);
            });
        }
    };
    return VideoEntity;
}());
__reflect(VideoEntity.prototype, "VideoEntity");
//# sourceMappingURL=VideoEntity.js.map