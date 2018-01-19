
class Main extends egret.DisplayObjectContainer {

    constructor() {
        super()

        this.setupSVGAnimation()
    }

    setupSVGAnimation() {

        let parser = new Parser()
        let player = new Player()

        // player.loops = 1
        player.width = 550  
        player.height = 400
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
