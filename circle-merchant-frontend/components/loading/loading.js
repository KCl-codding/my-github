Component({
  options: {
    multipleSlots: true
  },
  
  properties: {
    // 是否显示loading
    visible: {
      type: Boolean,
      value: false
    },
    // loading提示文字
    text: {
      type: String,
      value: '努力加载中...'
    },
    // 是否显示遮罩层
    mask: {
      type: Boolean,
      value: false
    },
    // 遮罩层是否可点击关闭
    maskClosable: {
      type: Boolean,
      value: false
    },
    // 图片尺寸（单位rpx）
    size: {
      type: Number,
      value: 180
    },
    // 是否全屏
    fullscreen: {
      type: Boolean,
      value: false
    },
    // 背景颜色
    backgroundColor: {
      type: String,
      value: 'rgba(100, 100, 100, 0.7)'
    },
    // 是否显示圆角背景框
    showBackground: {
      type: Boolean,
      value: true
    }
  },

  data: {
    // GIF图片路径（使用全局默认路径）
    gifSrc: ''
  },

  lifetimes: {
    attached() {
      // 从app全局获取GIF路径，或者使用默认路径
      const app = getApp();
      if (app.globalData && app.globalData.loadingGif) {
        this.setData({
          gifSrc: app.globalData.loadingGif
        });
      } else {
        // 默认路径，可以根据实际情况修改
        this.setData({
          gifSrc: 'loading.gif'
        });
      }
    }
  },

  methods: {
    // 点击遮罩层
    onMaskTap() {
      if (this.properties.maskClosable) {
        this.triggerEvent('close');
        this.setData({
          visible: false
        });
      }
    },
    
    // 显示loading
    show() {
      this.setData({
        visible: true
      });
    },
    
    // 隐藏loading
    hide() {
      this.setData({
        visible: false
      });
    },
    
    // 设置GIF路径（支持动态修改）
    setGifSrc(path) {
      this.setData({
        gifSrc: path
      });
    }
  }
});