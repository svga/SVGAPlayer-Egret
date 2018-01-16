

 class SVGALayer extends egret.DisplayObjectContainer{

     constructor(){
         super()

     }

     public setFrame(x: number, y: number, width: number, height: number){
         this.x = x
         this.y = y
         this.width = width
         this.height = height
     }
 }