// components/group-avatar/group-avatar.js
Component({
  properties: {
    memberAvatars: {
      type: Array,
      value: [],
      observer: '_onAvatarChange'
    },
    // 每个小头像的尺寸（rpx）
    itemSize: {
      type: Number,
      value: 32
    },
    // 头像间距（rpx）
    gap: {
      type: Number,
      value: 4
    }
  },

  data: {
    defaultAvatar: '/images/default-avatar.png',
    displayAvatars: [],
    totalCount: 0,
    containerWidth: 32,
    containerHeight: 32,
    borderRadius: 8
  },

  lifetimes: {
    attached() {
      this.updateDisplayAvatars();
    }
  },

  methods: {
    _onAvatarChange(newVal, oldVal) {
      if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
        this.updateDisplayAvatars();
      }
    },

    updateDisplayAvatars() {
      const avatars = this.properties.memberAvatars || [];
      const totalCount = avatars.length;
      const validAvatars = avatars.filter(url => url && typeof url === 'string' && url.length > 0);
      const displayAvatars = validAvatars.slice(0, 9);
      
      // 计算容器尺寸
      const { itemSize, gap } = this.properties;
      const count = Math.min(displayAvatars.length, 9);
      let cols = 1, rows = 1;
      
      if (count === 1) {
        cols = 1;
        rows = 1;
      } else if (count === 2) {
        cols = 2;
        rows = 1;
      } else if (count === 3) {
        cols = 2;
        rows = 2;
      } else if (count === 4) {
        cols = 2;
        rows = 2;
      } else {
        cols = 3;
        rows = 3;
      }
      
      const containerWidth = cols * itemSize + (cols - 1) * gap;
      const containerHeight = rows * itemSize + (rows - 1) * gap;
      const borderRadius = Math.min(containerWidth / 8, 12);
      
      this.setData({ 
        displayAvatars: displayAvatars,
        totalCount: totalCount,
        containerWidth: containerWidth,
        containerHeight: containerHeight,
        borderRadius: borderRadius
      });
    }
  }
});