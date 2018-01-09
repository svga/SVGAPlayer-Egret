
class Main extends eui.UILayer {

    protected createChildren(): void {
        super.createChildren();

        let parser = new Parser()
        let player = new Player()
        this.addChild(player)
        
        parser.load('http://p275rzl86.bkt.clouddn.com/shengli.svga', function(videoItem){
            
            console.log(videoItem)

            player.setVideoItem(videoItem)
            player.startAnimation()
        }, function(error){})
    }
}
