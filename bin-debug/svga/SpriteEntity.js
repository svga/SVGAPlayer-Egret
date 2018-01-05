var __reflect = (this && this.__reflect) || function (p, c, t) {
    p.__class__ = c, t ? t.push(c) : t = [c], p.__types__ = p.__types__ ? t.concat(p.__types__) : t;
};
var SpriteEntity = (function () {
    function SpriteEntity(spec) {
        this.imageKey = null;
        this.frames = [];
        this.imageKey = spec.imageKey;
        if (spec.frames) {
            this.frames = spec.frames.map(function (obj) {
                return new FrameEntity(obj);
            });
        }
    }
    return SpriteEntity;
}());
__reflect(SpriteEntity.prototype, "SpriteEntity");
//# sourceMappingURL=SpriteEntity.js.map