
class Main extends eui.UILayer {

    protected createChildren(): void {
        super.createChildren();

        let parser = new Parser()
        let player = new Player()
        
        // player.loops = 1
        player.width = 500 
        player.height = 500
        player.x = 100
        player.y = 100
        player.clearsAfterStop = false
        this.addChild(player)
        
        parser.load('http://p275rzl86.bkt.clouddn.com/shengli_mask.svga', function(videoItem){

            player.setVideoItem(videoItem)
            player.startAnimation()
        }, function(error){})
    }
}
