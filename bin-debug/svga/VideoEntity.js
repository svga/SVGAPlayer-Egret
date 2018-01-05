var __reflect = (this && this.__reflect) || function (p, c, t) {
    p.__class__ = c, t ? t.push(c) : t = [c], p.__types__ = p.__types__ ? t.concat(p.__types__) : t;
};
var VideoEntity = (function () {
    function VideoEntity(spec, images) {
        /**
         * 影片尺寸
         */
        this.videoSize = { width: 0, height: 0 };
        this.videoSize.width = spec.params.viewBoxWidth || 0.0;
        this.videoSize.height = spec.params.viewBoxHeight || 0.0;
    }
    return VideoEntity;
}());
__reflect(VideoEntity.prototype, "VideoEntity");
//# sourceMappingURL=VideoEntity.js.map