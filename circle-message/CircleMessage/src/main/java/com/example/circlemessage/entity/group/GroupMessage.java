package com.example.circlemessage.entity.group;

import com.baomidou.mybatisplus.annotation.TableId;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class GroupMessage {
    @TableId
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    private String groupUuid;
    private String senderOpenid;

    private Integer messageType;        // 1:文本 2:图片 3:文件 4:语音
    private String content;             // 消息内容
    
    private Boolean isRead;             // 是否可读
    private Boolean isRecalled;         // 是否撤回
    private LocalDateTime sendTime;     // 发送时间
}
