
class Player extends egret.DisplayObjectContainer {
    loops: number = 0;
    clearsAfterStop: boolean = true;
    fillMode: string = "Forward";

    /**
     * Private methods & properties
     */
    private _asChild = false;
    private _container = undefined;
    private _renderer = undefined;
    private _ticker = undefined;
    private _drawingCanvas = undefined;
    private _contentMode = "AspectFit"
    private _videoItem = undefined;
    private _loopCount = 0;
    private _currentFrame = 0;
    private _dynamicImage = {};
    private _dynamicImageTransform = {};
    private _dynamicText = {};
    private _onFinished = undefined;
    private _onFrame = undefined;
    private _onPercentage = undefined;
    private _nextTickTime = 0;
    
    constructor(){
        super()
        
        this._init()
    }

    private _init() {
        var shp:egret.Shape = new egret.Shape();
        shp.graphics.beginFill( 0x00ff00 );
        shp.graphics.drawRect( 0, 0, 100, 100 );
        shp.graphics.endFill();
        shp.x = 100;
        shp.y = 100;
        this.addChild( shp );
    }

    public setVideoItem(videoItem: any) {
        this._currentFrame = 0;
        this._videoItem = videoItem;
        // this._renderer.prepare();
        // this.clear();
        // this._update();
    }

     public startAnimation() {
        // this.stopAnimation(false);
        // this._currentFrame = 0;
        // this._loopCount = 0;
        // this._ticker.start();
    }
}