
class Main extends eui.UILayer {
    /**
     * 加载进度界面
     * loading process interface
     */
    protected createChildren(): void {
        super.createChildren();

        egret.lifecycle.addLifecycleListener((context) => {
            // custom lifecycle plugin
        })

        egret.lifecycle.onPause = () => {
            egret.ticker.pause();
        }

        egret.lifecycle.onResume = () => {
            egret.ticker.resume();
        }

        // console.log(egret.startTick)

        let parser = new Parser()
        let player = new Player()
        this.addChild(player)
        
        parser.load('http://p275rzl86.bkt.clouddn.com/shengli.svga?attname=&e=1515350933&token=aDjwKWEnt6_vcZq-B509kUsJmqhugDX9NijIHPZE:ePFgvORb_8xDO16anD_Uc67TbpA', function(videoItem){
            
            player.setVideoItem(videoItem)
            player.startAnimation()
        }, function(error){})
    }
}
