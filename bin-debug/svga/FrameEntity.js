var __reflect = (this && this.__reflect) || function (p, c, t) {
    p.__class__ = c, t ? t.push(c) : t = [c], p.__types__ = p.__types__ ? t.concat(p.__types__) : t;
};
var FrameEntity = (function () {
    function FrameEntity(spec) {
        this.alpha = 0.0;
        this.transform = {
            a: 1.0,
            b: 0.0,
            c: 0.0,
            d: 1.0,
            tx: 0.0,
            ty: 0.0,
        };
        this.layout = {
            x: 0.0,
            y: 0.0,
            width: 0.0,
            height: 0.0,
        };
        this.nx = 0.0;
        this.ny = 0.0;
        /**
         * BezierPath
         */
        this.maskPath = null;
        /**
         * Object[]
         */
        this.shapes = [];
    }
    return FrameEntity;
}());
__reflect(FrameEntity.prototype, "FrameEntity");
//# sourceMappingURL=FrameEntity.js.map