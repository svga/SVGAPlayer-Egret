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
        this.alpha = parseFloat(spec.alpha) || 0.0;
        if (spec.layout) {
            this.layout.x = parseFloat(spec.layout.x) || 0.0;
            this.layout.y = parseFloat(spec.layout.y) || 0.0;
            this.layout.width = parseFloat(spec.layout.width) || 0.0;
            this.layout.height = parseFloat(spec.layout.height) || 0.0;
        }
        if (spec.transform) {
            this.transform.a = parseFloat(spec.transform.a) || 1.0;
            this.transform.b = parseFloat(spec.transform.b) || 0.0;
            this.transform.c = parseFloat(spec.transform.c) || 0.0;
            this.transform.d = parseFloat(spec.transform.d) || 1.0;
            this.transform.tx = parseFloat(spec.transform.tx) || 0.0;
            this.transform.ty = parseFloat(spec.transform.ty) || 0.0;
        }
        var llx = this.transform.a * this.layout.x + this.transform.c * this.layout.y + this.transform.tx;
        var lrx = this.transform.a * (this.layout.x + this.layout.width) + this.transform.c * this.layout.y + this.transform.tx;
        var lbx = this.transform.a * this.layout.x + this.transform.c * (this.layout.y + this.layout.height) + this.transform.tx;
        var rbx = this.transform.a * (this.layout.x + this.layout.width) + this.transform.c * (this.layout.y + this.layout.height) + this.transform.tx;
        var lly = this.transform.b * this.layout.x + this.transform.d * this.layout.y + this.transform.ty;
        var lry = this.transform.b * (this.layout.x + this.layout.width) + this.transform.d * this.layout.y + this.transform.ty;
        var lby = this.transform.b * this.layout.x + this.transform.d * (this.layout.y + this.layout.height) + this.transform.ty;
        var rby = this.transform.b * (this.layout.x + this.layout.width) + this.transform.d * (this.layout.y + this.layout.height) + this.transform.ty;
        this.nx = Math.min(Math.min(lbx, rbx), Math.min(llx, lrx));
        this.ny = Math.min(Math.min(lby, rby), Math.min(lly, lry));
    }
    return FrameEntity;
}());
__reflect(FrameEntity.prototype, "FrameEntity");
//# sourceMappingURL=FrameEntity.js.map