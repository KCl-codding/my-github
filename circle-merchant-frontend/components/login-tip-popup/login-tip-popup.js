Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: '登录提示'
    },
    desc: {
      type: String,
      value: '登录后即可享受更多精彩功能'
    },
    cancelText: {
      type: String,
      value: '暂不登录'
    },
    confirmText: {
      type: String,
      value: '去登录'
    }
  },

  methods: {
    // 关闭弹窗（用户点击遮罩或取消按钮）
    onClose() {
      this.triggerEvent('close');
    },
    
    // 点击取消按钮
    onCancel() {
      this.triggerEvent('cancel');
      this.triggerEvent('close');
    },
    
    // 点击确认按钮（去登录）
    onConfirm() {
      this.triggerEvent('confirm');
      this.triggerEvent('close');
    }
  }
});