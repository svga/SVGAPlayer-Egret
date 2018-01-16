
class Main extends egret.DisplayObjectContainer {

    constructor() {
        super()

        this.setupSVGAnimation()
    }

    setupSVGAnimation() {

        let shape: egret.Shape = new egret.Shape()
        shape.x = 0
        shape.y = 0
        shape.width = 500
        shape.height = 500

        shape.graphics.beginFill(0x000ff);
		shape.graphics.drawRect(0, 0, 500, 500);
		shape.graphics.endFill();

        this.addChild(shape)

        let parser = new Parser()
        let player = new Player()

        player.loops = 1
        player.width = 100
        player.height = 100
        player.x = 0
        player.y = 0
        player.clearsAfterStop = false
        this.addChild(player)

        parser.load('http://p275rzl86.bkt.clouddn.com/bear.svga', function (videoItem) {

            player.setVideoItem(videoItem)
            player.startAnimation()
        }, function (error) { })
    }
}
